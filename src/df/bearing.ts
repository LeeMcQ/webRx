// Bearing estimation from a rotate-and-sweep capture with a directional antenna.
// All averaging is done in linear power. A sample is {h: heading °, db: level, t}.

export type Sample = { h: number; db: number; t: number };
export const norm = (d: number) => ((d % 360) + 360) % 360;
export const angDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180; // signed a-b in (-180,180]
const lin = (db: number) => Math.pow(10, db / 10);
const dbOf = (p: number) => 10 * Math.log10(p);

/** 360 one-degree bins, mean linear power per bin (null = no data). */
export function binSamples(samples: Sample[], n = 360): (number | null)[] {
  const s = new Array(n).fill(0), c = new Array(n).fill(0);
  for (const x of samples) { const b = Math.round(norm(x.h) * n / 360) % n; s[b] += lin(x.db); c[b]++; }
  return s.map((v, i) => (c[i] ? dbOf(v / c[i]) : null));
}

/** Fill gaps up to maxGap bins by circular linear interpolation (in dB). Larger gaps stay null. */
export function interpolateGaps(bins: (number | null)[], maxGap = 15): (number | null)[] {
  const n = bins.length, out = bins.slice();
  const idx = bins.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
  if (idx.length < 2) return out;
  for (let k = 0; k < idx.length; ++k) {
    const a = idx[k], b = idx[(k + 1) % idx.length];
    const gap = (b - a + n) % n || n;
    if (gap <= 1 || gap - 1 > maxGap) continue;
    for (let j = 1; j < gap; ++j) out[(a + j) % n] = bins[a]! + ((bins[b]! - bins[a]!) * j) / gap;
  }
  return out;
}

export type BearingFit = {
  bearing: number;          // ° (same reference as the input headings)
  peakDb: number;           // level at the peak (dB)
  beamwidth: number;        // measured -3 dB width of the lobe (°)
  floorDb: number;          // median level (approx. back/side level)
  snrDb: number;            // peak - floor
  frontBackDb: number | null; // peak - level 180° away
  sigma: number;            // 1-σ bearing uncertainty estimate (°)
  coverage: number;         // degrees with data (after interpolation)
  quality: "good" | "fair" | "poor";
  warnings: string[];
};

/**
 * Peak mode: find the strongest bin, walk out to the -3 dB points (linear-power
 * crossing), and take the power-weighted circular centroid of the lobe above -3 dB.
 * Null mode (loops): the same on the inverted pattern; the result carries a 180° ambiguity.
 */
export function fitBearing(binsIn: (number | null)[], mode: "peak" | "null" = "peak"): BearingFit | null {
  const n = binsIn.length, step = 360 / n;
  const bins = interpolateGaps(binsIn);
  const have = bins.filter((v): v is number => v !== null);
  if (have.length < 3) return null;
  const sorted = have.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const v = bins.map((x) => (x === null ? null : mode === "peak" ? x : -x));
  // smoothed (±2 bins linear) to pick the lobe, not a single spike
  let best = -1, bestV = -Infinity;
  for (let i = 0; i < n; ++i) {
    if (v[i] === null) continue;
    let s = 0, c = 0;
    for (let k = -2; k <= 2; ++k) { const y = v[(i + k + n) % n]; if (y !== null) { s += lin(y); ++c; } }
    if (c < 3) continue; // need neighbours: isolated samples can't win
    const m = s / c;
    if (m > bestV) { bestV = m; best = i; }
  }
  if (best < 0) return null;
  const peak = v[best]!;
  const thr = lin(peak) / 2;
  const warnings: string[] = [];
  let lo = best, hi = best, loEdge: number | null = null, hiEdge: number | null = null;
  for (let k = 1; k < n / 2; ++k) {
    const i = (best - k + n) % n, y = v[i];
    if (y === null) break;
    if (lin(y) < thr) { const yp = lin(v[(i + 1) % n]!); loEdge = best - k + 1 - (yp - thr) / Math.max(1e-30, yp - lin(y)); break; }
    lo = best - k;
  }
  for (let k = 1; k < n / 2; ++k) {
    const i = (best + k) % n, y = v[i];
    if (y === null) break;
    if (lin(y) < thr) { const yp = lin(v[(i - 1 + n) % n]!); hiEdge = best + k - 1 + (yp - thr) / Math.max(1e-30, yp - lin(y)); break; }
    hi = best + k;
  }
  // centroid of the lobe above -3 dB (linear power weights, circular mean)
  let sx = 0, sy = 0;
  for (let i = lo; i <= hi; ++i) {
    const y = v[((i % n) + n) % n]!;
    const w = lin(y) - thr * 0.999;
    const a = (i * step * Math.PI) / 180;
    sx += w * Math.sin(a); sy += w * Math.cos(a);
  }
  let bearing = norm((Math.atan2(sx, sy) * 180) / Math.PI);
  let beamwidth: number;
  if (loEdge !== null && hiEdge !== null) {
    beamwidth = (hiEdge - loEdge) * step;
    bearing = norm(((loEdge + hiEdge) / 2) * step); // -3 dB midpoint is the most robust estimate
  } else {
    beamwidth = (hi - lo + 1) * step;
    warnings.push("Lobe edges not found — sweep further either side of the peak");
  }
  const back = v[(best + n / 2) % n];
  const peakDb = mode === "peak" ? peak : -peak;
  const frontBackDb = back === null ? null : mode === "peak" ? peak - back : null;
  const snrDb = mode === "peak" ? peakDb - median : median - peakDb;
  const coverage = bins.filter((x) => x !== null).length * step;
  if (snrDb < 6) warnings.push("Low contrast (<6 dB) — signal may be too weak, or overloading/AGC is flattening the pattern");
  if (frontBackDb !== null && frontBackDb < 6) warnings.push("Front/back < 6 dB — reflection or near-field; check the reciprocal bearing");
  if (beamwidth > 150) warnings.push("Very wide lobe — antenna is not very directional here");
  if (coverage < 300) warnings.push("Less than 300° covered");
  // σ ≈ HPBW / (2·√(SNR_lin)) bounded to something sensible (Stansfield-style weight input)
  const sigma = Math.max(2, Math.min(45, beamwidth / (2 * Math.sqrt(Math.max(1, lin(snrDb) / 10)))));
  const quality = warnings.length === 0 && sigma < 10 ? "good" : sigma < 20 ? "fair" : "poor";
  return { bearing, peakDb, beamwidth, floorDb: median, snrDb, frontBackDb, sigma, coverage, quality, warnings };
}

/** Whether the capture contains both clockwise and anticlockwise passes over the lobe. */
export function sweepDirections(samples: Sample[], around: number, halfWidth = 30): { cw: boolean; ccw: boolean } {
  let cw = false, ccw = false;
  for (let i = 1; i < samples.length; ++i) {
    if (Math.abs(angDiff(samples[i].h, around)) > halfWidth) continue;
    const d = angDiff(samples[i].h, samples[i - 1].h);
    if (d > 0.3 && d < 20) cw = true;
    if (d < -0.3 && d > -20) ccw = true;
  }
  return { cw, ccw };
}

/**
 * Time-align: levels and headings come from different sensors with different
 * latencies. Interpolate the heading track at the level's timestamp minus a lag.
 */
export function headingAt(track: { t: number; h: number }[], t: number): number | undefined {
  if (!track.length) return undefined;
  if (t <= track[0].t) return t >= track[0].t - 200 ? track[0].h : undefined;
  for (let i = track.length - 1; i > 0; --i) {
    const a = track[i - 1], b = track[i];
    if (t >= a.t && t <= b.t) {
      if (b.t - a.t > 500) return undefined;
      const f = (t - a.t) / Math.max(1, b.t - a.t);
      return norm(a.h + angDiff(b.h, a.h) * f);
    }
  }
  const last = track[track.length - 1];
  return t - last.t <= 500 ? last.h : undefined;
}

/** Median of the last k values (robust to single-frame spikes). */
export function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
