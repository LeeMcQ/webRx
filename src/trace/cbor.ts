// Minimal CBOR (RFC 8949) for TRACE control and context records: maps with
// text keys, arrays, text, bytes, integers, floats (half/single/double),
// booleans and null. Tags are skipped. Nesting is capped against hostile input.

export type CborValue = null | undefined | boolean | number | bigint | string | Uint8Array | CborValue[] | { [k: string]: CborValue };

const enc = new TextEncoder();
const dec = new TextDecoder();

export function encodeCbor(v: CborValue): Uint8Array {
  const out: number[] = [];
  const head = (major: number, n: number | bigint) => {
    const m = major << 5;
    if (typeof n === "bigint" || n > 0xffffffff) {
      const b = BigInt(n);
      out.push(m | 27);
      for (let i = 7; i >= 0; i--) out.push(Number((b >> BigInt(i * 8)) & 0xffn));
    } else if (n < 24) out.push(m | n);
    else if (n < 0x100) out.push(m | 24, n);
    else if (n < 0x10000) out.push(m | 25, n >> 8, n & 0xff);
    else out.push(m | 26, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  };
  const w = (x: CborValue): void => {
    if (x === null || x === undefined) out.push(0xf6);
    else if (x === false) out.push(0xf4);
    else if (x === true) out.push(0xf5);
    else if (typeof x === "bigint") x >= 0n ? head(0, x) : head(1, -1n - x);
    else if (typeof x === "number") {
      if (Number.isInteger(x) && Math.abs(x) <= Number.MAX_SAFE_INTEGER) x >= 0 ? head(0, x) : head(1, -1 - x);
      else {
        const b = new DataView(new ArrayBuffer(8));
        b.setFloat64(0, x);
        out.push(0xfb);
        for (let i = 0; i < 8; i++) out.push(b.getUint8(i));
      }
    } else if (typeof x === "string") {
      const b = enc.encode(x);
      head(3, b.length);
      for (const c of b) out.push(c);
    } else if (x instanceof Uint8Array) {
      head(2, x.length);
      for (const c of x) out.push(c);
    } else if (Array.isArray(x)) {
      head(4, x.length);
      x.forEach(w);
    } else {
      const keys = Object.keys(x).filter((k) => x[k] !== undefined);
      head(5, keys.length);
      for (const k of keys) {
        w(k);
        w(x[k]);
      }
    }
  };
  w(v);
  return Uint8Array.from(out);
}

function half(h: number): number {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
  if (e === 0) return s * f * 2 ** -24;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * 2 ** (e - 15);
}

export function decodeCbor(b: Uint8Array): CborValue {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 0;
  const need = (n: number) => {
    if (p + n > b.length) throw new Error("CBOR: truncated");
  };
  const arg = (info: number): number | bigint => {
    if (info < 24) return info;
    if (info === 24) return need(1), b[p++];
    if (info === 25) return need(2), (p += 2), dv.getUint16(p - 2);
    if (info === 26) return need(4), (p += 4), dv.getUint32(p - 4);
    if (info === 27) {
      need(8);
      const v = dv.getBigUint64(p);
      p += 8;
      return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v;
    }
    throw new Error("CBOR: indefinite lengths are not supported");
  };
  const len = (info: number) => {
    const n = arg(info);
    if (typeof n === "bigint" || n > b.length) throw new Error("CBOR: length");
    return n;
  };
  const item = (depth: number): CborValue => {
    if (depth > 32) throw new Error("CBOR: too deep");
    need(1);
    const ib = b[p++], major = ib >> 5, info = ib & 31;
    switch (major) {
      case 0:
        return arg(info);
      case 1: {
        const n = arg(info);
        return typeof n === "bigint" ? -1n - n : -1 - n;
      }
      case 2: {
        const n = len(info);
        need(n);
        return b.slice(p, (p += n));
      }
      case 3: {
        const n = len(info);
        need(n);
        return dec.decode(b.subarray(p, (p += n)));
      }
      case 4: {
        const n = len(info);
        const a: CborValue[] = [];
        for (let i = 0; i < n; i++) a.push(item(depth + 1));
        return a;
      }
      case 5: {
        const n = len(info);
        const o: { [k: string]: CborValue } = Object.create(null);
        for (let i = 0; i < n; i++) {
          const k = item(depth + 1);
          o[String(k)] = item(depth + 1);
        }
        return o;
      }
      case 6:
        arg(info);
        return item(depth + 1);
      default:
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22) return null;
        if (info === 23) return undefined;
        if (info === 25) return need(2), (p += 2), half(dv.getUint16(p - 2));
        if (info === 26) return need(4), (p += 4), dv.getFloat32(p - 4);
        if (info === 27) return need(8), (p += 8), dv.getFloat64(p - 8);
        throw new Error("CBOR: unsupported simple value");
    }
  };
  return item(0);
}
