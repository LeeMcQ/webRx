// IndexedDB storage for survey chunks (ring with user limit; see retention.ts).
import type { QueuedChunk, SurveyRemote } from "./upload.js";

const DB = "webrx-survey";
const VER = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("surveys")) db.createObjectStore("surveys", { keyPath: "surveyKey" });
      if (!db.objectStoreNames.contains("chunks")) db.createObjectStore("chunks", { keyPath: ["surveyKey", "n"] });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((res, rej) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => {
          db.close();
          res(req ? req.result : undefined);
        };
        t.onerror = () => rej(t.error);
      })
  );
}

export type StoredSurvey = SurveyRemote & { name: string; startedAt: number; endedAt?: number; samples: number; bytes: number; completed?: boolean };

export const putSurvey = (s: StoredSurvey) => tx("surveys", "readwrite", (o) => o.put(s));
export const allSurveys = () => tx<StoredSurvey[]>("surveys", "readonly", (o) => o.getAll()).then((x) => x || []);
export const putChunk = (c: QueuedChunk) => tx("chunks", "readwrite", (o) => o.put(c));
export const allChunks = () => tx<QueuedChunk[]>("chunks", "readonly", (o) => o.getAll()).then((x) => x || []);
export const deleteChunk = (surveyKey: string, n: number) => tx("chunks", "readwrite", (o) => o.delete([surveyKey, n]));

export async function usedBytes(): Promise<number> {
  return (await allChunks()).reduce((a, c) => a + c.bytes.byteLength, 0);
}
