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

export function done(label: string) {
  if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
  console.log(`\nAll ${label} tests passed.`);
}
if (!(globalThis as any).__dfMore) done("DF bearing/WMM");
