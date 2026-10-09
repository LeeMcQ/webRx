// MMN Map Visualizer — opens signal-level recordings as a heatmap, a coloured
// route, an interpolated coverage estimate, or a transmitter location estimate.
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
  const d = { view: "heat" as View, measure: "", colourMode: "gradient", heatRadius: 25, grid: 60, reach: 200, topPct: 25 };
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

function gradient(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  return `hsl(${240 - x * 240}, 85%, ${45 + x * 10}%)`;
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

function shown(): MapPoint[] {
  const key = measureKey();
  return candidates().filter((p) => p.values[key] >= lo && p.values[key] <= hi);
}

function autoRange() {
  updateUnits();
  const key = measureKey();
  const vals = candidates().map((p) => p.values[key]);
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
    ds ? `${ds.name} · row ${p.row}` : "",
  ]
    .filter(Boolean)
    .join("<br>");
  return `${vals}<br><span style="color:#8a9bb5">${extra}<br>${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</span>`;
}

function render() {
  clearLayers();
  const key = measureKey();
  const pts = shown();
  $("sourceResult").textContent = "";
  updateLegend(pts.length > 0);
  if (!pts.length) {
    status(datasets.length ? "No points in this range — try Auto range" : "Open a recording to begin");
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
        gradient: { 0: "#2b2bd9", 0.35: "#16c2c2", 0.6: "#2fd12f", 0.8: "#e6d21f", 1: "#e63232" },
      })
      .addTo(map);
    status(`${pts.length} points · heatmap`);
  } else if (view === "route") {
    drawRoute(pts, key);
    status(`${pts.length} points · route`);
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
  updateSummary(pts);
}

function drawRoute(pts: MapPoint[], key: string) {
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
        { color: colourFor(b.values[key]), weight: 5, opacity: 0.85, interactive: false }
      ).addTo(dataLayer);
    }
  }
  for (const p of pts) {
    L.circleMarker([p.lat, p.lon], { radius: 6, color: "#0b1220", weight: 1.5, fillColor: colourFor(p.values[key]), fillOpacity: 0.95 })
      .bindPopup(() => popupHtml(p))
      .addTo(dataLayer);
  }
}

function drawCoverage(pts: MapPoint[], key: string) {
  const n = Number(prefs.grid) || 60;
  const reach = Number(prefs.reach) || 300;
  const P = projector(pts);
  const xy = pts.map((p) => ({ x: P.x(p.lon), y: P.y(p.lat), v: p.values[key] }));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const q of xy) {
    minX = Math.min(minX, q.x);
    maxX = Math.max(maxX, q.x);
    minY = Math.min(minY, q.y);
    maxY = Math.max(maxY, q.y);
  }
  const pad = Math.max(reach * 0.5, 0.05 * Math.max(maxX - minX, maxY - minY));
  minX -= pad;
  maxX += pad;
  minY -= pad;
  maxY += pad;
  const cell = Math.max((maxX - minX) / n, (maxY - minY) / n, 1);
  // Bucket points by `reach` so each cell only looks at nearby measurements.
  const buckets = new Map<string, typeof xy>();
  const bk = (x: number, y: number) => `${Math.floor(x / reach)},${Math.floor(y / reach)}`;
  for (const q of xy) {
    const k = bk(q.x, q.y);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(q);
  }
  let cells = 0;
  for (let y = minY; y < maxY; y += cell) {
    for (let x = minX; x < maxX; x += cell) {
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const bx = Math.floor(cx / reach);
      const by = Math.floor(cy / reach);
      let sw = 0;
      let sv = 0;
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          const list = buckets.get(`${bx + i},${by + j}`);
          if (!list) continue;
          for (const q of list) {
            const d2 = (q.x - cx) ** 2 + (q.y - cy) ** 2;
            if (d2 > reach * reach) continue;
            const w = 1 / (d2 + 25);
            sw += w;
            sv += w * q.v;
          }
        }
      if (!sw) continue;
      const v = sv / sw;
      L.rectangle(
        [
          [P.lat(y), P.lon(x)],
          [P.lat(y + cell), P.lon(x + cell)],
        ],
        { stroke: false, fillColor: gradient((v - lo) / Math.max(1e-6, hi - lo)), fillOpacity: 0.5, interactive: false }
      ).addTo(dataLayer);
      cells++;
    }
  }
  for (const p of pts) {
    L.circleMarker([p.lat, p.lon], { radius: 2.5, stroke: false, fillColor: "#e2e8f0", fillOpacity: 0.9 }).bindPopup(() => popupHtml(p)).addTo(dataLayer);
  }
  status(`Coverage estimate · ${cells} cells of ${Math.round(cell)} m · from ${pts.length} points`);
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
  const cols = ["timestamp", "file", "device", "center_freq_hz", "latitude", "longitude", "gps_accuracy_m", ...measures.map((m) => m.key), "units"];
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
