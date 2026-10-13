// One upload pass over every stored chunk: used by the RM tab and by the
// service worker's Background Sync handler ("webrx-survey-upload").
import { expiredChunks } from "./retention.js";
import { allChunks, allSurveys, deleteChunk, putChunk, putSurvey } from "./store.js";
import { UploadQueue, validateServerUrl, type Fetch } from "./upload.js";

export const SYNC_TAG = "webrx-survey-upload";

export async function uploadPass(cfg: { serverUrl: string; token?: string }, fetchFn: Fetch): Promise<{ sent: number; failed: number; skipped: number; pending: number }> {
  const bad = validateServerUrl(cfg.serverUrl);
  if (bad) throw new Error(bad);
  const chunks = (await allChunks()).filter((c) => c.state !== "acked");
  const surveys = new Map((await allSurveys()).map((s) => [s.surveyKey, s]));
  const q = new UploadQueue({ baseUrl: cfg.serverUrl, token: cfg.token || undefined }, fetchFn, surveys as any, chunks, async () => {
    for (const c of chunks) await putChunk(c);
    for (const s of surveys.values()) await putSurvey(s);
  });
  const res = await q.run();
  for (const s of surveys.values())
    if (s.completed && s.remoteId && chunks.filter((c) => c.surveyKey === s.surveyKey).every((c) => c.state === "acked")) await q.complete(s.surveyKey, { samples: s.samples, bytes: s.bytes }).catch(() => false);
  await applyRetention();
  return { ...res, pending: chunks.filter((c) => c.state !== "acked").length };
}

/** Deletes chunks 30 days after server ack; never touches un-uploaded ones. */
export async function applyRetention() {
  const all = await allChunks();
  const dead = new Set(expiredChunks(all.map((c) => ({ key: `${c.surveyKey}|${c.n}`, bytes: c.bytes.byteLength, ackedAt: c.ackedAt })), Date.now()));
  for (const c of all) if (dead.has(`${c.surveyKey}|${c.n}`)) await deleteChunk(c.surveyKey, c.n);
}
