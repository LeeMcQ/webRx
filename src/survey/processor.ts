// Survey processing pipeline (runs in a Web Worker; same code runs inline as a fallback).
// sweep dBFS grids → dBm → band reduction → noise-floor squelch w/ hysteresis →
// distance/time/change gate → rows → columnar chunk → gzip → SHA-256.

import { encodeChunk, gzip, sha256Hex, type SampleRow } from "./codec.js";
import { SampleGate, Squelch, reduceBands, type Fix } from "./gating.js";
import { toDbm, type DbmCalibration, type SweepParams } from "./params.js";

export const CHUNK_ROWS = 300;

export interface ProcInit {
  surveyKey: string;
  params: SweepParams;
  cal: DbmCalibration;
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
  }

  values(grids: Float32Array[]): Float32Array {
    const p = this.o.params;
    const parts = grids.map((g) => {
      const dbm = new Float32Array(g.length);
      for (let i = 0; i < g.length; i++) dbm[i] = Number.isFinite(g[i]) ? toDbm(g[i], this.o.cal) : -160;
      return p.reduction === "none" ? dbm : reduceBands(dbm, p.reduction === "peakmean" ? 1 : p.subBands);
    });
    const out = new Float32Array(parts.reduce((a, x) => a + x.length, 0));
    let o = 0;
    for (const x of parts) out.set(x, o), (o += x.length);
    return out;
  }

  async sample(grids: Float32Array[], fix: Fix | null, now: number): Promise<SampleOut> {
    const p = this.o.params;
    const vals = this.values(grids);
    if (!this.floor || this.floor.length !== vals.length) this.floor = vals.slice();
    const f = this.floor;
    for (let i = 0; i < vals.length; i++) f[i] = vals[i] < f[i] ? vals[i] : f[i] + 0.02 * (vals[i] - f[i]);
    const thr = Array.from(f, (x) => x + p.thresholdDb);
    if (!this.squelch) this.squelch = new Squelch(thr, p.hysteresisDb, vals.length);
    this.squelch.thresholdDb = thr;
    const { out, open } = this.squelch.apply(vals);
    if (!fix) return { kept: false, reason: "nofix" };
    const reason = this.gate.offer(fix, out.map((v) => (Number.isFinite(v) ? v : -160)));
    if (reason === "none" || reason === "jitter") return { kept: false, reason };
    const code = ({ first: 1, distance: 2, time: 3, change: 4 } as Record<string, number>)[reason] ?? 0;
    this.rows.push({ t: now, lat: fix.lat, lon: fix.lon, accM: fix.accM, reason: code, values: out });
    let mx = -Infinity;
    for (const v of out) if (Number.isFinite(v)) mx = Math.max(mx, v);
    const res: SampleOut = { kept: true, reason, trail: { lat: fix.lat, lon: fix.lon, db: open ? mx : NaN, keep: open > 0 } };
    if (this.rows.length >= CHUNK_ROWS) res.chunk = await this.flush();
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

/** Main-thread client: uses the worker when available, else runs inline. */
export class ProcessorClient {
  private w: Worker | null = null;
  private inline = { p: null as SurveyProcessor | null };
  private seq = 0;
  private wait = new Map<number, { res: (v: any) => void; rej: (e: any) => void }>();
  readonly usingWorker: boolean;
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
        this.w.onerror = () => {
          // fall back to inline processing for the rest of the session
          this.w?.terminate();
          this.w = null;
          for (const h of this.wait.values()) h.rej(new Error("survey worker failed"));
          this.wait.clear();
        };
      }
    } catch (_) {
      this.w = null;
    }
    this.usingWorker = !!this.w;
  }
  private call(m: Record<string, unknown> & { op: string }, transfer: ArrayBuffer[] = []): Promise<any> {
    const msg = { ...m, id: ++this.seq } as ToWorker;
    if (!this.w) return handle(this.inline, msg).then((x) => x.reply.result);
    return new Promise((res, rej) => {
      this.wait.set(msg.id, { res, rej });
      this.w!.postMessage(msg, transfer);
    });
  }
  init(init: ProcInit) {
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
