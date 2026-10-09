// Start-up helpers shared by the app entry points.

import { loadDsp } from "./wasm.js";

/** The receiver's "Use Rust/WASM DSP" setting (on unless explicitly turned off). */
export function wasmDspEnabled(): boolean {
  try {
    const cfg = JSON.parse(localStorage.getItem("config") || "{}");
    return cfg?.v1?.wasmDsp !== false;
  } catch (_) {
    return true;
  }
}

/** Loads the WASM DSP core (if enabled), then runs `fn` once the DOM is ready. */
export function bootWithDsp(fn: () => void) {
  const loaded = wasmDspEnabled()
    ? loadDsp(new URL("webrx_dsp.wasm", location.href))
    : Promise.resolve(false);
  loaded.finally(() => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  });
}

/** Registers the offline service worker. */
export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("offline.js").catch((e) => {
      console.warn("Service worker registration failed:", e);
    });
  }
}
