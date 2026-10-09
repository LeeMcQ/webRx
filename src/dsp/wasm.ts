// Loader and memory helpers for the Rust/WebAssembly DSP core (dsp-rs/).
//
// The module exposes a plain C ABI. All hot loops (FIR filtering, decimation,
// FFT, spectrum estimation) run inside WASM; JS only copies blocks in and out.
// If WASM cannot be loaded (old browser, no SIMD, blocked fetch) every shim
// falls back to the original @jtarrio/signals JavaScript implementation.

export interface DspExports {
  memory: WebAssembly.Memory;
  wrx_alloc(bytes: number): number;
  wrx_free(ptr: number, bytes: number): void;
  wrx_version(): number;
  wrx_simd(): number;

  fir_new(coefs: number, n: number): number;
  fir_free(h: number): void;
  fir_set_coefs(h: number, coefs: number, n: number): void;
  fir_delay(h: number): number;
  fir_load(h: number, p: number, n: number): void;
  fir_get(h: number, index: number): number;
  fir_in_place(h: number, p: number, n: number): void;
  fir_downsample(
    h: number,
    input: number,
    n: number,
    ratio: number,
    out: number,
    outCap: number
  ): number;

  fft_new(n: number): number;
  fft_free(h: number): void;
  fft_window_ptr(h: number): number;
  fft_in_re_ptr(h: number): number;
  fft_in_im_ptr(h: number): number;
  fft_out_re_ptr(h: number): number;
  fft_out_im_ptr(h: number): number;
  fft_forward(h: number, len: number, hasImag: number): void;
  fft_reverse(h: number, len: number): void;
  fft_mag_db(h: number, out: number, n: number): void;
  fft_psd_iq8(
    h: number,
    raw: number,
    nbytes: number,
    signed: number,
    out: number,
    outN: number,
    offsetDb: number
  ): number;

  u8_to_f32_iq(input: number, nbytes: number, outI: number, outQ: number): void;
}

export const DSP_ABI_VERSION = 1;

let exportsRef: DspExports | null = null;
let disabled = false;
let lastError: string | undefined;

/** Returns the loaded DSP module, or null if it isn't (or can't be) used. */
export function dsp(): DspExports | null {
  return disabled ? null : exportsRef;
}

/** Status of the WASM DSP engine, for display in the UI. */
export function dspStatus(): {
  active: boolean;
  simd: boolean;
  error?: string;
} {
  const ex = dsp();
  return {
    active: ex !== null,
    simd: ex !== null && ex.wrx_simd() === 1,
    error: lastError,
  };
}

/** Disables the WASM engine (useful for A/B benchmarking). Takes effect for new DSP objects. */
export function setDspDisabled(value: boolean) {
  disabled = value;
}

function accept(instance: WebAssembly.Instance): boolean {
  const ex = instance.exports as unknown as DspExports;
  if (typeof ex.wrx_version !== "function" || ex.wrx_version() !== DSP_ABI_VERSION) {
    lastError = "DSP module ABI mismatch";
    return false;
  }
  exportsRef = ex;
  lastError = undefined;
  return true;
}

/** Synchronously instantiates the module from bytes (Node, tests, benchmarks). */
export function loadDspSync(bytes: BufferSource): boolean {
  try {
    const module = new WebAssembly.Module(bytes);
    return accept(new WebAssembly.Instance(module, {}));
  } catch (e) {
    lastError = String(e);
    return false;
  }
}

/** Fetches and instantiates the module. Resolves to true when WASM DSP is active. */
export async function loadDsp(url: string | URL): Promise<boolean> {
  if (exportsRef) return true;
  try {
    if (typeof WebAssembly !== "object") throw new Error("WebAssembly unavailable");
    const response = fetch(url);
    let result: WebAssembly.WebAssemblyInstantiatedSource;
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        result = await WebAssembly.instantiateStreaming(response, {});
      } catch (_) {
        // Wrong MIME type on some static hosts: fall back to an ArrayBuffer.
        const buf = await (await fetch(url)).arrayBuffer();
        result = await WebAssembly.instantiate(buf, {});
      }
    } else {
      const buf = await (await response).arrayBuffer();
      result = await WebAssembly.instantiate(buf, {});
    }
    return accept(result.instance);
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.warn("WASM DSP unavailable, using JavaScript DSP:", lastError);
    return false;
  }
}

// ── memory helpers ──────────────────────────────────────────────

/** A float32 view of WASM memory. Views must be re-created after any call that may allocate. */
export function f32View(ex: DspExports, ptr: number, n: number): Float32Array {
  return new Float32Array(ex.memory.buffer, ptr, n);
}

export function u8View(ex: DspExports, ptr: number, n: number): Uint8Array {
  return new Uint8Array(ex.memory.buffer, ptr, n);
}

/**
 * A growable scratch buffer in WASM memory, reused across calls so the hot path
 * never allocates. Each owner should keep its own Scratch.
 */
export class Scratch {
  private ptr = 0;
  private bytes = 0;

  constructor(private ex: DspExports) {}

  /** Returns a pointer to at least `bytes` bytes (16-byte aligned). */
  get(bytes: number): number {
    if (bytes > this.bytes) {
      if (this.bytes > 0) this.ex.wrx_free(this.ptr, this.bytes);
      // Grow geometrically to avoid repeated reallocations on jittery block sizes.
      const want = Math.max(bytes, Math.ceil(this.bytes * 1.5), 4096);
      this.ptr = this.ex.wrx_alloc(want);
      this.bytes = want;
    }
    return this.ptr;
  }

  free() {
    if (this.bytes > 0) this.ex.wrx_free(this.ptr, this.bytes);
    this.ptr = 0;
    this.bytes = 0;
  }
}

/** Copies a JS float array into WASM memory at `ptr`. */
export function putF32(
  ex: DspExports,
  ptr: number,
  data: ArrayLike<number>,
  n: number
) {
  const view = f32View(ex, ptr, n);
  if (data instanceof Float32Array) {
    view.set(n === data.length ? data : data.subarray(0, n));
  } else {
    for (let i = 0; i < n; ++i) view[i] = data[i];
  }
}

/** Frees native handles when their JS wrapper is garbage-collected. */
export const nativeRegistry: FinalizationRegistry<() => void> | null =
  typeof FinalizationRegistry === "function"
    ? new FinalizationRegistry((release: () => void) => {
        try {
          release();
        } catch (_) {}
      })
    : null;
