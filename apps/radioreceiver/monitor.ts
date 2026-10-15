import "../../src/ui/install.js";
import { initMonitor } from "../../src/apps/monitor/monitor.js";
import { bootWithDsp, registerServiceWorker } from "../../src/dsp/boot.js";
import { MORE_TABS, TABS, migrateStorage, paneIdFor, resolveTab } from "../../src/apps/monitor/layout.js";

declare const __WEBRX_BUILD__: string;
// The page checks this against its own <meta name="webrx-build"> (stale-cache guard).
(window as any).webrxBuild = __WEBRX_BUILD__;

// Storage migration runs before anything reads settings (PROPOSAL Appendix A).
let migrationNotes: string[] = [];
try {
  migrationNotes = migrateStorage(localStorage);
} catch (_) {}
// The page's inline shell script uses the same routing table.
(window as any).webrxLayout = { TABS, MORE_TABS, resolveTab, paneIdFor, migrationNotes };

registerServiceWorker();
bootWithDsp(initMonitor);
