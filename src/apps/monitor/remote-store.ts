// Remote receivers: the featured list plus the user's favourites and recently
// used servers (localStorage). Every stored URL goes through safeHttp so a
// tampered entry can never become a javascript: link.
import { safeHttp, safeKind } from "./owrx.js";
import type { DirEntry } from "./util.js";

export const FEATURED: DirEntry[] = [
  { n: "TWR | Johannesburg", s: "Johannesburg, South Africa", u: "http://jnb.twrmon.net:8073/", v: "", lat: -26.2, lon: 28.05, k: "kiwisdr", feat: "Featured" },
];
const FAV_KEY = "webrx.remote.favs";
export const favs = (): string[] => {
  try {
    const j = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    return Array.isArray(j) ? j.map(safeHttp).filter((x): x is string => !!x) : [];
  } catch (_) {
    return [];
  }
};
export function toggleFav(raw: string) {
  const u = safeHttp(raw);
  if (!u) return;
  const f = favs();
  const i = f.indexOf(u);
  if (i >= 0) f.splice(i, 1);
  else f.unshift(u);
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(f.slice(0, 50)));
  } catch (_) {}
}
/** Distance reference when there is no GPS fix. */
export const JNB = { lat: -26.2, lon: 28.05 };
const SAVED_KEY = "webrx.remote.saved";
export const savedServers = (): { u: string; n: string; k?: string }[] => {
  try {
    const j = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return (Array.isArray(j) ? j : []).flatMap((x: any) => {
      const u = safeHttp(x?.u);
      return u ? [{ u, n: String(x.n ?? "").slice(0, 120), k: safeKind(x.k) }] : [];
    });
  } catch (_) {
    return [];
  }
};
export function rememberServer(u: string, n: string, k?: string) {
  const list = savedServers().filter((x) => x.u !== u);
  list.unshift({ u, n, k });
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 20)));
  } catch (_) {}
}
