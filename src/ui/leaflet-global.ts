// Exposes Leaflet as window.L before plugins written for the global build
// (leaflet.heat) are evaluated. Import this module before such plugins.
import L from "leaflet";

(globalThis as any).L = L;

export default L;
