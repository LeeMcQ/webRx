// SA display engine: zoom/pan, reference level and range, colour maps,
// max/min hold, markers, channel power / occupied bandwidth, noise floor,
// waterfall speed and freeze. Pure display: it reads the spectrum the monitor
// already computed (live or played back) and never changes a measurement.

export type Src = {
  sdr: boolean;
  centreHz: number;
  rateHz: number;
  spec: Float32Array; // averaged (dB, calibrated)
  raw: Float32Array; // latest frame (dB, uncalibrated)
  cal: number;
  peak: Float32Array; // decaying peak hold (existing monitor setting)
  peakHold: boolean;
  frames: number;
  band: [number, number]; // measurement band bins
  tunedHz: number;
  audioOn: boolean;
  dtLo: number;
  dtHi: number;
  thresholdDb: number | null;
  peakStat: { peak: number; peakHz: number } | null;
};

export type SaCfg = {
  zoom: number;
  pan: number; // 0..1 centre of the view within the span
  autoRange: boolean;
  ref: number; // top of the scale (dB)
  range: number; // dB shown
  cmap: string;
  trace: "avg" | "live";
  showMax: boolean;
  showMin: boolean;
  wfSpeed: number; // 1 = every frame, 2 = every 2nd …
  chBwHz: number;
  tap: "tune" | "m1" | "m2";
  m1Hz: number | null;
  m2Hz: number | null;
};

const KEY = "webrx.sa.v1";
const DEF: SaCfg = { zoom: 1, pan: 0.5, autoRange: true, ref: -20, range: 80, cmap: "turbo", trace: "avg", showMax: false, showMin: false, wfSpeed: 1, chBwHz: 200_000, tap: "tune", m1Hz: null, m2Hz: null };

const CMAPS: Record<string, [number, number[]][]> = {
  turbo: [[0, [7, 13, 24]], [0.2, [30, 58, 138]], [0.45, [8, 145, 178]], [0.65, [74, 222, 128]], [0.82, [250, 204, 21]], [1, [239, 68, 68]]],
  viridis: [[0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]]],
  inferno: [[0, [0, 0, 4]], [0.25, [87, 16, 110]], [0.5, [188, 55, 84]], [0.75, [249, 142, 9]], [1, [252, 255, 164]]],
  jet: [[0, [0, 0, 131]], [0.125, [0, 60, 170]], [0.375, [5, 255, 255]], [0.625, [255, 255, 0]], [0.875, [250, 0, 0]], [1, [128, 0, 0]]],
  grey: [[0, [0, 0, 0]], [1, [255, 255, 255]]],
};

function lutFor(name: string): Uint8ClampedArray {
  const stops = CMAPS[name] ?? CMAPS.turbo;
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; ++i) {
    const t = i / 255;
    let j = 0;
    while (j < stops.length - 2 && t > stops[j + 1][0]) ++j;
    const [t0, c0] = stops[j];
    const [t1, c1] = stops[j + 1];
    const u = (t - t0) / (t1 - t0 || 1);
    for (let ch = 0; ch < 3; ++ch) lut[i * 4 + ch] = c0[ch] + (c1[ch] - c0[ch]) * u;
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

export const CMAP_NAMES = Object.keys(CMAPS);
const lin = (db: number) => Math.pow(10, db / 10);

export function fitCanvas(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(50, Math.round(c.clientWidth * dpr));
  const h = Math.max(30, Math.round(c.clientHeight * dpr));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c.getContext("2d")!;
}

export function freqLabel(hz: number): string {
  return Math.abs(hz) >= 1e9 ? `${(hz / 1e9).toFixed(4)} GHz` : `${(hz / 1e6).toFixed(3)} MHz`;
}

export class Analyser {
  cfg: SaCfg;
  frozen = false;
  maxHold = new Float32Array(0);
  minHold = new Float32Array(0);
  yLo = -100;
  yHi = -20;
  private lut: Uint8ClampedArray;
  private wfCount = 0;
  private wfPending = 0;
  private wfRow: ImageData | null = null;
  /** Frozen copy of the trace shown while the display is frozen. */
  private still: { spec: Float32Array; raw: Float32Array } | null = null;
  readonly LEFT = 38;

  constructor() {
    let c = { ...DEF };
    try {
      c = { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch (_) {}
    this.cfg = c;
    this.lut = lutFor(c.cmap);
  }

  set(p: Partial<SaCfg>) {
    const zoomChanged = ("zoom" in p && p.zoom !== this.cfg.zoom) || ("pan" in p && p.pan !== this.cfg.pan);
    this.cfg = { ...this.cfg, ...p };
    this.cfg.zoom = Math.max(1, Math.min(64, this.cfg.zoom));
    const half = 0.5 / this.cfg.zoom;
    this.cfg.pan = Math.max(half, Math.min(1 - half, this.cfg.pan));
    if ("cmap" in p) this.lut = lutFor(this.cfg.cmap);
    if (zoomChanged) this.clearWaterfall = true;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.cfg));
    } catch (_) {}
  }
  clearWaterfall = false;

  setFrozen(on: boolean, s?: Src) {
    this.frozen = on;
    this.still = on && s ? { spec: s.spec.slice(), raw: s.raw.slice() } : null;
  }

  clearHolds() {
    this.maxHold = new Float32Array(0);
    this.minHold = new Float32Array(0);
  }

  /** Called once per new spectrum frame (live or playback). */
  ingest(spec: Float32Array) {
    if (this.frozen) return;
    const n = spec.length;
    if (this.maxHold.length !== n) {
      this.maxHold = spec.slice();
      this.minHold = spec.slice();
    } else {
      for (let k = 0; k < n; ++k) {
        const v = spec[k];
        if (v > this.maxHold[k]) this.maxHold[k] = v;
        if (v < this.minHold[k]) this.minHold[k] = v;
      }
    }
    if (++this.wfCount >= this.cfg.wfSpeed) {
      this.wfCount = 0;
      this.wfPending++;
    }
  }

  /** The trace shown (and measured by markers): averaged or live. */
  trace(s: Src): Float32Array {
    const base = this.still ?? s;
    if (this.cfg.trace === "live" && base.raw.length === base.spec.length) {
      const out = new Float32Array(base.raw.length);
      for (let k = 0; k < out.length; ++k) out[k] = base.raw[k] + s.cal;
      return out;
    }
    return base.spec;
  }

  view(n: number): [number, number] {
    const w = n / this.cfg.zoom;
    const k0 = Math.max(0, Math.min(n - w, this.cfg.pan * n - w / 2));
    return [k0, k0 + w];
  }

  viewHz(s: Src): [number, number] {
    const lo = s.centreHz - s.rateHz / 2;
    const half = 0.5 / this.cfg.zoom;
    return [lo + (this.cfg.pan - half) * s.rateHz, lo + (this.cfg.pan + half) * s.rateHz];
  }

  hzToBin(s: Src, hz: number, n: number) {
    return ((hz - (s.centreHz - s.rateHz / 2)) / s.rateHz) * n;
  }
  binToHz(s: Src, k: number, n: number) {
    return s.centreHz - s.rateHz / 2 + ((k + 0.5) / n) * s.rateHz;
  }

  /** Canvas x (CSS px, relative to the canvas) → frequency. null left of the plot. */
  xToHz(s: Src, xCss: number, wCss: number): number | null {
    const x = (xCss - this.LEFT) / Math.max(1, wCss - this.LEFT);
    if (x < 0 || x > 1) return null;
    const [f0, f1] = this.viewHz(s);
    return f0 + x * (f1 - f0);
  }

  levelAtHz(s: Src, hz: number): number {
    const t = this.trace(s);
    const k = Math.round(this.hzToBin(s, hz, t.length) - 0.5);
    return k >= 0 && k < t.length ? t[k] : NaN;
  }

  updateRange(s: Src) {
    if (!this.cfg.autoRange) {
      this.yHi = this.cfg.ref;
      this.yLo = this.cfg.ref - this.cfg.range;
      return;
    }
    const t = this.trace(s);
    if (!s.frames || !t.length) return;
    const sorted = Float32Array.from(t).filter(Number.isFinite).sort();
    if (!sorted.length) return;
    const floor = sorted[Math.floor(sorted.length * 0.1)];
    const top = sorted[sorted.length - 1];
    const lo = Math.floor((floor - 12) / 5) * 5;
    const hi = Math.max(lo + 40, Math.ceil((top + 8) / 5) * 5);
    this.yLo = this.yLo * 0.85 + lo * 0.15;
    this.yHi = this.yHi * 0.85 + hi * 0.15;
  }

  /** Marker to the highest point in view; `below` finds the next lower peak. */
  findPeak(s: Src, below?: number): number | null {
    const t = this.trace(s);
    const n = t.length;
    if (!n) return null;
    const [a, b] = this.view(n);
    let best = -1, bv = -Infinity;
    const guard = Math.max(2, Math.round(n / 512));
    for (let k = Math.ceil(a) + 1; k < Math.floor(b) - 1; ++k) {
      const v = t[k];
      if (!Number.isFinite(v) || v <= bv) continue;
      if (below !== undefined && v >= below - 0.05) continue;
      let isMax = true;
      for (let j = 1; j <= guard && isMax; ++j) if (t[k - j] > v || t[k + j] > v) isMax = false;
      if (below !== undefined && !isMax) continue;
      best = k;
      bv = v;
    }
    return best < 0 ? null : this.binToHz(s, best, n);
  }

  metrics(s: Src) {
    const t = this.trace(s);
    const n = t.length;
    if (!n || !s.frames) return null;
    const [a, b] = this.view(n);
    const vis: number[] = [];
    for (let k = Math.ceil(a); k < Math.floor(b); ++k) if (Number.isFinite(t[k])) vis.push(t[k]);
    vis.sort((x, y) => x - y);
    const floor = vis.length ? vis[Math.floor(vis.length / 2)] : NaN;
    // channel power around marker 1 (or the tuned frequency)
    const cHz = this.cfg.m1Hz ?? s.tunedHz;
    const k0 = Math.max(0, Math.floor(this.hzToBin(s, cHz - this.cfg.chBwHz / 2, n)));
    const k1 = Math.min(n - 1, Math.ceil(this.hzToBin(s, cHz + this.cfg.chBwHz / 2, n)));
    let sum = 0;
    for (let k = k0; k <= k1; ++k) if (Number.isFinite(t[k])) sum += lin(t[k]);
    const chPower = sum > 0 ? 10 * Math.log10(sum) : NaN;
    // occupied bandwidth (99 % of the power in view)
    let tot = 0;
    const p: number[] = [];
    for (let k = Math.ceil(a); k < Math.floor(b); ++k) {
      const v = Number.isFinite(t[k]) ? lin(t[k]) : 0;
      p.push(v);
      tot += v;
    }
    let lo = 0, hi = p.length - 1, acc = 0;
    while (lo < p.length && acc + p[lo] < tot * 0.005) acc += p[lo++];
    acc = 0;
    while (hi > lo && acc + p[hi] < tot * 0.005) acc += p[hi--];
    const binHz = s.rateHz / n;
    const obw = Math.max(0, hi - lo + 1) * binHz;
    return { floor, chPower, chCentre: cHz, obw };
  }

  drawSpectrum(c: HTMLCanvasElement, s: Src) {
    const ctx = fitCanvas(c);
    const W = c.width, H = c.height;
    const dpr = W / Math.max(1, c.clientWidth);
    ctx.clearRect(0, 0, W, H);
    const left = this.LEFT * dpr, bottom = 18 * dpr, pw = W - left, ph = H - bottom;
    const yLo = this.yLo, yHi = this.yHi;
    const y = (db: number) => ph - ((db - yLo) / Math.max(1e-6, yHi - yLo)) * ph;
    ctx.font = `${10 * dpr}px ui-monospace, monospace`;
    ctx.fillStyle = "#64748b";
    ctx.strokeStyle = "rgba(100,116,139,0.18)";
    ctx.lineWidth = 1;
    const step = yHi - yLo > 60 ? 20 : 10;
    for (let d = Math.ceil(yLo / step) * step; d <= yHi; d += step) {
      const yy = Math.round(y(d)) + 0.5;
      ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(W, yy); ctx.stroke();
      ctx.fillText(String(d), 2 * dpr, Math.max(10 * dpr, yy + 3 * dpr));
    }
    const [f0, f1] = this.viewHz(s);
    const xHz = (hz: number) => left + ((hz - f0) / (f1 - f0)) * pw;
    const sample = ctx.measureText(freqLabel(s.centreHz)).width;
    const labelEvery = sample * 5 + 40 * dpr < pw ? 1 : 2;
    for (let i = 0; i <= 4; ++i) {
      const xx = Math.round(left + (pw * i) / 4) + 0.5;
      ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, ph); ctx.stroke();
      if (s.sdr && i % labelEvery === 0) {
        const label = freqLabel(f0 + ((f1 - f0) * i) / 4);
        const tw = ctx.measureText(label).width;
        ctx.fillText(label, Math.min(W - tw - 2, Math.max(left, xx - tw / 2)), H - 4 * dpr);
      }
    }
    if (!s.sdr) {
      ctx.fillText("noise floor", left + 4 * dpr, H - 4 * dpr);
      ctx.fillText("estimated level (not RF power)", left + pw / 2 - 70 * dpr, H - 4 * dpr);
    }
    const t = this.trace(s);
    const n = t.length || 1;
    const [va, vb] = this.view(n);
    const xs = (k: number) => left + ((k + 0.5 - va) / (vb - va)) * pw;
    const clipX = (x0: number, x1: number, fill: string) => {
      const a = Math.max(left, x0), b = Math.min(W, x1);
      if (b > a) { ctx.fillStyle = fill; ctx.fillRect(a, 0, Math.max(1, b - a), ph); }
    };
    // measurement band, DT band, channel-power band
    clipX(xs(s.band[0] - 0.5), xs(s.band[1] - 0.5), "rgba(59,130,246,0.08)");
    if (s.sdr) {
      clipX(xHz(s.dtLo), xHz(s.dtHi), "rgba(34,197,94,0.10)");
      const cHz = this.cfg.m1Hz ?? s.tunedHz;
      ctx.strokeStyle = "rgba(167,139,250,0.6)";
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      for (const hz of [cHz - this.cfg.chBwHz / 2, cHz + this.cfg.chBwHz / 2]) {
        const x = xHz(hz);
        if (x >= left && x <= W) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ph); ctx.stroke(); }
      }
      ctx.setLineDash([]);
      const tx = Math.round(xHz(s.tunedHz)) + 0.5;
      if (tx >= left && tx <= W) {
        ctx.strokeStyle = s.audioOn ? "rgba(248,113,113,0.95)" : "rgba(248,113,113,0.5)";
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(tx, ph); ctx.stroke();
      }
    }
    if (s.thresholdDb !== null && s.sdr) {
      ctx.save();
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.strokeStyle = "rgba(248,113,113,0.85)";
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath(); ctx.moveTo(left, y(s.thresholdDb)); ctx.lineTo(W, y(s.thresholdDb)); ctx.stroke();
      ctx.fillStyle = "rgba(248,113,113,0.95)";
      ctx.fillText(`threshold ${s.thresholdDb.toFixed(1)}`, left + 4 * dpr, y(s.thresholdDb) - 3 * dpr);
      ctx.restore();
    }
    if (!s.frames || !t.length) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(left, 0, pw, ph); ctx.clip();
    const k0 = Math.max(0, Math.floor(va)), k1 = Math.min(t.length - 1, Math.ceil(vb));
    const line = (arr: Float32Array, color: string, width = 1) => {
      if (arr.length !== t.length) return;
      ctx.beginPath();
      for (let k = k0; k <= k1; ++k) (k === k0 ? ctx.moveTo : ctx.lineTo).call(ctx, xs(k), y(arr[k]));
      ctx.strokeStyle = color; ctx.lineWidth = width * dpr; ctx.stroke();
    };
    if (this.cfg.showMin) line(this.minHold, "rgba(148,163,184,0.7)");
    if (this.cfg.showMax) line(this.maxHold, "rgba(244,114,182,0.8)");
    if (s.peakHold && s.sdr) line(s.peak, "rgba(245,158,11,0.55)");
    const grad = ctx.createLinearGradient(0, 0, 0, ph);
    grad.addColorStop(0, "rgba(34,211,238,0.35)");
    grad.addColorStop(1, "rgba(59,130,246,0.02)");
    ctx.beginPath();
    ctx.moveTo(xs(k0), ph);
    for (let k = k0; k <= k1; ++k) ctx.lineTo(xs(k), y(t[k]));
    ctx.lineTo(xs(k1), ph);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    line(t, "#22d3ee", 1.2);
    ctx.restore();
    // markers
    const mark = (hz: number | null, label: string, color: string) => {
      if (hz === null) return;
      const x = xHz(hz);
      const v = this.levelAtHz(s, hz);
      if (x < left || x > W || !Number.isFinite(v)) return;
      const py = y(v);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(x, py - 2 * dpr); ctx.lineTo(x - 6 * dpr, py - 12 * dpr); ctx.lineTo(x + 6 * dpr, py - 12 * dpr); ctx.fill();
      ctx.font = `600 ${10 * dpr}px system-ui`;
      ctx.fillText(label, x - 6 * dpr, Math.max(10 * dpr, py - 15 * dpr));
    };
    if (this.cfg.m1Hz === null && this.cfg.m2Hz === null && s.peakStat && s.sdr && this.cfg.zoom === 1) {
      const px = xHz(s.peakStat.peakHz), py = y(s.peakStat.peak);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath(); ctx.moveTo(px, py - 2 * dpr); ctx.lineTo(px - 5 * dpr, py - 10 * dpr); ctx.lineTo(px + 5 * dpr, py - 10 * dpr); ctx.fill();
      const label = `${s.peakStat.peak.toFixed(1)} dB @ ${freqLabel(s.peakStat.peakHz)}`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(label, Math.min(W - tw - 4, Math.max(left + 2, px - tw / 2)), Math.max(12 * dpr, py - 14 * dpr));
    }
    mark(this.cfg.m1Hz, "M1", "#fbbf24");
    mark(this.cfg.m2Hz, "M2", "#a78bfa");
    if (this.frozen) {
      ctx.fillStyle = "rgba(251,191,36,0.9)";
      ctx.font = `700 ${11 * dpr}px system-ui`;
      ctx.fillText("FROZEN", W - 60 * dpr, 14 * dpr);
    }
  }

  drawWaterfall(c: HTMLCanvasElement, s: Src) {
    const ctx = fitCanvas(c);
    const W = c.width, H = c.height;
    if (this.clearWaterfall) {
      ctx.fillStyle = "#070d18";
      ctx.fillRect(0, 0, W, H);
      this.clearWaterfall = false;
    }
    if (!s.frames || this.wfPending === 0 || this.frozen) return;
    const rows = Math.min(this.wfPending, 4);
    this.wfPending = 0;
    if (!this.wfRow || this.wfRow.width !== W) this.wfRow = ctx.createImageData(W, 1);
    const t = this.trace(s);
    const n = t.length;
    const [va, vb] = this.view(n);
    const data = this.wfRow.data;
    const lut = this.lut;
    for (let x = 0; x < W; ++x) {
      const k0 = Math.floor(va + (x * (vb - va)) / W);
      const k1 = Math.max(k0 + 1, Math.floor(va + ((x + 1) * (vb - va)) / W));
      let v = -Infinity;
      for (let k = k0; k < k1 && k < n; ++k) v = Math.max(v, t[k]);
      const u = Math.max(0, Math.min(1, (v - this.yLo) / Math.max(1e-6, this.yHi - this.yLo)));
      const li = Math.round(u * 255) * 4;
      data[x * 4] = lut[li]; data[x * 4 + 1] = lut[li + 1]; data[x * 4 + 2] = lut[li + 2]; data[x * 4 + 3] = 255;
    }
    ctx.drawImage(c, 0, 0, W, H - rows, 0, rows, W, H - rows);
    for (let r = 0; r < rows; ++r) ctx.putImageData(this.wfRow, 0, r);
  }

  /** Colour-bar CSS gradient for the legend. */
  gradientCss(): string {
    const stops = CMAPS[this.cfg.cmap] ?? CMAPS.turbo;
    return `linear-gradient(90deg, ${stops.map(([t, c]) => `rgb(${c.join(",")}) ${Math.round(t * 100)}%`).join(", ")})`;
  }
}

export const analyser = new Analyser();
