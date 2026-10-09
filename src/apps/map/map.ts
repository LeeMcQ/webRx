// MMN Map Visualizer — opens signal-level recordings as a heatmap, pins
// coloured by level (the thesis scatter map), an interpolated coverage estimate
// (natural neighbour, as in the thesis) or a transmitter location estimate,
// with the calibrated noise-floor threshold applied (thesis §4.3.4) and the
// licensed-vs-measured coverage comparison of §4.3.5.
// Recordings come from the Monitor (saved on this device), from CSV files
// (picker, drag & drop, desktop "Open with"), or shared from other Android apps.

import L from "../../ui/leaflet-global.js";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";
import { MapPoint, Measure, ParsedFile, parseMeasurementCsv } from "./parse.js";
import {
  canShareFiles,
  csvFileName,
  deleteSession,
  deliverCsv,
  getSession,
  listSessions,
  notifyRecordings,
  onRecordingsChanged,
  takeInbox,
  toCsv,
} from "../../storage/recordings.js";
import { gps } from "../../gps/gps.js";
import { inverseDistance, jet, jetCss, jetGradient, makeGrid, naturalNeighbour } from "./interp.js";
import { compareCoverage, compassName, parseSite } from "./licence.js";
import { canInstallApp, onInstallAvailabilityChange, promptInstallApp } from "../../ui/install.js";

type View = "heat" | "route" | "coverage" | "source";
type Dataset = { id: string; name: string; kind: "file" | "session"; sessionId?: string; parsed: ParsedFile; visible: boolean };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const PREFS_KEY = "webrx.map.prefs";

// ── state ──────────────────────────────────────────────────────

const datasets: Dataset[] = [];
let measures: Measure[] = [];
let units = "dB";
let view: View = "heat";
let lo = -100;
let hi = 0;
let dataMin = -100;
let dataMax = 0;
let fittedOnce = false;
let manualRange = false;
let nextFileIndex = 0;

const prefs = loadPrefs();

function loadPrefs() {
  const d = {
    view: "heat" as View,
    measure: "",
    colourMode: "gradient",
    heatRadius: 25,
    grid: 60,
    reach: 200,
    topPct: 25,
    nf: "above" as "above" | "all" | "below",
    nfFloor: null as number | null,
    nfGuard: 5,
    method: "nn" as "nn" | "idw",
    joinRoute: false,
  };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch (_) {
    return d;
  }
}
function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {}
}

// ── map ────────────────────────────────────────────────────────

const street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
});
const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 19,
  attribution: "Imagery &copy; Esri",
});
const map = L.map($("map"), { preferCanvas: true, layers: [street] }).setView([-33.46, 18.72], 9);
L.control.layers({ Map: street, Satellite: satellite }, undefined, { position: "topleft" }).addTo(map);
L.control.scale({ metric: true, imperial: false }).addTo(map);
const dataLayer = L.layerGroup().addTo(map);
let heatLayer: L.Layer | null = null;
new ResizeObserver(() => map.invalidateSize()).observe($("map"));

// ── colours ────────────────────────────────────────────────────

/** MATLAB jet scale, as on the thesis maps. */
function gradient(t: number): string {
  return jetCss(t);
}
function classic(v: number): string {
  return v > -35 ? "#ff0000" : v > -40 ? "#ffaa00" : v > -45 ? "#00cc00" : "#0099ff";
}
function colourFor(v: number): string {
  return prefs.colourMode === "classic" && view === "route" ? classic(v) : gradient((v - lo) / Math.max(1e-6, hi - lo));
}

// ── data ───────────────────────────────────────────────────────

function addDataset(name: string, text: string, kind: Dataset["kind"], sessionId?: string): Dataset {
  // Re-opening the same file or recording replaces it in place (keeps its on/off state).
  const existing = datasets.find((d) => (sessionId && d.sessionId === sessionId) || (!sessionId && d.kind === "file" && d.name === name));
  const parsed = parseMeasurementCsv(text, name, nextFileIndex++);
  if (existing) {
    existing.parsed = parsed;
    existing.name = name;
    rebuildMeasures();
    return existing;
  }
  const ds: Dataset = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, kind, sessionId, parsed, visible: true };
  datasets.push(ds);
  rebuildMeasures();
  return ds;
}

function removeDataset(id: string, rerender = true) {
  const i = datasets.findIndex((d) => d.id === id);
  if (i >= 0) datasets.splice(i, 1);
  rebuildMeasures();
  if (rerender) refreshAll(false);
}

function rebuildMeasures() {
  const seen = new Map<string, Measure>();
  for (const d of datasets) for (const m of d.parsed.measures) if (!seen.has(m.key)) seen.set(m.key, m);
  measures = [...seen.values()];
  const sel = $<HTMLSelectElement>("measure");
  sel.innerHTML = "";
  for (const m of measures) {
    const o = document.createElement("option");
    o.value = m.key;
    o.textContent = m.label;
    sel.appendChild(o);
  }
  // Prefer the saved choice, then "band mean level" (the recorder's main figure).
  const want = measures.find((m) => m.key === prefs.measure) ?? measures.find((m) => /band_mean/.test(m.key)) ?? measures[0];
  if (want) sel.value = want.key;

  fillSelect("freqFilter", "freqField", "All frequencies", allPoints().map((p) => p.freqHz).filter((f): f is number => f !== undefined), (f) =>
    `${(f / 1e6).toLocaleString(undefined, { maximumFractionDigits: 3 })} MHz`
  );
  fillSelect("deviceFilter", "deviceField", "All devices", allPoints().map((p) => p.device).filter((d): d is string => !!d), (d) => d);
}

function fillSelect<T extends string | number>(id: string, fieldId: string, allLabel: string, values: T[], label: (v: T) => string) {
  const sel = $<HTMLSelectElement>(id);
  const prev = sel.value;
  const distinct = [...new Set(values)].sort((a, b) => (a < b ? -1 : 1));
  sel.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = allLabel;
  sel.appendChild(all);
  for (const v of distinct) {
    const o = document.createElement("option");
    o.value = String(v);
    o.textContent = label(v);
    sel.appendChild(o);
  }
  sel.value = distinct.map(String).includes(prev) ? prev : "";
  $(fieldId).hidden = distinct.length < 2;
}

function allPoints(): MapPoint[] {
  return datasets.filter((d) => d.visible).flatMap((d) => d.parsed.points);
}

function measureKey(): string {
  return $<HTMLSelectElement>("measure").value;
}

/** Units of the files that carry the selected measurement. */
function updateUnits() {
  const key = measureKey();
  const u = new Set(
    datasets.filter((d) => d.visible && d.parsed.measures.some((m) => m.key === key) && d.parsed.points.length).map((d) => d.parsed.units)
  );
  units = u.size === 1 ? [...u][0] : u.size ? "dB (mixed units)" : "dB";
}

/** Points that pass the frequency/device filters and have the chosen measurement. */
function candidates(): MapPoint[] {
  const key = measureKey();
  const f = $<HTMLSelectElement>("freqFilter").value;
  const dev = $<HTMLSelectElement>("deviceFilter").value;
  return allPoints().filter(
    (p) => Number.isFinite(p.values[key]) && (!f || String(p.freqHz) === f) && (!dev || p.device === dev)
  );
}

/** Threshold entered by hand for files recorded without a calibration. */
function manualThreshold(): number | undefined {
  return prefs.nfFloor !== null && Number.isFinite(prefs.nfFloor) ? prefs.nfFloor + (Number(prefs.nfGuard) || 0) : undefined;
}

/** Above the noise-floor threshold? undefined when neither a calibration nor a manual threshold applies. */
function verdict(p: MapPoint): boolean | undefined {
  if (p.above !== undefined) return p.above;
  if (p.threshold !== undefined) {
    const v = p.values.band_mean_level_db ?? p.values[measureKey()];
    return Number.isFinite(v) ? v >= p.threshold : undefined;
  }
  const thr = manualThreshold();
  if (thr === undefined) return undefined;
  const v = p.values[measureKey()];
  return Number.isFinite(v) ? v >= thr : undefined;
}

function passesNoiseFloor(p: MapPoint): boolean {
  if (prefs.nf === "all") return true;
  const a = verdict(p);
  return prefs.nf === "above" ? a !== false : a === false;
}

function shown(): MapPoint[] {
  const key = measureKey();
  return candidates().filter((p) => p.values[key] >= lo && p.values[key] <= hi && passesNoiseFloor(p));
}

function autoRange() {
  updateUnits();
  const key = measureKey();
  // Scale the colours to what's plotted (e.g. only the pins above the noise floor).
  let vals = candidates().filter(passesNoiseFloor).map((p) => p.values[key]);
  if (!vals.length) vals = candidates().map((p) => p.values[key]);
  if (!vals.length) return;
  dataMin = Math.floor(Math.min(...vals));
  dataMax = Math.ceil(Math.max(...vals));
  if (dataMax - dataMin < 1) {
    dataMin -= 1;
    dataMax += 1;
  }
  lo = dataMin;
  hi = dataMax;
  manualRange = false;
  syncRangeInputs();
}

function syncRangeInputs() {
  for (const id of ["lo", "hi"]) {
    const el = $<HTMLInputElement>(id);
    el.min = String(dataMin - 10);
    el.max = String(dataMax + 10);
  }
  $<HTMLInputElement>("lo").value = String(lo);
  $<HTMLInputElement>("hi").value = String(hi);
  $("rangeText").textContent = `${lo.toFixed(1)} to ${hi.toFixed(1)} ${units}`;
  $("unitsText").textContent = `Data: ${dataMin} to ${dataMax} ${units}`;
}

// ── geometry ───────────────────────────────────────────────────

function projector(points: { lat: number; lon: number }[]) {
  const lat0 = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const lon0 = points.reduce((a, p) => a + p.lon, 0) / points.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  return {
    x: (lon: number) => (lon - lon0) * kx,
    y: (lat: number) => (lat - lat0) * ky,
    lon: (x: number) => lon0 + x / kx,
    lat: (y: number) => lat0 + y / ky,
  };
}

function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  return L.latLng(a.lat, a.lon).distanceTo(L.latLng(b.lat, b.lon));
}

// ── rendering ──────────────────────────────────────────────────

function clearLayers() {
  dataLayer.clearLayers();
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }
}

function popupHtml(p: MapPoint): string {
  const ds = datasets.find((d) => d.parsed.points.includes(p));
  const vals = Object.entries(p.values)
    .map(([k, v]) => `${measures.find((m) => m.key === k)?.label ?? k}: <b>${v.toFixed(1)}</b>`)
    .join("<br>");
  const extra = [
    p.t !== undefined ? new Date(p.t).toLocaleString() : "",
    p.freqHz ? `${(p.freqHz / 1e6).toFixed(3)} MHz` : "",
    p.device ?? "",
    p.accuracyM !== undefined ? `GPS ±${p.accuracyM.toFixed(0)} m` : "",
    p.spacingM !== undefined ? `${p.spacingM.toFixed(1)} m from the previous pin` : "",
    p.samples !== undefined ? `${p.samples} spectra averaged` : "",
    ds ? `${ds.name} · row ${p.row}` : "",
  ]
    .filter(Boolean)
    .join("<br>");
  const a = verdict(p);
  const thr = p.threshold ?? manualThreshold();
  const nf =
    a === undefined
      ? ""
      : `<br><span style="color:${a ? "#4ade80" : "#94a3b8"}">${a ? "Above" : "Below"} the noise-floor threshold (${thr?.toFixed(1)})</span>`;
  return `${vals}${nf}<br><span style="color:#8a9bb5">${extra}<br>${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</span>`;
}

function render() {
  clearLayers();
  const key = measureKey();
  const pts = shown();
  $("sourceResult").textContent = "";
  updateLegend(pts.length > 0);
  updateNoiseFloorInfo();
  drawTimeline();
  renderTx();
  if (!pts.length) {
    status(
      !datasets.length
        ? "Open a recording to begin"
        : prefs.nf === "below"
          ? "No pins below the noise floor"
          : candidates().length
            ? "No pins in this range — try Auto range or All pins"
            : "No points in this range — try Auto range"
    );
    updateSummary(pts);
    return;
  }
  const span = Math.max(1e-6, hi - lo);
  if (view === "heat") {
    const data = pts.map((p) => [p.lat, p.lon, Math.max(0.05, (p.values[key] - lo) / span)]);
    heatLayer = (L as any)
      .heatLayer(data, {
        radius: prefs.heatRadius,
        blur: Math.round(prefs.heatRadius * 0.6),
        max: 1,
        minOpacity: 0.35,
        gradient: { 0: "#000080", 0.15: "#0000ff", 0.35: "#00ffff", 0.6: "#ffff00", 0.85: "#ff0000", 1: "#800000" },
      })
      .addTo(map);
    status(`${pts.length} points · heatmap`);
  } else if (view === "route") {
    drawRoute(pts, key);
    status(`${pts.length} pins`);
  } else if (view === "coverage") {
    drawCoverage(pts, key);
  } else {
    drawSource(pts, key);
  }
  // Say so when other files are hidden because they don't have this measurement.
  const missing = allPoints().length - candidates().length;
  const filtered = $<HTMLSelectElement>("freqFilter").value || $<HTMLSelectElement>("deviceFilter").value;
  if (missing > 0 && !filtered) {
    status(`${$("status").textContent} · ${missing} other points have no “${measures.find((m) => m.key === key)?.label ?? key}”`);
  }
  const hiddenBelow = prefs.nf === "above" ? candidates().filter((p) => verdict(p) === false).length : 0;
  if (hiddenBelow) status(`${$("status").textContent} · ${hiddenBelow} below the noise floor hidden`);
  updateSummary(pts);
}

function drawRoute(pts: MapPoint[], key: string) {
  if (prefs.joinRoute) drawRouteLines(pts, key);
  for (const p of pts) {
    L.circleMarker([p.lat, p.lon], { radius: 6, color: "#0b1220", weight: 1.2, fillColor: colourFor(p.values[key]), fillOpacity: 0.95 })
      .bindPopup(() => popupHtml(p))
      .addTo(dataLayer);
  }
}

function drawRouteLines(pts: MapPoint[], key: string) {
  const byFile = new Map<number, MapPoint[]>();
  for (const p of pts) {
    if (!byFile.has(p.file)) byFile.set(p.file, []);
    byFile.get(p.file)!.push(p);
  }
  for (const seq of byFile.values()) {
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1];
      const b = seq[i];
      const gapT = a.t !== undefined && b.t !== undefined ? Math.abs(b.t - a.t) : 0;
      if (metres(a, b) > 500 || gapT > 5 * 60 * 1000) continue; // don't join across gaps
      L.polyline(
        [
          [a.lat, a.lon],
          [b.lat, b.lon],
        ],
        { color: colourFor(b.values[key]), weight: 4, opacity: 0.6, interactive: false }
      ).addTo(dataLayer);
    }
  }
}

function drawCoverage(pts: MapPoint[], key: string) {
  const n = Number(prefs.grid) || 60;
  const reach = Number(prefs.reach) || 200;
  const P = projector(pts);
  const xy = pts.map((p) => ({ x: P.x(p.lon), y: P.y(p.lat), v: p.values[key] }));
  const t0 = performance.now();
  const g0 = makeGrid(xy, n, reach * 0.5);
  const grid = prefs.method === "idw" ? inverseDistance(xy, g0, reach) : naturalNeighbour(xy, g0, reach);
  const ms = Math.round(performance.now() - t0);
  // Paint the grid into an image (north up) and lay it over the map.
  const cv = document.createElement("canvas");
  cv.width = grid.nx;
  cv.height = grid.ny;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(grid.nx, grid.ny);
  const span = Math.max(1e-6, hi - lo);
  let cells = 0;
  for (let j = 0; j < grid.ny; j++)
    for (let i = 0; i < grid.nx; i++) {
      const v = grid.values[j * grid.nx + i];
      if (!Number.isFinite(v)) continue;
      const [r, g, b] = jet((v - lo) / span);
      const o = ((grid.ny - 1 - j) * grid.nx + i) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
      cells++;
    }
  ctx.putImageData(img, 0, 0);
  const bounds = L.latLngBounds(
    [P.lat(grid.y0), P.lon(grid.x0)],
    [P.lat(grid.y0 + grid.ny * grid.cell), P.lon(grid.x0 + grid.nx * grid.cell)]
  );
  L.imageOverlay(cv.toDataURL(), bounds, { opacity: 0.6, interactive: false, className: "smooth" }).addTo(dataLayer);
  for (const p of pts) {
    L.circleMarker([p.lat, p.lon], { radius: 2.5, stroke: false, fillColor: "#e2e8f0", fillOpacity: 0.9 }).bindPopup(() => popupHtml(p)).addTo(dataLayer);
  }
  status(
    `${prefs.method === "idw" ? "Inverse distance" : "Natural neighbour"} · ${cells} cells of ${Math.round(grid.cell)} m from ${pts.length} pins · ${ms} ms`
  );
}

function drawSource(pts: MapPoint[], key: string) {
  const sorted = [...pts].sort((a, b) => b.values[key] - a.values[key]);
  const take = Math.max(Math.min(5, sorted.length), Math.round((sorted.length * prefs.topPct) / 100));
  const use = sorted.slice(0, take);
  const vmax = use[0].values[key];
  const P = projector(use);
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (const p of use) {
    const w = Math.pow(10, (p.values[key] - vmax) / 10); // linear power, relative to the strongest
    sw += w;
    sx += w * P.x(p.lon);
    sy += w * P.y(p.lat);
  }
  const ex = sx / sw;
  const ey = sy / sw;
  let sv = 0;
  for (const p of use) {
    const w = Math.pow(10, (p.values[key] - vmax) / 10);
    sv += w * ((P.x(p.lon) - ex) ** 2 + (P.y(p.lat) - ey) ** 2);
  }
  const radius = Math.max(25, 2 * Math.sqrt(sv / sw));
  const est = L.latLng(P.lat(ey), P.lon(ex));
  for (const p of pts) {
    const isUsed = use.includes(p);
    L.circleMarker([p.lat, p.lon], {
      radius: isUsed ? 6 : 3.5,
      color: "#0b1220",
      weight: 1,
      fillColor: colourFor(p.values[key]),
      fillOpacity: isUsed ? 0.95 : 0.4,
    })
      .bindPopup(() => popupHtml(p))
      .addTo(dataLayer);
  }
  L.circle(est, { radius, color: "#ef4444", weight: 2, fillColor: "#ef4444", fillOpacity: 0.12 }).addTo(dataLayer);
  const best = sorted[0];
  L.circleMarker([best.lat, best.lon], { radius: 10, color: "#fbbf24", weight: 3, fill: false })
    .bindPopup(`<b>Strongest measurement</b><br>${popupHtml(best)}`)
    .addTo(dataLayer);
  L.marker(est, { icon: L.divIcon({ className: "pin", html: "📡", iconSize: [32, 32], iconAnchor: [16, 28] }) })
    .bindPopup(
      `<b>Estimated source</b><br>${est.lat.toFixed(6)}, ${est.lng.toFixed(6)}<br>Uncertainty ≈ ±${Math.round(radius)} m<br>` +
        `From the strongest ${use.length} of ${pts.length} points (power-weighted centre).<br>` +
        `<span style="color:#8a9bb5">Strongest reading ${best.values[key].toFixed(1)} ${units} at ${Math.round(metres(best, { lat: est.lat, lon: est.lng }))} m from the estimate.</span>`
    )
    .addTo(dataLayer);
  $("sourceResult").innerHTML = `📡 <b>${est.lat.toFixed(5)}, ${est.lng.toFixed(5)}</b> · ±${Math.round(radius)} m (strongest ${use.length} points)`;
  status(`Source estimate · ±${Math.round(radius)} m`);
}

function updateLegend(show: boolean) {
  const lg = $("legend");
  lg.hidden = !show;
  if (!show) return;
  const m = measures.find((x) => x.key === measureKey());
  const classicMode = prefs.colourMode === "classic" && view === "route";
  (lg.querySelector(".bar") as HTMLElement).style.background = classicMode
    ? "linear-gradient(90deg, #0099ff 0 25%, #00cc00 25% 50%, #ffaa00 50% 75%, #ff0000 75%)"
    : jetGradient();
  $("legendTitle").textContent = `${m?.label ?? "Level"}${classicMode ? " · classic steps" : ""}`;
  $("legendLo").textContent = classicMode ? "≤ −45" : `${lo.toFixed(1)} ${units}`;
  $("legendHi").textContent = classicMode ? "> −35 dBm" : `${hi.toFixed(1)} ${units}`;
}

function status(text: string) {
  $("status").textContent = text;
}

function updateSummary(pts: MapPoint[]) {
  const key = measureKey();
  const vals = pts.map((p) => p.values[key]);
  const times = pts.map((p) => p.t).filter((t): t is number => t !== undefined);
  let dist = 0;
  const byFile = new Map<number, MapPoint[]>();
  for (const p of pts) (byFile.get(p.file) ?? byFile.set(p.file, []).get(p.file)!).push(p);
  for (const seq of byFile.values()) for (let i = 1; i < seq.length; i++) {
    const d = metres(seq[i - 1], seq[i]);
    if (d < 500) dist += d;
  }
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
  const rows: [string, string][] = [
    ["Points shown", `${pts.length} of ${candidates().length}`],
    ["Above noise floor", aboveText()],
    ["Files", String(datasets.filter((d) => d.visible).length)],
    ["Minimum", vals.length ? `${Math.min(...vals).toFixed(1)} ${units}` : "—"],
    ["Mean", vals.length ? `${mean.toFixed(1)} ${units}` : "—"],
    ["Maximum", vals.length ? `${Math.max(...vals).toFixed(1)} ${units}` : "—"],
    ["Route length", dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`],
    ["Time span", times.length ? `${new Date(Math.min(...times)).toLocaleString()} – ${new Date(Math.max(...times)).toLocaleTimeString()}` : "—"],
  ];
  $("summary").innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
  const total = allPoints().length;
  $("chipPoints").textContent = `${total} point${total === 1 ? "" : "s"} · ${datasets.length} file${datasets.length === 1 ? "" : "s"}`;
}

function aboveText(): string {
  const c = candidates();
  const known = c.filter((p) => verdict(p) !== undefined);
  if (!known.length) return "no threshold";
  const up = known.filter((p) => verdict(p)).length;
  return `${up} of ${known.length} (${Math.round((up / known.length) * 100)}%)`;
}

/** Explains which threshold applies, and the storage saving of keeping only pins above it (§4.3.4). */
function updateNoiseFloorInfo() {
  document.querySelectorAll<HTMLButtonElement>("[data-nf]").forEach((b) => b.classList.toggle("on", b.dataset.nf === prefs.nf));
  const m = manualThreshold();
  $("nfThr").textContent = m !== undefined ? `${m.toFixed(1)} ${units}` : "—";
  const c = candidates();
  const calibrated = c.filter((p) => p.threshold !== undefined);
  const thresholds = [...new Set(calibrated.map((p) => p.threshold!.toFixed(1)))];
  const known = c.filter((p) => verdict(p) !== undefined);
  const below = known.filter((p) => verdict(p) === false).length;
  const parts: string[] = [];
  if (calibrated.length) {
    const nf = calibrated.find((p) => p.noiseFloor !== undefined)?.noiseFloor;
    parts.push(
      `${calibrated.length} pins carry a calibration: threshold ${thresholds.length === 1 ? thresholds[0] : thresholds.join(" / ")} ${units}` +
        (nf !== undefined && thresholds.length === 1 ? ` (noise floor ${nf.toFixed(1)} + ${(Number(thresholds[0]) - nf).toFixed(1)} dB)` : "") +
        "."
    );
  }
  const uncal = c.length - calibrated.length;
  if (uncal) parts.push(m !== undefined ? `${uncal} pins without a calibration use ${m.toFixed(1)} ${units}.` : `${uncal} pins have no calibration — enter their noise floor above to filter them.`);
  if (known.length) parts.push(`${below} of ${known.length} pins (${Math.round((below / known.length) * 100)}%) are below the threshold — keeping only those above saves that much storage.`);
  $("nfInfo").textContent = parts.join(" ");
}

// ── timeline (thesis Data Viewer, Appendix A-4) ─────────────────

let timelinePts: { p: MapPoint; x: number }[] = [];

function drawTimeline() {
  const cv = $<HTMLCanvasElement>("timeline");
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(1, Math.round(cv.clientWidth * dpr));
  const H = Math.max(1, Math.round(cv.clientHeight * dpr));
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  const key = measureKey();
  const pts = candidates().filter((p) => p.values[key] >= lo && p.values[key] <= hi);
  timelinePts = [];
  ctx.font = `${10 * dpr}px ui-monospace, monospace`;
  if (pts.length < 2) {
    ctx.fillStyle = "#64748b";
    ctx.fillText("Level over time appears here", 8 * dpr, 18 * dpr);
    return;
  }
  const timed = pts.every((p) => p.t !== undefined);
  const xs = timed ? pts.map((p) => p.t!) : pts.map((_, i) => i);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const left = 34 * dpr;
  const bottom = 14 * dpr;
  const pw = W - left - 6 * dpr;
  const ph = H - bottom - 6 * dpr;
  const X = (v: number) => left + ((v - x0) / Math.max(1e-9, x1 - x0)) * pw;
  const Y = (v: number) => 6 * dpr + (1 - (v - lo) / Math.max(1e-6, hi - lo)) * ph;
  ctx.strokeStyle = "rgba(148,163,184,0.15)";
  ctx.fillStyle = "#64748b";
  for (let k = 0; k <= 4; k++) {
    const v = lo + ((hi - lo) * k) / 4;
    ctx.beginPath();
    ctx.moveTo(left, Math.round(Y(v)) + 0.5);
    ctx.lineTo(left + pw, Math.round(Y(v)) + 0.5);
    ctx.stroke();
    ctx.fillText(v.toFixed(0), 2 * dpr, Y(v) + 3 * dpr);
  }
  if (timed) {
    const f = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctx.fillText(f(x0), left, H - 2 * dpr);
    const e = f(x1);
    ctx.fillText(e, left + pw - ctx.measureText(e).width, H - 2 * dpr);
  }
  const thr = pts.find((p) => p.threshold !== undefined)?.threshold ?? manualThreshold();
  if (thr !== undefined && thr >= lo && thr <= hi) {
    ctx.save();
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.strokeStyle = "#f87171";
    ctx.beginPath();
    ctx.moveTo(left, Y(thr));
    ctx.lineTo(left + pw, Y(thr));
    ctx.stroke();
    ctx.restore();
  }
  const r = Math.max(1.5, Math.min(3, 600 / pts.length)) * dpr;
  pts.forEach((p, i) => {
    const x = X(xs[i]);
    const y = Y(p.values[key]);
    const below = verdict(p) === false;
    ctx.fillStyle = below ? "#475569" : gradient((p.values[key] - lo) / Math.max(1e-6, hi - lo));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    timelinePts.push({ p, x: x / dpr });
  });
}

// ── licensed vs measured coverage (§4.3.5) ─────────────────────

const TX_KEY = "webrx.map.tx";
type Tx = { name: string; site: string; radiusKm: number | null };
let tx: Tx = (() => {
  try {
    return { name: "", site: "", radiusKm: null, ...JSON.parse(localStorage.getItem(TX_KEY) || "{}") };
  } catch (_) {
    return { name: "", site: "", radiusKm: null };
  }
})();
const txLayer = L.layerGroup().addTo(map);

function saveTx() {
  try {
    localStorage.setItem(TX_KEY, JSON.stringify(tx));
  } catch (_) {}
}

function sectorWedge(site: { lat: number; lon: number }, fromDeg: number, toDeg: number, radiusM: number): [number, number][] {
  const out: [number, number][] = [[site.lat, site.lon]];
  const kLat = 1 / 110_540;
  const kLon = 1 / (111_320 * Math.cos((site.lat * Math.PI) / 180));
  for (let a = fromDeg; a <= toDeg + 1e-9; a += (toDeg - fromDeg) / 8) {
    const r = (a * Math.PI) / 180;
    out.push([site.lat + Math.cos(r) * radiusM * kLat, site.lon + Math.sin(r) * radiusM * kLon]);
  }
  return out;
}

function renderTx() {
  txLayer.clearLayers();
  const box = $("txResult");
  if (!tx.site.trim()) {
    box.innerHTML = "";
    return;
  }
  const site = parseSite(tx.site);
  if (!site) {
    box.innerHTML = `<span class="caveat">Couldn't read the site position. Use e.g. 18E42 02 / 33S27 55 or −33.4653, 18.7006.</span>`;
    return;
  }
  const R = (tx.radiusKm ?? 0) * 1000;
  const name = tx.name.trim() || "Transmitter";
  L.marker([site.lat, site.lon], { icon: L.divIcon({ className: "pin", html: "🗼", iconSize: [30, 30], iconAnchor: [15, 26] }) })
    .bindPopup(`<b>${esc(name)}</b><br>${site.lat.toFixed(5)}, ${site.lon.toFixed(5)}${R ? `<br>Licensed coverage radius ${tx.radiusKm} km` : ""}`)
    .addTo(txLayer);
  if (R) L.circle([site.lat, site.lon], { radius: R, color: "#f59e0b", weight: 2, dashArray: "8 6", fill: false, interactive: false }).addTo(txLayer);
  const pins = candidates().map((p) => ({ lat: p.lat, lon: p.lon, above: verdict(p) !== false }));
  if (!pins.length) {
    box.textContent = "Load a recording to compare.";
    return;
  }
  const c = compareCoverage(site, R, pins);
  const step = 360 / c.sectors;
  c.reachM.forEach((r, s) => {
    if (!Number.isFinite(r)) return;
    const beyond = R > 0 && r > R;
    L.polygon(sectorWedge(site, s * step - step / 2, s * step + step / 2, r), {
      stroke: false,
      fillColor: beyond ? "#22d3ee" : "#60a5fa",
      fillOpacity: 0.16,
      interactive: false,
    }).addTo(txLayer);
  });
  const km = (m: number) => `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`;
  const pct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x * 100))}%`;
  const driven = c.driven.filter(Boolean).length;
  const lines = [
    `Furthest pin above the noise floor: <b>${km(c.furthestM)}</b> ${Number.isFinite(c.furthestBearing) ? compassName(c.furthestBearing) : ""} of the site.`,
  ];
  if (R) {
    lines.push(`Licensed radius ${km(R)} → measured reach <b>${pct(c.reachDelta)}</b>.`);
    lines.push(`Pins above the noise floor beyond the licensed radius: <b>${c.beyondCount} of ${c.aboveCount}</b> (${c.aboveCount ? Math.round((c.beyondCount / c.aboveCount) * 100) : 0}%).`);
    lines.push(`Measured coverage area over the ${driven} of ${c.sectors} directions driven: <b>${pct(c.areaDelta)}</b> vs the licence.`);
  } else lines.push(`Enter the licensed coverage radius to compare.`);
  lines.push(`<span class="hint">Shaded wedges: furthest above-threshold pin per direction (light blue beyond the licensed circle). Directions not driven are left out.</span>`);
  box.innerHTML = lines.join("<br>");
}

function fit() {
  const pts = shown().length ? shown() : allPoints();
  if (!pts.length) return;
  map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lon] as [number, number])).pad(0.12), { maxZoom: 17 });
}

function refreshAll(autoRangeToo = true) {
  if (autoRangeToo) autoRange();
  renderLoaded();
  render();
  if (!fittedOnce && allPoints().length) {
    fittedOnce = true;
    fit();
  }
}

// ── lists ──────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function renderLoaded() {
  const box = $("loadedList");
  if (!datasets.length) {
    box.innerHTML = '<div class="empty">Nothing loaded yet.</div>';
    return;
  }
  box.innerHTML = "";
  for (const d of datasets) {
    const el = document.createElement("div");
    el.className = "item";
    const p = d.parsed;
    const repairs = p.notes.filter((n) => /corrected|skipped|No |guessed|found from/.test(n));
    el.innerHTML = `
      <input type="checkbox" ${d.visible ? "checked" : ""} aria-label="Show ${esc(d.name)}" />
      <div style="min-width:0">
        <div class="name" title="${esc(d.name)}">${d.kind === "session" ? "🎙 " : "📄 "}${esc(d.name)}</div>
        <div class="meta">${p.points.length} points · ${p.measures.length} measurement${p.measures.length === 1 ? "" : "s"} · ${esc(p.units)}</div>
        ${repairs.length ? `<div class="notes">${repairs.map(esc).join(" · ")}</div>` : ""}
      </div>
      <div class="acts"><button class="btn small ghost" title="Remove from map">✕</button></div>`;
    el.querySelector("input")!.addEventListener("change", (e) => {
      d.visible = (e.target as HTMLInputElement).checked;
      rebuildMeasures();
      refreshAll();
    });
    el.querySelector("button")!.addEventListener("click", () => removeDataset(d.id));
    box.appendChild(el);
  }
}

async function renderSessions() {
  const box = $("sessionList");
  let list: Awaited<ReturnType<typeof listSessions>> = [];
  try {
    list = await listSessions();
  } catch (_) {
    box.innerHTML = '<div class="empty">This browser can\'t store recordings (private mode?).</div>';
    return;
  }
  if (!list.length) {
    box.innerHTML = '<div class="empty">No recordings saved yet — record in the Monitor.</div>';
    return;
  }
  box.innerHTML = "";
  const share = canShareFiles();
  for (const s of list) {
    const loaded = datasets.some((d) => d.sessionId === s.id);
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <input type="checkbox" ${loaded ? "checked" : ""} aria-label="Show on map" />
      <div style="min-width:0">
        <div class="name" title="${esc(s.name)}">${esc(s.name)}</div>
        <div class="meta">${s.active && !s.finished && Date.now() - s.updatedAt < 60_000 ? '<span class="live">● recording</span> · ' : ""}${new Date(s.startedAt).toLocaleString()} · ${s.count} records · ${s.positioned} with GPS</div>
      </div>
      <div class="acts">
        <button class="btn small ghost" data-act="dl" title="Download CSV">⬇</button>
        ${share ? '<button class="btn small ghost" data-act="share" title="Share CSV">↗</button>' : ""}
        <button class="btn small ghost danger" data-act="del" title="Delete recording">🗑</button>
      </div>`;
    el.querySelector("input")!.addEventListener("change", async (e) => {
      if ((e.target as HTMLInputElement).checked) await loadSession(s.id);
      else {
        const d = datasets.find((x) => x.sessionId === s.id);
        if (d) removeDataset(d.id);
      }
    });
    el.querySelectorAll<HTMLButtonElement>("button[data-act]").forEach((b) =>
      b.addEventListener("click", async () => {
        const full = await getSession(s.id);
        if (!full) return;
        const act = b.dataset.act;
        if (act === "del") {
          if (b.dataset.armed !== "1") {
            b.dataset.armed = "1";
            b.textContent = "Delete?";
            setTimeout(() => {
              b.dataset.armed = "";
              b.textContent = "🗑";
            }, 3000);
            return;
          }
          await deleteSession(s.id);
          notifyRecordings({ type: "deleted", id: s.id });
          const d = datasets.find((x) => x.sessionId === s.id);
          if (d) removeDataset(d.id);
          renderSessions();
          return;
        }
        await deliverCsv(toCsv(full.columns, full.rows), csvFileName(full), act === "share" ? "share" : "download");
      })
    );
    box.appendChild(el);
  }
}

async function loadSession(id: string) {
  const s = await getSession(id);
  if (!s) return;
  addDataset(s.name, toCsv(s.columns, s.rows), "session", s.id);
  refreshAll();
  if (!datasets.find((d) => d.sessionId === id)?.parsed.points.length) {
    status("This recording has no GPS positions yet — turn on GPS in the Monitor while recording");
  }
  renderSessions();
}

async function openFiles(input: ArrayLike<File> | Iterable<File>) {
  const files = Array.from(input as ArrayLike<File>);
  let n = 0;
  for (const f of files) {
    try {
      addDataset(f.name, await f.text(), "file");
      n++;
    } catch (e) {
      status(`Couldn't read ${f.name}`);
    }
  }
  if (n) {
    fittedOnce = false;
    refreshAll();
  }
}

// ── export ─────────────────────────────────────────────────────

function exportShown() {
  const pts = shown();
  if (!pts.length) {
    status("Nothing to export in this view");
    return;
  }
  const cols = ["timestamp", "file", "device", "center_freq_hz", "latitude", "longitude", "gps_accuracy_m", ...measures.map((m) => m.key), "units", "threshold_db", "above_threshold"];
  const rows = pts.map((p) => {
    const r: Record<string, string | number> = {
      timestamp: p.t !== undefined ? new Date(p.t).toISOString() : "",
      file: datasets.find((d) => d.parsed.points.includes(p))?.name ?? "",
      device: p.device ?? "",
      center_freq_hz: p.freqHz ?? "",
      latitude: p.lat.toFixed(6),
      longitude: p.lon.toFixed(6),
      gps_accuracy_m: p.accuracyM ?? "",
      units,
      threshold_db: (p.threshold ?? manualThreshold())?.toFixed(2) ?? "",
      above_threshold: verdict(p) === undefined ? "" : verdict(p) ? 1 : 0,
    };
    for (const m of measures) r[m.key] = Number.isFinite(p.values[m.key]) ? p.values[m.key] : "";
    return r;
  });
  deliverCsv(toCsv(cols, rows), csvFileName({ startedAt: Date.now(), summary: "map export" }), canShareFiles() ? "share" : "download");
}

// ── my location ────────────────────────────────────────────────

let meDot: L.CircleMarker | null = null;
let meHalo: L.Circle | null = null;
let locating = false;
let centredOnMe = false;

function onGps() {
  const f = gps.fix;
  if (!locating || !f || gps.status.state !== "fix") return;
  const ll = L.latLng(f.lat, f.lon);
  if (!meDot) {
    meHalo = L.circle(ll, { radius: f.accuracyM ?? 0, color: "#3b82f6", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
    meDot = L.circleMarker(ll, { radius: 7, color: "#fff", weight: 2, fillColor: "#3b82f6", fillOpacity: 1 }).bindTooltip("You").addTo(map);
  }
  meDot.setLatLng(ll);
  meHalo!.setLatLng(ll).setRadius(f.accuracyM ?? 0);
  if (!centredOnMe) {
    centredOnMe = true;
    map.setView(ll, Math.max(map.getZoom(), 16));
  }
}

async function toggleLocate() {
  const btn = $("btnLocate");
  if (locating) {
    locating = false;
    meDot?.remove();
    meHalo?.remove();
    meDot = null;
    meHalo = null;
    btn.textContent = "📍 My location";
    return;
  }
  locating = true;
  centredOnMe = false;
  btn.textContent = "📍 Locating…";
  gps.addEventListener("change", () => {
    if (locating && gps.status.state === "fix") btn.textContent = "📍 Hide me";
    onGps();
  });
  if (gps.status.state === "fix") onGps();
  else if (gps.savedSource() === "gmouse" && gps.hasSavedChoice()) await gps.resume();
  else await gps.start("phone");
}

// ── wiring ─────────────────────────────────────────────────────

function setView(v: View) {
  view = v;
  prefs.view = v;
  savePrefs();
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  for (const k of ["heat", "route", "coverage", "source"]) $(`opt-${k}`).hidden = k !== v;
  render();
}

function bindRange(id: string, key: "heatRadius" | "reach" | "topPct", label: string, fmt: (v: number) => string) {
  const el = $<HTMLInputElement>(id);
  el.value = String(prefs[key]);
  const show = () => ($(label).textContent = fmt(Number(el.value)));
  show();
  let timer: number | undefined;
  el.addEventListener("input", () => {
    prefs[key] = Number(el.value);
    show();
    savePrefs();
    clearTimeout(timer);
    timer = setTimeout(render, key === "reach" ? 250 : 60) as unknown as number;
  });
}

export async function initMap() {
  $("btnOpen").addEventListener("click", () => $<HTMLInputElement>("fileInput").click());
  $<HTMLInputElement>("fileInput").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    if (input.files) openFiles(input.files);
    input.value = "";
  });
  $("btnClear").addEventListener("click", () => {
    datasets.length = 0;
    rebuildMeasures();
    fittedOnce = false;
    refreshAll();
    renderSessions();
  });
  $("btnFit").addEventListener("click", fit);
  $("btnLocate").addEventListener("click", toggleLocate);
  $("btnRefresh").addEventListener("click", renderSessions);
  $("btnExport").addEventListener("click", exportShown);
  $("btnAuto").addEventListener("click", () => {
    autoRange();
    render();
  });
  $<HTMLSelectElement>("measure").addEventListener("change", () => {
    prefs.measure = measureKey();
    savePrefs();
    autoRange();
    render();
  });
  for (const id of ["freqFilter", "deviceFilter"]) $(id).addEventListener("change", () => refreshAll());
  for (const id of ["lo", "hi"]) {
    $(id).addEventListener("input", () => {
      let a = Number($<HTMLInputElement>("lo").value);
      let b = Number($<HTMLInputElement>("hi").value);
      if (a > b) [a, b] = [b, a];
      lo = a;
      hi = b;
      manualRange = true;
      $("rangeText").textContent = `${lo.toFixed(1)} to ${hi.toFixed(1)} ${units}`;
      render();
    });
  }
  const colour = $<HTMLSelectElement>("colourMode");
  colour.value = prefs.colourMode;
  colour.addEventListener("change", () => {
    prefs.colourMode = colour.value;
    savePrefs();
    render();
  });
  const grid = $<HTMLSelectElement>("gridSize");
  grid.value = String(prefs.grid);
  grid.addEventListener("change", () => {
    prefs.grid = Number(grid.value);
    savePrefs();
    render();
  });
  // Noise floor (§4.3.4)
  document.querySelectorAll<HTMLButtonElement>("[data-nf]").forEach((b) =>
    b.addEventListener("click", () => {
      prefs.nf = b.dataset.nf as typeof prefs.nf;
      savePrefs();
      if (!manualRange) autoRange();
      render();
    })
  );
  const nfFloor = $<HTMLInputElement>("nfFloor");
  const nfGuard = $<HTMLInputElement>("nfGuard");
  nfFloor.value = prefs.nfFloor !== null ? String(prefs.nfFloor) : "";
  nfGuard.value = String(prefs.nfGuard);
  const onNf = () => {
    const f = parseFloat(nfFloor.value.replace("−", "-"));
    prefs.nfFloor = Number.isFinite(f) ? f : null;
    const g = parseFloat(nfGuard.value);
    prefs.nfGuard = Number.isFinite(g) ? g : 5;
    savePrefs();
    if (!manualRange) autoRange();
    render();
  };
  nfFloor.addEventListener("change", onNf);
  nfGuard.addEventListener("change", onNf);
  const method = $<HTMLSelectElement>("covMethod");
  method.value = prefs.method;
  method.addEventListener("change", () => {
    prefs.method = method.value === "idw" ? "idw" : "nn";
    savePrefs();
    render();
  });
  const join = $<HTMLInputElement>("joinRoute");
  join.checked = !!prefs.joinRoute;
  join.addEventListener("change", () => {
    prefs.joinRoute = join.checked;
    savePrefs();
    render();
  });
  // Timeline: tap to find the pin.
  const tl = $<HTMLCanvasElement>("timeline");
  tl.addEventListener("click", (e) => {
    if (!timelinePts.length) return;
    const x = e.clientX - tl.getBoundingClientRect().left;
    let best = timelinePts[0];
    for (const t of timelinePts) if (Math.abs(t.x - x) < Math.abs(best.x - x)) best = t;
    map.setView([best.p.lat, best.p.lon], Math.max(map.getZoom(), 16));
    L.popup().setLatLng([best.p.lat, best.p.lon]).setContent(popupHtml(best.p)).openOn(map);
  });
  new ResizeObserver(() => drawTimeline()).observe(tl);
  // Licensed vs measured (§4.3.5)
  const txName = $<HTMLInputElement>("txName");
  const txSite = $<HTMLInputElement>("txSite");
  const txRadius = $<HTMLInputElement>("txRadius");
  txName.value = tx.name;
  txSite.value = tx.site;
  txRadius.value = tx.radiusKm !== null ? String(tx.radiusKm) : "";
  const applyTx = (fitToo: boolean) => {
    const r = parseFloat(txRadius.value);
    tx = { name: txName.value, site: txSite.value, radiusKm: Number.isFinite(r) && r > 0 ? r : null };
    saveTx();
    renderTx();
    const site = parseSite(tx.site);
    if (fitToo && site) {
      const pts = candidates();
      const b = L.latLngBounds([[site.lat, site.lon]]);
      for (const p of pts) b.extend([p.lat, p.lon]);
      if (tx.radiusKm) b.extend(L.latLng(site.lat, site.lon).toBounds(tx.radiusKm * 2000));
      map.fitBounds(b.pad(0.08), { maxZoom: 15 });
    }
  };
  $("txApply").addEventListener("click", () => applyTx(true));
  for (const el of [txName, txSite, txRadius]) el.addEventListener("change", () => applyTx(false));
  $("txExample").addEventListener("click", () => {
    txName.value = "100.1 FM Malmesbury (thesis Table 4.1)";
    txSite.value = "18E42 02 / 33S27 55";
    applyTx(true);
    if (!txRadius.value) txRadius.focus();
  });
  $("txClear").addEventListener("click", () => {
    txName.value = txSite.value = txRadius.value = "";
    applyTx(false);
  });
  bindRange("heatRadius", "heatRadius", "heatRadiusVal", (v) => `${v} px`);
  bindRange("reach", "reach", "reachVal", (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} km` : `${v} m`));
  bindRange("topPct", "topPct", "topPctVal", (v) => `${v}%`);
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view as View)));

  // Drag & drop onto the map.
  const wrap = document.querySelector(".mapwrap") as HTMLElement;
  let depth = 0;
  wrap.addEventListener("dragenter", (e) => {
    e.preventDefault();
    depth++;
    $("drop").classList.add("on");
  });
  wrap.addEventListener("dragover", (e) => e.preventDefault());
  wrap.addEventListener("dragleave", () => {
    if (--depth <= 0) $("drop").classList.remove("on");
  });
  wrap.addEventListener("drop", (e) => {
    e.preventDefault();
    depth = 0;
    $("drop").classList.remove("on");
    if (e.dataTransfer?.files?.length) openFiles(e.dataTransfer.files);
  });

  const install = $<HTMLButtonElement>("btnInstall");
  const showInstall = () => (install.hidden = !canInstallApp());
  onInstallAvailabilityChange(showInstall);
  showInstall();
  install.addEventListener("click", () => promptInstallApp());

  setView((["heat", "route", "coverage", "source"] as View[]).includes(prefs.view) ? prefs.view : "heat");
  await renderSessions();

  // Desktop: files opened with the installed app ("Open with → webRx").
  const lq = (window as any).launchQueue;
  if (lq && typeof lq.setConsumer === "function") {
    lq.setConsumer(async (params: any) => {
      if (!params?.files?.length) return;
      const files = await Promise.all(params.files.map((h: any) => h.getFile()));
      openFiles(files);
    });
  }

  // Files shared from other Android apps, or a recording opened from the Monitor.
  let shared = 0;
  try {
    const inbox = await takeInbox();
    for (const f of inbox) addDataset(f.name, f.text, "file");
    shared = inbox.length;
  } catch (_) {}
  const params = new URLSearchParams(location.search);
  const sid = params.get("session");
  if (sid) await loadSession(sid);
  refreshAll();
  if (shared) status(`Opened ${shared} shared file${shared === 1 ? "" : "s"} · ${allPoints().length} points`);

  // A recording that is still running in the Monitor (another tab) updates live.
  let listTimer: number | undefined;
  onRecordingsChanged(async (msg) => {
    clearTimeout(listTimer);
    listTimer = setTimeout(renderSessions, 1500) as unknown as number;
    const d = datasets.find((x) => x.sessionId === msg.id);
    if (!d) return;
    if (msg.type === "deleted") return removeDataset(d.id);
    const s = await getSession(msg.id);
    if (!s) return;
    addDataset(s.name, toCsv(s.columns, s.rows), "session", s.id);
    refreshAll(!manualRange);
  });
}
