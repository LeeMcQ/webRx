// RF MMN Monitor — spectrum, waterfall and GPS-tagged measurement logging.
//
// Sources: RTL-SDR or HackRF One/Pro over WebUSB (spectrum computed by the
// Rust/WASM DSP core), or the browser's Network Information API for Wi-Fi /
// cellular quality estimates. Location from the phone's GPS or a G-MOUSE USB
// receiver over Web Serial. Every recording is saved on the device as it runs
// (IndexedDB) and opens in the MMN map (map.html) or exports/shares as CSV.

import { FFT } from "@jtarrio/signals/dsp/fft.js";
import { DirectSampling, RtlDevice } from "@jtarrio/webrtlsdr/rtlsdr/rtldevice.js";
import { HackRF } from "../../devices/hackrf.js";
import { ConnectedSdr, SdrKind, SdrProvider } from "../../devices/provider.js";
import { formatRate, sampleRatesFor } from "../../devices/rates.js";
import { DspExports, Scratch, dsp, dspStatus, f32View, u8View } from "../../dsp/wasm.js";
import {
  GpsSource,
  formatLatLon,
  gps,
  hasWebSerial,
  isMobileDevice,
} from "../../gps/gps.js";
import { canInstallApp, onInstallAvailabilityChange, promptInstallApp } from "../../ui/install.js";
import { compass, formatHeading } from "../../gps/compass.js";
import { LiveMap } from "../../ui/livemap.js";
import { DistanceFormula, PowerAverager, SpatialSampler, bandBins, haversineM, spectrumLevels } from "../../sampling/spatial.js";
import {
  Calibration,
  CalibrationSettings,
  CalibrationStep,
  DEFAULT_GUARD_DB,
  calibrationCsv,
  loadCalibration,
  mismatches,
  newCalibrationId,
  reduceSpectrum,
  saveCalibration,
} from "../../calibration/calibration.js";
import {
  RecordingRow,
  RecordingSession,
  canShareFiles,
  csvFileName,
  deliverCsv,
  getSession,
  listSessions,
  newSessionId,
  notifyRecordings,
  onRecordingsChanged,
  saveSession,
  toCsv,
} from "../../storage/recordings.js";

type Mode = SdrKind | "wifi" | "cellular";
type Settings = {
  mode: Mode;
  freqMHz: number;
  sampleRate: number;
  fftSize: number;
  avg: number;
  gain: number | null;
  cal: number;
  logEvery: number;
  amp: boolean;
  dcRemove: boolean;
  peakHold: boolean;
  biasTee: boolean;
  needFix: boolean;
  /** "distance": a pin every spacingM metres (thesis §3.5); "time": every logEvery seconds. */
  logMode: "distance" | "time";
  spacingM: number;
  distFormula: DistanceFormula;
  /** Measurement bandwidth in kHz around the centre; null = centre 50 % of the span. */
  bwKHz: number | null;
  calSeconds: number;
};

const STORE_KEY = "webrx.monitor";
const DEFAULTS: Settings = {
  mode: "auto",
  freqMHz: 433.92,
  sampleRate: 2_048_000,
  fftSize: 1024,
  avg: 0.6,
  gain: null,
  cal: 0,
  logEvery: 1,
  amp: false,
  dcRemove: true,
  peakHold: true,
  biasTee: false,
  needFix: false,
  logMode: "distance",
  spacingM: 5,
  distFormula: "haversine",
  bwKHz: null,
  calSeconds: 10,
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ═══════════════════════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════════════════════

let cfg: Settings = loadSettings();
let device: RtlDevice | null = null;
let sdr: ConnectedSdr | undefined;
let running = false;
let session = 0;
let loopDone: Promise<void> = Promise.resolve();
let ctlChain: Promise<unknown> = Promise.resolve();
let netTimer: number | null = null;
let wakeLock: any = null;

let psd: PsdEngine | null = null;
let raw = new Float32Array(0); // latest PSD (dB)
let spec = new Float32Array(0); // smoothed (dB)
let peak = new Float32Array(0); // peak hold (dB)
let frames = 0;
let lastLogAt = 0;
let lastTimelineAt = 0;
let dspMs = 0;
let dirty = false;
let lastStats: { peak: number; peakHz: number; band: number; spec: number } | null = null;
let netInfo: { quality: number; rssi: number; rtt: number | null; dl: number; type: string; eff: string } | null = null;
const timeline: { peak: number; band: number }[] = [];
/** Readings since the last pin, averaged per frequency bin (thesis §3.5.4). */
const pinAvg = new PowerAverager();
const sampler = new SpatialSampler({ spacingM: 5, formula: "haversine", jitterGuard: true });
let pinHint = "";
/** Set while a calibration step is measuring; blocks go there instead of into records. */
let calRun: { avg: PowerAverager; from: number; until: number; done: () => void } | null = null;
let yLo = -100;
let yHi = -20;

const provider = new SdrProvider({
  kind: () => (cfg.mode === "rtlsdr" || cfg.mode === "hackrf" ? cfg.mode : "auto"),
  hackrfAmp: () => cfg.amp,
});

function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

let bound = false;

function saveSettings() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
  } catch (_) {}
  if (bound) {
    renderRecording();
    dirty = true;
  }
}

function isSdrMode(m: Mode = cfg.mode): m is SdrKind {
  return m === "auto" || m === "rtlsdr" || m === "hackrf";
}

/** Serialises device control calls so they never interleave. */
function ctl<T>(fn: () => Promise<T>): Promise<T> {
  const p = ctlChain.then(fn, fn);
  ctlChain = p.catch(() => {});
  return p;
}

// ═══════════════════════════════════════════════════════════════════
//  Spectrum estimation (Rust/WASM, JS fallback)
// ═══════════════════════════════════════════════════════════════════

class PsdEngine {
  readonly n: number;
  private window: Float32Array;
  private wsum: number;
  private ex: DspExports | null;
  private handle = 0;
  private scratch: Scratch | null = null;
  private fft: ReturnType<typeof FFT.ofLength> | null = null;
  private acc: Float64Array;
  private I: Float32Array;
  private Q: Float32Array;

  constructor(n: number) {
    this.n = n;
    this.window = new Float32Array(n);
    for (let i = 0; i < n; ++i) this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    this.wsum = this.window.reduce((a, b) => a + b, 0);
    this.acc = new Float64Array(n);
    this.I = new Float32Array(n);
    this.Q = new Float32Array(n);
    this.ex = dsp();
    if (this.ex) {
      this.handle = this.ex.fft_new(n);
      f32View(this.ex, this.ex.fft_window_ptr(this.handle), n).set(this.window);
      this.scratch = new Scratch(this.ex);
    } else {
      this.fft = FFT.ofLength(n);
      this.fft.setWindow(this.window);
    }
  }

  get engine(): string {
    return this.ex ? "Rust/WASM" : "JavaScript";
  }

  /** Averaged power spectrum in dBFS (DC centred) of unsigned 8-bit IQ. Returns blocks used. */
  compute(bytes: Uint8Array, maxBlocks: number, out: Float32Array): number {
    const n = this.n;
    const blocks = Math.min(Math.floor(bytes.length / (2 * n)), maxBlocks);
    if (blocks < 1) return 0;
    const used = blocks * 2 * n;
    if (this.ex && this.scratch) {
      const ex = this.ex;
      const inBytes = (used + 15) & ~15;
      const p = this.scratch.get(inBytes + n * 4);
      u8View(ex, p, used).set(bytes.subarray(0, used));
      ex.fft_psd_iq8(this.handle, p, used, 0, p + inBytes, n, 0);
      out.set(f32View(ex, p + inBytes, n));
      return blocks;
    }
    // JavaScript fallback using the signals FFT (output scaled by window/N).
    const fft = this.fft!;
    this.acc.fill(0);
    for (let b = 0; b < blocks; ++b) {
      const o = b * 2 * n;
      for (let i = 0; i < n; ++i) {
        this.I[i] = (bytes[o + 2 * i] - 127.5) / 127.5;
        this.Q[i] = (bytes[o + 2 * i + 1] - 127.5) / 127.5;
      }
      const [re, im] = fft.transform(this.I, this.Q);
      for (let k = 0; k < n; ++k) this.acc[k] += (re[k] * re[k] + im[k] * im[k]) * n * n;
    }
    const norm = 1 / (blocks * this.wsum * this.wsum);
    for (let k = 0; k < n; ++k) out[k] = 10 * Math.log10(this.acc[(k + n / 2) % n] * norm + 1e-30);
    return blocks;
  }

  free() {
    if (this.ex && this.handle) this.ex.fft_free(this.handle);
    this.scratch?.free();
    this.handle = 0;
  }
}

function resetSpectrum() {
  psd?.free();
  psd = new PsdEngine(cfg.fftSize);
  raw = new Float32Array(cfg.fftSize);
  spec = new Float32Array(cfg.fftSize).fill(NaN);
  peak = new Float32Array(cfg.fftSize).fill(-200);
  wfRow = null;
}

// ═══════════════════════════════════════════════════════════════════
//  Logging
// ═══════════════════════════════════════════════════════════════════

function log(msg: string, cls = "") {
  const box = $("logBox");
  const d = document.createElement("div");
  if (cls) d.className = cls;
  d.textContent = `${new Date().toLocaleTimeString()} › ${msg}`;
  box.appendChild(d);
  while (box.childElementCount > 400) box.firstElementChild!.remove();
  box.scrollTop = box.scrollHeight;
}

function setChip(dotId: string, txtId: string, text: string, state: "" | "ok" | "live" | "warn" | "err") {
  $(txtId).textContent = text;
  $(dotId).className = `dot ${state}`;
}

// ═══════════════════════════════════════════════════════════════════
//  SDR connect / start / stop
// ═══════════════════════════════════════════════════════════════════

async function connect(): Promise<boolean> {
  if (!isSdrMode()) {
    const conn = getConnection();
    if (!conn) {
      log("Network Information API not available (Chrome/Edge on Android, Windows, macOS only)", "er");
      setChip("dotSource", "txtSource", "No Network API", "err");
      return false;
    }
    readNetworkInfo();
    setChip("dotSource", "txtSource", `${cfg.mode === "wifi" ? "Wi-Fi" : "Cellular"} monitor`, "ok");
    log(`${cfg.mode.toUpperCase()} network monitor ready — press Start`, "ok");
    return true;
  }
  if (device) return true;
  try {
    setChip("dotSource", "txtSource", "Choose device…", "warn");
    device = await provider.get();
    sdr = provider.connected;
    const kind = sdr?.kind ?? "rtlsdr";
    fillRates(kind);
    ($("freq") as HTMLInputElement).max = String((sdr?.maxFrequency ?? 1.8e9) / 1e6);
    setChip("dotSource", "txtSource", `${sdr?.name ?? "SDR"} ready`, "ok");
    log(`${sdr?.name ?? "SDR"} connected${sdr?.detail ? ` (${sdr.detail})` : ""}`, "ok");
    updateSourceUi();
    return true;
  } catch (e: any) {
    device = null;
    sdr = undefined;
    const notChosen = e?.cause?.name === "NotFoundError" || /No device was selected/.test(e?.message);
    setChip("dotSource", "txtSource", notChosen ? "No device chosen" : "Connect failed", notChosen ? "" : "err");
    log(notChosen ? "No device selected" : `Connect failed: ${e?.message ?? e}`, notChosen ? "wn" : "er");
    if (!notChosen && e?.message) {
      $("sourceHint").textContent =
        "Close other SDR software, replug the device, and on Windows make sure RTL-SDR uses the WinUSB driver (Zadig).";
    }
    return false;
  }
}

async function disconnect() {
  await stop();
  const dev = device;
  device = null;
  sdr = undefined;
  if (dev) {
    try {
      await dev.close();
    } catch (_) {}
    log("SDR disconnected");
  }
  setChip("dotSource", "txtSource", "No source", "");
  updateSourceUi();
}

async function start() {
  if (running) return;
  if (!(await connect())) return;
  running = true;
  pinAvg.reset();
  lastLogAt = performance.now();
  lastFixT = 0;
  pinHint = cfg.logMode === "distance" ? "Measuring…" : "";
  const my = ++session;
  $("specIdle").style.display = "none";
  $("measState").textContent = "Measuring";
  requestWakeLock();
  updateButtons();
  if (isSdrMode()) {
    loopDone = sdrLoop(my).catch((e) => {
      log(`Acquisition stopped: ${e?.message ?? e}`, "er");
      setChip("dotSource", "txtSource", "Transfer error", "err");
    }).finally(() => {
      if (session === my) {
        running = false;
        updateButtons();
        $("measState").textContent = "Stopped";
      }
    });
  } else {
    pushNetworkSample();
    netTimer = setInterval(pushNetworkSample, 2000) as unknown as number;
    setChip("dotSource", "txtSource", `${cfg.mode === "wifi" ? "Wi-Fi" : "Cellular"} measuring`, "live");
    log(`${cfg.mode.toUpperCase()} measurement started`, "ok");
  }
}

async function stop() {
  if (!running) return;
  running = false;
  ++session;
  if (netTimer !== null) clearInterval(netTimer);
  netTimer = null;
  if (device instanceof HackRF) {
    await ctl(() => (device as HackRF).pause()).catch(() => {});
  }
  await Promise.race([loopDone, new Promise((r) => setTimeout(r, 1500))]);
  releaseWakeLock();
  saveNow();
  $("measState").textContent = "Stopped";
  if (device) setChip("dotSource", "txtSource", `${sdr?.name ?? "SDR"} ready`, "ok");
  updateButtons();
  log("Measurement stopped");
}

async function applyTuning(dev: RtlDevice) {
  const hz = Math.round(cfg.freqMHz * 1e6);
  if (sdr?.kind === "rtlsdr") {
    // The R820T tuner can't reach HF; use direct sampling (Q branch) below 28.8 MHz.
    await dev.setDirectSamplingMethod(hz < 28_800_000 ? DirectSampling.Q : DirectSampling.Off);
  }
  return dev.setCenterFrequency(hz);
}

async function sdrLoop(my: number) {
  const dev = device!;
  const actualRate = await ctl(() => dev.setSampleRate(cfg.sampleRate));
  if (actualRate !== cfg.sampleRate) {
    log(`Sample rate adjusted to ${formatRate(actualRate)} for this device`, "wn");
    cfg.sampleRate = actualRate;
    saveSettings();
    fillRates(sdr?.kind ?? "rtlsdr");
  }
  await ctl(() => applyTuning(dev));
  await ctl(() => dev.setGain(cfg.gain));
  await ctl(() => dev.enableBiasTee(cfg.biasTee));
  if (dev instanceof HackRF) await ctl(() => dev.setAmpEnabled(cfg.amp));
  await ctl(() => dev.resetBuffer());
  resetSpectrum();
  updateReadout();
  setChip("dotSource", "txtSource", `${sdr?.name ?? "SDR"} · ${formatRate(cfg.sampleRate)}`, "live");
  log(`${sdr?.name ?? "SDR"} RX ${cfg.freqMHz.toFixed(3)} MHz · ${formatRate(cfg.sampleRate)} · ${psd!.engine} FFT ${cfg.fftSize}`, "ok");

  // ~10 reads per second, two in flight for gap-free streaming.
  const perRead = 512 * Math.ceil(cfg.sampleRate / 10 / 512);
  const read = () => {
    const p = dev.readSamples(perRead);
    p.catch(() => {});
    return p;
  };
  let a = read();
  let b = read();
  while (running && session === my) {
    let block;
    try {
      block = await a;
    } catch (e) {
      if (!running || session !== my) return;
      throw e;
    }
    a = b;
    b = read();
    if (session !== my) return;
    processBlock(new Uint8Array(block.data));
  }
}

function processBlock(bytes: Uint8Array) {
  if (!psd || psd.n !== cfg.fftSize) resetSpectrum();
  const n = psd!.n;
  const t0 = performance.now();
  const blocks = psd!.compute(bytes, 512, raw);
  const t1 = performance.now();
  if (blocks === 0) return;
  dspMs = dspMs ? dspMs * 0.9 + (t1 - t0) * 0.1 : t1 - t0;

  const c = n >> 1;
  if (cfg.dcRemove) {
    const fill = (raw[c - 3] + raw[c + 3]) / 2;
    for (let k = c - 1; k <= c + 1; ++k) raw[k] = fill;
  }
  const a = Math.min(0.95, Math.max(0, cfg.avg));
  for (let k = 0; k < n; ++k) {
    const v = raw[k] + cfg.cal;
    spec[k] = Number.isNaN(spec[k]) ? v : a * spec[k] + (1 - a) * v;
    peak[k] = cfg.peakHold ? Math.max(peak[k] - 0.15, spec[k]) : spec[k];
  }
  ++frames;
  lastStats = computeStats();
  pushWaterfall();
  const now = performance.now();
  if (now - lastTimelineAt > 500) {
    lastTimelineAt = now;
    timeline.push({ peak: lastStats.peak, band: lastStats.band });
    if (timeline.length > 240) timeline.shift();
  }
  if (calRun) {
    // Calibration: skip the first moments after the stream starts, then average.
    if (now >= calRun.from) calRun.avg.addSpectrum(raw, cfg.cal);
    if (now >= calRun.until) calRun.done();
  } else if (running) {
    pinAvg.addSpectrum(raw, cfg.cal);
    if (cfg.logMode === "time" && now - lastLogAt >= cfg.logEvery * 1000) {
      lastLogAt = now;
      addRecord();
    }
  }
  dirty = true;
}

/** Live levels from the smoothed trace: peak and mean inside the measurement bandwidth, mean over the span. */
function computeStats() {
  const l = spectrumLevels(spec, cfg.freqMHz * 1e6, cfg.sampleRate, bwHz());
  return { peak: l.peak, peakHz: l.peakHz, band: l.band, spec: l.spec };
}

function bwHz(): number | null {
  return isSdrMode() && cfg.bwKHz ? cfg.bwKHz * 1000 : null;
}

// ═══════════════════════════════════════════════════════════════════
//  Records / CSV
// ═══════════════════════════════════════════════════════════════════

// Column names the MMN map understands (latitude/longitude + *_level_db etc.).
const COLUMNS = [
  "timestamp",
  "device",
  "center_freq_hz",
  "sample_rate_hz",
  "gps_source",
  "latitude",
  "longitude",
  "altitude_m",
  "gps_accuracy_m",
  "gps_sats",
  "compass_deg",
  "course_deg",
  "peak_power_db",
  "peak_freq_hz",
  "band_mean_level_db",
  "spectrum_mean_level_db",
  "units",
  "calibration_db",
  "net_quality_pct",
  // Thesis §3.5 / §3.4: how the pin was taken and how it compares with the noise floor.
  "sampling",
  "pin_spacing_m",
  "samples_averaged",
  "measurement_bw_hz",
  "gain_db",
  "noise_floor_db",
  "threshold_db",
  "above_threshold",
  "calibration_id",
];
/** Unfinished recordings younger than this continue after a reload. */
const RESUME_WITHIN_MS = 24 * 3600 * 1000;
/** Rows not yet in IndexedDB, copied synchronously when the page is hidden or closed. */
const TAIL_KEY = "webrx.monitor.unsaved";

let rec: RecordingSession | null = null;
let positioned = 0;
let aboveCount = 0;
let skippedNoFix = 0;
let saveTimer: number | null = null;
let saveChain: Promise<void> = Promise.resolve();
let savedRows = 0;
let saveError = "";

function rows(): RecordingRow[] {
  return rec ? rec.rows : [];
}

function gpsColumns(): RecordingRow {
  const f = gps.fix;
  return {
    gps_source: f ? f.source : gps.status.source,
    latitude: f ? f.lat.toFixed(6) : "",
    longitude: f ? f.lon.toFixed(6) : "",
    altitude_m: f?.altM !== undefined ? f.altM.toFixed(1) : "",
    gps_accuracy_m: f?.accuracyM !== undefined ? f.accuracyM.toFixed(1) : "",
    gps_sats: f?.satellites !== undefined ? String(f.satellites) : "",
    compass_deg: compass.status.state === "on" && compass.status.heading !== undefined ? compass.status.heading.toFixed(0) : "",
    course_deg: f?.headingDeg !== undefined ? f.headingDeg.toFixed(0) : "",
  };
}

function currentUnits() {
  return isSdrMode() ? (cfg.cal !== 0 ? "dBm(cal)" : "dBFS") : "dBm(est)";
}

function describeSource(): string {
  if (isSdrMode()) return `${sdr?.name ?? "SDR"} · ${String(+cfg.freqMHz.toFixed(3))} MHz`;
  return cfg.mode === "wifi" ? "Wi-Fi" : "Cellular";
}

function ensureRecording(): RecordingSession {
  if (rec) return rec;
  const now = Date.now();
  const summary = describeSource();
  rec = {
    id: newSessionId(),
    name: `${summary} · ${new Date(now).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`,
    startedAt: now,
    updatedAt: now,
    columns: COLUMNS,
    rows: [],
    summary,
    finished: false,
  };
  positioned = 0;
  savedRows = 0;
  log(`Recording started: ${rec.name}`, "ok");
  return rec;
}

/** The calibration that applies to the current settings, if any. */
function activeCalibration(): Calibration | null {
  const c = loadCalibration();
  return c && isSdrMode() && !mismatches(c, currentCalSettings()).length ? c : null;
}

function currentCalSettings(): CalibrationSettings {
  return {
    // Until a receiver is connected, assume it's the one the calibration was made with.
    device: sdr?.name ?? loadCalibration()?.device ?? "SDR",
    centerHz: Math.round(cfg.freqMHz * 1e6),
    sampleRate: cfg.sampleRate,
    bwHz: bwHz(),
    fftSize: cfg.fftSize,
    gain: cfg.gain,
    amp: cfg.amp,
    biasTee: cfg.biasTee,
    calDb: cfg.cal,
    units: currentUnits(),
  };
}

function samplingLabel() {
  return cfg.logMode === "distance" ? `distance ${cfg.spacingM} m (${cfg.distFormula === "euclidean" ? "Eq 3-6" : "haversine"})` : `time ${cfg.logEvery} s`;
}

/** Records one pin from everything averaged since the previous one. */
function addRecord(spacingM?: number) {
  const g = gpsColumns();
  if (cfg.logMode === "time" && cfg.needFix && g.latitude === "") {
    skippedNoFix++;
    pinAvg.reset();
    renderRecording();
    return;
  }
  let row: RecordingRow | null = null;
  const base = { timestamp: new Date().toISOString(), ...g, units: currentUnits(), calibration_db: cfg.cal, sampling: samplingLabel() };
  if (spacingM === undefined && g.latitude !== "") {
    const prev = [...rows()].reverse().find((x) => x.latitude !== "");
    if (prev) spacingM = haversineM(Number(prev.latitude), Number(prev.longitude), Number(g.latitude), Number(g.longitude));
  }
  if (isSdrMode()) {
    const mean = pinAvg.meanSpectrum();
    if (!mean) return;
    const l = spectrumLevels(mean, cfg.freqMHz * 1e6, cfg.sampleRate, bwHz());
    const cal = activeCalibration();
    const above = cal ? (l.band >= cal.thresholdDb ? 1 : 0) : "";
    row = {
      ...base,
      device: sdr?.name ?? "SDR",
      center_freq_hz: Math.round(cfg.freqMHz * 1e6),
      sample_rate_hz: cfg.sampleRate,
      peak_power_db: l.peak.toFixed(2),
      peak_freq_hz: Math.round(l.peakHz),
      band_mean_level_db: l.band.toFixed(2),
      spectrum_mean_level_db: l.spec.toFixed(2),
      net_quality_pct: "",
      pin_spacing_m: spacingM !== undefined ? spacingM.toFixed(1) : "",
      samples_averaged: pinAvg.blocks,
      measurement_bw_hz: bwHz() ?? Math.round(cfg.sampleRate / 2),
      gain_db: cfg.gain ?? "auto",
      noise_floor_db: cal ? cal.noiseFloorDb.toFixed(2) : "",
      threshold_db: cal ? cal.thresholdDb.toFixed(2) : "",
      above_threshold: above,
      calibration_id: cal ? cal.id : "",
    };
  } else if (netInfo) {
    const m = pinAvg.meanLevels();
    const rssi = Number.isFinite(m.rssi) ? m.rssi : netInfo.rssi;
    row = {
      ...base,
      device: cfg.mode === "wifi" ? "Wi-Fi (estimated)" : "Cellular (estimated)",
      center_freq_hz: "",
      sample_rate_hz: "",
      peak_power_db: rssi.toFixed(1),
      peak_freq_hz: "",
      band_mean_level_db: rssi.toFixed(1),
      spectrum_mean_level_db: netInfo.rtt !== null ? String(netInfo.rtt) : "",
      net_quality_pct: String(netInfo.quality),
      pin_spacing_m: spacingM !== undefined ? spacingM.toFixed(1) : "",
      samples_averaged: pinAvg.levelCount || 1,
      measurement_bw_hz: "",
      gain_db: "",
      noise_floor_db: "",
      threshold_db: "",
      above_threshold: "",
      calibration_id: "",
    };
  }
  pinAvg.reset();
  if (!row) return;
  const r = ensureRecording();
  r.rows.push(row);
  r.updatedAt = Date.now();
  if (row.latitude !== "") positioned++;
  if (row.above_threshold === 1) aboveCount++;
  scheduleSave();
  renderRecording();
  refreshMapPoints();
}

// ── spatial sampling: a pin each time the vehicle has moved the set distance ──

let lastFixT = 0;

function onGpsForPins() {
  const f = gps.fix;
  sampler.opts.spacingM = cfg.spacingM;
  sampler.opts.formula = cfg.distFormula;
  if (cfg.logMode !== "distance") return;
  if (!running || calRun) {
    pinHint = "";
    return;
  }
  if (!f || gps.status.state !== "fix") {
    pinHint = "Waiting for a GPS fix — pins need a position";
    renderRecording();
    return;
  }
  if (f.timestamp === lastFixT) return;
  lastFixT = f.timestamp;
  const hasData = isSdrMode() ? pinAvg.blocks > 0 : pinAvg.levelCount > 0;
  const pos = { lat: f.lat, lon: f.lon, t: f.timestamp, accuracyM: f.accuracyM, speedKmh: f.speedKmh };
  const d = sampler.decide(pos);
  if (!d.place || !hasData) {
    pinHint =
      d.reason === "jitter"
        ? `Standing still (GPS ±${Math.round(f.accuracyM ?? 0)} m) — next pin after ${cfg.spacingM} m of travel`
        : !hasData
          ? "Measuring…"
          : `Next pin in ${Math.max(0, cfg.spacingM - d.distanceM).toFixed(1)} m`;
    renderRecording();
    return;
  }
  addRecord(d.reason === "first" ? undefined : d.distanceM);
  sampler.commit(pos);
  // Faster than the GPS can place pins at this spacing (thesis §3.5.3)?
  if (d.distanceM > 2 * cfg.spacingM && (f.speedKmh ?? 0) > 1) {
    pinHint = `Pins ${Math.round(d.distanceM)} m apart at ${Math.round(f.speedKmh!)} km/h — the GPS updates too slowly for ${cfg.spacingM} m`;
  } else pinHint = `Pin placed · next in ${cfg.spacingM} m`;
  renderRecording();
}

/** Continue spacing from the last positioned row of a restored recording. */
function resumeSampler() {
  const last = [...rows()].reverse().find((x) => x.latitude !== "" && x.latitude !== undefined);
  sampler.resume(last ? { lat: Number(last.latitude), lon: Number(last.longitude), t: Date.parse(String(last.timestamp)) } : null);
}

// ── saving (debounced while measuring; immediately on stop / leaving the page) ──

function scheduleSave() {
  if (saveTimer !== null) return;
  const delay = rows().length > 3000 ? 8000 : 3000;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, delay) as unknown as number;
}

function saveNow(): Promise<void> {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const r = rec;
  if (!r || !r.rows.length) return saveChain;
  const count = r.rows.length;
  r.active = running && rec === r;
  saveChain = saveChain
    .then(() => saveSession(r))
    .then(() => {
      if (saveError) log("Recording saved on this device again", "ok");
      saveError = "";
      if (rec === r) savedRows = count;
      if (rec === r && savedRows >= r.rows.length) clearTail();
      notifyRecordings({ type: "saved", id: r.id });
    })
    .catch((e: any) => {
      if (!saveError) log(`Can't save the recording on this device (${e?.message ?? e}) — use ⬇ CSV to keep it`, "er");
      saveError = String(e?.message ?? e);
    })
    .finally(renderRecording);
  return saveChain;
}

/** Synchronous safety copy of the rows the last IndexedDB save hasn't covered yet. */
function stashTail() {
  try {
    if (rec && savedRows < rec.rows.length) {
      const { rows: all, ...meta } = rec;
      localStorage.setItem(TAIL_KEY, JSON.stringify({ meta, from: savedRows, rows: all.slice(savedRows) }));
    }
  } catch (_) {}
}

function clearTail() {
  try {
    localStorage.removeItem(TAIL_KEY);
  } catch (_) {}
}

function takeTail(): { meta: Omit<RecordingSession, "rows">; from: number; rows: RecordingRow[] } | null {
  try {
    const t = JSON.parse(localStorage.getItem(TAIL_KEY) || "null");
    clearTail();
    return t && t.meta && Array.isArray(t.rows) ? t : null;
  } catch (_) {
    return null;
  }
}

function onPageHidden() {
  stashTail();
  saveNow();
}

/** Picks up the last unfinished recording after a reload, crash or a phone that slept. */
async function restoreRecording() {
  const tail = takeTail();
  try {
    let full: RecordingSession | undefined;
    const last = (await listSessions()).find((x) => !x.finished && x.count > 0);
    if (last && Date.now() - last.updatedAt < RESUME_WITHIN_MS) full = await getSession(last.id);
    if (tail && (!full || full.id !== tail.meta.id) && tail.from === 0) {
      // The page closed before the first save of a new recording.
      full = { ...tail.meta, rows: [] };
    }
    if (full && !rec) {
      let extra: RecordingRow[] = [];
      if (tail && tail.meta.id === full.id) extra = tail.rows.slice(Math.max(0, full.rows.length - tail.from));
      rec = full;
      savedRows = full.rows.length;
      full.columns = [...full.columns, ...COLUMNS.filter((c) => !full!.columns.includes(c))];
      full.rows.push(...extra);
      if (extra.length) full.updatedAt = Date.now();
      positioned = full.rows.filter((x) => x.latitude !== "" && x.latitude !== undefined).length;
      aboveCount = full.rows.filter((x) => x.above_threshold === 1 || x.above_threshold === "1").length;
      resumeSampler();
      log(`Continuing recording “${full.name}” — ${full.rows.length} records restored. Press ＋ New to start another.`, "ok");
      if (extra.length) saveNow();
    }
  } catch (e: any) {
    saveError = String(e?.message ?? e);
    log("This browser can't keep recordings (private window?) — use ⬇ CSV before closing", "wn");
  }
  renderRecording();
  refreshMapPoints();
}

async function newRecording() {
  if (rec) {
    rec.finished = true;
    await saveNow();
    log(`Saved “${rec.name}” (${rec.rows.length} records) — open it any time from 🗺 Map`, "ok");
  }
  rec = null;
  positioned = 0;
  aboveCount = 0;
  skippedNoFix = 0;
  savedRows = 0;
  sampler.reset();
  pinAvg.reset();
  renderRecording();
  refreshMapPoints();
  log(running ? "New recording — logging continues" : "Ready for a new recording — press Start", "ok");
}

function renderRecording() {
  const n = rows().length;
  $("stRecords").textContent = String(n);
  $("recName").textContent = rec ? rec.name : "No recording yet";
  $("recDot").className = `recdot${running && rec ? " on" : ""}`;
  const cal = activeCalibration();
  const parts = rec
    ? [`${n} pin${n === 1 ? "" : "s"}`, `${positioned} with GPS`]
    : [running ? "Waiting for the first pin…" : "Press Start to record"];
  if (rec && cal) parts.push(`${aboveCount} above noise floor (${n ? Math.round((aboveCount / n) * 100) : 0}%)`);
  if (skippedNoFix) parts.push(`${skippedNoFix} skipped (no GPS fix)`);
  $("recMeta").textContent = parts.join(" · ");
  $("recHint").textContent = running ? pinHint : cfg.logMode === "distance" ? `A pin every ${cfg.spacingM} m of travel (spatial sampling)` : `A record every ${cfg.logEvery} s`;
  renderCalStatus();
  const st = $("recSaved");
  if (saveError) {
    st.textContent = "⚠ not saved";
    st.className = "lbl err";
    st.title = saveError;
  } else if (rec && savedRows < n) {
    st.textContent = "saving…";
    st.className = "lbl";
    st.title = "";
  } else {
    st.textContent = rec ? "✓ saved on device" : "";
    st.className = "lbl ok";
    st.title = "";
  }
  for (const id of ["btnCSV", "btnShare", "btnClear"]) $<HTMLButtonElement>(id).disabled = !n;
}

async function exportCsv(mode: "download" | "share" = "download") {
  if (!rec || !rec.rows.length) {
    log("No log records yet — press Start", "wn");
    return;
  }
  saveNow();
  const name = csvFileName(rec);
  const res = await deliverCsv(toCsv(rec.columns, rec.rows), name, mode);
  if (res !== "cancelled") log(`CSV ${res === "shared" ? "shared" : "saved"} — ${name} (${rec.rows.length} records)`, "ok");
}

async function openInMap() {
  if (!rec || !rec.rows.length) {
    location.href = "map.html";
    return;
  }
  await saveNow();
  if (saveError) {
    log("The recording couldn't be saved on this device, so the map can't open it — use ⬇ CSV and open the file in the map", "er");
    return;
  }
  const url = `map.html?session=${encodeURIComponent(rec.id)}`;
  if (running) {
    // Keep measuring here; the map follows the recording live from another tab.
    const w = window.open(url, "_blank");
    if (w) {
      log("Map opened in a new tab — measuring continues here", "ok");
      return;
    }
  }
  location.href = url;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function snapshot() {
  if (!frames && !netInfo) {
    log("No data yet", "wn");
    return;
  }
  const sp = $<HTMLCanvasElement>("spectrum");
  const wf = $<HTMLCanvasElement>("waterfall");
  const pad = 40;
  const out = document.createElement("canvas");
  out.width = sp.width;
  out.height = sp.height + wf.height + pad;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(sp, 0, pad);
  ctx.drawImage(wf, 0, pad + sp.height);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `${Math.round(13 * devicePixelRatio)}px system-ui, sans-serif`;
  const f = gps.fix;
  ctx.fillText(
    `${new Date().toLocaleString()} · ${cfg.freqMHz.toFixed(3)} MHz · span ${formatRate(cfg.sampleRate)} · ${sdr?.name ?? cfg.mode}` +
      (f ? ` · ${formatLatLon(f)}` : ""),
    10,
    pad * 0.65
  );
  out.toBlob((b) => b && download(b, `spectrum_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`), "image/png");
  log("Spectrum PNG saved", "ok");
}

// ═══════════════════════════════════════════════════════════════════
//  Pre-drive calibration (thesis §3.4, §4.3.1)
// ═══════════════════════════════════════════════════════════════════

let draft: { inherent?: CalibrationStep; vehicle?: CalibrationStep } = {};
let calBusy = false;

const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "—");

function renderCalStatus() {
  const el = document.getElementById("calStatus");
  if (!el) return;
  const c = loadCalibration();
  if (!isSdrMode()) {
    el.textContent = "Noise-floor calibration applies to SDR measurements";
    el.className = "lbl";
    return;
  }
  if (!c) {
    el.textContent = "⚠ Not calibrated — calibrate before driving";
    el.className = "lbl warn";
    return;
  }
  const mm = mismatches(c, currentCalSettings());
  if (mm.length) {
    el.textContent = `⚠ Calibration doesn't match: ${mm.join(", ")} — recalibrate`;
    el.className = "lbl warn";
    return;
  }
  el.textContent = `Noise floor ${f1(c.noiseFloorDb)} · threshold ${f1(c.thresholdDb)} ${c.units} (+${c.guardDb} dB) · ${new Date(c.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`;
  el.className = "lbl ok";
}

function renderCalChecks() {
  const items: [string, string][] = [];
  if (!isSdrMode()) items.push(["bad", "Choose an SDR source (RTL-SDR or HackRF) — calibration measures the SDR"]);
  items.push(sdr ? ["ok", `${sdr.name} connected`] : ["bad", "Receiver not connected"]);
  items.push([
    "info",
    `${String(+cfg.freqMHz.toFixed(3))} MHz · bandwidth ${cfg.bwKHz ? `${cfg.bwKHz} kHz` : "50% of span"} · ${formatRate(cfg.sampleRate)} · FFT ${cfg.fftSize} · cal. offset ${cfg.cal} dB`,
  ]);
  if (!cfg.bwKHz) items.push(["warn", "Set the measurement bandwidth to the channel you measure (pilot test: 150 kHz) — it sets what “band mean” covers"]);
  items.push(
    cfg.gain === null
      ? ["warn", "Gain is on auto — the noise floor depends on gain (§3.4.6). Use a fixed gain for calibration and the drive."]
      : ["ok", `Fixed gain ${cfg.gain} dB${sdr?.kind === "hackrf" ? `, RF amp ${cfg.amp ? "on" : "off"}` : ""}`]
  );
  const f = gps.fix;
  items.push(
    f && gps.status.state === "fix"
      ? ["ok", `GPS fix ${formatLatLon(f)}${f.accuracyM !== undefined ? ` ±${Math.round(f.accuracyM)} m` : ""} — calibrate where you'll drive (§3.4.5)`]
      : ["warn", "No GPS fix yet — not needed to calibrate, but needed for the drive"]
  );
  $("calChecks").innerHTML = items.map(([c, t]) => `<li class="${c}">${t.replace(/</g, "&lt;")}</li>`).join("");
  $("calConnect").hidden = !!sdr || !isSdrMode();
  $("calFixGain").hidden = cfg.gain !== null;

  const c = loadCalibration();
  const cur = $("calCurrent");
  if (c) {
    const mm = mismatches(c, currentCalSettings());
    cur.innerHTML =
      `Saved calibration: noise floor <b>${f1(c.noiseFloorDb)}</b>, threshold <b>${f1(c.thresholdDb)} ${c.units}</b> (+${c.guardDb} dB), ` +
      `${(c.centerHz / 1e6).toFixed(3)} MHz, ${new Date(c.createdAt).toLocaleString()}` +
      (mm.length ? `<br><span style="color:#fbbf24">Doesn't match the current settings: ${mm.join(", ")}</span>` : "");
  } else cur.textContent = "";
}

function stepText(st: CalibrationStep, label: string) {
  return `${label}: band mean <b>${f1(st.bandMeanDb)}</b> · peak ${f1(st.peakDb)} · span mean ${f1(st.spectrumMeanDb)} ${currentUnits()} <span class="lbl">(${st.blocks} spectra, ${st.durationS} s)</span>`;
}

function renderCalResults() {
  const c = loadCalibration();
  const inh = draft.inherent;
  const veh = draft.vehicle;
  $("calRes1").innerHTML = inh ? stepText(inh, "Receiver noise") : "";
  $("calRes2").innerHTML = veh
    ? stepText(veh, "Noise floor") + (inh ? `<br>The vehicle adds <b>${f1(veh.bandMeanDb - inh.bandMeanDb)} dB</b> over the receiver's own noise.` : "")
    : "";
  const guard = Number($<HTMLInputElement>("calGuard").value);
  const floor = veh?.bandMeanDb ?? (c && !mismatches(c, currentCalSettings()).length ? c.noiseFloorDb : NaN);
  $("calRes3").innerHTML = Number.isFinite(floor)
    ? `Threshold = ${f1(floor)} + ${Number.isFinite(guard) ? guard : 0} dB = <b>${f1(floor + (Number.isFinite(guard) ? guard : 0))} ${currentUnits()}</b>. Pins with a band mean below it are flagged and hidden on the map.`
    : "Measure the vehicle noise to set the threshold.";
  $<HTMLButtonElement>("calSave").disabled = !Number.isFinite(floor) || !Number.isFinite(guard);
  $<HTMLButtonElement>("calCsv").disabled = !veh && !inh && !c;
  drawCalChart();
}

function drawCalChart() {
  const cv = $<HTMLCanvasElement>("calChart");
  const ctx = fitCanvas(cv);
  const W = cv.width;
  const H = cv.height;
  const dpr = W / Math.max(1, cv.clientWidth);
  ctx.clearRect(0, 0, W, H);
  const saved = loadCalibration();
  const useSaved = !draft.inherent && !draft.vehicle && saved;
  const inh = draft.inherent ?? (useSaved ? saved!.inherent : undefined);
  const veh = draft.vehicle ?? (useSaved ? saved!.vehicle : undefined);
  const ref = veh ?? inh;
  ctx.font = `${10 * dpr}px ui-monospace, monospace`;
  if (!ref) {
    ctx.fillStyle = "#64748b";
    ctx.fillText("Spectra appear here after each measurement", 10 * dpr, 20 * dpr);
    return;
  }
  const guard = Number($<HTMLInputElement>("calGuard").value) || 0;
  const thr = (veh?.bandMeanDb ?? NaN) + guard;
  const all = [...(inh?.spectrum ?? []), ...(veh?.spectrum ?? [])];
  let lo = Math.min(...all);
  let hi = Math.max(...all, Number.isFinite(thr) ? thr : -Infinity);
  lo = Math.floor(lo / 5) * 5 - 5;
  hi = Math.ceil(hi / 5) * 5 + 5;
  const left = 36 * dpr;
  const bottom = 16 * dpr;
  const pw = W - left - 6 * dpr;
  const ph = H - bottom - 6 * dpr;
  const y = (v: number) => 6 * dpr + (1 - (v - lo) / (hi - lo)) * ph;
  const x = (i: number, n: number) => left + ((i + 0.5) / n) * pw;
  ctx.strokeStyle = "rgba(148,163,184,0.15)";
  ctx.fillStyle = "#64748b";
  ctx.lineWidth = 1;
  for (let v = lo; v <= hi; v += (hi - lo) / 5) {
    ctx.beginPath();
    ctx.moveTo(left, Math.round(y(v)) + 0.5);
    ctx.lineTo(left + pw, Math.round(y(v)) + 0.5);
    ctx.stroke();
    ctx.fillText(v.toFixed(0), 2 * dpr, y(v) + 3 * dpr);
  }
  ctx.fillText(`${(ref.freqStartHz / 1e6).toFixed(3)} MHz`, left, H - 3 * dpr);
  const endLabel = `${(ref.freqStopHz / 1e6).toFixed(3)} MHz`;
  ctx.fillText(endLabel, left + pw - ctx.measureText(endLabel).width, H - 3 * dpr);
  // measurement band
  const span = ref.freqStopHz - ref.freqStartHz;
  const [b0, b1] = bandBins(1000, span, bwHz());
  ctx.fillStyle = "rgba(59,130,246,0.12)";
  ctx.fillRect(left + (b0 / 1000) * pw, 6 * dpr, ((b1 - b0) / 1000) * pw, ph);
  const trace = (sp: number[] | undefined, colour: string) => {
    if (!sp?.length) return;
    ctx.beginPath();
    sp.forEach((v, i) => (i ? ctx.lineTo(x(i, sp.length), y(v)) : ctx.moveTo(x(i, sp.length), y(v))));
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();
  };
  trace(inh?.spectrum, "#60a5fa");
  trace(veh?.spectrum, "#f59e0b");
  if (Number.isFinite(thr)) {
    ctx.save();
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    ctx.strokeStyle = "#f87171";
    ctx.beginPath();
    ctx.moveTo(left, y(thr));
    ctx.lineTo(left + pw, y(thr));
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#f87171";
    ctx.fillText(`threshold ${thr.toFixed(1)}`, left + 4 * dpr, y(thr) - 4 * dpr);
  }
}

async function measureStep(which: "inherent" | "vehicle") {
  if (calBusy) return;
  if (!isSdrMode()) {
    log("Calibration needs an SDR source — choose RTL-SDR or HackRF", "wn");
    return;
  }
  calBusy = true;
  const n = which === "inherent" ? 1 : 2;
  const buttons = ["calMeasure1", "calMeasure2", "calSkip1", "calSave"].map((id) => $<HTMLButtonElement>(id));
  buttons.forEach((b) => (b.disabled = true));
  const prog = $(`calProg${n}`);
  const bar = prog.querySelector("i") as HTMLElement;
  $(`calRes${n}`).textContent = "Starting the receiver…";
  const avg = new PowerAverager();
  const secs = cfg.calSeconds;
  let finish!: () => void;
  const finished = new Promise<void>((r) => (finish = r));
  calRun = { avg, from: Infinity, until: Infinity, done: () => {
    calRun = null;
    finish();
  } };
  let startedHere = false;
  let ticker = 0;
  try {
    if (!running) {
      await start();
      startedHere = running;
      if (!running) throw new Error("the receiver didn't start");
    }
    const t0 = performance.now();
    // Let the tuner and USB stream settle before averaging.
    calRun!.from = t0 + 800;
    calRun!.until = t0 + 800 + secs * 1000;
    prog.classList.add("on");
    $(`calRes${n}`).textContent = `Measuring for ${secs} s…`;
    ticker = setInterval(() => {
      bar.style.width = `${Math.min(100, ((performance.now() - t0) / (800 + secs * 1000)) * 100)}%`;
    }, 200) as unknown as number;
    // Safety net if the stream stops.
    const guard = setTimeout(() => calRun?.done(), 800 + secs * 1000 + 6000);
    await finished;
    clearTimeout(guard);
    const mean = avg.meanSpectrum();
    if (!mean) throw new Error("no spectra arrived — is the receiver streaming?");
    const l = spectrumLevels(mean, cfg.freqMHz * 1e6, cfg.sampleRate, bwHz());
    const step: CalibrationStep = {
      measuredAt: Date.now(),
      durationS: secs,
      blocks: avg.blocks,
      bandMeanDb: l.band,
      peakDb: l.peak,
      spectrumMeanDb: l.spec,
      spectrum: reduceSpectrum(mean),
      freqStartHz: cfg.freqMHz * 1e6 - cfg.sampleRate / 2,
      freqStopHz: cfg.freqMHz * 1e6 + cfg.sampleRate / 2,
    };
    draft[which] = step;
    log(`Calibration — ${which === "inherent" ? "receiver (dummy load)" : "vehicle"} noise: band mean ${f1(l.band)} ${currentUnits()} over ${avg.blocks} spectra`, "ok");
  } catch (e: any) {
    calRun = null;
    $(`calRes${n}`).textContent = `Couldn't measure: ${e?.message ?? e}`;
    log(`Calibration failed: ${e?.message ?? e}`, "er");
  } finally {
    clearInterval(ticker);
    bar.style.width = "0";
    prog.classList.remove("on");
    if (startedHere) await stop();
    buttons.forEach((b) => (b.disabled = false));
    calBusy = false;
    renderCalChecks();
    renderCalResults();
  }
}

function saveDraftCalibration() {
  const guard = Number($<HTMLInputElement>("calGuard").value);
  if (!Number.isFinite(guard)) return;
  const prev = loadCalibration();
  const f = gps.status.state === "fix" ? gps.fix : null;
  let c: Calibration;
  if (draft.vehicle) {
    c = {
      ...currentCalSettings(),
      id: newCalibrationId(),
      createdAt: Date.now(),
      lat: f?.lat,
      lon: f?.lon,
      inherent: draft.inherent,
      vehicle: draft.vehicle,
      noiseFloorDb: draft.vehicle.bandMeanDb,
      guardDb: guard,
      thresholdDb: draft.vehicle.bandMeanDb + guard,
    };
  } else if (prev && !mismatches(prev, currentCalSettings()).length) {
    c = { ...prev, guardDb: guard, thresholdDb: prev.noiseFloorDb + guard };
  } else return;
  saveCalibration(c);
  log(`Calibration saved: noise floor ${f1(c.noiseFloorDb)} + ${c.guardDb} dB → threshold ${f1(c.thresholdDb)} ${c.units}`, "ok");
  draft = {};
  renderCalChecks();
  renderCalResults();
  renderRecording();
  dirty = true;
}

function calibrationForExport(): Calibration | null {
  if (draft.inherent || draft.vehicle) {
    const guard = Number($<HTMLInputElement>("calGuard").value) || 0;
    const floor = (draft.vehicle ?? draft.inherent)!.bandMeanDb;
    return { ...currentCalSettings(), id: "draft", createdAt: Date.now(), inherent: draft.inherent, vehicle: draft.vehicle, noiseFloorDb: floor, guardDb: guard, thresholdDb: floor + guard };
  }
  return loadCalibration();
}

function openCalibration() {
  const dlg = $<HTMLDialogElement>("calDlg");
  draft = {};
  const c = loadCalibration();
  $<HTMLInputElement>("calGuard").value = String(c?.guardDb ?? DEFAULT_GUARD_DB);
  $<HTMLSelectElement>("calSeconds").value = String(cfg.calSeconds);
  ["calRes1", "calRes2"].forEach((id) => ($(id).textContent = ""));
  renderCalChecks();
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
  renderCalResults();
}

function bindCalibration() {
  const dlg = $<HTMLDialogElement>("calDlg");
  $("btnCalibrate").addEventListener("click", openCalibration);
  $("calClose").addEventListener("click", () => {
    if (calBusy) return;
    dlg.close();
  });
  dlg.addEventListener("cancel", (e) => {
    if (calBusy) e.preventDefault();
  });
  $("calConnect").addEventListener("click", async () => {
    await connect();
    updateButtons();
    renderCalChecks();
  });
  $("calFixGain").addEventListener("click", () => {
    const g = $<HTMLInputElement>("gain");
    $<HTMLInputElement>("gainAuto").checked = false;
    g.disabled = false;
    g.dispatchEvent(new Event("input"));
    renderCalChecks();
    renderCalResults();
  });
  $<HTMLSelectElement>("calSeconds").addEventListener("change", (e) => {
    cfg.calSeconds = Number((e.target as HTMLSelectElement).value) || 10;
    saveSettings();
  });
  $("calMeasure1").addEventListener("click", () => measureStep("inherent"));
  $("calMeasure2").addEventListener("click", () => measureStep("vehicle"));
  $("calSkip1").addEventListener("click", () => {
    draft.inherent = undefined;
    $("calRes1").textContent = "Skipped — the vehicle measurement alone sets the noise floor.";
    renderCalResults();
  });
  $("calGuard").addEventListener("input", renderCalResults);
  $("calSave").addEventListener("click", saveDraftCalibration);
  $("calCsv").addEventListener("click", () => {
    const c = calibrationForExport();
    if (!c) return;
    const d = new Date(c.createdAt);
    const pad = (x: number) => String(x).padStart(2, "0");
    const name = `mmn_calibration_${String(+(c.centerHz / 1e6).toFixed(3))}MHz_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.csv`;
    deliverCsv(calibrationCsv(c), name, "download");
  });
}

// ═══════════════════════════════════════════════════════════════════
//  Network Information API (Wi-Fi / cellular estimates)
// ═══════════════════════════════════════════════════════════════════

function getConnection(): any {
  const n = navigator as any;
  return n.connection || n.mozConnection || n.webkitConnection || null;
}

function readNetworkInfo() {
  const conn = getConnection();
  if (!conn) {
    for (const id of ["nType", "nEffType", "nDownlink", "nDownMax", "nRTT", "nQuality", "nRSSI", "nSave"]) $(id).textContent = "N/A";
    setChip("dotNet", "txtNet", "Network: no API", "");
    return null;
  }
  const type: string = conn.type || "—";
  const eff: string = conn.effectiveType || "—";
  const dl: number = typeof conn.downlink === "number" ? conn.downlink : NaN;
  const rtt: number | null = typeof conn.rtt === "number" ? conn.rtt : null;
  // Same estimate as before: effective type, adjusted by RTT and downlink.
  const ectScore: Record<string, number> = { "4g": 90, "3g": 60, "2g": 35, "slow-2g": 10 };
  let q = ectScore[eff] ?? 50;
  if (rtt !== null) {
    if (rtt < 50) q += 10;
    else if (rtt < 150) q += 5;
    else if (rtt > 300) q -= 20;
    else if (rtt > 200) q -= 10;
  }
  if (!Number.isNaN(dl)) {
    if (dl >= 10) q += 10;
    else if (dl < 0.5) q -= 15;
  }
  q = Math.max(0, Math.min(100, q));
  const isCell = type === "cellular" || cfg.mode === "cellular";
  const [lo, hi] = isCell ? [-110, -70] : [-90, -30];
  const rssi = Math.round(lo + (q / 100) * (hi - lo));
  const label = q >= 80 ? "Excellent" : q >= 60 ? "Good" : q >= 40 ? "Fair" : q >= 20 ? "Poor" : "Very poor";
  $("nType").textContent = type;
  $("nEffType").textContent = eff;
  $("nDownlink").textContent = Number.isNaN(dl) ? "—" : `${dl.toFixed(2)} Mbps`;
  $("nDownMax").textContent = typeof conn.downlinkMax === "number" && Number.isFinite(conn.downlinkMax) ? `${conn.downlinkMax.toFixed(1)} Mbps` : "—";
  $("nRTT").textContent = rtt !== null ? `${rtt} ms` : "—";
  $("nQuality").textContent = `${label} (${q}%)`;
  $("nRSSI").textContent = `${rssi} dBm (est.)`;
  $("nSave").textContent = conn.saveData ? "ON" : "off";
  const bar = $("signalBar");
  bar.style.width = `${q}%`;
  bar.style.background = q >= 60 ? "var(--ok)" : q >= 30 ? "var(--warn)" : "var(--err)";
  setChip("dotNet", "txtNet", `${(type !== "—" ? type : eff).toUpperCase()}${rtt !== null ? ` · ${rtt} ms` : ""}`, q >= 60 ? "ok" : q >= 30 ? "warn" : "err");
  netInfo = { quality: q, rssi, rtt, dl, type, eff };
  return netInfo;
}

function pushNetworkSample() {
  const info = readNetworkInfo();
  if (!info || !running) return;
  // A labelled pseudo-trace: noise floor plus a band at the estimated level (not RF power).
  const n = cfg.fftSize;
  if (spec.length !== n) resetSpectrum();
  for (let k = 0; k < n; ++k) {
    const inBand = Math.abs(k - n / 2) < n * 0.15;
    spec[k] = (inBand ? info.rssi : info.rssi - 30) + (Math.random() - 0.5) * 1.5;
    peak[k] = spec[k];
  }
  ++frames;
  lastStats = { peak: info.rssi, peakHz: 0, band: info.rssi, spec: info.rtt ?? NaN };
  timeline.push({ peak: info.rssi, band: -110 + (info.quality / 100) * 120 });
  if (timeline.length > 240) timeline.shift();
  pinAvg.addLevels({ rssi: info.rssi });
  if (cfg.logMode === "time") addRecord();
  pushWaterfall();
  dirty = true;
}

// ═══════════════════════════════════════════════════════════════════
//  Drawing
// ═══════════════════════════════════════════════════════════════════

function fitCanvas(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(50, Math.round(c.clientWidth * dpr));
  const h = Math.max(30, Math.round(c.clientHeight * dpr));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c.getContext("2d")!;
}

function freqLabel(hz: number): string {
  return hz >= 1e9 ? `${(hz / 1e9).toFixed(4)} GHz` : `${(hz / 1e6).toFixed(3)} MHz`;
}

function updateAutoRange() {
  if (!frames) return;
  const sorted = Float32Array.from(spec).sort();
  const floor = sorted[Math.floor(sorted.length * 0.1)];
  const top = sorted[sorted.length - 1];
  const lo = Math.floor((floor - 12) / 5) * 5;
  const hi = Math.max(lo + 40, Math.ceil((top + 8) / 5) * 5);
  yLo = yLo * 0.85 + lo * 0.15;
  yHi = yHi * 0.85 + hi * 0.15;
}

function drawSpectrum() {
  const c = $<HTMLCanvasElement>("spectrum");
  const ctx = fitCanvas(c);
  const W = c.width;
  const H = c.height;
  const dpr = W / Math.max(1, c.clientWidth);
  ctx.clearRect(0, 0, W, H);
  const left = 38 * dpr;
  const bottom = 18 * dpr;
  const pw = W - left;
  const ph = H - bottom;
  const y = (db: number) => ph - ((db - yLo) / (yHi - yLo)) * ph;

  // grid
  ctx.font = `${10 * dpr}px ui-monospace, monospace`;
  ctx.fillStyle = "#64748b";
  ctx.strokeStyle = "rgba(100,116,139,0.18)";
  ctx.lineWidth = 1;
  const step = yHi - yLo > 60 ? 20 : 10;
  for (let d = Math.ceil(yLo / step) * step; d <= yHi; d += step) {
    const yy = Math.round(y(d)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(left, yy);
    ctx.lineTo(W, yy);
    ctx.stroke();
    ctx.fillText(String(d), 2 * dpr, yy + 3 * dpr);
  }
  const span = isSdrMode() ? cfg.sampleRate : 0;
  // Show 5 frequency labels when they fit, otherwise edges + centre.
  const sample = ctx.measureText(freqLabel(cfg.freqMHz * 1e6)).width;
  const labelEvery = sample * 5 + 40 * dpr < pw ? 1 : 2;
  for (let i = 0; i <= 4; ++i) {
    const xx = Math.round(left + (pw * i) / 4) + 0.5;
    ctx.beginPath();
    ctx.moveTo(xx, 0);
    ctx.lineTo(xx, ph);
    ctx.stroke();
    if (span && i % labelEvery === 0) {
      const label = freqLabel(cfg.freqMHz * 1e6 + ((i - 2) * span) / 4);
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, Math.min(W - tw - 2, Math.max(left, xx - tw / 2)), H - 4 * dpr);
    }
  }
  if (!isSdrMode()) {
    ctx.fillText("noise floor", left + 4 * dpr, H - 4 * dpr);
    ctx.fillText("estimated level (not RF power)", left + pw / 2 - 70 * dpr, H - 4 * dpr);
  }
  // measurement band shading (bandwidth setting, or centre 50%)
  {
    const nb = spec.length || cfg.fftSize;
    const [b0, b1] = bandBins(nb, cfg.sampleRate, bwHz());
    ctx.fillStyle = "rgba(59,130,246,0.08)";
    ctx.fillRect(left + (b0 / nb) * pw, 0, ((b1 - b0) / nb) * pw, ph);
  }
  // calibrated threshold line
  {
    const c = activeCalibration();
    if (c && isSdrMode()) {
      ctx.save();
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.strokeStyle = "rgba(248,113,113,0.85)";
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(left, y(c.thresholdDb));
      ctx.lineTo(left + pw, y(c.thresholdDb));
      ctx.stroke();
      ctx.fillStyle = "rgba(248,113,113,0.95)";
      ctx.fillText(`threshold ${c.thresholdDb.toFixed(1)}`, left + 4 * dpr, y(c.thresholdDb) - 3 * dpr);
      ctx.restore();
    }
  }
  if (!frames) return;

  const n = spec.length;
  const xs = (k: number) => left + ((k + 0.5) / n) * pw;
  // peak hold first, so the live trace stays on top
  if (cfg.peakHold && isSdrMode()) {
    ctx.beginPath();
    for (let k = 0; k < n; ++k) (k ? ctx.lineTo : ctx.moveTo).call(ctx, xs(k), y(peak[k]));
    ctx.strokeStyle = "rgba(245,158,11,0.55)";
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();
  }
  // filled trace
  const grad = ctx.createLinearGradient(0, 0, 0, ph);
  grad.addColorStop(0, "rgba(34,211,238,0.35)");
  grad.addColorStop(1, "rgba(59,130,246,0.02)");
  ctx.beginPath();
  ctx.moveTo(left, ph);
  for (let k = 0; k < n; ++k) ctx.lineTo(xs(k), y(spec[k]));
  ctx.lineTo(W, ph);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  for (let k = 0; k < n; ++k) (k ? ctx.lineTo : ctx.moveTo).call(ctx, xs(k), y(spec[k]));
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 1.2 * dpr;
  ctx.stroke();
  // peak marker
  if (lastStats && isSdrMode()) {
    const k = Math.round(((lastStats.peakHz - cfg.freqMHz * 1e6) / cfg.sampleRate) * n + n / 2);
    const px = xs(Math.max(0, Math.min(n - 1, k)));
    const py = y(lastStats.peak);
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(px, py - 2 * dpr);
    ctx.lineTo(px - 5 * dpr, py - 10 * dpr);
    ctx.lineTo(px + 5 * dpr, py - 10 * dpr);
    ctx.fill();
    const label = `${lastStats.peak.toFixed(1)} dB @ ${freqLabel(lastStats.peakHz)}`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(label, Math.min(W - tw - 4, Math.max(left + 2, px - tw / 2)), Math.max(12 * dpr, py - 14 * dpr));
  }
}

// waterfall: turbo-ish colour map
const LUT = (() => {
  const stops = [
    [0.0, [7, 13, 24]],
    [0.2, [30, 58, 138]],
    [0.45, [8, 145, 178]],
    [0.65, [74, 222, 128]],
    [0.82, [250, 204, 21]],
    [1.0, [239, 68, 68]],
  ] as [number, number[]][];
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; ++i) {
    const t = i / 255;
    let j = 0;
    while (j < stops.length - 2 && t > stops[j + 1][0]) ++j;
    const [t0, c0] = stops[j];
    const [t1, c1] = stops[j + 1];
    const u = (t - t0) / (t1 - t0);
    for (let ch = 0; ch < 3; ++ch) lut[i * 4 + ch] = c0[ch] + (c1[ch] - c0[ch]) * u;
    lut[i * 4 + 3] = 255;
  }
  return lut;
})();

let wfRow: ImageData | null = null;
let wfPending = 0;

function pushWaterfall() {
  wfPending++;
}

function drawWaterfall() {
  const c = $<HTMLCanvasElement>("waterfall");
  const ctx = fitCanvas(c);
  const W = c.width;
  const H = c.height;
  if (!frames || wfPending === 0) return;
  const rows = Math.min(wfPending, 4);
  wfPending = 0;
  if (!wfRow || wfRow.width !== W) wfRow = ctx.createImageData(W, 1);
  // Map spectrum bins to pixels (max-pool when there are more bins than pixels).
  const n = spec.length;
  const data = wfRow.data;
  for (let x = 0; x < W; ++x) {
    const k0 = Math.floor((x * n) / W);
    const k1 = Math.max(k0 + 1, Math.floor(((x + 1) * n) / W));
    let v = -Infinity;
    for (let k = k0; k < k1; ++k) v = Math.max(v, spec[k]);
    const t = Math.max(0, Math.min(1, (v - yLo) / (yHi - yLo)));
    const li = Math.round(t * 255) * 4;
    data[x * 4] = LUT[li];
    data[x * 4 + 1] = LUT[li + 1];
    data[x * 4 + 2] = LUT[li + 2];
    data[x * 4 + 3] = 255;
  }
  ctx.drawImage(c, 0, 0, W, H - rows, 0, rows, W, H - rows);
  for (let r = 0; r < rows; ++r) ctx.putImageData(wfRow, 0, r);
}

function drawBand() {
  const c = $<HTMLCanvasElement>("band");
  const ctx = fitCanvas(c);
  const W = c.width;
  const H = c.height;
  ctx.clearRect(0, 0, W, H);
  if (!frames) {
    ctx.fillStyle = "#64748b";
    ctx.font = `${11 * (W / Math.max(1, c.clientWidth))}px system-ui`;
    ctx.fillText("No data", 8, 18);
    return;
  }
  const n = spec.length;
  const [s, e] = bandBins(n, cfg.sampleRate, bwHz());
  const cols = Math.max(1, Math.min(e - s, Math.floor(W / 2)));
  const bw = W / cols;
  for (let i = 0; i < cols; ++i) {
    const k0 = s + Math.floor((i * (e - s)) / cols);
    const k1 = s + Math.floor(((i + 1) * (e - s)) / cols);
    let v = -Infinity;
    for (let k = k0; k < Math.max(k1, k0 + 1); ++k) v = Math.max(v, spec[k]);
    const t = Math.max(0, Math.min(1, (v - yLo) / (yHi - yLo)));
    ctx.fillStyle = `hsl(${200 - t * 150},85%,${42 + t * 22}%)`;
    ctx.fillRect(i * bw, H - t * H, Math.max(1, bw - 0.5), t * H + 1);
  }
}

function drawTimeline() {
  const c = $<HTMLCanvasElement>("timeline");
  const ctx = fitCanvas(c);
  const W = c.width;
  const H = c.height;
  const dpr = W / Math.max(1, c.clientWidth);
  ctx.clearRect(0, 0, W, H);
  if (timeline.length < 2) {
    ctx.fillStyle = "#64748b";
    ctx.font = `${11 * dpr}px system-ui`;
    ctx.fillText("Timeline fills while measuring", 8, 18 * dpr);
    return;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of timeline) {
    lo = Math.min(lo, p.peak, p.band);
    hi = Math.max(hi, p.peak, p.band);
  }
  lo = Math.floor(lo / 5) * 5 - 5;
  hi = Math.ceil(hi / 5) * 5 + 5;
  const left = 34 * dpr;
  const y = (v: number) => H - 4 * dpr - ((v - lo) / (hi - lo)) * (H - 10 * dpr);
  ctx.font = `${10 * dpr}px ui-monospace, monospace`;
  ctx.fillStyle = "#64748b";
  ctx.strokeStyle = "rgba(100,116,139,0.18)";
  for (const v of [lo, (lo + hi) / 2, hi]) {
    const yy = Math.round(y(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(left, yy);
    ctx.lineTo(W, yy);
    ctx.stroke();
    ctx.fillText(v.toFixed(0), 2 * dpr, yy + 3 * dpr);
  }
  const n = timeline.length;
  const x = (i: number) => left + ((i + 240 - n) / 239) * (W - left);
  for (const [key, color] of [["peak", "#60a5fa"], ["band", "#4ade80"]] as const) {
    ctx.beginPath();
    timeline.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p[key])) : ctx.moveTo(x(i), y(p[key]))));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
  }
}

function updateStatsUi() {
  if (!lastStats) return;
  const s = lastStats;
  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "—");
  $("stPeak").textContent = fmt(s.peak);
  $("stBand").textContent = fmt(s.band);
  $("stSpec").textContent = isSdrMode() ? fmt(s.spec) : netInfo?.rtt !== null && netInfo ? `${netInfo.rtt} ms` : "—";
  $("stFrames").textContent = String(frames);
  $("levelNum").textContent = fmt(s.band);
  const pct = Math.max(0, Math.min(100, ((s.band - yLo) / Math.max(1, yHi - yLo)) * 100));
  $("levelFill").style.height = `${isSdrMode() ? pct : netInfo?.quality ?? 0}%`;
  $("roPeak").textContent = isSdrMode() ? `${fmt(s.peak)} dB @ ${freqLabel(s.peakHz)}` : `${fmt(s.peak)} dBm (est.)`;
  $("roDsp").textContent = psd ? `${psd.engine} · ${dspMs.toFixed(2)} ms/frame` : "—";
}

function updateReadout() {
  const units = isSdrMode() ? (cfg.cal !== 0 ? "dBm (cal)" : "dBFS") : "dBm (est.)";
  $("specUnits").textContent = units;
  $("levelUnits").textContent = units;
  if (isSdrMode()) {
    $("roCenter").textContent = freqLabel(cfg.freqMHz * 1e6);
    $("roSpan").textContent = formatRate(cfg.sampleRate).replace("sps", "Hz");
    $("roRbw").textContent = `${((cfg.sampleRate / cfg.fftSize) * 1.5 / 1000).toFixed(2)} kHz`;
    $("stRate").textContent = formatRate(cfg.sampleRate);
  } else {
    for (const id of ["roCenter", "roSpan", "roRbw", "stRate"]) $(id).textContent = "—";
  }
  const bw = bwHz();
  $("bandLbl").textContent = bw ? `${bw / 1000} kHz measurement band` : "centre 50%";
}

function frame() {
  if (dirty) {
    dirty = false;
    updateAutoRange();
    drawSpectrum();
    drawWaterfall();
    drawBand();
    drawTimeline();
    updateStatsUi();
  }
  requestAnimationFrame(frame);
}

// ═══════════════════════════════════════════════════════════════════
//  GPS UI
// ═══════════════════════════════════════════════════════════════════

function renderGps() {
  const st = gps.status;
  const f = st.fix;
  const set = (id: string, v: string) => ($(id).textContent = v);
  set("gpsLat", f ? `${f.lat.toFixed(6)}°` : "—");
  set("gpsLon", f ? `${f.lon.toFixed(6)}°` : "—");
  set("gpsAlt", f?.altM !== undefined ? `${f.altM.toFixed(1)} m` : "—");
  set("gpsSpeed", f?.speedKmh !== undefined ? `${f.speedKmh.toFixed(1)} km/h` : "—");
  set("gpsHeading", f?.headingDeg !== undefined ? formatHeading(f.headingDeg) : "—");
  set(
    "gpsSats",
    f?.satellites !== undefined
      ? `${f.satellites} used${f.satellitesInView ? ` / ${f.satellitesInView} in view` : ""}`
      : st.satellitesInView
        ? `${st.satellitesInView} in view`
        : f?.source === "phone"
          ? "n/a (phone)"
          : "—"
  );
  set("gpsFix", f ? f.fixLabel : st.state === "searching" ? "Searching…" : "No fix");
  set(
    "gpsAcc",
    f?.accuracyM !== undefined
      ? `±${f.accuracyM.toFixed(1)} m${f.hdop !== undefined ? ` (HDOP ${f.hdop.toFixed(2)})` : ""}`
      : "—"
  );
  set("gpsTime", f ? `${new Date(f.timestamp).toLocaleTimeString()}${f.utcTime ? ` (${f.utcTime} UTC)` : ""}` : "—");
  $("gpsNMEA").textContent = f?.nmea ?? (st.source === "phone" && f ? "Geolocation API — no raw NMEA" : "");
  const srcName = st.source === "gmouse" ? "G-MOUSE" : st.source === "phone" ? "Phone" : "GPS";
  const state = st.state === "fix" ? "live" : st.state === "error" ? "err" : st.state === "off" ? "" : "warn";
  let text: string;
  if (st.state === "fix" && f) text = `${srcName} · ${f.lat.toFixed(4)}, ${f.lon.toFixed(4)}`;
  else if (st.state === "off") text = st.message ?? "GPS off — tap to connect";
  else if (st.state === "error") text = `${srcName}: error`;
  else text = `${srcName}: searching…`;
  setChip("dotGps", "txtGps", text, state as any);
  $("gpsBadge").textContent = st.state === "fix" ? "fix ✓" : st.state;
  if (st.message && (st.state === "error" || st.state === "connecting")) {
    $("gpsBadge").title = st.message;
  }
  ($("btnGPS") as HTMLButtonElement).textContent =
    st.state === "fix" || st.state === "searching" ? "Reconnect" : "📡 Connect";
}

let lastGpsMsg = "";
gps.addEventListener("change", () => {
  renderGps();
  onGpsForPins();
  const f = gps.fix;
  if (f && liveMap && gps.status.state === "fix") {
    liveMap.setFix({ lat: f.lat, lon: f.lon, accuracyM: f.accuracyM, speedKmh: f.speedKmh, courseDeg: f.headingDeg, timestamp: f.timestamp });
  }
  const st = gps.status;
  const msg = st.state === "fix" ? `fix ${st.fix?.fixLabel}` : st.message ?? st.state;
  if (msg !== lastGpsMsg) {
    lastGpsMsg = msg;
    if (st.state !== "fix" || !lastGpsMsg.startsWith("fix")) {
      log(`GPS (${st.source}): ${st.state === "fix" && st.fix ? `${formatLatLon(st.fix)} — ${st.fix.fixLabel}` : msg}`, st.state === "error" ? "er" : st.state === "fix" ? "nm" : "wn");
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
//  Compass + map
// ═══════════════════════════════════════════════════════════════════

let liveMap: LiveMap | null = null;

function renderCompass() {
  const st = compass.status;
  const h = st.heading;
  $("gpsCompass").textContent =
    st.state === "on"
      ? `${formatHeading(h)}${st.accuracy !== undefined ? ` (±${Math.round(st.accuracy)}°)` : ""}${st.source === "relative" ? " (relative)" : ""}`
      : st.state === "off"
        ? "Off — tap Compass"
        : st.message ?? st.state;
  const needle = document.getElementById("compassNeedle");
  if (needle) needle.style.transform = `rotate(${st.state === "on" && h !== undefined ? h : 0}deg)`;
  const rose = document.getElementById("compassRose");
  if (rose) rose.classList.toggle("live", st.state === "on");
  const btn = document.getElementById("btnCompass") as HTMLButtonElement | null;
  if (btn) btn.textContent = st.state === "on" || st.state === "starting" ? "🧭 Compass on" : "🧭 Compass";
  liveMap?.setHeading(st.state === "on" && st.source !== "relative" ? h : undefined);
}

compass.addEventListener("change", renderCompass);

function refreshMapPoints() {
  if (!liveMap) return;
  const pts = rows()
    .filter((r) => r.latitude !== "" && r.longitude !== "")
    .map((r) => ({
      lat: Number(r.latitude),
      lon: Number(r.longitude),
      level: Number(r.band_mean_level_db),
      below: r.above_threshold === 0 || r.above_threshold === "0",
      label:
        `${new Date(String(r.timestamp)).toLocaleTimeString()} · ${r.device} · band ${r.band_mean_level_db} · peak ${r.peak_power_db} ${r.units}` +
        (r.threshold_db !== "" && r.threshold_db !== undefined ? ` · ${r.above_threshold === 1 || r.above_threshold === "1" ? "above" : "below"} threshold ${r.threshold_db}` : ""),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.level));
  liveMap.setMeasurements(pts);
}

function initMap() {
  const el = document.getElementById("liveMap");
  if (!el) return;
  try {
    liveMap = new LiveMap(el, {
      onStats: (s) => {
        $("mapDistance").textContent = s.distanceM >= 1000 ? `${(s.distanceM / 1000).toFixed(2)} km` : `${Math.round(s.distanceM)} m`;
        $("mapFollow").textContent = s.following ? "following" : "free";
      },
    });
  } catch (e: any) {
    el.textContent = `Map unavailable: ${e?.message ?? e}`;
    return;
  }
  $("btnMapCentre").addEventListener("click", () => liveMap?.centre());
  $("btnMapFit").addEventListener("click", () => liveMap?.fitAll());
  $("btnMapClear").addEventListener("click", () => {
    liveMap?.clearTrack();
    log("Map track cleared");
  });
  const f = gps.fix;
  if (f) liveMap.setFix({ lat: f.lat, lon: f.lon, accuracyM: f.accuracyM, speedKmh: f.speedKmh, courseDeg: f.headingDeg, timestamp: f.timestamp });
}

async function connectGps() {
  const src = ($("gpsSource") as HTMLSelectElement).value as GpsSource;
  await gps.start(src, { pickPort: true });
}

// ═══════════════════════════════════════════════════════════════════
//  UI wiring
// ═══════════════════════════════════════════════════════════════════

function fillRates(kind: "rtlsdr" | "hackrf") {
  const sel = $<HTMLSelectElement>("rate");
  const rates = sampleRatesFor(kind);
  if (!rates.includes(cfg.sampleRate)) {
    cfg.sampleRate = kind === "hackrf" ? 10_000_000 : 2_048_000;
    saveSettings();
  }
  sel.innerHTML = "";
  for (const r of rates) {
    const o = document.createElement("option");
    o.value = String(r);
    o.textContent = formatRate(r);
    o.selected = r === cfg.sampleRate;
    sel.appendChild(o);
  }
}

function effectiveKind(): "rtlsdr" | "hackrf" {
  return sdr?.kind ?? (cfg.mode === "hackrf" ? "hackrf" : "rtlsdr");
}

function updateSourceUi() {
  const sdrMode = isSdrMode();
  document.querySelectorAll<HTMLElement>(".sdr").forEach((el) => (el.style.display = sdrMode ? "" : "none"));
  $("ampRow").style.display = sdrMode && effectiveKind() === "hackrf" ? "" : "none";
  const hint = $("sourceHint");
  if (!sdrMode) {
    hint.textContent = "Estimates connection quality from the browser's Network Information API — not a radio measurement.";
  } else if (!("usb" in navigator)) {
    hint.textContent = "WebUSB isn't available in this browser. Use Chrome or Edge on a computer or Android phone (iPhone/iPad can't access USB radios).";
  } else if (!sdr) {
    hint.textContent =
      cfg.mode === "hackrf"
        ? "HackRF One/Pro: plug in and press Connect. No driver install needed."
        : "RTL-SDR on Windows needs the WinUSB driver (Zadig). On Android use a USB-OTG adapter.";
  } else {
    hint.textContent = `${sdr.name}${sdr.detail ? ` · ${sdr.detail}` : ""} · ${freqLabel(sdr.minFrequency || 24e6)}–${freqLabel(sdr.maxFrequency)}`;
  }
  updateReadout();
}

function updateButtons() {
  for (const id of ["btnStart", "mBtnStart"]) ($(id) as HTMLButtonElement).disabled = running;
  for (const id of ["btnStop", "mBtnStop"]) ($(id) as HTMLButtonElement).disabled = !running;
  for (const id of ["btnConnect", "mBtnConnect"]) {
    const b = $(id) as HTMLButtonElement;
    b.textContent = device ? "Disconnect" : "Connect";
    b.disabled = running && !device;
  }
  renderRecording();
}

async function requestWakeLock() {
  try {
    wakeLock = await (navigator as any).wakeLock?.request("screen");
  } catch (_) {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  try {
    wakeLock?.release();
  } catch (_) {}
  wakeLock = null;
}

function bind() {
  const sel = $<HTMLSelectElement>("sourceSelect");
  sel.value = cfg.mode;
  sel.addEventListener("change", async () => {
    const wasRunning = running;
    await stop();
    if (device) await disconnect();
    cfg.mode = sel.value as Mode;
    saveSettings();
    provider.forgetDevice();
    if (isSdrMode()) fillRates(effectiveKind());
    updateSourceUi();
    log(`Source changed to: ${sel.selectedOptions[0].text}`);
    if (wasRunning && !isSdrMode()) start();
  });

  const freq = $<HTMLInputElement>("freq");
  freq.value = String(cfg.freqMHz);
  freq.addEventListener("change", () => {
    const v = parseFloat(freq.value);
    if (!Number.isFinite(v) || v <= 0) {
      freq.value = String(cfg.freqMHz);
      return;
    }
    cfg.freqMHz = v;
    saveSettings();
    updateReadout();
    if (device && running) {
      const dev = device;
      ctl(() => applyTuning(dev)).then(
        () => {
          peak.fill(-200);
          log(`Tuned to ${v.toFixed(3)} MHz`, "ok");
        },
        (e) => log(`Tune failed: ${e?.message ?? e}`, "er")
      );
    }
  });

  const rate = $<HTMLSelectElement>("rate");
  rate.addEventListener("change", async () => {
    cfg.sampleRate = Number(rate.value);
    saveSettings();
    updateReadout();
    if (running) {
      await stop();
      await start();
    }
  });

  const fft = $<HTMLSelectElement>("fftSize");
  fft.value = String(cfg.fftSize);
  fft.addEventListener("change", () => {
    cfg.fftSize = Number(fft.value);
    saveSettings();
    resetSpectrum();
    updateReadout();
  });

  const avg = $<HTMLInputElement>("avg");
  avg.value = String(cfg.avg);
  const showAvg = () => ($("avgVal").textContent = `${Math.round(cfg.avg * 100)}%`);
  showAvg();
  avg.addEventListener("input", () => {
    cfg.avg = Number(avg.value);
    showAvg();
    saveSettings();
  });

  const gain = $<HTMLInputElement>("gain");
  const gainAuto = $<HTMLInputElement>("gainAuto");
  gain.value = String(cfg.gain ?? 30);
  gainAuto.checked = cfg.gain === null;
  gain.disabled = gainAuto.checked;
  const showGain = () => ($("gainVal").textContent = cfg.gain === null ? "(auto)" : `${cfg.gain}`);
  showGain();
  const applyGain = () => {
    cfg.gain = gainAuto.checked ? null : Number(gain.value);
    gain.disabled = gainAuto.checked;
    showGain();
    saveSettings();
    if (device) {
      const dev = device;
      ctl(() => dev.setGain(cfg.gain)).catch((e) => log(`Gain: ${e?.message ?? e}`, "er"));
    }
  };
  gain.addEventListener("input", applyGain);
  gainAuto.addEventListener("change", applyGain);

  const cal = $<HTMLInputElement>("cal");
  cal.value = String(cfg.cal);
  cal.addEventListener("change", () => {
    cfg.cal = Number(cal.value) || 0;
    cal.value = String(cfg.cal);
    saveSettings();
    if (spec.length) spec.fill(NaN);
    updateReadout();
  });

  const logEvery = $<HTMLInputElement>("logEvery");
  logEvery.value = String(cfg.logEvery);
  logEvery.addEventListener("change", () => {
    cfg.logEvery = Math.max(0.2, Number(logEvery.value) || 1);
    logEvery.value = String(cfg.logEvery);
    saveSettings();
  });
  const logMode = $<HTMLSelectElement>("logMode");
  const spacing = $<HTMLInputElement>("spacingM");
  const formula = $<HTMLSelectElement>("distFormula");
  const showLogMode = () => {
    const dist = cfg.logMode === "distance";
    spacing.hidden = !dist;
    logEvery.hidden = dist;
    $("distFormulaField").hidden = !dist;
    $("needFixRow").hidden = dist; // pins always need a position
  };
  logMode.value = cfg.logMode;
  spacing.value = String(cfg.spacingM);
  formula.value = cfg.distFormula;
  showLogMode();
  logMode.addEventListener("change", () => {
    cfg.logMode = logMode.value === "time" ? "time" : "distance";
    showLogMode();
    pinHint = "";
    saveSettings();
  });
  spacing.addEventListener("change", () => {
    cfg.spacingM = Math.max(1, Number(spacing.value) || 5);
    spacing.value = String(cfg.spacingM);
    sampler.opts.spacingM = cfg.spacingM;
    saveSettings();
  });
  formula.addEventListener("change", () => {
    cfg.distFormula = formula.value === "euclidean" ? "euclidean" : "haversine";
    sampler.opts.formula = cfg.distFormula;
    saveSettings();
  });
  sampler.opts.spacingM = cfg.spacingM;
  sampler.opts.formula = cfg.distFormula;
  const bw = $<HTMLInputElement>("bwKHz");
  bw.value = cfg.bwKHz ? String(cfg.bwKHz) : "";
  bw.addEventListener("change", () => {
    const v = Number(bw.value);
    cfg.bwKHz = Number.isFinite(v) && v > 0 && v * 1000 < cfg.sampleRate ? v : null;
    bw.value = cfg.bwKHz ? String(cfg.bwKHz) : "";
    saveSettings();
    updateReadout();
  });
  bindCalibration();

  const bindCheck = (id: string, key: "amp" | "dcRemove" | "peakHold" | "biasTee", apply?: () => void) => {
    const el = $<HTMLInputElement>(id);
    el.checked = cfg[key];
    el.addEventListener("change", () => {
      cfg[key] = el.checked;
      saveSettings();
      apply?.();
    });
  };
  bindCheck("amp", "amp", () => {
    const dev = device;
    if (dev instanceof HackRF) ctl(() => dev.setAmpEnabled(cfg.amp)).then(() => log(`HackRF RF amp ${cfg.amp ? "on" : "off"}`, "ok"));
  });
  bindCheck("dcRemove", "dcRemove");
  bindCheck("peakHold", "peakHold", () => peak.fill(-200));
  bindCheck("biasTee", "biasTee", () => {
    const dev = device;
    if (dev) ctl(() => dev.enableBiasTee(cfg.biasTee)).then(() => log(`Antenna power ${cfg.biasTee ? "on" : "off"}`, "wn"));
  });

  const onConnectClick = async () => {
    if (device) await disconnect();
    else await connect();
    updateButtons();
  };
  $("btnConnect").addEventListener("click", onConnectClick);
  $("mBtnConnect").addEventListener("click", onConnectClick);
  $("btnStart").addEventListener("click", () => start());
  $("mBtnStart").addEventListener("click", () => start());
  $("btnStop").addEventListener("click", () => stop());
  $("mBtnStop").addEventListener("click", () => stop());
  $("btnSnap").addEventListener("click", snapshot);
  $("btnCSV").addEventListener("click", () => exportCsv("download"));
  $("btnShare").hidden = !canShareFiles();
  $("btnShare").addEventListener("click", () => exportCsv("share"));
  $("btnOpenMap").addEventListener("click", openInMap);
  $("btnClear").addEventListener("click", newRecording);
  const needFix = $<HTMLInputElement>("needFix");
  needFix.checked = cfg.needFix;
  needFix.addEventListener("change", () => {
    cfg.needFix = needFix.checked;
    saveSettings();
    skippedNoFix = 0;
    renderRecording();
  });
  onRecordingsChanged((m) => {
    // Deleted from the map page in another tab: stop writing to it.
    if (m.type === "deleted" && rec && m.id === rec.id) {
      rec = null;
      positioned = 0;
      savedRows = 0;
      renderRecording();
      refreshMapPoints();
      log("This recording was deleted in the map — the next record starts a new one", "wn");
    }
  });

  const gpsSel = $<HTMLSelectElement>("gpsSource");
  gpsSel.value = gps.savedSource();
  gpsSel.addEventListener("change", () => {
    const v = gpsSel.value as GpsSource;
    if (v === "gmouse") {
      gps.stop();
      renderGps();
      setChip("dotGps", "txtGps", "G-MOUSE — press Connect", "warn");
    } else gps.start(v);
  });
  $("btnGPS").addEventListener("click", connectGps);
  $("chipGps").addEventListener("click", () => {
    if (gps.status.state === "off" || gps.status.state === "error") connectGps();
    else document.getElementById("gpsSource")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const install = $<HTMLButtonElement>("btnInstall");
  const showInstall = () => (install.hidden = !canInstallApp());
  onInstallAvailabilityChange(showInstall);
  showInstall();
  install.addEventListener("click", () => promptInstallApp());

  if ("usb" in navigator) {
    (navigator as any).usb.addEventListener("disconnect", async (e: any) => {
      if (device && e.device && e.device === provider.usbDevice) {
        log("SDR unplugged", "er");
        await stop();
        device = null;
        sdr = undefined;
        provider.forgetDevice();
        setChip("dotSource", "txtSource", "Unplugged", "err");
        updateButtons();
        updateSourceUi();
      }
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && running && !wakeLock) requestWakeLock();
    if (document.visibilityState === "hidden") onPageHidden();
  });
  window.addEventListener("pagehide", onPageHidden);
  new ResizeObserver(() => (dirty = true)).observe(document.body);
  bound = true;
}

// ═══════════════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════════════

export function initMonitor() {
  bind();
  fillRates(effectiveKind());
  resetSpectrum();
  updateSourceUi();
  updateButtons();

  const st = dspStatus();
  setChip("dotDsp", "txtDsp", st.active ? `Rust/WASM${st.simd ? " SIMD" : ""}` : "JS DSP", st.active ? "ok" : "warn");
  log(st.active ? "DSP engine: Rust/WebAssembly (SIMD) FFT" : `DSP engine: JavaScript fallback${st.error ? ` (${st.error})` : ""}`, st.active ? "ok" : "wn");

  // Network monitor runs passively, like before.
  if (getConnection()) {
    readNetworkInfo();
    getConnection().addEventListener?.("change", readNetworkInfo);
    setInterval(() => {
      if (!running || isSdrMode()) readNetworkInfo();
    }, 2000);
    log("Network Info API active", "nm");
  } else {
    readNetworkInfo();
    log("Network Info API not available (Firefox/Safari)", "wn");
  }

  initMap();
  $("btnCompass").addEventListener("click", () => {
    const st = compass.status.state;
    if (st === "on" || st === "starting") compass.stop();
    else compass.start();
  });
  // Android starts the compass straight away; iOS needs a tap on the Compass button.
  renderCompass();
  if (isMobileDevice() && compass.wasEnabled() && !compass.needsPermissionTap()) compass.start();

  // GPS: phone GPS starts automatically on mobile; on desktop a granted G-MOUSE reconnects.
  renderGps();
  if (gps.hasSavedChoice()) {
    gps.resume();
  } else if (isMobileDevice()) {
    ($("gpsSource") as HTMLSelectElement).value = "phone";
    gps.start("phone");
    log("Mobile device — phone GPS active", "ok");
  } else {
    ($("gpsSource") as HTMLSelectElement).value = hasWebSerial() ? "gmouse" : "phone";
    setChip("dotGps", "txtGps", hasWebSerial() ? "G-MOUSE — press Connect" : "GPS — press Connect", "warn");
    log(hasWebSerial() ? "Desktop — press 📡 Connect to open the G-MOUSE USB port" : "Press 📡 Connect to use this device's location", "wn");
  }

  restoreRecording();
  requestAnimationFrame(frame);
  dirty = true;
}
