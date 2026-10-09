// Shared scratch memory for the WASM shims.
//
// All DSP runs synchronously on one thread and no shim call re-enters another,
// so a single input/output scratch pair is safe and keeps memory use flat no
// matter how many filters the demodulators create.

import { DspExports, Scratch } from "../wasm.js";

let owner: DspExports | null = null;
let input: Scratch | null = null;
let output: Scratch | null = null;

function ensure(ex: DspExports) {
  if (owner !== ex) {
    owner = ex;
    input = new Scratch(ex);
    output = new Scratch(ex);
  }
}

/** Scratch region for data going into a WASM call. */
export function scratchIn(ex: DspExports, bytes: number): number {
  ensure(ex);
  return input!.get(bytes);
}

/** Scratch region for data coming out of a WASM call (never overlaps scratchIn). */
export function scratchOut(ex: DspExports, bytes: number): number {
  ensure(ex);
  return output!.get(bytes);
}
