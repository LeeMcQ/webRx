// Bundles a TypeScript file from bench/ with the same WASM shim plugin the app
// uses, then runs it in Node.
//
//   node bench/run.mjs dsp_benchmark     # JS vs Rust/WASM speed + output match
//   node bench/run.mjs devices.test      # HackRF / provider / NMEA / GPS tests

import * as esbuild from "esbuild";
import { execFileSync } from "child_process";
import { wasmDspPlugin } from "../build_dsp_plugin.mjs";

const name = process.argv[2] || "dsp_benchmark";
const out = `dist/bench/${name}.cjs`;
await esbuild.build({
  entryPoints: [`bench/${name}.ts`],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  plugins: [wasmDspPlugin()],
  logLevel: "warning",
});
try {
  execFileSync(process.execPath, [out, "apps/radioreceiver/webrx_dsp.wasm"], { stdio: "inherit" });
} catch (e) {
  process.exit(e.status ?? 1);
}
