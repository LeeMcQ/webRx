import { binSamples, fitBearing, headingAt, interpolateGaps, sweepDirections, Sample } from "../src/df/bearing.js";
import { magField } from "../src/df/wmm.js";
declare const process: { exit(code: number): never };
let failures = 0;
export function check(name: string, cond: boolean, detail?: any) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  if (!cond) failures++;
}
const near = (n: string, a: number, b: number, tol: number) => check(`${n} (${a.toFixed(3)} ≈ ${b})`, Math.abs(a - b) <= tol, { got: a, want: b });
const circ = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

// ── bearing fit: cos^n Yagi pattern, HPBW known analytically ──
const yagi = (true_: number, step: number, n = 8, floor = -90, peak = -50, noise = 0) => {
  const s: Sample[] = [];
  let t = 0;
  for (let h = 0; h < 360; h += step) {
    const d = ((h - true_) * Math.PI) / 180;
    const g = Math.max(1e-4, Math.cos(d / 2) ** (2 * n)); // power pattern
    s.push({ h, db: 10 * Math.log10(10 ** (peak / 10) * g + 10 ** (floor / 10)) + noise * Math.sin(h * 7.3), t: (t += 50) });
  }
  return s;
};
// HPBW of cos^(2n)(θ/2): cos^(2n)(x)=0.5 → x=acos(0.5^(1/2n)), HPBW=4x
const hpbw = (n: number) => (4 * Math.acos(0.5 ** (1 / (2 * n))) * 180) / Math.PI;
for (const [t, step] of [[123, 1], [123, 3], [123, 10], [358, 3], [2, 5], [200.5, 7]] as [number, number][]) {
  const f = fitBearing(binSamples(yagi(t, step)))!;
  near(`peak fit ${t}° @${step}° steps`, circ(f.bearing, t), 0, step >= 7 ? 1.5 : 0.75);
}
near("HPBW n=8 measured", fitBearing(binSamples(yagi(90, 1, 8)))!.beamwidth, hpbw(8), 1.5);
near("HPBW n=3 measured", fitBearing(binSamples(yagi(90, 1, 3)))!.beamwidth, hpbw(3), 2.5);
const fb = fitBearing(binSamples(yagi(45, 2)))!;
check("front/back ≈ 40 dB", fb.frontBackDb! > 35, fb.frontBackDb);
check("good quality on clean sweep", fb.quality === "good", fb);
// isolated spike must not win (regression for the v1 ±5° mean bug)
const sp: Sample[] = [...yagi(120, 3, 8, -90, -60).filter((s) => Math.abs(s.h - 120) < 60 || s.h > 330), { h: 300, db: -40, t: 0 }];
near("isolated spike ignored", circ(fitBearing(binSamples(sp))!.bearing, 120), 0, 2);
// loop null: |sin| pattern → null at 70 and 250
const loop: Sample[] = [];
for (let h = 0; h < 360; h += 2) loop.push({ h, db: 10 * Math.log10(Math.sin(((h - 70) * Math.PI) / 180) ** 2 + 1e-3) - 60, t: h });
const nf = fitBearing(binSamples(loop), "null")!;
check(`loop null 70/250 (got ${nf.bearing.toFixed(1)})`, Math.min(circ(nf.bearing, 70), circ(nf.bearing, 250)) < 1.5);
// gap interpolation
const gi = interpolateGaps([1, null, null, 4, ...new Array(356).fill(null)], 5);
check("gap interpolation linear", gi[1] === 2 && gi[2] === 3 && gi[10] === null, gi.slice(0, 5));
// sweep direction detection
const cw = yagi(100, 2);
check("cw only", JSON.stringify(sweepDirections(cw, 100)) === JSON.stringify({ cw: true, ccw: false }));
check("both ways", sweepDirections([...cw, ...cw.slice().reverse()], 100).ccw);
// heading interpolation by timestamp, incl. wrap
near("headingAt interpolates across 0°", headingAt([{ t: 0, h: 350 }, { t: 100, h: 10 }], 50)!, 0, 1e-9);
check("headingAt refuses stale gaps", headingAt([{ t: 0, h: 1 }, { t: 2000, h: 2 }], 1000) === undefined);

// ── WMM2025 vs NOAA official test values ──
for (const [y, alt, la, lo, D, I] of [[2025, 28, 89, -121, -99.77, 88.47], [2025, 51, -33, 109, -5.49, -67.5], [2025, 18, 0, 21, 1.29, -26.06], [2025.5, 6, -36, -137, 20.28, -52.11], [2025, 39, -59, -8, -15.75, -58.55], [2025.5, 63, 26, 81, 0.51, 41.07]]) {
  const m = magField(la, lo, alt, y);
  near(`WMM D ${la},${lo}`, m.declination, D, 0.01);
  near(`WMM I ${la},${lo}`, m.inclination, I, 0.01);
}
const jhb = magField(-26.2041, 28.0473, 1.75, 2026.8).declination;
near("Johannesburg declination 2026.8 (NOAA calc ≈ −20.8°)", jhb, -20.8, 0.6);
const cpt = magField(-33.9249, 18.4241, 0, 2026.8).declination;
near("Cape Town declination 2026.8 (≈ −26.5°)", cpt, -26.5, 1.0);

// ── triangulation: analytic case ──
import { triangulate, intersect2, ellipseFromCov, toEnu, destination } from "../src/df/triangulate.js";
import { fspl, distanceForLoss, distanceHint } from "../src/df/pathloss.js";
{
  const lat0 = -26.2, lon0 = 28.05;
  // Tx 1 km north-east-ish at ENU (600, 800); stations at (0,0) and (1200,0)
  const tx: [number, number] = [600, 800];
  const st: [number, number][] = [[0, 0], [1200, 0], [600, -400]];
  const brg = (p: [number, number]) => ((Math.atan2(tx[0] - p[0], tx[1] - p[1]) * 180) / Math.PI + 360) % 360;
  const ll = (p: [number, number]) => [lat0 + p[1] / 6371008.8 * 180 / Math.PI, lon0 + p[0] / (6371008.8 * Math.cos(lat0 * Math.PI / 180)) * 180 / Math.PI];
  const x = intersect2(st[0], brg(st[0]), st[1], brg(st[1]))!;
  near("intersect2 E", x[0], 600, 1e-6); near("intersect2 N", x[1], 800, 1e-6);
  check("intersect2 rejects diverging", intersect2([0, 0], 270, [100, 0], 90) === null);
  const sol = triangulate(st.map((p) => { const [la, lo] = ll(p); return { lat: la, lon: lo, bearing: brg(p), sigma: 3 }; }))!;
  const [e, n] = toEnu(lat0, lon0, sol.lat, sol.lon);
  near("WLS exact bearings → Tx E", e, 600, 0.5); near("WLS exact bearings → Tx N", n, 800, 0.5);
  check("cocked hat degenerates to a point", sol.cockedHat!.every(([a, b]) => Math.hypot(...toEnu(sol.lat, sol.lon, a, b)) < 0.5));
  // 2 perpendicular bearings, equal range r and σ: covariance is isotropic (rσ)² → 95 % radius √5.991·rσ
  const r = 1000, sg = 2;
  const two = triangulate([{ lat: lat0 - r / 111195, lon: lon0, bearing: 0, sigma: sg }, { lat: lat0, lon: lon0 - r / (111195 * Math.cos(lat0 * Math.PI / 180)), bearing: 90, sigma: sg }])!;
  near("ellipse a = √5.991·r·σ", two.ellipse95.a, Math.sqrt(5.991) * r * sg * Math.PI / 180, 1.5);
  near("ellipse b = a (isotropic)", two.ellipse95.b, two.ellipse95.a, 1.5);
  const el = ellipseFromCov(100, 0, 25, 1);
  near("ellipse eig a", el.a, 10, 1e-9); near("ellipse eig b", el.b, 5, 1e-9); near("ellipse major axis east = 90°", el.angle, 90, 1e-9);
  near("ellipse rotated 45°", ellipseFromCov(50, 50, 50, 1).angle, 45, 1e-9);
  const [dl, dn] = destination(0, 0, 90, 111195);
  near("destination 1° east on equator", dn, 1, 1e-3); near("destination lat stays 0", dl, 0, 1e-9);
  // path loss
  near("FSPL 1 km @ 100 MHz = 72.4 dB", fspl(1000, 100e6), 72.45, 0.05);
  near("FSPL 1 km @ 433.92 MHz = 85.2 dB", fspl(1000, 433.92e6), 85.2, 0.1);
  near("inverse FSPL n=2", distanceForLoss(fspl(2500, 145e6), 145e6, 2), 2500, 1e-6);
  near("log-distance n=3 shorter", distanceForLoss(fspl(1000, 145e6), 145e6, 3), 10 ** ((fspl(1000, 145e6) - fspl(1, 145e6)) / 30), 1e-6);
  near("distanceHint 30 dBm EIRP, -55 dBm rx @146 MHz n=2", distanceHint(-55, 146e6, 30, 0, 2), 10 ** ((85 - fspl(1, 146e6)) / 20), 1e-6);
}

// ── export / import ──
import { fixesToCsv, fixesToKml, fixesToGpx, encodeSession, decodeSession, importKraken } from "../src/df/io.js";
{
  const fx = { lat: -26.1, lon: 28.0, gpsAccM: 4, bearing: 45.5, north: "T" as const, sigma: 3, beamwidth: 60, snrDb: 20, frontBackDb: 18, level: -60, units: "dBm", gain: "30 dB", agc: false, headingSource: "compass-absolute", mode: "peak" as const, freqHz: 146.52e6, t: Date.UTC(2026, 9, 13), label: 'a,"b"' };
  const csv = fixesToCsv([fx]);
  check("CSV header + quoted label", csv.startsWith("t,lat,lon") && csv.includes('"a,""b"""'), csv);
  const kml = fixesToKml("Hunt <1>", [fx], { lat: -26, lon: 28.1, ellipse: [[-26, 28.1], [-26.01, 28.1]] });
  check("KML escapes name, has LineString lon,lat order", kml.includes("Hunt &lt;1&gt;") && kml.includes("<coordinates>28,-26.1,0 "), kml.slice(0, 300));
  const gpx = fixesToGpx("H", [fx], [{ lat: -26.1, lon: 28, t: fx.t, db: -61 }]);
  check("GPX wpt + trkpt", gpx.includes('<wpt lat="-26.1" lon="28">') && gpx.includes("<trkpt"));
  const tok = encodeSession({ v: 1, name: "Jagd ü", fixes: [fx] });
  check("share token URL-safe", /^[A-Za-z0-9_-]+$/.test(tok));
  check("share roundtrip", decodeSession(tok)?.fixes[0].bearing === 45.5 && decodeSession(tok)?.name === "Jagd ü");
  check("bad token → null", decodeSession("@@@") === null);
  const xml = `<DATA><STATION_ID>kraken1</STATION_ID><FREQUENCY>446.0</FREQUENCY><LATITUDE>-26.10</LATITUDE><LONGITUDE>28.00</LONGITUDE><DOA>123</DOA><CONF>80</CONF><TIME>1760000000000</TIME></DATA>`;
  const k = importKraken(xml);
  check("Kraken XML", k.length === 1 && k[0].bearing === 123 && k[0].station === "kraken1" && k[0].sigma === 10, k);
  const kj = importKraken(JSON.stringify([{ latitude: -26, longitude: 28, bearing: -10, confidence: 99 }, { lat: "x" }]));
  check("DF Aggregator JSON (wraps -10 → 350, drops bad rows)", kj.length === 1 && kj[0].bearing === 350, kj);
  const kc = importKraken("1760000000000,200,50,-40,446000000,0,10,st2,-26.2,28.1,0");
  check("Kraken CSV", kc.length === 1 && kc[0].bearing === 200 && kc[0].lat === -26.2, kc);
}

// ── HackRF sweep protocol ──
import { initSweepPayload, parseSweepTransfer, blockToSlices, SweepGrid, SweepCounter, sweepSteps, blocksForDwell, firmwareOlderThan, SWEEP_BLOCK_BYTES } from "../src/devices/sweep.js";
import { clampLnaVga } from "../src/devices/hackrf.js";
import { isBlogV4, deviceKey, RTL_MAX_FREQUENCY } from "../src/devices/provider.js";
{
  const p = initSweepPayload([[2400, 2490]], SWEEP_BLOCK_BYTES * 16);
  const dv = new DataView(p.data.buffer);
  check("INIT_SWEEP len 9+4", p.data.length === 13);
  check("step 20 MHz, offset 7.5 MHz, interleaved", dv.getUint32(0, true) === 20e6 && dv.getUint32(4, true) === 7.5e6 && p.data[8] === 1);
  check("range rounded up to 20 MHz steps (2400–2500)", dv.getUint16(9, true) === 2400 && dv.getUint16(11, true) === 2500);
  check("num_bytes split into value/index", p.value === (262144 & 0xffff) && p.index === 4);
  let threw = false; try { initSweepPayload([[1, 2]], 1000); } catch (_) { threw = true; }
  check("num_bytes must be 16384-multiple", threw);
  // synthetic transfer: 2 blocks, tone at f0 + 12.5 MHz → lands in slice 2 ([f+10, f+15))
  const buf = new Uint8Array(SWEEP_BLOCK_BYTES * 3);
  const f0 = 2_400_000_000;
  for (const blk of [0, 2]) {
    const o = blk * SWEEP_BLOCK_BYTES;
    buf[o] = 0x7f; buf[o + 1] = 0x7f;
    const d = new DataView(buf.buffer, o + 2, 8);
    d.setUint32(0, f0 % 2 ** 32, true); d.setUint32(4, Math.floor(f0 / 2 ** 32), true);
    // LO = f0 + 7.5 MHz; tone at +5 MHz baseband → RF f0 + 12.5 MHz
    for (let i = 0; i < (SWEEP_BLOCK_BYTES - 10) / 2; ++i) {
      const ph = 2 * Math.PI * (5e6 / 20e6) * i;
      buf[o + 10 + 2 * i] = (Math.round(100 * Math.cos(ph)) + 256) & 0xff;
      buf[o + 11 + 2 * i] = (Math.round(100 * Math.sin(ph)) + 256) & 0xff;
    }
  }
  const blocks = parseSweepTransfer(buf);
  check("parse: header blocks only (2 of 3)", blocks.length === 2, blocks.length);
  check("parse: uint64 LE freq", blocks[0].freqHz === f0, blocks[0]?.freqHz);
  const sl = blockToSlices(blocks[0]);
  check("2 slices of 64 bins @78.125 kHz", sl.length === 2 && sl[0].db.length === 64 && sl[0].binHz === 78125);
  check("slice starts f, f+10 MHz", sl[0].startHz === f0 && sl[1].startHz === f0 + 10e6);
  const g = new SweepGrid(2400e6, 2420e6, 256);
  for (const x of sl) g.add(x);
  check("grid publishes only at the end of a sweep", g.peaks(1).length === 0 && g.sweeps === 0);
  g.endSweep();
  near("sweep peak at f0+12.5 MHz", g.peaks(1)[0].hz, f0 + 12.5e6, 120e3);
  // the tone keeps its level when grid bins are finer than FFT bins (old code decayed per FFT bin)
  const fine = new SweepGrid(2400e6, 2420e6, 4096);
  for (const x of sl) fine.add(x);
  fine.endSweep();
  const coarse = g.peaks(1)[0].db;
  near("fine grid: same peak level as a coarse grid", fine.peaks(1)[0].db, coarse, 0.01);
  const fineVals = Array.from(fine.db).filter(Number.isFinite);
  check("fine grid: every covered bin filled", fineVals.length >= 4096 * 0.49, fineVals.length);
}
// ── sweep detectors, hold, discard ──
{
  const mk = (db: number[]) => ({ startHz: 0, binHz: 100, db: new Float32Array(db) });
  const peak = new SweepGrid(0, 400, 1, "peak"), avg = new SweepGrid(0, 400, 1, "avg"), rms = new SweepGrid(0, 400, 1, "rms");
  for (const gg of [peak, avg, rms]) gg.add(mk([-80, -80, -80, -50])), gg.endSweep();
  near("detector peak = max", peak.db[0], -50, 1e-4);
  near("detector avg = mean of dB", avg.db[0], -72.5, 1e-4);
  near("detector rms = mean power", rms.db[0], 10 * Math.log10((3e-8 + 1e-5) / 4), 1e-3);
  const hold = new SweepGrid(0, 400, 1, "peak", 0.5);
  hold.add(mk([-50])), hold.endSweep();
  hold.add(mk([-90])), hold.endSweep();
  near("display hold decays 0.5 dB per sweep, not per bin", hold.db[0], -50.5, 1e-4);
  const d = new SweepGrid(0, 400, 1, "peak");
  d.add(mk([-60])), d.endSweep();
  d.add(mk([-20])), d.discard(), d.endSweep();
  near("discard drops a paused partial sweep", d.db[0], -60, 1e-4);
}
// ── sweep counting ──
{
  // HackRF: 3 retunes × 2 blocks; interleaved frequencies come back round to the lowest
  const c = new SweepCounter(sweepSteps([[2400, 2460]]) * 2);
  const seq = [2400, 2400, 2420, 2420, 2440, 2440, 2400, 2400, 2420, 2420, 2440, 2440, 2400].map((x) => x * 1e6);
  const b = seq.map((f) => c.next(f));
  check("counter: boundary when the lowest frequency returns", b.filter(Boolean).length === 2 && b[6] && b[12], b);
  // single retune: frequency never changes → count blocks
  const one = new SweepCounter(sweepSteps([[100, 110]]) * 4);
  const ob = Array.from({ length: 9 }, () => one.next(100e6));
  check("counter: single-retune plan completes every N blocks", ob.filter(Boolean).length === 2 && ob[4] && ob[8], ob);
  // RTL hops (unknown count): frequency order only
  const rtl = new SweepCounter(0);
  const rb = [88, 90.4, 92.8, 88, 90.4, 92.8, 88].map((x) => rtl.next(x * 1e6));
  check("counter: RTL hops", rb.filter(Boolean).length === 2 && rb[3] && rb[6], rb);
  check("sweep steps: 2400–2490 → 5 retunes, 88–108 → 1", sweepSteps([[2400, 2490]]) === 5 && sweepSteps([[88, 108]]) === 1);
  check("dwell 6.5 ms ≈ 16 blocks (hackrf_sweep default), clamped 1–256", blocksForDwell(6.5) === 16 && blocksForDwell(0.01) === 1 && blocksForDwell(1e6) === 256);
  check("firmware 2021.03.1 older than 2023.01.1", firmwareOlderThan("2021.03.1") === true);
  check("firmware 2024.02.1 ok", firmwareOlderThan("2024.02.1") === false);
  check("git firmware unknown", firmwareOlderThan("git-1a2b3c") === null);
  check("LNA/VGA snap to 8/2 dB steps", JSON.stringify(clampLnaVga(13, 63)) === JSON.stringify({ lna: 16, vga: 62 }));
  check("Blog V4 detection from EEPROM strings", isBlogV4({ manufacturerName: "RTLSDRBlog", productName: "Blog V4" }) && !isBlogV4({ manufacturerName: "Realtek", productName: "RTL2838UHIDIR" }));
  check("device key uses serial", deviceKey({ kind: "rtlsdr", serial: "00000001", name: "x" }) === "rtlsdr:00000001");
  check("RTL max 1766 MHz", RTL_MAX_FREQUENCY === 1_766_000_000);
}

// ── DT: magnetic samples converted once declination is known; map bearings in true ──
import { Directional, trueBearing } from "../src/apps/monitor/dt.js";
import { declination } from "../src/df/wmm.js";
{
  const d = new Directional(false);
  check("no position: magnetic reference", d.northRef() === "M");
  d.addSample({ h: 100, db: -50, t: 1, m: 1 });
  d.addSample({ h: 200, db: -60, t: 2 });
  d.setPos({ lat: -26.2041, lon: 28.0473 });
  const D = declination(-26.2041, 28.0473, 0);
  check("position known: true reference", d.northRef() === "T");
  near("pending magnetic sample converted to true", d.st.samples[0].h, ((100 + D) % 360 + 360) % 360, 1e-6);
  check("conversion flag cleared; true samples untouched", d.st.samples[0].m === undefined && d.st.samples[1].h === 200);
  d.setPos({ lat: -26.3, lon: 28.1 });
  near("converted once only", d.st.samples[0].h, ((100 + D) % 360 + 360) % 360, 1e-6);
  near("magnetic fix → true for the map", trueBearing({ bearing: 10, north: "M", lat: -26.2041, lon: 28.0473 }), ((10 + D) % 360 + 360) % 360, 1e-6);
  check("true fix unchanged", trueBearing({ bearing: 10, north: "T", lat: -26.2, lon: 28 }) === 10);
}

export function done(label: string) {
  if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
  console.log(`\nAll ${label} tests passed.`);
}
if (!(globalThis as any).__dfMore) done("DF bearing/WMM");
