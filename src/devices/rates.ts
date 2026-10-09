// Sample rates offered for each SDR family.

import type { SdrKind } from "./provider.js";

/** RTL-SDR: 256 ksps plus the stable 0.96–2.88 Msps range. */
export const RTL_SAMPLE_RATES: number[] = (() => {
  const rateSet: Set<number> = new Set([256000]);
  for (let r = 1024000; r < 3000000; r += 256000) rateSet.add(r);
  for (let r = 960000; r < 3000000; r += 192000) rateSet.add(r);
  return [...rateSet].sort((a, b) => a - b);
})();

/** HackRF One / Pro: 2–20 Msps (lower rates are not supported by its ADC clocking). */
export const HACKRF_SAMPLE_RATES: number[] = [
  2000000, 2400000, 3200000, 4000000, 5000000, 8000000, 10000000, 12500000, 16000000,
  20000000,
];

export function sampleRatesFor(kind: SdrKind | "rtlsdr" | "hackrf"): number[] {
  return kind === "hackrf" ? HACKRF_SAMPLE_RATES : RTL_SAMPLE_RATES;
}

export function formatRate(r: number): string {
  return r >= 1e6
    ? `${(r / 1e6).toLocaleString(undefined, { maximumFractionDigits: 3 })} Msps`
    : `${(r / 1e3).toLocaleString()} ksps`;
}
