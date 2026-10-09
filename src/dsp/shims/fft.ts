// Drop-in replacement for @jtarrio/signals/dsp/fft.js backed by rustfft (WASM SIMD).
//
// Same conventions as the original: power-of-two lengths, forward transform
// multiplies the input by window[i] / N, reverse transform is unscaled, output
// in natural order, results come from a pool of 4 so callers may hold up to
// 4 outputs at once.

import * as orig from "@jtarrio/signals/dsp/fft.js";
import { IqPool } from "@jtarrio/signals/dsp/buffers.js";
import type { Float32RingBuffer } from "@jtarrio/signals/dsp/buffers.js";
import { DspExports, dsp, f32View, nativeRegistry, putF32 } from "../wasm.js";

export { actualLength } from "@jtarrio/signals/dsp/fft.js";
export type FFTOutput = orig.FFTOutput;

class WasmFFT {
  readonly length: number;
  private readonly handle: number;
  private readonly out: IqPool;

  constructor(
    private readonly ex: DspExports,
    length: number
  ) {
    this.length = length;
    const handle = ex.fft_new(length);
    this.handle = handle;
    this.out = new IqPool(4, length);
    nativeRegistry?.register(this, () => ex.fft_free(handle));
  }

  setWindow(window: Float32Array) {
    const n = Math.min(window.length, this.length);
    f32View(this.ex, this.ex.fft_window_ptr(this.handle), this.length).set(
      window.subarray(0, n)
    );
  }

  private collect(): orig.FFTOutput {
    const [re, im] = this.out.get(this.length);
    re.set(f32View(this.ex, this.ex.fft_out_re_ptr(this.handle), this.length));
    im.set(f32View(this.ex, this.ex.fft_out_im_ptr(this.handle), this.length));
    return [re, im];
  }

  transform(real: Float32Array | number[], imag?: Float32Array | number[]): orig.FFTOutput {
    const ex = this.ex;
    let n = Math.min(this.length, real.length);
    if (imag !== undefined) n = Math.min(n, imag.length);
    putF32(ex, ex.fft_in_re_ptr(this.handle), real, n);
    if (imag !== undefined) putF32(ex, ex.fft_in_im_ptr(this.handle), imag, n);
    ex.fft_forward(this.handle, n, imag !== undefined ? 1 : 0);
    return this.collect();
  }

  transformCircularBuffers(real: Float32RingBuffer, imag: Float32RingBuffer): orig.FFTOutput {
    const ex = this.ex;
    real.copyTo(f32View(ex, ex.fft_in_re_ptr(this.handle), this.length));
    imag.copyTo(f32View(ex, ex.fft_in_im_ptr(this.handle), this.length));
    ex.fft_forward(this.handle, this.length, 1);
    return this.collect();
  }

  reverse(real: Float32Array | number[], imag: Float32Array | number[]): orig.FFTOutput {
    const ex = this.ex;
    const n = Math.min(this.length, real.length, imag.length);
    putF32(ex, ex.fft_in_re_ptr(this.handle), real, n);
    putF32(ex, ex.fft_in_im_ptr(this.handle), imag, n);
    ex.fft_reverse(this.handle, n);
    return this.collect();
  }
}

/** FFT: rustfft/WASM when available, original JavaScript otherwise. */
export class FFT {
  /** Returns an FFT whose length is the next power of two ≥ minimumLength. */
  static ofLength(minimumLength: number): orig.FFT {
    const ex = dsp();
    if (!ex) return orig.FFT.ofLength(minimumLength);
    return new WasmFFT(ex, orig.actualLength(minimumLength)) as unknown as orig.FFT;
  }
}
