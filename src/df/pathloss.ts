// Rough distance hints from received power. Free-space (Friis) is an upper
// bound on range; a log-distance model with exponent n (2 = open, 2.7–3.5 =
// suburban, 4+ = urban/indoor) gives a more realistic guess.

/** FSPL (dB) = 20log10(d_m) + 20log10(f_Hz) - 147.55 */
export const fspl = (dM: number, fHz: number) => 20 * Math.log10(dM) + 20 * Math.log10(fHz) - 147.55;

/** Distance (m) for a path loss L dB under the log-distance model with 1 m free-space reference. */
export function distanceForLoss(lossDb: number, fHz: number, n = 2): number {
  const l1 = fspl(1, fHz);
  return Math.pow(10, (lossDb - l1) / (10 * n));
}

/** Distance hint given an assumed EIRP (dBm), measured dBm and antenna gain (dBi). */
export function distanceHint(rxDbm: number, fHz: number, eirpDbm: number, rxGainDbi = 0, n = 2): number {
  return distanceForLoss(eirpDbm + rxGainDbi - rxDbm, fHz, n);
}
