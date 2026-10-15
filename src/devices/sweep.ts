// HackRF sweep mode (as hackrf_sweep / libhackrf hackrf_init_sweep).
// The firmware retunes in steps of `stepWidth` across the given ranges and
// streams 16384-byte blocks; each starts with 0x7F 0x7F + uint64 LE frequency
// (Hz), followed by signed 8-bit I/Q. With the "interleaved" style and
// offset = 7.5 MHz at 20 MS/s, each block yields two 5 MHz slices:
// [f, f+5 MHz) from FFT bins starting at 5/8·N and [f+10, f+15 MHz) from 1/8·N.

export const SWEEP_BLOCK_BYTES = 16384;
export const SWEEP_SAMPLE_RATE = 20_000_000;
export const SWEEP_OFFSET_HZ = 7_500_000;
export const SWEEP_STEP_HZ = 20_000_000;
export const SWEEP_STYLE_INTERLEAVED = 1;
export const MAX_SWEEP_RANGES = 10;

/** Payload for vendor request INIT_SWEEP (26). value/index carry num_bytes. */
export function initSweepPayload(rangesMHz: [number, number][], numBytes: number, stepWidth = SWEEP_STEP_HZ, offset = SWEEP_OFFSET_HZ, style = SWEEP_STYLE_INTERLEAVED): { data: Uint8Array; value: number; index: number } {
  if (!rangesMHz.length || rangesMHz.length > MAX_SWEEP_RANGES) throw new Error("1–10 sweep ranges");
  if (numBytes % SWEEP_BLOCK_BYTES) throw new Error("num_bytes must be a multiple of 16384");
  const d = new Uint8Array(9 + rangesMHz.length * 4);
  const dv = new DataView(d.buffer);
  dv.setUint32(0, stepWidth, true);
  dv.setUint32(4, offset, true);
  d[8] = style;
  rangesMHz.forEach(([lo, hi], i) => {
    // hackrf_sweep rounds the span up to a whole number of 20 MHz steps
    const steps = Math.max(1, Math.ceil((hi - lo) / (stepWidth / 1e6)));
    dv.setUint16(9 + i * 4, lo, true);
    dv.setUint16(11 + i * 4, lo + steps * (stepWidth / 1e6), true);
  });
  return { data: d, value: numBytes & 0xffff, index: (numBytes >>> 16) & 0xffff };
}

export type SweepBlock = { freqHz: number; iq: Int8Array };

/** Splits a transfer into sweep blocks. Blocks without the 0x7F7F header are skipped. */
export function parseSweepTransfer(buf: Uint8Array): SweepBlock[] {
  const out: SweepBlock[] = [];
  for (let o = 0; o + SWEEP_BLOCK_BYTES <= buf.length; o += SWEEP_BLOCK_BYTES) {
    if (buf[o] !== 0x7f || buf[o + 1] !== 0x7f) continue;
    const dv = new DataView(buf.buffer, buf.byteOffset + o + 2, 8);
    const freqHz = dv.getUint32(0, true) + dv.getUint32(4, true) * 2 ** 32;
    out.push({ freqHz, iq: new Int8Array(buf.buffer, buf.byteOffset + o + 10, SWEEP_BLOCK_BYTES - 10) });
  }
  return out;
}

/** In-place radix-2 complex FFT. */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; ++i) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; ++k) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

export type SweepSlice = { startHz: number; binHz: number; db: Float32Array };

/** Power spectrum (dBFS, Blackman-Harris) of the block tail, as hackrf_sweep: two slices per block. */
export function blockToSlices(b: SweepBlock, fftSize = 256, rate = SWEEP_SAMPLE_RATE): SweepSlice[] {
  const re = new Float64Array(fftSize), im = new Float64Array(fftSize);
  const off = b.iq.length - fftSize * 2;
  let wsum = 0;
  for (let i = 0; i < fftSize; ++i) {
    const x = (2 * Math.PI * i) / (fftSize - 1);
    const w = 0.35875 - 0.48829 * Math.cos(x) + 0.14128 * Math.cos(2 * x) - 0.01168 * Math.cos(3 * x);
    wsum += w;
    re[i] = (b.iq[off + 2 * i] / 128) * w;
    im[i] = (b.iq[off + 2 * i + 1] / 128) * w;
  }
  fft(re, im);
  const p = (k: number) => 10 * Math.log10((re[k] ** 2 + im[k] ** 2) / (wsum * wsum) + 1e-20);
  const q = fftSize / 4, binHz = rate / fftSize;
  const s1 = new Float32Array(q), s2 = new Float32Array(q);
  for (let i = 0; i < q; ++i) { s1[i] = p(1 + (fftSize * 5) / 8 + i); s2[i] = p(1 + fftSize / 8 + i); }
  return [
    { startHz: b.freqHz, binHz, db: s1 },
    { startHz: b.freqHz + rate / 2, binHz, db: s2 },
  ];
}

export type GridDetector = "peak" | "avg" | "rms";

/**
 * Accumulates slices into a fixed grid covering [loHz, hiHz), one measurement
 * per sweep. During a sweep every grid bin collects all FFT bins that overlap
 * it (peak: max · avg: mean of dB · rms: mean power); `endSweep()` publishes
 * the result to `db`. With `holdDecayDb` > 0 (a display), `db` keeps a peak
 * hold that decays by that much once per sweep instead.
 */
export class SweepGrid {
  readonly db: Float32Array;
  readonly binHz: number;
  sweeps = 0;
  private acc: Float64Array;
  private cnt: Uint32Array;
  constructor(
    readonly loHz: number,
    readonly hiHz: number,
    bins = 2048,
    public detector: GridDetector = "peak",
    public holdDecayDb = 0
  ) {
    this.db = new Float32Array(bins).fill(NaN);
    this.binHz = (hiHz - loHz) / bins;
    this.acc = new Float64Array(bins);
    this.cnt = new Uint32Array(bins);
  }
  add(s: SweepSlice) {
    const n = this.db.length;
    for (let i = 0; i < s.db.length; ++i) {
      const v = s.db[i];
      if (!Number.isFinite(v)) continue;
      const f0 = s.startHz + i * s.binHz;
      const f1 = f0 + s.binHz;
      if (f1 <= this.loHz || f0 >= this.hiHz) continue;
      // every grid bin this FFT bin overlaps (grid bins can be finer than FFT bins)
      const k0 = Math.max(0, Math.floor((f0 - this.loHz) / this.binHz));
      const k1 = Math.min(n - 1, Math.ceil((f1 - this.loHz) / this.binHz) - 1);
      for (let k = k0; k <= k1; k++) {
        if (this.detector === "peak") this.acc[k] = this.cnt[k] ? Math.max(this.acc[k], v) : v;
        else if (this.detector === "avg") this.acc[k] += v;
        else this.acc[k] += Math.pow(10, v / 10);
        this.cnt[k]++;
      }
    }
  }
  /** Ends the current sweep: publishes its values (bins it didn't reach keep their last value). */
  endSweep() {
    for (let k = 0; k < this.db.length; k++) {
      const c = this.cnt[k];
      if (!c) continue;
      const v = this.detector === "peak" ? this.acc[k] : this.detector === "avg" ? this.acc[k] / c : 10 * Math.log10(this.acc[k] / c);
      const cur = this.db[k];
      this.db[k] = this.holdDecayDb > 0 && Number.isFinite(cur) ? Math.max(cur - this.holdDecayDb, v) : v;
      this.acc[k] = 0;
      this.cnt[k] = 0;
    }
    this.sweeps++;
  }
  /** Drops what the current sweep collected so far (e.g. while a survey is paused). */
  discard() {
    this.acc.fill(0);
    this.cnt.fill(0);
  }
  /** Strongest bins, at least `sepHz` apart. */
  peaks(count = 5, sepHz = 200_000): { hz: number; db: number }[] {
    const idx = Array.from(this.db.keys()).filter((k) => Number.isFinite(this.db[k])).sort((a, b) => this.db[b] - this.db[a]);
    const out: { hz: number; db: number }[] = [];
    for (const k of idx) {
      const hz = this.loHz + (k + 0.5) * this.binHz;
      if (out.every((p) => Math.abs(p.hz - hz) >= sepHz)) out.push({ hz, db: this.db[k] });
      if (out.length >= count) break;
    }
    return out;
  }
}

/**
 * Tells when one pass over all the ranges is complete. Feed it the tuned
 * frequency of every received block (HackRF) or hop (RTL-SDR), in arrival
 * order. A new sweep starts when the lowest frequency comes round again after
 * other frequencies, or — for a plan with a single retune, which never moves
 * — after the expected number of blocks.
 */
export class SweepCounter {
  private minHz = Infinity;
  private seenOther = false;
  private units = 0;
  constructor(public unitsPerSweep: number) {}
  /** True when this block/hop begins a new sweep (the previous one is complete). */
  next(tagHz: number): boolean {
    let boundary = false;
    if (tagHz < this.minHz) {
      boundary = this.units > 0;
      this.minHz = tagHz;
    } else if (tagHz === this.minHz) {
      if (this.seenOther) boundary = true;
      else if (this.unitsPerSweep > 0 && this.units >= this.unitsPerSweep) boundary = true;
    } else this.seenOther = true;
    if (boundary) {
      this.units = 0;
      this.seenOther = false;
    }
    this.units++;
    return boundary;
  }
}

/** Retune steps per pass for HackRF sweep ranges (as initSweepPayload rounds them). */
export function sweepSteps(rangesMHz: [number, number][], stepWidth = SWEEP_STEP_HZ): number {
  return rangesMHz.reduce((a, [lo, hi]) => a + Math.max(1, Math.ceil((hi - lo) / (stepWidth / 1e6))), 0);
}

/** Sweep blocks per retune for a dwell time (hackrf_sweep uses 16 ≈ 6.5 ms). */
export function blocksForDwell(dwellMs: number, rate = SWEEP_SAMPLE_RATE): number {
  const perBlock = (SWEEP_BLOCK_BYTES - 10) / 2 / rate; // seconds of I/Q per block
  if (!Number.isFinite(dwellMs) || dwellMs <= 0) return 16;
  return Math.max(1, Math.min(256, Math.round(dwellMs / 1000 / perBlock)));
}

/** Parses "1.2.3"/"2024.02.1"/"git-abcdef" firmware strings; returns true if older than min. */
export function firmwareOlderThan(fw: string, min = "2023.01.1"): boolean | null {
  const m = /(\d{4})\.(\d{2})\.(\d+)/.exec(fw);
  if (!m) return null; // git builds / unknown
  const [a, b] = [[+m[1], +m[2], +m[3]], min.split(".").map(Number)];
  for (let i = 0; i < 3; ++i) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}
