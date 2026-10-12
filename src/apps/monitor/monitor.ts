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
import { shared } from "./listen.js";
import { analyser, CMAP_NAMES, type Src } from "./analyser.js";
import * as sess from "./sessions.js";
import { owrx, normaliseUrl, type Label } from "./owrx.js";
import { uber, looksLikeUber } from "./ubersdr.js";
import { kiwi } from "./kiwi.js";
type RemoteClient = typeof owrx | typeof uber | typeof kiwi;
type RemoteKind = "openwebrx" | "ubersdr" | "kiwisdr";
let remote: RemoteClient = owrx;
import { dt, formatBearing, norm } from "./dt.js";
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
  analyser.clearHolds();
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

const FE_KEY = "webrx.frontend.v1";
let fe: { upconvHz: number; ppm: number } = { upconvHz: 0, ppm: 0 };
try {
  fe = { ...fe, ...JSON.parse(localStorage.getItem(FE_KEY) || "{}") };
} catch (_) {}
function saveFe() {
  try {
    localStorage.setItem(FE_KEY, JSON.stringify(fe));
  } catch (_) {}
}

async function applyTuning(dev: RtlDevice) {
  // cfg.freqMHz is the RF frequency being measured (what the CSV records);
  // with an upconverter the tuner sits at RF + LO.
  const hz = Math.round(cfg.freqMHz * 1e6 + fe.upconvHz);
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
  shared.setSampleRate(cfg.sampleRate);
  if (fe.ppm) await ctl(() => dev.setFrequencyCorrection(fe.ppm)).catch(() => log("This device ignored the PPM correction", "wn"));
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
    const bytes = new Uint8Array(block.data);
    processBlock(bytes);
    // Same block, same connection: audio and any other receivers.
    try {
      shared.feed(bytes, block.frequency ? block.frequency - fe.upconvHz : cfg.freqMHz * 1e6);
    } catch (e: any) {
      if (!listenErr) log(`Audio: ${e?.message ?? e}`, "er");
      listenErr = true;
    }
  }
}
let listenErr = false;

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
  if (isSdrMode()) dt.push(levelAt(dtFreqHz(), dt.st.bwHz), gps.fix?.headingDeg);
  analyser.ingest(spec);
  if (recorder.active) recorder.offer(captureFrame);
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

/** Mean power (dB, linear average) of the averaged spectrum in [f - bw/2, f + bw/2]. */
function levelAt(freqHz: number, bw: number): number {
  const n = spec.length;
  if (!n) return NaN;
  const lo = cfg.freqMHz * 1e6 - cfg.sampleRate / 2;
  const k0 = Math.max(0, Math.floor(((freqHz - bw / 2 - lo) / cfg.sampleRate) * n));
  const k1 = Math.min(n - 1, Math.ceil(((freqHz + bw / 2 - lo) / cfg.sampleRate) * n));
  let sum = 0, cnt = 0;
  for (let k = k0; k <= k1; ++k) {
    const v = spec[k];
    if (Number.isFinite(v)) { sum += Math.pow(10, v / 10); ++cnt; }
  }
  return cnt ? 10 * Math.log10(sum / cnt) : NaN;
}

function tunedHz(): number {
  if (remote.connected && !pb) return remote.tunedHz;
  return cfg.freqMHz * 1e6 + shared.cfg.offsetHz;
}

function dtFreqHz(): number {
  return dt.st.freqHz ?? tunedHz();
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
    `${new Date().toLocaleString()} · ${(srcCentre() / 1e6).toFixed(3)} MHz · span ${formatRate(srcRate())} · ${sdr?.name ?? cfg.mode}` +
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
  analyser.ingest(spec);
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
  const [s, e] = bandBins(n, srcRate(), bwHz());
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
  if (remote.connected && !pb) {
    $("specUnits").textContent = "dB (server)";
    $("levelUnits").textContent = "dB (server)";
    $("roCenter").textContent = freqLabel(remote.centreHz);
    $("roSpan").textContent = hzShort(remote.rateHz);
    $("roRbw").textContent = hzShort(((remote.rateHz / Math.max(1, remote.fftSize || spec.length)) * 1.5));
    $("stRate").textContent = formatRate(remote.rateHz);
    return;
  }
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
    renderDt();
    const sc = src();
    analyser.updateRange(sc);
    yLo = analyser.yLo;
    yHi = analyser.yHi;
    analyser.drawSpectrum($<HTMLCanvasElement>("spectrum"), sc);
    analyser.drawWaterfall($<HTMLCanvasElement>("waterfall"), sc);
    drawBand();
    drawTimeline();
    updateStatsUi();
    renderStatusSoon();
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
    st.state === "fix" || st.state === "searching" ? "Reconnect GPS" : "Connect GPS";
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
  if (btn) btn.textContent = st.state === "on" || st.state === "starting" ? "Compass on" : "Compass";
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
  for (const id of ["btnStart", "mBtnStart"]) { const b = $(id) as HTMLButtonElement | null; if (b) b.disabled = running; }
  for (const id of ["btnStop", "mBtnStop"]) { const b = $(id) as HTMLButtonElement | null; if (b) b.disabled = !running; }
  for (const id of ["btnConnect", "mBtnConnect"]) {
    const b = $(id) as HTMLButtonElement | null;
    if (!b) continue;
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
  $("mBtnConnect")?.addEventListener("click", onConnectClick);
  $("btnStart").addEventListener("click", () => start());
  $("mBtnStart")?.addEventListener("click", () => start());
  $("btnStop").addEventListener("click", () => stop());
  bindSa();
  bindSessions();
  bindStatus();
  bindRemote();
  bindScopeInteractions();
  bindVfo();
  $("mBtnStop")?.addEventListener("click", () => stop());
  bindListen();
  bindDt();
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
    else {
      (window as any).webrxShowTab?.("map");
      requestAnimationFrame(() => document.getElementById("gpsSource")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
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
  // The page is split into tabs: redraw canvases at their real size when a tab is shown.
  window.addEventListener("webrx:tab", () => {
    dirty = true;
    liveMap?.invalidate();
  });
  bound = true;
}

// ═══════════════════════════════════════════════════════════════════
//  SA — listening on the shared stream
// ═══════════════════════════════════════════════════════════════════

function renderListen() {
  const c = shared.cfg;
  const btn = document.getElementById("btnAudio") as HTMLButtonElement | null;
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(shared.audioOn));
  btn.textContent = shared.audioOn ? "Audio on" : "Audio off";
  btn.classList.toggle("primary", shared.audioOn);
  const info = shared.modeInfo();
  ($("bwField") as HTMLElement).hidden = !info.hasBandwidth;
  ($("stereoField") as HTMLElement).hidden = !info.hasStereo;
  ($("squelchField") as HTMLElement).hidden = !info.hasSquelch;
  const bw = $<HTMLInputElement>("demodBw");
  if (document.activeElement !== bw) bw.value = String(Math.round((c.bandwidth ?? info.defaultBandwidth ?? 0) / 100) / 10);
  $("squelchVal").textContent = c.squelch ? c.squelch.toFixed(1) : "off";
  const t = $<HTMLInputElement>("tuneFreq");
  if (document.activeElement !== t) t.value = (tunedHz() / 1e6).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  $("stereoInd").textContent = shared.audioOn && info.hasStereo && c.stereo ? (shared.stereoStatus ? "stereo ●" : "mono") : "";
  $("tunedRo").textContent = freqLabel(tunedHz());
  dirty = true;
}

/** Tune the listening frequency; re-centre the SDR when it falls outside the span. */
function tuneTo(hz: number) {
  if (!Number.isFinite(hz) || hz <= 0) return;
  const centre = cfg.freqMHz * 1e6;
  const edge = cfg.sampleRate * 0.45;
  if (Math.abs(hz - centre) <= edge) {
    shared.set({ offsetHz: Math.round(hz - centre) });
  } else {
    shared.set({ offsetHz: 0 });
    const f = $<HTMLInputElement>("freq");
    f.value = String(+(hz / 1e6).toFixed(6));
    f.dispatchEvent(new Event("change"));
  }
  renderListen();
}

function bindListen() {
  const mode = document.getElementById("demodMode") as HTMLSelectElement | null;
  if (!mode) return;
  for (const s of shared.schemes()) mode.add(new Option(s, s));
  mode.value = shared.cfg.scheme;
  mode.addEventListener("change", () => shared.set({ scheme: mode.value, bandwidth: null }));
  $("btnAudio").addEventListener("click", () => {
    shared.setAudio(!shared.audioOn);
    log(shared.audioOn ? `Audio on — ${shared.cfg.scheme} at ${freqLabel(tunedHz())}` : "Audio off");
    if (shared.audioOn && !running) log("Press Start to hear the receiver (the same stream feeds the measurements)", "wn");
  });
  const vol = $<HTMLInputElement>("vol");
  vol.value = String(shared.cfg.volume);
  vol.addEventListener("input", () => shared.set({ volume: Number(vol.value) }));
  const bw = $<HTMLInputElement>("demodBw");
  bw.addEventListener("change", () => {
    const v = parseFloat(bw.value);
    shared.set({ bandwidth: Number.isFinite(v) && v > 0 ? v * 1000 : null });
  });
  const st = $<HTMLInputElement>("stereoChk");
  st.checked = shared.cfg.stereo;
  st.addEventListener("change", () => shared.set({ stereo: st.checked }));
  const sq = $<HTMLInputElement>("squelch");
  sq.value = String(shared.cfg.squelch);
  sq.addEventListener("input", () => shared.set({ squelch: Number(sq.value) }));
  const t = $<HTMLInputElement>("tuneFreq");
  t.addEventListener("change", () => tuneTo(parseFloat(t.value) * 1e6));
  $("btnTuneCentre").addEventListener("click", () => tuneTo(cfg.freqMHz * 1e6));
  document.querySelectorAll<HTMLButtonElement>("[data-tune-step]").forEach((b) =>
    b.addEventListener("click", () => tuneTo(tunedHz() + Number(b.dataset.tuneStep) * 1000))
  );
  $("freq").addEventListener("change", () => setTimeout(renderListen, 0));
  shared.onChange = renderListen;
  renderListen();
}

// ═══════════════════════════════════════════════════════════════════
//  DT — directional tracking (polar max-hold per bearing)
// ═══════════════════════════════════════════════════════════════════

function renderDt() {
  const pane = document.getElementById("pane-dt");
  if (!pane || pane.hidden) return;
  const units = cfg.cal ? "dBm" : "dBFS";
  dt.draw($<HTMLCanvasElement>("dtCanvas"), units);
  $("dtHeading").textContent = dt.heading !== undefined ? formatBearing(dt.heading) : "—";
  $("dtLevel").textContent = dt.level !== undefined ? `${dt.level.toFixed(1)} ${units}` : "—";
  const b = dt.best();
  $("dtBest").textContent = b ? formatBearing(b.bearing) : "—";
  $("dtCoverage").textContent = `${dt.coverage()}° / 360°`;
  $("dtFixCount").textContent = String(dt.st.fixes.length);
  $("dtGuide").textContent = running ? dt.guidance() : "Press Start, then turn slowly through a full circle.";
  $("dtTarget").textContent = `${freqLabel(dtFreqHz())} · ${dt.st.bwHz / 1000} kHz`;
}

function renderDtFixes() {
  liveMap?.setBearings(dt.st.fixes.map((f, i) => ({ lat: f.lat, lon: f.lon, bearing: f.bearing, label: `Fix ${i + 1}: ${formatBearing(f.bearing)} · ${f.level.toFixed(1)} dB · ${freqLabel(f.freqHz)}` })));
}

function bindDt() {
  if (!document.getElementById("dtCanvas")) return;
  const fq = $<HTMLInputElement>("dtFreq");
  fq.value = dt.st.freqHz ? String(dt.st.freqHz / 1e6) : "";
  fq.addEventListener("change", () => {
    const v = parseFloat(fq.value);
    dt.st.freqHz = Number.isFinite(v) && v > 0 ? v * 1e6 : null;
    if (dt.st.freqHz && Math.abs(dt.st.freqHz - cfg.freqMHz * 1e6) > cfg.sampleRate * 0.45) log("DT target is outside the current span — tune the centre closer", "wn");
    dt.reset();
    dt.save(true);
    dirty = true;
  });
  const bw = $<HTMLInputElement>("dtBw");
  bw.value = String(dt.st.bwHz / 1000);
  bw.addEventListener("change", () => {
    const v = parseFloat(bw.value);
    if (Number.isFinite(v) && v > 0) dt.st.bwHz = v * 1000;
    dt.reset();
    dirty = true;
  });
  const src = $<HTMLSelectElement>("dtSource");
  const man = $<HTMLInputElement>("dtManual");
  const showMan = () => ($("dtManualField").hidden = dt.st.source !== "manual");
  src.value = dt.st.source;
  src.addEventListener("change", () => {
    dt.st.source = src.value as any;
    dt.save(true);
    showMan();
    if (dt.st.source === "compass" && compass.status.state !== "on") $("btnCompass").click();
  });
  man.value = String(dt.st.manual);
  man.addEventListener("input", () => {
    dt.st.manual = Number(man.value);
    $("dtManualVal").textContent = `${man.value}°`;
    dirty = true;
  });
  $("dtManualVal").textContent = `${man.value}°`;
  const off = $<HTMLInputElement>("dtOffset");
  off.value = String(dt.st.northOffset);
  off.addEventListener("change", () => {
    const v = parseFloat(off.value);
    dt.st.northOffset = Number.isFinite(v) ? v : 0;
    dt.save(true);
  });
  showMan();
  $("btnDtReset").addEventListener("click", () => {
    dt.reset();
    log("DT polar plot cleared");
    dirty = true;
  });
  $("btnDtFix").addEventListener("click", () => {
    const f = gps.fix;
    if (!f) return log("Save fix needs a GPS position (MT tab → Connect GPS)", "wn");
    const fix = dt.addFix(f.lat, f.lon, dtFreqHz());
    if (!fix) return log("No bearing measured yet — press Start and turn through a circle", "wn");
    log(`DT fix ${dt.st.fixes.length}: ${formatBearing(fix.bearing)} at ${f.lat.toFixed(5)}, ${f.lon.toFixed(5)}`, "ok");
    renderDtFixes();
    dt.reset();
    dirty = true;
  });
  $("btnDtClearFixes").addEventListener("click", () => {
    dt.clearFixes();
    renderDtFixes();
    dirty = true;
  });
  $("btnDtCompass").addEventListener("click", () => $("btnCompass").click());
  setTimeout(renderDtFixes, 500);
  window.addEventListener("webrx:tab", () => (dirty = true));
  setInterval(() => {
    // keep the needle moving when the stream is stopped
    if (!running) {
      dt.heading = dt.readHeading(gps.fix?.headingDeg);
      dirty = true;
    }
  }, 250);
}

// ═══════════════════════════════════════════════════════════════════
//  SA display source (live or playback), analyser controls
// ═══════════════════════════════════════════════════════════════════

/** Playback state: when set, displays show the recorded frame instead of the live stream. */
let pb: { centreHz: number; rateHz: number; stash: (number | null)[]; hdg?: number; cur?: [number, number]; route?: () => void } | null = null;

let fpsCount = 0, fpsAt = performance.now(), fps = 0;
function srcStats(): string[] {
  if (!analyser.cfg.stats) return [];
  const now = performance.now();
  if (now - fpsAt > 1000) {
    fps = (frames - fpsCount) / ((now - fpsAt) / 1000);
    fpsCount = frames;
    fpsAt = now;
  }
  const n = spec.length || cfg.fftSize;
  const out = [`FEED ${fps.toFixed(1)}/s`, `FFT  ${n} bins · ${hzShort(srcRate() / n)}`, `VIEW ${hzShort(srcRate() / analyser.cfg.zoom)} (×${+analyser.cfg.zoom.toFixed(2)})`];
  if (remote.connected && !pb) out.push(`NET  ${(remote.bytes / 1e6).toFixed(1)} MB · ${remote.label}`);
  else if (dspMs) out.push(`DSP  ${dspMs.toFixed(2)} ms/frame`);
  return out;
}

function srcCentre() {
  return pb ? pb.centreHz : remote.connected ? remote.centreHz : cfg.freqMHz * 1e6;
}
function srcRate() {
  return pb ? pb.rateHz : remote.connected ? remote.rateHz : cfg.sampleRate;
}

function src(): Src {
  const n = spec.length || cfg.fftSize;
  const sdrish = isSdrMode() || !!pb || remote.connected;
  return {
    sdr: sdrish,
    centreHz: srcCentre(),
    rateHz: srcRate(),
    spec,
    raw,
    cal: pb || remote.connected ? 0 : cfg.cal,
    peak,
    peakHold: cfg.peakHold,
    frames,
    band: bandBins(n, srcRate(), bwHz()),
    tunedHz: tunedHz(),
    audioOn: remote.connected ? remote.audioOn : shared.audioOn,
    dtLo: dtFreqHz() - dt.st.bwHz / 2,
    dtHi: dtFreqHz() + dt.st.bwHz / 2,
    thresholdDb: activeCalibration()?.thresholdDb ?? null,
    peakStat: lastStats && Number.isFinite(lastStats.peak) ? { peak: lastStats.peak, peakHz: lastStats.peakHz } : null,
    pbLo: passband()?.[0] ?? null,
    pbHi: passband()?.[1] ?? null,
    labels: labelsNow(),
    stats: srcStats(),
    units: remote.connected && !pb ? (remote.kind === "kiwisdr" ? "dB" : "dB") : cfg.cal ? "dBm" : "dBFS",
  };
}

const fmtDb = (v: number | undefined | null) => (v === undefined || v === null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)}`);
const hzShort = (hz: number) => (hz >= 1e6 ? `${+(hz / 1e6).toFixed(3)} MHz` : hz >= 1e3 ? `${+(hz / 1e3).toFixed(2)} kHz` : `${Math.round(hz)} Hz`);
const setText = (id: string, t: string) => {
  const el = document.getElementById(id);
  if (el && el.textContent !== t) el.textContent = t;
};
const setVal = (id: string, v: string) => {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el && document.activeElement !== el && el.value !== v) el.value = v;
};

function renderSa() {
  if (!document.getElementById("saZoom")) return;
  const s = src();
  const c = analyser.cfg;
  const [f0, f1] = analyser.viewHz(s);
  setVal("saCentre", String(+(((f0 + f1) / 2) / 1e6).toFixed(6)));
  setVal("saStart", String(+(f0 / 1e6).toFixed(6)));
  setVal("saStop", String(+(f1 / 1e6).toFixed(6)));
  setText("saSpanRo", hzShort(f1 - f0));
  setVal("saZoom", String(c.zoom));
  setVal("saPan", String(Math.round(c.pan * 1000)));
  setText("saRbw", hzShort((srcRate() / Math.max(1, spec.length || cfg.fftSize)) * 1.5));
  ($("saAuto") as HTMLInputElement).checked = c.autoRange;
  ($("saRef") as HTMLInputElement).disabled = c.autoRange;
  ($("saRange") as HTMLSelectElement).disabled = c.autoRange;
  setVal("saRef", String(Math.round(c.autoRange ? analyser.yHi : c.ref)));
  setVal("saRange", String(c.range));
  setVal("saCmap", c.cmap);
  ($("saLegend") as HTMLElement).style.background = analyser.gradientCss();
  setVal("saTrace", c.trace);
  ($("saMax") as HTMLInputElement).checked = c.showMax;
  ($("saMin") as HTMLInputElement).checked = c.showMin;
  setVal("saWf", String(c.wfSpeed));
  setVal("saTap", c.tap);
  setVal("saChBw", String(c.chBwHz / 1000));
  const fz = $("btnSaFreeze");
  fz.setAttribute("aria-pressed", String(analyser.frozen));
  fz.textContent = analyser.frozen ? "Resume display" : "Freeze display";
  const lv = (hz: number | null) => (hz === null ? "—" : `${freqLabel(hz)} · ${fmtDb(analyser.levelAtHz(s, hz))} dB`);
  setText("saM1", lv(c.m1Hz));
  setText("saM2", lv(c.m2Hz));
  if (c.m1Hz !== null && c.m2Hz !== null) {
    const d = analyser.levelAtHz(s, c.m2Hz) - analyser.levelAtHz(s, c.m1Hz);
    setText("saDelta", `Δ ${hzShort(Math.abs(c.m2Hz - c.m1Hz))} · ${d >= 0 ? "+" : ""}${fmtDb(d)} dB`);
  } else setText("saDelta", "—");
  const m = analyser.metrics(s);
  setText("saFloor", m ? `${fmtDb(m.floor)} dB` : "—");
  setText("saChPow", m ? `${fmtDb(m.chPower)} dB @ ${freqLabel(m.chCentre)}` : "—");
  setText("saObw", m ? hzShort(m.obw) : "—");
  setVal("feUpconv", String(fe.upconvHz / 1e6));
  setVal("fePpm", String(fe.ppm));
  setVal("feDeemph", String(shared.cfg.deemph));
}

function bindSa() {
  if (!document.getElementById("saZoom")) return;
  const cm = $<HTMLSelectElement>("saCmap");
  for (const n of CMAP_NAMES) cm.add(new Option(n[0].toUpperCase() + n.slice(1), n));
  const num = (id: string) => parseFloat(($(id) as HTMLInputElement).value);
  const apply = (p: Parameters<typeof analyser.set>[0]) => {
    analyser.set(p);
    renderSa();
    dirty = true;
  };
  const retuneCentre = (mhz: number) => {
    if (pb || !Number.isFinite(mhz) || mhz <= 0) return;
    const f = $<HTMLInputElement>("freq");
    f.value = String(+mhz.toFixed(6));
    f.dispatchEvent(new Event("change"));
  };
  // Centre / span / start / stop. The span you can see is the sample rate ÷ zoom.
  $("saCentre").addEventListener("change", () => {
    const want = num("saCentre") * 1e6;
    const s = src();
    const half = s.rateHz / 2;
    if (Math.abs(want - s.centreHz) <= half - s.rateHz / (2 * analyser.cfg.zoom)) apply({ pan: 0.5 + (want - s.centreHz) / s.rateHz });
    else {
      apply({ pan: 0.5 });
      retuneCentre(want / 1e6);
    }
  });
  const startStop = () => {
    const a = num("saStart") * 1e6, b = num("saStop") * 1e6;
    if (!(b > a)) return renderSa();
    const span = b - a, mid = (a + b) / 2, rate = srcRate();
    if (span > rate) log(`Requested span ${hzShort(span)} is wider than the sample rate (${hzShort(rate)}); showing the full span`, "wn");
    const zoom = Math.max(1, Math.min(64, rate / span));
    if (Math.abs(mid - srcCentre()) + span / 2 > rate / 2) {
      retuneCentre(mid / 1e6);
      apply({ zoom, pan: 0.5 });
    } else apply({ zoom, pan: 0.5 + (mid - srcCentre()) / rate });
  };
  $("saStart").addEventListener("change", startStop);
  $("saStop").addEventListener("change", startStop);
  $("saZoom").addEventListener("change", () => apply({ zoom: Number(($("saZoom") as HTMLSelectElement).value) }));
  $("btnSaZoomIn").addEventListener("click", () => apply({ zoom: analyser.cfg.zoom * 2 }));
  $("btnSaZoomOut").addEventListener("click", () => apply({ zoom: analyser.cfg.zoom / 2 }));
  $("btnSaZoomM1").addEventListener("click", () => {
    const hz = analyser.cfg.m1Hz ?? tunedHz();
    apply({ pan: 0.5 + (hz - srcCentre()) / srcRate(), zoom: Math.max(4, analyser.cfg.zoom) });
  });
  $("saPan").addEventListener("input", () => apply({ pan: num("saPan") / 1000 }));
  // amplitude
  $("saAuto").addEventListener("change", () => apply({ autoRange: ($("saAuto") as HTMLInputElement).checked, ref: Math.round(analyser.yHi), range: analyser.cfg.range }));
  $("saRef").addEventListener("change", () => Number.isFinite(num("saRef")) && apply({ ref: num("saRef") }));
  $("saRange").addEventListener("change", () => apply({ range: num("saRange") }));
  // FFT / averaging / peak hold delegate to the existing (measurement) settings, so they stay one source of truth.
  const mirror = (saId: string, id: string, ev = "change") => {
    const a = $(saId) as HTMLInputElement, b = $(id) as HTMLInputElement;
    const sync = () => {
      if (a.type === "checkbox") a.checked = b.checked;
      else a.value = b.value;
    };
    sync();
    a.addEventListener(ev, () => {
      if (a.type === "checkbox") b.checked = a.checked;
      else b.value = a.value;
      b.dispatchEvent(new Event(ev));
      setTimeout(renderSa, 0);
    });
    b.addEventListener(ev, sync);
  };
  mirror("saFft", "fftSize");
  mirror("saAvg", "avg", "input");
  mirror("saPeak", "peakHold");
  // display
  cm.addEventListener("change", () => apply({ cmap: cm.value }));
  $("saTrace").addEventListener("change", () => apply({ trace: ($("saTrace") as HTMLSelectElement).value as any }));
  $("saMax").addEventListener("change", () => apply({ showMax: ($("saMax") as HTMLInputElement).checked }));
  $("saMin").addEventListener("change", () => apply({ showMin: ($("saMin") as HTMLInputElement).checked }));
  $("btnSaClear").addEventListener("click", () => {
    analyser.clearHolds();
    peak.fill(-200);
    dirty = true;
  });
  $("saWf").addEventListener("change", () => apply({ wfSpeed: num("saWf") }));
  $("btnSaFreeze").addEventListener("click", () => {
    analyser.setFrozen(!analyser.frozen, src());
    renderSa();
    dirty = true;
  });
  $("btnSaSnap").addEventListener("click", snapshot);
  // UberSDR-style display options
  const chk = (id: string, key: "labels" | "stats" | "snap") => {
    const el = $<HTMLInputElement>(id);
    el.checked = analyser.cfg[key];
    el.addEventListener("change", () => apply({ [key]: el.checked } as any));
  };
  chk("saLabels", "labels");
  chk("saStats", "stats");
  chk("saSnap", "snap");
  const sel = (id: string, key: "fill" | "smooth") => {
    const el = $<HTMLSelectElement>(id);
    el.value = String(analyser.cfg[key]);
    el.addEventListener("change", () => apply({ [key]: key === "smooth" ? Number(el.value) : el.value } as any));
  };
  sel("saFill", "fill");
  sel("saSmooth", "smooth");
  const rng = (id: string, key: "wfFloor" | "wfContrast", out: string, fmt: (v: number) => string) => {
    const el = $<HTMLInputElement>(id);
    el.value = String(analyser.cfg[key]);
    setText(out, fmt(analyser.cfg[key]));
    el.addEventListener("input", () => {
      apply({ [key]: Number(el.value) } as any);
      setText(out, fmt(Number(el.value)));
    });
  };
  rng("saWfFloor", "wfFloor", "saWfFloorVal", (v) => `${v > 0 ? "+" : ""}${v} dB`);
  rng("saWfContrast", "wfContrast", "saWfContrastVal", (v) => `×${v.toFixed(2)}`);
  // markers
  $("saTap").addEventListener("change", () => apply({ tap: ($("saTap") as HTMLSelectElement).value as any }));
  $("btnM1Peak").addEventListener("click", () => apply({ m1Hz: analyser.findPeak(src()) }));
  $("btnM1Next").addEventListener("click", () => {
    const s = src();
    const cur = analyser.cfg.m1Hz === null ? undefined : analyser.levelAtHz(s, analyser.cfg.m1Hz);
    const hz = analyser.findPeak(s, cur);
    if (hz === null) log("No lower peak in view", "wn");
    else apply({ m1Hz: hz });
  });
  $("btnM2Delta").addEventListener("click", () => {
    const s = src();
    const m1 = analyser.cfg.m1Hz ?? analyser.findPeak(s);
    if (m1 === null) return;
    const m2 = analyser.findPeak(s, analyser.levelAtHz(s, m1));
    apply({ m1Hz: m1, m2Hz: analyser.cfg.m2Hz === null ? m2 ?? m1 : null });
  });
  $("btnMTune").addEventListener("click", () => analyser.cfg.m1Hz !== null && !pb && tuneTo(analyser.cfg.m1Hz));
  $("btnMClear").addEventListener("click", () => apply({ m1Hz: null, m2Hz: null }));
  $("saChBw").addEventListener("change", () => num("saChBw") > 0 && apply({ chBwHz: num("saChBw") * 1000 }));
  // front end
  $("feUpconv").addEventListener("change", () => {
    const v = num("feUpconv");
    fe.upconvHz = Number.isFinite(v) ? Math.round(v * 1e6) : 0;
    saveFe();
    log(fe.upconvHz ? `Upconverter LO ${hzShort(fe.upconvHz)}: the tuner sits at RF + LO` : "Upconverter off");
    if (device && running) ctl(() => applyTuning(device!)).catch(() => {});
  });
  $("fePpm").addEventListener("change", () => {
    const v = num("fePpm");
    fe.ppm = Number.isFinite(v) ? Math.round(v) : 0;
    saveFe();
    if (device) ctl(() => device!.setFrequencyCorrection(fe.ppm)).catch(() => log("This device ignored the PPM correction", "wn"));
  });
  $("feDeemph").addEventListener("change", () => shared.set({ deemph: num("feDeemph") }));
  // wheel zoom on desktop
  setInterval(() => document.getElementById("pane-sa")?.hidden === false && renderSa(), 500);
  renderSa();
}

// ═══════════════════════════════════════════════════════════════════
//  Sessions: record spectrum + GPS + heading, list, export, playback
// ═══════════════════════════════════════════════════════════════════

const recorder = new sess.SessionRecorder();
const player = new sess.Player();
const LIM_KEY = "webrx.sessions.limits";
try {
  recorder.limits = { ...recorder.limits, ...JSON.parse(localStorage.getItem(LIM_KEY) || "{}") };
} catch (_) {}

function captureFrame(): sess.Frame {
  const q = sess.quantise(spec);
  const f = gps.fix;
  return {
    t: Date.now(),
    c: srcCentre(),
    r: srcRate(),
    b: q.b,
    s: q.s,
    lat: f?.lat,
    lon: f?.lon,
    acc: f?.accuracyM,
    spd: f?.speedKmh,
    crs: f?.headingDeg,
    hdg: dt.heading ?? (compass.status.state === "on" ? compass.status.heading : undefined),
    peak: lastStats?.peak,
    peakHz: lastStats?.peakHz,
    band: lastStats?.band,
    spec: lastStats?.spec,
    dt: dt.level,
  };
}

const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
};
const fmtMB = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} kB`);

async function toggleRecord() {
  if (recorder.active) {
    const m = await recorder.stop();
    if (m) log(`Session “${m.name}” saved — ${m.frames} frames, ${fmtDur(m.endedAt - m.startedAt)}, ${fmtMB(m.bytes)}`, "ok");
    renderSessions();
    return;
  }
  if (pb) stopPlayback();
  const d = new Date();
  if (remote.connected) {
    recorder.start(`${remote.name || "OpenWebRX"} · ${freqLabel(remote.centreHz)} · ${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}`, `OpenWebRX ${remote.url.page}`, "dB (server)", remote.centreHz, remote.rateHz);
    log("Recording the remote OpenWebRX stream (spectrum + levels; GPS/heading are this device's)", "ok");
    return;
  }
  if (!isSdrMode()) return log("Session recording needs an SDR source (spectrum frames)", "wn");
  if (!running) await start();
  if (!running) return;
  recorder.start(`${freqLabel(cfg.freqMHz * 1e6)} · ${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}`, sdr?.name ?? cfg.mode, cfg.cal ? "dBm" : "dBFS", cfg.freqMHz * 1e6, cfg.sampleRate);
  log(`Recording session (spectrum ${recorder.limits.fps}/s, GPS, heading, levels) — limit ${recorder.limits.maxMB} MB / ${recorder.limits.maxMinutes} min`, "ok");
}

function renderRecButton() {
  const b = document.getElementById("btnRec");
  if (!b) return;
  const on = recorder.active;
  b.setAttribute("aria-pressed", String(on));
  b.classList.toggle("on", on);
  b.setAttribute("aria-label", on ? "Stop recording session" : "Record session");
  b.title = on ? "Stop recording session" : "Record session (spectrum, GPS, heading, levels)";
  const m = recorder.meta;
  setText("recTimer", on && m ? `${fmtDur(m.endedAt - m.startedAt)} · ${fmtMB(m.bytes)}` : "Rec");
}

async function renderSessions() {
  const box = document.getElementById("sessList");
  if (!box) return;
  let list: sess.SessionMeta[] = [];
  try {
    list = await sess.listSessions();
  } catch (e: any) {
    box.textContent = `Sessions unavailable: ${e?.message ?? e}`;
    return;
  }
  const total = list.reduce((a, m) => a + m.bytes, 0);
  setText("sessUsage", list.length ? `${list.length} session${list.length > 1 ? "s" : ""} · ${fmtMB(total)}` : "No sessions yet");
  box.innerHTML = "";
  for (const m of list) {
    const row = document.createElement("div");
    row.className = "sessrow";
    row.dataset.id = m.id;
    const live = recorder.meta?.id === m.id;
    row.innerHTML = `<div class="sessinfo"><input class="sessname" aria-label="Session name" value="${m.name.replace(/"/g, "&quot;")}" ${live ? "disabled" : ""}/>
      <small>${new Date(m.startedAt).toLocaleString()} · ${fmtDur(m.endedAt - m.startedAt)} · ${m.frames} frames · ${fmtMB(m.bytes)}${live ? " · recording" : ""}</small></div>
      <div class="sessbtns">
        <button class="btn primary small" data-act="play" type="button" ${live ? "disabled" : ""}>Play</button>
        <button class="btn ghost small" data-act="json" type="button">JSON</button>
        <button class="btn ghost small" data-act="csv" type="button">CSV</button>
        <button class="btn ghost small" data-act="del" type="button" aria-label="Delete ${m.name.replace(/"/g, "&quot;")}" ${live ? "disabled" : ""}>Delete</button>
      </div>`;
    box.appendChild(row);
  }
}

async function onSessionAction(act: string, id: string) {
  const list = await sess.listSessions();
  const m = list.find((x) => x.id === id);
  if (!m) return;
  const stamp = new Date(m.startedAt).toISOString().slice(0, 19).replace(/[:T]/g, "-");
  if (act === "play") return startPlayback(m);
  if (act === "json") return download(new Blob([await sess.exportJson(m)], { type: "application/json" }), `webrx-session_${stamp}.json`);
  if (act === "csv") return download(new Blob([await sess.exportCsv(m)], { type: "text/csv" }), `webrx-session_${stamp}.csv`);
  if (act === "del") {
    if (!confirm(`Delete session “${m.name}”? This can't be undone.`)) return;
    if (player.meta?.id === id) stopPlayback();
    await sess.deleteSession(id);
    log(`Session “${m.name}” deleted`);
    renderSessions();
  }
}

async function startPlayback(m: sess.SessionMeta) {
  if (recorder.active) await toggleRecord();
  if (remote.connected) remote.disconnect();
  if (running) await stop();
  const frames = await sess.loadFrames(m.id);
  if (!frames.length) return log("This session has no frames", "wn");
  if (!pb) pb = { centreHz: frames[0].c, rateHz: frames[0].r, stash: dt.st.bins.slice() };
  dt.st.bins = new Array(360).fill(null);
  analyser.clearHolds();
  timeline.length = 0;
  const pts = frames.filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon)).map((f) => ({ lat: f.lat!, lon: f.lon!, level: f.band }));
  const lv = frames.map((f) => f.band).filter((x): x is number => Number.isFinite(x));
  pb.route = () => {
    liveMap?.setPlayback(pts, lv.length ? Math.min(...lv) : -100, lv.length ? Math.max(...lv) : -20);
    if (pb?.cur) liveMap?.setPlaybackCursor(pb.cur[0], pb.cur[1]);
  };
  pb.route();
  renderSessions();
  player.load(m, frames);
  $("player").hidden = false;
  document.body.classList.add("playing");
  setText("pbName", m.name);
  setChip("dotSource", "txtSource", "Playback", "warn");
  log(`Playing “${m.name}” — ${frames.length} frames. Live measuring is paused; nothing is added to the thesis recording.`, "ok");
  player.play();
}

function stopPlayback() {
  if (!pb) return;
  player.stop();
  dt.st.bins = pb.stash;
  dt.save(true);
  pb = null;
  liveMap?.setPlayback(null);
  $("player").hidden = true;
  document.body.classList.remove("playing");
  resetSpectrum();
  frames = 0;
  lastStats = null;
  timeline.length = 0;
  setChip("dotSource", "txtSource", device ? `${sdr?.name ?? "SDR"} ready` : "No source", device ? "ok" : "");
  updateReadout();
  dirty = true;
  log("Playback closed");
}

/** Show one recorded frame everywhere, as if it were live. */
function showFrame(f: sess.Frame) {
  if (!pb) return;
  pb.centreHz = f.c;
  pb.rateHz = f.r;
  const d = sess.dequantise(f);
  if (spec.length !== d.length) {
    spec = new Float32Array(d.length);
    raw = new Float32Array(d.length);
    peak = new Float32Array(d.length).fill(-200);
  }
  spec.set(d);
  raw.set(d);
  for (let k = 0; k < d.length; ++k) peak[k] = cfg.peakHold ? Math.max(peak[k] - 0.15, d[k]) : d[k];
  ++frames;
  lastStats = { peak: f.peak ?? NaN, peakHz: f.peakHz ?? NaN, band: f.band ?? NaN, spec: f.spec ?? NaN };
  timeline.push({ peak: lastStats.peak, band: lastStats.band });
  if (timeline.length > 240) timeline.shift();
  analyser.ingest(spec);
  // DT: feed the recorded heading with the level at the DT target (or the recorded DT level).
  const lvl = Number.isFinite(f.dt as number) ? (f.dt as number) : levelAt(dtFreqHz(), dt.st.bwHz);
  if (f.hdg !== undefined && Number.isFinite(lvl)) {
    const src0 = dt.st.source, man = dt.st.manual;
    dt.st.source = "manual";
    dt.st.manual = f.hdg - dt.st.northOffset;
    dt.push(lvl);
    dt.st.source = src0;
    dt.st.manual = man;
  }
  pb.hdg = f.hdg;
  if (Number.isFinite(f.lat) && Number.isFinite(f.lon)) {
    pb.cur = [f.lat!, f.lon!];
    liveMap?.setPlaybackCursor(f.lat!, f.lon!);
  }
  setText("roCenter", freqLabel(f.c));
  setText("roSpan", formatRate(f.r).replace("sps", "Hz"));
  dirty = true;
}

function renderPlayer() {
  if (!player.meta) return;
  setText("pbTime", `${fmtDur(player.position)} / ${fmtDur(player.duration)}`);
  const seek = $<HTMLInputElement>("pbSeek");
  if (document.activeElement !== seek) seek.value = String(Math.round((player.position / Math.max(1, player.duration)) * 1000));
  const b = $("pbPlay");
  b.setAttribute("aria-label", player.playing ? "Pause" : "Play");
  b.innerHTML = `<svg class="i" aria-hidden="true"><use href="#${player.playing ? "i-pause" : "i-play"}"/></svg>`;
}

function bindSessions() {
  recorder.onChange = () => {
    renderRecButton();
    renderSessions();
  };
  recorder.onLimit = (why) => {
    log(`Session recording stopped: ${why} reached`, "wn");
    renderSessions();
  };
  player.onFrame = (f) => showFrame(f);
  player.onState = renderPlayer;
  const rb = document.getElementById("btnRec");
  rb?.addEventListener("click", toggleRecord);
  setInterval(renderRecButton, 1000);
  document.getElementById("sessList")?.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button[data-act]") as HTMLButtonElement | null;
    const row = (e.target as HTMLElement).closest(".sessrow") as HTMLElement | null;
    if (b && row) onSessionAction(b.dataset.act!, row.dataset.id!);
  });
  document.getElementById("sessList")?.addEventListener("change", async (e) => {
    const inp = e.target as HTMLInputElement;
    const row = inp.closest(".sessrow") as HTMLElement | null;
    if (inp.classList.contains("sessname") && row) {
      await sess.renameSession(row.dataset.id!, inp.value.trim() || "Untitled session");
      log("Session renamed");
    }
  });
  const file = document.getElementById("sessFile") as HTMLInputElement | null;
  document.getElementById("btnSessImport")?.addEventListener("click", () => file?.click());
  file?.addEventListener("change", async () => {
    for (const f of Array.from(file.files ?? [])) {
      try {
        const m = await sess.importJson(await f.text());
        log(`Imported “${m.name}” (${m.frames} frames)`, "ok");
      } catch (e: any) {
        log(`Import failed (${f.name}): ${e?.message ?? e}`, "er");
      }
    }
    file.value = "";
    renderSessions();
  });
  $("pbPlay")?.addEventListener("click", () => (player.playing ? player.pause() : player.play()));
  $("pbPrev")?.addEventListener("click", () => {
    player.pause();
    player.step(-1);
  });
  $("pbNext")?.addEventListener("click", () => {
    player.pause();
    player.step(1);
  });
  $("pbSeek")?.addEventListener("input", () => player.seek(Number(($("pbSeek") as HTMLInputElement).value) / 1000));
  $("pbSpeed")?.addEventListener("change", () => player.setSpeed(Number(($("pbSpeed") as HTMLSelectElement).value)));
  $("pbClose")?.addEventListener("click", stopPlayback);
  // limits
  for (const [id, key] of [["limMB", "maxMB"], ["limMin", "maxMinutes"], ["limFps", "fps"]] as const) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) continue;
    el.value = String(recorder.limits[key]);
    el.addEventListener("change", () => {
      const v = Number(el.value);
      if (Number.isFinite(v) && v > 0) (recorder.limits as any)[key] = v;
      try {
        localStorage.setItem(LIM_KEY, JSON.stringify(recorder.limits));
      } catch (_) {}
    });
  }
  // Starting live measuring closes playback; stopping it finishes a session.
  $("btnStart").addEventListener(
    "click",
    () => {
      if (pb) stopPlayback();
      if (remote.connected) remote.disconnect();
    },
    { capture: true }
  );
  const stopBtn = $("btnStop");
  new MutationObserver(() => {
    if (stopBtn.hasAttribute("disabled") && recorder.active) toggleRecord();
  }).observe(stopBtn, { attributes: true, attributeFilter: ["disabled"] });
  window.addEventListener("pagehide", () => recorder.flush());
  renderRecButton();
  renderSessions();
  window.addEventListener("webrx:tab", (e) => {
    const t = (e as CustomEvent).detail;
    if (t === "mt") renderSessions();
    if (pb?.route && (t === "mt" || t === "dt")) setTimeout(() => pb?.route?.(), 350);
  });
  // test hook for headless checks (no hardware): inject frames as if they came from the SDR
  (window as any).__webrxTest = { recorder, player, sess, captureFrame, showFrame, startPlayback, stopPlayback, analyser };
}

// ═══════════════════════════════════════════════════════════════════
//  Status panel (all tabs)
// ═══════════════════════════════════════════════════════════════════

let statusAt = 0;
function renderStatusSoon() {
  const now = performance.now();
  if (now - statusAt < 250) return;
  statusAt = now;
  renderStatus();
}

function renderStatus() {
  if (!document.getElementById("statusPanel")) return;
  const sdrMode = isSdrMode() || !!pb || remote.connected;
  const rem = remote.connected && !pb;
  const s = src();
  const [f0, f1] = analyser.viewHz(s);
  setText("spCentre", sdrMode ? freqLabel(srcCentre()) : "—");
  setText("spTuned", sdrMode && !pb ? freqLabel(tunedHz()) : "—");
  setText("spSpan", sdrMode ? `${hzShort(f1 - f0)}${analyser.cfg.zoom > 1 ? ` (×${+analyser.cfg.zoom.toFixed(2)})` : ""}` : "—");
  setText("spRbw", sdrMode ? `${hzShort((srcRate() / Math.max(1, spec.length || cfg.fftSize)) * 1.5)} · FFT ${spec.length || cfg.fftSize}` : "—");
  setText("spRate", sdrMode ? formatRate(srcRate()) : "—");
  setText("spGain", rem ? "set by server" : isSdrMode() ? `${cfg.gain === null ? "auto" : `${cfg.gain} dB`}${effectiveKind() === "hackrf" ? ` · amp ${cfg.amp ? "on" : "off"}` : ""}` : "—");
  setText("spMode", rem ? `${remote.mod.toUpperCase()} · audio ${remote.audioOn ? "on" : "off"} (remote)` : shared.audioOn ? `${shared.cfg.scheme} · audio on` : `${shared.cfg.scheme} · audio off`);
  const u = rem ? "dB" : cfg.cal ? "dBm" : "dBFS";
  setText("spLevel", lastStats ? `${fmtDb(lastStats.band)} ${u}` : "—");
  setText("spPeak", lastStats && Number.isFinite(lastStats.peak) ? `${fmtDb(lastStats.peak)} @ ${sdrMode ? freqLabel(lastStats.peakHz) : "—"}` : "—");
  const m = sdrMode ? analyser.metrics(s) : null;
  setText("spFloor", m ? `${fmtDb(m.floor)} ${u}` : "—");
  const f = gps.fix;
  setText("spGps", f ? `${f.lat.toFixed(5)}, ${f.lon.toFixed(5)}${f.accuracyM ? ` ±${Math.round(f.accuracyM)} m` : ""}` : gps.status.state);
  const h = pb ? pb.hdg : dt.heading ?? (compass.status.state === "on" ? compass.status.heading : undefined);
  setText("spHeading", h !== undefined ? formatBearing(h) : "—");
  setText("spRec", rem && !recorder.active ? "remote stream" : pb ? `playback ${fmtDur(player.position)}` : recorder.active && recorder.meta ? `● session ${fmtDur(recorder.meta.endedAt - recorder.meta.startedAt)}` : running ? "measuring" : "idle");
  setText("spDevice", rem ? `${remote.label} · ${remote.name || remote.url.page}` : pb ? `${player.meta?.device ?? "recording"} (recorded)` : sdr ? `${sdr.name}${fe.upconvHz ? ` · LO ${hzShort(fe.upconvHz)}` : ""}${fe.ppm ? ` · ${fe.ppm} ppm` : ""}` : isSdrMode() ? "not connected" : cfg.mode);
}

function bindStatus() {
  const panel = document.getElementById("statusPanel");
  if (!panel) return;
  const btn = $("spToggle");
  const KEY = "webrx.status.open";
  const set = (open: boolean) => {
    panel.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Hide live status" : "Show live status");
    try {
      localStorage.setItem(KEY, open ? "1" : "0");
    } catch (_) {}
  };
  let open = false;
  try {
    open = localStorage.getItem(KEY) === "1";
  } catch (_) {}
  set(open);
  btn.addEventListener("click", () => set(!panel.classList.contains("open")));
  setInterval(renderStatus, 1000);
  renderStatus();
}

// ═══════════════════════════════════════════════════════════════════
//  RM: OpenWebRX remote receivers
// ═══════════════════════════════════════════════════════════════════

type DirEntry = { n: string; s: string; u: string; v: string; lat: number; lon: number; ok?: number; k?: "ubersdr" | "kiwisdr"; users?: string; feat?: string };
const FEATURED: DirEntry[] = [
  { n: "TWR | Johannesburg", s: "Johannesburg, South Africa", u: "http://jnb.twrmon.net:8073/", v: "", lat: -26.2, lon: 28.05, k: "kiwisdr", feat: "Featured" },
];
const FAV_KEY = "webrx.remote.favs";
const favs = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch (_) {
    return [];
  }
};
function toggleFav(u: string) {
  const f = favs();
  const i = f.indexOf(u);
  if (i >= 0) f.splice(i, 1);
  else f.unshift(u);
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(f.slice(0, 50)));
  } catch (_) {}
}
const JNB = { lat: -26.2, lon: 28.05 };
let uberDir: DirEntry[] | null = null;
let uberDirErr = "";
let dir: { fetched: string; source: string; probed: boolean; servers: DirEntry[]; kiwi?: DirEntry[] } | null = null;
const SAVED_KEY = "webrx.remote.saved";
const savedServers = (): { u: string; n: string; k?: string }[] => {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch (_) {
    return [];
  }
};
function rememberServer(u: string, n: string, k?: string) {
  const list = savedServers().filter((x) => x.u !== u);
  list.unshift({ u, n, k });
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 20)));
  } catch (_) {}
}
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

let lastRemoteView = "";
function feedRemote(f: Float32Array) {
  if (pb || !remote.connected || !f.length) return;
  const view = `${remote.centreHz}/${remote.rateHz}`;
  if (view !== lastRemoteView) {
    if (lastRemoteView) {
      serverZoomed();
      spec = new Float32Array(0);
    }
    lastRemoteView = view;
    updateReadout();
  }
  if (spec.length !== f.length) {
    spec = new Float32Array(f.length).fill(NaN);
    raw = new Float32Array(f.length);
    peak = new Float32Array(f.length).fill(-200);
    analyser.clearHolds();
  }
  raw.set(f);
  const a = Math.min(0.95, Math.max(0, cfg.avg));
  for (let k = 0; k < f.length; ++k) {
    const v = f[k];
    spec[k] = Number.isNaN(spec[k]) ? v : a * spec[k] + (1 - a) * v;
    peak[k] = cfg.peakHold ? Math.max(peak[k] - 0.15, spec[k]) : spec[k];
  }
  ++frames;
  const l = spectrumLevels(spec, remote.centreHz, remote.rateHz, bwHz());
  lastStats = { peak: l.peak, peakHz: l.peakHz, band: Number.isFinite(remote.smeterDb) ? remote.smeterDb : l.band, spec: l.spec };
  const now = performance.now();
  if (now - lastTimelineAt > 500) {
    lastTimelineAt = now;
    timeline.push({ peak: lastStats.peak, band: lastStats.band });
    if (timeline.length > 240) timeline.shift();
  }
  analyser.ingest(spec);
  if (recorder.active) recorder.offer(captureFrame);
  dirty = true;
}

function renderRemote() {
  if (!document.getElementById("rxLive")) return;
  const on = remote.connected;
  $("rxLive").hidden = !on;
  $("btnRxConnect").textContent = remote.state === "connecting" ? "Connecting…" : "Connect";
  ($("btnRxConnect") as HTMLButtonElement).disabled = remote.state === "connecting";
  const msg = $("rxMsg");
  msg.className = "hint" + (remote.state === "error" ? " bad" : "");
  if (remote.state === "error" && remote.error === "mixed")
    msg.innerHTML = `This server only offers <b>http://</b>. Browsers block insecure WebSockets from an https page (mixed content), so it can't feed SA here. <a href="${esc(remote.url.page)}" target="_blank" rel="noopener">Open it in a new tab ↗</a>`;
  else if (remote.state === "error") msg.textContent = remote.error;
  else if (remote.state === "connecting") msg.textContent = `Connecting to ${remote.url.ws} …`;
  else if (on) msg.textContent = `Connected. Spectrum and waterfall on SA (and here), levels in the status panel, Rec records this stream.`;
  else msg.textContent = "Paste an OpenWebRX, UberSDR or KiwiSDR address (https), or pick one from the directory below.";
  if (!on) return;
  setText("rxName", remote.name || remote.url.page);
  setText("rxMeta", `${remote.label} ${remote.version || "?"} · ${freqLabel(remote.centreHz)} · span ${hzShort(remote.rateHz)} · FFT ${remote.fftSize || "?"} · ${remote.clients}${remote.maxClients ? "/" + remote.maxClients : ""} listeners`);
  const ps = $<HTMLSelectElement>("rxProfile");
  const key = remote.profiles.map((p) => p.id).join(",");
  if (ps.dataset.key !== key) {
    ps.innerHTML = "";
    for (const p of remote.profiles) ps.add(new Option(p.name, p.id));
    ps.dataset.key = key;
  }
  if (document.activeElement !== ps) ps.value = remote.profileId;
  ps.disabled = remote.profiles.length < 2;
  (ps.closest(".field") as HTMLElement).hidden = !remote.profiles.length;
  ($("rxSquelch").closest(".field") as HTMLElement).hidden = remote.kind === "ubersdr";
  const ms = $<HTMLSelectElement>("rxMode");
  const mk = remote.modes.map((m) => m.modulation).join(",") || "default";
  if (ms.dataset.key !== mk) {
    ms.innerHTML = "";
    const list = remote.modes.length ? remote.modes : ["nfm", "wfm", "am", "usb", "lsb", "cw"].map((m) => ({ modulation: m, name: m.toUpperCase() }));
    for (const m of list) ms.add(new Option(m.name, m.modulation));
    ms.dataset.key = mk;
  }
  if (document.activeElement !== ms) ms.value = remote.mod;
  setVal("rxFreq", String(+(remote.tunedHz / 1e6).toFixed(6)));
  setVal("rxSquelch", String(remote.squelch));
  setText("rxSqVal", remote.squelch <= -150 ? "off" : `${remote.squelch} dB`);
  const ab = $("btnRxAudio");
  ab.textContent = remote.audioOn ? "Audio on" : "Audio off";
  ab.setAttribute("aria-pressed", String(remote.audioOn));
  ab.classList.toggle("primary", remote.audioOn);
  setText("rxSmeter", Number.isFinite(remote.smeterDb) ? `${remote.smeterDb.toFixed(1)} dB` : "—");
  setText("rxRate", `${(remote.bytes / 1e6).toFixed(1)} MB received · ${remote.fftFrames} FFT rows`);
  ($("rxOpenLink") as HTMLAnchorElement).href = remote.url.page;
}

async function connectRemote(u: string, kind?: RemoteKind) {
  if (pb) stopPlayback();
  let page = "";
  try {
    page = normaliseUrl(u).page;
  } catch (e: any) {
    log(e?.message ?? String(e), "wn");
    return;
  }
  owrx.disconnect(true);
  uber.disconnect(true);
  kiwi.disconnect(true);
  const pickKind = (document.getElementById("rxUrlKind") as HTMLSelectElement | null)?.value;
  const k: RemoteKind =
    kind ?? (pickKind && pickKind !== "auto" ? (pickKind as RemoteKind) : /:8073\/|kiwi/i.test(page) ? "kiwisdr" : (await looksLikeUber(page)) ? "ubersdr" : "openwebrx");
  remote = k === "ubersdr" ? uber : k === "kiwisdr" ? kiwi : owrx;
  wireRemote();
  try {
    await remote.connect(u);
  } catch (e: any) {
    log(e?.message ?? String(e), "wn");
    renderRemote();
    return;
  }
  if (running) {
    log(`Local measuring stopped: the ${remote.label} server is now the source`, "wn");
    stop();
  }
  resetSpectrum();
  frames = 0;
  lastStats = null;
  timeline.length = 0;
  analyser.set({ zoom: 1, pan: 0.5 });
}

function renderSaved() {
  const box = document.getElementById("rxSaved");
  if (!box) return;
  const list = savedServers();
  box.innerHTML = list.length
    ? list.map((x) => `<button class="btn ghost chipbtn" type="button" data-u="${esc(x.u)}" data-k="${esc(x.k || "")}" title="${esc(x.u)}">${esc(x.n || x.u)}</button>`).join("")
    : "";
}

function renderDir() {
  const box = document.getElementById("rxDir");
  if (!box || !dir) return;
  const q = ($("rxSearch") as HTMLInputElement).value.trim().toLowerCase();
  const onlyOk = ($("rxOnlyOk") as HTMLInputElement).checked;
  const kind = ($("rxKind") as HTMLSelectElement).value;
  const here = gps.fix;
  const ref = here ?? JNB;
  const dist = (e: DirEntry) => haversineKm(ref.lat, ref.lon, e.lat, e.lon);
  const fv = favs();
  const pool = [
    ...(kind === "all" || kind === "kiwisdr" ? FEATURED : []),
    ...(kind === "all" || kind === "ubersdr" ? uberDir ?? [] : []),
    ...(kind === "all" || kind === "kiwisdr" ? (dir.kiwi ?? []).filter((e) => !FEATURED.some((f) => f.u === e.u)) : []),
    ...(kind === "all" || kind === "openwebrx" ? dir.servers : []),
  ];
  const all = kind === "fav" ? [...FEATURED, ...(uberDir ?? []), ...(dir.kiwi ?? []), ...dir.servers].filter((e, i, a) => fv.includes(e.u) && a.findIndex((x) => x.u === e.u) === i) : pool;
  let list = all.filter((e) => (!onlyOk || e.u.startsWith("https:") || e.feat) && (!q || `${e.n} ${e.s} ${e.u}`.toLowerCase().includes(q)));
  const sortBy = ($("rxSort") as HTMLSelectElement).value;
  list = list.slice().sort((a, b) => +!!b.feat - +!!a.feat || +fv.includes(b.u) - +fv.includes(a.u) || (sortBy === "works" ? (b.ok || 0) - (a.ok || 0) || dist(a) - dist(b) : dist(a) - dist(b)));
  const total = list.length;
  list = list.slice(0, 60);
  const https = dir.servers.filter((e) => e.u.startsWith("https:")).length;
  const ub = uberDir ?? [];
  const ubHttps = ub.filter((e) => e.u.startsWith("https:")).length;
  setText(
    "rxDirInfo",
    `OpenWebRX: ${dir.servers.length} on receiverbook.de (snapshot ${dir.fetched.slice(0, 10)}), ${https} https (${Math.round((https / dir.servers.length) * 100)} %). ` +
      (uberDir ? `UberSDR: ${ub.length} online now (instances.ubersdr.org), ${ubHttps} https. ` : uberDirErr ? `UberSDR list unavailable (${uberDirErr}). ` : "UberSDR: loading… ") +
      `KiwiSDR: ${(dir.kiwi ?? []).length} on receiverbook.de, ${(dir.kiwi ?? []).filter((e) => e.u.startsWith("https:")).length} https. ` +
      `Showing ${list.length} of ${total}, distance from ${here ? "your GPS position" : "Johannesburg"}.`
  );
  box.innerHTML = list
    .map((e) => {
      const sec = e.u.startsWith("https:");
      const d = dist(e);
      const kn = e.k === "ubersdr" ? "UberSDR" : e.k === "kiwisdr" ? "KiwiSDR" : "OpenWebRX";
      const isFav = fv.includes(e.u);
      const star = `<button class="btn ghost small star" type="button" data-fav="${esc(e.u)}" aria-pressed="${isFav}" aria-label="${isFav ? "Remove from" : "Add to"} favourites: ${esc(e.n || e.s)}">${isFav ? "★" : "☆"}</button>`;
      const tag = (e.feat ? `<span class="tag feat">${esc(e.feat)}</span> ` : "") + `<span class="tag ${e.k === "ubersdr" ? "uber" : e.k === "kiwisdr" ? "kiwi" : "owrx"}">${kn}</span> ` + (sec ? (e.ok ? `<span class="tag ok">works here</span>` : `<span class="tag">https</span>`) : `<span class="tag warn">http only</span>`) + (e.users ? ` <span class="tag">${esc(e.users)}</span>` : "");
      return `<div class="dirrow"><div class="dirinfo"><b>${esc(e.n || e.s)}</b><small>${esc(e.s && e.s !== e.n ? e.s + " · " : "")}${esc(e.v ? "v" + e.v : "")}${Number.isFinite(d) ? ` · ${Math.round(d)} km` : ""}</small>${tag}</div>
        <div class="dirbtns">${star}${sec ? `<button class="btn primary small" type="button" data-u="${esc(e.u)}" data-k="${e.k ?? "openwebrx"}" data-n="${esc(e.n || e.s)}">Connect</button>` : ""}<a class="btn ghost small" href="${esc(e.u)}" target="_blank" rel="noopener" aria-label="Open ${esc(e.n || e.s)} in a new tab">Open ↗</a></div></div>`;
    })
    .join("");
}

function haversineKm(a1: number, o1: number, a2: number, o2: number) {
  const r = Math.PI / 180;
  const x = Math.sin(((a2 - a1) * r) / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(((o2 - o1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

async function loadUberDir() {
  if (uberDir) return;
  try {
    const j = await (await fetch("https://instances.ubersdr.org/api/instances", { cache: "no-store" })).json();
    uberDir = (j.instances || [])
      .filter((x: any) => x.is_online !== false && x.public_url)
      .map((x: any) => ({
        n: `${x.callsign || ""} ${x.name || ""}`.trim(),
        s: String(x.location || x.country_name || ""),
        u: String(x.public_url),
        v: String(x.version || ""),
        lat: +x.latitude || 0,
        lon: +x.longitude || 0,
        ok: x.tls && x.antenna_connected !== false ? 1 : 0,
        k: "ubersdr" as const,
        users: x.max_clients ? `${x.max_clients - (x.available_clients ?? 0)}/${x.max_clients} users` : "",
      }));
  } catch (e: any) {
    uberDirErr = e?.message ?? String(e);
  }
  renderDir();
}

async function loadDir() {
  loadUberDir();
  if (dir) return;
  try {
    dir = await (await fetch("owrx-servers.json", { cache: "no-cache" })).json();
    renderDir();
  } catch (e: any) {
    setText("rxDirInfo", `Directory unavailable (${e?.message ?? e}); you can still add a server by URL.`);
  }
}

function wireRemote() {
  for (const c of [owrx, uber, kiwi] as RemoteClient[]) {
    c.onFft = (f) => c === remote && feedRemote(f);
    c.onLog = (m, k) => c === remote && log(m, (k as any) ?? "");
    c.onChange = () => c === remote && onRemoteChange();
  }
}

function onRemoteChange() {
    renderRemote();
    updateReadout();
    const idle = document.getElementById("specIdle");
    if (idle && remote.connected) idle.style.display = "none";
    else if (idle && !running && !pb && remote.state !== "connecting") idle.style.display = "";
    if (remote.connected) {
      setChip("dotSource", "txtSource", `${remote.label}: ${remote.name || "remote"}`, "ok");
      rememberServer(remote.url.page, remote.name || remote.url.page, remote.kind);
      renderSaved();
    } else if (remote.state !== "connecting" && !pb) {
      if (frames && !running) {
        resetSpectrum();
        frames = 0;
        lastStats = null;
      }
      if (recorder.active && !running) toggleRecord();
      setChip("dotSource", "txtSource", device ? `${sdr?.name ?? "SDR"} ready` : "No source", device ? "ok" : "");
    }
    dirty = true;
}

function bindRemote() {
  if (!document.getElementById("rxUrl")) return;
  wireRemote();
  const url = $<HTMLInputElement>("rxUrl");
  const go = () => connectRemote(url.value);
  $("btnRxConnect").addEventListener("click", go);
  url.addEventListener("keydown", (e) => e.key === "Enter" && go());
  $("btnRxOpen").addEventListener("click", () => {
    try {
      window.open(normaliseUrl(url.value).page, "_blank", "noopener");
    } catch (e: any) {
      log(e?.message ?? String(e), "wn");
    }
  });
  const pick = (e: Event) => {
    const f = (e.target as HTMLElement).closest("button[data-fav]") as HTMLButtonElement | null;
    if (f) {
      toggleFav(f.dataset.fav!);
      renderDir();
      return;
    }
    const b = (e.target as HTMLElement).closest("button[data-u]") as HTMLButtonElement | null;
    if (!b) return;
    url.value = b.dataset.u!;
    connectRemote(b.dataset.u!, (b.dataset.k as any) || undefined);
    document.getElementById("rxCard")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  $("rxSaved").addEventListener("click", pick);
  $("rxDir").addEventListener("click", pick);
  $("btnRxDisconnect").addEventListener("click", () => remote.disconnect());
  $("btnRxAudio").addEventListener("click", () => {
    if (!remote.audioOn && shared.audioOn) shared.setAudio(false);
    remote.setAudio(!remote.audioOn);
  });
  $("rxVol").addEventListener("input", () => remote.setVolume(Number(($("rxVol") as HTMLInputElement).value)));
  $("rxMode").addEventListener("change", () => remote.setMode(($("rxMode") as HTMLSelectElement).value));
  $("rxProfile").addEventListener("change", () => {
    remote.selectProfile(($("rxProfile") as HTMLSelectElement).value);
    resetSpectrum();
    frames = 0;
    analyser.clearHolds();
  });
  $("rxFreq").addEventListener("change", () => {
    const hz = Number(($("rxFreq") as HTMLInputElement).value) * 1e6;
    if (!remote.tune(hz)) log(remote.kind === "ubersdr" ? "Outside the receiver's range" : `Outside this profile's span (${freqLabel(remote.centreHz - remote.rateHz / 2)} – ${freqLabel(remote.centreHz + remote.rateHz / 2)}); pick another profile`, "wn");
    renderRemote();
  });
  $("rxSquelch").addEventListener("change", () => remote.setSquelch(Number(($("rxSquelch") as HTMLInputElement).value)));
  $("rxSearch").addEventListener("input", renderDir);
  $("rxOnlyOk").addEventListener("change", renderDir);
  $("rxKind").addEventListener("change", renderDir);
  $("rxSort").addEventListener("change", renderDir);
  window.addEventListener("webrx:tab", (e) => (e as CustomEvent).detail === "rm" && loadDir());
  if (document.getElementById("pane-rm")?.hidden === false) loadDir();
  setInterval(() => remote.connected && renderRemote(), 1000);
  renderSaved();
  renderRemote();
  (window as any).__webrxTest = { ...(window as any).__webrxTest, owrx };
}

// ═══════════════════════════════════════════════════════════════════
//  SA interactions (after UberSDR's spectrum UI): drag to pan, wheel/pinch zoom at
//  the pointer, tap to tune with step snap, drag passband edges, hover read-out,
//  VFO with scroll-over-digit tuning, label strip, waterfall tuned line.
//  One code path for local SDR, playback and remote servers.
// ═══════════════════════════════════════════════════════════════════

function canTune() {
  return !pb && (remote.connected || isSdrMode());
}

/** Absolute passband for the active receiver, or null when not demodulating. */
function passband(): [number, number] | null {
  if (pb) return null;
  if (remote.connected) {
    if (remote.lowCut == null || remote.highCut == null) return null;
    return [remote.tunedHz + remote.lowCut, remote.tunedHz + remote.highCut];
  }
  if (!isSdrMode() || !shared.audioOn) return null;
  const w = shared.cfg.bandwidth ?? shared.modeInfo().defaultBandwidth ?? 0;
  if (!w) return null;
  const t = tunedHz();
  const sc = shared.cfg.scheme;
  if (sc === "USB") return [t, t + w];
  if (sc === "LSB") return [t - w, t];
  return [t - w / 2, t + w / 2];
}

function setPassbandEdge(edge: "lo" | "hi", hz: number) {
  const pbv = passband();
  if (!pbv) return;
  const t = tunedHz();
  if (remote.connected) {
    let lo = (remote.lowCut ?? 0), hi = (remote.highCut ?? 0);
    if (edge === "lo") lo = Math.min(hi - 100, hz - t);
    else hi = Math.max(lo + 100, hz - t);
    remote.setPassband(lo, hi);
  } else {
    const sc = shared.cfg.scheme;
    const w = Math.max(200, sc === "USB" || sc === "LSB" ? Math.abs(hz - t) : 2 * Math.abs(hz - t));
    shared.set({ bandwidth: Math.round(w) });
    renderListen();
  }
  dirty = true;
}

let localLabels: Label[] | null = null;
function labelsNow(): Label[] {
  if (remote.connected && !pb) return [...remote.bands, ...remote.bookmarks];
  if (!localLabels) {
    const B = (window as any).webrxBands || {};
    localLabels = [];
    for (const set of ["misc", "cell"]) for (const [n, lo, hi] of B[set] ?? []) localLabels.push({ hz: lo * 1e6, hi: hi * 1e6, text: n, kind: "band" });
    document.querySelectorAll<HTMLOptionElement>("#freqPresets option").forEach((o) => localLabels!.push({ hz: parseFloat(o.value) * 1e6, text: o.textContent || o.value, kind: "bookmark" }));
  }
  return localLabels;
}

function snapHz(hz: number) {
  const st = analyser.cfg.step;
  return analyser.cfg.snap && st > 0 ? Math.round(hz / st) * st : Math.round(hz);
}

/** Tune the active receiver (remote, or local listen offset / centre). */
function tuneAny(hz: number) {
  if (!canTune() || !Number.isFinite(hz)) return;
  if (remote.connected) {
    if (!remote.tune(hz)) log(remote.kind === "openwebrx" ? "Outside the server's span — pick another profile" : "Outside the receiver's range", "wn");
  } else tuneTo(hz);
  renderVfo();
  dirty = true;
}

/** Ask a server that supports it (UberSDR, KiwiSDR) to zoom its own FFT to the current view. */
let serverZoomTimer = 0;
let serverZoomPending = false;
function syncServerZoom() {
  if (!remote.connected || pb || remote.kind === "openwebrx") return;
  clearTimeout(serverZoomTimer);
  serverZoomTimer = window.setTimeout(() => {
    const [f0, f1] = analyser.viewHz(src());
    if (analyser.cfg.zoom === 1 && Math.abs((f0 + f1) / 2 - remote.centreHz) < 1) return;
    if (remote.zoom((f0 + f1) / 2, f1 - f0)) serverZoomPending = true;
  }, 350);
}
/** Called when a remote frame arrives with a new centre/span: the server has zoomed, so reset ours. */
function serverZoomed() {
  if (!serverZoomPending) return;
  serverZoomPending = false;
  analyser.set({ zoom: 1, pan: 0.5 });
}

function zoomAt(factor: number, xCss: number, wCss: number) {
  const s = src();
  const hz = analyser.xToHz(s, Math.max(analyser.LEFT, xCss), wCss);
  const z0 = analyser.cfg.zoom;
  const z1 = Math.max(1, Math.min(64, z0 * factor));
  if (z1 === z0 && !(remote.connected && remote.kind !== "openwebrx")) return;
  // keep the frequency under the pointer fixed
  const frac = (Math.max(analyser.LEFT, xCss) - analyser.LEFT) / Math.max(1, wCss - analyser.LEFT);
  const lo0 = s.centreHz - s.rateHz / 2;
  const viewSpan = s.rateHz / z1;
  const f0 = (hz ?? s.centreHz) - frac * viewSpan;
  analyser.set({ zoom: z1, pan: (f0 + viewSpan / 2 - lo0) / s.rateHz });
  syncServerZoom();
  renderSa();
  dirty = true;
}

function bindScopeInteractions() {
  const sp = $<HTMLCanvasElement>("spectrum");
  const wf = $<HTMLCanvasElement>("waterfall");
  sp.tabIndex = 0;
  sp.setAttribute("role", "application");
  sp.setAttribute("aria-label", "Spectrum: tap to tune, drag to pan, wheel or pinch to zoom, drag the pink passband edges to change the filter. Keys: left/right tune by step, + and − zoom, Home centres on the tuned frequency.");
  const pts = new Map<number, { x: number; y: number }>();
  let drag: null | { mode: "pan" | "edge" | "maybe"; edge?: "lo" | "hi"; x0: number; pan0: number; moved: boolean; pinch0?: number; zoom0?: number; c: HTMLCanvasElement } = null;
  const rel = (c: HTMLCanvasElement, e: PointerEvent | MouseEvent) => {
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width };
  };
  const edgeAt = (x: number, w: number): "lo" | "hi" | null => {
    const pbv = passband();
    if (!pbv) return null;
    const s = src();
    const a = analyser.hzToX(s, pbv[0], w), b = analyser.hzToX(s, pbv[1], w);
    const tol = 8;
    if (Math.abs(x - a) <= tol && Math.abs(x - a) <= Math.abs(x - b)) return "lo";
    if (Math.abs(x - b) <= tol) return "hi";
    return null;
  };
  for (const c of [sp, wf]) {
    c.style.touchAction = "none";
    c.addEventListener("pointerdown", (e) => {
      if (!isSdrMode() && !pb && !remote.connected) return;
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = rel(c, e);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        drag = { mode: "pan", x0: p.x, pan0: analyser.cfg.pan, moved: true, pinch0: Math.hypot(a.x - b.x, a.y - b.y), zoom0: analyser.cfg.zoom, c };
        return;
      }
      const edge = c === sp ? edgeAt(p.x, p.w) : null;
      drag = { mode: edge ? "edge" : "maybe", edge: edge ?? undefined, x0: p.x, pan0: analyser.cfg.pan, moved: false, c };
    });
    c.addEventListener("pointermove", (e) => {
      const p = rel(c, e);
      if (c === sp && e.pointerType === "mouse") {
        analyser.hoverX = p.x;
        if (!drag) {
          const edge = edgeAt(p.x, p.w);
          analyser.hotEdge = edge;
          sp.style.cursor = edge ? "ew-resize" : analyser.cfg.zoom > 1 || (remote.connected && remote.kind !== "openwebrx") ? "grab" : "crosshair";
        }
        dirty = true;
      }
      if (!drag || drag.c !== c) return;
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && drag.pinch0) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = c.getBoundingClientRect();
        zoomAt((drag.zoom0! * (d / drag.pinch0)) / analyser.cfg.zoom, (a.x + b.x) / 2 - r.left, r.width);
        return;
      }
      const dx = p.x - drag.x0;
      if (drag.mode === "edge") {
        const hz = analyser.xToHz(src(), p.x, p.w);
        if (hz !== null) setPassbandEdge(drag.edge!, hz);
        drag.moved = true;
        return;
      }
      if (drag.mode === "maybe" && Math.abs(dx) > 5) drag.mode = "pan";
      if (drag.mode === "pan") {
        drag.moved = true;
        const plotW = Math.max(1, p.w - analyser.LEFT);
        analyser.set({ pan: drag.pan0 - dx / plotW / analyser.cfg.zoom });
        if (c === sp) sp.style.cursor = "grabbing";
        dirty = true;
      }
    });
    const end = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (!drag || drag.c !== c) return;
      const d = drag;
      if (pts.size > 0) return;
      drag = null;
      if (d.mode === "pan" && d.moved) {
        // at full span on a server that can move its FFT, a drag re-centres the server
        if (remote.connected && remote.kind !== "openwebrx" && analyser.cfg.zoom === 1) {
          const p = rel(c, e);
          const shift = ((p.x - d.x0) / Math.max(1, p.w - analyser.LEFT)) * remote.rateHz;
          if (remote.zoom(remote.centreHz - shift, remote.rateHz)) serverZoomPending = true;
        } else syncServerZoom();
        renderSa();
        return;
      }
      if (d.mode === "edge" || d.moved || e.type === "pointercancel") return;
      // a tap
      const p = rel(c, e);
      const hz = analyser.xToHz(src(), p.x, p.w);
      if (hz === null) return;
      const mode = analyser.cfg.tap;
      if (mode === "m1") analyser.set({ m1Hz: hz });
      else if (mode === "m2") analyser.set({ m2Hz: hz });
      else tuneAny(snapHz(hz));
      renderSa();
      dirty = true;
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("pointerleave", () => {
      if (c === sp) {
        analyser.hoverX = null;
        analyser.hotEdge = null;
        dirty = true;
      }
    });
    c.addEventListener(
      "wheel",
      (e) => {
        if (!isSdrMode() && !pb && !remote.connected) return;
        e.preventDefault();
        const p = rel(c, e);
        if (e.shiftKey) {
          tuneAny(snapHz(tunedHz() + (e.deltaY < 0 ? 1 : -1) * Math.max(1, analyser.cfg.step)));
          return;
        }
        zoomAt(e.deltaY < 0 ? 1.25 : 0.8, p.x, p.w);
      },
      { passive: false }
    );
  }
  sp.addEventListener("keydown", (e) => {
    const st = Math.max(1, analyser.cfg.step);
    const w = sp.getBoundingClientRect().width;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      tuneAny(snapHz(tunedHz() + (e.key === "ArrowRight" ? st : -st) * (e.shiftKey ? 10 : 1)));
    } else if (e.key === "+" || e.key === "=") zoomAt(1.5, analyser.hzToX(src(), tunedHz(), w), w);
    else if (e.key === "-") zoomAt(1 / 1.5, analyser.hzToX(src(), tunedHz(), w), w);
    else if (e.key === "Home") centreOnTuned();
  });
}

function centreOnTuned() {
  const s = src();
  analyser.set({ pan: 0.5 + (tunedHz() - s.centreHz) / s.rateHz });
  if (analyser.cfg.zoom === 1 && remote.connected && remote.kind !== "openwebrx") {
    if (remote.zoom(tunedHz(), remote.rateHz)) serverZoomPending = true;
  } else syncServerZoom();
  renderSa();
  dirty = true;
}

// ── VFO: big frequency, scroll over a digit to tune it, tap to type ──
const VFO_DIGITS = 10; // up to 9.999 999 999 GHz
function renderVfo() {
  const box = document.getElementById("vfoDigits");
  if (!box) return;
  const hz = Math.max(0, Math.round(tunedHz()));
  const str = String(hz).padStart(VFO_DIGITS, "0");
  if (box.childElementCount !== VFO_DIGITS) {
    box.innerHTML = "";
    for (let i = 0; i < VFO_DIGITS; ++i) {
      const p = VFO_DIGITS - 1 - i;
      const d = document.createElement("span");
      d.className = "vd" + (p % 3 === 2 && i ? " gap" : "");
      d.dataset.p = String(p);
      box.appendChild(d);
    }
  }
  let lead = true;
  box.querySelectorAll<HTMLElement>(".vd").forEach((d, i) => {
    const ch = str[i];
    if (ch !== "0" || +d.dataset.p! < 7) lead = false;
    d.textContent = ch;
    d.classList.toggle("lead", lead);
  });
  box.setAttribute("aria-label", `Tuned ${freqLabel(hz)}`);
  const pbv = passband();
  setText("vfoMode", remote.connected && !pb ? remote.mod.toUpperCase() : shared.cfg.scheme);
  setText("vfoBw", pbv ? hzShort(Math.abs(pbv[1] - pbv[0])) : "—");
  // signal meter: S-units need a calibrated dBm level (S9 = −73 dBm, 6 dB per S-unit)
  const lv = remote.connected && !pb && Number.isFinite(remote.smeterDb) ? remote.smeterDb : lastStats?.band;
  const dbm = remote.connected && !pb ? remote.kind === "kiwisdr" : cfg.cal !== 0;
  const bar = document.getElementById("vfoMeterBar");
  if (bar && lv !== undefined && Number.isFinite(lv)) {
    const u = Math.max(0, Math.min(1, (lv + 127) / 100));
    bar.style.transform = `scaleX(${u.toFixed(3)})`;
    let txt = `${lv.toFixed(1)} ${dbm ? "dBm" : "dB"}`;
    if (dbm) {
      const s = (lv + 127) / 6;
      txt = (s >= 9 ? `S9+${Math.round(lv + 73)}` : `S${Math.max(0, Math.floor(s))}`) + ` · ${txt}`;
    }
    setText("vfoMeterTxt", txt);
  } else if (bar) {
    bar.style.transform = "scaleX(0)";
    setText("vfoMeterTxt", "—");
  }
  // waterfall tuned line
  const line = document.getElementById("wfTune");
  const wf = document.getElementById("waterfall");
  if (line && wf) {
    const w = wf.clientWidth;
    const x = analyser.hzToX(src(), tunedHz(), w);
    const show = (isSdrMode() || remote.connected) && !pb && x >= analyser.LEFT && x <= w;
    line.style.display = show ? "" : "none";
    if (show) {
      line.style.top = `${wf.offsetTop}px`;
      line.style.height = `${wf.offsetHeight}px`;
      line.style.left = `${wf.offsetLeft}px`;
      line.style.transform = `translateX(${x.toFixed(1)}px)`;
    }
  }
}

function bindVfo() {
  const box = document.getElementById("vfoDigits");
  if (!box) return;
  box.addEventListener(
    "wheel",
    (e) => {
      const d = (e.target as HTMLElement).closest(".vd") as HTMLElement | null;
      if (!d || !canTune()) return;
      e.preventDefault();
      tuneAny(Math.max(0, Math.round(tunedHz()) + (e.deltaY < 0 ? 1 : -1) * 10 ** +d.dataset.p!));
    },
    { passive: false }
  );
  // touch: swipe up/down on a digit
  let ty: number | null = null, tp = 0;
  box.addEventListener("pointerdown", (e) => {
    const d = (e.target as HTMLElement).closest(".vd") as HTMLElement | null;
    if (!d || e.pointerType === "mouse") return;
    ty = e.clientY;
    tp = +d.dataset.p!;
  });
  box.addEventListener("pointermove", (e) => {
    if (ty === null) return;
    const dy = ty - e.clientY;
    if (Math.abs(dy) >= 18) {
      tuneAny(Math.max(0, Math.round(tunedHz()) + Math.sign(dy) * 10 ** tp));
      ty = e.clientY;
    }
  });
  box.addEventListener("pointerup", () => (ty = null));
  const input = $<HTMLInputElement>("vfoInput");
  const openInput = () => {
    if (!canTune()) return;
    input.hidden = false;
    box.hidden = true;
    input.value = String(+(tunedHz() / 1e6).toFixed(6));
    input.focus();
    input.select();
  };
  const closeInput = (apply: boolean) => {
    if (input.hidden) return;
    if (apply) {
      const v = parseFloat(input.value);
      if (Number.isFinite(v) && v > 0) tuneAny(v * 1e6);
    }
    input.hidden = true;
    box.hidden = false;
  };
  box.addEventListener("click", openInput);
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openInput();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      tuneAny(snapHz(tunedHz() + (e.key === "ArrowUp" ? 1 : -1) * analyser.cfg.step));
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") closeInput(true);
    if (e.key === "Escape") closeInput(false);
  });
  input.addEventListener("blur", () => closeInput(true));
  $("btnVfoDown").addEventListener("click", () => tuneAny(snapHz(tunedHz() - analyser.cfg.step)));
  $("btnVfoUp").addEventListener("click", () => tuneAny(snapHz(tunedHz() + analyser.cfg.step)));
  const step = $<HTMLSelectElement>("vfoStep");
  step.value = String(analyser.cfg.step);
  step.addEventListener("change", () => analyser.set({ step: Number(step.value) }));
  $("btnScopeZoomIn").addEventListener("click", () => {
    const w = $("spectrum").getBoundingClientRect().width;
    zoomAt(2, analyser.hzToX(src(), tunedHz(), w), w);
  });
  $("btnScopeZoomOut").addEventListener("click", () => {
    const w = $("spectrum").getBoundingClientRect().width;
    zoomAt(0.5, analyser.hzToX(src(), tunedHz(), w), w);
  });
  $("btnScopeCentre").addEventListener("click", centreOnTuned);
  const lb = $("btnScopeLabels");
  const syncLb = () => lb.setAttribute("aria-pressed", String(analyser.cfg.labels));
  lb.addEventListener("click", () => {
    analyser.set({ labels: !analyser.cfg.labels });
    syncLb();
    dirty = true;
  });
  syncLb();
  setInterval(renderVfo, 250);
  window.addEventListener("resize", renderVfo);
  renderVfo();
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
    log(hasWebSerial() ? "Desktop — press Connect GPS (Map tab) to open the G-MOUSE USB port" : "Press Connect GPS (Map tab) to use this device's location", "wn");
  }

  restoreRecording();
  requestAnimationFrame(frame);
  dirty = true;
}
