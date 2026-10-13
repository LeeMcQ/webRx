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

/** Accumulates slices into a fixed grid covering [loHz, hiHz). */
export class SweepGrid {
  readonly db: Float32Array;
  readonly binHz: number;
  sweeps = 0;
  private lastStart = -1;
  constructor(readonly loHz: number, readonly hiHz: number, bins = 2048) {
    this.db = new Float32Array(bins).fill(NaN);
    this.binHz = (hiHz - loHz) / bins;
  }
  add(s: SweepSlice) {
    if (s.startHz < this.lastStart) this.sweeps++;
    this.lastStart = s.startHz;
    for (let i = 0; i < s.db.length; ++i) {
      const f = s.startHz + (i + 0.5) * s.binHz;
      const k = Math.floor((f - this.loHz) / this.binHz);
      if (k < 0 || k >= this.db.length) continue;
      const cur = this.db[k];
      this.db[k] = Number.isNaN(cur) ? s.db[i] : Math.max(cur - 0.5, s.db[i]); // light peak-hold with decay
    }
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

/** Parses "1.2.3"/"2024.02.1"/"git-abcdef" firmware strings; returns true if older than min. */
export function firmwareOlderThan(fw: string, min = "2023.01.1"): boolean | null {
  const m = /(\d{4})\.(\d{2})\.(\d+)/.exec(fw);
  if (!m) return null; // git builds / unknown
  const [a, b] = [[+m[1], +m[2], +m[3]], min.split(".").map(Number)];
  for (let i = 0; i < 3; ++i) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}
