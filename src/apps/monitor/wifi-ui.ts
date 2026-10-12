// Wi-Fi analyser views for the RF Tech tab. Browsers cannot scan Wi-Fi, so all
// data comes from the Radio Bridge Android app (WifiManager.getScanResults +
// getConnectionInfo) through window.webrxWifi.push(scan). See WifiScan below.
import { Ap, WifiBand, Width, bandOf, bestChannels, channelLabel, channelToFreq, fsplDistanceM, rateChannels, span } from "./wifimath.js";

export interface WifiApIn extends Ap { security?: string; vendor?: string }
export interface WifiConnection { ssid: string; bssid: string; rssi: number; freq: number; width?: Width; centerFreq0?: number; linkMbps?: number; ip?: string }
/** Radio Bridge payload: one Android scan. */
export interface WifiScan { at?: number; aps: WifiApIn[]; connection?: WifiConnection | null }

const HISTORY_MS = 5 * 60 * 1000;
let last: WifiScan | null = null, source: "bridge" | "demo" | null = null, band: WifiBand = "2.4";
const hist = new Map<string, { label: string; pts: [number, number][] }>();
let demoTimer = 0;
const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const COLORS = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#f87171", "#22d3ee", "#fb923c", "#a3e635", "#e879f9"];
const color = (bssid: string) => { let h = 0; for (const c of bssid) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };

function ingest(scan: WifiScan, from: "bridge" | "demo") {
  if (from === "bridge" && source === "demo") stopDemo();
  source = from; last = scan;
  const t = scan.at ?? Date.now();
  for (const a of scan.aps) {
    const h = hist.get(a.bssid) ?? { label: a.ssid || "(hidden)", pts: [] };
    h.pts.push([t, a.rssi]); hist.set(a.bssid, h);
  }
  for (const [k, h] of hist) { h.pts = h.pts.filter(([pt]) => t - pt <= HISTORY_MS); if (!h.pts.length) hist.delete(k); }
  render();
}

function demoScan(): WifiScan {
  const j = () => Math.round((Math.random() - 0.5) * 6);
  const aps: WifiApIn[] = [
    { ssid: "DEMO-Home", bssid: "de:mo:00:00:00:01", rssi: -42 + j(), freq: 2412, width: 40, security: "WPA2-PSK", vendor: "TP-Link" },
    { ssid: "DEMO-Neighbour", bssid: "de:mo:00:00:00:02", rssi: -67 + j(), freq: 2437, width: 20, security: "WPA2/WPA3", vendor: "Huawei" },
    { ssid: "", bssid: "de:mo:00:00:00:03", rssi: -78 + j(), freq: 2462, width: 20, security: "WPA2-PSK" },
    { ssid: "DEMO-Cafe", bssid: "de:mo:00:00:00:04", rssi: -71 + j(), freq: 2442, width: 20, security: "Open" },
    { ssid: "DEMO-Home-5G", bssid: "de:mo:00:00:00:05", rssi: -51 + j(), freq: 5200, width: 80, security: "WPA3-SAE", vendor: "TP-Link" },
    { ssid: "DEMO-Office", bssid: "de:mo:00:00:00:06", rssi: -74 + j(), freq: 5745, width: 80, security: "WPA2-EAP", vendor: "Cisco" },
    { ssid: "DEMO-Lab", bssid: "de:mo:00:00:00:07", rssi: -63 + j(), freq: 5500, width: 160, security: "WPA3-SAE" },
    { ssid: "DEMO-6E", bssid: "de:mo:00:00:00:08", rssi: -58 + j(), freq: 5975, width: 80, security: "WPA3-SAE", vendor: "Netgear" },
  ];
  return { at: Date.now(), aps, connection: { ssid: "DEMO-Home-5G", bssid: "de:mo:00:00:00:05", rssi: aps[4].rssi, freq: 5200, width: 80, linkMbps: 866, ip: "192.0.2.23" } };
}
function startDemo() { ingest(demoScan(), "demo"); demoTimer = window.setInterval(() => ingest(demoScan(), "demo"), 3000); }
function stopDemo() { clearInterval(demoTimer); demoTimer = 0; if (source === "demo") { source = null; last = null; hist.clear(); } render(); }

const dist = (rssi: number, f: number) => { const d = fsplDistanceM(rssi, f); return d < 10 ? `~${d.toFixed(1)} m` : `~${Math.round(d)} m`; };

function render() {
  const has = !!last;
  $("wfEmpty").hidden = has; $("wfViews").hidden = !has;
  $("wfSource").textContent = source === "demo" ? "DEMO DATA — not a real scan" : source === "bridge" ? "Radio Bridge" : "no data";
  $("wfSource").className = "lbl" + (source === "demo" ? " demo" : "");
  if (!last) return;
  const c = last.connection;
  $("wfConn").innerHTML = c ? `<table class="nettable"><caption class="sr-only">Current Wi-Fi connection</caption>
    <tr><th scope="row">SSID</th><td>${esc(c.ssid || "(hidden)")}</td></tr><tr><th scope="row">BSSID</th><td><code>${esc(c.bssid)}</code></td></tr>
    <tr><th scope="row">RSSI</th><td>${c.rssi} dBm</td></tr><tr><th scope="row">Channel</th><td>${channelLabel(c.freq, c.width ?? 20, c.centerFreq0)}</td></tr>
    <tr><th scope="row">Frequency</th><td>${c.freq} MHz</td></tr><tr><th scope="row">Link speed</th><td>${c.linkMbps ?? "—"} Mbps</td></tr>
    <tr><th scope="row">IP</th><td>${esc(c.ip ?? "—")}</td></tr><tr><th scope="row">Est. distance</th><td>${dist(c.rssi, c.freq)} (rough)</td></tr></table>` : `<p class="hint">Not connected to Wi-Fi.</p>`;
  const aps = [...last.aps].sort((a, b) => b.rssi - a.rssi);
  $("wfApCount").textContent = String(aps.length);
  $("wfAps").innerHTML = aps.map((a) => {
    const [lo, hi] = span(a.freq, a.width, a.centerFreq0), me = c && c.bssid === a.bssid;
    return `<li class="wfap${me ? " me" : ""}" style="--c:${color(a.bssid)}"><div><b>${esc(a.ssid || "(hidden)")}</b>${me ? ' <span class="lbl">connected</span>' : ""}<code>${esc(a.bssid)}</code>${a.vendor ? `<small>${esc(a.vendor)}</small>` : ""}</div>
      <div class="wfrssi">${a.rssi} dBm</div>
      <div class="wfmeta">CH ${channelLabel(a.freq, a.width, a.centerFreq0)} · ${a.freq} MHz · ${lo}–${hi} MHz · ${a.width} MHz · ${esc(a.security ?? "?")} · ${dist(a.rssi, a.freq)}</div></li>`;
  }).join("");
  drawChannelGraph(); renderRating(); drawTimeGraph();
}

const BAND_CH: Record<WifiBand, [number, number]> = { "2.4": [-1, 15], "5": [30, 170], "6": [-3, 97] };
function fitCanvas(cv: HTMLCanvasElement) {
  const dpr = Math.min(2, devicePixelRatio || 1), w = Math.max(50, cv.clientWidth * dpr | 0), h = Math.max(50, cv.clientHeight * dpr | 0);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const g = cv.getContext("2d")!; g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, W: w / dpr, H: h / dpr };
}
function axes(g: CanvasRenderingContext2D, W: number, H: number, L: number, B: number) {
  g.clearRect(0, 0, W, H); g.font = "10px system-ui"; g.fillStyle = "#94a3b8"; g.strokeStyle = "rgba(148,163,184,.18)";
  for (let d = -100; d <= -20; d += 10) { const y = (H - B) * (-20 - d) / 80; g.beginPath(); g.moveTo(L, y); g.lineTo(W, y); g.stroke(); g.fillText(String(d), 2, y + 3); }
}
function drawChannelGraph() {
  const cv = $("wfChanGraph") as HTMLCanvasElement; const { g, W, H } = fitCanvas(cv); const L = 30, B = 18;
  axes(g, W, H, L, B);
  const [c0, c1] = BAND_CH[band];
  const f0 = band === "2.4" ? 2407 + 5 * c0 : channelToFreq(c0, band), f1 = band === "2.4" ? 2407 + 5 * c1 : channelToFreq(c1, band);
  const x = (f: number) => L + (W - L) * (f - f0) / (f1 - f0), y = (d: number) => (H - B) * (-20 - Math.max(-100, Math.min(-20, d))) / 80;
  const ticks = band === "2.4" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] : band === "5" ? [36, 52, 64, 100, 116, 132, 149, 165] : [1, 17, 33, 49, 65, 81, 93];
  g.fillStyle = "#94a3b8"; g.textAlign = "center";
  for (const t of ticks) g.fillText(String(t), x(band === "2.4" ? (t === 14 ? 2484 : 2407 + 5 * t) : channelToFreq(t, band)), H - 4);
  g.textAlign = "left";
  const conn = last?.connection;
  for (const a of last!.aps.filter((a) => bandOf(a.freq) === band)) {
    const [lo, hi] = span(a.freq, a.width, a.centerFreq0), col = color(a.bssid), me = conn?.bssid === a.bssid;
    g.beginPath(); g.moveTo(x(lo), y(-100)); g.lineTo(x(lo + 2), y(a.rssi)); g.lineTo(x(hi - 2), y(a.rssi)); g.lineTo(x(hi), y(-100)); g.closePath();
    g.globalAlpha = me ? 0.35 : 0.15; g.fillStyle = col; g.fill(); g.globalAlpha = 1; g.strokeStyle = col; g.lineWidth = me ? 3 : 1.5; g.stroke();
    g.fillStyle = col; g.textAlign = "center"; g.fillText(`${a.ssid || "(hidden)"}${me ? " ★" : ""}`, x((lo + hi) / 2), y(a.rssi) - 4); g.textAlign = "left";
  }
}
function renderRating() {
  const aps = last!.aps, r = rateChannels(aps, band), best = bestChannels(aps, band);
  $("wfBest").textContent = `Best ${band} GHz channels: ${best.join(", ")}${band === "2.4" ? " (non-overlapping 1/6/11 only)" : ""}`;
  $("wfRating").innerHTML = r.filter((x) => band !== "2.4" || x.ch <= 13).map((x) => `<tr${best.includes(x.ch) ? ' class="best"' : ""}><th scope="row">${x.ch}</th><td>${x.count}</td><td><span class="stars" aria-label="${x.score} of 10">${"★".repeat(Math.round(x.score / 2))}${"☆".repeat(5 - Math.round(x.score / 2))}</span></td></tr>`).join("");
}
function drawTimeGraph() {
  const cv = $("wfTimeGraph") as HTMLCanvasElement; const { g, W, H } = fitCanvas(cv); const L = 30, B = 18;
  axes(g, W, H, L, B);
  const now = Date.now(), x = (t: number) => L + (W - L) * (1 - (now - t) / HISTORY_MS), y = (d: number) => (H - B) * (-20 - Math.max(-100, Math.min(-20, d))) / 80;
  g.fillStyle = "#94a3b8"; g.fillText("−5 min", L, H - 4); g.textAlign = "right"; g.fillText("now", W - 2, H - 4); g.textAlign = "left";
  const inBand = new Set(last!.aps.filter((a) => bandOf(a.freq) === band).map((a) => a.bssid));
  for (const [bssid, h] of hist) {
    if (!inBand.has(bssid)) continue;
    g.strokeStyle = color(bssid); g.lineWidth = last!.connection?.bssid === bssid ? 3 : 1.5; g.beginPath();
    h.pts.forEach(([t, d], i) => (i ? g.lineTo(x(t), y(d)) : g.moveTo(x(t), y(d)))); g.stroke();
  }
}

export function initWifiAnalyser() {
  if (!document.getElementById("wfCard")) return;
  (window as any).webrxWifi = { push: (s: WifiScan) => ingest(s, "bridge"), clear: () => { last = null; source = null; hist.clear(); render(); } };
  const demo = $("wfDemo") as HTMLInputElement;
  demo.addEventListener("change", () => (demo.checked ? startDemo() : stopDemo()));
  document.querySelectorAll<HTMLButtonElement>("#wfBand button").forEach((b) => b.addEventListener("click", () => {
    band = b.dataset.band as WifiBand;
    document.querySelectorAll("#wfBand button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    if (last) render();
  }));
  window.addEventListener("resize", () => last && render());
  window.addEventListener("webrx:tab", (e: any) => { if (e.detail === "rf" && last) requestAnimationFrame(render); });
  render();
}
