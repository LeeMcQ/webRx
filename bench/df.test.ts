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

export function done(label: string) {
  if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
  console.log(`\nAll ${label} tests passed.`);
}
if (!(globalThis as any).__dfMore) done("DF bearing/WMM");
