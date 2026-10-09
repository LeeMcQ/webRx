// Drop-in replacement for @jtarrio/signals/dsp/resamplers.js.
//
// The original decimator calls FIRFilter.get() once per output sample from
// JavaScript. Here the whole block is filtered and decimated in one WASM call,
// so there is no per-sample JS↔WASM crossing.

import * as orig from "@jtarrio/signals/dsp/resamplers.js";
import { Float32Pool } from "@jtarrio/signals/dsp/buffers.js";
import { makeLowPassKernel } from "@jtarrio/signals/dsp/coefficients.js";
import { DspExports, dsp, f32View, nativeRegistry, putF32 } from "../wasm.js";
import { scratchIn, scratchOut } from "./shared.js";

class WasmDownsampler {
  private readonly handle: number;
  private readonly pool = new Float32Pool(2);
  private readonly delay: number;

  constructor(
    private readonly ex: DspExports,
    private readonly ratio: number,
    coefs: Float32Array
  ) {
    const p = scratchIn(ex, coefs.length * 4);
    putF32(ex, p, coefs, coefs.length);
    const handle = ex.fir_new(p, coefs.length);
    this.handle = handle;
    this.delay = Math.floor(coefs.length / 2);
    nativeRegistry?.register(this, () => ex.fir_free(handle));
  }

  downsample(samples: Float32Array): Float32Array {
    const ex = this.ex;
    const n = samples.length;
    const len = Math.floor(n / this.ratio);
    const output = this.pool.get(len);
    const pin = scratchIn(ex, Math.max(4, n * 4));
    const pout = scratchOut(ex, Math.max(4, len * 4));
    putF32(ex, pin, samples, n);
    const got = ex.fir_downsample(this.handle, pin, n, this.ratio, pout, len);
    output.set(f32View(ex, pout, got));
    return output;
  }

  getDelay(): number {
    return this.delay;
  }
}

function kernelFor(
  inRate: number,
  outRate: number,
  filterSpec: number | Float32Array
): Float32Array {
  return typeof filterSpec === "number"
    ? makeLowPassKernel(inRate, outRate / 2, filterSpec)
    : filterSpec;
}

/** Converts a real input to a lower sample rate (WASM when available). */
export class RealDownsampler extends orig.RealDownsampler {
  private wasm?: WasmDownsampler;

  constructor(inRate: number, outRate: number, filterSpec: number | Float32Array) {
    const ex = dsp();
    if (!ex) {
      super(inRate, outRate, filterSpec as any);
      return;
    }
    // Construct the base cheaply (1-tap kernel); all work goes to WASM.
    super(inRate, outRate, new Float32Array(1));
    this.wasm = new WasmDownsampler(ex, inRate / outRate, kernelFor(inRate, outRate, filterSpec));
  }

  downsample(input: Float32Array): Float32Array {
    return this.wasm ? this.wasm.downsample(input) : super.downsample(input);
  }

  getDelay(): number {
    return this.wasm ? this.wasm.getDelay() : super.getDelay();
  }
}

/** Converts a complex input to a lower sample rate (WASM when available). */
export class ComplexDownsampler extends orig.ComplexDownsampler {
  private wasmI?: WasmDownsampler;
  private wasmQ?: WasmDownsampler;

  constructor(inRate: number, outRate: number, filterSpec: number | Float32Array) {
    const ex = dsp();
    if (!ex) {
      super(inRate, outRate, filterSpec as any);
      return;
    }
    super(inRate, outRate, new Float32Array(1));
    const kernel = kernelFor(inRate, outRate, filterSpec);
    this.wasmI = new WasmDownsampler(ex, inRate / outRate, kernel);
    this.wasmQ = new WasmDownsampler(ex, inRate / outRate, kernel);
  }

  downsample(I: Float32Array, Q: Float32Array): [Float32Array, Float32Array] {
    if (this.wasmI && this.wasmQ) {
      return [this.wasmI.downsample(I), this.wasmQ.downsample(Q)];
    }
    return super.downsample(I, Q);
  }

  getDelay(): number {
    return this.wasmI ? this.wasmI.getDelay() : super.getDelay();
  }
}
