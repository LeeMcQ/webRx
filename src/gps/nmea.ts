// NMEA 0183 parsing for USB GPS receivers such as the G-MOUSE (u-blox based).
// Handles any talker ID (GP, GN, GL, GA, GB, BD), validates checksums and
// merges GGA / RMC / GSA / GSV / VTG into one running fix.

export type NmeaFix = {
  lat?: number;
  lon?: number;
  /** Metres above mean sea level. */
  alt?: number;
  speedKmh?: number;
  headingDeg?: number;
  /** Satellites used in the fix (GGA). */
  satellites?: number;
  /** Satellites in view across all constellations (GSV). */
  satellitesInView?: number;
  hdop?: number;
  pdop?: number;
  vdop?: number;
  /** 0 = no fix, 1 = GPS, 2 = DGPS, 4 = RTK fixed, 5 = RTK float, 6 = estimated. */
  fixQuality?: number;
  /** "2D" or "3D" from GSA. */
  fixMode?: string;
  /** hh:mm:ss UTC from the receiver. */
  utcTime?: string;
  /** dd/mm/yy from RMC. */
  utcDate?: string;
  /** Last valid sentence. */
  lastSentence?: string;
};

export const FIX_QUALITY_LABELS: Record<number, string> = {
  0: "No fix",
  1: "GPS",
  2: "DGPS",
  3: "PPS",
  4: "RTK fixed",
  5: "RTK float",
  6: "Estimated",
  7: "Manual",
  8: "Simulation",
};

/** Returns true if the sentence has no checksum or a correct one. */
export function nmeaChecksumOk(sentence: string): boolean {
  const star = sentence.lastIndexOf("*");
  if (star < 0) return true;
  let cs = 0;
  for (let i = 1; i < star; ++i) cs ^= sentence.charCodeAt(i);
  const want = parseInt(sentence.slice(star + 1, star + 3), 16);
  return !Number.isNaN(want) && want === cs;
}

/** ddmm.mmmm + hemisphere → signed decimal degrees. */
export function nmeaDegrees(raw: string, hemisphere: string): number | undefined {
  if (!raw) return undefined;
  const dot = raw.indexOf(".");
  const degLen = (dot < 0 ? raw.length : dot) - 2;
  if (degLen < 1) return undefined;
  const deg = parseInt(raw.slice(0, degLen), 10);
  const min = parseFloat(raw.slice(degLen));
  if (Number.isNaN(deg) || Number.isNaN(min)) return undefined;
  const v = deg + min / 60;
  return hemisphere === "S" || hemisphere === "W" ? -v : v;
}

function num(s: string | undefined): number | undefined {
  if (s === undefined || s === "") return undefined;
  const v = parseFloat(s);
  return Number.isNaN(v) ? undefined : v;
}

function utc(raw: string): string | undefined {
  return raw && raw.length >= 6
    ? `${raw.slice(0, 2)}:${raw.slice(2, 4)}:${raw.slice(4, 6)}`
    : undefined;
}

/** Satellites in view per talker (GP, GL, GA, BD…), summed for multi-GNSS receivers. */
const gsvByTalker = new Map<string, number>();

/**
 * Applies one NMEA sentence to `fix` (mutated in place).
 * Returns the sentence type (e.g. "GGA") if it was understood, or undefined.
 */
export function applyNmea(fix: NmeaFix, line: string): string | undefined {
  const s = line.trim();
  if (!s.startsWith("$") || !nmeaChecksumOk(s)) return undefined;
  const body = s.slice(1, s.lastIndexOf("*") >= 0 ? s.lastIndexOf("*") : undefined);
  const f = body.split(",");
  const type = f[0].length >= 5 ? f[0].slice(-3) : f[0];
  switch (type) {
    case "GGA": {
      const q = parseInt(f[6] || "0", 10);
      fix.fixQuality = Number.isNaN(q) ? 0 : q;
      fix.utcTime = utc(f[1]) ?? fix.utcTime;
      fix.satellites = num(f[7]);
      fix.hdop = num(f[8]) ?? fix.hdop;
      if (fix.fixQuality > 0) {
        fix.lat = nmeaDegrees(f[2], f[3]) ?? fix.lat;
        fix.lon = nmeaDegrees(f[4], f[5]) ?? fix.lon;
        fix.alt = num(f[9]) ?? fix.alt;
      }
      break;
    }
    case "RMC": {
      fix.utcTime = utc(f[1]) ?? fix.utcTime;
      if (f[9] && f[9].length === 6) fix.utcDate = `${f[9].slice(0, 2)}/${f[9].slice(2, 4)}/${f[9].slice(4, 6)}`;
      if (f[2] === "A") {
        fix.lat = nmeaDegrees(f[3], f[4]) ?? fix.lat;
        fix.lon = nmeaDegrees(f[5], f[6]) ?? fix.lon;
        const knots = num(f[7]);
        if (knots !== undefined) fix.speedKmh = knots * 1.852;
        fix.headingDeg = num(f[8]) ?? fix.headingDeg;
        if (!fix.fixQuality) fix.fixQuality = 1;
      }
      break;
    }
    case "VTG": {
      const kmh = num(f[7]);
      if (kmh !== undefined) fix.speedKmh = kmh;
      fix.headingDeg = num(f[1]) ?? fix.headingDeg;
      break;
    }
    case "GSA": {
      const mode = parseInt(f[2] || "1", 10);
      fix.fixMode = mode === 3 ? "3D" : mode === 2 ? "2D" : "No fix";
      fix.pdop = num(f[15]) ?? fix.pdop;
      fix.hdop = num(f[16]) ?? fix.hdop;
      fix.vdop = num(f[17]) ?? fix.vdop;
      break;
    }
    case "GSV": {
      const inView = num(f[3]);
      if (inView !== undefined) {
        const talker = f[0].slice(0, 2);
        gsvByTalker.set(talker, inView);
        let total = 0;
        for (const v of gsvByTalker.values()) total += v;
        fix.satellitesInView = total;
      }
      break;
    }
    default:
      return undefined;
  }
  fix.lastSentence = s;
  return type;
}


/** Splits a serial text stream into lines, keeping the partial tail between chunks. */
export class LineSplitter {
  private buf = "";
  push(text: string): string[] {
    this.buf += text;
    const lines = this.buf.split(/\r?\n/);
    this.buf = lines.pop() ?? "";
    if (this.buf.length > 4096) this.buf = ""; // garbage (wrong baud rate)
    return lines;
  }
}
