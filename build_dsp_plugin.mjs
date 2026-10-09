// esbuild plugin: swaps the hottest @jtarrio/signals DSP modules for the
// Rust/WASM-backed shims in src/dsp/shims/. Every import of those modules —
// from the app, from @jtarrio/webrtlsdr and from inside @jtarrio/signals —
// resolves to the shim; the shims themselves still reach the originals so
// they can fall back to JavaScript when WASM is unavailable.

import * as path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHIM_DIR = path.join(HERE, "src", "dsp", "shims");
const SHIMMED = /[\\/]@jtarrio[\\/]signals[\\/]dist[\\/]dsp[\\/](filters|fft|resamplers)\.js$/;

export function wasmDspPlugin() {
  return {
    name: "wasm-dsp-shims",
    setup(build) {
      build.onResolve(
        { filter: /(^|[\\/])(filters|fft|resamplers)\.js$/ },
        async (args) => {
          if (args.pluginData && args.pluginData.wasmDspSkip) return undefined;
          if (args.importer && args.importer.startsWith(SHIM_DIR)) return undefined;
          const res = await build.resolve(args.path, {
            kind: args.kind,
            resolveDir: args.resolveDir,
            importer: args.importer,
            pluginData: { wasmDspSkip: true },
          });
          if (res.errors.length > 0) return undefined;
          const m = res.path.match(SHIMMED);
          if (!m) return undefined;
          return { path: path.join(SHIM_DIR, `${m[1]}.ts`) };
        }
      );
    },
  };
}
