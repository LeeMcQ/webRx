// DT — Directional Tracking core: max level per bearing (1° bins), polar plot,
// coverage guidance and saved bearing fixes. Fed once per spectrum frame from
// the monitor's single stream; it never touches the SDR itself.

import { compass, cardinal } from "../../gps/compass.js";

export type DtFix = { lat: number; lon: number; bearing: number; level: number; freqHz: number; t: number };
export type HeadingSource = "compass" | "course" | "manual";

type DtState = {
  freqHz: number | null; // null = follow the tuned/centre frequency
  bwHz: number;
  northOffset: number;
  source: HeadingSource;
  manual: number;
  bins: (number | null)[];
  fixes: DtFix[];
};

const KEY = "webrx.dt.v1";
const N = 360;

function load(): DtState {
  const d: DtState = { freqHz: null, bwHz: 25_000, northOffset: 0, source: "compass", manual: 0, bins: new Array(N).fill(null), fixes: [] };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}");
    const out = { ...d, ...s };
    if (!Array.isArray(out.bins) || out.bins.length !== N) out.bins = d.bins;
    return out;
  } catch (_) {
    return d;
  }
}

export const norm = (deg: number) => ((deg % 360) + 360) % 360;

export class Directional {
  st: DtState = load();
  heading: number | undefined;
  level: number | undefined;
  private saveAt = 0;

  save(force = false) {
    const now = Date.now();
    if (!force && now - this.saveAt < 3000) return;
    this.saveAt = now;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.st));
    } catch (_) {}
  }

  /** Current heading in degrees true-ish (raw source + north/mount offset). */
  readHeading(courseDeg?: number): number | undefined {
    let raw: number | undefined;
    if (this.st.source === "manual") raw = this.st.manual;
    else if (this.st.source === "course") raw = courseDeg;
    else raw = compass.status.state === "on" ? compass.status.heading : undefined;
    return raw === undefined || !Number.isFinite(raw) ? undefined : norm(raw + this.st.northOffset);
  }

  /** Add one measurement at the current heading (max hold per degree). */
  push(level: number, courseDeg?: number) {
    this.level = Number.isFinite(level) ? level : undefined;
    this.heading = this.readHeading(courseDeg);
    if (this.heading === undefined || this.level === undefined) return;
    const b = Math.round(this.heading) % N;
    const cur = this.st.bins[b];
    if (cur === null || this.level > cur) this.st.bins[b] = this.level;
    this.save();
  }

  reset() {
    this.st.bins = new Array(N).fill(null);
    this.save(true);
  }

  coverage(): number {
    // Count 5° sectors with at least one sample.
    let c = 0;
    for (let s = 0; s < 72; ++s) {
      for (let k = 0; k < 5; ++k) if (this.st.bins[s * 5 + k] !== null) { ++c; break; }
    }
    return c * 5;
  }

  /** Best bearing, smoothed over ±5° so a single spike doesn't win. */
  best(): { bearing: number; level: number } | null {
    let bestB = -1, bestV = -Infinity, any = false;
    for (let b = 0; b < N; ++b) {
      let sum = 0, cnt = 0;
      for (let k = -5; k <= 5; ++k) {
        const v = this.st.bins[norm(b + k)];
        if (v !== null) { sum += v; ++cnt; }
      }
      if (!cnt) continue;
      any = true;
      const v = sum / cnt;
      if (v > bestV) { bestV = v; bestB = b; }
    }
    if (!any) return null;
    const raw = this.st.bins[bestB];
    return { bearing: bestB, level: raw ?? bestV };
  }

  /** Largest unsampled gap, to guide the user's rotation. */
  guidance(): string {
    if (this.heading === undefined) return this.st.source === "compass" ? "No compass heading — tap Compass on the MT tab, or choose a heading source." : "No heading yet.";
    const cov = this.coverage();
    if (cov >= 355) return "Full circle covered. Save the fix, move a few hundred metres, and repeat.";
    // find the nearest empty 5° sector either way
    const h = Math.round(this.heading);
    for (let d = 5; d <= 180; d += 5) {
      const r = norm(h + d), l = norm(h - d);
      if (this.st.bins[r] === null) return `Turn right (clockwise) — ${360 - cov}° still to cover.`;
      if (this.st.bins[l] === null) return `Turn left — ${360 - cov}° still to cover.`;
    }
    return `Keep turning slowly — ${360 - cov}° still to cover.`;
  }

  addFix(lat: number, lon: number, freqHz: number): DtFix | null {
    const b = this.best();
    if (!b) return null;
    const f: DtFix = { lat, lon, bearing: b.bearing, level: b.level, freqHz, t: Date.now() };
    this.st.fixes.push(f);
    this.save(true);
    return f;
  }

  clearFixes() {
    this.st.fixes = [];
    this.save(true);
  }

  draw(c: HTMLCanvasElement, units: string) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const size = Math.max(160, Math.round(c.clientWidth));
    if (c.width !== size * dpr) { c.width = size * dpr; c.height = size * dpr; }
    const ctx = c.getContext("2d")!;
    const W = c.width, cx = W / 2, cy = W / 2, R = W / 2 - 26 * dpr;
    ctx.clearRect(0, 0, W, W);
    const vals = this.st.bins.filter((v): v is number => v !== null);
    const hi = vals.length ? Math.max(...vals) : 0;
    const lo = vals.length ? Math.min(hi - 10, Math.min(...vals)) : -10;
    const rOf = (v: number) => R * (0.12 + 0.88 * Math.max(0, (v - lo) / Math.max(1e-6, hi - lo)));
    const pt = (deg: number, r: number): [number, number] => {
      const a = ((deg - 90) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    // rings + spokes
    ctx.strokeStyle = "rgba(100,116,139,.28)";
    ctx.lineWidth = 1 * dpr;
    for (const f of [0.25, 0.5, 0.75, 1]) { ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke(); }
    for (let d = 0; d < 360; d += 30) { const [x, y] = pt(d, R); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); }
    ctx.fillStyle = "#93a4bf";
    ctx.font = `600 ${12 * dpr}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [d, t] of [[0, "N"], [90, "E"], [180, "S"], [270, "W"]] as [number, string][]) {
      const [x, y] = pt(d, R + 14 * dpr);
      ctx.fillStyle = d === 0 ? "#f87171" : "#93a4bf";
      ctx.fillText(t, x, y);
    }
    // coverage ring
    ctx.strokeStyle = "rgba(59,130,246,.55)";
    ctx.lineWidth = 5 * dpr;
    for (let b = 0; b < N; ++b) {
      if (this.st.bins[b] === null) continue;
      const a0 = ((b - 0.5 - 90) * Math.PI) / 180, a1 = ((b + 0.5 - 90) * Math.PI) / 180;
      ctx.beginPath(); ctx.arc(cx, cy, R + 3 * dpr, a0, a1); ctx.stroke();
    }
    // max-hold polygon
    if (vals.length) {
      ctx.beginPath();
      let started = false;
      for (let b = 0; b <= N; ++b) {
        const v = this.st.bins[b % N];
        if (v === null) continue;
        const [x, y] = pt(b, rOf(v));
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      if (vals.length > 2) ctx.closePath();
      ctx.fillStyle = "rgba(239,68,68,.22)";
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 2 * dpr;
      ctx.fill();
      ctx.stroke();
    }
    const best = this.best();
    if (best) {
      const [x, y] = pt(best.bearing, R);
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this.heading !== undefined) {
      const [x, y] = pt(this.heading, R * 0.92);
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.fillStyle = "#e6edf7";
    ctx.beginPath(); ctx.arc(cx, cy, 4 * dpr, 0, Math.PI * 2); ctx.fill();
    if (vals.length) {
      ctx.fillStyle = "#93a4bf";
      ctx.font = `${11 * dpr}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.fillText(`${hi.toFixed(1)} ${units} max`, 6 * dpr, W - 22 * dpr);
      ctx.fillText(`${lo.toFixed(1)} ${units} centre`, 6 * dpr, W - 8 * dpr);
    }
  }
}

export const formatBearing = (deg: number) => `${String(Math.round(norm(deg))).padStart(3, "0")}° ${cardinal(deg)}`;
export const dt = new Directional();
