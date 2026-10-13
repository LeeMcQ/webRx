// Builds apps/radioreceiver/owrx-servers.json from the public receiverbook.de
// directory: OpenWebRX entries in `servers`, KiwiSDR entries in `kiwi`.
// (kiwisdr.com/public is http-only behind a gate with no CORS, so receiverbook,
// which mirrors the Kiwi list, is the source a static https site can use.) receiverbook.de has no CORS-enabled API,
// so the browser can't read it directly; run this to refresh the snapshot:
//   node scripts/owrx-directory.mjs [--probe]
// --probe opens each https server's WebSocket (with the GitHub Pages origin)
// and marks the ones that answer with FFT frames.
import fs from "node:fs/promises";

const html = await (await fetch("https://www.receiverbook.de/map")).text();
const m = html.match(/var receivers = (\[.*?\]);\s*\n/s);
if (!m) throw new Error("receiverbook.de layout changed: receivers list not found");
const sites = JSON.parse(m[1]);
/** http(s) URLs only; anything else (javascript:, data:, garbage) is dropped. */
export const safeHttp = (u) => {
  if (typeof u !== "string" || u.length > 2048) return null;
  try {
    const x = new URL(u.trim());
    return x.protocol === "http:" || x.protocol === "https:" ? x.href : null;
  } catch (_) {
    return null;
  }
};
const clean = (t) => String(t || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const out = [];
const kiwi = [];
for (const s of sites) {
  for (const r of s.receivers || []) {
    if (r.type !== "KiwiSDR" || !safeHttp(r.url)) continue;
    kiwi.push({ n: clean(r.label || s.label).slice(0, 90), s: clean(s.label).slice(0, 60), u: safeHttp(r.url), v: r.version || "", lat: +s.location.coordinates[1].toFixed(3), lon: +s.location.coordinates[0].toFixed(3), k: "kiwisdr" });
  }
}
for (const s of sites) {
  for (const r of s.receivers || []) {
    if (!/openwebrx/i.test(r.type) || !safeHttp(r.url)) continue;
    out.push({
      n: clean(r.label || s.label).slice(0, 90),
      s: clean(s.label).slice(0, 60),
      u: safeHttp(r.url),
      v: r.version || "",
      lat: +s.location.coordinates[1].toFixed(3),
      lon: +s.location.coordinates[0].toFixed(3),
    });
  }
}

if (process.argv.includes("--probe")) {
  const { default: WS } = await import("ws");
  const probe = (u) =>
    new Promise((res) => {
      let ws, done = false;
      const end = (ok) => { if (done) return; done = true; try { ws?.terminate(); } catch (_) {} res(ok); };
      try {
        ws = new WS(u.replace(/^https/, "wss").replace(/\/?$/, "/") + "ws/", { headers: { Origin: "https://leemcq.github.io" }, handshakeTimeout: 6000 });
      } catch (_) { return end(false); }
      ws.on("open", () => ws.send("SERVER DE CLIENT client=openwebrx.js type=receiver"));
      ws.on("message", (d, bin) => bin && d[0] === 1 && end(true));
      ws.on("error", () => end(false));
      setTimeout(() => end(false), 9000);
    });
  const https = out.filter((x) => x.u.startsWith("https:"));
  for (let i = 0; i < https.length; i += 12) {
    const ok = await Promise.all(https.slice(i, i + 12).map((x) => probe(x.u)));
    https.slice(i, i + 12).forEach((x, j) => ok[j] && (x.ok = 1));
  }
}
if (process.argv.includes("--probe")) {
  const { default: WS } = await import("ws");
  const probeKiwi = (u) =>
    new Promise((res) => {
      let ws, done = false;
      const end = (ok) => { if (done) return; done = true; try { ws?.terminate(); } catch (_) {} res(ok); };
      try {
        ws = new WS(u.replace(/^https/, "wss").replace(/\/?$/, "/") + Date.now() + "/W/F", { headers: { Origin: "https://leemcq.github.io" }, handshakeTimeout: 6000 });
      } catch (_) { return end(false); }
      ws.on("open", () => { ws.send("SET auth t=kiwi p=#"); ws.send("SET ident_user=webRx-directory-probe"); ws.send("SET maxdb=0 mindb=-100"); ws.send("SET zoom=0 start=0"); ws.send("SET wf_speed=4"); ws.send("SET wf_comp=0"); });
      ws.on("message", (d) => d.slice(0, 3).toString() === "W/F" && end(true));
      ws.on("error", () => end(false));
      setTimeout(() => end(false), 15000);
    });
  for (const x of kiwi.filter((x) => x.u.startsWith("https:"))) if (await probeKiwi(x.u)) x.ok = 1;
}
kiwi.sort((a, b) => (b.ok || 0) - (a.ok || 0) || (b.u.startsWith("https") - a.u.startsWith("https")) || a.n.localeCompare(b.n));
out.sort((a, b) => (b.ok || 0) - (a.ok || 0) || (b.u.startsWith("https") - a.u.startsWith("https")) || a.n.localeCompare(b.n));
const doc = { source: "https://www.receiverbook.de/ (OpenWebRX entries)", fetched: new Date().toISOString(), probed: process.argv.includes("--probe"), servers: out, kiwi };
await fs.writeFile(new URL("../apps/radioreceiver/owrx-servers.json", import.meta.url), JSON.stringify(doc));
console.log(`${kiwi.length} KiwiSDR (${kiwi.filter((x) => x.u.startsWith("https")).length} https, ${kiwi.filter((x) => x.ok).length} answered); ${out.length} OpenWebRX servers, ${out.filter((x) => x.u.startsWith("https")).length} https, ${out.filter((x) => x.ok).length} answered`);
