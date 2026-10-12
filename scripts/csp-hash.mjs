// Keeps the inline <script> hash in thesis-view.html's CSP meta in sync.
// Run after editing the inline script:  node scripts/csp-hash.mjs   (add --check to verify only)
import fs from "node:fs";
import crypto from "node:crypto";
const file = new URL("../apps/radioreceiver/thesis-view.html", import.meta.url);
const html = fs.readFileSync(file, "utf8");
const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash("sha256").update(m[1], "utf8").digest("base64")}'`);
const csp = [
  "default-src 'self'",
  `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://server.arcgisonline.com",
  "connect-src 'self' https: wss:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");
const tag = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
const re = /<meta http-equiv="Content-Security-Policy"[^>]*\/>/;
const next = re.test(html) ? html.replace(re, tag) : html.replace(/<meta charset="[^"]*"\s*\/?>/i, (m) => `${m}\n    ${tag}`);
if (process.argv.includes("--check")) {
  if (next !== html) { console.error("CSP hash out of date: run node scripts/csp-hash.mjs"); process.exit(1); }
  console.log("CSP ok");
} else { fs.writeFileSync(file, next); console.log("CSP updated:", hashes.length, "inline script(s)"); }
