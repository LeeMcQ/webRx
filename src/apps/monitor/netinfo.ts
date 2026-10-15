// Network Information API helpers for the WF/MT "network" readout.
//
// A browser cannot measure RF power: the score below is link quality from the
// round-trip time (most weight) and downlink estimate — NOT a radio signal
// level. Chrome rounds RTT to 25 ms and caps downlink at 10 Mbps; `type` is
// often missing on desktop. A real level (Wi-Fi RSSI, LTE/NR RSRP) only comes
// from the Radio Bridge companion app.

export function getConnection(): any {
  const n = navigator as any;
  return n.connection || n.mozConnection || n.webkitConnection || null;
}

/** 0–100 link-quality score and its label. */
export function linkQuality(rtt: number | null, downlinkMbps: number, effectiveType: string): { q: number; label: string } {
  let q: number;
  if (rtt !== null) {
    const rttScore = Math.max(0, Math.min(100, 100 - ((rtt - 25) / 475) * 100)); // 25 ms → 100, 500 ms → 0
    const dlScore = Number.isNaN(downlinkMbps) ? rttScore : Math.max(0, Math.min(100, ((Math.log10(Math.max(downlinkMbps, 0.05)) + 1.3) / 2.3) * 100)); // 0.05 → 0, 10 Mbps → 100
    q = Math.round(0.7 * rttScore + 0.3 * dlScore);
  } else {
    const ectScore: Record<string, number> = { "4g": 75, "3g": 50, "2g": 25, "slow-2g": 10 };
    q = ectScore[effectiveType] ?? 50;
  }
  q = Math.max(0, Math.min(100, q));
  const label = q >= 80 ? "Excellent" : q >= 60 ? "Good" : q >= 40 ? "Fair" : q >= 20 ? "Poor" : "Very poor";
  return { q, label };
}

/** Hook for the Radio Bridge app: `window.webrxRadioBridge = { dbm, kind: "RSSI" | "RSRP", at: Date.now() }`. */
export function radioBridgeSignal(): { dbm: number; kind: string } | null {
  const v = (globalThis as any).webrxRadioBridge;
  if (!v || typeof v.dbm !== "number" || !Number.isFinite(v.dbm)) return null;
  if (typeof v.at === "number" && Date.now() - v.at > 10000) return null; // stale
  return { dbm: Math.round(v.dbm), kind: String(v.kind || "RSSI") };
}
