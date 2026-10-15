// IndexedDB storage for survey chunks (ring with user limit; see retention.ts).
//
// v3 keeps chunk metadata ("chunks": state, size, hash) apart from the chunk
// bytes ("blobs"), so the queue table, storage usage and the upload pass can
// read every chunk's state without pulling hundreds of MB into memory. The
// page and the service worker both write here; every update is a
// read-modify-write inside one transaction so neither overwrites the other's
// fields (e.g. the upload pass setting remoteId while the page marks the
// survey complete).
import type { QueuedChunk, SurveyRemote } from "./upload.js";

const DB = "webrx-survey";
const VER = 3;

type Key = [string, number];

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = (ev) => {
      const db = r.result;
      if (!db.objectStoreNames.contains("surveys")) db.createObjectStore("surveys", { keyPath: "surveyKey" });
      if (!db.objectStoreNames.contains("chunks")) db.createObjectStore("chunks", { keyPath: ["surveyKey", "n"] });
      // v2: upload config mirrored here so the service worker (no localStorage) can upload in the background
      if (!db.objectStoreNames.contains("config")) db.createObjectStore("config");
      // v3: chunk bytes in their own store; move any v2 chunks across
      if (!db.objectStoreNames.contains("blobs")) {
        const blobs = db.createObjectStore("blobs");
        if (ev.oldVersion > 0 && ev.oldVersion < 3) {
          const cur = r.transaction!.objectStore("chunks").openCursor();
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) return;
            const v = c.value as QueuedChunk & { bytes?: Uint8Array };
            if (v.bytes) {
              blobs.put(v.bytes, [v.surveyKey, v.n]);
              v.size = v.bytes.byteLength;
              delete v.bytes;
              c.update(v);
            }
            c.continue();
          };
        }
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("Survey storage is busy in another tab — close the other webRx tabs and retry"));
  });
}

/** Runs `fn` in one transaction; resolves with its return value once the transaction commits. */
function tx<T>(stores: string | string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => T | IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((res, rej) => {
        let t: IDBTransaction;
        try {
          t = db.transaction(stores, mode);
        } catch (e) {
          db.close();
          return rej(e);
        }
        let out: any;
        try {
          out = fn(t);
        } catch (e) {
          db.close();
          try {
            t.abort();
          } catch (_) {}
          return rej(e);
        }
        t.oncomplete = () => {
          db.close();
          res(out instanceof IDBRequest ? out.result : out);
        };
        const fail = () => {
          db.close();
          rej(t.error ?? new Error("Survey storage transaction aborted"));
        };
        t.onerror = fail;
        t.onabort = fail;
      })
  );
}

export type StoredSurvey = SurveyRemote & {
  name: string;
  startedAt: number;
  endedAt?: number;
  samples: number;
  bytes: number;
  completed?: boolean;
  /** Server confirmed POST …/complete (sent once). */
  completeSent?: boolean;
};

export const putSurvey = (s: StoredSurvey) => tx("surveys", "readwrite", (t) => t.objectStore("surveys").put(s)).then(() => undefined);
export const getSurvey = (key: string) => tx<StoredSurvey>("surveys", "readonly", (t) => t.objectStore("surveys").get(key));
export const allSurveys = () => tx<StoredSurvey[]>("surveys", "readonly", (t) => t.objectStore("surveys").getAll()).then((x) => x || []);
export const deleteSurvey = (key: string) => tx("surveys", "readwrite", (t) => void t.objectStore("surveys").delete(key));

/** Merges `patch` into the stored survey (no-op when it no longer exists). */
export function patchSurvey(key: string, patch: Partial<StoredSurvey>) {
  return tx("surveys", "readwrite", (t) => {
    const o = t.objectStore("surveys");
    const g = o.get(key);
    g.onsuccess = () => {
      if (g.result) o.put({ ...g.result, ...patch, surveyKey: key });
    };
  }).then(() => undefined);
}

const meta = (c: QueuedChunk): QueuedChunk => {
  const { bytes, ...m } = c;
  return { ...m, size: bytes ? bytes.byteLength : (c.size ?? 0) };
};

/** Stores a new chunk (metadata + bytes). */
export function putChunk(c: QueuedChunk) {
  return tx(["chunks", "blobs"], "readwrite", (t) => {
    t.objectStore("chunks").put(meta(c));
    if (c.bytes) t.objectStore("blobs").put(c.bytes, [c.surveyKey, c.n] as Key);
  }).then(() => undefined);
}

/** Every chunk's metadata (no bytes): state, size, hash, retry schedule. */
export const allChunks = () => tx<QueuedChunk[]>("chunks", "readonly", (t) => t.objectStore("chunks").getAll()).then((x) => x || []);

export const chunkBytes = (surveyKey: string, n: number) => tx<Uint8Array>("blobs", "readonly", (t) => t.objectStore("blobs").get([surveyKey, n] as Key));

/** Updates the upload state of an existing chunk (no-op when it was deleted meanwhile). */
export function updateChunkState(c: Pick<QueuedChunk, "surveyKey" | "n" | "state" | "tries" | "nextAt" | "ackedAt">) {
  return tx("chunks", "readwrite", (t) => {
    const o = t.objectStore("chunks");
    const g = o.get([c.surveyKey, c.n] as Key);
    g.onsuccess = () => {
      if (g.result) o.put({ ...g.result, state: c.state, tries: c.tries, nextAt: c.nextAt, ackedAt: c.ackedAt });
    };
  }).then(() => undefined);
}

export function deleteChunk(surveyKey: string, n: number) {
  return tx(["chunks", "blobs"], "readwrite", (t) => {
    t.objectStore("chunks").delete([surveyKey, n] as Key);
    t.objectStore("blobs").delete([surveyKey, n] as Key);
  }).then(() => undefined);
}

export async function usedBytes(): Promise<number> {
  return (await allChunks()).reduce((a, c) => a + (c.size ?? 0), 0);
}

export type UploadCfg = { serverUrl: string; token: string; autoWifi: boolean; unmetered: boolean };
export const putUploadCfg = (c: UploadCfg) => tx("config", "readwrite", (t) => void t.objectStore("config").put(c, "upload"));
export const getUploadCfg = () => tx<UploadCfg>("config", "readonly", (t) => t.objectStore("config").get("upload"));
