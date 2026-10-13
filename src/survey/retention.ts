// Retention and size-limit rules (Lee, 13 Oct): confirmed (acked) chunks are
// deleted 30 days after the server ack; un-uploaded chunks are never deleted
// automatically. At the user's size limit the survey pauses or stops (user's
// choice) — nothing un-uploaded is ever dropped.

export const RETENTION_DAYS = 30;
export const WARN_FRACTION = 0.9;

export interface ChunkMeta {
  key: string;
  bytes: number;
  ackedAt?: number | null;
}

export function expiredChunks(chunks: ChunkMeta[], now: number, days = RETENTION_DAYS): string[] {
  const ms = days * 864e5;
  return chunks.filter((c) => c.ackedAt && now - c.ackedAt >= ms).map((c) => c.key);
}

export type LimitAction = "pause" | "stop";
export interface LimitState {
  usedBytes: number;
  limitBytes: number;
  warn: boolean;
  /** true when the next chunk would exceed the limit → apply `action`. */
  atLimit: boolean;
  action: LimitAction;
}

export function limitState(usedBytes: number, limitBytes: number, nextChunkBytes: number, action: LimitAction): LimitState {
  return {
    usedBytes,
    limitBytes,
    warn: limitBytes > 0 && usedBytes >= WARN_FRACTION * limitBytes,
    atLimit: limitBytes > 0 && usedBytes + nextChunkBytes > limitBytes,
    action,
  };
}

export function parseLimit(value: number, unit: "MB" | "GB"): number {
  return Math.max(0, value) * (unit === "GB" ? 1024 ** 3 : 1024 ** 2);
}
