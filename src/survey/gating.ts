// Sample gating and squelch for RM surveys (PROPOSAL §11.4). Reuses the
// thesis SpatialSampler idea (distance + jitter guard) and adds time and
// change gates plus a noise-threshold squelch with hysteresis.

import { haversineM } from "../sampling/spatial.js";

export interface Fix {
  t: number;
  lat: number;
  lon: number;
  accM?: number;
  speed?: number | null;
}

export interface GateOpts {
  distM: number;
  timeS: number;
  changeDb: number;
}

export type GateReason = "first" | "distance" | "time" | "change" | "none" | "jitter";

/** A sample is kept when it is the first, moved ≥ distM, aged ≥ timeS, or any value changed ≥ changeDb. */
export class SampleGate {
  private last: { fix: Fix; values: Float32Array } | null = null;
  constructor(public o: GateOpts) {}
  test(fix: Fix, values: Float32Array): GateReason {
    const l = this.last;
    if (!l) return "first";
    if (this.o.changeDb > 0 && l.values.length === values.length) {
      for (let i = 0; i < values.length; i++) if (Math.abs(values[i] - l.values[i]) >= this.o.changeDb) return "change";
    }
    const d = haversineM(l.fix.lat, l.fix.lon, fix.lat, fix.lon);
    let jitter = false;
    if (this.o.distM > 0 && d >= this.o.distM) {
      jitter = (fix.accM ?? 0) > d && !(fix.speed && fix.speed > 0);
      if (!jitter) return "distance";
    }
    if (this.o.timeS > 0 && fix.t - l.fix.t >= this.o.timeS * 1000) return "time";
    return jitter ? "jitter" : "none";
  }
  commit(fix: Fix, values: Float32Array) {
    this.last = { fix, values: values.slice() };
  }
  /** test + commit when kept. */
  offer(fix: Fix, values: Float32Array): GateReason {
    const r = this.test(fix, values);
    if (r !== "none" && r !== "jitter") this.commit(fix, values);
    return r;
  }
}

/**
 * Per-value squelch with hysteresis: opens at threshold + hysteresis, closes
 * below threshold. Closed values are stored as the "below" marker (NaN →
 * encoded as the quantiser's 0 code) so gaps differ from "not measured".
 */
export class Squelch {
  private open: Uint8Array;
  constructor(public thresholdDb: number[] | number, public hysteresisDb: number, n: number) {
    this.open = new Uint8Array(n);
  }
  private thr(i: number) {
    return Array.isArray(this.thresholdDb) ? this.thresholdDb[i] : this.thresholdDb;
  }
  /** Returns a copy with closed values replaced by NaN and the count of open values. */
  apply(values: Float32Array): { out: Float32Array; open: number } {
    if (this.open.length !== values.length) this.open = new Uint8Array(values.length);
    const out = new Float32Array(values.length);
    let n = 0;
    for (let i = 0; i < values.length; i++) {
      const v = values[i], t = this.thr(i);
      if (this.open[i]) {
        if (v < t) this.open[i] = 0;
      } else if (v >= t + this.hysteresisDb) this.open[i] = 1;
      out[i] = this.open[i] ? v : NaN;
      n += this.open[i];
    }
    return { out, open: n };
  }
}

/** Peak + linear-power mean per sub-band (or per range) from a sweep spectrum. */
export function reduceBands(dB: Float32Array, groups: number): Float32Array {
  const g = Math.max(1, Math.min(groups, dB.length));
  const out = new Float32Array(2 * g);
  for (let k = 0; k < g; k++) {
    const a = Math.floor((k * dB.length) / g), b = Math.max(a + 1, Math.floor(((k + 1) * dB.length) / g));
    let pk = -Infinity, lin = 0;
    for (let i = a; i < b; i++) {
      pk = Math.max(pk, dB[i]);
      lin += Math.pow(10, dB[i] / 10);
    }
    out[2 * k] = pk;
    out[2 * k + 1] = 10 * Math.log10(lin / (b - a));
  }
  return out;
}
