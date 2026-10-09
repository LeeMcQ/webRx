// Licensed (predicted) coverage vs measured coverage — thesis §4.3.5, Fig 4.10.
//
// The licence gives the transmitter site and a predicted coverage area; the
// drive gives pins above the noise-floor threshold. Per compass direction the
// furthest pin still above the threshold is the measured reach; comparing the
// areas those reaches enclose with the licensed circle, over the directions
// actually driven, gives "x % more (or less) coverage than licensed".

import { haversineM } from "../../sampling/spatial.js";

export type Site = { lat: number; lon: number };

/**
 * Reads a site position as written in a licence or by hand:
 *   "18E42 02 / 33S27 55" (ICASA style, degrees+hemisphere minutes seconds),
 *   "33°27'55\"S 18°42'02\"E", "-33.4653, 18.7006", "33.4653 S 18.7006 E".
 */
export function parseSite(text: string): Site | null {
  const s = text.trim().replace(/[′’]/g, "'").replace(/[″”]/g, '"');
  if (!s) return null;
  let lat: number | undefined;
  let lon: number | undefined;
  const put = (v: number, h: string) => {
    const H = h.toUpperCase();
    if (H === "N" || H === "S") lat = H === "S" ? -v : v;
    else lon = H === "W" ? -v : v;
  };
  // ICASA: 18E42 02 → 18° E 42' 02"
  const icasa = [...s.matchAll(/(\d{1,3})\s*([NSEW])\s*(\d{1,2})(?:[\s:]+(\d{1,2}(?:\.\d+)?))?/gi)];
  if (icasa.length >= 2) {
    for (const m of icasa) put(+m[1] + +m[3] / 60 + (m[4] ? +m[4] / 3600 : 0), m[2]);
  } else {
    // 33°27'55"S or 33 27 55 S or 33.4653 S
    const dms = [...s.matchAll(/(\d{1,3}(?:\.\d+)?)\s*°?\s*(?:(\d{1,2}(?:\.\d+)?)\s*'?\s*(?:(\d{1,2}(?:\.\d+)?)\s*"?)?)?\s*([NSEW])/gi)];
    if (dms.length >= 2) {
      for (const m of dms) put(+m[1] + (m[2] ? +m[2] / 60 : 0) + (m[3] ? +m[3] / 3600 : 0), m[4]);
    } else {
      const nums = s.match(/[+-−]?\d+(?:\.\d+)?/g)?.map((x) => Number(x.replace("−", "-")));
      if (nums && nums.length >= 2) {
        let [a, b] = nums;
        // Decimal pair: latitude first unless it can't be one.
        if (Math.abs(a) > 90 && Math.abs(b) <= 90) [a, b] = [b, a];
        lat = a;
        lon = b;
      }
    }
  }
  if (lat === undefined || lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function bearingDeg(a: Site, b: Site): number {
  const r = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return ((Math.atan2(y, x) / r) % 360 + 360) % 360;
}

export type CoverageComparison = {
  sectors: number;
  /** Furthest above-threshold pin per sector (m); NaN where nothing was driven. */
  reachM: number[];
  /** Sectors with any pin at all (driven), above threshold or not. */
  driven: boolean[];
  furthestM: number;
  furthestBearing: number;
  aboveCount: number;
  beyondCount: number;
  /** Σ reach² / (driven sectors × R²) − 1, over driven sectors; NaN without a radius. */
  areaDelta: number;
  /** furthest reach / R − 1. */
  reachDelta: number;
};

export function compareCoverage(
  site: Site,
  radiusM: number,
  pins: { lat: number; lon: number; above: boolean }[],
  sectors = 16
): CoverageComparison {
  const reach = new Array(sectors).fill(NaN);
  const driven = new Array(sectors).fill(false);
  let furthest = 0;
  let furthestBearing = NaN;
  let above = 0;
  let beyond = 0;
  for (const p of pins) {
    const d = haversineM(site.lat, site.lon, p.lat, p.lon);
    const b = bearingDeg(site, p);
    const s = Math.floor(((b + 180 / sectors) % 360) / (360 / sectors));
    driven[s] = true;
    if (!p.above) continue;
    above++;
    if (radiusM > 0 && d > radiusM) beyond++;
    if (!(reach[s] >= d)) reach[s] = d;
    if (d > furthest) {
      furthest = d;
      furthestBearing = b;
    }
  }
  let num = 0;
  let k = 0;
  for (let s = 0; s < sectors; s++) {
    if (!driven[s]) continue;
    k++;
    num += Number.isFinite(reach[s]) ? reach[s] ** 2 : 0;
  }
  return {
    sectors,
    reachM: reach,
    driven,
    furthestM: furthest,
    furthestBearing,
    aboveCount: above,
    beyondCount: beyond,
    areaDelta: radiusM > 0 && k ? num / (k * radiusM * radiusM) - 1 : NaN,
    reachDelta: radiusM > 0 && furthest ? furthest / radiusM - 1 : NaN,
  };
}

export function compassName(deg: number): string {
  const names = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return names[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}
