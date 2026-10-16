// TRACE: the TypeScript decoders must reproduce the Rust codecs exactly
// (bench/trace-vectors.json is written by `cargo test -p trace-core -- --ignored write_vectors`).
import { readFileSync } from "fs";
import { adpcmDecode, bfpDecode, burstDecode, crc16, crc32c, headingAt, parseFrame, pointingDecode, SpectrumDecoder, TrackReader, writeFullFrame, Codec, Tier, timeOf, gpsNsToUnixMs, unixMsToGpsNs } from "../src/trace/codec.js";
import { decodeCbor, encodeCbor } from "../src/trace/cbor.js";

declare const process: { exit(code: number): never };
let failures = 0;
function check(name: string, cond: boolean, detail?: any) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && detail !== undefined ? " — " + JSON.stringify(detail, (_, v) => (typeof v === "bigint" ? v.toString() : v)) : ""}`);
  if (!cond) failures++;
}
const hex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (x) => parseInt(x, 16));
const V = JSON.parse(readFileSync("bench/trace-vectors.json", "utf8"));
const te = new TextEncoder();

check("CRC-32C check value", crc32c(te.encode("123456789")) === V.crc.crc32c_123456789);
check("CRC-16/CCITT-FALSE check value", crc16(te.encode("123456789")) === V.crc.crc16_123456789);

// frames
const tr = new TrackReader();
const f0 = parseFrame(hex(V.frames[0].bytes));
const a0 = tr.accept(f0)!;
check("full header fields", f0.full && f0.tier === 2 && f0.flags === V.frames[0].flags && f0.epoch === 7 && f0.sampleIndex === BigInt(V.frames[0].sample_index) && f0.timeNs === BigInt(V.frames[0].time_ns) && f0.timeFrac === V.frames[0].time_frac && f0.clockClass === 2 && f0.codec === V.frames[0].codec && f0.contextRev === 513, f0);
check("full header payload", new TextDecoder().decode(a0.payload) === "hello");
const f1 = parseFrame(hex(V.frames[1].bytes));
const a1 = tr.accept(f1)!;
check("compact header rebuilt from its group", !f1.full && a1.tier === 2 && a1.flags === V.frames[1].flags && a1.sampleIndex === BigInt(V.frames[1].sample_index) && a1.seq === 1 && !a1.gap && a1.codec === V.frames[0].codec, a1);
const bad = hex(V.frames[0].bytes);
bad[42] ^= 1;
let threw = false;
try {
  parseFrame(bad);
} catch (_) {
  threw = true;
}
check("corrupted frame refused", threw);
const w = writeFullFrame({ tier: Tier.Control, codec: Codec.Cbor }, te.encode("x"));
check("written frame parses back", parseFrame(w).payload[0] === 120 && parseFrame(w).tier === 0);

// spectrum
const sd = new SpectrumDecoder();
V.spectrum.forEach((s: any, k: number) => {
  const d = sd.decode(hex(s.payload))!;
  const ok = d && d.length === s.levels.length && s.levels.every((v: number, i: number) => Math.abs(v - d[i]) < 1e-4);
  check(`spectrum frame ${k} (${k ? "delta" : "key"}) identical to Rust`, !!ok);
});
check("delta without key → null", new SpectrumDecoder().decode(hex(V.spectrum[1].payload)) === null);

// I/Q, bursts, audio, pointing
const bf = bfpDecode(hex(V.bfp.payload));
check("BFP I/Q identical to Rust", bf.length === V.bfp.decoded.length && V.bfp.decoded.every((v: number, i: number) => v === bf[i]));
const bu = burstDecode(hex(V.burst.payload));
check("burst lossless identical", bu.length === V.burst.decoded.length && V.burst.decoded.every((v: number, i: number) => v === bu[i]));
for (const [k, a] of V.adpcm.entries()) {
  const d = adpcmDecode(hex(a.payload));
  check(`ADPCM frame ${k} identical`, d.rate === 12000 && a.decoded.every((v: number, i: number) => v === d.pcm[i]));
}
const pf = pointingDecode(BigInt(V.pointing.base), hex(V.pointing.payload));
check("pointing meta", pf.magnetic === V.pointing.magnetic && pf.declination === V.pointing.declination && pf.source === V.pointing.source, pf);
check(
  "pointing samples",
  pf.samples.length === V.pointing.samples.length && V.pointing.samples.every((s: any, i: number) => BigInt(s.index) === pf.samples[i].index && Math.abs(s.heading - pf.samples[i].heading) < 0.006 && s.pitch === pf.samples[i].pitch && s.accuracy === pf.samples[i].accuracy),
  pf.samples
);
const mid = headingAt(pf.samples, pf.samples[0].index + 35000n)!;
check("heading interpolated across north", Math.abs(mid - ((358.5 + 0.5) % 360)) < 0.01, mid);

// CBOR
for (const c of V.cbor) {
  const d = decodeCbor(hex(c.bytes)) as any;
  const want = c.value;
  const ok = Object.keys(want).every((k) => (want[k] === null ? d[k] == null : typeof want[k] === "object" ? JSON.stringify(Object.keys(want[k]).map((j) => [j, d[k]?.[j]])) === JSON.stringify(Object.keys(want[k]).map((j) => [j, want[k][j]])) : (typeof d[k] === "bigint" ? Number(d[k]) : d[k]) === want[k]));
  check(`CBOR from Rust: ${want.type ?? want.op ?? "clock"}`, ok, d);
}
const round = decodeCbor(encodeCbor({ op: "tune", centre_hz: 433.92e6, f: 1.5, neg: -7, big: 2 ** 40, s: "é", arr: [1, null, true] })) as any;
check("CBOR round trip", round.op === "tune" && round.centre_hz === 433.92e6 && round.f === 1.5 && round.neg === -7 && round.big === 2 ** 40 && round.s === "é" && round.arr[2] === true);

// clock
const clk = { class: 2, err_ns: 1e7, n0: 1000, t0_ns: 1_400_000_000_000_000_000n, t0_frac: 0, fs: 2_400_000, eps_ppb: 0, lock: "host", holdover_s: 0, asserted: false };
check("time of sample index", timeOf(clk, 2_401_000n) === 1_400_000_001_000_000_000n);
const ms = Date.UTC(2026, 9, 16);
check("GPS ↔ Unix", gpsNsToUnixMs(unixMsToGpsNs(ms)) === ms && unixMsToGpsNs(ms) === BigInt(ms / 1000 - 315964800 + 18) * 1000000000n);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nAll TRACE codec tests passed.");
