// One upload pass over every stored chunk: used by the RM tab and by the
// service worker's Background Sync handler ("webrx-survey-upload").
//
// The page and the service worker can both start a pass; a Web Lock makes sure
// only one runs at a time, so a survey is never created twice on the server.
// Only what changed is written back (a chunk's state, a survey's remoteId), and
// /complete is sent once per survey with its real end time.
import { expiredChunks } from "./retention.js";
import { allChunks, allSurveys, chunkBytes, deleteChunk, patchSurvey, updateChunkState } from "./store.js";
import { UploadQueue, validateServerUrl, type Fetch } from "./upload.js";

export const SYNC_TAG = "webrx-survey-upload";
const LOCK = "webrx-survey-upload";

export type UploadPassResult = { sent: number; failed: number; skipped: number; pending: number; authFailed?: boolean; busy?: boolean; lastError?: string };

/** Runs `fn` under an exclusive Web Lock; returns `busy` when another context holds it. */
async function exclusive<T>(fn: () => Promise<T>, busy: T): Promise<T> {
  const locks = (globalThis as any).navigator?.locks;
  if (!locks?.request) return fn();
  return locks.request(LOCK, { ifAvailable: true }, (lock: unknown) => (lock ? fn() : busy));
}

export async function uploadPass(cfg: { serverUrl: string; token?: string }, fetchFn: Fetch, opts: { force?: boolean } = {}): Promise<UploadPassResult> {
  const bad = validateServerUrl(cfg.serverUrl);
  if (bad) throw new Error(bad);
  return exclusive<UploadPassResult>(
    async () => {
      const chunks = (await allChunks()).filter((c) => c.state !== "acked");
      const surveys = new Map((await allSurveys()).map((s) => [s.surveyKey, s]));
      const q = new UploadQueue(
        { baseUrl: cfg.serverUrl, token: cfg.token || undefined },
        fetchFn,
        surveys as any,
        chunks,
        async (c, s) => {
          if (c) await updateChunkState(c);
          if (s) await patchSurvey(s.surveyKey, { remoteId: s.remoteId });
        },
        Date.now,
        (c) => chunkBytes(c.surveyKey, c.n)
      );
      const res = await q.run({ force: opts.force });
      if (!res.authFailed)
        for (const s of surveys.values()) {
          if (!s.completed || !s.remoteId || s.completeSent) continue;
          if (chunks.some((c) => c.surveyKey === s.surveyKey && c.state !== "acked")) continue;
          const ok = await q.complete(s.surveyKey, { samples: s.samples, bytes: s.bytes }, s.endedAt).catch(() => false);
          if (ok) await patchSurvey(s.surveyKey, { completeSent: true });
        }
      await applyRetention();
      return { ...res, pending: chunks.filter((c) => c.state !== "acked").length };
    },
    { sent: 0, failed: 0, skipped: 0, pending: 0, busy: true }
  );
}

/** Deletes chunks 30 days after server ack; never touches un-uploaded ones. */
export async function applyRetention() {
  const all = await allChunks();
  const dead = new Set(expiredChunks(all.map((c) => ({ key: `${c.surveyKey}|${c.n}`, bytes: c.size ?? 0, ackedAt: c.ackedAt })), Date.now()));
  for (const c of all) if (dead.has(`${c.surveyKey}|${c.n}`)) await deleteChunk(c.surveyKey, c.n);
}

/**
 * Frees space for `needBytes` by deleting the oldest chunks the server has
 * already confirmed (they're only kept as a local copy). Returns bytes freed.
 */
export async function freeAcked(needBytes: number): Promise<number> {
  const acked = (await allChunks()).filter((c) => c.state === "acked").sort((a, b) => (a.ackedAt ?? 0) - (b.ackedAt ?? 0));
  let freed = 0;
  for (const c of acked) {
    if (freed >= needBytes) break;
    await deleteChunk(c.surveyKey, c.n);
    freed += c.size ?? 0;
  }
  return freed;
}
