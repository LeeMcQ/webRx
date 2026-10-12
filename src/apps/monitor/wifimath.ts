// Wi-Fi channel / frequency / width maths for the RF Tech Wi-Fi analyser.
export type WifiBand = "2.4" | "5" | "6";
export type Width = 20 | 40 | 80 | 160 | 320;

/** Band from primary frequency (MHz). */
export function bandOf(fMHz: number): WifiBand {
  return fMHz < 3000 ? "2.4" : fMHz >= 5925 ? "6" : "5";
}

/** Channel number for a 20 MHz centre frequency. */
export function freqToChannel(fMHz: number): number {
  if (fMHz === 2484) return 14;
  if (fMHz >= 2412 && fMHz < 2484) return (fMHz - 2407) / 5;
  if (fMHz >= 5955) return (fMHz - 5950) / 5;
  if (fMHz >= 4900 && fMHz < 5925) return (fMHz - 5000) / 5;
  return NaN;
}

export function channelToFreq(ch: number, band: WifiBand): number {
  if (band === "2.4") return ch === 14 ? 2484 : 2407 + 5 * ch;
  return (band === "6" ? 5950 : 5000) + 5 * ch;
}

/** Valid channel span centres for 5 GHz bonded widths. */
const C5: Record<number, number[]> = {
  40: [38, 46, 54, 62, 102, 110, 118, 126, 134, 142, 151, 159],
  80: [42, 58, 106, 122, 138, 155],
  160: [50, 114],
};

/**
 * Centre frequency of the occupied span. Prefers an explicit centre (Android
 * ScanResult.centerFreq0); otherwise derives it from the channel plan.
 * 2.4 GHz 40 MHz: secondary assumed above for ch 1–7 (HT40+), below for ch 8–13.
 */
export function centreFreq(primaryMHz: number, width: Width, centerFreq0?: number): number {
  if (centerFreq0 && centerFreq0 > 0) return centerFreq0;
  if (width === 20) return primaryMHz;
  const band = bandOf(primaryMHz);
  const ch = freqToChannel(primaryMHz);
  if (band === "2.4") return ch <= 7 ? primaryMHz + 10 : primaryMHz - 10;
  if (band === "6") {
    const n = width / 20; // channels 1,5,9.. block size n*4 channels
    const block = Math.floor((ch - 1) / (4 * n));
    return channelToFreq(1 + block * 4 * n + (4 * n - 4) / 2, "6");
  }
  const list = C5[width] ?? [];
  const half = width / 10; // channel units half-width
  const c = list.find((x) => ch >= x - half / 2 * 1 && ch <= x + half / 2 * 1) ?? list.find((x) => Math.abs(x - ch) < width / 10);
  return c !== undefined ? channelToFreq(c, "5") : primaryMHz;
}

export function centreChannel(primaryMHz: number, width: Width, centerFreq0?: number): number {
  const c = centreFreq(primaryMHz, width, centerFreq0);
  return bandOf(primaryMHz) === "2.4" ? (c - 2407) / 5 : freqToChannel(c);
}

/** Occupied span [lo, hi] MHz. */
export function span(primaryMHz: number, width: Width, centerFreq0?: number): [number, number] {
  const c = centreFreq(primaryMHz, width, centerFreq0);
  return [c - width / 2, c + width / 2];
}

/** "1(3)" style label: primary(centre) when bonded. */
export function channelLabel(primaryMHz: number, width: Width, centerFreq0?: number): string {
  const p = freqToChannel(primaryMHz), c = centreChannel(primaryMHz, width, centerFreq0);
  return width === 20 || c === p ? String(p) : `${p}(${c})`;
}

/** Rough free-space distance (m) from RSSI. Ignores walls, antennas and Tx power. */
export function fsplDistanceM(rssiDbm: number, fMHz: number): number {
  return Math.pow(10, (27.55 - 20 * Math.log10(fMHz) + Math.abs(rssiDbm)) / 20);
}

export interface Ap { ssid: string; bssid: string; rssi: number; freq: number; width: Width; centerFreq0?: number }

/** Channel rating: for each candidate 20 MHz channel, sum of overlapping AP power (linear) and count. */
export function rateChannels(aps: Ap[], band: WifiBand): { ch: number; count: number; score: number }[] {
  const chans = band === "2.4" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    : band === "5" ? [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149, 153, 157, 161, 165]
    : Array.from({ length: 24 }, (_, i) => 1 + 4 * i);
  return chans.map((ch) => {
    const f = channelToFreq(ch, band), lo = f - 10, hi = f + 10;
    let count = 0, mw = 0;
    for (const a of aps) {
      if (bandOf(a.freq) !== band) continue;
      const [l, h] = span(a.freq, a.width, a.centerFreq0);
      if (h > lo && l < hi) { count++; mw += Math.pow(10, a.rssi / 10); }
    }
    // score 0..10: 10 = clear. -90 dBm aggregate ~ 9, -50 dBm ~ 1.
    const agg = mw > 0 ? 10 * Math.log10(mw) : -120;
    const score = Math.max(0, Math.min(10, Math.round(((-40 - agg) / 50) * 10)));
    return { ch, count, score };
  });
}

/** Best channels: 2.4 GHz restricted to non-overlapping 1/6/11. */
export function bestChannels(aps: Ap[], band: WifiBand, n = 3): number[] {
  let r = rateChannels(aps, band);
  if (band === "2.4") r = r.filter((x) => [1, 6, 11].includes(x.ch));
  return r.sort((a, b) => b.score - a.score || a.count - b.count || a.ch - b.ch).slice(0, n).map((x) => x.ch);
}
