import "../../src/ui/install.js";
import { initMap } from "../../src/apps/map/map.js";
import { registerServiceWorker } from "../../src/dsp/boot.js";

registerServiceWorker();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initMap(), { once: true });
} else {
  initMap();
}
