// DT — Directional Tracking core. Rotate-and-sweep bearing capture for a
// directional antenna: timestamped (heading, level) samples, linear-power
// -3 dB lobe fit (peak) or null fit (loops), magnetic→true via WMM2025, fixes
// with full measurement metadata. Fed once per spectrum frame from the
// monitor's single stream; it never touches the SDR itself.

import { compass, cardinal } from "../../gps/compass.js";
import { BearingFit, Sample, binSamples, fitBearing, headingAt, interpolateGaps, median, norm, sweepDirections } from "../../df/bearing.js";
import { declination } from "../../df/wmm.js";
import type { FixRecord } from "../../df/io.js";

export type DtFix = FixRecord;
export type HeadingSource = "compass" | "manual";
export type DeclMode = "auto" | "manual" | "off";

type DtState = {
  freqHz: number | null; // null = follow the tuned/centre frequency
  bwHz: number;
  /** Antenna mount offset: boom direction minus phone top-edge direction (°). */
  mountOffset: number;
  declMode: DeclMode;
  manualDecl: number;
  source: HeadingSource;
  manual: number;
  mode: "peak" | "null";
  /** Extra latency of the level path vs. the heading path (ms). */
  lagMs: number;
  samples: Sample[];
  fixes: FixRecord[];
  session: string;
  tone: boolean;
  squelchDb: number;
  haptics: boolean;
  eirpDbm: number;
  plExp: number;
};

const KEY = "webrx.dt.v2";
const MAX_SAMPLES = 6000;
export const STALE_MS = 500;

export function defaults(): DtState {
  return { freqHz: null, bwHz: 25_000, mountOffset: 0, declMode: "auto", manualDecl: 0, source: "compass", manual: 0, mode: "peak", lagMs: 0, samples: [], fixes: [], session: "Hunt 1", tone: false, squelchDb: 6, haptics: true, eirpDbm: 30, plExp: 2.7 };
}

function load(): DtState {
  const d = defaults();
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s) return { ...d, ...s, samples: Array.isArray(s.samples) ? s.samples : [], fixes: Array.isArray(s.fixes) ? s.fixes : [] };
    // migrate v1 (mount/north offset + simple fixes)
    const v1 = JSON.parse(localStorage.getItem("webrx.dt.v1") || "null");
    if (v1) return { ...d, freqHz: v1.freqHz ?? null, bwHz: v1.bwHz ?? d.bwHz, mountOffset: v1.northOffset ?? 0, source: v1.source === "manual" ? "manual" : "compass" };
  } catch (_) {}
  return d;
}

export { norm };

export type HeadingRead = { deg?: number; magnetic?: number; north: "T" | "M"; problem?: string };

export class Directional {
  st: DtState;
  heading: number | undefined;
  level: number | undefined;
  problem: string | undefined;
  /** Set by the monitor: front-end overload in the current frame. */
  overload = false;
  /** Last known GPS position (for declination). */
  pos: { lat: number; lon: number; altM?: number } | undefined;
  private saveAt = 0;
  private track: { t: number; h: number }[] = [];
  private recent: number[] = [];
  private maxSeen = -Infinity;
  onNewPeak?: () => void;

  constructor(private persist = true) {
    this.st = persist ? load() : defaults();
  }

  save(force = false) {
    if (!this.persist) return;
    const now = Date.now();
    if (!force && now - this.saveAt < 3000) return;
    this.saveAt = now;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.st));
    } catch (_) {}
  }

  declination(): number {
    if (this.st.declMode === "off") return 0;
    if (this.st.declMode === "manual") return this.st.manualDecl;
    return this.pos ? declination(this.pos.lat, this.pos.lon, (this.pos.altM ?? 0) / 1000) : 0;
  }

  /** True north only when declination is actually known (auto with a fix, or manual). */
  northRef(): "T" | "M" {
    if (this.st.declMode === "manual") return "T";
    if (this.st.declMode === "auto" && this.pos) return "T";
    return "M";
  }

  /** Current antenna heading. Compass readings older than 500 ms or without a north reference are refused. */
  readHeading(now = Date.now()): HeadingRead {
    const north = this.northRef();
    let mag: number | undefined;
    if (this.st.source === "manual") mag = this.st.manual;
    else {
      const s = compass.status;
      if (s.state !== "on") return { north, problem: "Compass is off — tap Turn on compass" };
      if (s.source === "relative") return { north, problem: "Compass has no north reference (relative only) — bearings would be meaningless" };
      if (s.timestamp === undefined || now - s.timestamp > STALE_MS) return { north, problem: "Compass reading is stale (>0.5 s) — sensor paused?" };
      mag = s.heading;
    }
    if (mag === undefined || !Number.isFinite(mag)) return { north, problem: "No heading yet" };
    const m = norm(mag + this.st.mountOffset);
    // Manual bearings are typed against a map/true compass rose: no declination.
    const deg = this.st.source === "manual" ? m : norm(m + this.declination());
    return { deg, magnetic: m, north: this.st.source === "manual" ? "T" : north };
  }

  /** Called on every heading update (compass events) so levels can be time-aligned. */
  trackHeading(now = Date.now()) {
    const r = this.readHeading(now);
    this.heading = r.deg;
    this.problem = r.problem;
    if (r.deg === undefined) return;
    const t = this.st.source === "compass" ? compass.status.timestamp ?? now : now;
    if (this.track.length && this.track[this.track.length - 1].t >= t) return;
    this.track.push({ t, h: r.deg });
    if (this.track.length > 400) this.track.splice(0, this.track.length - 400);
  }

  /** Add one level (raw per-frame dB) captured at time t, with the heading interpolated at t - lag. */
  push(level: number, t = Date.now()) {
    this.trackHeading(t);
    if (!Number.isFinite(level)) { this.level = undefined; return; }
    this.recent.push(level);
    if (this.recent.length > 3) this.recent.shift();
    this.level = median(this.recent); // 3-frame median kills single-frame spikes
    const h = headingAt(this.track, t - this.st.lagMs);
    if (h === undefined) return;
    this.addSample({ h, db: this.level, t });
  }

  /** Playback / tests: a sample with an explicit heading. */
  addSample(s: Sample) {
    this.st.samples.push(s);
    if (this.st.samples.length > MAX_SAMPLES) this.st.samples.splice(0, this.st.samples.length - MAX_SAMPLES);
    if (s.db > this.maxSeen + 0.5) { this.maxSeen = s.db; this.onNewPeak?.(); }
    this.save();
  }

  reset() {
    this.st.samples = [];
    this.recent = [];
    this.maxSeen = -Infinity;
    this.save(true);
  }

  bins() { return binSamples(this.st.samples); }

  coverage(): number {
    const b = interpolateGaps(this.bins(), 4);
    return b.filter((v) => v !== null).length;
  }

  fit(): BearingFit | null { return fitBearing(this.bins(), this.st.mode); }

  /** Both sweep directions over the lobe: cancels residual lag bias. */
  directions(): { cw: boolean; ccw: boolean } {
    const f = this.fit();
    return f ? sweepDirections(this.st.samples, this.st.mode === "null" ? f.bearing : f.bearing) : { cw: false, ccw: false };
  }

  ready(): { ok: boolean; why?: string } {
    const f = this.fit();
    if (!f) return { ok: false, why: "No lobe yet — turn slowly through a full circle" };
    if (this.coverage() < 300) return { ok: false, why: `Cover at least 300° (now ${this.coverage()}°)` };
    const d = this.directions();
    if (!d.cw || !d.ccw) return { ok: false, why: `Sweep back across the peak the other way (${d.cw ? "anticlockwise" : "clockwise"}) to cancel lag` };
    return { ok: true };
  }

  guidance(): string {
    if (this.problem) return this.problem;
    if (this.heading === undefined) return "No heading yet.";
    const cov = this.coverage();
    if (this.overload) return "Front end overloaded — add an offset attenuator, reduce gain or step away from the transmitter.";
    const r = this.ready();
    if (r.ok) return "Bearing ready. Save the fix, move a few hundred metres at an angle, and repeat.";
    if (cov >= 300) return r.why!;
    const b = this.bins();
    const h = Math.round(this.heading);
    for (let d = 5; d <= 180; d += 5) {
      if (b[norm(h + d)] === null) return `Turn right (clockwise) — ${360 - cov}° still to cover.`;
      if (b[norm(h - d)] === null) return `Turn left — ${360 - cov}° still to cover.`;
    }
    return `Keep turning slowly — ${360 - cov}° still to cover.`;
  }

  addFix(meta: Omit<FixRecord, "bearing" | "north" | "sigma" | "beamwidth" | "snrDb" | "frontBackDb" | "level" | "mode" | "t">): FixRecord | null {
    const f = this.fit();
    if (!f) return null;
    const north = this.st.source === "manual" ? "T" : this.northRef();
    // null mode has a 180° ambiguity: the loop null points both ways; σ is doubled to reflect lower confidence.
    const rec: FixRecord = { ...meta, bearing: +f.bearing.toFixed(1), north, sigma: +(f.sigma * (this.st.mode === "null" ? 1.5 : 1)).toFixed(1), beamwidth: +f.beamwidth.toFixed(1), snrDb: +f.snrDb.toFixed(1), frontBackDb: f.frontBackDb === null ? null : +f.frontBackDb.toFixed(1), level: +f.peakDb.toFixed(1), mode: this.st.mode, t: Date.now() };
    this.st.fixes.push(rec);
    this.save(true);
    return rec;
  }

  clearFixes() {
    this.st.fixes = [];
    this.save(true);
  }

  draw(c: HTMLCanvasElement, units: string, sun = false) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const size = Math.max(160, Math.round(c.clientWidth));
    if (c.width !== size * dpr) { c.width = size * dpr; c.height = size * dpr; }
    const ctx = c.getContext("2d")!;
    const W = c.width, cx = W / 2, cy = W / 2, R = W / 2 - 26 * dpr;
    ctx.clearRect(0, 0, W, W);
    const raw = this.bins();
    const bins = interpolateGaps(raw);
    const vals = bins.filter((v): v is number => v !== null);
    const hi = vals.length ? Math.max(...vals) : 0;
    const lo = vals.length ? Math.min(hi - 10, Math.min(...vals)) : -10;
    const rOf = (v: number) => R * (0.12 + 0.88 * Math.max(0, (v - lo) / Math.max(1e-6, hi - lo)));
    const pt = (deg: number, r: number): [number, number] => {
      const a = ((deg - 90) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    const ink = sun ? "#000" : "#93a4bf";
    ctx.strokeStyle = sun ? "rgba(0,0,0,.45)" : "rgba(100,116,139,.28)";
    ctx.lineWidth = (sun ? 2 : 1) * dpr;
    for (const f of [0.25, 0.5, 0.75, 1]) { ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke(); }
    for (let d = 0; d < 360; d += 30) { const [x, y] = pt(d, R); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); }
    ctx.font = `700 ${(sun ? 15 : 12) * dpr}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const nl = this.st.source === "manual" ? "T" : this.northRef();
    for (const [d, t] of [[0, `N${nl === "T" ? "" : "ᴹ"}`], [90, "E"], [180, "S"], [270, "W"]] as [number, string][]) {
      const [x, y] = pt(d, R + 14 * dpr);
      ctx.fillStyle = d === 0 ? (sun ? "#b91c1c" : "#f87171") : ink;
      ctx.fillText(t, x, y);
    }
    // coverage ring (measured bins solid, interpolated faint)
    ctx.lineWidth = 5 * dpr;
    for (let b = 0; b < 360; ++b) {
      if (bins[b] === null) continue;
      ctx.strokeStyle = raw[b] !== null ? "rgba(59,130,246,.75)" : "rgba(59,130,246,.25)";
      const a0 = ((b - 0.5 - 90) * Math.PI) / 180, a1 = ((b + 0.5 - 90) * Math.PI) / 180;
      ctx.beginPath(); ctx.arc(cx, cy, R + 3 * dpr, a0, a1); ctx.stroke();
    }
    if (vals.length) {
      ctx.beginPath();
      let started = false;
      for (let b = 0; b <= 360; ++b) {
        const v = bins[b % 360];
        if (v === null) continue;
        const [x, y] = pt(b, rOf(v));
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      if (vals.length > 2) ctx.closePath();
      ctx.fillStyle = sun ? "rgba(220,38,38,.25)" : "rgba(239,68,68,.22)";
      ctx.strokeStyle = sun ? "#b91c1c" : "#f87171";
      ctx.lineWidth = (sun ? 3 : 2) * dpr;
      ctx.fill();
      ctx.stroke();
    }
    const fit = this.fit();
    if (fit) {
      // beamwidth wedge + bearing line (+ reciprocal for null mode)
      ctx.fillStyle = "rgba(34,197,94,.18)";
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, ((fit.bearing - fit.beamwidth / 2 - 90) * Math.PI) / 180, ((fit.bearing + fit.beamwidth / 2 - 90) * Math.PI) / 180);
      ctx.closePath(); ctx.fill();
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.strokeStyle = sun ? "#15803d" : "#22c55e";
      ctx.lineWidth = 2.5 * dpr;
      for (const b of this.st.mode === "null" ? [fit.bearing, fit.bearing + 180] : [fit.bearing]) {
        const [x, y] = pt(b, R);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if (this.heading !== undefined) {
      const [x, y] = pt(this.heading, R * 0.92);
      ctx.strokeStyle = sun ? "#a16207" : "#fbbf24";
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.fillStyle = sun ? "#000" : "#e6edf7";
    ctx.beginPath(); ctx.arc(cx, cy, 4 * dpr, 0, Math.PI * 2); ctx.fill();
    if (vals.length) {
      ctx.fillStyle = ink;
      ctx.font = `${11 * dpr}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.fillText(`${hi.toFixed(1)} ${units} max`, 6 * dpr, W - 22 * dpr);
      ctx.fillText(`${lo.toFixed(1)} ${units} centre`, 6 * dpr, W - 8 * dpr);
    }
  }
}

export const formatBearing = (deg: number, north?: "T" | "M") => `${String(Math.round(norm(deg)) % 360).padStart(3, "0")}°${north ?? ""} ${cardinal(deg)}`;
export const dt = new Directional();
/** Separate instance for recording playback: never touches the live plot or localStorage. */
export const dtPlay = new Directional(false);
