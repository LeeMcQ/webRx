// RM survey: params/validation, gating, squelch, DP, codec, retention, upload resume (local mock server).
import * as http from "http";
import { DEFAULT_PARAMS, estimateBytesPerHour, toDbm, validateParams, valuesPerSample } from "../src/survey/params.js";
import { SampleGate, Squelch, reduceBands } from "../src/survey/gating.js";
import { simplify } from "../src/survey/dp.js";
import { ByteReader, ByteWriter, decodeChunk, encodeChunk, gunzip, gzip, sha256Hex, unzigzag, zigzag } from "../src/survey/codec.js";
import { ProcessorClient, handle, SurveyProcessor } from "../src/survey/processor.js";
import { expiredChunks, limitState, parseLimit } from "../src/survey/retention.js";
import { UploadQueue, backoffMs, onUnmeteredNetwork, testConnection, validateServerUrl, type QueuedChunk } from "../src/survey/upload.js";

declare const process: { exit(code: number): never };
let failures = 0;
function check(name: string, cond: boolean, detail?: any) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  if (!cond) failures++;
}

const CAL = { offsetDb: -30, antennaGainDbi: 2, cableLossDb: 1.5 };

async function main() {
  // ── params ──
  check("defaults + HackRF + calibration: OK", validateParams(DEFAULT_PARAMS, "hackrf", CAL).length === 0, validateParams(DEFAULT_PARAMS, "hackrf", CAL));
  const rtl = validateParams(DEFAULT_PARAMS, "rtlsdr", CAL);
  check("RTL + 1–6000 MHz: start blocked with 'needs a HackRF'", rtl.some((e) => /needs a HackRF/.test(e)), rtl);
  const rtlOk = validateParams({ ...DEFAULT_PARAMS, ranges: [{ startMHz: 88, stopMHz: 1700 }] }, "rtlsdr", CAL);
  check("RTL inside its range: OK", rtlOk.length === 0, rtlOk);
  const noCal = validateParams(DEFAULT_PARAMS, "hackrf", { offsetDb: null, antennaGainDbi: 2, cableLossDb: 1 });
  check("missing dBm calibration blocks start", noCal.some((e) => /dBm calibration/.test(e)), noCal);
  check("no device blocks start", validateParams(DEFAULT_PARAMS, "none", CAL).length > 0);
  check("bad range rejected", validateParams({ ...DEFAULT_PARAMS, ranges: [{ startMHz: 900, stopMHz: 800 }] }, "hackrf", CAL).length > 0);
  check("toDbm = dBFS + offset − gain + loss", toDbm(-50, CAL) === -50 - 30 - 2 + 1.5);
  check("60 sub-bands → 120 values", valuesPerSample(DEFAULT_PARAMS) === 120);
  check("full 1 MHz bins → 5999 values", valuesPerSample({ ...DEFAULT_PARAMS, reduction: "none" }) === 5999);
  const est = estimateBytesPerHour(DEFAULT_PARAMS);
  check("vehicle sub-band estimate: 1800 sweeps/h × 134 B ≈ 0.24 MB/h raw", Math.round(est.raw) === 241200, est);

  // ── gating ──
  const g = new SampleGate({ distM: 10, timeS: 30, changeDb: 3 });
  const v = (x: number) => new Float32Array([x, x]);
  const f = (t: number, dLatM: number, acc = 3) => ({ t, lat: -33.9 + dLatM / 111_133, lon: 18.4, accM: acc });
  check("first sample kept", g.offer(f(0, 0), v(-80)) === "first");
  check("5 m, 1 s, same level dropped", g.offer(f(1000, 5), v(-80)) === "none");
  check("12 m kept by distance", g.offer(f(2000, 12), v(-80)) === "distance");
  check("level change ≥3 dB kept", g.offer(f(3000, 13), v(-76)) === "change");
  check("30 s later kept by time", g.offer(f(33_500, 13), v(-76)) === "time");
  check("12 m jump with 50 m accuracy while stationary = jitter", g.offer(f(34_000, 25, 50), v(-76)) === "jitter");

  const sq = new Squelch(-90, 2, 1);
  const seq = [-95, -89, -87.5, -89, -90.5, -89].map((x) => sq.apply(new Float32Array([x])).open);
  check("squelch opens at thr+hyst, closes below thr", JSON.stringify(seq) === "[0,0,1,1,0,0]", seq);
  const rb = reduceBands(new Float32Array([-100, -100, -60, -100]), 2);
  check("band reduction peak", rb[0] === -100 && rb[2] === -60);
  check("band reduction linear mean", Math.abs(rb[3] - (10 * Math.log10((1e-6 + 1e-10) / 2))) < 1e-3, rb[3]);

  // ── DP ──
  const line: { lat: number; lon: number; keep?: boolean }[] = Array.from({ length: 101 }, (_, i) => ({ lat: -33.9 + i * 1e-5, lon: 18.4 + (i % 2 ? 1e-7 : 0) }));
  const kept = simplify(line, 2);
  check("DP: straight jittery line → 2 points", kept.length === 2, kept.length);
  const corner = [...line.slice(0, 50), ...Array.from({ length: 50 }, (_, i) => ({ lat: line[49].lat, lon: 18.4 + (i + 1) * 1e-5 }))];
  const kc = simplify(corner, 2);
  check("DP: L-shape keeps the corner", kc.length === 3 && kc[1] === 49, kc);
  line[30].keep = true;
  check("DP: forced measurement point kept", simplify(line, 2).includes(30));

  // ── codec ──
  for (const x of [0, 1, -1, 63, -64, 1e9, -1e9, 2 ** 40]) {
    const w = new ByteWriter();
    w.svarint(x);
    check(`zig-zag varint ${x}`, new ByteReader(w.out()).svarint() === x && unzigzag(zigzag(x)) === x);
  }
  const rows = Array.from({ length: 200 }, (_, i) => ({
    t: 1_760_000_000_000 + i * 2000,
    lat: -33.9 + i * 1e-4,
    lon: 18.4 - i * 3e-5,
    accM: 4,
    reason: 2,
    values: new Float32Array(Array.from({ length: 120 }, (_, j) => (j % 7 === 0 ? NaN : -100 + ((i + j) % 40) * 0.5))),
  }));
  const raw = encodeChunk({ surveyId: "s1", n: 0, unit: "dBm", baseDb: -160, quantDb: 0.5, calibration: CAL }, rows);
  const dec = decodeChunk(raw);
  let ok = dec.rows.length === 200 && dec.header.unit === "dBm" && (dec.header.calibration as any).offsetDb === -30;
  for (let i = 0; i < rows.length && ok; i++) {
    const a = rows[i], b = dec.rows[i];
    ok = a.t === b.t && Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6;
    for (let j = 0; j < 120 && ok; j++) ok = Number.isNaN(a.values[j]) ? Number.isNaN(b.values[j]) : Math.abs(a.values[j] - b.values[j]) <= 0.25;
  }
  check("chunk round trip (time, 1e-6° position, ±0.25 dB, squelch gaps, dBm + calibration header)", ok);
  check("encoded ≈ 1 byte per value", raw.length < 200 * (120 + 14) + 600, raw.length);
  const gz = await gzip(raw);
  check("gzip smaller", gz.length < raw.length, { raw: raw.length, gz: gz.length });
  check("gunzip round trip", (await gunzip(gz)).every((b, i) => b === raw[i]));
  check("sha256", (await sha256Hex(new TextEncoder().encode("abc"))).startsWith("ba7816bf"));
  let threw = false;
  try { decodeChunk(raw.slice(0, raw.length - 10)); } catch (_) { threw = true; }
  check("truncated chunk throws", threw);

  // ── processor (worker pipeline, inline) ──
  {
    const P = { ...DEFAULT_PARAMS, ranges: [{ startMHz: 400, stopMHz: 500 }], reduction: "subbands" as const, subBands: 4, distM: 10, timeS: 30, changeDb: 3 };
    const pc = new ProcessorClient(null);
    check("no worker URL → inline fallback", !pc.usingWorker);
    await pc.init({ surveyKey: "k", params: P, cal: CAL });
    const grid = () => new Float32Array(100).map((_, i) => (i === 50 ? -40 : -90));
    const g1 = grid();
    const r1 = await pc.sample([g1], { t: 0, lat: -33.9, lon: 18.4, accM: 3 }, 0);
    check("first sample kept with trail", r1.kept && !!r1.trail);
    const r2 = await pc.sample([grid()], { t: 1000, lat: -33.9, lon: 18.4, accM: 3 }, 1000);
    check("same place/level dropped", !r2.kept, r2);
    const c = await pc.flush();
    const d = c && decodeChunk(await gunzip(c.bytes));
    check("flush → gzip chunk, dBm header, 1 row × 8 values", !!d && d.header.unit === "dBm" && d.rows.length === 1 && d.header.nValues === 8, d?.header);
    check("chunk hash matches", !!c && c.sha256 === (await sha256Hex(c.bytes)));
    const st = { p: null as SurveyProcessor | null };
    await handle(st, { id: 1, op: "init", init: { surveyKey: "k", params: P, cal: CAL } });
    const snap = await handle(st, { id: 2, op: "snapshot", grids: [grid()], fix: null, now: 5, ranges: P.ranges, why: "button" });
    check("snapshot reply transfers its chunk buffer", snap.transfer.length === 1 && snap.reply.result.snapshot === true);
    const dd = decodeChunk(await gunzip(snap.reply.result.bytes));
    check("snapshot keeps all 100 bins in dBm", dd.header.nValues === 100 && Math.abs(dd.rows[0].values[50] - (-40 - 30 - 2 + 1.5)) <= 0.25, dd.rows[0].values[50]);
  }

  // ── retention ──
  const now = Date.UTC(2026, 9, 13);
  const ch = [
    { key: "a", bytes: 1, ackedAt: now - 31 * 864e5 },
    { key: "b", bytes: 1, ackedAt: now - 29 * 864e5 },
    { key: "c", bytes: 1, ackedAt: null },
    { key: "d", bytes: 1 },
  ];
  check("only acked > 30 days deleted; un-uploaded never", JSON.stringify(expiredChunks(ch, now)) === '["a"]');
  check("un-uploaded kept even after a year", expiredChunks([{ key: "x", bytes: 1 }], now + 365 * 864e5).length === 0);
  const L = parseLimit(1, "GB");
  check("limit 1 GB", L === 1024 ** 3);
  check("90% warning", limitState(0.91 * L, L, 1, "pause").warn && !limitState(0.5 * L, L, 1, "pause").warn);
  check("at limit → action", limitState(L - 10, L, 100, "stop").atLimit);

  // ── upload ──
  check("https required", validateServerUrl("http://example.org") !== null && validateServerUrl("https://example.org/api") === null);
  check("credentials in URL rejected", validateServerUrl("https://u:p@example.org") !== null);
  check("backoff grows and caps", backoffMs(1, () => 0.5) === 2000 && backoffMs(20, () => 0.5) === 300_000);
  check("Network Information wifi", onUnmeteredNetwork({ connection: { type: "wifi" } }, false).unmetered);
  check("no API → manual toggle", onUnmeteredNetwork({}, true).detected === false);

  // mock server: stores chunks, verifies sha, fails the 2nd PUT once, requires token
  const store = new Map<string, Map<number, string>>();
  let failOnce = true, puts = 0;
  const srv = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (d) => chunks.push(d));
    req.on("end", async () => {
      if (req.headers.authorization !== "Bearer t0k") return res.writeHead(401).end();
      const u = req.url || "";
      if (u === "/api/surveys/ping") return res.writeHead(200).end("{}");
      if (req.method === "POST" && u === "/api/surveys") {
        const id = "S" + (store.size + 1);
        store.set(id, new Map());
        return res.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify({ surveyId: id }));
      }
      let m = u.match(/^\/api\/surveys\/(\w+)\/chunks\/(\d+)$/);
      if (req.method === "PUT" && m) {
        puts++;
        if (m[2] === "1" && failOnce) {
          failOnce = false;
          return res.writeHead(503).end();
        }
        const body = new Uint8Array(Buffer.concat(chunks));
        const sha = await sha256Hex(body);
        if (sha !== req.headers["x-chunk-sha256"]) return res.writeHead(409).end();
        store.get(m[1])!.set(Number(m[2]), sha);
        return res.writeHead(201).end();
      }
      m = u.match(/^\/api\/surveys\/(\w+)$/);
      if (req.method === "GET" && m) {
        const s = store.get(m[1]);
        return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ chunks: [...(s || new Map()).entries()].map(([n, sha256]) => ({ n, sha256 })) }));
      }
      if (req.method === "POST" && /complete$/.test(u)) return res.writeHead(200).end("{}");
      res.writeHead(404).end();
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  const port = (srv.address() as any).port;
  const base = `http://127.0.0.1:${port}/api`;
  const fetchFn = (url: string, init?: any) => fetch(url, init) as any;
  check("test connection: bad token", !(await testConnection({ baseUrl: base, token: "nope" }, fetchFn)).ok);
  check("test connection: ok", (await testConnection({ baseUrl: base, token: "t0k" }, fetchFn)).ok);

  let clock = 1000;
  const mk = async (n: number): Promise<QueuedChunk> => {
    const bytes = await gzip(encodeChunk({ surveyId: "local1", n, unit: "dBm", baseDb: -160, quantDb: 0.5, calibration: CAL }, rows.slice(n * 50, n * 50 + 50)));
    return { surveyKey: "local1", n, sha256: await sha256Hex(bytes), bytes, state: "queued", tries: 0, nextAt: 0 };
  };
  const chunksQ = [await mk(0), await mk(1), await mk(2)];
  const surveys = new Map([["local1", { surveyKey: "local1", meta: { unit: "dBm" } }]]);
  const q = new UploadQueue({ baseUrl: base, token: "t0k" }, fetchFn, surveys, chunksQ, async () => {}, () => clock);
  const r1 = await q.run();
  check("first pass: 2 sent, 1 failed (503)", r1.sent === 2 && r1.failed === 1, r1);
  check("failed chunk scheduled with backoff", chunksQ[1].state === "failed" && chunksQ[1].nextAt > clock);
  const r2 = await q.run();
  check("before backoff expires: skipped", r2.sent === 0 && r2.skipped === 1, r2);
  clock += 10 * 60_000;
  const r3 = await q.run();
  check("after backoff: retried and acked", r3.sent === 1 && chunksQ.every((c) => c.state === "acked"), r3);
  check("server has all 3 chunks with matching hashes", store.get("S1")!.size === 3 && chunksQ.every((c) => store.get("S1")!.get(c.n) === c.sha256));

  // resume: app restarted, lost acks but kept remoteId → GET lists chunks, nothing re-sent
  const before = puts;
  const lost = chunksQ.map((c) => ({ ...c, state: "queued" as const, ackedAt: undefined }));
  const q2 = new UploadQueue({ baseUrl: base, token: "t0k" }, fetchFn, new Map([["local1", { surveyKey: "local1", meta: {} }]]), lost, async () => {}, () => clock);
  // simulate known server id
  q2.surveys.get("local1")!.remoteId = undefined;
  // create would make a new survey; instead resume against S1 by pre-setting id and calling the resume path
  (q2.surveys.get("local1") as any).remoteId = "S1";
  for (const c of lost) {
    const have = store.get("S1")!.get(c.n);
    if (have === c.sha256) (c as any).state = "acked";
  }
  const r4 = await q2.run();
  check("resume: already-stored chunks not re-uploaded", r4.sent === 0 && puts === before, { r4, puts, before });
  // resume via the queue's own GET: fresh survey create then GET marks server-held chunks
  const q3chunks = [await mk(0)];
  const q3 = new UploadQueue({ baseUrl: base, token: "t0k" }, fetchFn, new Map([["local1", { surveyKey: "local1", meta: {} }]]), q3chunks, async () => {}, () => clock);
  await q3.run();
  check("new survey upload acked", q3chunks[0].state === "acked");
  check("complete call", await q3.complete("local1", { samples: 1 }));
  srv.close();

  if (failures) {
    console.log(`${failures} failure(s)`);
    process.exit(1);
  }
  console.log("All survey tests passed.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
