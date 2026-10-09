// Benchmarks the original JavaScript DSP against the Rust/WASM DSP core and
// checks that both produce the same output.
//
// Run with:  npm run bench:dsp
// (bundles this file with the same shim plugin the app uses, then runs it in Node)

import { DemodAM } from "@jtarrio/signals/demod/demod-am.js";
import { DemodNBFM } from "@jtarrio/signals/demod/demod-nbfm.js";
import { DemodWBFM } from "@jtarrio/signals/demod/demod-wbfm.js";
import { Spectrum } from "@jtarrio/signals/demod/spectrum.js";
import { dsp, dspStatus, f32View, loadDspSync, setDspDisabled, u8View } from "../src/dsp/wasm.js";

declare const process: { argv: string[]; exit(code: number): never };
declare function require(name: string): any;

const fs = require("fs");
const path = require("path");

type Demod = {
  demodulate(I: Float32Array, Q: Float32Array, off: number): { left: Float32Array; right: Float32Array };
};

const BLOCK_SECONDS = 0.05;

/** Wideband FM test signal: stereo-ish multiplex of two tones, deviation 75 kHz. */
function makeFmSignal(rate: number, seconds: number): [Float32Array, Float32Array] {
  const n = Math.floor(rate * seconds);
  const I = new Float32Array(n);
  const Q = new Float32Array(n);
  let phase = 0;
  for (let t = 0; t < n; ++t) {
    const s = t / rate;
    const audio =
      0.45 * Math.sin(2 * Math.PI * 1000 * s) +
      0.1 * Math.sin(2 * Math.PI * 19000 * s) +
      0.3 * Math.sin(2 * Math.PI * 38000 * s) * Math.sin(2 * Math.PI * 440 * s);
    phase += (2 * Math.PI * 75000 * audio) / rate;
    I[t] = 0.7 * Math.cos(phase) + 0.01 * (Math.random() - 0.5);
    Q[t] = 0.7 * Math.sin(phase) + 0.01 * (Math.random() - 0.5);
  }
  return [I, Q];
}

function runDemod(make: () => Demod, I: Float32Array, Q: Float32Array, rate: number) {
  const demod = make();
  const block = Math.floor(rate * BLOCK_SECONDS);
  const outs: Float32Array[] = [];
  // Warm-up pass so both engines are JIT/tier-up compiled before timing.
  for (let o = 0; o + block <= Math.min(I.length, block * 4); o += block) {
    make().demodulate(I.slice(o, o + block), Q.slice(o, o + block), 0);
  }
  const t0 = performance.now();
  for (let o = 0; o + block <= I.length; o += block) {
    const r = demod.demodulate(I.slice(o, o + block), Q.slice(o, o + block), 0);
    outs.push(new Float32Array(r.left));
  }
  const ms = performance.now() - t0;
  let total = 0;
  for (const o of outs) total += o.length;
  const all = new Float32Array(total);
  let p = 0;
  for (const o of outs) {
    all.set(o, p);
    p += o.length;
  }
  return { ms, audio: all };
}

function compare(a: Float32Array, b: Float32Array) {
  let maxErr = 0;
  let peak = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; ++i) {
    maxErr = Math.max(maxErr, Math.abs(a[i] - b[i]));
    peak = Math.max(peak, Math.abs(a[i]));
  }
  return { maxErr, rel: peak > 0 ? maxErr / peak : maxErr, sameLength: a.length === b.length };
}

type Row = {
  name: string;
  jsMs: number;
  wasmMs: number;
  signalSeconds: number;
  rel?: number;
  ok: boolean;
};

function bothEngines<T>(fn: () => T): [T, T] {
  setDspDisabled(true);
  const js = fn();
  setDspDisabled(false);
  const wasm = fn();
  return [js, wasm];
}

function demodCase(name: string, rate: number, seconds: number, make: () => Demod): Row {
  const [I, Q] = makeFmSignal(rate, seconds);
  const [js, wasm] = bothEngines(() => runDemod(make, I, Q, rate));
  const c = compare(js.audio, wasm.audio);
  return {
    name,
    jsMs: js.ms,
    wasmMs: wasm.ms,
    signalSeconds: seconds,
    rel: c.rel,
    ok: c.sameLength && c.rel < 1e-3,
  };
}

function spectrumCase(fftSize: number, frames: number): Row {
  const [I, Q] = makeFmSignal(2_048_000, 0.07);
  const run = () => {
    const sp = new Spectrum(fftSize);
    const out = new Float32Array(sp.size);
    sp.receiveSamples({ I, Q, frequency: 100e6 });
    for (let w = 0; w < 5; ++w) {
      sp.receiveSamples({ I, Q, frequency: 100e6 });
      sp.getSpectrum(out);
    }
    const t0 = performance.now();
    for (let f = 0; f < frames; ++f) {
      sp.receiveSamples({ I: I.subarray(0, fftSize), Q: Q.subarray(0, fftSize), frequency: 100e6 });
      sp.getSpectrum(out);
    }
    return { ms: performance.now() - t0, out: new Float32Array(out) };
  };
  const [js, wasm] = bothEngines(run);
  let maxDb = 0;
  for (let i = 0; i < js.out.length; ++i) {
    if (js.out[i] > -100) maxDb = Math.max(maxDb, Math.abs(js.out[i] - wasm.out[i]));
  }
  return {
    name: `Spectrum FFT ${fftSize} × ${frames} frames`,
    jsMs: js.ms,
    wasmMs: wasm.ms,
    signalSeconds: 0,
    rel: maxDb,
    ok: maxDb < 0.01,
  };
}

/**
 * The MMN monitor's previous HackRF path: a brute-force O(N²) DFT per 1024-sample
 * block over one 256 KiB USB transfer (copied from the old thesis-view.html),
 * versus the Rust averaged-PSD kernel now used by the monitor.
 */
function monitorPsdCase(): Row {
  const FFT_SIZE = 1024;
  const raw = new Uint8Array(262144);
  for (let i = 0; i < raw.length; ++i) raw[i] = (Math.random() * 256) | 0;
  const HANN = Float64Array.from({ length: FFT_SIZE }, (_, n) => 0.5 * (1 - Math.cos((2 * Math.PI * n) / (FFT_SIZE - 1))));
  const oldDft = () => {
    const nBlk = Math.floor(raw.length / 2 / FFT_SIZE);
    const acc = new Float64Array(FFT_SIZE);
    for (let b = 0; b < nBlk; b++) {
      const off = b * FFT_SIZE;
      for (let k = 0; k < FFT_SIZE; k++) {
        let re = 0, im = 0;
        const w2 = (2 * Math.PI * k) / FFT_SIZE;
        for (let n = 0; n < FFT_SIZE; n++) {
          const idx = (off + n) * 2;
          const I = (raw[idx] - 128) / 128;
          const Q = (raw[idx + 1] - 128) / 128;
          const ang = w2 * n, wn = HANN[n];
          re += wn * (I * Math.cos(ang) + Q * Math.sin(ang));
          im += wn * (-I * Math.sin(ang) + Q * Math.cos(ang));
        }
        acc[k] += re * re + im * im;
      }
    }
    return acc;
  };
  const t0 = performance.now();
  oldDft();
  const jsMs = performance.now() - t0;

  const ex = dsp()!;
  const h = ex.fft_new(FFT_SIZE);
  f32View(ex, ex.fft_window_ptr(h), FFT_SIZE).set(Float32Array.from(HANN));
  const pRaw = ex.wrx_alloc(raw.length);
  const pOut = ex.wrx_alloc(FFT_SIZE * 4);
  const runs = 200;
  for (let w = 0; w < 10; ++w) {
    u8View(ex, pRaw, raw.length).set(raw);
    ex.fft_psd_iq8(h, pRaw, raw.length, 1, pOut, FFT_SIZE, 0);
  }
  const t1 = performance.now();
  for (let r = 0; r < runs; ++r) {
    u8View(ex, pRaw, raw.length).set(raw);
    ex.fft_psd_iq8(h, pRaw, raw.length, 1, pOut, FFT_SIZE, 0);
  }
  const wasmMs = (performance.now() - t1) / runs;
  ex.wrx_free(pRaw, raw.length);
  ex.wrx_free(pOut, FFT_SIZE * 4);
  ex.fft_free(h);
  return {
    name: "Monitor PSD, 1 HackRF transfer (old DFT)",
    jsMs,
    wasmMs,
    // One transfer is 131072 samples: 13.1 ms of signal at 10 Msps.
    signalSeconds: 131072 / 10_000_000,
    ok: true,
  };
}

function main() {
  const wasmPath = process.argv[2] || path.join(__dirname, "../apps/radioreceiver/webrx_dsp.wasm");
  if (!loadDspSync(fs.readFileSync(wasmPath))) {
    console.error("Could not load", wasmPath, dspStatus());
    process.exit(1);
  }
  console.log(`WASM DSP loaded (SIMD: ${dspStatus().simd ? "yes" : "no"}) from ${wasmPath}\n`);

  const rows: Row[] = [
    demodCase("WBFM stereo @ 1.024 Msps (app default)", 1_024_000, 2, () =>
      new DemodWBFM(1_024_000, 48_000, { scheme: "WBFM", stereo: true })
    ),
    demodCase("WBFM stereo @ 2.4 Msps (RTL-SDR max)", 2_400_000, 1, () =>
      new DemodWBFM(2_400_000, 48_000, { scheme: "WBFM", stereo: true })
    ),
    demodCase("WBFM stereo @ 10 Msps (HackRF)", 10_000_000, 0.5, () =>
      new DemodWBFM(10_000_000, 48_000, { scheme: "WBFM", stereo: true })
    ),
    demodCase("NBFM @ 1.024 Msps", 1_024_000, 2, () =>
      new DemodNBFM(1_024_000, 48_000, { scheme: "NBFM", maxF: 5000, squelch: 0 })
    ),
    demodCase("AM @ 1.024 Msps", 1_024_000, 2, () =>
      new DemodAM(1_024_000, 48_000, { scheme: "AM", bandwidth: 10000, squelch: 0 })
    ),
    spectrumCase(2048, 2000),
    spectrumCase(16384, 300),
    spectrumCase(131072, 30),
    monitorPsdCase(),
  ];

  const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
  console.log(
    pad("Case", 44) + pad("JS ms", 10) + pad("WASM ms", 10) + pad("Speed-up", 10) + pad("JS %RT", 9) + pad("WASM %RT", 10) + "Match"
  );
  for (const r of rows) {
    const rt = (ms: number) => (r.signalSeconds ? ((ms / 1000 / r.signalSeconds) * 100).toFixed(1) + "%" : "—");
    console.log(
      pad(r.name, 44) +
        pad(r.jsMs.toFixed(1), 10) +
        pad(r.wasmMs.toFixed(1), 10) +
        pad((r.jsMs / r.wasmMs).toFixed(2) + "×", 10) +
        pad(rt(r.jsMs), 9) +
        pad(rt(r.wasmMs), 10) +
        (r.ok ? "✓" : "✗") +
        (r.rel !== undefined ? ` (${r.rel.toExponential(1)})` : "")
    );
  }
  console.log("\n%RT = CPU time as a share of real time (lower is better; >100% cannot keep up).");
  if (rows.some((r) => !r.ok)) {
    console.error("\nOutput mismatch between JS and WASM.");
    process.exit(2);
  }
}

main();
