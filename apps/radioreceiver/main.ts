import "../../src/ui/install.js";
import "../../src/apps/radioreceiver/main.js";
import { bootWithDsp, registerServiceWorker } from "../../src/dsp/boot.js";

registerServiceWorker();

// The radio's DSP objects are created when the element is constructed, so the
// WASM core is loaded first; if it can't load, the JavaScript DSP is used.
bootWithDsp(() => {
  document.getElementById("boot")?.remove();
  document.body.appendChild(document.createElement("radioreceiver-main"));
});
