// Pure helpers shared by the monitor and its unit tests (no DOM).
import { safeHttp, safeKind } from "./owrx.js";

export type DirEntry = { n: string; s: string; u: string; v: string; lat: number; lon: number; ok?: number; k?: "ubersdr" | "kiwisdr"; users?: string; feat?: string };

/** One EMA step: display trace in the selected domain, legacy trace always in dB. */
export function avgStep(spec: Float32Array, legacy: Float32Array | null, v: Float32Array, a: number, mode: "lin" | "log", offset = 0) {
  for (let k = 0; k < spec.length; ++k) {
    const x = v[k] + offset;
    const prev = spec[k];
    if (Number.isNaN(prev)) spec[k] = x;
    else if (mode === "log") spec[k] = a * prev + (1 - a) * x;
    else spec[k] = 10 * Math.log10(a * 10 ** (prev / 10) + (1 - a) * 10 ** (x / 10));
    if (legacy) legacy[k] = Number.isNaN(legacy[k]) ? x : a * legacy[k] + (1 - a) * x;
  }
}

/** Equivalent noise bandwidth of a window, in bins: N·Σw² / (Σw)² (Hann ≈ 1.5). */
export function enbwBins(w: ArrayLike<number>) {
  let s1 = 0, s2 = 0;
  for (let i = 0; i < w.length; ++i) {
    s1 += w[i];
    s2 += w[i] * w[i];
  }
  return s1 > 0 ? (w.length * s2) / (s1 * s1) : 1;
}

/** IARU S-meter: S9 = −73 dBm on HF (≤ 30 MHz), −93 dBm on VHF/UHF; 6 dB per S-unit. */
export function sUnits(dbm: number, hz: number) {
  const s9 = hz > 30e6 ? -93 : -73;
  if (dbm >= s9) return `S9+${Math.round(dbm - s9)}`;
  return `S${Math.max(0, Math.floor(9 + (dbm - s9) / 6))}`;
}

/** Directory entry from any source → sanitised entry, or null (non-http(s) URL, bad kind…). */
export function cleanDirEntry(x: any): DirEntry | null {
  const u = safeHttp(x?.u);
  if (!u) return null;
  const k = safeKind(x?.k);
  const str = (v: unknown, n: number) => String(v ?? "").slice(0, n);
  return { n: str(x.n, 120), s: str(x.s, 120), u, v: str(x.v, 40), lat: Number.isFinite(+x.lat) ? +x.lat : 0, lon: Number.isFinite(+x.lon) ? +x.lon : 0, ok: x.ok ? 1 : 0, k: k === "openwebrx" ? undefined : k, users: x.users ? str(x.users, 40) : undefined, feat: x.feat ? str(x.feat, 30) : undefined };
}

/** Errors a retry can't fix. */
export const NO_RETRY = /password|in use|busy|refused|mixed|down|full|banned|kicked|too many/i;
export function backoffMs(tries: number) {
  return Math.min(60_000, 2000 * 2 ** tries);
}
