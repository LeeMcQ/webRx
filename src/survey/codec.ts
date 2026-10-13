// Columnar survey chunk codec (PROPOSAL §11.4–11.5).
//
//   magic "WRX1" | u32 header length | header JSON (UTF-8) | columns
//   columns: t (zig-zag delta varint ms) · lat, lon (1e-6°, zig-zag delta varint)
//            · acc (u8 m) · reason (u8) · values (u8 codes, per-column delta mod 256)
//
// Value codes: 0 = below squelch / not measured; 1..255 = base + (code−1)·q dB.
// Default q = 0.5 dB and base −160 dBm cover −160…−33 dBm.
// gzip with CompressionStream where available (browsers, Node ≥ 18).

export interface SampleRow {
  t: number;
  lat: number;
  lon: number;
  accM?: number;
  reason?: number;
  values: Float32Array; // dBm, NaN = below squelch
}

export interface ChunkHeader {
  v: 1;
  surveyId: string;
  n: number; // chunk index
  count: number;
  nValues: number;
  unit: "dBm";
  baseDb: number;
  quantDb: number;
  calibration: Record<string, unknown>;
  params?: Record<string, unknown>;
  t0: number;
  t1: number;
}

// ── varint helpers ──
export class ByteWriter {
  buf = new Uint8Array(256);
  len = 0;
  private grow(n: number) {
    if (this.len + n <= this.buf.length) return;
    let c = this.buf.length * 2;
    while (c < this.len + n) c *= 2;
    const b = new Uint8Array(c);
    b.set(this.buf.subarray(0, this.len));
    this.buf = b;
  }
  u8(v: number) {
    this.grow(1);
    this.buf[this.len++] = v & 255;
  }
  bytes(b: Uint8Array) {
    this.grow(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  u32(v: number) {
    this.grow(4);
    new DataView(this.buf.buffer).setUint32(this.len, v, true);
    this.len += 4;
  }
  /** Unsigned LEB128 for values up to 2^53. */
  varint(v: number) {
    if (v < 0 || !Number.isFinite(v)) throw new Error("varint must be ≥ 0");
    while (v >= 128) {
      this.u8((v % 128) | 128);
      v = Math.floor(v / 128);
    }
    this.u8(v);
  }
  svarint(v: number) {
    this.varint(zigzag(v));
  }
  out() {
    return this.buf.slice(0, this.len);
  }
}
export class ByteReader {
  pos = 0;
  constructor(public b: Uint8Array) {}
  u8() {
    if (this.pos >= this.b.length) throw new Error("chunk truncated");
    return this.b[this.pos++];
  }
  u32() {
    const v = new DataView(this.b.buffer, this.b.byteOffset).getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  bytes(n: number) {
    const s = this.b.subarray(this.pos, this.pos + n);
    this.pos += n;
    return s;
  }
  varint() {
    let v = 0, m = 1, c;
    do {
      c = this.u8();
      v += (c & 127) * m;
      m *= 128;
    } while (c & 128);
    return v;
  }
  svarint() {
    return unzigzag(this.varint());
  }
}
export const zigzag = (v: number) => (v >= 0 ? v * 2 : -v * 2 - 1);
export const unzigzag = (z: number) => (z % 2 === 0 ? z / 2 : -(z + 1) / 2);

export function quantiseValue(db: number, base: number, q: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(1, Math.min(255, Math.round((db - base) / q) + 1));
}
export function dequantiseValue(code: number, base: number, q: number): number {
  return code === 0 ? NaN : base + (code - 1) * q;
}

const MAGIC = [0x57, 0x52, 0x58, 0x31]; // "WRX1"

export function encodeChunk(h: Omit<ChunkHeader, "count" | "nValues" | "t0" | "t1" | "v">, rows: SampleRow[]): Uint8Array {
  const nValues = rows[0]?.values.length ?? 0;
  const header: ChunkHeader = { v: 1, ...h, count: rows.length, nValues, t0: rows[0]?.t ?? 0, t1: rows[rows.length - 1]?.t ?? 0 };
  const w = new ByteWriter();
  for (const m of MAGIC) w.u8(m);
  const hj = new TextEncoder().encode(JSON.stringify(header));
  w.u32(hj.length);
  w.bytes(hj);
  let pt = 0, pla = 0, plo = 0;
  for (const r of rows) {
    w.svarint(r.t - pt);
    pt = r.t;
  }
  for (const r of rows) {
    const la = Math.round(r.lat * 1e6);
    w.svarint(la - pla);
    pla = la;
  }
  for (const r of rows) {
    const lo = Math.round(r.lon * 1e6);
    w.svarint(lo - plo);
    plo = lo;
  }
  for (const r of rows) w.u8(Math.min(255, Math.max(0, Math.round(r.accM ?? 0))));
  for (const r of rows) w.u8(r.reason ?? 0);
  // values: column-major, delta vs previous sample mod 256
  for (let j = 0; j < nValues; j++) {
    let prev = 0;
    for (const r of rows) {
      if (r.values.length !== nValues) throw new Error("all rows in a chunk need the same value count");
      const c = quantiseValue(r.values[j], h.baseDb, h.quantDb);
      w.u8((c - prev + 256) & 255);
      prev = c;
    }
  }
  return w.out();
}

export function decodeChunk(b: Uint8Array): { header: ChunkHeader; rows: SampleRow[] } {
  const r = new ByteReader(b);
  for (const m of MAGIC) if (r.u8() !== m) throw new Error("not a webRx survey chunk");
  const hl = r.u32();
  const header = JSON.parse(new TextDecoder().decode(r.bytes(hl))) as ChunkHeader;
  const n = header.count, nv = header.nValues;
  const rows: SampleRow[] = Array.from({ length: n }, () => ({ t: 0, lat: 0, lon: 0, values: new Float32Array(nv) }));
  let a = 0;
  for (const x of rows) x.t = a += r.svarint();
  a = 0;
  for (const x of rows) x.lat = (a += r.svarint()) / 1e6;
  a = 0;
  for (const x of rows) x.lon = (a += r.svarint()) / 1e6;
  for (const x of rows) x.accM = r.u8();
  for (const x of rows) x.reason = r.u8();
  for (let j = 0; j < nv; j++) {
    let prev = 0;
    for (const x of rows) {
      prev = (prev + r.u8()) & 255;
      x.values[j] = dequantiseValue(prev, header.baseDb, header.quantDb);
    }
  }
  return { header, rows };
}

async function pipe(data: Uint8Array, stream: any): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
export const canGzip = () => typeof (globalThis as any).CompressionStream === "function";
export async function gzip(b: Uint8Array): Promise<Uint8Array> {
  return canGzip() ? pipe(b, new (globalThis as any).CompressionStream("gzip")) : b;
}
export async function gunzip(b: Uint8Array): Promise<Uint8Array> {
  if (b[0] === 0x1f && b[1] === 0x8b) return pipe(b, new (globalThis as any).DecompressionStream("gzip"));
  return b;
}

export async function sha256Hex(b: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", b as BufferSource);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
