import * as fs from "fs/promises";
import * as path from "path";
import * as esbuild from "esbuild";
import { glob } from "glob";
import esbuildPluginTsc from "esbuild-plugin-tsc";
import { program } from "commander";
import buildCommands from "./build_settings.mjs";
import { wasmDspPlugin } from "./build_dsp_plugin.mjs";
import { execSync } from "child_process";

program.option("--clean", "Clean output directory");
program.option("--dist", "Enable distribution mode");
program.option("--no-source-maps", "Disable source maps");
program.option("--no-minify", "Disable minification");
program.parse();

const CLEAN_MODE = program.opts().clean;
const DIST_MODE = program.opts().dist;
const SOURCE_MAPS = program.opts().sourceMaps && !DIST_MODE;
const MINIFY = program.opts().minify;

// One id per build, written into the JS bundles and the pages, so a page can
// tell when the browser handed it a script cached from an older build.
const BUILD_ID = (() => {
  let sha = "local";
  try {
    sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch (_) {}
  return `${sha}-${Date.now().toString(36)}`;
})();

function asArray(src) {
  if (Array.isArray(src)) return src;
  return [src];
}

async function compile(src) {
  console.log(`Build ${src}`);
  // Keep assets (fonts, Leaflet's control icons) inside the app's own folder so
  // the folder can be deployed on its own (gh-pages).
  let assetPrefix = path.dirname(src).split(path.sep).join("/");
  return esbuild.build({
    entryPoints: [src],
    outdir: "dist",
    outbase: ".",
    assetNames: `${assetPrefix}/assets/[name]-[hash]`,
    bundle: true,
    minify: MINIFY,
    treeShaking: true,
    sourcemap: SOURCE_MAPS,
    define: { __WEBRX_BUILD__: JSON.stringify(BUILD_ID) },
    loader: {
      ".html": "copy",
      ".json": "copy",
      ".png": "copy",
      ".wasm": "copy",
      ".ttf": "file",
      ".woff": "file",
      ".woff2": "file",
    },
    // The WASM shim plugin must run first so it can redirect the DSP modules.
    plugins: [wasmDspPlugin(), esbuildPluginTsc({ force: true })],
  });
}

async function copyDir(src, dest) {
  console.log(`Copy ${src} to ${dest}`);
  return fs.cp(src, dest, { recursive: true });
}

async function copy(src, base, dest) {
  let srcFiles = await glob(src, { nodir: true });
  if (srcFiles.length == 0) {
    console.log(`Warning: no files matched for ${src.join(", ")}`);
    return;
  }
  for (let src of srcFiles) {
    let relative = path.relative(base, src);
    let target = path.resolve(dest, relative);
    console.log(`Copying ${src} to ${target}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(src, target);
  }
}

async function run(cmd) {
  if (Array.isArray(cmd)) {
    for (let c of cmd) {
      await run(c);
    }
  } else if (cmd.compile !== undefined) {
    let src = asArray(cmd.compile);
    let allNames = await Promise.allSettled(
      src.map((p) => glob(p, { nodir: true }))
    );
    let allBuilds = allNames
      .filter((p) => p.status == "fulfilled")
      .flatMap((p) => p.value)
      .map(compile);
    await Promise.allSettled(allBuilds);
  } else if (cmd.copyDir !== undefined) {
    let srcs = asArray(cmd.copyDir);
    let dests = asArray(cmd.to);
    await Promise.allSettled(
      srcs.flatMap((src) => dests.map((dest) => copyDir(src, dest)))
    );
  } else if (cmd.copy !== undefined) {
    let srcs = asArray(cmd.copy);
    let base = cmd.base;
    let dests = asArray(cmd.to);
    await Promise.allSettled(dests.map((dest) => copy(srcs, base, dest)));
  } else {
    throw `Unknown command: ${JSON.stringify(cmd)}`;
  }
}

async function main() {
  let actions = {
    clean: DIST_MODE || CLEAN_MODE,
    build: !CLEAN_MODE,
  };

  if (actions.clean) {
    await fs.rm("dist", {
      force: true,
      recursive: true,
    });
  }

  if (actions.build) {
    // Keep the CSP hash of the monitor's inline script in step with its source.
    execSync("node scripts/csp-hash.mjs", { stdio: "inherit" });
    await run(buildCommands);
    await stampBuild();
  }
}

/** Writes the build id into every built page's <meta name="webrx-build">. */
async function stampBuild() {
  const pages = await glob("dist/**/*.html", { nodir: true });
  for (const p of pages) {
    const html = await fs.readFile(p, "utf8");
    const next = html.replace(/<meta name="webrx-build" content="[^"]*"\s*\/?>/, `<meta name="webrx-build" content="${BUILD_ID}" />`);
    if (next !== html) await fs.writeFile(p, next);
  }
  console.log(`Build id ${BUILD_ID}`);
}

main();
