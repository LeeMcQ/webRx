// Survey processing pipeline (runs in a Web Worker; same code runs inline as a fallback).
// sweep dBFS grids → dBm → band reduction → noise-floor squelch w/ hysteresis →
// distance/time/change gate → rows → columnar chunk → gzip → SHA-256.
//
// The squelch threshold sits a set number of dB above the noise floor, which is
// estimated across frequency (10th percentile over ~10 MHz blocks) and smoothed
// over time — so a steady carrier stays above it however long it is on.

import { encodeChunk, gzip, sha256Hex, type SampleRow } from "./codec.js";
import { SampleGate, Squelch, reduceBands, reduceFloor, spectralFloor, type Fix } from "./gating.js";
import { toDbm, type DbmCalibration, type SweepParams } from "./params.js";

/** Rows per chunk (≈ 4 min of driving at 1 sample/s) … */
export const CHUNK_ROWS = 256;
/** … or at most this old, so a stop, crash or closed tab never loses more than a minute. */
export const FLUSH_MS = 60_000;
/** Width of the noise-floor percentile blocks. */
export const FLOOR_BLOCK_HZ = 10e6;
/** Time smoothing of the noise floor (per sample). */
export const FLOOR_ALPHA = 0.2;

export interface ProcInit {
  surveyKey: string;
  params: SweepParams;
  cal: DbmCalibration;
  /** First chunk number (continuing after a worker restart). */
  firstN?: number;
}
export interface ChunkOut {
  n: number;
  bytes: Uint8Array;
  sha256: string;
  rawLen: number;
  snapshot?: boolean;
}
export interface SampleOut {
  kept: boolean;
  reason: string;
  trail?: { lat: number; lon: number; db: number; keep: boolean };
  chunk?: ChunkOut;
}

export class SurveyProcessor {
  private gate: SampleGate;
  private squelch: Squelch | null = null;
  private floor: Float32Array | null = null;
  private rows: SampleRow[] = [];
  private n = 0;
  constructor(public o: ProcInit) {
    this.gate = new SampleGate({ distM: o.params.distM, timeS: o.params.timeS, changeDb: o.params.changeDb });
    this.n = o.firstN ?? 0;
  }

  private groups() {
    const p = this.o.params;
    return p.reduction === "peakmean" ? 1 : p.subBands;
  }

  /** Per-range dBm spectra (NaN = not measured yet). */
  private dbm(grids: Float32Array[]): Float32Array[] {
    return grids.map((g) => {
      const d = new Float32Array(g.length);
      for (let i = 0; i < g.length; i++) d[i] = Number.isFinite(g[i]) ? toDbm(g[i], this.o.cal) : NaN;
      return d;
    });
  }

  private concat(parts: Float32Array[]) {
    const out = new Float32Array(parts.reduce((a, x) => a + x.length, 0));
    let o = 0;
    for (const x of parts) out.set(x, o), (o += x.length);
    return out;
  }

  /** Stored values: dBm per bin, or peak + mean per band; unmeasured → −160. */
  values(grids: Float32Array[]): Float32Array {
    const p = this.o.params;
    return this.concat(
      this.dbm(grids).map((d) => {
        const v = d.map((x) => (Number.isFinite(x) ? x : -160));
        return p.reduction === "none" ? v : reduceBands(v, this.groups());
      })
    );
  }

  /** Noise floor matching `values` (same layout). */
  floorFor(grids: Float32Array[]): Float32Array {
    const p = this.o.params;
    return this.concat(
      this.dbm(grids).map((d, i) => {
        const r = p.ranges[i];
        const binHz = r ? ((r.stopMHz - r.startMHz) * 1e6) / Math.max(1, d.length) : 1e6;
        const f = spectralFloor(d, Math.max(16, FLOOR_BLOCK_HZ / binHz));
        return p.reduction === "none" ? f : reduceFloor(f, this.groups());
      })
    );
  }

  async sample(grids: Float32Array[], fix: Fix | null, now: number): Promise<SampleOut> {
    const p = this.o.params;
    const vals = this.values(grids);
    const nf = this.floorFor(grids);
    if (!this.floor || this.floor.length !== vals.length) this.floor = nf.slice();
    const f = this.floor;
    for (let i = 0; i < f.length; i++) {
      if (!Number.isFinite(nf[i])) continue;
      f[i] = Number.isFinite(f[i]) ? f[i] + FLOOR_ALPHA * (nf[i] - f[i]) : nf[i];
    }
    // unmeasured bins can't open: threshold +∞
    const thr = Array.from(f, (x) => (Number.isFinite(x) ? x + p.thresholdDb : Infinity));
    if (!this.squelch) this.squelch = new Squelch(thr, p.hysteresisDb, vals.length);
    this.squelch.thresholdDb = thr;
    const { out, open } = this.squelch.apply(vals);
    let res: SampleOut;
    const reason = fix ? this.gate.offer(fix, out.map((v) => (Number.isFinite(v) ? v : -160))) : "nofix";
    if (!fix || reason === "none" || reason === "jitter" || reason === "nofix") res = { kept: false, reason };
    else {
      const code = ({ first: 1, distance: 2, time: 3, change: 4 } as Record<string, number>)[reason] ?? 0;
      this.rows.push({ t: now, lat: fix.lat, lon: fix.lon, accM: fix.accM, reason: code, values: out });
      let mx = -Infinity;
      for (const v of out) if (Number.isFinite(v)) mx = Math.max(mx, v);
      res = { kept: true, reason, trail: { lat: fix.lat, lon: fix.lon, db: open ? mx : NaN, keep: open > 0 } };
    }
    if (this.rows.length >= CHUNK_ROWS || (this.rows.length && now - this.rows[0].t >= FLUSH_MS)) res.chunk = await this.flush();
    return res;
  }

  async snapshot(grids: Float32Array[], fix: Fix | null, now: number, ranges: unknown, why: string): Promise<ChunkOut> {
    const values = new Float32Array(grids.reduce((a, g) => a + g.length, 0));
    let o = 0;
    for (const g of grids) {
      for (let i = 0; i < g.length; i++) values[o + i] = Number.isFinite(g[i]) ? toDbm(g[i], this.o.cal) : NaN;
      o += g.length;
    }
    const row: SampleRow = { t: now, lat: fix?.lat ?? 0, lon: fix?.lon ?? 0, accM: fix?.accM, reason: 9, values };
    return { ...(await this.encode([row], { snapshot: why, ranges, bins: grids.map((g) => g.length) })), snapshot: true };
  }

  async flush(): Promise<ChunkOut | undefined> {
    if (!this.rows.length) return undefined;
    return this.encode(this.rows.splice(0));
  }

  private async encode(rows: SampleRow[], extra: Record<string, unknown> = {}): Promise<ChunkOut> {
    const p = this.o.params;
    const n = this.n++;
    const raw = encodeChunk(
      { surveyId: this.o.surveyKey, n, unit: "dBm", baseDb: -160, quantDb: p.quantDb, calibration: { ...this.o.cal }, params: { ...extra, reduction: p.reduction, subBands: p.subBands, ranges: p.ranges } },
      rows
    );
    const bytes = await gzip(raw);
    return { n, bytes, sha256: await sha256Hex(bytes), rawLen: raw.length };
  }
}

// ── worker protocol ──
export type ToWorker =
  | { id: number; op: "init"; init: ProcInit }
  | { id: number; op: "sample"; grids: Float32Array[]; fix: Fix | null; now: number }
  | { id: number; op: "snapshot"; grids: Float32Array[]; fix: Fix | null; now: number; ranges: unknown; why: string }
  | { id: number; op: "flush" };

/** Handles one message; returns the reply and the buffers to transfer. */
export async function handle(state: { p: SurveyProcessor | null }, m: ToWorker): Promise<{ reply: any; transfer: ArrayBuffer[] }> {
  if (m.op === "init") {
    state.p = new SurveyProcessor(m.init);
    return { reply: { id: m.id, ok: true }, transfer: [] };
  }
  if (!state.p) throw new Error("survey worker not initialised");
  let r: any;
  if (m.op === "sample") r = await state.p.sample(m.grids, m.fix, m.now);
  else if (m.op === "snapshot") r = await state.p.snapshot(m.grids, m.fix, m.now, m.ranges, m.why);
  else r = await state.p.flush();
  const c: ChunkOut | undefined = r?.chunk ?? (r && "bytes" in r ? r : undefined);
  return { reply: { id: m.id, ok: true, result: r }, transfer: c ? [c.bytes.buffer as ArrayBuffer] : [] };
}

/**
 * Main-thread client: uses the worker when available, else runs inline. If the
 * worker dies mid-survey, processing continues inline from the next chunk
 * number (rows the worker held since its last chunk are lost — at most
 * FLUSH_MS of samples — and reported through `onFallback`).
 */
export class ProcessorClient {
  private w: Worker | null = null;
  private inline = { p: null as SurveyProcessor | null };
  private seq = 0;
  private wait = new Map<number, { res: (v: any) => void; rej: (e: any) => void }>();
  private initArgs: ProcInit | null = null;
  private nextN = 0;
  onFallback?: (why: string) => void;
  constructor(workerUrl: string | null) {
    try {
      if (workerUrl && typeof Worker === "function") {
        this.w = new Worker(workerUrl);
        this.w.onmessage = (e) => {
          const d = e.data, h = this.wait.get(d.id);
          if (!h) return;
          this.wait.delete(d.id);
          d.ok ? h.res(d.result) : h.rej(new Error(d.error));
        };
        this.w.onerror = (e) => {
          e.preventDefault?.();
          this.fallBack(`survey worker failed${(e as ErrorEvent).message ? `: ${(e as ErrorEvent).message}` : ""}`);
        };
      }
    } catch (_) {
      this.w = null;
    }
  }
  get usingWorker() {
    return !!this.w;
  }
  private fallBack(why: string) {
    this.w?.terminate();
    this.w = null;
    for (const h of this.wait.values()) h.rej(new Error(why));
    this.wait.clear();
    if (this.initArgs) this.inline.p = new SurveyProcessor({ ...this.initArgs, firstN: this.nextN });
    this.onFallback?.(why);
  }
  private seen(r: any) {
    const c: ChunkOut | undefined = r?.chunk ?? (r && typeof r === "object" && "bytes" in r ? r : undefined);
    if (c) this.nextN = Math.max(this.nextN, c.n + 1);
    return r;
  }
  private call(m: Record<string, unknown> & { op: string }, transfer: ArrayBuffer[] = []): Promise<any> {
    const msg = { ...m, id: ++this.seq } as ToWorker;
    if (!this.w) return handle(this.inline, msg).then((x) => this.seen(x.reply.result));
    return new Promise((res, rej) => {
      this.wait.set(msg.id, { res: (v) => res(this.seen(v)), rej });
      try {
        this.w!.postMessage(msg, transfer);
      } catch (e: any) {
        this.wait.delete(msg.id);
        this.fallBack(`survey worker unavailable: ${e?.message ?? e}`);
        rej(e);
      }
    });
  }
  init(init: ProcInit) {
    this.initArgs = init;
    this.nextN = init.firstN ?? 0;
    return this.call({ op: "init", init });
  }
  /** `grids` are copies; their buffers are transferred (zero-copy) to the worker. */
  sample(grids: Float32Array[], fix: Fix | null, now: number): Promise<SampleOut> {
    return this.call({ op: "sample", grids, fix, now }, grids.map((g) => g.buffer as ArrayBuffer));
  }
  snapshot(grids: Float32Array[], fix: Fix | null, now: number, ranges: unknown, why: string): Promise<ChunkOut> {
    return this.call({ op: "snapshot", grids, fix, now, ranges, why }, grids.map((g) => g.buffer as ArrayBuffer));
  }
  flush(): Promise<ChunkOut | undefined> {
    return this.call({ op: "flush" });
  }
  terminate() {
    this.w?.terminate();
    this.w = null;
  }
}
