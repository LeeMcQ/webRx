// Reads MMN measurement CSVs from any of the recorders used so far:
// • webRx monitor exports (named columns, ISO timestamps, units column)
// • older files with power/level columns, or no header at all
// • European spreadsheet exports (semicolon delimiter, decimal comma)
// • the thesis MATLAB Frequency Mapping tool (no header: longitude, latitude,
//   peak, band mean, spectrum mean, MATLAB datenum time — Appendix A-2)
// It finds the latitude/longitude and measurement columns, repairs the usual
// coordinate mistakes (swapped columns, missing minus sign on South African
// latitudes) and reports what it did so nothing happens silently.

export type Measure = { key: string; label: string };

export type MapPoint = {
  lat: number;
  lon: number;
  /** Epoch ms, when the file has times. */
  t?: number;
  values: Record<string, number>;
  freqHz?: number;
  device?: string;
  accuracyM?: number;
  /** Calibrated threshold stored with the pin (thesis §4.3.4). */
  threshold?: number;
  noiseFloor?: number;
  /** Recorded verdict: band mean at or above the threshold. */
  above?: boolean;
  spacingM?: number;
  samples?: number;
  file: number;
  row: number;
};

export type ParsedFile = {
  name: string;
  points: MapPoint[];
  measures: Measure[];
  units: string;
  rows: number;
  skipped: number;
  notes: string[];
};

// ── low-level CSV ──────────────────────────────────────────────

export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8);
  let best = ",";
  let bestScore = -1;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = lines.map((l) => splitRow(l, d).length);
    if (!counts.length || counts[0] < 2) continue;
    const consistent = counts.filter((c) => c === counts[0]).length / counts.length;
    const score = consistent * 100 + counts[0];
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function splitRow(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** RFC 4180 rows (quoted fields may contain the delimiter or newlines). */
export function parseCsv(text: string, d: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

/** Number from a CSV cell: handles decimal commas, unicode minus and unit suffixes. */
export function toNum(raw: string | undefined, decimalComma: boolean): number {
  if (raw === undefined) return NaN;
  let s = raw.trim().replace(/−/g, "-");
  if (!s) return NaN;
  s = s.replace(/\s*(dbm|dbfs|dbµv|dbuv|db|mhz|khz|hz|m|°)$/i, "");
  if (decimalComma && /^[+-]?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// ── column roles ───────────────────────────────────────────────

const norm = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .replace(/\(([^)]*)\)/g, "_$1")
    .replace(/[\s.\-/]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

const RX = {
  lat: /(^|_)(lat|latitude|gps_lat)($|_)/,
  lon: /(^|_)(lon|lng|long|longitude|gps_lon)($|_)/,
  time: /(^|_)(timestamp|time|date|datetime|utc|ts)($|_)/,
  freq: /(^|_)(center_freq|centre_freq|frequency|freq)(_|$)/,
  device: /^(device|source|sdr|receiver|instrument)$/,
  units: /^(units?)$/,
  acc: /(^|_)(gps_accuracy|accuracy|hacc|acc)(_|$)/,
  threshold: /(^|_)threshold(_db)?$/,
  noiseFloor: /(^|_)noise_floor(_db)?$/,
  above: /^above(_threshold)?$/,
  spacing: /^pin_spacing(_m)?$/,
  samples: /^samples_averaged$/,
  measure: /(power|level|rssi|rsrp|rsrq|sinr|snr|dbm|dbfs|dbuv|signal|strength|field|pwr|(^|_)db($|_))/,
  notMeasure: /(freq|calib|accuracy|altitude|(^|_)alt($|_)|sats|compass|course|heading|sample_rate|rate_hz|quality|(^|_)lat|(^|_)lon|time|units?$|threshold|noise_floor|above|spacing|samples|guard|gain|bandwidth|bw_hz)/,
};

export function prettyLabel(header: string): string {
  const n = norm(header);
  const unit = /dbfs/.test(n) ? "dBFS" : /dbm/.test(n) ? "dBm" : /(^|_)db($|_)/.test(n) ? "dB" : "";
  const words = n
    .replace(/(^|_)(dbfs|dbm|db)($|_)/g, "_")
    .split("_")
    .filter(Boolean)
    .join(" ");
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  return unit ? `${label} (${unit})` : label || header;
}

// ── coordinate plausibility ────────────────────────────────────

type Box = { name: string; lat: [number, number]; lon: [number, number] };
/** Places the MMN data has come from, used to settle ambiguous coordinates. */
const REGIONS: Box[] = [
  { name: "Southern Africa", lat: [-35.5, -21], lon: [15, 34] },
  { name: "Central Europe", lat: [45, 56], lon: [4, 25] },
];

function inRegion(lat: number, lon: number): boolean {
  return REGIONS.some((r) => lat >= r.lat[0] && lat <= r.lat[1] && lon >= r.lon[0] && lon <= r.lon[1]);
}

function median(xs: number[]): number {
  const a = xs.filter(Number.isFinite).sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : NaN;
}

/** MATLAB serial date number (days since year 0, laptop local time) → epoch ms. */
export function fromDatenum(v: number): number {
  const d = new Date((v - 719529) * 86_400_000);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()).getTime();
}

const isDatenum = (v: number) => v >= 693_962 && v <= 767_011; // 1900–2100

function parseTime(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (/^\d{6}(\.\d+)?$/.test(s) && isDatenum(Number(s))) return fromDatenum(Number(s));
  if (/^\d{10}(\.\d+)?$/.test(s)) return Number(s) * 1000;
  if (/^\d{13}$/.test(s)) return Number(s);
  const t = Date.parse(s.includes("T") || /\d{4}-\d{2}-\d{2} /.test(s) ? s.replace(" ", "T") : s);
  return Number.isFinite(t) ? t : undefined;
}

type ColStats = { idx: number; numeric: number; min: number; max: number; mean: number; span: number; ints: boolean; monotonic: boolean };

function columnStats(rows: string[][], ncol: number, decimalComma: boolean): ColStats[] {
  const sample = rows.slice(0, 300);
  const out: ColStats[] = [];
  for (let c = 0; c < ncol; c++) {
    const vals = sample.map((r) => toNum(r[c], decimalComma));
    const ok = vals.filter(Number.isFinite);
    if (!ok.length) {
      out.push({ idx: c, numeric: 0, min: NaN, max: NaN, mean: NaN, span: NaN, ints: false, monotonic: false });
      continue;
    }
    const min = Math.min(...ok);
    const max = Math.max(...ok);
    let mono = ok.length > 3;
    for (let i = 1; i < ok.length && mono; i++) if (ok[i] < ok[i - 1]) mono = false;
    out.push({
      idx: c,
      numeric: ok.length / sample.length,
      min,
      max,
      mean: ok.reduce((a, b) => a + b, 0) / ok.length,
      span: max - min,
      ints: ok.every((v) => Number.isInteger(v)),
      monotonic: mono,
    });
  }
  return out;
}

// ── main entry ─────────────────────────────────────────────────

export function parseMeasurementCsv(text: string, name: string, fileIndex = 0): ParsedFile {
  const notes: string[] = [];
  const clean = text.replace(/^﻿/, "");
  const d = detectDelimiter(clean);
  const rows = parseCsv(clean, d);
  const result: ParsedFile = { name, points: [], measures: [], units: "dB", rows: 0, skipped: 0, notes };
  if (rows.length < 1) {
    notes.push("Empty file");
    return result;
  }
  const ncol = Math.max(...rows.slice(0, 20).map((r) => r.length));
  // Decimal commas only make sense when the delimiter isn't a comma.
  const decimalComma = d !== "," && rows.slice(0, 20).some((r) => r.some((c) => /^\s*[+-]?\d+,\d+\s*$/.test(c)));
  if (d !== ",") notes.push(`Delimiter "${d === "\t" ? "tab" : d}"${decimalComma ? ", decimal commas" : ""}`);

  const first = rows[0];
  const nonNumeric = first.filter((c) => c.trim() !== "" && !Number.isFinite(toNum(c, decimalComma))).length;
  const hasHeader = nonNumeric >= Math.max(1, Math.ceil(first.length / 2));
  const header = hasHeader ? first.map((h) => h.trim()) : [];
  const body = hasHeader ? rows.slice(1) : rows;
  result.rows = body.length;
  const stats = columnStats(body, ncol, decimalComma);

  let lat = -1;
  let lon = -1;
  let time = -1;
  let freq = -1;
  let device = -1;
  let units = -1;
  let acc = -1;
  let thr = -1;
  let nfl = -1;
  let abv = -1;
  let spc = -1;
  let smp = -1;
  let measureCols: number[] = [];

  if (hasHeader) {
    header.forEach((h, i) => {
      const n = norm(h);
      if (lat < 0 && RX.lat.test(n)) lat = i;
      else if (lon < 0 && RX.lon.test(n)) lon = i;
      else if (time < 0 && RX.time.test(n)) time = i;
      else if (freq < 0 && RX.freq.test(n) && !/sample/.test(n)) freq = i;
      else if (device < 0 && RX.device.test(n)) device = i;
      else if (units < 0 && RX.units.test(n)) units = i;
      else if (acc < 0 && RX.acc.test(n)) acc = i;
      else if (thr < 0 && RX.threshold.test(n)) thr = i;
      else if (nfl < 0 && RX.noiseFloor.test(n)) nfl = i;
      else if (abv < 0 && RX.above.test(n)) abv = i;
      else if (spc < 0 && RX.spacing.test(n)) spc = i;
      else if (smp < 0 && RX.samples.test(n)) smp = i;
      if (RX.measure.test(n) && !RX.notMeasure.test(n) && stats[i]?.numeric > 0.5) measureCols.push(i);
    });
    measureCols = measureCols.filter((i) => ![lat, lon, time, freq, device, units, acc].includes(i));
  }

  // Numeric fallback for anything the header didn't settle.
  const used = () => new Set([lat, lon, time, freq, device, units, acc, thr, nfl, abv, spc, smp, ...measureCols]);
  // MATLAB datenum time column (thesis tool) when no header named one.
  if (time < 0) {
    const dn = stats.find((st) => st.numeric > 0.8 && !used().has(st.idx) && isDatenum(st.min) && isDatenum(st.max));
    if (dn) time = dn.idx;
  }
  if (lat < 0 || lon < 0) {
    const coord = stats.filter(
      (s) => s.numeric > 0.8 && !used().has(s.idx) && Math.abs(s.min) <= 180 && Math.abs(s.max) <= 180 && s.span < 3 && Math.abs(s.mean) > 1 && !(s.monotonic && s.ints)
    );
    let pick: [number, number] | null = null;
    // Try the coordinate pairs in column order (lat,lon before any level columns) and stop at the first that fits.
    outer: for (const a of coord)
      for (const b of coord) {
        if (a.idx === b.idx) continue;
        if (inRegion(a.mean, b.mean) || inRegion(-Math.abs(a.mean), b.mean)) {
          pick = [a.idx, b.idx];
          break outer;
        }
      }
    if (!pick && coord.length >= 2) {
      const [a, b] = coord;
      pick = Math.abs(a.mean) <= 90 ? [a.idx, b.idx] : [b.idx, a.idx];
    }
    if (pick) {
      [lat, lon] = pick;
      notes.push("Coordinates found from the values (no usable header)");
    }
  }
  if (!measureCols.length) {
    measureCols = stats
      .filter((s) => s.numeric > 0.8 && !used().has(s.idx) && s.min >= -200 && s.max <= 80 && !(s.monotonic && s.ints) && s.span > 0)
      .map((s) => s.idx);
    if (measureCols.length && hasHeader) notes.push("Measurement columns guessed from their values");
  }

  if (lat < 0 || lon < 0) {
    notes.push("No latitude/longitude columns found");
    result.skipped = body.length;
    return result;
  }
  if (!measureCols.length) {
    notes.push("No signal level columns found");
    result.skipped = body.length;
    return result;
  }

  // Thesis MATLAB tool: no header, three level columns and a datenum time.
  const matlab = !hasHeader && measureCols.length === 3 && time >= 0 && isDatenum(stats[time].min);
  const MATLAB_MEASURES = [
    { key: "peak_power_db", label: "Peak power (dB)" },
    { key: "band_mean_level_db", label: "Band mean level (dB)" },
    { key: "spectrum_mean_level_db", label: "Spectrum mean level (dB)" },
  ];
  result.measures = measureCols.map((i, k) =>
    hasHeader ? { key: norm(header[i]), label: prettyLabel(header[i]) } : matlab ? MATLAB_MEASURES[k] : { key: `band_${k + 1}`, label: `Band ${k + 1}` }
  );
  if (matlab) {
    result.units = "dBm";
    notes.push("Read as the thesis MATLAB tool format (longitude, latitude, peak, band mean, spectrum mean, time)");
  }

  // Coordinate repairs, decided once per file from the medians.
  const latMed = median(body.map((r) => toNum(r[lat], decimalComma)));
  const lonMed = median(body.map((r) => toNum(r[lon], decimalComma)));
  let swap = false;
  let flipLat = false;
  if (Math.abs(latMed) > 90 && Math.abs(lonMed) <= 90) swap = true;
  else if (!inRegion(latMed, lonMed) && inRegion(lonMed, latMed)) swap = true;
  const [la, lo] = swap ? [lonMed, latMed] : [latMed, lonMed];
  if (!inRegion(la, lo) && inRegion(-la, lo) && la > 0) flipLat = true;
  if (swap) notes.push("Latitude and longitude columns were swapped — corrected");
  if (flipLat) notes.push("Latitudes were missing the minus sign (southern hemisphere) — corrected");

  // Units: explicit column, else from the header names.
  if (units >= 0) {
    const u = body.find((r) => r[units]?.trim())?.[units]?.trim();
    if (u) result.units = u;
  } else if (hasHeader) {
    const hs = measureCols.map((i) => norm(header[i])).join(" ");
    result.units = /dbfs/.test(hs) ? "dBFS" : /dbm/.test(hs) ? "dBm" : "dB";
  }
  const freqScale = hasHeader && freq >= 0 ? (/mhz/.test(norm(header[freq])) ? 1e6 : /khz/.test(norm(header[freq])) ? 1e3 : 1) : 1;

  body.forEach((r, i) => {
    let a = toNum(r[lat], decimalComma);
    let b = toNum(r[lon], decimalComma);
    if (swap) [a, b] = [b, a];
    if (flipLat && a > 0) a = -a;
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180 || (a === 0 && b === 0)) {
      result.skipped++;
      return;
    }
    const values: Record<string, number> = {};
    let any = false;
    measureCols.forEach((c, k) => {
      const v = toNum(r[c], decimalComma);
      if (Number.isFinite(v)) {
        values[result.measures[k].key] = v;
        any = true;
      }
    });
    if (!any) {
      result.skipped++;
      return;
    }
    const p: MapPoint = { lat: a, lon: b, values, file: fileIndex, row: i + (hasHeader ? 2 : 1) };
    if (time >= 0) p.t = parseTime(r[time]);
    if (freq >= 0) {
      let f = toNum(r[freq], decimalComma);
      if (Number.isFinite(f)) {
        f *= freqScale;
        if (freqScale === 1 && f > 0 && f < 1e5) f *= 1e6; // bare numbers under 100k are MHz
        p.freqHz = f;
      }
    }
    if (device >= 0 && r[device]?.trim()) p.device = r[device].trim();
    if (acc >= 0) {
      const v = toNum(r[acc], decimalComma);
      if (Number.isFinite(v)) p.accuracyM = v;
    }
    const num = (c: number) => (c >= 0 ? toNum(r[c], decimalComma) : NaN);
    if (Number.isFinite(num(thr))) p.threshold = num(thr);
    if (Number.isFinite(num(nfl))) p.noiseFloor = num(nfl);
    if (Number.isFinite(num(spc))) p.spacingM = num(spc);
    if (Number.isFinite(num(smp))) p.samples = num(smp);
    if (abv >= 0) {
      const a = (r[abv] ?? "").trim().toLowerCase();
      if (a === "1" || a === "true" || a === "yes") p.above = true;
      else if (a === "0" || a === "false" || a === "no") p.above = false;
    }
    result.points.push(p);
  });
  if (result.points.some((p) => p.t !== undefined)) result.points.sort((x, y) => (x.t ?? 0) - (y.t ?? 0));
  if (result.skipped) notes.push(`${result.skipped} row${result.skipped === 1 ? "" : "s"} without a position or level skipped`);
  return result;
}
