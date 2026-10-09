// On-device storage for MMN recordings (IndexedDB), shared by the monitor, the
// map page and the service worker.
//
// • sessions: one entry per recording, saved while you measure so a reload,
//   crash or sleeping phone loses nothing.
// • inbox:    CSV files shared to the app from other Android apps (share
//   target) or opened with it on desktop, waiting for the map page.

const DB_NAME = "webrx";
const DB_VERSION = 1;

export type RecordingRow = Record<string, string | number>;

export type RecordingSession = {
  id: string;
  name: string;
  /** Epoch ms. */
  startedAt: number;
  updatedAt: number;
  /** Column order for CSV export. */
  columns: string[];
  rows: RecordingRow[];
  /** e.g. "HackRF Pro · 95.500 MHz". */
  summary?: string;
  /** Set when the user starts a new recording; unfinished ones resume after a reload. */
  finished?: boolean;
  /** True while the Monitor is measuring into it (with updatedAt, shows "recording" in the map). */
  active?: boolean;
};

export type InboxFile = { id?: number; name: string; text: string; receivedAt: number };

function idb(): IDBFactory | undefined {
  return typeof indexedDB !== "undefined" ? indexedDB : undefined;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const factory = idb();
  if (!factory) return Promise.reject(new Error("IndexedDB unavailable"));
  dbPromise = new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("sessions")) {
        const s = db.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains("inbox")) {
        db.createObjectStore("inbox", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const req = fn(s);
        let result: T;
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export function newSessionId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${Math.random().toString(36).slice(2, 6)}`;
}

export function saveSession(s: RecordingSession): Promise<void> {
  return tx<IDBValidKey>("sessions", "readwrite", (st) => st.put(s)).then(() => undefined);
}

export function getSession(id: string): Promise<RecordingSession | undefined> {
  return tx<RecordingSession | undefined>("sessions", "readonly", (st) => st.get(id));
}

export function deleteSession(id: string): Promise<void> {
  return tx<undefined>("sessions", "readwrite", (st) => st.delete(id)).then(() => undefined);
}

/** All recordings, newest first, without their rows (cheap to list). */
export async function listSessions(): Promise<(Omit<RecordingSession, "rows"> & { count: number; positioned: number })[]> {
  const all = await tx<RecordingSession[]>("sessions", "readonly", (st) => st.getAll());
  return (all || [])
    .map(({ rows, ...meta }) => ({
      ...meta,
      count: rows.length,
      positioned: rows.filter((r) => r.latitude !== "" && r.latitude !== undefined).length,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function addToInbox(files: { name: string; text: string }[]): Promise<void> {
  return open().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction("inbox", "readwrite");
        const s = t.objectStore("inbox");
        for (const f of files) s.add({ name: f.name, text: f.text, receivedAt: Date.now() });
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      })
  );
}

/** Returns and removes everything waiting in the inbox. */
export function takeInbox(): Promise<InboxFile[]> {
  return open().then(
    (db) =>
      new Promise<InboxFile[]>((resolve, reject) => {
        const t = db.transaction("inbox", "readwrite");
        const s = t.objectStore("inbox");
        const req = s.getAll();
        let out: InboxFile[] = [];
        req.onsuccess = () => {
          out = req.result || [];
          s.clear();
        };
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
      })
  );
}

// ── change notifications (monitor ⇄ map, across tabs) ─────────

export type RecordingsMessage = { type: "saved" | "deleted"; id: string };
const CHANNEL = "webrx-recordings";
let channel: BroadcastChannel | null | undefined;

function bc(): BroadcastChannel | null {
  if (channel === undefined) {
    try {
      channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
    } catch (_) {
      channel = null;
    }
  }
  return channel;
}

export function notifyRecordings(msg: RecordingsMessage) {
  try {
    bc()?.postMessage(msg);
  } catch (_) {}
}

export function onRecordingsChanged(cb: (msg: RecordingsMessage) => void) {
  bc()?.addEventListener("message", (e: MessageEvent) => {
    const m = e.data as RecordingsMessage;
    if (m && (m.type === "saved" || m.type === "deleted") && typeof m.id === "string") cb(m);
  });
}

// ── CSV writing ───────────────────────────────────────────────

function cell(v: string | number | undefined): string {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with a header row. */
export function toCsv(columns: string[], rows: RecordingRow[]): string {
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** Safe file name such as mmn_hackrf-pro_95.5MHz_2026-10-09_1043.csv */
export function csvFileName(s: Pick<RecordingSession, "startedAt" | "summary">): string {
  const d = new Date(s.startedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const tag = (s.summary || "recording")
    .toLowerCase()
    .replace(/\s*·\s*/g, "_")
    .replace(/\s+mhz/g, "MHz")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `mmn_${tag}_${stamp}.csv`;
}

/** Saves (downloads) a text file; on phones offers the share sheet when asked to. */
export async function deliverCsv(text: string, fileName: string, mode: "download" | "share"): Promise<"downloaded" | "shared" | "cancelled"> {
  const blob = new Blob([text], { type: "text/csv" });
  if (mode === "share") {
    const file = new File([blob], fileName, { type: "text/csv" });
    const nav = navigator as any;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: fileName, text: "MMN recording from webRx" });
        return "shared";
      } catch (e: any) {
        if (e && e.name === "AbortError") return "cancelled";
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}

export function canShareFiles(): boolean {
  try {
    const nav = navigator as any;
    return !!nav.canShare && nav.canShare({ files: [new File(["x"], "x.csv", { type: "text/csv" })] });
  } catch (_) {
    return false;
  }
}
