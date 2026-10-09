// Drop-in replacement for @jtarrio/signals/dsp/filters.js.
//
// Everything is re-exported unchanged except FIRFilter, whose inner loop the
// library itself measures at ~85% of total CPU time. When the WASM DSP core is
// loaded, FIRFilter runs in Rust with SIMD; otherwise the original class is used.
// The build swaps this module in for the original (see build.mjs).

import * as orig from "@jtarrio/signals/dsp/filters.js";
import { DspExports, dsp, f32View, nativeRegistry, putF32 } from "../wasm.js";
import { scratchIn } from "./shared.js";

export * from "@jtarrio/signals/dsp/filters.js";

class WasmFIRFilter {
  coefs: Float32Array;
  private readonly handle: number;

  constructor(
    private readonly ex: DspExports,
    coefs: Float32Array
  ) {
    this.coefs = coefs;
    const p = scratchIn(ex, coefs.length * 4);
    putF32(ex, p, coefs, coefs.length);
    const handle = ex.fir_new(p, coefs.length);
    this.handle = handle;
    nativeRegistry?.register(this, () => ex.fir_free(handle));
  }

  setCoefficients(coefs: Float32Array) {
    this.coefs = coefs;
    const p = scratchIn(this.ex, coefs.length * 4);
    putF32(this.ex, p, coefs, coefs.length);
    this.ex.fir_set_coefs(this.handle, p, coefs.length);
  }

  clone(): orig.FIRFilter {
    return new FIRFilter(this.coefs);
  }

  getDelay(): number {
    return Math.floor(this.coefs.length / 2);
  }

  inPlace(samples: Float32Array) {
    const n = samples.length;
    if (n === 0) return;
    const p = scratchIn(this.ex, n * 4);
    putF32(this.ex, p, samples, n);
    this.ex.fir_in_place(this.handle, p, n);
    samples.set(f32View(this.ex, p, n));
  }

  loadSamples(samples: Float32Array) {
    const n = samples.length;
    const p = scratchIn(this.ex, Math.max(4, n * 4));
    putF32(this.ex, p, samples, n);
    this.ex.fir_load(this.handle, p, n);
  }

  get(index: number): number {
    return this.ex.fir_get(this.handle, index);
  }
}

/** FIR filter: Rust/WASM when available, original JavaScript otherwise. */
export class FIRFilter extends orig.FIRFilter {
  constructor(coefs: Float32Array) {
    const ex = dsp();
    if (ex) {
      // Returning an object from a constructor replaces `this`; super() is skipped on purpose.
      return new WasmFIRFilter(ex, coefs) as unknown as FIRFilter;
    }
    super(coefs);
  }
}
