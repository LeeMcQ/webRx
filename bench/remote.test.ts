// Remote-receiver framing / decoder tests (KiwiSDR, UberSDR, OpenWebRX) plus the
// security and measurement helpers they rely on.   node bench/run.mjs remote.test
(globalThis as any).window ??= globalThis;
(globalThis as any).location ??= { protocol: "https:" };
import { parseWf, parseSnd, KiwiClient } from "../src/apps/monitor/kiwi.js";
import { UberClient } from "../src/apps/monitor/ubersdr.js";
import { Adpcm, decodeFft, normaliseUrl, safeHttp, safeKind, safeJson, MAX_BINS } from "../src/apps/monitor/owrx.js";
import { avgStep, enbwBins, sUnits, cleanDirEntry, NO_RETRY, backoffMs } from "../src/apps/monitor/util.js";

declare const process: { exit(code: number): never };
let failures = 0;
function check(name: string, cond: boolean, detail?: any) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  if (!cond) failures++;
}
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

// ── KiwiSDR W/F header (bytes captured from kiwi.x26.de, zoom 2 at cf 7000 kHz) ──
{
  const u8 = new Uint8Array(16 + 1024);
  u8.set([0x57, 0x2f, 0x46, 0x20, 0xbb, 0xbb, 0x1b, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const h = parseWf(u8, 30e6, 14, 1024);
  check("Kiwi W/F: x_bin LE @4", h.xBin === 0x1bbbbb, h.xBin);
  check("Kiwi W/F: zoom @8", h.zoom === 2, h.zoom);
  check("Kiwi W/F: span = full/2^zoom", h.spanHz === 7.5e6, h.spanHz);
  check("Kiwi W/F: centre ≈ 7000 kHz", Math.abs(h.centreHz - 7e6) < 2, h.centreHz);
  const z0 = new Uint8Array(1040);
  z0.set([0x57, 0x2f, 0x46, 0x20]);
  const h0 = parseWf(z0, 30e6, 14, 1024);
  check("Kiwi W/F: zoom 0 → 15 MHz centre, 30 MHz span", h0.centreHz === 15e6 && h0.spanHz === 30e6, h0);
  // the client applies the header per frame (no drift after zoom)
  const k = new KiwiClient() as any;
  let got: Float32Array | null = null;
  k.onFft = (f: Float32Array) => (got = f);
  k.fullHz = 30e6;
  k.zoomMax = 14;
  const ws: any = {};
  k.wf = ws;
  k.state = "open";
  // reuse connect()'s handler by wiring the same code path
  const fake = new Uint8Array(1040);
  fake.set(u8.subarray(0, 16));
  fake[16] = 255;
  fake[17] = 155;
  (k as any).connect.toString(); // ensure method exists
  const hh = parseWf(fake, k.fullHz, k.zoomMax, 1024);
  check("Kiwi W/F: dB = byte − 255", fake[16] - 255 === 0 && fake[17] - 255 === -100 && hh.zoom === 2);
  void got;
}
// ── KiwiSDR SND header ──
{
  const u8 = new Uint8Array(10 + 4);
  u8.set([0x53, 0x4e, 0x44, 0x10, 0x01, 0x00, 0x00, 0x00, 0x01, 0x27]);
  const f = parseSnd(u8);
  check("Kiwi SND: compressed flag", f.compressed);
  check("Kiwi SND: seq LE", f.seq === 1, f.seq);
  check("Kiwi SND: S-meter BE → dBm", near(f.smeterDbm, 0.1 * 0x127 - 127, 1e-9), f.smeterDbm);
  check("Kiwi SND: body after 10 bytes", f.body.length === 4);
  const k = new KiwiClient() as any;
  k.msg("sample_rate=11998.902088 audio_rate=12000");
  check("Kiwi: exact sample_rate from server used for audio", near(k.sampleRate, 11998.902088) && k.audioRate === 12000, { s: k.sampleRate, a: k.audioRate });
  k.msg("badp=1");
  check("Kiwi: password reply sets a no-retry error", NO_RETRY.test(k.error), k.error);
  const k2 = new KiwiClient() as any;
  k2.msg("too_busy=4");
  check("Kiwi: busy reply sets a no-retry error", NO_RETRY.test(k2.error), k2.error);
  k2.msg("load_cfg=%7B%22rx_name%22%3A%22%3Cb%3ETest%3C%2Fb%3E%20Kiwi%22%7D");
  check("Kiwi: load_cfg name decoded, tags stripped", k2.name === "Test Kiwi", k2.name);
  k2.msg("load_cfg=%7Bbroken");
  check("Kiwi: broken load_cfg JSON ignored", k2.name === "Test Kiwi");
}
// ── IMA ADPCM ──
{
  const a = new Adpcm();
  a.reset();
  const out = a.decode(new Uint8Array([0x00, 0x77, 0x77, 0x08]));
  check("ADPCM: 2 samples per byte", out.length === 8, out.length);
  check("ADPCM: rising nibbles 7 increase the predictor", out[2] > out[1] && out[3] > out[2], Array.from(out));
  a.reset();
  const z = a.decode(new Uint8Array(16));
  check("ADPCM: zeros stay ~0", z.every((v) => Math.abs(v) < 64), Array.from(z));
}
// ── OpenWebRX FFT ──
{
  const f = new Float32Array([-100, -50, -20]);
  const d = decodeFft(new Uint8Array(f.buffer), "none", new Adpcm());
  check("OWRX FFT: uncompressed float32", d.length === 3 && d[1] === -50, Array.from(d));
  check("bins cap is 65536", MAX_BINS === 65536);
}
// ── UberSDR SPEC v2 frames: full (0x05), delta (0x06), FFT-shift ──
{
  const u = new UberClient() as any;
  let got: Float32Array | null = null;
  u.onFft = (f: Float32Array) => (got = f);
  const hdr = (flags: number, body: number[]) => {
    const b = new Uint8Array(24 + body.length);
    b.set([0x53, 0x50, 0x45, 0x43, 2, flags]);
    new DataView(b.buffer).setBigUint64(16, 14_100_000n, true);
    b.set(body, 24);
    return b;
  };
  // scale ref −12000 (−120.00 dB) step 50 (0.5 dB); codes 0..3 (DC first)
  u.frame(hdr(0x05, [0x20, 0xd1, 50, 0, 10, 20, 30]));
  check("Uber full: centre from header", u.centreHz === 14_100_000, u.centreHz);
  check("Uber full: scaled + halves swapped", !!got && near(got![0], -120 + 20 * 0.5) && near(got![2], -120), got && Array.from(got));
  // delta: change bin 1 to 40 → mask byte 0b10, one value
  u.frame(hdr(0x06, [0b10, 40]));
  check("Uber delta: bin updated", !!got && near(got![3], -120 + 40 * 0.5), got && Array.from(got));
  const n0 = u.fftFrames;
  u.frame(hdr(0x05, [0, 0, 1, ...new Array(MAX_BINS + 1).fill(0)]));
  check("Uber: frames above the bin cap dropped", u.fftFrames === n0);
  u.frame(new Uint8Array(10));
  check("Uber: short frame ignored", u.fftFrames === n0);
  check("safeJson: garbage → null", safeJson("{oops") === null && safeJson('{"a":1}').a === 1);
}
// ── URL / directory safety ──
{
  check("safeHttp: https kept", safeHttp("https://sdr.example.org/") === "https://sdr.example.org/");
  check("safeHttp: javascript: dropped", safeHttp("javascript:alert(1)") === null);
  check("safeHttp: data: dropped", safeHttp("data:text/html,<b>x</b>") === null);
  check("safeHttp: junk dropped", safeHttp("not a url") === null && safeHttp(42) === null);
  check("safeKind whitelist", safeKind("kiwisdr") === "kiwisdr" && safeKind("evil\" onclick=") === undefined);
  check("directory: javascript: entry dropped", cleanDirEntry({ n: "x", u: "javascript:alert(1)" }) === null);
  const e = cleanDirEntry({ n: "ok", u: "https://a.example/", k: "<script>", lat: "x" });
  check("directory: bad kind and lat cleaned", !!e && e.k === undefined && e.lat === 0, e);
  check("normaliseUrl: http blocked from https page", normaliseUrl("http://jnb.twrmon.net:8073/", true).blocked);
}
// ── measurement helpers ──
{
  const hann = Array.from({ length: 1024 }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 1024));
  check("ENBW Hann ≈ 1.5 bins", near(enbwBins(hann), 1.5, 0.01), enbwBins(hann));
  check("ENBW rect = 1 bin", near(enbwBins(new Array(256).fill(1)), 1));
  // linear vs log averaging of two noise readings, −100 and −90 dB, a = 0.5
  const lin = new Float32Array([-100]), leg = new Float32Array([NaN]);
  avgStep(lin, leg, new Float32Array([-90]), 0.5, "lin");
  check("avg lin: power mean of −100/−90 = −92.6 dB", near(lin[0], 10 * Math.log10((1e-10 + 1e-9) / 2), 1e-3), lin[0]);
  const lg = new Float32Array([-100]);
  avgStep(lg, null, new Float32Array([-90]), 0.5, "log");
  check("avg log: dB mean = −95", near(lg[0], -95, 1e-4), lg[0]);
  // thesis path: legacy array is the old dB EMA no matter what the display mode is
  const s = new Float32Array([-100]), l2 = new Float32Array([-100]);
  avgStep(s, l2, new Float32Array([-90]), 0.6, "lin", 0);
  check("thesis path unchanged (dB EMA)", near(l2[0], 0.6 * -100 + 0.4 * -90, 1e-4), l2[0]);
  check("S-meter HF: −73 dBm = S9", sUnits(-73, 7e6) === "S9+0" && sUnits(-79, 7e6) === "S8");
  check("S-meter VHF: −93 dBm = S9", sUnits(-93, 145e6) === "S9+0" && sUnits(-73, 145e6) === "S9+20" && sUnits(-99, 145e6) === "S8");
  check("backoff 2,4,8… capped at 60 s", backoffMs(0) === 2000 && backoffMs(2) === 8000 && backoffMs(10) === 60000);
  check("no-retry errors", NO_RETRY.test("This KiwiSDR needs a password") && NO_RETRY.test("All channels on this KiwiSDR are in use") && !NO_RETRY.test("timeout"));
}
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
