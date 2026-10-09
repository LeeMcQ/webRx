import "../../src/ui/install.js";
import { initMonitor } from "../../src/apps/monitor/monitor.js";
import { bootWithDsp, registerServiceWorker } from "../../src/dsp/boot.js";

registerServiceWorker();
bootWithDsp(initMonitor);
