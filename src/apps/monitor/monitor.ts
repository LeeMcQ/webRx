// RF MMN Monitor — spectrum, waterfall and GPS-tagged measurement logging.
//
// Sources: RTL-SDR or HackRF One/Pro over WebUSB (spectrum computed by the
// Rust/WASM DSP core), or the browser's Network Information API for Wi-Fi /
// cellular quality estimates. Location from the phone's GPS or a G-MOUSE USB
// receiver over Web Serial. Every recording is saved on the device as it runs
// (IndexedDB) and opens in the MMN map (map.html) or exports/shares as CSV.

import { FFT } from "@jtarrio/signals/dsp/fft.js";
import { DirectSampling, RtlDevice } from "@jtarrio/webrtlsdr/rtlsdr/rtldevice.js";
import { HackRF, HACKRF_BASEBAND_FILTERS, HACKRF_LNA_STEPS } from "../../devices/hackrf.js";
import { SweepCounter, SweepGrid, blocksForDwell, sweepSteps, type SweepSlice } from "../../devices/sweep.js";
import { initSurvey, type SurveyHost } from "../../survey/ui.js";
import { TUNING_KEY, loadTuning, type TuningState } from "./layout.js";
import { initPresets } from "./presets.js";
import { ConnectedSdr, SdrKind, SdrProvider, deviceKey, setRtlAgc } from "../../devices/provider.js";
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
import { initFab, refreshFab } from "./fab.js";
import { drawCalibrationChart, fitCanvas } from "./calchart.js";
import { initWifiAnalyser } from "./wifi-ui.js";
import { shared } from "./listen.js";
import { analyser, CMAP_NAMES, type Src } from "./analyser.js";
import * as sess from "./sessions.js";
import { owrx, normaliseUrl, safeHttp, safeKind, type Label } from "./owrx.js";
import { uber, looksLikeUber } from "./ubersdr.js";
import { kiwi } from "./kiwi.js";
import { trace, looksLikeTrace } from "./trace.js";
import { headingAt as headingAtTrace } from "../../trace/codec.js";
import { FEATURED, JNB, favs, rememberServer, savedServers, toggleFav } from "./remote-store.js";
import { getConnection, linkQuality, radioBridgeSignal } from "./netinfo.js";
import { avgStep, enbwBins, sUnits, cleanDirEntry, NO_RETRY, backoffMs, type DirEntry } from "./util.js";
type RemoteClient = typeof owrx | typeof uber | typeof kiwi | typeof trace;
type RemoteKind = "openwebrx" | "ubersdr" | "kiwisdr" | "trace";
let remote: RemoteClient = owrx;
import { dt, dtPlay, formatBearing, norm, trueBearing } from "./dt.js";
import { triangulate, ellipsePoints } from "../../df/triangulate.js";
import { fixesToCsv, fixesToGpx, fixesToKml, encodeSession, decodeSession, importKraken, type FixRecord } from "../../df/io.js";
import { distanceHint } from "../../df/pathloss.js";
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
  /** RTL2832U digital AGC (separate from the tuner AGC). */
  rtlAgc: boolean;
  /** HackRF LNA/VGA (dB); null = use the combined gain slider. */
  hrfLna: number | null;
  hrfVga: number | null;
  /** HackRF manual baseband filter (Hz); null = automatic (≈0.75 × sample rate). */
  hrfBaseband: number | null;
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
  rtlAgc: false,
  hrfLna: null,
  hrfVga: null,
  hrfBaseband: null,
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
let spec = new Float32Array(0); // smoothed for display / SA / DT (dB; averaged in linear power by default)
/** Legacy dB-domain EMA, kept bit-for-bit for the thesis log (CSV rows, pins, timeline). */
let specDb = new Float32Array(0);
/** Averaging domain for the displayed spectrum. "lin" = power average (correct for noise and
 *  channel power); "log" = dB average (video averaging, reads ~2.5 dB low on noise). */
let avgMode: "lin" | "log" = localStorage.getItem("webrx.avgMode") === "log" ? "log" : "lin";
let peak = new Float32Array(0); // peak hold (dB)
let frames = 0;
let lastLogAt = 0;
let lastTimelineAt = 0;
let dspMs = 0;
let dirty = false;
let lastStats: { peak: number; peakHz: number; band: number; spec: number } | null = null;
let netInfo: { quality: number; rssi: number | null; rtt: number | null; dl: number; type: string; eff: string } | null = null;
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

/** Remote servers don't say which window they use; Hann (1.5 bins) is the common default. */
const REMOTE_ENBW = 1.5;
function srcEnbw() {
  return remote.connected && !pb ? REMOTE_ENBW : psd?.enbw ?? 1.5;
}

class PsdEngine {
  readonly n: number;
  enbw = 1.5;
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
    this.enbw = enbwBins(this.window);
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
  specDb = new Float32Array(cfg.fftSize).fill(NaN);
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
  if (dotId === "dotSource") refreshFab();
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
    // Tell the RF Tech band table what the connected receiver can actually tune.
    document.body.dataset.rxMaxMhz = String((sdr?.maxFrequency ?? 1.766e9) / 1e6);
    document.body.dataset.rxName = sdr?.name ?? "SDR";
    window.dispatchEvent(new CustomEvent("webrx:rxrange"));
    setChip("dotSource", "txtSource", `${sdr?.name ?? "SDR"} ready`, "ok");
    log(`${sdr?.name ?? "SDR"} connected${sdr?.detail ? ` (${sdr.detail})` : ""}${sdr?.serial ? ` · S/N ${sdr.serial}` : ""}${sdr?.isRtlBlogV4 ? " · RTL-SDR Blog V4 (HF via built-in upconverter)" : ""}`, "ok");
    if (sdr?.firmwareWarning) log(sdr.firmwareWarning, "wn");
    loadFeForDevice();
    hwUi();
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
/** Per-device front-end calibration, keyed by USB serial number ("kind:serial"). */
const FE_DEV_KEY = "webrx.frontend.devices.v1";
let fe: { upconvHz: number; ppm: number; cal?: number } = { upconvHz: 0, ppm: 0 };
try {
  fe = { ...fe, ...JSON.parse(localStorage.getItem(FE_KEY) || "{}") };
} catch (_) {}
function feDevices(): Record<string, typeof fe> {
  try { return JSON.parse(localStorage.getItem(FE_DEV_KEY) || "{}"); } catch (_) { return {}; }
}
function saveFe() {
  try {
    localStorage.setItem(FE_KEY, JSON.stringify(fe));
    if (sdr) {
      const m = feDevices();
      m[deviceKey(sdr)] = { ...fe, cal: cfg.cal };
      localStorage.setItem(FE_DEV_KEY, JSON.stringify(m));
    }
  } catch (_) {}
}
/** On connect: load this dongle's own ppm / upconverter / calibration offset if we have them. */
function loadFeForDevice() {
  if (!sdr) return;
  setTimeout(restoreSourceMemory, 0);
  const m = feDevices()[deviceKey(sdr)];
  if (m) {
    fe = { upconvHz: m.upconvHz ?? 0, ppm: m.ppm ?? 0 };
    if (typeof m.cal === "number") cfg.cal = m.cal;
    log(`Loaded calibration for ${sdr.name}${sdr.serial ? ` (S/N ${sdr.serial})` : ""}: ${fe.ppm} ppm, offset ${cfg.cal} dB`, "ok");
  } else saveFe();
}

async function applyTuning(dev: RtlDevice) {
  // cfg.freqMHz is the RF frequency being measured (what the CSV records);
  // with an upconverter the tuner sits at RF + LO.
  const hz = Math.round(cfg.freqMHz * 1e6 + fe.upconvHz);
  if (sdr?.kind === "rtlsdr") {
    // The R820T tuner can't reach HF; use direct sampling (Q branch) below 28.8 MHz.
    // The RTL-SDR Blog V4 (R828D) has a built-in HF upconverter: never use direct sampling there.
    await dev.setDirectSamplingMethod(!sdr.isRtlBlogV4 && hz < 28_800_000 ? DirectSampling.Q : DirectSampling.Off);
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
  if (dev instanceof HackRF) {
    await ctl(() => dev.setAmpEnabled(cfg.amp));
    await ctl(() => dev.setLnaVga(cfg.hrfLna === null || cfg.hrfVga === null ? null : { lna: cfg.hrfLna, vga: cfg.hrfVga }));
    if (cfg.hrfBaseband) await ctl(() => dev.setBasebandFilter(cfg.hrfBaseband));
  } else if (sdr?.kind === "rtlsdr") await ctl(() => setRtlAgc(dev, cfg.rtlAgc));
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
  if (specDb.length !== n) specDb = new Float32Array(n).fill(NaN);
  avgStep(spec, specDb, raw, a, avgMode, cfg.cal);
  if (surveyFrameHook) surveyFrameHook(raw, n);
  for (let k = 0; k < n; ++k) peak[k] = cfg.peakHold ? Math.max(peak[k] - 0.15, spec[k]) : spec[k];
  ++frames;
  lastStats = computeStats();
  if (gps.fix) dt.setPos({ lat: gps.fix.lat, lon: gps.fix.lon, altM: (gps.fix as any).altM });
  // While an RTL-SDR survey hops across its ranges these frames aren't at the
  // tuned frequency: keep them out of DT, session recording and MMN pins.
  if (isSdrMode() && !surveyHopping) {
    // DT uses the raw (un-averaged) frame so the level lines up in time with the heading.
    dt.overload = rawMaxDbfs() > -3;
    dt.push(levelAt(dtFreqHz(), dt.st.bwHz, raw, cfg.cal), Date.now());
    dtTrackSample();
  }
  analyser.ingest(spec);
  if (recorder.active && !surveyHopping) recorder.offer(captureFrame);
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
  } else if (running && !surveyHopping) {
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
  // thesis log path: unchanged dB-domain average
  const l = spectrumLevels(specDb.length === spec.length ? specDb : spec, cfg.freqMHz * 1e6, cfg.sampleRate, bwHz());
  return { peak: l.peak, peakHz: l.peakHz, band: l.band, spec: l.spec };
}

/** Mean power (dB, linear average) of the averaged spectrum in [f - bw/2, f + bw/2]. */
function levelAt(freqHz: number, bw: number, arr: Float32Array = spec, add = 0): number {
  const n = arr.length;
  if (!n) return NaN;
  const lo = cfg.freqMHz * 1e6 - cfg.sampleRate / 2;
  const k0 = Math.max(0, Math.floor(((freqHz - bw / 2 - lo) / cfg.sampleRate) * n));
  const k1 = Math.min(n - 1, Math.ceil(((freqHz + bw / 2 - lo) / cfg.sampleRate) * n));
  let sum = 0, cnt = 0;
  for (let k = k0; k <= k1; ++k) {
    const v = arr[k] + add;
    if (Number.isFinite(v)) { sum += Math.pow(10, v / 10); ++cnt; }
  }
  return cnt ? 10 * Math.log10(sum / cnt) : NaN;
}

/** Highest raw FFT bin (dBFS, before calibration) — near 0 dBFS means the ADC is clipping. */
function rawMaxDbfs(): number {
  let m = -Infinity;
  for (let k = 0; k < raw.length; ++k) if (raw[k] > m) m = raw[k];
  return m;
}

function tunedHz(): number {
  if (remote.connected && !pb) return remote.tunedHz;
  return cfg.freqMHz * 1e6 + shared.cfg.offsetHz;
}

function dtFreqHz(): number {
  return tuning && tuning.s.dt.mode === "lock" && tuning.s.dt.lockHz ? tuning.s.dt.lockHz : tunedHz();
}

// ── shared tuning model (tuned vs view, DT follow/lock, per-source memory, start-up) ──
let tuning: TuningState;
let tuningSaveT = 0;
function sourceKey(): string | undefined {
  if (remote.connected) return "remote:" + remote.url.page;
  if (sdr) return "local:" + deviceKey(sdr);
  return undefined;
}
function initTuning() {
  tuning = loadTuning(localStorage, { freqHz: cfg.freqMHz * 1e6, dtTargetHz: dt.st.freqHz ?? null });
  tuning.on(() => {
    dt.st.freqHz = tuning.s.dt.mode === "lock" ? tuning.s.dt.lockHz : null;
    clearTimeout(tuningSaveT);
    tuningSaveT = window.setTimeout(() => {
      try {
        localStorage.setItem(TUNING_KEY, JSON.stringify(tuning));
      } catch (_) {}
    }, 500);
  });
  const open = tuning.openingHz();
  if (open > 0 && Math.abs(open - cfg.freqMHz * 1e6) > 0.5) {
    cfg.freqMHz = open / 1e6;
    saveSettings();
  }
  dt.st.freqHz = tuning.s.dt.mode === "lock" ? tuning.s.dt.lockHz : null;
}
/** Mirrors the live SA tuned frequency and view into the model (called from renderVfo). */
function bindStartupFreq() {
  const mode = document.getElementById("setStartFreqMode") as HTMLSelectElement | null, f = document.getElementById("setStartFreq") as HTMLInputElement | null;
  if (!mode || !f) return;
  mode.value = tuning.s.startupMode;
  f.value = String(+(tuning.s.startupHz / 1e6).toFixed(6));
  f.disabled = mode.value !== "fixed";
  const apply = () => {
    f.disabled = mode.value !== "fixed";
    const v = parseFloat(f.value);
    tuning.setStartup(Number.isFinite(v) && v > 0 ? v * 1e6 : tuning.s.startupHz, mode.value as "last" | "fixed");
  };
  mode.addEventListener("change", apply);
  f.addEventListener("change", apply);
}
function syncTuning() {
  if (!tuning || pb) return;
  const hz = tunedHz();
  if (Number.isFinite(hz) && hz > 0 && Math.abs(hz - tuning.s.tunedHz) > 0.5) tuning.tune(hz, sourceKey());
  const [f0, f1] = analyser.viewHz(src());
  if (f1 > f0 && (Math.abs((f0 + f1) / 2 - tuning.s.view.centreHz) > 1 || Math.abs(f1 - f0 - tuning.s.view.spanHz) > 1)) tuning.setView((f0 + f1) / 2, f1 - f0);
}
/** On (re)connecting a source, go back to the frequency last used with it. */
function restoreSourceMemory() {
  const k = sourceKey();
  if (!k || !tuning) return;
  const m = tuning.restore(k);
  if (!m) return void tuning.remember(k, { tunedHz: tunedHz() });
  if (remote.connected) return void remote.tune(m.tunedHz);
  if (Math.abs(m.tunedHz - tunedHz()) < 1) return;
  shared.set({ offsetHz: 0 });
  const f = document.getElementById("freq") as HTMLInputElement | null;
  if (f) {
    f.value = String(+(m.tunedHz / 1e6).toFixed(6));
    f.dispatchEvent(new Event("change"));
  }
  log(`Restored ${freqLabel(m.tunedHz)} (last used with this source)`, "ok");
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
    const lvl = rssi !== null && Number.isFinite(rssi) ? rssi.toFixed(1) : "";
    row = {
      ...base,
      device: cfg.mode === "wifi" ? (rssi !== null ? "Wi-Fi (Radio Bridge)" : "Wi-Fi (link quality only)") : rssi !== null ? "Cellular (Radio Bridge)" : "Cellular (link quality only)",
      center_freq_hz: "",
      sample_rate_hz: "",
      peak_power_db: lvl,
      peak_freq_hz: "",
      band_mean_level_db: lvl,
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
  if (f) dt.setPos({ lat: f.lat, lon: f.lon, altM: (f as any).altM });
  sampler.opts.spacingM = cfg.spacingM;
  sampler.opts.formula = cfg.distFormula;
  if (cfg.logMode !== "distance") return;
  if (!running || calRun || surveyHopping) {
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
  const saved = loadCalibration();
  const useSaved = !draft.inherent && !draft.vehicle && saved;
  drawCalibrationChart(
    $<HTMLCanvasElement>("calChart"),
    draft.inherent ?? (useSaved ? saved!.inherent : undefined),
    draft.vehicle ?? (useSaved ? saved!.vehicle : undefined),
    Number($<HTMLInputElement>("calGuard").value) || 0,
    bwHz()
  );
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
  // Link-quality score. RTT is the most informative field Chrome exposes, so it
  // carries most of the weight. Caveats: downlink is capped at 10 Mbps and
  // rounded to 25 kbps, RTT is rounded to 25 ms, and `type` is often missing on
  // desktop. This is NOT a radio signal level.
  const { q, label } = linkQuality(rtt, dl, eff);
  // Real signal level only from the Radio Bridge app (RSSI for Wi-Fi, RSRP for LTE/NR).
  const rb = radioBridgeSignal();
  const rssi = rb ? rb.dbm : null;
  $("nType").textContent = type;
  $("nEffType").textContent = eff;
  $("nDownlink").textContent = Number.isNaN(dl) ? "—" : `${dl.toFixed(2)} Mbps`;
  $("nDownMax").textContent = typeof conn.downlinkMax === "number" && Number.isFinite(conn.downlinkMax) ? `${conn.downlinkMax.toFixed(1)} Mbps` : "—";
  $("nRTT").textContent = rtt !== null ? `${rtt} ms` : "—";
  $("nQuality").textContent = `${label} (${q}%)`;
  $("nRSSI").textContent = rb ? `${rb.dbm} dBm ${rb.kind} (Radio Bridge)` : "—";
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
  // No spectrum trace is drawn: a browser cannot measure RF power, so drawing one
  // would look like a measurement. Only a real Radio Bridge level is plotted on
  // the timeline; otherwise records carry link quality / RTT only.
  ++frames;
  const lv = info.rssi ?? NaN;
  lastStats = { peak: lv, peakHz: 0, band: lv, spec: info.rtt ?? NaN };
  if (info.rssi !== null) {
    timeline.push({ peak: info.rssi, band: info.rssi });
    if (timeline.length > 240) timeline.shift();
    pinAvg.addLevels({ rssi: info.rssi });
  }
  if (cfg.logMode === "time") addRecord();
  dirty = true;
}

// ═══════════════════════════════════════════════════════════════════
//  Drawing
// ═══════════════════════════════════════════════════════════════════

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
    $("roRbw").textContent = hzShort((remote.rateHz / Math.max(1, remote.fftSize || spec.length)) * REMOTE_ENBW);
    $("stRate").textContent = formatRate(remote.rateHz);
    return;
  }
  const units = isSdrMode() ? (cfg.cal !== 0 ? "dBm (cal)" : "dBFS") : "dBm (est.)";
  $("specUnits").textContent = units;
  $("levelUnits").textContent = units;
  if (isSdrMode()) {
    $("roCenter").textContent = freqLabel(cfg.freqMHz * 1e6);
    $("roSpan").textContent = formatRate(cfg.sampleRate).replace("sps", "Hz");
    $("roRbw").textContent = `${((cfg.sampleRate / cfg.fftSize) * srcEnbw() / 1000).toFixed(2)} kHz`;
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
  tracePhoneHeading();
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
  refreshFab();
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
  $<HTMLInputElement>("biasTee").addEventListener("click", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.checked && !confirm("Antenna power puts DC (RTL-SDR ≈4.5 V / HackRF 3.3 V, ~50 mA) on the antenna connector. Only enable it for a powered LNA or active antenna — it can damage a DC-shorted antenna, filter or test equipment. Continue?")) { e.preventDefault(); }
  });
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
  bindHardware();
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

function dtActive() {
  return pb ? dtPlay : dt;
}

/** Gain state as recorded with a fix; DF needs a fixed gain with every AGC off. */
function gainState(): { text: string; agc: boolean } {
  if (sdr?.kind === "hackrf" && device instanceof HackRF) {
    const g = device.currentLnaVga();
    return { text: `LNA ${g.lna} / VGA ${g.vga} dB${cfg.amp ? " + amp 14" : ""}`, agc: false };
  }
  const agc = cfg.gain === null || cfg.rtlAgc;
  return { text: cfg.gain === null ? "tuner AGC" : `${cfg.gain} dB${cfg.rtlAgc ? " + RTL AGC" : ""}`, agc };
}

/** DF needs repeatable levels: switch tuner AGC and RTL AGC off, keeping the current gain or 30 dB. */
async function dtLockGain(quiet = false) {
  const before = gainState();
  if (!before.agc) return;
  if (cfg.gain === null) cfg.gain = 30;
  cfg.rtlAgc = false;
  saveSettings();
  const g = $<HTMLInputElement>("gain");
  if (g) { g.value = String(cfg.gain); g.disabled = false; }
  const ga = $<HTMLInputElement>("gainAuto");
  if (ga) ga.checked = false;
  const r = $<HTMLInputElement>("rtlAgc");
  if (r) r.checked = false;
  if (device) {
    await ctl(() => device!.setGain(cfg.gain)).catch(() => {});
    if (sdr?.kind === "rtlsdr") await setRtlAgc(device, false).catch(() => false);
  }
  if (!quiet) log(`DT: gain fixed at ${gainState().text} for repeatable bearings`, "ok");
}

function renderDt() {
  const pane = document.getElementById("pane-dt");
  if (!pane || pane.hidden) return;
  const d = dtActive();
  const units = cfg.cal ? "dBm" : "dBFS";
  const sun = document.body.classList.contains("sun");
  d.draw($<HTMLCanvasElement>("dtCanvas"), units, sun);
  const north = d.st.source === "manual" ? "T" : d.northRef();
  $("dtHeading").textContent = d.heading !== undefined ? formatBearing(d.heading, north) : "—";
  $("dtLevel").textContent = d.level !== undefined ? `${d.level.toFixed(1)} ${units}` : "—";
  const f = d.fit();
  $("dtBest").textContent = f ? `${formatBearing(f.bearing, north)}${d.st.mode === "null" ? ` / ${formatBearing(f.bearing + 180, north)}` : ""}` : "—";
  $("dtBeam").textContent = f ? `${f.beamwidth.toFixed(0)}° · ±${f.sigma.toFixed(0)}°` : "—";
  $("dtSnr").textContent = f ? `${f.snrDb.toFixed(1)} dB${f.frontBackDb !== null ? ` · F/B ${f.frontBackDb.toFixed(0)}` : ""}` : "—";
  $("dtCoverage").textContent = `${d.coverage()}° / 360°`;
  $("dtFixCount").textContent = String(dt.st.fixes.length);
  const dec = d.declination();
  $("dtDecl").textContent = d.st.declMode === "off" ? "off (°M)" : `${dec >= 0 ? "+" : ""}${dec.toFixed(1)}°${d.st.declMode === "auto" ? (d.pos ? " WMM" : " (no GPS)") : " manual"}`;
  const gs = gainState();
  const gEl = $("dtGain");
  gEl.textContent = gs.text;
  gEl.classList.toggle("bad", gs.agc);
  $("btnDtLockGain").hidden = !gs.agc;
  $("dtBias").textContent = cfg.biasTee ? "ON (DC on antenna)" : "off";
  $("dtOverload").hidden = !d.overload;
  const warn = [...(f?.warnings ?? [])];
  if (gs.agc && isSdrMode()) warn.unshift("AGC is on — levels move with signal strength; lock the gain.");
  $("dtWarn").textContent = warn.join(" · ");
  $("dtGuide").textContent = pb ? "Playing back a recording (not saved to the live plot)." : running ? d.guidance() : (d.problem ?? "Press Start (or Sweep capture), then turn slowly through a full circle.");
  $("dtTarget").textContent = `${freqLabel(dtFreqHz())} · ${dt.st.bwHz / 1000} kHz`;
  dtRenderExtras?.(f, units);
}
/** Hook for later DT features (tone, hints, capture). */
let dtRenderExtras: ((f: ReturnType<typeof dt.fit>, units: string) => void) | null = null;

function renderDtFixes() {
  liveMap?.setBearings(dt.st.fixes.map((f, i) => ({ lat: f.lat, lon: f.lon, bearing: trueBearing(f), sigma: f.sigma, ambiguous: f.mode === "null", label: `Fix ${i + 1}: ${formatBearing(f.bearing, f.north)} ±${f.sigma}° · ${Number.isFinite(f.level) ? f.level.toFixed(1) : "—"} ${f.units} · ${freqLabel(f.freqHz)}` })));
  dtAfterFixes?.();
}
let dtAfterFixes: (() => void) | null = null;

function dtSaveFix() {
  const f = gps.fix;
  if (!f) return log("Save fix needs a GPS position (MT tab → Connect GPS)", "wn");
  const ready = dt.ready();
  if (!ready.ok) log(`DT: ${ready.why} — saving anyway with lower confidence`, "wn");
  const gs = gainState();
  const fix = dt.addFix({ lat: f.lat, lon: f.lon, gpsAccM: (f as any).accuracyM, units: cfg.cal ? "dBm" : "dBFS", gain: gs.text, agc: gs.agc, headingSource: dt.st.source === "manual" ? "manual" : `compass-${compass.status.source ?? "?"}`, freqHz: dtFreqHz(), station: dt.st.session });
  if (!fix) return log("No bearing measured yet — press Start and turn through a circle", "wn");
  if (!ready.ok) { fix.sigma = +(fix.sigma * 1.5).toFixed(1); dt.save(true); }
  log(`DT fix ${dt.st.fixes.length}: ${formatBearing(fix.bearing, fix.north)} ±${fix.sigma}° (HPBW ${fix.beamwidth}°) at ${f.lat.toFixed(5)}, ${f.lon.toFixed(5)}`, "ok");
  renderDtFixes();
  dt.reset();
  dirty = true;
  return fix;
}

function bindDt() {
  if (!document.getElementById("dtCanvas")) return;
  const fq = $<HTMLInputElement>("dtFreq");
  const lm = $<HTMLSelectElement>("dtLockMode");
  const showLock = () => {
    const locked = tuning.s.dt.mode === "lock";
    lm.value = tuning.s.dt.mode;
    fq.disabled = !locked;
    if (document.activeElement !== fq) fq.value = locked && tuning.s.dt.lockHz ? String(+(tuning.s.dt.lockHz / 1e6).toFixed(6)) : "";
    fq.placeholder = locked ? "MHz" : `follows tuned · ${(tunedHz() / 1e6).toFixed(4)}`;
  };
  tuning.on(showLock);
  showLock();
  lm.addEventListener("change", () => {
    if (lm.value === "lock") tuning.dtLock(tuning.s.dt.lockHz ?? tunedHz());
    else tuning.dtFollow();
    dt.reset();
    dirty = true;
  });
  fq.addEventListener("change", () => {
    const v = parseFloat(fq.value);
    if (!(Number.isFinite(v) && v > 0)) return showLock();
    tuning.dtLock(v * 1e6);
    if (Math.abs(v * 1e6 - cfg.freqMHz * 1e6) > cfg.sampleRate * 0.45) log("DT target is outside the current span — tune the centre closer", "wn");
    dt.reset();
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
    dt.reset();
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
  off.value = String(dt.st.mountOffset);
  off.addEventListener("change", () => {
    const v = parseFloat(off.value);
    dt.st.mountOffset = Number.isFinite(v) ? v : 0;
    dt.reset();
  });
  const dm = $<HTMLSelectElement>("dtDeclMode"), dv = $<HTMLInputElement>("dtDeclManual");
  dm.value = dt.st.declMode;
  dv.value = String(dt.st.manualDecl);
  const showDecl = () => ($("dtDeclManualField").hidden = dt.st.declMode !== "manual");
  dm.addEventListener("change", () => { dt.st.declMode = dm.value as any; dt.reset(); showDecl(); dirty = true; });
  dv.addEventListener("change", () => { const v = parseFloat(dv.value); dt.st.manualDecl = Number.isFinite(v) ? v : 0; dt.reset(); dirty = true; });
  showDecl();
  const md = $<HTMLSelectElement>("dtMode");
  md.value = dt.st.mode;
  md.addEventListener("change", () => { dt.st.mode = md.value as any; dt.save(true); dirty = true; });
  const lag = $<HTMLInputElement>("dtLag");
  lag.value = String(dt.st.lagMs);
  lag.addEventListener("change", () => { const v = parseFloat(lag.value); dt.st.lagMs = Number.isFinite(v) ? Math.max(0, Math.min(1000, v)) : 0; dt.reset(); });
  showMan();
  $("btnDtReset").addEventListener("click", () => {
    dt.reset();
    log("DT polar plot cleared");
    dirty = true;
  });
  $("btnDtFix").addEventListener("click", () => dtSaveFix());
  $("btnDtClearFixes").addEventListener("click", () => {
    if (dt.st.fixes.length && !confirm(`Delete all ${dt.st.fixes.length} fixes in “${dt.st.session}”?`)) return;
    dt.clearFixes();
    renderDtFixes();
    dirty = true;
  });
  $("btnDtLockGain").addEventListener("click", () => dtLockGain().then(() => (dirty = true)));
  $("btnDtCompass").addEventListener("click", () => $("btnCompass").click());
  // Figure-8 calibration prompt when the platform says accuracy is poor or the needle is jittery.
  let jitter: number[] = [];
  compass.addEventListener("change", () => {
    dt.trackHeading();
    const s = compass.status;
    if (s.heading !== undefined) { jitter.push(s.heading); if (jitter.length > 20) jitter.shift(); }
    let spread = 0;
    if (jitter.length >= 10 && !running) {
      const m = jitter[jitter.length - 1];
      spread = Math.max(...jitter.map((x) => Math.abs(((x - m + 540) % 360) - 180)));
    }
    const poor = (s.accuracy !== undefined && s.accuracy > 15) || spread > 12;
    $("dtCalib").hidden = !poor;
    $("dtRelative").hidden = s.source !== "relative";
  });
  setTimeout(renderDtFixes, 500);
  window.addEventListener("webrx:tab", () => (dirty = true));
  setInterval(() => {
    // keep the needle moving when the stream is stopped
    if (!running) {
      dt.trackHeading();
      dirty = true;
    }
  }, 250);
  bindDtExtras();
}

// ═══════════════════════════════════════════════════════════════════
//  SA display source (live or playback), analyser controls
// ═══════════════════════════════════════════════════════════════════

/** Playback state: when set, displays show the recorded frame instead of the live stream. */
let pb: { centreHz: number; rateHz: number; hdg?: number; cur?: [number, number]; route?: () => void } | null = null;

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
    enbw: srcEnbw(),
    pbLo: passband()?.[0] ?? null,
    pbHi: passband()?.[1] ?? null,
    labels: labelsNow(),
    stats: srcStats(),
    units: remote.connected && !pb ? (remote.kind === "trace" ? trace.units : "dB") : cfg.cal ? "dBm" : "dBFS",
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
  {
    const z = $<HTMLSelectElement>("saZoom");
    const v = String(+c.zoom.toFixed(2));
    let o = Array.from(z.options).find((x) => x.value === v);
    z.querySelectorAll("option[data-dyn]").forEach((x) => x !== o && x.remove());
    if (!o) {
      o = new Option(`${v}×`, v);
      o.dataset.dyn = "1";
      z.add(o);
    }
    z.value = v;
  }
  setVal("saPan", String(Math.round(c.pan * 1000)));
  setText("saRbw", hzShort((srcRate() / Math.max(1, spec.length || cfg.fftSize)) * srcEnbw()));
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
  setText("saChPow", m ? `${fmtDb(m.chPower)} dB in ${hzShort(analyser.cfg.chBwHz)} @ ${freqLabel(m.chCentre)} · RBW ${hzShort((srcRate() / Math.max(1, spec.length || cfg.fftSize)) * srcEnbw())} (ENBW-corrected)` : "—");
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
  const am = $<HTMLSelectElement>("saAvgMode");
  am.value = avgMode;
  am.addEventListener("change", () => {
    avgMode = am.value === "log" ? "log" : "lin";
    try {
      localStorage.setItem("webrx.avgMode", avgMode);
    } catch (_) {}
    spec.fill(NaN);
  });
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
    hdg: dt.heading,
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
  setText("recTimer", on && m ? `Stop recording · ${fmtDur(m.endedAt - m.startedAt)} · ${fmtMB(m.bytes)}` : "Record session");
  refreshFab();
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
    row.innerHTML = `<div class="sessinfo"><input class="sessname" aria-label="Session name" value="${esc(m.name)}" ${live ? "disabled" : ""}/>
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
  if (remote.connected) userDisconnectRemote();
  if (running) await stop();
  const frames = await sess.loadFrames(m.id);
  if (!frames.length) return log("This session has no frames", "wn");
  if (!pb) pb = { centreHz: frames[0].c, rateHz: frames[0].r };
  dtPlay.reset();
  dtPlay.st = { ...dtPlay.st, freqHz: dt.st.freqHz, bwHz: dt.st.bwHz, mode: dt.st.mode, samples: [], fixes: [] };
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
  specDb = new Float32Array(0);
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
  // Recorded headings are already corrected; replay into the separate playback instance only.
  if (f.hdg !== undefined && Number.isFinite(lvl)) {
    dtPlay.heading = f.hdg;
    dtPlay.level = lvl;
    dtPlay.addSample({ h: f.hdg, db: lvl, t: Date.now() });
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
      if (remote.connected) userDisconnectRemote();
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

let uberDir: DirEntry[] | null = null;
let uberDirErr = "";
let dir: { fetched: string; source: string; probed: boolean; servers: DirEntry[]; kiwi?: DirEntry[] } | null = null;
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// ── TRACE: direction finding from the station's antenna pointing ──
/** Level at the DT frequency from a remote spectrum frame (its own view, not the local SDR's). */
function remoteLevelAt(freqHz: number, bw: number, arr: Float32Array): number {
  const n = arr.length;
  if (!n || !remote.rateHz) return NaN;
  const lo = remote.centreHz - remote.rateHz / 2;
  const k0 = Math.max(0, Math.floor(((freqHz - bw / 2 - lo) / remote.rateHz) * n));
  const k1 = Math.min(n - 1, Math.ceil(((freqHz + bw / 2 - lo) / remote.rateHz) * n));
  let sum = 0, cnt = 0;
  for (let k = k0; k <= k1; ++k) if (Number.isFinite(arr[k])) (sum += 10 ** (arr[k] / 10)), ++cnt;
  return cnt ? 10 * Math.log10(sum / cnt) : NaN;
}

/**
 * When the station reports where its antenna points (rotator, compass, or a
 * phone on the boom), every spectrum frame becomes a DT sample: the level at
 * the DT frequency and the heading at that frame's own sample index — both on
 * the station's clock, so network delay doesn't smear the bearing.
 */
const dfPending: { index: bigint; lv: number }[] = [];
function traceDirection(f: Float32Array) {
  if (pb) return;
  const lv = remoteLevelAt(dtFreqHz(), dt.st.bwHz, f);
  if (Number.isFinite(lv)) dfPending.push({ index: trace.spectrumIndex, lv });
  if (dfPending.length > 200) dfPending.splice(0, dfPending.length - 200);
  traceResolveDirection();
}

/** Pointing arrives in batches: a level waits until a heading sample after its index is known. */
function traceResolveDirection() {
  const pts = trace.pointing;
  if (!pts.length) return;
  const newest = pts[pts.length - 1].index;
  const m = trace.pointingMeta;
  while (dfPending.length && dfPending[0].index <= newest) {
    const s = dfPending.shift()!;
    const h0 = headingAtTrace(pts, s.index);
    if (h0 === null) continue;
    const h = m?.magnetic ? norm(h0 + (m.declination ?? dt.declination())) : h0;
    dt.heading = h;
    dt.level = s.lv;
    dt.problem = undefined; // the station supplies the heading; the phone's compass isn't needed
    dt.addSample({ h, db: s.lv, t: Date.now() });
  }
}

/** A phone strapped to the station's antenna can supply the heading (when the station has no sensor of its own). */
let tracePhoneSentAt = 0;
function tracePhoneHeading() {
  if (remote !== trace || !trace.connected || trace.context?.pointing?.source !== "client") return;
  const st = compass.status;
  if (st.state !== "on" || st.source === "relative" || st.heading === undefined) return;
  const now = Date.now();
  if (now - tracePhoneSentAt < 100) return;
  tracePhoneSentAt = now;
  const known = dt.northRef() === "T";
  trace.sendPointing(norm(st.heading + dt.st.mountOffset), { accuracy: st.accuracy ?? null, magnetic: true, declination: known ? dt.declination() : null, tUnixMs: st.timestamp ?? now });
}

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
  specDb = new Float32Array(0);
  avgStep(spec, null, f, a, avgMode);
  for (let k = 0; k < f.length; ++k) peak[k] = cfg.peakHold ? Math.max(peak[k] - 0.15, spec[k]) : spec[k];
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

let remoteMemKey = "";
function renderRemote() {
  if (!document.getElementById("rxLive")) return;
  const on = remote.connected;
  const rk = on ? remote.url.page : "";
  if (rk && rk !== remoteMemKey) setTimeout(restoreSourceMemory, 800);
  remoteMemKey = rk;
  $("rxLive").hidden = !on;
  $("btnRxConnect").textContent = remote.state === "connecting" ? "Connecting…" : "Connect";
  ($("btnRxConnect") as HTMLButtonElement).disabled = remote.state === "connecting";
  const msg = $("rxMsg");
  msg.className = "hint" + (remote.state === "error" ? " bad" : "");
  if (remote.state === "error" && remote.error === "mixed")
    msg.innerHTML = `This server only offers <b>http://</b>. Browsers block insecure WebSockets from an https page (mixed content), so it can't feed SA here. <a href="${esc(remote.url.page)}" target="_blank" rel="noopener noreferrer">Open it in a new tab ↗</a>`;
  else if (remote.state === "error") msg.textContent = remote.error;
  else if (remote.state === "connecting") msg.textContent = `Connecting to ${remote.url.ws} …`;
  else if (on) msg.textContent = `Connected. Spectrum and waterfall on SA (and here), levels in the status panel, Rec records this stream.`;
  else msg.textContent = "Paste an OpenWebRX, UberSDR or KiwiSDR address (https), or pick one from the directory below.";
  if (!on) return;
  setText("rxName", remote.name || remote.url.page);
  setText(
    "rxMeta",
    remote.kind === "trace"
      ? `TRACE ${trace.version || "?"} · ${freqLabel(remote.centreHz)} · span ${hzShort(remote.rateHz)} · ${trace.fftSize} bins · ${trace.units}${trace.context?.cal ? ` ±${trace.context.cal.uncertainty_db} dB` : ""} · clock class ${trace.clockClass}${trace.headingAtSpectrum !== null ? ` · antenna ${Math.round(trace.headingAtSpectrum)}°${trace.pointingMeta?.magnetic ? "M" : ""} (${trace.pointingMeta?.source})` : ""}${trace.controlHolder ? ` · control: ${trace.youControl ? "you" : trace.controlHolder}` : ""}`
      : `${remote.label} ${remote.version || "?"} · ${freqLabel(remote.centreHz)} · span ${hzShort(remote.rateHz)} · FFT ${remote.fftSize || "?"} · ${remote.clients}${remote.maxClients ? "/" + remote.maxClients : ""} listeners`
  );
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
  ($("rxOpenLink") as HTMLAnchorElement).href = safeHttp(remote.url.page) ?? "#";
}


/** Which client a URL needs: user pick, then the directories, then a probe (only for unknown hosts). */
async function detectKind(page: string): Promise<RemoteKind> {
  const pickKind = safeKind((document.getElementById("rxUrlKind") as HTMLSelectElement | null)?.value);
  if (pickKind) return pickKind;
  const host = new URL(page).host;
  const has = (l?: DirEntry[] | null) => !!l?.some((e) => {
    try {
      return new URL(e.u).host === host;
    } catch (_) {
      return false;
    }
  });
  if (has(uberDir)) return "ubersdr";
  if (has(dir?.kiwi) || has(FEATURED) || /:8073\/|kiwi/i.test(page)) return "kiwisdr";
  if (has(dir?.servers)) return "openwebrx";
  if (await looksLikeTrace(page)) return "trace";
  return (await looksLikeUber(page)) ? "ubersdr" : "openwebrx";
}

// ── reconnect with backoff ──
const RC_MAX = 8;
const rc = { wasFocused: false, deliberate: true, tries: 0, timer: 0, wasOpen: false, restoring: false, want: null as null | { u: string; kind: RemoteKind; freq: number; mode: string; lo: number | null; hi: number | null; centre: number; span: number; zoomed: boolean; audio: boolean } };
function rememberWant() {
  if (!remote.connected) return;
  rc.want = { u: remote.url.page, kind: remote.kind as RemoteKind, freq: remote.tunedHz, mode: remote.mod, lo: remote.lowCut, hi: remote.highCut, centre: remote.centreHz, span: remote.rateHz, zoomed: remote.kind !== "openwebrx" && remote.rateHz < (remote as any).fullHz * 0.99, audio: remote.audioOn };
}
function userDisconnectRemote() {
  rc.deliberate = true;
  clearTimeout(rc.timer);
  rc.want = null;
  remote.disconnect();
}
function remoteStateChanged() {
  if (remote.connected) {
    rc.wasOpen = true;
    if (rc.restoring && rc.want) {
      const w = rc.want;
      rc.restoring = false;
      remote.setMode(w.mode);
      if (w.lo != null && w.hi != null) remote.setPassband(w.lo, w.hi);
      remote.tune(w.freq);
      if (w.zoomed) remote.zoom(w.centre, w.span);
      if (w.audio && !remote.audioOn) remote.setAudio(true);
      log(`Reconnected to ${remote.name || w.u}; frequency, mode and zoom restored`, "ok");
    }
    rc.tries = 0;
    rememberWant();
    return;
  }
  if (remote.state === "connecting" || rc.deliberate || !rc.wasOpen || !rc.want) return;
  if (remote.state !== "closed" && remote.state !== "error") return;
  if (NO_RETRY.test(remote.error || "")) {
    log(`Not reconnecting: ${remote.error}`, "wn");
    rc.want = null;
    return;
  }
  if (rc.tries >= RC_MAX) {
    log("Gave up reconnecting — press Connect to try again", "er");
    rc.want = null;
    return;
  }
  clearTimeout(rc.timer);
  const ms = backoffMs(rc.tries++);
  log(`Connection lost — reconnecting in ${Math.round(ms / 1000)} s (try ${rc.tries}/${RC_MAX})`, "wn");
  const w = rc.want;
  rc.timer = window.setTimeout(() => {
    if (rc.deliberate || rc.want !== w) return;
    rc.restoring = true;
    connectRemote(w.u, w.kind, true);
  }, ms);
}

async function connectRemote(u: string, kind?: RemoteKind, retry = false) {
  if (pb) stopPlayback();
  clearTimeout(rc.timer);
  rc.deliberate = false;
  rc.wasFocused = retry;
  if (!retry) {
    rc.tries = 0;
    rc.restoring = false;
    rc.wasOpen = false;
  }
  let page = "";
  try {
    page = normaliseUrl(u).page;
  } catch (e: any) {
    log(e?.message ?? String(e), "wn");
    return;
  }
  // only ever hand an http(s) URL to a client (the normalised one, not the raw input)
  const safe = safeHttp(page);
  if (!safe) {
    log("Only http:// and https:// server addresses are supported", "wn");
    return;
  }
  page = u = safe;
  owrx.disconnect(true);
  uber.disconnect(true);
  kiwi.disconnect(true);
  trace.disconnect(true);
  const k: RemoteKind = safeKind(kind) ?? (await detectKind(page));
  remote = k === "ubersdr" ? uber : k === "kiwisdr" ? kiwi : k === "trace" ? trace : owrx;
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
setInterval(rememberWant, 2000);

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
  const total = all.length;
  list = list.slice(0, 60);
  const https = dir.servers.filter((e) => e.u.startsWith("https:")).length;
  const ub = uberDir ?? [];
  const ubHttps = ub.filter((e) => e.u.startsWith("https:")).length;
  setText(
    "rxDirInfo",
    `OpenWebRX: ${dir.servers.length} on receiverbook.de (snapshot ${dir.fetched.slice(0, 10)}), ${https} https (${Math.round((https / dir.servers.length) * 100)} %). ` +
      (uberDir ? `UberSDR: ${ub.length} online now (instances.ubersdr.org), ${ubHttps} https. ` : uberDirErr ? `UberSDR list unavailable${/fetch|network/i.test(uberDirErr) ? " (offline or blocked)" : ` (${uberDirErr})`}. ` : "UberSDR: loading… ") +
      `KiwiSDR: ${(dir.kiwi ?? []).length} on receiverbook.de, ${(dir.kiwi ?? []).filter((e) => e.u.startsWith("https:")).length} https. ` +
      `Showing ${list.length} of ${total}, distance from ${here ? "your GPS position" : "Johannesburg"}.`
  );
  box.removeAttribute("aria-busy");
  if (!list.length) {
    box.innerHTML = `<p class="empty">${q ? `No servers match “${esc(q)}”.` : "No servers for this filter."} <button class="btn ghost small" type="button" data-clear>Clear search and filters</button></p>`;
    return;
  }
  box.innerHTML = list
    .map((e) => {
      const sec = e.u.startsWith("https:");
      const d = dist(e);
      const kn = e.k === "ubersdr" ? "UberSDR" : e.k === "kiwisdr" ? "KiwiSDR" : "OpenWebRX";
      const isFav = fv.includes(e.u);
      const star = `<button class="btn ghost small star" type="button" data-fav="${esc(e.u)}" aria-pressed="${isFav}" aria-label="${isFav ? "Remove from" : "Add to"} favourites: ${esc(e.n || e.s)}">${isFav ? "★" : "☆"}</button>`;
      const tag = (e.feat ? `<span class="tag feat">${esc(e.feat)}</span> ` : "") + `<span class="tag ${e.k === "ubersdr" ? "uber" : e.k === "kiwisdr" ? "kiwi" : "owrx"}">${kn}</span> ` + (sec ? (e.ok ? `<span class="tag ok">works here</span>` : `<span class="tag">https</span>`) : `<span class="tag warn">http only</span>`) + (e.users ? ` <span class="tag">${esc(e.users)}</span>` : "");
      return `<div class="dirrow"><div class="dirinfo"><b>${esc(e.n || e.s)}</b><small>${esc([e.s && e.s !== e.n ? e.s : "", e.v ? "v" + e.v : "", Number.isFinite(d) ? `${Math.round(d)} km` : ""].filter(Boolean).join(" · "))}</small>${tag}</div>
        <div class="dirbtns">${star}${sec ? `<button class="btn primary small" type="button" data-u="${esc(e.u)}" data-k="${safeKind(e.k) ?? "openwebrx"}" data-n="${esc(e.n || e.s)}">Connect</button>` : ""}<a class="btn ghost small" href="${esc(e.u)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(e.n || e.s)} in a new tab">Open ↗</a></div></div>`;
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
      }))
      .map(cleanDirEntry)
      .filter((x: DirEntry | null): x is DirEntry => !!x);
  } catch (e: any) {
    uberDirErr = e?.message ?? String(e);
  }
  renderDir();
}

async function loadDir() {
  loadUberDir();
  if (dir) return;
  try {
    const j = await (await fetch("owrx-servers.json", { cache: "no-cache" })).json();
    const clean = (l: unknown) => (Array.isArray(l) ? l.slice(0, 5000).map(cleanDirEntry).filter((x): x is DirEntry => !!x) : []);
    dir = { fetched: String(j?.fetched ?? ""), source: String(j?.source ?? ""), probed: !!j?.probed, servers: clean(j?.servers), kiwi: clean(j?.kiwi).map((e) => ({ ...e, k: "kiwisdr" as const })) };
    renderDir();
  } catch (e: any) {
    setText("rxDirInfo", navigator.onLine === false || /fetch|network/i.test(String(e?.message ?? e)) ? "You appear to be offline, so the server directory can't load. You can still add a server by URL." : `Directory unavailable (${e?.message ?? e}); you can still add a server by URL.`);
    document.getElementById("rxDir")?.removeAttribute("aria-busy");
  }
}

function wireRemote() {
  for (const c of [owrx, uber, kiwi, trace] as RemoteClient[]) {
    c.onFft = (f) => {
      if (c !== remote) return;
      feedRemote(f);
      if (c === trace) traceDirection(f);
    };
    if (c === trace) trace.onPointing = () => trace === remote && traceResolveDirection();
    c.onLog = (m, k) => c === remote && log(m, (k as any) ?? "");
    c.onChange = () => c === remote && onRemoteChange();
  }
}

function onRemoteChange() {
    remoteStateChanged();
    renderRemote();
    updateReadout();
    const idle = document.getElementById("specIdle");
    if (idle && remote.connected) idle.style.display = "none";
    else if (idle && !running && !pb && remote.state !== "connecting") idle.style.display = "";
    if (remote.state === "connecting") setChip("dotSource", "txtSource", `Connecting to ${remote.name || remote.label}…`, "warn");
    else if (remote.state === "error" && !rc.timer) setChip("dotSource", "txtSource", `${remote.label} connection failed`, "err");
    if (remote.connected) {
      if (!rc.wasFocused) {
        rc.wasFocused = true;
        const d = document.getElementById("btnRxDisconnect");
        if (d && document.getElementById("pane-cm")?.hidden === false) d.focus({ preventScroll: true });
      }
      setChip("dotSource", "txtSource", `${remote.label}: ${remote.name || "remote"}`, "ok");
      rememberServer(remote.url.page, remote.name || remote.url.page, remote.kind);
      renderSaved();
    } else if (remote.state !== "connecting" && remote.state !== "error" && !pb) {
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
      const p = safeHttp(normaliseUrl(url.value).page);
      if (p) window.open(p, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      log(e?.message ?? String(e), "wn");
    }
  });
  const pick = (e: Event) => {
    if ((e.target as HTMLElement).closest("button[data-clear]")) {
      ($("rxSearch") as HTMLInputElement).value = "";
      ($("rxKind") as HTMLSelectElement).value = "all";
      renderDir();
      return;
    }
    const f = (e.target as HTMLElement).closest("button[data-fav]") as HTMLButtonElement | null;
    if (f) {
      toggleFav(f.dataset.fav!);
      renderDir();
      return;
    }
    const b = (e.target as HTMLElement).closest("button[data-u]") as HTMLButtonElement | null;
    if (!b) return;
    const u = safeHttp(b.dataset.u);
    if (!u) return;
    url.value = u;
    connectRemote(u, safeKind(b.dataset.k));
    document.getElementById("rxCard")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  $("rxSaved").addEventListener("click", pick);
  $("rxDir").addEventListener("click", pick);
  $("btnRxDisconnect").addEventListener("click", userDisconnectRemote);
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
  window.addEventListener("webrx:tab", (e) => (e as CustomEvent).detail === "cm" && loadDir());
  if (document.getElementById("pane-cm")?.hidden === false) loadDir();
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

/** Tunable range of the active source (Hz). */
function tuneRange(): [number, number] {
  if (remote.connected) {
    // a TRACE station retunes its receiver: anything the device covers is tunable
    if (remote.kind === "trace") return [trace.context?.device?.min_hz ?? 0, trace.context?.device?.max_hz ?? 6e9];
    const full = (remote as any).fullHz as number | undefined;
    if (full) return [0, full];
    return [remote.centreHz - remote.rateHz / 2, remote.centreHz + remote.rateHz / 2];
  }
  const f = document.getElementById("freq") as HTMLInputElement | null;
  const lo = parseFloat(f?.min || "") * 1e6, hi = parseFloat(f?.max || "") * 1e6;
  return [Number.isFinite(lo) ? lo : 0, Number.isFinite(hi) ? hi : 6e9];
}

/** Digit p (10^p Hz) up/down, on the step grid and clamped to the source range. */
function digitStep(p: number, dir: number) {
  if (!canTune()) return;
  const st = Math.max(1, analyser.cfg.step);
  const inc = Math.max(10 ** p, st);
  tuneAny(Math.round((tunedHz() + dir * inc) / st) * st);
}

/** Tune the active receiver (remote, or local listen offset / centre). */
function tuneAny(hz: number) {
  if (!canTune() || !Number.isFinite(hz)) return;
  const [lo, hi] = tuneRange();
  hz = Math.min(hi, Math.max(lo, hz));
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
  if (!isSdrMode() && !pb && !remote.connected) return;
  const s = src();
  if (!(s.rateHz > 0) || !Number.isFinite(factor)) return;
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
  let drag: null | { mode: "pan" | "edge" | "maybe"; edge?: "lo" | "hi"; x0: number; y0?: number; pan0: number; moved: boolean; pinch0?: number; zoom0?: number; c: HTMLCanvasElement } = null;
  const rel = (c: HTMLCanvasElement, e: PointerEvent | MouseEvent) => {
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width };
  };
  const edgeAt = (x: number, w: number, touch = false): "lo" | "hi" | null => {
    const pbv = passband();
    if (!pbv) return null;
    const s = src();
    const a = analyser.hzToX(s, pbv[0], w), b = analyser.hzToX(s, pbv[1], w);
    const tol = touch ? 22 : 10;
    if (Math.abs(x - a) <= tol && Math.abs(x - a) <= Math.abs(x - b)) return "lo";
    if (Math.abs(x - b) <= tol) return "hi";
    return null;
  };
  for (const c of [sp, wf]) {
    // vertical swipes scroll the page; horizontal drags pan, taps tune, two fingers zoom
    c.style.touchAction = "pan-y";
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
      const edge = c === sp ? edgeAt(p.x, p.w, e.pointerType !== "mouse") : null;
      drag = { mode: edge ? "edge" : "maybe", edge: edge ?? undefined, x0: p.x, y0: p.y, pan0: analyser.cfg.pan, moved: false, c };
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
      if (drag.mode === "maybe") {
        const dy = p.y - (drag.y0 ?? p.y);
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
          // mostly vertical: it's a scroll, not a tune or a pan
          drag = null;
          pts.delete(e.pointerId);
          try {
            c.releasePointerCapture(e.pointerId);
          } catch (_) {}
          return;
        }
        if (Math.abs(dx) > 8) drag.mode = "pan";
      }
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
  syncTuning();
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
  const dbm = remote.connected && !pb ? remote.kind === "kiwisdr" || (remote.kind === "trace" && trace.units === "dBm") : cfg.cal !== 0;
  const bar = document.getElementById("vfoMeterBar");
  if (bar && lv !== undefined && Number.isFinite(lv)) {
    const u = Math.max(0, Math.min(1, (lv + 127) / 100));
    bar.style.transform = `scaleX(${u.toFixed(3)})`;
    let txt = `${lv.toFixed(1)} ${dbm ? "dBm" : "dB"}`;
    if (dbm) {
      txt = `${sUnits(lv, tunedHz())} · ${txt}`;
    }
    setText("vfoMeterTxt", txt);
  } else if (bar) {
    bar.style.transform = "scaleX(0)";
    setText("vfoMeterTxt", "—");
  }
  // passband edge controls (keyboard / screen-reader alternative to dragging)
  const pbBox = document.getElementById("pbCtl");
  if (pbBox) {
    pbBox.hidden = !pbv;
    if (pbv) {
      const t = tunedHz();
      for (const [id, v, out] of [["pbLoIn", pbv[0] - t, "pbLoVal"], ["pbHiIn", pbv[1] - t, "pbHiVal"]] as const) {
        const el = document.getElementById(id) as HTMLInputElement;
        if (document.activeElement !== el) el.value = String(Math.round(v));
        setText(out, `${v > 0 ? "+" : ""}${(v / 1000).toFixed(2)} kHz`);
      }
    }
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
      // only once the readout has focus: otherwise the wheel scrolls the page as usual
      if (!d || !canTune() || document.activeElement !== box) return;
      e.preventDefault();
      digitStep(+d.dataset.p!, e.deltaY < 0 ? 1 : -1);
    },
    { passive: false }
  );
  // touch: swipe up/down on a digit
  // touch: press and hold a digit (250 ms), then swipe up/down; one step per 32 px
  let ty: number | null = null, tp = 0, held = false, holdT = 0, swiped = false;
  box.addEventListener("pointerdown", (e) => {
    const d = (e.target as HTMLElement).closest(".vd") as HTMLElement | null;
    if (!d || e.pointerType === "mouse") return;
    ty = e.clientY;
    tp = +d.dataset.p!;
    held = swiped = false;
    clearTimeout(holdT);
    holdT = window.setTimeout(() => {
      held = true;
      d.classList.add("held");
      box.setPointerCapture(e.pointerId);
    }, 250);
  });
  box.addEventListener("pointermove", (e) => {
    if (ty === null) return;
    const dy = ty - e.clientY;
    if (!held) {
      if (Math.abs(dy) > 10) {
        clearTimeout(holdT);
        ty = null; // a scroll, not a tune
      }
      return;
    }
    e.preventDefault();
    if (Math.abs(dy) >= 32) {
      digitStep(tp, Math.sign(dy));
      ty = e.clientY;
      swiped = true;
    }
  });
  const up = () => {
    clearTimeout(holdT);
    ty = null;
    held = false;
    box.querySelectorAll(".held").forEach((x) => x.classList.remove("held"));
  };
  box.addEventListener("pointerup", up);
  box.addEventListener("pointercancel", up);
  box.addEventListener("touchmove", (e) => held && e.preventDefault(), { passive: false });
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
    box.focus();
  };
  box.addEventListener("click", () => {
    if (swiped) {
      swiped = false;
      return;
    }
    openInput();
  });
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
  for (const [id, edge] of [["pbLoIn", "lo"], ["pbHiIn", "hi"]] as const)
    $(id).addEventListener("input", (e) => {
      setPassbandEdge(edge, tunedHz() + Number((e.target as HTMLInputElement).value));
      renderVfo();
    });
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
  initTuning();
  bind();
  initFab(() => {
    const m = recorder.meta;
    return {
      dot: ($("dotSource").className.match(/\b(ok|live|warn|err)\b/) || [""])[0],
      text: $("txtSource").textContent ?? "",
      running,
      recording: recorder.active,
      recLabel: recorder.active && m ? `${fmtDur(m.endedAt - m.startedAt)} · ${fmtMB(m.bytes)}` : "",
      playing: !!pb,
      remote: remote.connected,
    };
  });
  bindStartupFreq();
  initSurvey(surveyHost);
  const pr = initPresets({
    show: (t) => (window as any).webrxShowTab?.(t),
    deviceKind: () => surveyHost.deviceKind(),
    openConnect: () => document.getElementById("connChip")?.click(),
    openSoftKey: (k) => (window as any).webrxOpenSoftKey?.(k),
    log: (m, k) => log(m, k === "ok" ? "ok" : ""),
    dtLock: (hz) => tuning.dtLock(hz),
  });
  document.getElementById("btnRunSetup")?.addEventListener("click", () => pr.openFirstRun(true));
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
  initWifiAnalyser();
  requestAnimationFrame(frame);
  dirty = true;
}

// ── DT triangulation ────────────────────────────────────────────
let dtEst: ReturnType<typeof triangulate> = null;
function dtTriangulate() {
  // A map is drawn against true north: fixes saved before declination was known are corrected first.
  const use = dt.st.fixes.filter((f) => Number.isFinite(f.bearing) && Number.isFinite(f.lat)).map((f) => ({ ...f, bearing: trueBearing(f), north: "T" as const }));
  // Loop nulls are ambiguous by 180°: pick the reciprocal that agrees best with the peak fixes (or skip if alone).
  const peaks = use.filter((f) => f.mode !== "null");
  const list = use.map((f) => ({ lat: f.lat, lon: f.lon, bearing: f.bearing, sigma: Math.max(f.sigma, (f.gpsAccM ?? 0) > 50 ? 10 : 0) }));
  if (peaks.length >= 2 && peaks.length < use.length) {
    const base = triangulate(list.filter((_, i) => use[i].mode !== "null"));
    if (base) use.forEach((f, i) => {
      if (f.mode !== "null") return;
      const toEst = (Math.atan2((base.lon - f.lon) * Math.cos((f.lat * Math.PI) / 180), base.lat - f.lat) * 180) / Math.PI;
      if (Math.abs(((toEst - f.bearing + 540) % 360) - 180) > 90) list[i].bearing = norm(f.bearing + 180);
    });
  }
  dtEst = list.length >= 2 ? triangulate(list) : null;
  const el = document.getElementById("dtEst");
  if (dtEst && el) {
    const e = dtEst.ellipse95;
    el.innerHTML = `<b>${dtEst.lat.toFixed(5)}, ${dtEst.lon.toFixed(5)}</b><br>95 % ellipse ${fmtM(e.a)} × ${fmtM(e.b)} (major axis ${e.angle.toFixed(0)}°) · ${dtEst.used} bearings · rms miss ${fmtM(dtEst.rms)}${dtEst.cockedHat ? " · cocked hat shown" : ""}`;
    liveMap?.setEstimate({ lat: dtEst.lat, lon: dtEst.lon, ellipse: ellipsePoints(dtEst.lat, dtEst.lon, e), cockedHat: dtEst.cockedHat, label: `Estimate ±${fmtM(e.a)} (95 %)` });
  } else {
    if (el) el.textContent = list.length < 2 ? "Save fixes from at least two places (ideally 60–120° apart) to locate the transmitter." : "Bearings don't intersect in front of both stations — re-check one of them.";
    liveMap?.setEstimate(null);
  }
}
const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

function bindDtExtras() {
  dtAfterFixes = dtTriangulate;
  $("btnDtFitMap").addEventListener("click", () => {
    const pts: [number, number][] = dt.st.fixes.map((f) => [f.lat, f.lon]);
    if (dtEst) pts.push([dtEst.lat, dtEst.lon]);
    liveMap?.fitTo(pts);
  });
  bindDtField();
}
// ── DT field UX: tone, haptics, sun theme, one-tap capture, export, sessions ──
let toneCtx: AudioContext | null = null, toneOsc: OscillatorNode | null = null, toneGain: GainNode | null = null;
function dtTone(level: number | undefined, floor: number | undefined) {
  if (!dt.st.tone || level === undefined || floor === undefined || !running) { if (toneGain) toneGain.gain.value = 0; return; }
  if (!toneCtx) {
    toneCtx = new AudioContext();
    toneOsc = toneCtx.createOscillator();
    toneGain = toneCtx.createGain();
    toneOsc.type = "sine";
    toneOsc.connect(toneGain).connect(toneCtx.destination);
    toneGain.gain.value = 0;
    toneOsc.start();
  }
  const above = level - floor;
  const open = above >= dt.st.squelchDb;
  // 300 Hz at the squelch, +40 Hz per dB (2.3 kHz at +50 dB): pitch follows signal like a classic DF receiver.
  toneOsc!.frequency.setTargetAtTime(300 + Math.max(0, Math.min(50, above - dt.st.squelchDb)) * 40, toneCtx.currentTime, 0.03);
  toneGain!.gain.setTargetAtTime(open ? 0.15 : 0, toneCtx.currentTime, 0.02);
}

let dtCapture = false;
async function dtStartCapture() {
  dt.reset();
  await dtLockGain(true);
  dtCapture = true;
  log("DT sweep capture: turn slowly through a full circle, then back across the peak", "ok");
  if (!running) await start();
  dirty = true;
}

function dtHints(f: ReturnType<typeof dt.fit>, units: string) {
  const out: string[] = [];
  if (dt.overload || (f && f.snrDb < 6 && dt.level !== undefined && dt.level > (units === "dBm" ? -40 : -25)))
    out.push("Very strong and flat: you are close. Use an offset attenuator (tune to LO ± IF / a harmonic), add a step attenuator, or remove the antenna and use the body-shield null.");
  if (f && f.frontBackDb !== null && f.frontBackDb < 6) out.push(`Front/back only ${f.frontBackDb.toFixed(0)} dB — the strongest return may be a reflection; check ${formatBearing(f.bearing + 180)} too.`);
  if (f && units === "dBm" && Number.isFinite(f.peakDb)) {
    const d = distanceHint(f.peakDb, dtFreqHz(), dt.st.eirpDbm, 0, dt.st.plExp);
    out.push(`Distance hint ≈ ${fmtM(d)} (EIRP ${dt.st.eirpDbm} dBm, n = ${dt.st.plExp}; rough ×/÷3).`);
  }
  return out;
}

function dtDownload(kind: "csv" | "kml" | "gpx") {
  const name = dt.st.session || "webRx DF";
  const safe = name.replace(/[^\w.-]+/g, "_");
  const est = dtEst ? { lat: dtEst.lat, lon: dtEst.lon, ellipse: ellipsePoints(dtEst.lat, dtEst.lon, dtEst.ellipse95) } : undefined;
  const text = kind === "csv" ? fixesToCsv(dt.st.fixes) : kind === "kml" ? fixesToKml(name, dt.st.fixes, est) : fixesToGpx(name, dt.st.fixes, dtTrack.map((p) => ({ lat: p.lat, lon: p.lon, t: p.t, db: p.db })));
  const mime = kind === "csv" ? "text/csv" : kind === "kml" ? "application/vnd.google-earth.kml+xml" : "application/gpx+xml";
  download(new Blob([text], { type: mime }), `${safe}.${kind}`);
}

const DT_SESS_KEY = "webrx.dt.sessions";
function dtSessions(): Record<string, FixRecord[]> {
  try { return JSON.parse(localStorage.getItem(DT_SESS_KEY) || "{}"); } catch (_) { return {}; }
}
function dtSaveSessions(m: Record<string, FixRecord[]>) {
  try { localStorage.setItem(DT_SESS_KEY, JSON.stringify(m)); } catch (_) { log("Could not save DT sessions (storage full?)", "er"); }
}
function dtRenderSessions() {
  const sel = $<HTMLSelectElement>("dtSession");
  const m = dtSessions();
  m[dt.st.session] = dt.st.fixes;
  sel.innerHTML = "";
  for (const n of Object.keys(m).sort()) { const o = document.createElement("option"); o.value = n; o.textContent = `${n} (${m[n].length})`; sel.appendChild(o); }
  sel.value = dt.st.session;
}
function dtSwitchSession(name: string) {
  const m = dtSessions();
  m[dt.st.session] = dt.st.fixes;
  dtSaveSessions(m);
  dt.st.session = name;
  dt.st.fixes = m[name] ?? [];
  dt.save(true);
  dtRenderSessions();
  renderDtFixes();
  dirty = true;
}

function bindDtField() {
  dt.onNewPeak = () => { if (dt.st.haptics && running && navigator.vibrate) navigator.vibrate(25); };
  const sunOn = localStorage.getItem("webrx.dt.sun") === "1";
  document.body.classList.toggle("sun", sunOn);
  const sun = $<HTMLInputElement>("dtSun");
  sun.checked = sunOn;
  sun.addEventListener("change", () => { document.body.classList.toggle("sun", sun.checked); localStorage.setItem("webrx.dt.sun", sun.checked ? "1" : "0"); dirty = true; });
  const tone = $<HTMLInputElement>("dtTone");
  tone.checked = dt.st.tone;
  tone.addEventListener("change", () => { dt.st.tone = tone.checked; dt.save(true); if (tone.checked && toneCtx?.state === "suspended") toneCtx.resume(); });
  const sq = $<HTMLInputElement>("dtSquelch");
  sq.value = String(dt.st.squelchDb);
  sq.addEventListener("change", () => { const v = parseFloat(sq.value); dt.st.squelchDb = Number.isFinite(v) ? v : 6; dt.save(true); });
  const hap = $<HTMLInputElement>("dtHaptics");
  hap.checked = dt.st.haptics;
  hap.addEventListener("change", () => { dt.st.haptics = hap.checked; dt.save(true); });
  const eirp = $<HTMLInputElement>("dtEirp"), ple = $<HTMLInputElement>("dtPlExp");
  eirp.value = String(dt.st.eirpDbm); ple.value = String(dt.st.plExp);
  eirp.addEventListener("change", () => { const v = parseFloat(eirp.value); if (Number.isFinite(v)) dt.st.eirpDbm = v; dt.save(true); });
  ple.addEventListener("change", () => { const v = parseFloat(ple.value); if (Number.isFinite(v) && v >= 1.5 && v <= 6) dt.st.plExp = v; dt.save(true); });
  $("btnDtCapture").addEventListener("click", () => dtStartCapture());
  for (const k of ["csv", "kml", "gpx"] as const) $(`btnDtExp${k.toUpperCase()}`).addEventListener("click", () => dtDownload(k));
  // sessions
  dtRenderSessions();
  $<HTMLSelectElement>("dtSession").addEventListener("change", (e) => dtSwitchSession((e.target as HTMLSelectElement).value));
  $("btnDtNewSession").addEventListener("click", () => {
    const n = prompt("Name for the new DF session", `Hunt ${Object.keys(dtSessions()).length + 1}`)?.trim();
    if (n) dtSwitchSession(n);
  });
  $("btnDtDelSession").addEventListener("click", () => {
    if (!confirm(`Delete session “${dt.st.session}” and its fixes?`)) return;
    const m = dtSessions();
    delete m[dt.st.session];
    dtSaveSessions(m);
    const next = Object.keys(m)[0] ?? "Hunt 1";
    dt.st.session = next; dt.st.fixes = m[next] ?? [];
    dt.save(true); dtRenderSessions(); renderDtFixes();
  });
  dtRenderExtras = (f, units) => {
    dtTone(dt.level, f?.floorDb);
    $("dtHints").textContent = dtHints(f, units).join(" ");
    if (dtCapture && running) {
      const r = dt.ready();
      $("btnDtCapture").textContent = r.ok ? "Captured ✓" : "Capturing…";
      if (r.ok && gps.fix) {
        dtCapture = false;
        const fix = dtSaveFix();
        if (fix && dt.st.haptics && navigator.vibrate) navigator.vibrate([60, 40, 60]);
        $("btnDtCapture").textContent = "Sweep capture";
      }
    }
  };
  bindDtLater();
}
function bindDtLater() {
  // DT keeps only a shortcut to the SA-tab HackRF sweep ("find signal").
  $("btnDtFind").addEventListener("click", () => {
    $("tab-sa").click();
    const c = document.getElementById("sweepCard") as HTMLDetailsElement | null;
    if (c) { c.open = true; c.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  bindDtLaterFeatures();
}
function bindDtLaterFeatures() {
  const heat = $<HTMLInputElement>("dtHeat");
  heat.addEventListener("change", () => { dtHeatOn = heat.checked; dtRenderHeat(); });
  $("btnDtClearTrack").addEventListener("click", () => { dtTrack.length = 0; dtRenderHeat(); });
  // Shared session link: fixes travel in the URL (?dts=…), nothing is uploaded anywhere.
  $("btnDtShare").addEventListener("click", async () => {
    if (!dt.st.fixes.length) return log("No fixes to share yet", "wn");
    const url = `${location.origin}${location.pathname}?dts=${encodeSession({ v: 1, name: dt.st.session, fixes: dt.st.fixes })}#dt`;
    try {
      if (navigator.share) await navigator.share({ title: `webRx DF: ${dt.st.session}`, url });
      else { await navigator.clipboard.writeText(url); log("Share link copied — teammates open it to merge your fixes", "ok"); }
    } catch (_) { prompt("Copy this link", url); }
  });
  const merge = (fixes: FixRecord[], from: string) => {
    const key = (f: FixRecord) => `${f.t}|${f.lat.toFixed(5)}|${f.lon.toFixed(5)}|${f.bearing}`;
    const have = new Set(dt.st.fixes.map(key));
    const add = fixes.filter((f) => !have.has(key(f)));
    dt.st.fixes.push(...add);
    dt.save(true);
    renderDtFixes();
    dtRenderSessions();
    log(`Imported ${add.length} fix(es) from ${from}${fixes.length - add.length ? ` (${fixes.length - add.length} duplicates skipped)` : ""}`, "ok");
  };
  const q = new URLSearchParams(location.search).get("dts");
  if (q) {
    const ss = decodeSession(q);
    if (ss && confirm(`Merge ${ss.fixes.length} shared fixes from “${ss.name}” into “${dt.st.session}”?`)) merge(ss.fixes, `link “${ss.name}”`);
    history.replaceState(null, "", location.pathname + location.hash);
  }
  const file = $<HTMLInputElement>("dtImportFile");
  $("btnDtImport").addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    file.value = "";
    if (!f) return;
    const text = await f.text();
    try {
      const ss = text.trim().startsWith("{") ? decodeSession(btoa(unescape(encodeURIComponent(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")) : null;
      const fixes = ss ? ss.fixes : importKraken(text, dtFreqHz());
      if (!fixes.length) return log("No bearings found in that file (expected webRx JSON, KrakenSDR XML/CSV or DF Aggregator JSON)", "wn");
      merge(fixes, f.name);
    } catch (e: any) {
      log(`Import failed: ${e?.message ?? e}`, "er");
    }
  });
  $("btnDtExpJSON").addEventListener("click", () => download(new Blob([JSON.stringify({ v: 1, name: dt.st.session, fixes: dt.st.fixes }, null, 1)], { type: "application/json" }), `${dt.st.session.replace(/[^\w.-]+/g, "_")}.json`));
}

// ── Hardware controls (SA tab): RTL AGC, HackRF LNA/VGA/baseband, wideband sweep ──
function hwUi() {
  const hk = (sdr?.kind ?? effectiveKind()) === "hackrf";
  document.querySelectorAll<HTMLElement>(".hw-hackrf").forEach((el) => (el.hidden = !hk));
  document.querySelectorAll<HTMLElement>(".hw-rtl").forEach((el) => (el.hidden = hk));
  const lbl = document.getElementById("gainAutoLbl");
  if (lbl) lbl.textContent = hk ? "Default (LNA 16 / VGA 20, HackRF has no AGC)" : "Tuner AGC";
  const fw = document.getElementById("hwInfo");
  if (fw) fw.textContent = sdr ? `${sdr.name}${sdr.detail ? ` · ${sdr.detail}` : ""}${sdr.serial ? ` · S/N ${sdr.serial}` : ""}${sdr.isRtlBlogV4 ? " · Blog V4" : ""}${sdr.firmwareWarning ? " · ⚠ old firmware" : ""}` : "Not connected";
}

let sweepGrid: SweepGrid | null = null;
function drawSweep() {
  const c = document.getElementById("sweepCanvas") as HTMLCanvasElement | null;
  if (!c || !sweepGrid) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.max(200, c.clientWidth) * dpr, H = 160 * dpr;
  if (c.width !== W) { c.width = W; c.height = H; }
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  const d = sweepGrid.db, fin = Array.from(d).filter(Number.isFinite);
  if (!fin.length) return;
  const hi = Math.max(...fin), lo = Math.min(...fin);
  ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = dpr;
  ctx.beginPath();
  for (let i = 0; i < d.length; ++i) {
    if (!Number.isFinite(d[i])) continue;
    const x = (i / d.length) * W, y = H - ((d[i] - lo) / Math.max(1, hi - lo)) * (H - 10 * dpr) - 5 * dpr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#93a4bf"; ctx.font = `${10 * dpr}px ui-monospace, monospace`;
  ctx.fillText(`${(sweepGrid.loHz / 1e6).toFixed(0)} MHz`, 4 * dpr, H - 2 * dpr);
  ctx.textAlign = "right"; ctx.fillText(`${(sweepGrid.hiHz / 1e6).toFixed(0)} MHz · ${sweepGrid.sweeps} sweeps`, W - 4 * dpr, H - 2 * dpr); ctx.textAlign = "left";
  const list = document.getElementById("sweepPeaks")!;
  list.innerHTML = "";
  for (const p of sweepGrid.peaks(6, Math.max(200e3, sweepGrid.binHz * 4))) {
    const b = document.createElement("button");
    b.className = "btn ghost"; b.type = "button";
    b.textContent = `${(p.hz / 1e6).toFixed(3)} MHz · ${p.db.toFixed(0)} dB`;
    b.title = "Tune here and make it the DT target";
    b.addEventListener("click", async () => {
      await stopSweep();
      tuning.dtLock(Math.round(p.hz));
      dt.reset();
      const sc = $<HTMLInputElement>("saCentre");
      sc.value = String(+(p.hz / 1e6).toFixed(6));
      sc.dispatchEvent(new Event("change"));
      log(`Tuned to sweep peak ${(p.hz / 1e6).toFixed(3)} MHz (also the DT target)`, "ok");
    });
    list.appendChild(b);
  }
}
async function stopSweep() {
  if (device instanceof HackRF && device.sweeping) await device.stopSweep();
  $("btnSweep").textContent = "Start sweep";
}
async function toggleSweep() {
  if (device instanceof HackRF && device.sweeping) return stopSweep();
  if (!device) { if (!(await connect())) return; }
  if (!(device instanceof HackRF)) return log("Wideband sweep needs a HackRF", "wn");
  if (running) await stop();
  const nv = (id: string) => parseFloat($<HTMLInputElement>(id).value);
  const lo = Math.max(1, Math.round(nv("sweepLo"))), hi = Math.min(6000, Math.round(nv("sweepHi")));
  if (!(hi > lo)) return log("Sweep: stop must be above start", "wn");
  // Display: peak hold that decays 0.5 dB per completed sweep (not per FFT bin).
  sweepGrid = new SweepGrid(lo * 1e6, hi * 1e6, 2048, "peak", 0.5);
  const counter = new SweepCounter(sweepSteps([[lo, hi]]) * 16);
  let pending = false;
  try {
    await device.startSweep([[lo, hi]], (sl) => sweepGrid!.add(sl), 256, {
      blocksPerStep: 16,
      onBlock: (hz) => {
        if (!counter.next(hz)) return;
        sweepGrid!.endSweep();
        if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; drawSweep(); }); }
      },
    });
    $("btnSweep").textContent = "Stop sweep";
    log(`HackRF sweep ${lo}–${hi} MHz (receive only, 20 MS/s, 5 MHz slices)`, "ok");
  } catch (e: any) {
    log(`Sweep failed: ${e?.message ?? e} — firmware may be too old`, "er");
  }
}


// ═══════════════════════════════════════════════════════════════════
//  RM survey host: what the survey module may use from the receiver
// ═══════════════════════════════════════════════════════════════════

/** Raw dBFS frame tap for RTL hopping (set only while an RM survey runs on an RTL-SDR). */
let surveyFrameHook: ((raw: Float32Array, n: number) => void) | null = null;
let rtlHop: { stop: boolean } | null = null;
/** An RTL-SDR survey is retuning across its ranges: frames aren't at the tuned frequency. */
let surveyHopping = false;
let surveySavedBiasTee: boolean | null = null;
let surveyStartedRun = false;
/** SA was measuring when a HackRF survey took the receiver over: resume it afterwards. */
let surveyResumeSa = false;

const surveyHost: SurveyHost = {
  deviceKind: () => (remote.connected ? "remote" : !device || !sdr ? "none" : sdr.kind === "hackrf" ? "hackrf" : "rtlsdr"),
  deviceLabel: () => (sdr ? `${sdr.name}${sdr.serial ? ` · S/N ${sdr.serial}` : ""}` : remote.connected ? remote.label : "No receiver"),
  serial: () => sdr?.serial,
  biasTee: () => !!(cfg as any).biasTee,
  connect: async () => {
    if (!isSdrMode()) {
      log("Pick a Radio SDR source (RTL-SDR / HackRF) for surveys", "wn");
      return false;
    }
    return connect();
  },
  calOffsetDb: () => cfg.cal,
  ppm: () => fe.ppm,
  // A reference source is a single tone: its level is the peak bin, not the band mean
  // (a mean over many bins would read it ~10·log10(bins) dB low).
  levelDbfs: () => (lastStats && Number.isFinite(lastStats.peak) ? lastStats.peak - cfg.cal : null),
  async measureReference(p) {
    if (!running || !device) throw new Error("Start measuring on SA at the reference frequency first");
    const d = device;
    // Measure at the survey's own gains, then put the SA gains back.
    if (d instanceof HackRF) {
      await ctl(() => d.setAmpEnabled(p.amp));
      await ctl(() => d.setLnaVga({ lna: p.lnaDb, vga: p.vgaDb }));
    }
    try {
      await new Promise((r) => setTimeout(r, 1200)); // let the averaged trace settle
      const avg = new PowerAverager();
      const t0 = performance.now();
      while (performance.now() - t0 < 1500) {
        if (lastStats && Number.isFinite(lastStats.peak)) avg.addLevels({ pk: lastStats.peak - cfg.cal });
        await new Promise((r) => setTimeout(r, 100));
      }
      const v = avg.meanLevels().pk;
      return Number.isFinite(v) ? v : null;
    } finally {
      if (d instanceof HackRF && device === d) {
        await ctl(() => d.setAmpEnabled(cfg.amp)).catch(() => {});
        await ctl(() => d.setLnaVga(cfg.hrfLna === null ? null : { lna: cfg.hrfLna!, vga: cfg.hrfVga! })).catch(() => {});
        await ctl(() => d.setGain(cfg.gain)).catch(() => {});
      }
    }
  },
  async setBiasTee(on) {
    const d = device;
    if (!d) return;
    if (surveySavedBiasTee === null) surveySavedBiasTee = cfg.biasTee;
    await ctl(() => d.enableBiasTee(on)).catch(() => {});
  },
  tunedHz: () => cfg.freqMHz * 1e6,
  openNoiseCal: () => openCalibration(),
  noiseFloorDbm: () => loadCalibration()?.noiseFloorDb ?? null,
  async applyGains(p) {
    const d = device;
    if (d instanceof HackRF) {
      await ctl(() => d.setAmpEnabled(p.amp)).catch(() => {});
      await ctl(() => d.setLnaVga({ lna: p.lnaDb, vga: p.vgaDb })).catch(() => {});
    }
  },
  async startSweep(ranges, onSlice, fftSize, opts) {
    const dwellMs = Math.max(1, opts?.dwellMs ?? 20);
    if (device instanceof HackRF) {
      surveyResumeSa = running;
      if (running) await stop();
      if (device.sweeping) await device.stopSweep();
      const blocks = blocksForDwell(dwellMs);
      await device.startSweep(ranges, onSlice, fftSize, { blocksPerStep: blocks, onBlock: opts?.onUnit });
      return sweepSteps(ranges) * blocks;
    }
    if (!device || sdr?.kind !== "rtlsdr") throw new Error("No receiver connected");
    // RTL-SDR hopping: retune across the ranges, keep the centre 80 % of each frame,
    // and average the frames that arrive during the dwell time (linear power).
    surveyHopping = true;
    surveyStartedRun = !running;
    if (!running) await start();
    if (!running) {
      surveyHopping = false;
      throw new Error("The RTL-SDR didn't start");
    }
    const hop = (rtlHop = { stop: false });
    const rate = cfg.sampleRate, useW = 0.8 * rate;
    let skip = 0;
    let acc: PowerAverager | null = null;
    surveyFrameHook = (raw) => {
      if (skip > 0) skip--;
      else acc?.addSpectrum(raw);
    };
    const hops = ranges.reduce((a, [lo, hi]) => a + Math.max(1, Math.ceil(((hi - lo) * 1e6) / useW)), 0);
    (async () => {
      const saved = cfg.freqMHz;
      while (!hop.stop) {
        for (const [lo, hi] of ranges) {
          for (let c = lo * 1e6 + useW / 2; c - useW / 2 < hi * 1e6 && !hop.stop; c += useW) {
            cfg.freqMHz = c / 1e6;
            await ctl(() => applyTuning(device!)).catch(() => {});
            acc = new PowerAverager();
            skip = 1; // discard the frame that straddles the retune
            const t0 = performance.now();
            // at least one frame, then keep averaging until the dwell time has passed
            while (!hop.stop && performance.now() - t0 < 2000 && (acc.blocks === 0 || performance.now() - t0 < dwellMs)) await new Promise((r) => setTimeout(r, 5));
            const f = acc.meanSpectrum();
            acc = null;
            if (!f) continue;
            opts?.onUnit?.(c);
            const n = f.length, a = Math.floor(n * 0.1), b = Math.ceil(n * 0.9);
            onSlice({ startHz: c - rate / 2 + (a * rate) / n, binHz: rate / n, db: f.slice(a, b) });
          }
        }
      }
      cfg.freqMHz = saved;
      if (device) await ctl(() => applyTuning(device!)).catch(() => {});
    })();
    return hops;
  },
  async stopSweep() {
    const d0 = device;
    if (d0 instanceof HackRF && d0.sweeping) {
      await d0.stopSweep();
      // the survey used its own gains: put the SA settings back
      await ctl(() => d0.setAmpEnabled(cfg.amp)).catch(() => {});
      await ctl(() => d0.setLnaVga(cfg.hrfLna === null ? null : { lna: cfg.hrfLna!, vga: cfg.hrfVga! })).catch(() => {});
      await ctl(() => d0.setGain(cfg.gain)).catch(() => {});
    }
    if (rtlHop) rtlHop.stop = true;
    rtlHop = null;
    surveyFrameHook = null;
    if (surveyHopping) {
      surveyHopping = false;
      // Only stop the measurement if the survey started it.
      if (surveyStartedRun && running) await stop();
    }
    surveyStartedRun = false;
    if (surveySavedBiasTee !== null && device) {
      const d = device, on = surveySavedBiasTee;
      await ctl(() => d.enableBiasTee(on)).catch(() => {});
    }
    surveySavedBiasTee = null;
    if (surveyResumeSa && device && !running) {
      surveyResumeSa = false;
      await start().catch(() => {});
    }
    surveyResumeSa = false;
  },
  fix: () => (gps.fix ? { t: Date.now(), lat: gps.fix.lat, lon: gps.fix.lon, accM: gps.fix.accuracyM ?? undefined, speed: (gps.fix as any).speed ?? null } : null),
  heading: () => dt.heading ?? (compass.status.state === "on" ? compass.status.heading : undefined) ?? null,
  log: (m, k) => log(m, k === "ok" ? "ok" : k === "warn" ? "wn" : k === "err" ? "er" : ""),
};

function bindHardware() {
  const ra = document.getElementById("rtlAgc") as HTMLInputElement | null;
  if (ra) {
    ra.checked = cfg.rtlAgc;
    ra.addEventListener("change", () => {
      cfg.rtlAgc = ra.checked; saveSettings();
      if (device && sdr?.kind === "rtlsdr") setRtlAgc(device, cfg.rtlAgc).then((ok) => log(ok ? `RTL2832U AGC ${cfg.rtlAgc ? "on" : "off"}` : "This driver can't switch the RTL AGC", ok ? "ok" : "wn"));
    });
  }
  const lna = $<HTMLSelectElement>("hrfLna"), vga = $<HTMLSelectElement>("hrfVga"), bb = $<HTMLSelectElement>("hrfBaseband");
  lna.innerHTML = `<option value="">slider</option>` + HACKRF_LNA_STEPS.map((v) => `<option value="${v}">${v} dB</option>`).join("");
  vga.innerHTML = `<option value="">slider</option>` + Array.from({ length: 32 }, (_, i) => i * 2).map((v) => `<option value="${v}">${v} dB</option>`).join("");
  bb.innerHTML = `<option value="">Auto (0.75 × rate)</option>` + HACKRF_BASEBAND_FILTERS.map((v) => `<option value="${v}">${v / 1e6} MHz</option>`).join("");
  lna.value = cfg.hrfLna === null ? "" : String(cfg.hrfLna);
  vga.value = cfg.hrfVga === null ? "" : String(cfg.hrfVga);
  bb.value = cfg.hrfBaseband === null ? "" : String(cfg.hrfBaseband);
  const applyLv = () => {
    cfg.hrfLna = lna.value === "" ? null : Number(lna.value);
    cfg.hrfVga = vga.value === "" ? null : Number(vga.value);
    if ((cfg.hrfLna === null) !== (cfg.hrfVga === null)) { if (cfg.hrfLna === null) cfg.hrfLna = 16; else cfg.hrfVga = 20; lna.value = String(cfg.hrfLna); vga.value = String(cfg.hrfVga); }
    saveSettings();
    const d = device;
    if (d instanceof HackRF) ctl(() => d.setLnaVga(cfg.hrfLna === null ? null : { lna: cfg.hrfLna!, vga: cfg.hrfVga! })).then((g) => log(`HackRF LNA ${g.lna} dB · VGA ${g.vga} dB`, "ok"));
  };
  lna.addEventListener("change", applyLv);
  vga.addEventListener("change", applyLv);
  bb.addEventListener("change", () => {
    cfg.hrfBaseband = bb.value === "" ? null : Number(bb.value);
    saveSettings();
    const d = device;
    if (d instanceof HackRF) ctl(() => d.setBasebandFilter(cfg.hrfBaseband)).then((bw) => log(`HackRF baseband filter ${bw / 1e6} MHz`, "ok"));
  });
  $("btnSweep").addEventListener("click", () => toggleSweep());
  hwUi();
}

/** RSSI-vs-position track for the DT heatmap and GPX export. */
var dtTrack: { lat: number; lon: number; db: number; t: number }[] = [];
let dtHeatOn = false;
function dtTrackSample() {
  const f = gps.fix, lv = dt.level;
  if (!f || lv === undefined || !running) return;
  const last = dtTrack[dtTrack.length - 1];
  const now = Date.now();
  if (last && now - last.t < 1000 && haversineM(last.lat, last.lon, f.lat, f.lon) < 3) {
    if (lv > last.db) last.db = lv; // keep the strongest level per spot (antenna pointed at the target)
    return;
  }
  dtTrack.push({ lat: f.lat, lon: f.lon, db: lv, t: now });
  if (dtTrack.length > 5000) dtTrack.shift();
  if (dtHeatOn && dtTrack.length % 5 === 0) dtRenderHeat();
}
function dtRenderHeat() {
  if (!dtHeatOn || !dtTrack.length) return liveMap?.setHeat(null);
  const lv = dtTrack.map((p) => p.db), lo = Math.min(...lv), hi = Math.max(...lv);
  liveMap?.setHeat(dtTrack.map((p) => [p.lat, p.lon, Math.max(0.05, (p.db - lo) / Math.max(1, hi - lo))]));
}
