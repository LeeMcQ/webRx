// Upload queue for survey chunks (PROPOSAL §11.7, generic REST contract):
//   POST {base}/surveys                      → {surveyId}
//   PUT  {base}/surveys/{id}/chunks/{n}      (X-Chunk-SHA256) → 200/201; 409 on hash mismatch
//   GET  {base}/surveys/{id}                 → {chunks:[{n,sha256}]} (resume)
//   POST {base}/surveys/{id}/complete
//   GET  {base}/surveys/ping                 (Test connection)
// The server URL and optional bearer token are user-entered; https only.

export type Fetch = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json(): Promise<any>; text(): Promise<string> }>;

export interface UploadConfig {
  baseUrl: string;
  token?: string;
}

export function validateServerUrl(u: string, allowHttpLocal = false): string | null {
  let url: URL;
  try {
    url = new URL(u.trim());
  } catch (_) {
    return "Enter a full URL, e.g. https://example.org/api";
  }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
  if (url.protocol !== "https:" && !(allowHttpLocal && local && url.protocol === "http:")) return "The upload server must use https://";
  if (url.username || url.password) return "Put the token in the token field, not in the URL.";
  return null;
}

const join = (b: string, p: string) => b.replace(/\/+$/, "") + p;

function headers(c: UploadConfig, extra: Record<string, string> = {}) {
  const h: Record<string, string> = { ...extra };
  if (c.token) h["Authorization"] = "Bearer " + c.token;
  return h;
}

export async function testConnection(c: UploadConfig, fetchFn: Fetch): Promise<{ ok: boolean; message: string }> {
  const bad = validateServerUrl(c.baseUrl, true);
  if (bad) return { ok: false, message: bad };
  try {
    const r = await fetchFn(join(c.baseUrl, "/surveys/ping"), { method: "GET", headers: headers(c) });
    if (r.status === 401 || r.status === 403) return { ok: false, message: "Reached the server but the token was rejected." };
    if (!r.ok) return { ok: false, message: `Server answered ${r.status}.` };
    return { ok: true, message: "Reachable." };
  } catch (e: any) {
    return { ok: false, message: "Couldn't reach the server (offline, wrong URL or CORS blocked)." };
  }
}

export interface QueuedChunk {
  surveyKey: string; // local survey id
  n: number;
  sha256: string;
  bytes: Uint8Array;
  state: "queued" | "uploading" | "acked" | "failed";
  tries: number;
  nextAt: number;
  ackedAt?: number;
}

export interface SurveyRemote {
  surveyKey: string;
  remoteId?: string;
  meta: Record<string, unknown>;
}

export function backoffMs(tries: number, rnd = Math.random): number {
  const base = Math.min(300_000, 2000 * 2 ** Math.max(0, tries - 1));
  return Math.round(base * (0.75 + 0.5 * rnd()));
}

export const MAX_TRIES = 10;

/** Drives uploads; persistence is delegated to `save` (IndexedDB in the app, memory in tests). */
export class UploadQueue {
  constructor(
    public cfg: UploadConfig,
    private fetchFn: Fetch,
    public surveys: Map<string, SurveyRemote>,
    public chunks: QueuedChunk[],
    private save: () => Promise<void> = async () => {},
    private now: () => number = Date.now
  ) {}

  private async ensureSurvey(s: SurveyRemote): Promise<string> {
    if (s.remoteId) return s.remoteId;
    const r = await this.fetchFn(join(this.cfg.baseUrl, "/surveys"), {
      method: "POST",
      headers: headers(this.cfg, { "Content-Type": "application/json" }),
      body: JSON.stringify({ clientSurveyId: s.surveyKey, ...s.meta }),
    });
    if (!r.ok) throw new Error("create survey: " + r.status);
    const j = await r.json();
    s.remoteId = String(j.surveyId);
    // resume: mark chunks the server already has
    const g = await this.fetchFn(join(this.cfg.baseUrl, `/surveys/${encodeURIComponent(s.remoteId)}`), { headers: headers(this.cfg) });
    if (g.ok) {
      const have = new Map<number, string>(((await g.json()).chunks || []).map((c: any) => [c.n, c.sha256]));
      for (const c of this.chunks)
        if (c.surveyKey === s.surveyKey && have.get(c.n) === c.sha256 && c.state !== "acked") (c.state = "acked"), (c.ackedAt = this.now());
    }
    await this.save();
    return s.remoteId;
  }

  /** Uploads every due chunk once. Returns counts. */
  async run(): Promise<{ sent: number; failed: number; skipped: number }> {
    let sent = 0, failed = 0, skipped = 0;
    for (const c of this.chunks) {
      if (c.state === "acked") continue;
      if (c.state === "failed" && c.tries >= MAX_TRIES) {
        skipped++;
        continue;
      }
      if (c.nextAt > this.now()) {
        skipped++;
        continue;
      }
      const s = this.surveys.get(c.surveyKey);
      if (!s) continue;
      try {
        const id = await this.ensureSurvey(s);
        if ((c.state as string) === "acked") continue;
        c.state = "uploading";
        const r = await this.fetchFn(join(this.cfg.baseUrl, `/surveys/${encodeURIComponent(id)}/chunks/${c.n}`), {
          method: "PUT",
          headers: headers(this.cfg, { "Content-Type": "application/vnd.webrx.chunk+gzip", "X-Chunk-SHA256": c.sha256 }),
          body: c.bytes,
        });
        if (r.ok) {
          c.state = "acked";
          c.ackedAt = this.now();
          sent++;
        } else throw new Error("PUT " + r.status);
      } catch (_) {
        c.tries++;
        c.state = "failed";
        c.nextAt = this.now() + backoffMs(c.tries);
        failed++;
      }
      await this.save();
    }
    return { sent, failed, skipped };
  }

  async complete(surveyKey: string, totals: Record<string, unknown>) {
    const s = this.surveys.get(surveyKey);
    if (!s?.remoteId) return false;
    const r = await this.fetchFn(join(this.cfg.baseUrl, `/surveys/${encodeURIComponent(s.remoteId)}/complete`), {
      method: "POST",
      headers: headers(this.cfg, { "Content-Type": "application/json" }),
      body: JSON.stringify({ endedAt: new Date(this.now()).toISOString(), totals }),
    });
    return r.ok;
  }
}

/** Wi-Fi detection: Network Information API where present (Chromium Android), else the user's "unmetered" toggle. */
export function onUnmeteredNetwork(nav: any, manualUnmetered: boolean): { unmetered: boolean; detected: boolean } {
  const c = nav?.connection;
  if (c && typeof c.type === "string" && c.type !== "unknown") return { unmetered: c.type === "wifi" || c.type === "ethernet", detected: true };
  return { unmetered: manualUnmetered, detected: false };
}
