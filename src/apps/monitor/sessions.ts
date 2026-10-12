// Spectrum sessions: timestamped spectrum frames + GPS + heading + levels,
// recorded from the shared stream into IndexedDB, exported/imported as JSON
// or CSV, and played back. Separate from the thesis CSV recorder (which is
// unchanged).

export type SessionMeta = {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number;
  frames: number;
  bytes: number;
  device: string;
  units: string;
  centreHz: number;
  rateHz: number;
};

/** One stored frame. `s` is the spectrum quantised to 0.5 dB steps above `b`. */
export type Frame = {
  t: number;
  c: number; // centre Hz
  r: number; // sample rate Hz
  b: number; // dB base
  s: Uint8Array;
  lat?: number;
  lon?: number;
  acc?: number;
  spd?: number;
  crs?: number;
  hdg?: number;
  peak?: number;
  peakHz?: number;
  band?: number;
  spec?: number;
  dt?: number;
};

export const MAX_BINS = 1024;
const DB = "webrx-sessions";

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" });
      if (!db.objectStoreNames.contains("frames")) db.createObjectStore("frames");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

/** Downsample (max-pool) to ≤ MAX_BINS and quantise to 0.5 dB. */
export function quantise(spec: Float32Array): { b: number; s: Uint8Array } {
  const n = spec.length;
  const m = Math.min(n, MAX_BINS);
  const pooled = new Float32Array(m);
  for (let i = 0; i < m; ++i) {
    const k0 = Math.floor((i * n) / m), k1 = Math.max(k0 + 1, Math.floor(((i + 1) * n) / m));
    let v = -Infinity;
    for (let k = k0; k < k1; ++k) if (spec[k] > v) v = spec[k];
    pooled[i] = Number.isFinite(v) ? v : -200;
  }
  let lo = Infinity;
  for (const v of pooled) if (v > -199 && v < lo) lo = v;
  const b = Number.isFinite(lo) ? Math.floor(lo) : -150;
  const s = new Uint8Array(m);
  for (let i = 0; i < m; ++i) s[i] = Math.max(0, Math.min(255, Math.round((pooled[i] - b) * 2)));
  return { b, s };
}

export function dequantise(f: Frame): Float32Array {
  const out = new Float32Array(f.s.length);
  for (let i = 0; i < out.length; ++i) out[i] = f.b + f.s[i] / 2;
  return out;
}

const frameBytes = (f: Frame) => f.s.length + 120;

export async function listSessions(): Promise<SessionMeta[]> {
  const db = await idb();
  return new Promise((res, rej) => {
    const r = db.transaction("sessions").objectStore("sessions").getAll();
    r.onsuccess = () => res((r.result as SessionMeta[]).sort((a, b) => b.startedAt - a.startedAt));
    r.onerror = () => rej(r.error);
  });
}

export async function putMeta(m: SessionMeta) {
  const db = await idb();
  const tx = db.transaction("sessions", "readwrite");
  tx.objectStore("sessions").put(m);
  await done(tx);
}

export async function appendFrames(m: SessionMeta, start: number, frames: Frame[]) {
  const db = await idb();
  const tx = db.transaction(["sessions", "frames"], "readwrite");
  const fs = tx.objectStore("frames");
  frames.forEach((f, i) => fs.put(f, `${m.id}:${String(start + i).padStart(7, "0")}`));
  tx.objectStore("sessions").put(m);
  await done(tx);
}

export async function loadFrames(id: string): Promise<Frame[]> {
  const db = await idb();
  return new Promise((res, rej) => {
    const r = db.transaction("frames").objectStore("frames").getAll(IDBKeyRange.bound(`${id}:`, `${id}:\uffff`));
    r.onsuccess = () => res(r.result as Frame[]);
    r.onerror = () => rej(r.error);
  });
}

export async function deleteSession(id: string) {
  const db = await idb();
  const tx = db.transaction(["sessions", "frames"], "readwrite");
  tx.objectStore("sessions").delete(id);
  tx.objectStore("frames").delete(IDBKeyRange.bound(`${id}:`, `${id}:\uffff`));
  await done(tx);
}

export async function renameSession(id: string, name: string) {
  const all = await listSessions();
  const m = all.find((x) => x.id === id);
  if (!m) return;
  m.name = name;
  await putMeta(m);
}

// ── recorder ──

export type Limits = { maxMB: number; maxMinutes: number; fps: number };

export class SessionRecorder {
  meta: SessionMeta | null = null;
  private buf: Frame[] = [];
  private written = 0;
  private lastAt = 0;
  private flushing: Promise<void> = Promise.resolve();
  limits: Limits = { maxMB: 100, maxMinutes: 120, fps: 4 };
  onLimit?: (why: string) => void;
  onChange?: () => void;
  error = "";

  get active() {
    return this.meta !== null;
  }

  start(name: string, device: string, units: string, centreHz: number, rateHz: number) {
    const now = Date.now();
    this.meta = { id: `s${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, startedAt: now, endedAt: now, frames: 0, bytes: 0, device, units, centreHz, rateHz };
    this.buf = [];
    this.written = 0;
    this.lastAt = 0;
    this.error = "";
    putMeta(this.meta).catch((e) => (this.error = String(e?.message ?? e)));
    this.onChange?.();
  }

  /** Offer a frame; it is kept at most `fps` times per second. */
  offer(make: () => Frame) {
    if (!this.meta) return;
    const now = performance.now();
    if (now - this.lastAt < 1000 / this.limits.fps) return;
    this.lastAt = now;
    const f = make();
    this.buf.push(f);
    this.meta.frames++;
    this.meta.bytes += frameBytes(f);
    this.meta.endedAt = f.t;
    if (this.meta.bytes > this.limits.maxMB * 1e6) return this.limitHit(`size limit (${this.limits.maxMB} MB)`);
    if (this.meta.endedAt - this.meta.startedAt > this.limits.maxMinutes * 60000) return this.limitHit(`time limit (${this.limits.maxMinutes} min)`);
    if (this.buf.length >= 8) this.flush();
  }

  private limitHit(why: string) {
    this.stop();
    this.onLimit?.(why);
  }

  flush(): Promise<void> {
    if (!this.meta || !this.buf.length) return this.flushing;
    const m = { ...this.meta };
    const batch = this.buf;
    const start = this.written;
    this.buf = [];
    this.written += batch.length;
    this.flushing = this.flushing
      .then(() => appendFrames(m, start, batch))
      .catch((e) => {
        this.error = String(e?.message ?? e);
      });
    return this.flushing;
  }

  async stop(): Promise<SessionMeta | null> {
    const m = this.meta;
    if (!m) return null;
    await this.flush();
    await this.flushing;
    await putMeta(m).catch(() => {});
    this.meta = null;
    this.onChange?.();
    return m;
  }
}

// ── export / import ──

function b64(u: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; ++i) u[i] = bin.charCodeAt(i);
  return u;
}

export async function exportJson(m: SessionMeta): Promise<string> {
  const frames = await loadFrames(m.id);
  return JSON.stringify({ format: "webrx-session", version: 1, meta: m, frames: frames.map((f) => ({ ...f, s: b64(f.s) })) });
}

export async function exportCsv(m: SessionMeta): Promise<string> {
  const frames = await loadFrames(m.id);
  const head = ["timestamp", "center_freq_hz", "sample_rate_hz", "latitude", "longitude", "gps_accuracy_m", "speed_kmh", "course_deg", "heading_deg", "peak_db", "peak_freq_hz", "band_mean_db", "spectrum_mean_db", "dt_level_db", "spectrum_db"];
  const v = (x: number | undefined, d = 2) => (x === undefined || !Number.isFinite(x) ? "" : x.toFixed(d));
  const rows = frames.map((f) => [new Date(f.t).toISOString(), f.c, f.r, v(f.lat, 6), v(f.lon, 6), v(f.acc, 1), v(f.spd, 1), v(f.crs, 0), v(f.hdg, 0), v(f.peak), v(f.peakHz, 0), v(f.band), v(f.spec), v(f.dt), `"${Array.from(dequantise(f), (x) => x.toFixed(1)).join(" ")}"`].join(","));
  return [head.join(","), ...rows].join("\n");
}

export async function importJson(text: string): Promise<SessionMeta> {
  const j = JSON.parse(text);
  if (j?.format !== "webrx-session" || !Array.isArray(j.frames)) throw new Error("Not a webRx session file");
  const frames: Frame[] = j.frames.map((f: any) => ({ ...f, s: unb64(String(f.s)) }));
  const now = Date.now();
  const m: SessionMeta = { ...j.meta, id: `s${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, frames: frames.length, bytes: frames.reduce((a, f) => a + frameBytes(f), 0) };
  m.name = `${m.name ?? "Imported"} (imported)`;
  for (let i = 0; i < frames.length; i += 500) await appendFrames(m, i, frames.slice(i, i + 500));
  if (!frames.length) await putMeta(m);
  return m;
}

// ── player ──

export class Player {
  frames: Frame[] = [];
  meta: SessionMeta | null = null;
  idx = 0;
  playing = false;
  speed = 1;
  private timer: number | null = null;
  private wall = 0;
  private t0 = 0;
  onFrame?: (f: Frame, i: number) => void;
  onState?: () => void;

  load(meta: SessionMeta, frames: Frame[]) {
    this.stop();
    this.meta = meta;
    this.frames = frames.sort((a, b) => a.t - b.t);
    this.idx = 0;
    this.onState?.();
  }

  get duration() {
    return this.frames.length ? this.frames[this.frames.length - 1].t - this.frames[0].t : 0;
  }
  get position() {
    return this.frames.length ? this.frames[this.idx].t - this.frames[0].t : 0;
  }

  play() {
    if (!this.frames.length) return;
    if (this.idx >= this.frames.length - 1) this.idx = 0;
    this.playing = true;
    this.wall = performance.now();
    this.t0 = this.frames[this.idx].t;
    this.emit();
    this.timer = window.setInterval(() => this.tick(), 40);
    this.onState?.();
  }

  pause() {
    this.playing = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.onState?.();
  }

  stop() {
    this.pause();
    this.frames = [];
    this.meta = null;
    this.idx = 0;
  }

  setSpeed(s: number) {
    if (this.playing && this.frames.length) {
      this.wall = performance.now();
      this.t0 = this.frames[this.idx].t;
    }
    this.speed = s;
  }

  seek(fraction: number) {
    if (!this.frames.length) return;
    const target = this.frames[0].t + fraction * this.duration;
    let i = 0;
    while (i < this.frames.length - 1 && this.frames[i + 1].t <= target) ++i;
    this.idx = i;
    this.wall = performance.now();
    this.t0 = this.frames[i].t;
    this.emit();
    this.onState?.();
  }

  step(d: number) {
    this.idx = Math.max(0, Math.min(this.frames.length - 1, this.idx + d));
    this.wall = performance.now();
    if (this.frames.length) this.t0 = this.frames[this.idx].t;
    this.emit();
    this.onState?.();
  }

  private tick() {
    const target = this.t0 + (performance.now() - this.wall) * this.speed;
    let moved = false;
    while (this.idx < this.frames.length - 1 && this.frames[this.idx + 1].t <= target) {
      ++this.idx;
      moved = true;
    }
    if (moved) this.emit();
    if (this.idx >= this.frames.length - 1) this.pause();
    else if (moved) this.onState?.();
  }

  private emit() {
    const f = this.frames[this.idx];
    if (f) this.onFrame?.(f, this.idx);
  }
}
