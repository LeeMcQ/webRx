// RM · Recording/Monitoring survey tab (PROPOSAL §11): 4-step wizard
// (equipment → dBm calibration → scan parameters → run), run screen, upload queue.
//
// Lee's rulings (13 Oct 2026): the survey always covers the full user-defined
// range — an RTL-SDR that can't reach it blocks the start with a clear message;
// uploads are dBm only, so a completed dBm calibration is required to start.

import type { SweepSlice } from "../devices/sweep.js";
import { SweepGrid } from "../devices/sweep.js";
import { decodeChunk, gunzip } from "./codec.js";
import { ProcessorClient, type ChunkOut } from "./processor.js";
import { simplify } from "./dp.js";
import {
  DEFAULT_PARAMS,
  calibrationComplete,
  deleteProfile,
  estimateBytesPerHour,
  loadProfiles,
  saveProfile,
  validateParams,
  type DbmCalibration,
  type DeviceKind,
  type SweepParams,
} from "./params.js";
import { expiredChunks, limitState, parseLimit, type LimitAction } from "./retention.js";
import { allChunks, allSurveys, deleteChunk, putChunk, putSurvey, type StoredSurvey } from "./store.js";
import { UploadQueue, onUnmeteredNetwork, testConnection, validateServerUrl, type QueuedChunk } from "./upload.js";

export interface SurveyHost {
  deviceKind(): DeviceKind;
  deviceLabel(): string;
  serial(): string | undefined;
  biasTee(): boolean;
  connect(): Promise<boolean>;
  calOffsetDb(): number;
  ppm(): number;
  levelDbfs(): number | null;
  tunedHz(): number;
  openNoiseCal(): void;
  noiseFloorDbm(): number | null;
  applyGains(p: SweepParams): Promise<void>;
  startSweep(ranges: [number, number][], onSlice: (s: SweepSlice) => void, fftSize?: number): Promise<void>;
  stopSweep(): Promise<void>;
  fix(): { t: number; lat: number; lon: number; accM?: number; speed?: number | null } | null;
  heading(): number | null;
  log(m: string, kind?: "ok" | "warn" | "err"): void;
}

// ── persisted settings ──
const SET_KEY = "webrx.survey.settings.v1";
const CAL_KEY = "webrx.survey.cal.v1";
const PARAMS_KEY = "webrx.survey.params.v1";
export interface SurveySettings {
  serverUrl: string;
  token: string;
  autoWifi: boolean;
  unmetered: boolean;
  limitValue: number;
  limitUnit: "MB" | "GB";
  limitAction: LimitAction;
  wakeLock: boolean;
  antenna: string;
}
const DEFAULT_SETTINGS: SurveySettings = { serverUrl: "", token: "", autoWifi: true, unmetered: false, limitValue: 2, limitUnit: "GB", limitAction: "pause", wakeLock: true, antenna: "" };
const load = <T>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? { ...d, ...JSON.parse(v) } : d;
  } catch (_) {
    return d;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (_) {}
};

let host: SurveyHost;
let settings: SurveySettings = load(SET_KEY, DEFAULT_SETTINGS);
let cal: DbmCalibration & { confirmed?: boolean } = load(CAL_KEY, { offsetDb: null, antennaGainDbi: null, cableLossDb: null } as DbmCalibration);
let params: SweepParams = load(PARAMS_KEY, DEFAULT_PARAMS);
let step = 1;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const mb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} kB`);

// ═══ markup ═══
function render() {
  const pane = document.getElementById("pane-rm");
  if (!pane) return;
  pane.innerHTML = `
  <h2 class="pane-title">RM · Recording / Monitoring survey</h2>
  <ol class="rmsteps" role="tablist" aria-label="Survey setup">
    ${["Equipment", "Calibration", "Scan", "Run"].map((t, i) => `<li><button type="button" class="rmstep" data-step="${i + 1}" role="tab">${i + 1} · ${t}</button></li>`).join("")}
  </ol>
  <section class="card rmcard" data-page="1">
    <h2>1 · Equipment</h2>
    <table class="ro-table" id="rmEquip"></table>
    <div class="grid2">
      <div class="field"><label for="rmAntenna">Antenna (type)</label><input id="rmAntenna" placeholder="e.g. discone, whip" value="${esc(settings.antenna)}" /></div>
      <div class="field"><label for="rmHeight">Antenna height (m)</label><input id="rmHeight" type="number" step="0.1" inputmode="decimal" value="${params.heightM}" /></div>
    </div>
    <div class="btns"><button class="btn primary" id="rmConnect" type="button">Connect receiver</button><button class="btn ghost" type="button" data-go="2">Next</button></div>
    <p class="hint">HackRF sweep covers 1–6000 MHz and is the primary survey device. An RTL-SDR (24–1766 MHz) hops instead and can only run ranges inside its coverage. Long screen-off surveys: browsers throttle hidden pages — a Radio Bridge (native helper) is the future path; for now keep the screen on (Wake Lock).</p>
  </section>
  <section class="card rmcard" data-page="2" hidden>
    <h2>2 · dBm calibration <span class="spacer"></span><span class="lbl" id="rmCalState"></span></h2>
    <p class="hint">Uploads are in dBm at the antenna terminals: dBm = dBFS + offset − antenna gain + cable loss. All three values are required before a survey can start.</p>
    <div class="grid2">
      <div class="field"><label for="rmCalOffset">dBFS → dBm offset (dB)</label><input id="rmCalOffset" type="number" step="0.1" inputmode="decimal" /></div>
      <div class="field"><label for="rmCalGain">Antenna gain (dBi)</label><input id="rmCalGain" type="number" step="0.1" inputmode="decimal" /></div>
      <div class="field"><label for="rmCalLoss">Cable loss (dB)</label><input id="rmCalLoss" type="number" step="0.1" min="0" inputmode="decimal" /></div>
      <div class="field"><label for="rmCalRef">Reference source level (dBm)</label><input id="rmCalRef" type="number" step="0.1" inputmode="decimal" placeholder="e.g. −50 from a signal generator" /></div>
    </div>
    <div class="btns">
      <button class="btn ghost" id="rmCalUseSaved" type="button">Use saved device offset</button>
      <button class="btn ghost" id="rmCalMeasure" type="button">Measure offset from reference</button>
      <button class="btn ghost" id="rmCalNoise" type="button">Noise floor (pre-drive calibration)</button>
      <button class="btn primary" id="rmCalSave" type="button">Confirm calibration</button>
    </div>
    <p class="hint" id="rmCalMsg" aria-live="polite"></p>
  </section>
  <section class="card rmcard" data-page="3" hidden>
    <h2>3 · Scan parameters</h2>
    <div class="grid2">
      <div class="field"><label for="rmProfile">Profile</label><select id="rmProfile"></select></div>
      <div class="btns"><button class="btn ghost small" id="rmProfLoad" type="button">Load</button><button class="btn ghost small" id="rmProfSave" type="button">Save as…</button><button class="btn ghost small" id="rmProfDel" type="button">Delete</button></div>
    </div>
    <h3>Ranges (MHz)</h3>
    <div id="rmRanges"></div>
    <button class="btn ghost small" id="rmAddRange" type="button">+ Add range</button>
    <div class="grid2 rmparams" id="rmParams"></div>
    <div class="rmest" id="rmEst" aria-live="polite"></div>
    <ul class="rmerr" id="rmErrs" aria-live="polite"></ul>
    <div class="btns"><button class="btn primary" type="button" data-go="4">Next</button></div>
  </section>
  <section class="card rmcard" data-page="4" hidden>
    <h2>4 · Run <span class="spacer"></span><span class="lbl" id="rmState">idle</span></h2>
    <ul class="rmerr" id="rmRunErrs"></ul>
    <div class="btns">
      <button class="btn go" id="rmStart" type="button">Start survey</button>
      <button class="btn ghost" id="rmPause" type="button" disabled>Pause</button>
      <button class="btn stop" id="rmStop" type="button" disabled>Stop</button>
      <button class="btn ghost" id="rmSnap" type="button" disabled>Take snapshot</button>
    </div>
    <canvas id="rmMap" class="rmmap" aria-label="Survey track coloured by level"></canvas>
    <div class="rmlegend lbl"><span>weak</span><i></i><span>strong</span> · colour = strongest band in dBm</div>
    <div class="rmstats" id="rmStats"></div>
    <div class="rmbar"><i id="rmBar"></i></div>
    <p class="hint" id="rmLimitMsg" aria-live="polite"></p>
  </section>
  <section class="card" id="rmUploadCard">
    <h2>Upload &amp; storage</h2>
    <div class="grid2">
      <div class="field full"><label for="rmUrl">Upload server URL</label><input id="rmUrl" type="url" inputmode="url" placeholder="https://your-server/api" spellcheck="false" value="${esc(settings.serverUrl)}" /></div>
      <div class="field full"><label for="rmToken">Token (optional)</label><input id="rmToken" type="password" autocomplete="off" value="${esc(settings.token)}" /></div>
      <label class="check"><input id="rmAutoWifi" type="checkbox" ${settings.autoWifi ? "checked" : ""}/> Auto-upload on Wi-Fi</label>
      <label class="check"><input id="rmUnmetered" type="checkbox" ${settings.unmetered ? "checked" : ""}/> This network is unmetered (when Wi-Fi can't be detected, e.g. iOS)</label>
      <div class="field"><label for="rmLimit">On-device limit</label><div class="inline"><input id="rmLimit" type="number" min="0" step="0.1" value="${settings.limitValue}" style="width:90px" /><select id="rmLimitUnit"><option>MB</option><option>GB</option></select></div></div>
      <div class="field"><label for="rmLimitAction">At the limit</label><select id="rmLimitAction"><option value="pause">Pause recording</option><option value="stop">Stop survey</option></select></div>
      <label class="check"><input id="rmWake" type="checkbox" ${settings.wakeLock ? "checked" : ""}/> Keep screen on while surveying</label>
    </div>
    <div class="btns"><button class="btn ghost" id="rmTest" type="button">Test connection</button><button class="btn primary" id="rmUploadNow" type="button">Upload now</button></div>
    <p class="hint" id="rmUpMsg" aria-live="polite"></p>
    <table class="ro-table" id="rmQueue"></table>
    <p class="hint">Uploaded chunks are kept on the phone for 30 days after the server confirms them, then deleted. Data that hasn't been uploaded is never deleted automatically. Chunks are columnar, gzip-compressed and SHA-256 checked; uploads resume where they stopped.</p>
  </section>`;
  bind();
}

const PFIELDS: [keyof SweepParams, string, string, Record<string, string>?][] = [
  ["binKHz", "Bin width / RBW (kHz)", "number"],
  ["fftSize", "FFT size", "select", { 256: "256", 512: "512", 1024: "1024", 2048: "2048" }],
  ["dwellMs", "Dwell per step (ms)", "number"],
  ["repeatS", "Sweep repeat interval (s)", "number"],
  ["detector", "Detector", "select", { peak: "Peak", avg: "Average", rms: "RMS" }],
  ["lnaDb", "LNA gain (dB)", "number"],
  ["vgaDb", "VGA gain (dB)", "number"],
  ["amp", "HackRF amp (+14 dB)", "check"],
  ["bias", "Bias-tee (antenna power)", "check"],
  ["thresholdDb", "Threshold above noise (dB)", "number"],
  ["hysteresisDb", "Hysteresis (dB)", "number"],
  ["distM", "GPS distance gate (m)", "number"],
  ["timeS", "Time gate (s)", "number"],
  ["changeDb", "Change gate (dB)", "number"],
  ["reduction", "Band reduction", "select", { none: "None (all bins)", peakmean: "Peak + mean per range", subbands: "N sub-bands (peak + mean)" }],
  ["subBands", "Sub-bands (N)", "number"],
  ["quantDb", "Quantisation step (dB)", "number"],
  ["snapshotEvery", "Auto snapshots", "select", { off: "Off (button only)", "100m": "Every 100 m", "60s": "Every 60 s" }],
  ["mode", "Moving by", "select", { vehicle: "Vehicle", walking: "Walking", static: "Static" }],
  ["notes", "Weather / notes", "text"],
];

function paramsForm() {
  const box = $("rmParams");
  box.innerHTML = PFIELDS.map(([k, label, kind, opts]) => {
    const v = (params as any)[k];
    if (kind === "check") return `<label class="check"><input type="checkbox" data-p="${k}" ${v ? "checked" : ""}/> ${label}</label>`;
    if (kind === "select") return `<div class="field"><label for="rmp-${k}">${label}</label><select id="rmp-${k}" data-p="${k}">${Object.entries(opts!).map(([o, t]) => `<option value="${o}" ${String(v) === o ? "selected" : ""}>${t}</option>`).join("")}</select></div>`;
    return `<div class="field"><label for="rmp-${k}">${label}</label><input id="rmp-${k}" data-p="${k}" type="${kind}" ${kind === "number" ? 'step="any" inputmode="decimal"' : ""} value="${esc(String(v))}" /></div>`;
  }).join("");
  $("rmRanges").innerHTML = params.ranges
    .map((r, i) => `<div class="inline rmrange"><input type="number" step="any" inputmode="decimal" aria-label="Range ${i + 1} start MHz" data-r="${i}" data-e="startMHz" value="${r.startMHz}" /> – <input type="number" step="any" inputmode="decimal" aria-label="Range ${i + 1} stop MHz" data-r="${i}" data-e="stopMHz" value="${r.stopMHz}" /> MHz ${params.ranges.length > 1 ? `<button class="btn ghost small" type="button" data-rdel="${i}" aria-label="Remove range ${i + 1}">✕</button>` : ""}</div>`)
    .join("");
  const sel = $<HTMLSelectElement>("rmProfile");
  sel.innerHTML = Object.keys(loadProfiles(localStorage)).map((n) => `<option>${esc(n)}</option>`).join("");
  refreshChecks();
}

function readForm() {
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("#rmParams [data-p]").forEach((el) => {
    const k = el.dataset.p as keyof SweepParams;
    const cur = (DEFAULT_PARAMS as any)[k];
    (params as any)[k] = el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : typeof cur === "number" ? Number(el.value) : el.value;
  });
  document.querySelectorAll<HTMLInputElement>("#rmRanges [data-r]").forEach((el) => {
    (params.ranges[Number(el.dataset.r)] as any)[el.dataset.e!] = Number(el.value);
  });
  params.heightM = Number(($("rmHeight") as HTMLInputElement)?.value) || params.heightM;
  save(PARAMS_KEY, params);
}

function calValues(): DbmCalibration | null {
  return cal.confirmed ? cal : null;
}

function refreshChecks() {
  const errs = validateParams(params, host.deviceKind(), calValues());
  const est = estimateBytesPerHour(params);
  const e = $("rmEst");
  if (e) e.innerHTML = `≈ <b>${est.perSample} B</b>/sample · <b>${mb(est.raw)}</b>/h raw · <b>${mb(est.gz)}</b>/h gzip (estimate, ${params.mode})`;
  for (const id of ["rmErrs", "rmRunErrs"]) {
    const ul = $(id);
    if (ul) ul.innerHTML = errs.map((x) => `<li>${esc(x)}</li>`).join("");
  }
  const s = $<HTMLButtonElement>("rmStart");
  if (s) s.disabled = !!run || errs.length > 0;
  const cs = $("rmCalState");
  if (cs) cs.textContent = calibrationComplete(calValues()) ? "✓ calibrated (dBm)" : "required";
  equipTable();
}

function equipTable() {
  const t = $("rmEquip");
  if (!t) return;
  const f = host.fix(), k = host.deviceKind();
  const rows: [string, string][] = [
    ["Receiver", host.deviceLabel()],
    ["Survey mode", k === "hackrf" ? "HackRF sweep (1–6000 MHz)" : k === "rtlsdr" ? "RTL-SDR hopping (24–1766 MHz)" : k === "remote" ? "Remote servers can't sweep" : "—"],
    ["PPM correction", `${host.ppm()} ppm`],
    ["Bias-tee", host.biasTee() ? "on" : "off"],
    ["GPS", f ? `${f.lat.toFixed(5)}, ${f.lon.toFixed(5)}${f.accM ? ` ±${Math.round(f.accM)} m` : ""}` : "no fix yet"],
    ["Compass", host.heading() !== null ? `${Math.round(host.heading()!)}°` : "—"],
  ];
  t.innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${esc(b)}</td></tr>`).join("");
}

function go(n: number) {
  readFormSafe();
  step = n;
  document.querySelectorAll<HTMLElement>("#pane-rm .rmcard").forEach((c) => (c.hidden = Number(c.dataset.page) !== n));
  document.querySelectorAll<HTMLElement>("#pane-rm .rmstep").forEach((b) => b.setAttribute("aria-selected", String(Number(b.dataset.step) === n)));
  refreshChecks();
  if (n === 4) drawMap();
}
function readFormSafe() {
  if (document.getElementById("rmParams")?.children.length) readForm();
}

function calForm() {
  const v = (id: string, x: number | null) => (($(id) as HTMLInputElement).value = x === null || x === undefined ? "" : String(x));
  v("rmCalOffset", cal.offsetDb);
  v("rmCalGain", cal.antennaGainDbi);
  v("rmCalLoss", cal.cableLossDb);
}

function bind() {
  document.querySelectorAll<HTMLElement>("#pane-rm [data-step], #pane-rm [data-go]").forEach((b) => b.addEventListener("click", () => go(Number(b.dataset.step || b.dataset.go))));
  $("rmConnect").addEventListener("click", async () => {
    await host.connect();
    refreshChecks();
  });
  $("rmAntenna").addEventListener("change", (e) => {
    settings.antenna = (e.target as HTMLInputElement).value;
    save(SET_KEY, settings);
  });
  calForm();
  const num = (id: string) => {
    const s = ($(id) as HTMLInputElement).value.trim();
    return s === "" ? null : Number(s);
  };
  for (const id of ["rmCalOffset", "rmCalGain", "rmCalLoss"])
    $(id).addEventListener("input", () => {
      cal.confirmed = false;
      refreshChecks();
    });
  $("rmCalUseSaved").addEventListener("click", () => {
    ($("rmCalOffset") as HTMLInputElement).value = String(host.calOffsetDb());
    $("rmCalMsg").textContent = host.calOffsetDb() === 0 ? "This device has no saved offset (0 dB) — measure one against a reference." : `Loaded ${host.calOffsetDb()} dB from this device's saved calibration${host.serial() ? ` (S/N ${host.serial()})` : ""}.`;
  });
  $("rmCalMeasure").addEventListener("click", () => {
    const ref = num("rmCalRef"), lv = host.levelDbfs();
    if (ref === null || lv === null) {
      $("rmCalMsg").textContent = "Feed a known reference level, start measuring on SA at its frequency, enter the level in dBm, then press Measure.";
      return;
    }
    const off = Math.round((ref - lv) * 10) / 10;
    ($("rmCalOffset") as HTMLInputElement).value = String(off);
    $("rmCalMsg").textContent = `Measured ${lv.toFixed(1)} dBFS at ${(host.tunedHz() / 1e6).toFixed(3)} MHz for a ${ref} dBm reference → offset ${off} dB.`;
  });
  $("rmCalNoise").addEventListener("click", () => host.openNoiseCal());
  $("rmCalSave").addEventListener("click", () => {
    const c: DbmCalibration = { offsetDb: num("rmCalOffset"), antennaGainDbi: num("rmCalGain"), cableLossDb: num("rmCalLoss"), serial: host.serial(), createdAt: Date.now(), method: num("rmCalRef") !== null ? "reference" : "entered" };
    if (!calibrationComplete(c)) {
      $("rmCalMsg").textContent = "Enter the offset, antenna gain and cable loss (0 is a valid value).";
      return;
    }
    cal = { ...c, confirmed: true };
    save(CAL_KEY, cal);
    $("rmCalMsg").textContent = "Calibration confirmed — survey data will be stored and uploaded in dBm.";
    refreshChecks();
  });
  paramsForm();
  $("rmParams").addEventListener("change", () => (readForm(), refreshChecks()));
  $("rmRanges").addEventListener("change", () => (readForm(), refreshChecks()));
  $("rmRanges").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-rdel]");
    if (!b) return;
    readForm();
    params.ranges.splice(Number(b.dataset.rdel), 1);
    paramsForm();
  });
  $("rmAddRange").addEventListener("click", () => {
    readForm();
    params.ranges.push({ startMHz: 400, stopMHz: 470 });
    paramsForm();
  });
  $("rmProfLoad").addEventListener("click", () => {
    const p = loadProfiles(localStorage)[$<HTMLSelectElement>("rmProfile").value];
    if (p) params = JSON.parse(JSON.stringify(p));
    save(PARAMS_KEY, params);
    paramsForm();
  });
  $("rmProfSave").addEventListener("click", () => {
    readForm();
    const name = prompt("Profile name", $<HTMLSelectElement>("rmProfile").value || "My survey");
    if (name) saveProfile(localStorage, name, params);
    paramsForm();
  });
  $("rmProfDel").addEventListener("click", () => {
    deleteProfile(localStorage, $<HTMLSelectElement>("rmProfile").value);
    paramsForm();
  });
  // upload settings
  $<HTMLSelectElement>("rmLimitUnit").value = settings.limitUnit;
  $<HTMLSelectElement>("rmLimitAction").value = settings.limitAction;
  const sync = () => {
    settings = {
      ...settings,
      serverUrl: $<HTMLInputElement>("rmUrl").value.trim(),
      token: $<HTMLInputElement>("rmToken").value,
      autoWifi: $<HTMLInputElement>("rmAutoWifi").checked,
      unmetered: $<HTMLInputElement>("rmUnmetered").checked,
      limitValue: Number($<HTMLInputElement>("rmLimit").value) || 0,
      limitUnit: $<HTMLSelectElement>("rmLimitUnit").value as "MB" | "GB",
      limitAction: $<HTMLSelectElement>("rmLimitAction").value as LimitAction,
      wakeLock: $<HTMLInputElement>("rmWake").checked,
    };
    save(SET_KEY, settings);
    const bad = settings.serverUrl ? validateServerUrl(settings.serverUrl) : null;
    $("rmUpMsg").textContent = bad ?? "";
  };
  $("rmUploadCard").addEventListener("change", sync);
  $("rmTest").addEventListener("click", async () => {
    sync();
    if (!settings.serverUrl) return void ($("rmUpMsg").textContent = "Enter your upload server URL first.");
    $("rmUpMsg").textContent = "Testing…";
    const r = await testConnection({ baseUrl: settings.serverUrl, token: settings.token || undefined }, fetch as any);
    $("rmUpMsg").textContent = r.message;
  });
  $("rmUploadNow").addEventListener("click", () => uploadNow(true));
  $("rmStart").addEventListener("click", () => startRun());
  $("rmStop").addEventListener("click", () => stopRun("stopped"));
  $("rmPause").addEventListener("click", () => (run?.paused ? resume() : pauseRun("paused by you")));
  $("rmSnap").addEventListener("click", () => takeSnapshot("button"));
  go(step);
  refreshQueue();
}

// ═══ run ═══
interface Run {
  key: string;
  params: SweepParams;
  cal: DbmCalibration;
  grids: SweepGrid[];
  proc: ProcessorClient;
  samples: number;
  sweeps: number;
  lastSweepAt: number;
  startedAt: number;
  bytes: number;
  rawBytes: number;
  trail: { lat: number; lon: number; db: number; keep?: boolean }[];
  snapshots: number;
  lastSnapAt: number;
  lastSnapPos: { lat: number; lon: number } | null;
  paused: boolean;
  cpuMs: number;
  sliceMs: number;
  battery: { level: number; charging: boolean } | null;
  skip: boolean;
  wake: any;
  lastSweepSeen: number[];
}
let run: Run | null = null;
const workerUrl = () => {
  try {
    return new URL("survey-worker.js", document.baseURI).href;
  } catch (_) {
    return null;
  }
};

function binsFor(r: { startMHz: number; stopMHz: number }, p: SweepParams) {
  return Math.max(1, Math.min(16384, Math.ceil(((r.stopMHz - r.startMHz) * 1000) / p.binKHz)));
}

async function startRun() {
  readFormSafe();
  const kind = host.deviceKind();
  const errs = validateParams(params, kind, calValues());
  if (errs.length) return refreshChecks();
  const p: SweepParams = JSON.parse(JSON.stringify(params));
  const key = `rm-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  run = {
    key, params: p, cal: { ...cal }, grids: p.ranges.map((r) => new SweepGrid(r.startMHz * 1e6, r.stopMHz * 1e6, binsFor(r, p))),
    proc: new ProcessorClient(workerUrl()), samples: 0, sweeps: 0,
    lastSweepAt: 0, startedAt: Date.now(), bytes: 0, rawBytes: 0, trail: [], snapshots: 0, lastSnapAt: Date.now(), lastSnapPos: null, paused: false, cpuMs: 0, sliceMs: 0,
    battery: null, skip: false, wake: null, lastSweepSeen: p.ranges.map(() => 0),
  };
  const meta = { name: key, unit: "dBm", calibration: run.cal, params: p, device: host.deviceLabel(), startedAt: new Date(run.startedAt).toISOString() };
  await putSurvey({ surveyKey: key, name: key, startedAt: run.startedAt, samples: 0, bytes: 0, meta } as StoredSurvey);
  await run.proc.init({ surveyKey: key, params: p, cal: run.cal });
  host.log(`Survey processing: ${run.proc.usingWorker ? "Web Worker" : "main thread (no Worker support)"}`, "ok");
  try {
    await host.applyGains(p);
    await host.startSweep(p.ranges.map((r) => [r.startMHz, r.stopMHz]), onSlice, p.fftSize);
  } catch (e: any) {
    host.log(`Survey couldn't start the receiver: ${e?.message ?? e}`, "err");
    run = null;
    return refreshChecks();
  }
  if (settings.wakeLock && (navigator as any).wakeLock) run.wake = await (navigator as any).wakeLock.request("screen").catch(() => null);
  (navigator as any).getBattery?.().then((b: any) => {
    const upd = () => run && (run.battery = { level: b.level, charging: b.charging });
    upd();
    b.addEventListener?.("levelchange", upd);
    b.addEventListener?.("chargingchange", upd);
  });
  host.log(`RM survey started: ${p.ranges.map((r) => `${r.startMHz}–${r.stopMHz} MHz`).join(", ")} (dBm, calibrated)`, "ok");
  uiRunState();
}

function onSlice(s: SweepSlice) {
  const r = run;
  if (!r || r.paused) return;
  const t0 = performance.now();
  for (const g of r.grids) if (s.startHz + s.db.length * s.binHz > g.loHz && s.startHz < g.hiHz) g.add(s);
  // a completed sweep = every range wrapped around since the last sample
  const done = r.grids.every((g, i) => g.sweeps > r.lastSweepSeen[i]);
  if (done) {
    r.grids.forEach((g, i) => (r.lastSweepSeen[i] = g.sweeps));
    r.sweeps++;
    const now = Date.now();
    // battery-aware: below 20 % and not charging → every other sweep
    r.skip = !!(r.battery && !r.battery.charging && r.battery.level < 0.2) && !r.skip;
    if (now - r.lastSweepAt >= r.params.repeatS * 1000 && !r.skip) {
      r.lastSweepAt = now;
      void sample(now);
    }
  }
  r.grids.length && (r.sliceMs = r.sliceMs * 0.95 + (performance.now() - t0) * 0.05);
}

function gridCopies(r: Run): Float32Array[] {
  return r.grids.map((g) => g.db.slice());
}

async function sample(now: number) {
  const r = run!;
  const fix = host.fix();
  const t0 = performance.now();
  const res = await r.proc.sample(gridCopies(r), fix, now).catch((e) => (host.log(`Survey processing error: ${e?.message ?? e}`, "err"), null));
  r.cpuMs = r.cpuMs * 0.9 + (performance.now() - t0) * 0.1;
  if (!res || !res.kept || run !== r) return;
  r.samples++;
  if (res.trail) r.trail.push(res.trail);
  if (res.chunk) await storeChunk(r, res.chunk);
  const se = r.params.snapshotEvery;
  if (fix) {
    if (se === "60s" && now - r.lastSnapAt >= 60_000) void takeSnapshot("interval");
    if (se === "100m" && r.lastSnapPos && Math.hypot((fix.lat - r.lastSnapPos.lat) * 111_133, (fix.lon - r.lastSnapPos.lon) * 111_133 * Math.cos((fix.lat * Math.PI) / 180)) >= 100) void takeSnapshot("interval");
    if (!r.lastSnapPos) r.lastSnapPos = { lat: fix.lat, lon: fix.lon };
  }
  scheduleDraw();
}

/** Full-resolution spectrum of every range, stored as its own chunk (reduction "none"). */
async function takeSnapshot(why: "button" | "interval") {
  const r = run;
  if (!r) return;
  const fix = host.fix();
  r.lastSnapAt = Date.now();
  if (fix) r.lastSnapPos = { lat: fix.lat, lon: fix.lon };
  const bins = r.grids.reduce((a, g) => a + g.db.length, 0);
  const c = await r.proc.snapshot(gridCopies(r), fix, Date.now(), r.params.ranges, why);
  await storeChunk(r, c);
  r.snapshots++;
  host.log(`Snapshot saved (${bins} bins, dBm)`, "ok");
  uiRunState();
}

async function storeChunk(r: Run, out: ChunkOut) {
  const lim = limitState(await usedOnDevice(), parseLimit(settings.limitValue, settings.limitUnit), out.bytes.length, settings.limitAction);
  if (lim.atLimit) {
    // never drop data: keep this chunk, then pause/stop recording
    (settings.limitAction === "stop" ? stopRun : pauseRun)(`on-device limit reached (${mb(lim.limitBytes)})`);
  }
  const c: QueuedChunk = { surveyKey: r.key, n: out.n, sha256: out.sha256, bytes: out.bytes, state: "queued", tries: 0, nextAt: 0 };
  await putChunk(c);
  usedCache.v += out.bytes.length;
  r.bytes += out.bytes.length;
  r.rawBytes += out.rawLen;
  const w = $("rmLimitMsg");
  if (w) w.textContent = lim.warn ? `Storage at ${Math.round((100 * lim.usedBytes) / lim.limitBytes)} % of your ${mb(lim.limitBytes)} limit — upload or raise the limit. At the limit the survey will ${settings.limitAction}.` : "";
  void requestBackgroundUpload();
  void maybeAutoUpload();
}

async function flush() {
  const r = run;
  if (!r) return;
  const c = await r.proc.flush();
  if (c) await storeChunk(r, c);
}

let usedCache = { at: 0, v: 0 };
async function usedOnDevice() {
  if (Date.now() - usedCache.at > 5000) usedCache = { at: Date.now(), v: (await allChunks()).reduce((a, c) => a + c.bytes.byteLength, 0) };
  return usedCache.v;
}

function pauseRun(why: string) {
  if (!run) return;
  run.paused = true;
  host.log(`Survey paused: ${why}`, "warn");
  uiRunState(why);
}
function resume() {
  if (!run) return;
  run.paused = false;
  uiRunState();
}
async function stopRun(why: string) {
  const r = run;
  if (!r) return;
  await host.stopSweep();
  await flush();
  r.proc.terminate();
  r.wake?.release?.();
  run = null;
  await putSurvey({ surveyKey: r.key, name: r.key, startedAt: r.startedAt, endedAt: Date.now(), samples: r.samples, bytes: r.bytes, completed: true, meta: { unit: "dBm", calibration: r.cal, params: r.params, device: host.deviceLabel() } } as StoredSurvey);
  host.log(`Survey ${why}: ${r.samples} samples, ${r.snapshots} snapshots, ${mb(r.bytes)} stored`, "ok");
  uiRunState();
  refreshQueue();
}

function uiRunState(msg = "") {
  const r = run;
  const b = (id: string) => $<HTMLButtonElement>(id);
  if (!b("rmStart")) return;
  b("rmPause").disabled = b("rmStop").disabled = b("rmSnap").disabled = !r;
  b("rmPause").textContent = r?.paused ? "Resume" : "Pause";
  $("rmState").textContent = !r ? "idle" : r.paused ? `paused${msg ? " — " + msg : ""}` : "recording";
  refreshChecks();
  stats();
}

function stats() {
  const r = run, el = $("rmStats");
  if (!el) return;
  if (!r) return void (el.innerHTML = "");
  const mins = (Date.now() - r.startedAt) / 60000;
  const lim = parseLimit(settings.limitValue, settings.limitUnit);
  const used = usedCache.v;
  el.innerHTML = [
    ["Elapsed", `${Math.floor(mins)} min`],
    ["Sweeps", String(r.sweeps)],
    ["Samples kept", String(r.samples)],
    ["Snapshots", String(r.snapshots)],
    ["This survey", `${mb(r.bytes)} (raw ${mb(r.rawBytes)})`],
    ["On device", `${mb(used)}${lim ? ` / ${mb(lim)}` : ""}`],
    ["Rate", mins > 0.5 ? `${mb(r.bytes / (mins / 60))}/h` : "—"],
    ["Battery", r.battery ? `${Math.round(r.battery.level * 100)} %${r.battery.charging ? " ⚡" : r.battery.level < 0.2 ? " (half rate)" : ""}` : "—"],
    ["CPU", `${r.sliceMs.toFixed(2)} ms/slice · ${r.cpuMs.toFixed(1)} ms/sample${r.proc.usingWorker ? " (worker)" : ""}`],
  ].map(([a, v]) => `<div><small>${a}</small><b>${v}</b></div>`).join("");
  const bar = $("rmBar");
  if (bar) {
    bar.style.width = `${lim ? Math.min(100, (100 * used) / lim) : 0}%`;
    bar.className = lim && used >= 0.9 * lim ? "warn" : "";
  }
}

// ── map (canvas, throttled, paused when hidden) ──
let drawPending = false, lastDraw = 0;
function scheduleDraw() {
  if (drawPending || document.hidden) return;
  drawPending = true;
  const wait = Math.max(0, 1000 - (performance.now() - lastDraw));
  setTimeout(() => requestAnimationFrame(() => (drawPending = false, (lastDraw = performance.now()), drawMap(), stats())), wait);
}
function colour(db: number, lo: number, hi: number) {
  if (!Number.isFinite(db)) return "#475569";
  const x = Math.max(0, Math.min(1, (db - lo) / Math.max(1, hi - lo)));
  return `hsl(${240 - 240 * x} 85% 55%)`;
}
function drawMap() {
  const c = document.getElementById("rmMap") as HTMLCanvasElement | null;
  if (!c || c.offsetParent === null) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = c.clientWidth * dpr, H = c.clientHeight * dpr;
  if (c.width !== W || c.height !== H) (c.width = W), (c.height = H);
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  const tr = run?.trail ?? [];
  if (!tr.length) {
    ctx.fillStyle = "#93a4bf";
    ctx.font = `${12 * dpr}px system-ui`;
    ctx.fillText(run ? "Waiting for GPS fix and the first sweep…" : "Track appears here while the survey runs", 12 * dpr, 24 * dpr);
    return;
  }
  const keep = simplify(tr, 1); // Douglas–Peucker on the display trail; measured points are kept
  const pts = keep.map((i) => tr[i]);
  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  const la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lons), lo1 = Math.max(...lons);
  const k = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
  const sx = (W - 24 * dpr) / Math.max(1e-6, (lo1 - lo0) * k), sy = (H - 24 * dpr) / Math.max(1e-6, la1 - la0), s = Math.min(sx, sy);
  const X = (lon: number) => 12 * dpr + (lon - lo0) * k * s, Y = (lat: number) => H - 12 * dpr - (lat - la0) * s;
  const dbs = pts.map((p) => p.db).filter(Number.isFinite);
  const lo = dbs.length ? Math.min(...dbs) : -120, hi = dbs.length ? Math.max(...dbs) : -40;
  ctx.lineWidth = 2 * dpr;
  for (let i = 1; i < pts.length; i++) {
    ctx.strokeStyle = colour(pts[i].db, lo, hi);
    ctx.beginPath();
    ctx.moveTo(X(pts[i - 1].lon), Y(pts[i - 1].lat));
    ctx.lineTo(X(pts[i].lon), Y(pts[i].lat));
    ctx.stroke();
  }
  for (const p of pts) {
    ctx.fillStyle = colour(p.db, lo, hi);
    ctx.beginPath();
    ctx.arc(X(p.lon), Y(p.lat), 3 * dpr, 0, 7);
    ctx.fill();
  }
}

// ═══ upload ═══
let uploading = false;
async function requestBackgroundUpload() {}
async function maybeAutoUpload() {
  if (!settings.autoWifi || !settings.serverUrl) return;
  const net = onUnmeteredNetwork(navigator, settings.unmetered);
  if (net.unmetered && navigator.onLine !== false) await uploadNow(false);
}
async function uploadNow(manual: boolean) {
  if (uploading) return;
  const bad = settings.serverUrl ? validateServerUrl(settings.serverUrl) : "Enter your upload server URL first.";
  if (bad) return void (manual && ($("rmUpMsg").textContent = bad));
  uploading = true;
  try {
    const chunks = (await allChunks()).filter((c) => c.state !== "acked");
    const surveys = new Map((await allSurveys()).map((s) => [s.surveyKey, s]));
    const q = new UploadQueue({ baseUrl: settings.serverUrl, token: settings.token || undefined }, fetch as any, surveys as any, chunks, async () => {
      for (const c of chunks) await putChunk(c);
      for (const s of surveys.values()) await putSurvey(s);
    });
    const res = await q.run();
    for (const s of surveys.values()) if (s.completed && chunks.filter((c) => c.surveyKey === s.surveyKey).every((c) => c.state === "acked") && s.remoteId) await q.complete(s.surveyKey, { samples: s.samples, bytes: s.bytes }).catch(() => false);
    if (manual || res.sent || res.failed) $("rmUpMsg").textContent = `Uploaded ${res.sent} chunk(s)${res.failed ? `, ${res.failed} failed (will retry with back-off)` : ""}.`;
  } catch (e: any) {
    if (manual) $("rmUpMsg").textContent = `Upload failed: ${e?.message ?? e}`;
  } finally {
    uploading = false;
    await applyRetention();
    refreshQueue();
  }
}
async function applyRetention() {
  const all = await allChunks();
  const dead = new Set(expiredChunks(all.map((c) => ({ key: `${c.surveyKey}|${c.n}`, bytes: c.bytes.byteLength, ackedAt: c.ackedAt })), Date.now()));
  for (const c of all) if (dead.has(`${c.surveyKey}|${c.n}`)) await deleteChunk(c.surveyKey, c.n);
}
async function refreshQueue() {
  const t = $("rmQueue");
  if (!t) return;
  const all = await allChunks();
  const by = new Map<string, { n: number; acked: number; bytes: number; failed: number }>();
  for (const c of all) {
    const b = by.get(c.surveyKey) ?? { n: 0, acked: 0, bytes: 0, failed: 0 };
    b.n++;
    b.bytes += c.bytes.byteLength;
    if (c.state === "acked") b.acked++;
    if (c.state === "failed") b.failed++;
    by.set(c.surveyKey, b);
  }
  usedCache = { at: Date.now(), v: all.reduce((a, c) => a + c.bytes.byteLength, 0) };
  t.innerHTML = by.size
    ? `<tr><th>Survey</th><th>Chunks</th><th>Size</th></tr>` + [...by].map(([k, b]) => `<tr><td>${esc(k.replace(/^rm-/, ""))}</td><td>${b.acked}/${b.n} uploaded${b.failed ? ` · ${b.failed} retrying` : ""}</td><td>${mb(b.bytes)}</td></tr>`).join("")
    : `<tr><td>No survey data on this device yet.</td></tr>`;
}

/** Decodes a stored chunk (debug/export helper). */
export async function readChunk(bytes: Uint8Array) {
  return decodeChunk(await gunzip(bytes));
}

export function initSurvey(h: SurveyHost) {
  host = h;
  render();
  window.addEventListener("webrx:tab", (e) => {
    if ((e as CustomEvent).detail === "rm") (refreshChecks(), drawMap());
  });
  window.addEventListener("online", () => void maybeAutoUpload());
  (navigator as any).connection?.addEventListener?.("change", () => void maybeAutoUpload());
  document.addEventListener("visibilitychange", () => !document.hidden && scheduleDraw());
  setInterval(() => run && stats(), 2000);
  setInterval(() => document.getElementById("pane-rm")?.hidden === false && !run && refreshChecks(), 3000);
  void applyRetention().then(refreshQueue).catch(() => {});
}
