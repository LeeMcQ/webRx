// TRACE wire format and decoders — the TypeScript twin of trace/trace-core.
// bench/trace-vectors.json (written by the Rust tests) keeps the two
// byte-for-byte compatible; see bench/trace.test.ts.

export const VERSION = 1;
export const Tier = { Control: 0, Context: 1, Spectrum: 2, Audio: 3, Iq: 4, Burst: 5, Decoded: 6, Repair: 7 } as const;
export const Codec = { None: 0, Cbor: 1, SpectrumRice: 2, Opus: 3, ImaAdpcm: 4, Bfp: 5, LosslessI8: 6, Pointing: 7 } as const;
export const Flags = { PhaseBreak: 1, Dropped: 2, Overload: 4, CalChanged: 8, ClockDegraded: 16, Key: 32, Uncalibrated: 64 } as const;
export const CLOCK_CLASSES = ["A", "B", "C", "D"] as const;

// ── CRCs ──
const T32 = new Uint32Array(256);
const T16 = new Uint16Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0x82f63b78 ^ (c >>> 1) : c >>> 1;
  T32[i] = c >>> 0;
  let d = i << 8;
  for (let k = 0; k < 8; k++) d = d & 0x8000 ? ((d << 1) ^ 0x1021) & 0xffff : (d << 1) & 0xffff;
  T16[i] = d;
}
export function crc32c(...parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = T32[(c ^ p[i]) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
}
export function crc16(...parts: Uint8Array[]): number {
  let c = 0xffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = (T16[((c >> 8) ^ p[i]) & 0xff] ^ (c << 8)) & 0xffff;
  return c;
}

// ── varint (QUIC) ──
export function readVarint(b: Uint8Array, pos: number): [bigint, number] {
  if (pos >= b.length) throw new Error("truncated");
  const len = 1 << (b[pos] >> 6);
  if (pos + len > b.length) throw new Error("truncated");
  let v = BigInt(b[pos] & 0x3f);
  for (let i = 1; i < len; i++) v = (v << 8n) | BigInt(b[pos + i]);
  return [v, len];
}

export const zigzag = (v: number) => ((v << 1) ^ (v >> 31)) >>> 0;
export const unzigzag = (u: number) => (u >>> 1) ^ -(u & 1);

// ── frames ──
export type Frame = {
  full: boolean;
  tier: number;
  flags: number;
  epoch: number;
  sampleIndex: bigint;
  timeNs: bigint;
  timeFrac: number;
  clockClass: number;
  codec: number;
  contextRev: number;
  seq: number;
  deltaIndex: bigint;
  payload: Uint8Array;
};

const FULL = 40;

/** Parses and checks one frame (full or compact header). Throws on a bad frame. */
export function parseFrame(b: Uint8Array): Frame {
  if (!b.length) throw new Error("truncated");
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (!(b[0] & 0x80)) {
    if (b.length < FULL) throw new Error("truncated");
    if (b[0] !== VERSION) throw new Error(`unsupported TRACE version ${b[0]}`);
    const len = dv.getUint32(32, true);
    if (b.length < FULL + len) throw new Error("truncated");
    const payload = b.subarray(FULL, FULL + len);
    if (crc32c(b.subarray(0, 36), payload) !== dv.getUint32(36, true)) throw new Error("checksum mismatch");
    if (b[1] > 7) throw new Error("unknown tier");
    return {
      full: true,
      tier: b[1],
      flags: dv.getUint16(2, true),
      epoch: dv.getUint32(4, true),
      sampleIndex: dv.getBigUint64(8, true),
      timeNs: dv.getBigUint64(16, true),
      timeFrac: dv.getUint32(24, true),
      clockClass: b[28],
      codec: b[29],
      contextRev: dv.getUint16(30, true),
      seq: 0,
      deltaIndex: 0n,
      payload,
    };
  }
  const [delta, n] = readVarint(b, 2);
  const revAt = 2 + n, crcAt = revAt + 1;
  if (b.length < crcAt + 2) throw new Error("truncated");
  const payload = b.subarray(crcAt + 2);
  if (crc16(b.subarray(0, crcAt), payload) !== dv.getUint16(crcAt, true)) throw new Error("checksum mismatch");
  const f = b[0] & 0x0f;
  return {
    full: false,
    tier: (b[0] >> 4) & 7,
    flags: (f & 1 ? Flags.PhaseBreak : 0) | (f & 2 ? Flags.Dropped : 0) | (f & 4 ? Flags.Overload : 0) | (f & 8 ? Flags.Uncalibrated : 0),
    epoch: 0,
    sampleIndex: 0n,
    timeNs: 0n,
    timeFrac: 0,
    clockClass: 3,
    codec: 0,
    contextRev: b[revAt],
    seq: b[1],
    deltaIndex: delta,
    payload,
  };
}

/** Rebuilds compact frames from their group's full header; flags lost objects. */
export class TrackReader {
  group: Frame | null = null;
  private index = 0n;
  private seq = 0;
  accept(f: Frame): (Frame & { gap: boolean }) | null {
    if (f.full) {
      this.group = f;
      this.index = f.sampleIndex;
      this.seq = 0;
      return { ...f, gap: false };
    }
    const g = this.group;
    if (!g) return null;
    const gap = f.seq !== ((this.seq + 1) & 0xff);
    this.seq = f.seq;
    this.index += f.deltaIndex;
    return { ...f, gap, epoch: g.epoch, codec: g.codec, clockClass: g.clockClass, sampleIndex: this.index };
  }
}

/** Writes a full-header frame (client → station messages). */
export function writeFullFrame(h: { tier: number; flags?: number; epoch?: number; sampleIndex?: bigint; timeNs?: bigint; timeFrac?: number; clockClass?: number; codec: number; contextRev?: number }, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(FULL + payload.length);
  const dv = new DataView(out.buffer);
  out[0] = VERSION;
  out[1] = h.tier;
  dv.setUint16(2, h.flags ?? 0, true);
  dv.setUint32(4, h.epoch ?? 0, true);
  dv.setBigUint64(8, h.sampleIndex ?? 0n, true);
  dv.setBigUint64(16, h.timeNs ?? 0n, true);
  dv.setUint32(24, h.timeFrac ?? 0, true);
  out[28] = h.clockClass ?? 3;
  out[29] = h.codec;
  dv.setUint16(30, h.contextRev ?? 0, true);
  dv.setUint32(32, payload.length, true);
  dv.setUint32(36, crc32c(out.subarray(0, 36), payload), true);
  out.set(payload, FULL);
  return out;
}

// ── bits + Rice ──
export class BitReader {
  private pos = 0;
  private acc = 0;
  private n = 0;
  constructor(private b: Uint8Array) {}
  get(bits: number): number {
    if (bits === 0) return 0;
    let v = 0;
    let left = bits;
    while (left > 0) {
      if (this.n === 0) {
        if (this.pos >= this.b.length) throw new Error("truncated");
        this.acc = this.b[this.pos++];
        this.n = 8;
      }
      const take = Math.min(left, this.n);
      const part = (this.acc >> (this.n - take)) & ((1 << take) - 1);
      v = v * 2 ** take + part;
      this.n -= take;
      left -= take;
    }
    return v >>> 0;
  }
  unary(cap: number): number {
    let c = 0;
    while (c < cap) {
      if (this.get(1) === 0) return c;
      c++;
    }
    return cap;
  }
}

export function riceDecode(r: BitReader, n: number, out: number[] = []): number[] {
  let left = n;
  while (left > 0) {
    const len = Math.min(left, 32);
    const k = r.get(5);
    if (k > 24) throw new Error("rice parameter");
    for (let i = 0; i < len; i++) {
      const q = r.unary(24);
      out.push(q < 24 ? (q * 2 ** k + r.get(k)) >>> 0 : r.get(32));
    }
    left -= len;
  }
  return out;
}

// ── spectrum ──
export class SpectrumDecoder {
  private prev: Int32Array | null = null;
  private step = 0;
  reset() {
    this.prev = null;
  }
  /** Returns levels in dB (dBm or dBFS as the context says), or null when a delta arrives without its key frame. */
  decode(p: Uint8Array): Float32Array | null {
    if (p.length < 5) throw new Error("truncated");
    const n = p[0] | (p[1] << 8), step = p[2] | (p[3] << 8), mode = p[4];
    if (!step) throw new Error("step");
    const res = riceDecode(new BitReader(p.subarray(5)), n);
    const q = new Int32Array(n);
    if (mode === 0) {
      let acc = 0;
      for (let i = 0; i < n; i++) q[i] = acc = (acc + unzigzag(res[i])) | 0;
    } else if (mode === 1) {
      if (!this.prev || this.prev.length !== n || this.step !== step) return null;
      for (let i = 0; i < n; i++) q[i] = (this.prev[i] + unzigzag(res[i])) | 0;
    } else throw new Error("spectrum mode");
    this.prev = q;
    this.step = step;
    const out = new Float32Array(n);
    const s = step / 100;
    for (let i = 0; i < n; i++) out[i] = q[i] * s;
    return out;
  }
}

// ── I/Q: block floating point ──
export function bfpDecode(p: Uint8Array): Int16Array {
  if (p.length < 6) throw new Error("truncated");
  const m = p[0], block = p[1];
  const n = new DataView(p.buffer, p.byteOffset + 2, 4).getUint32(0, true);
  if (m < 2 || m > 16 || !block || n > 1 << 24) throw new Error("bfp parameters");
  const r = new BitReader(p.subarray(6));
  const out = new Int16Array(2 * n);
  let o = 0;
  let left = 2 * n;
  while (left > 0) {
    const len = Math.min(left, 2 * block);
    const e = r.get(4);
    for (let i = 0; i < len; i++) {
      const raw = r.get(m);
      const mant = (raw << (32 - m)) >> (32 - m);
      out[o++] = Math.max(-32768, Math.min(32767, mant * 2 ** e));
    }
    left -= len;
  }
  return out;
}

// ── bursts: lossless 8-bit ──
export function burstDecode(p: Uint8Array): Int8Array {
  if (p.length < 5) throw new Error("truncated");
  const n = new DataView(p.buffer, p.byteOffset, 4).getUint32(0, true);
  if (n > 1 << 26) throw new Error("burst length");
  const order = p[4];
  const res = riceDecode(new BitReader(p.subarray(5)), 2 * n);
  const out = new Int8Array(2 * n);
  let pi = 0, pq = 0;
  for (let k = 0; k < n; k++) {
    let i = unzigzag(res[2 * k]), q = unzigzag(res[2 * k + 1]);
    if (order === 1) {
      i += pi;
      q += pq;
      pi = i;
      pq = q;
    } else if (order !== 0) throw new Error("burst order");
    out[2 * k] = i;
    out[2 * k + 1] = q;
  }
  return out;
}

// ── audio: IMA ADPCM ──
const IDX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];
const STEP = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
export function adpcmDecode(p: Uint8Array): { rate: number; pcm: Int16Array } {
  if (p.length < 8) throw new Error("truncated");
  const dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
  const rate = dv.getUint32(0, true);
  let pred = dv.getInt16(4, true), idx = p[6];
  if (idx > 88) throw new Error("adpcm index");
  const out = new Int16Array((p.length - 8) * 2);
  let o = 0;
  const step = (code: number) => {
    const s = STEP[idx];
    let diff = s >> 3;
    if (code & 1) diff += s >> 2;
    if (code & 2) diff += s >> 1;
    if (code & 4) diff += s;
    pred = code & 8 ? pred - diff : pred + diff;
    pred = Math.max(-32768, Math.min(32767, pred));
    idx = Math.max(0, Math.min(88, idx + IDX[code]));
    out[o++] = pred;
  };
  for (let i = 8; i < p.length; i++) {
    step(p[i] & 0x0f);
    step(p[i] >> 4);
  }
  return { rate, pcm: out };
}

// ── pointing ──
export type PointingSample = { index: bigint; heading: number; pitch: number | null; roll: number | null; accuracy: number | null };
export type PointingFrame = { magnetic: boolean; declination: number | null; source: number; element: number; samples: PointingSample[] };
export const POINTING_SOURCES = ["compass", "rotator", "gps course", "manual", "array element", "client phone"];

export function pointingDecode(base: bigint, p: Uint8Array): PointingFrame {
  if (p.length < 6) throw new Error("truncated");
  const dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
  const n = p[0];
  const dec = dv.getInt16(2, true);
  const opt = (v: number) => (v === -32768 ? null : v / 100);
  const f: PointingFrame = { magnetic: p[1] !== 0, declination: opt(dec), source: p[4], element: p[5], samples: [] };
  let pos = 6;
  let idx = base;
  for (let k = 0; k < n; k++) {
    const [d, len] = readVarint(p, pos);
    pos += len;
    if (p.length < pos + 7) throw new Error("truncated");
    idx += d;
    const h = dv.getUint16(pos, true);
    if (h >= 36000) throw new Error("heading");
    const acc = p[pos + 6];
    f.samples.push({ index: idx, heading: h / 100, pitch: opt(dv.getInt16(pos + 2, true)), roll: opt(dv.getInt16(pos + 4, true)), accuracy: acc === 255 ? null : acc / 10 });
    pos += 7;
  }
  return f;
}

/** Heading at a sample index, interpolated on the shortest arc. */
export function headingAt(s: PointingSample[], index: bigint): number | null {
  let i = 0;
  while (i < s.length && s[i].index <= index) i++;
  if (i === 0 || i === s.length) return null;
  const a = s[i - 1], b = s[i];
  const span = Number(b.index - a.index);
  const f = span > 0 ? Number(index - a.index) / span : 0;
  const d = ((b.heading - a.heading + 540) % 360) - 180;
  return (((a.heading + f * d) % 360) + 360) % 360;
}

// ── clock ──
export type ClockRecord = { class: number; err_ns: number; n0: number | bigint; t0_ns: number | bigint; t0_frac: number; fs: number; eps_ppb: number; lock: string; holdover_s: number; last_pps_index?: number | null; asserted: boolean };
const GPS_UNIX_S = 315964800, LEAP = 18;

/** GPS time (ns) of a sample index under a clock record. */
export function timeOf(c: ClockRecord, n: bigint): bigint {
  const dn = Number(n - BigInt(c.n0));
  const ns = (dn / c.fs) * 1e9 * (1 - c.eps_ppb / 1e9);
  return BigInt(c.t0_ns) + BigInt(Math.round(ns));
}
export const gpsNsToUnixMs = (g: bigint) => Number(g / 1000000n) + (GPS_UNIX_S - LEAP) * 1000;
export const unixMsToGpsNs = (ms: number) => BigInt(Math.round(ms)) * 1000000n + BigInt(GPS_UNIX_S - LEAP) * -1000000000n;
