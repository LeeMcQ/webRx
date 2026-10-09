// RF MMN Monitor — spectrum, waterfall and GPS-tagged measurement logging.
//
// Sources: RTL-SDR or HackRF One/Pro over WebUSB (spectrum computed by the
// Rust/WASM DSP core), or the browser's Network Information API for Wi-Fi /
// cellular quality estimates. Location from the phone's GPS or a G-MOUSE USB
// receiver over Web Serial. Records export as CSV that map.html can plot.

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
};

type LogRow = {
  ts: string;
  device: string;
  centerHz: number | "";
  rateHz: number | "";
  gpsSource: string;
  lat: string;
  lon: string;
  alt: string;
  acc: string;
  sats: string;
  peak: string;
  peakHz: number | "";
  band: string;
  spec: string;
  netQuality: string;
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
const records: LogRow[] = [];
const timeline: { peak: number; band: number }[] = [];
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

function saveSettings() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
  } catch (_) {}
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
  if (running && now - lastLogAt >= cfg.logEvery * 1000) {
    lastLogAt = now;
    addRecord();
  }
  dirty = true;
}

/** Peak, and mean power (linear average, shown in dB) over the band (centre 50%) and the whole span. */
function computeStats() {
  const n = spec.length;
  let pk = -Infinity;
  let pkIdx = 0;
  let sumAll = 0;
  let sumBand = 0;
  const b0 = n >> 2;
  const b1 = n - b0;
  for (let k = 0; k < n; ++k) {
    const v = spec[k];
    if (v > pk) {
      pk = v;
      pkIdx = k;
    }
    const lin = Math.pow(10, v / 10);
    sumAll += lin;
    if (k >= b0 && k < b1) sumBand += lin;
  }
  const peakHz = cfg.freqMHz * 1e6 + ((pkIdx - n / 2) * cfg.sampleRate) / n;
  return {
    peak: pk,
    peakHz,
    band: 10 * Math.log10(sumBand / (b1 - b0)),
    spec: 10 * Math.log10(sumAll / n),
  };
}

// ═══════════════════════════════════════════════════════════════════
//  Records / CSV
// ═══════════════════════════════════════════════════════════════════

function gpsColumns() {
  const f = gps.fix;
  return {
    gpsSource: f ? f.source : gps.status.source,
    lat: f ? f.lat.toFixed(6) : "",
    lon: f ? f.lon.toFixed(6) : "",
    alt: f?.altM !== undefined ? f.altM.toFixed(1) : "",
    acc: f?.accuracyM !== undefined ? f.accuracyM.toFixed(1) : "",
    sats: f?.satellites !== undefined ? String(f.satellites) : "",
  };
}

function addRecord() {
  const g = gpsColumns();
  if (isSdrMode() && lastStats) {
    records.push({
      ts: new Date().toISOString(),
      device: sdr?.name ?? "SDR",
      centerHz: Math.round(cfg.freqMHz * 1e6),
      rateHz: cfg.sampleRate,
      ...g,
      peak: lastStats.peak.toFixed(2),
      peakHz: Math.round(lastStats.peakHz),
      band: lastStats.band.toFixed(2),
      spec: lastStats.spec.toFixed(2),
      netQuality: "",
    });
  } else if (netInfo) {
    records.push({
      ts: new Date().toISOString(),
      device: cfg.mode === "wifi" ? "Wi-Fi (estimated)" : "Cellular (estimated)",
      centerHz: "",
      rateHz: "",
      ...g,
      peak: String(netInfo.rssi),
      peakHz: "",
      band: String(netInfo.rssi),
      spec: netInfo.rtt !== null ? String(netInfo.rtt) : "",
      netQuality: String(netInfo.quality),
    });
  }
  $("stRecords").textContent = String(records.length);
}

function exportCsv() {
  if (!records.length) {
    log("No log records yet — press Start", "wn");
    return;
  }
  // Column names: map.html finds latitude/longitude and any column containing "power"/"level".
  const header = [
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
    "peak_power_db",
    "peak_freq_hz",
    "band_mean_level_db",
    "spectrum_mean_level_db",
    "units",
    "calibration_db",
    "net_quality_pct",
  ].join(",");
  const units = isSdrMode() ? (cfg.cal !== 0 ? "dBm(cal)" : "dBFS") : "dBm(est)";
  const rows = records.map((r) =>
    [
      r.ts,
      `"${r.device.replace(/"/g, "'")}"`,
      r.centerHz,
      r.rateHz,
      r.gpsSource,
      r.lat,
      r.lon,
      r.alt,
      r.acc,
      r.sats,
      r.peak,
      r.peakHz,
      r.band,
      r.spec,
      units,
      cfg.cal,
      r.netQuality,
    ].join(",")
  );
  download(
    new Blob([header + "\n" + rows.join("\n") + "\n"], { type: "text/csv" }),
    `mmn_log_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`
  );
  log(`CSV exported — ${records.length} records`, "ok");
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
  addRecord();
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
  // band (centre 50%) shading
  ctx.fillStyle = "rgba(59,130,246,0.06)";
  ctx.fillRect(left + pw / 4, 0, pw / 2, ph);
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
  const s = n >> 2;
  const e = n - s;
  const cols = Math.min(e - s, Math.floor(W / 2));
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
  set("gpsHeading", f?.headingDeg !== undefined ? `${f.headingDeg.toFixed(1)}°` : "—");
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
  const st = gps.status;
  const msg = st.state === "fix" ? `fix ${st.fix?.fixLabel}` : st.message ?? st.state;
  if (msg !== lastGpsMsg) {
    lastGpsMsg = msg;
    if (st.state !== "fix" || !lastGpsMsg.startsWith("fix")) {
      log(`GPS (${st.source}): ${st.state === "fix" && st.fix ? `${formatLatLon(st.fix)} — ${st.fix.fixLabel}` : msg}`, st.state === "error" ? "er" : st.state === "fix" ? "nm" : "wn");
    }
  }
});

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
  $("btnCSV").addEventListener("click", exportCsv);
  $("btnClear").addEventListener("click", () => {
    records.length = 0;
    $("stRecords").textContent = "0";
    $("logBox").innerHTML = "";
    log("Log cleared");
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
  });
  new ResizeObserver(() => (dirty = true)).observe(document.body);
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

  requestAnimationFrame(frame);
  dirty = true;
}
