// Spatial sampling, as designed in the thesis (§3.5, Fig 3.20):
//
//   • A pin (one recorded measurement) is placed only once the vehicle has
//     moved a set distance D from the previous pin, so a vehicle that stops or
//     crawls doesn't pile up samples in one place and storage stays small.
//   • Readings taken between pins are not thrown away: the signal levels are
//     averaged per frequency bin and stored with the next pin, together with
//     that pin's own time.
//
// Distances use the Haversine formula (§3.5.2, Eq 3-2) by default. The
// Euclidean form used in the thesis (Eq 3-6: √(Δlat² + Δlon²) × 111 319 m) is
// available to reproduce the thesis numbers; it ignores cos(latitude), so at
// 33° S it reads east–west distances about 20 % long.

export type DistanceFormula = "haversine" | "euclidean";

/** Earth radius used in the thesis (Eq 3-2). */
export const EARTH_RADIUS_M = 6_367_450;
/** Metres per degree used in the thesis (Eq 3-3, Eq 3-6). */
export const METRES_PER_DEGREE = 111_319;

const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Thesis Eq 3-6. */
export function euclideanM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.hypot(lat2 - lat1, lon2 - lon1) * METRES_PER_DEGREE;
}

export function distanceM(formula: DistanceFormula, lat1: number, lon1: number, lat2: number, lon2: number): number {
  return formula === "euclidean" ? euclideanM(lat1, lon1, lat2, lon2) : haversineM(lat1, lon1, lat2, lon2);
}

export type SamplePosition = {
  lat: number;
  lon: number;
  /** Epoch ms of the fix. */
  t: number;
  accuracyM?: number;
  speedKmh?: number;
};

export type PinDecision = {
  place: boolean;
  /** Distance from the previous pin (0 for the first). */
  distanceM: number;
  reason: "first" | "distance" | "too-close" | "jitter";
};

export type SamplerOptions = {
  spacingM: number;
  formula: DistanceFormula;
  /**
   * Don't place a pin while standing still just because the GPS position
   * wandered: when the move is smaller than the fix's own accuracy and the
   * receiver reports no speed, wait. (Not in the thesis; phone GPS drifts
   * several metres while parked, which at 5 m spacing would drop pins.)
   */
  jitterGuard: boolean;
};

export class SpatialSampler {
  private last: SamplePosition | null = null;
  constructor(public opts: SamplerOptions) {}

  get lastPin(): SamplePosition | null {
    return this.last;
  }

  reset() {
    this.last = null;
  }

  /** Continue from an existing recording's last pin (after a reload). */
  resume(p: SamplePosition | null) {
    this.last = p;
  }

  distanceFromLast(p: { lat: number; lon: number }): number {
    return this.last ? distanceM(this.opts.formula, this.last.lat, this.last.lon, p.lat, p.lon) : 0;
  }

  /** Thesis Fig 3.20: compare the new coordinate with the last pin. */
  decide(p: SamplePosition): PinDecision {
    if (!this.last) return { place: true, distanceM: 0, reason: "first" };
    const d = this.distanceFromLast(p);
    if (d < this.opts.spacingM) return { place: false, distanceM: d, reason: "too-close" };
    if (this.opts.jitterGuard && p.accuracyM !== undefined && d < p.accuracyM && !((p.speedKmh ?? 0) > 3)) {
      return { place: false, distanceM: d, reason: "jitter" };
    }
    return { place: true, distanceM: d, reason: "distance" };
  }

  commit(p: SamplePosition) {
    this.last = p;
  }
}

/**
 * Averages readings between pins in linear power (mW or full-scale power),
 * the physically meaningful mean of dB values, per named level and per
 * spectrum bin.
 */
export class PowerAverager {
  private sums = new Map<string, number>();
  private counts = new Map<string, number>();
  private bins: Float64Array | null = null;
  private binCount = 0;

  get blocks(): number {
    return this.binCount;
  }

  get levelCount(): number {
    let n = 0;
    for (const c of this.counts.values()) n = Math.max(n, c);
    return n;
  }

  reset() {
    this.sums.clear();
    this.counts.clear();
    this.bins = null;
    this.binCount = 0;
  }

  addLevels(levels: Record<string, number>) {
    for (const [k, v] of Object.entries(levels)) {
      if (!Number.isFinite(v)) continue;
      this.sums.set(k, (this.sums.get(k) ?? 0) + Math.pow(10, v / 10));
      this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
    }
  }

  meanLevels(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, s] of this.sums) out[k] = 10 * Math.log10(s / (this.counts.get(k) || 1));
    return out;
  }

  /** Adds one spectrum (dB per bin, plus an optional offset). A spectrum of a different size restarts the average. */
  addSpectrum(db: ArrayLike<number>, offsetDb = 0) {
    if (!this.bins || this.bins.length !== db.length) {
      this.bins = new Float64Array(db.length);
      this.binCount = 0;
    }
    for (let i = 0; i < db.length; i++) this.bins[i] += Math.pow(10, (db[i] + offsetDb) / 10);
    this.binCount++;
  }

  /** Mean spectrum in dB, or null when nothing was added. */
  meanSpectrum(): Float32Array | null {
    if (!this.bins || !this.binCount) return null;
    const out = new Float32Array(this.bins.length);
    for (let i = 0; i < out.length; i++) out[i] = 10 * Math.log10(this.bins[i] / this.binCount);
    return out;
  }
}

/**
 * Levels from one spectrum, as in the thesis MATLAB tool (Appendix A-2):
 * peak = max inside the measurement bandwidth, band mean = mean inside it,
 * spectrum mean = mean over the whole span (means in linear power).
 */
export function spectrumLevels(
  db: ArrayLike<number>,
  centerHz: number,
  sampleRate: number,
  bwHz: number | null
): { peak: number; peakHz: number; band: number; spec: number; bandBins: number } {
  const n = db.length;
  const [b0, b1] = bandBins(n, sampleRate, bwHz);
  let pk = -Infinity;
  let pkIdx = b0;
  let sumBand = 0;
  let sumAll = 0;
  for (let k = 0; k < n; k++) {
    const lin = Math.pow(10, db[k] / 10);
    sumAll += lin;
    if (k >= b0 && k < b1) {
      sumBand += lin;
      if (db[k] > pk) {
        pk = db[k];
        pkIdx = k;
      }
    }
  }
  return {
    peak: pk,
    peakHz: centerHz + ((pkIdx - n / 2) * sampleRate) / n,
    band: 10 * Math.log10(sumBand / Math.max(1, b1 - b0)),
    spec: 10 * Math.log10(sumAll / n),
    bandBins: b1 - b0,
  };
}

/** Bin range [b0, b1) of the measurement bandwidth around the centre; null = centre 50 % of the span. */
export function bandBins(n: number, sampleRate: number, bwHz: number | null): [number, number] {
  if (!bwHz || bwHz <= 0 || bwHz >= sampleRate) {
    const q = n >> 2;
    return [q, n - q];
  }
  const half = Math.max(1, Math.round(((bwHz / sampleRate) * n) / 2));
  const c = n >> 1;
  return [Math.max(0, c - half), Math.min(n, c + half)];
}
