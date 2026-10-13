// DF fix export (CSV / KML / GPX), shared-session links and KrakenSDR import.
import { destination } from "./triangulate.js";

export type FixRecord = {
  lat: number; lon: number; gpsAccM?: number;
  bearing: number;        // ° true (if declination applied) else magnetic
  north: "T" | "M";
  sigma: number; beamwidth: number; snrDb: number; frontBackDb: number | null;
  level: number; units: string; gain: string; agc: boolean;
  headingSource: string; mode: "peak" | "null"; freqHz: number; t: number; label?: string; station?: string;
};

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
const csvCell = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

const COLS: (keyof FixRecord)[] = ["t", "lat", "lon", "gpsAccM", "bearing", "north", "sigma", "beamwidth", "snrDb", "frontBackDb", "level", "units", "gain", "agc", "headingSource", "mode", "freqHz", "station", "label"];
export function fixesToCsv(fixes: FixRecord[]): string {
  return [COLS.join(","), ...fixes.map((f) => COLS.map((c) => csvCell(c === "t" ? new Date(f.t).toISOString() : f[c])).join(","))].join("\n") + "\n";
}

export function fixesToKml(name: string, fixes: FixRecord[], est?: { lat: number; lon: number; ellipse?: [number, number][] }, lineM = 3000): string {
  const pm = fixes.map((f, i) => {
    const [la, lo] = destination(f.lat, f.lon, f.bearing, lineM);
    return `<Placemark><name>Fix ${i + 1} ${f.bearing.toFixed(1)}°${f.north}</name><description>${esc(`${(f.freqHz / 1e6).toFixed(4)} MHz, ${f.level.toFixed(1)} ${f.units}, ±${f.sigma.toFixed(1)}°, ${new Date(f.t).toISOString()}`)}</description><styleUrl>#b</styleUrl><LineString><coordinates>${f.lon},${f.lat},0 ${lo},${la},0</coordinates></LineString></Placemark>`;
  });
  if (est) {
    pm.push(`<Placemark><name>Estimate</name><Point><coordinates>${est.lon},${est.lat},0</coordinates></Point></Placemark>`);
    if (est.ellipse) pm.push(`<Placemark><name>95% ellipse</name><LineString><coordinates>${est.ellipse.map(([a, b]) => `${b},${a},0`).join(" ")}</coordinates></LineString></Placemark>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(name)}</name><Style id="b"><LineStyle><color>ff5ec522</color><width>3</width></LineStyle></Style>${pm.join("")}</Document></kml>\n`;
}

export function fixesToGpx(name: string, fixes: FixRecord[], track: { lat: number; lon: number; t: number; db?: number }[] = []): string {
  const wpt = fixes.map((f, i) => `<wpt lat="${f.lat}" lon="${f.lon}"><time>${new Date(f.t).toISOString()}</time><name>Fix ${i + 1}</name><desc>${esc(`bearing ${f.bearing.toFixed(1)}°${f.north} ±${f.sigma.toFixed(1)}° ${f.level.toFixed(1)} ${f.units}`)}</desc></wpt>`).join("");
  const trk = track.length ? `<trk><name>${esc(name)} track</name><trkseg>${track.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}"><time>${new Date(p.t).toISOString()}</time>${p.db !== undefined ? `<extensions><level>${p.db.toFixed(1)}</level></extensions>` : ""}</trkpt>`).join("")}</trkseg></trk>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="webRx DT" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${esc(name)}</name></metadata>${wpt}${trk}</gpx>\n`;
}

// ── shared sessions: compact JSON in the URL fragment (base64url) ──
export type SharedSession = { v: 1; name: string; fixes: FixRecord[] };
const b64u = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
export function encodeSession(s: SharedSession): string { return b64u(JSON.stringify(s)); }
export function decodeSession(token: string): SharedSession | null {
  try {
    const s = JSON.parse(unb64u(token));
    if (s?.v !== 1 || !Array.isArray(s.fixes)) return null;
    s.fixes = s.fixes.filter((f: any) => [f.lat, f.lon, f.bearing].every((x) => typeof x === "number" && Number.isFinite(x)));
    return s;
  } catch (_) { return null; }
}

/**
 * KrakenSDR / DF Aggregator import. Accepts:
 *  - Kraken "DOA" XML (<DATA><LOCATION><LATITUDE>…<DOA_RESULT>…<CONF>…</DATA>)
 *  - Kraken JSON / CSV-ish objects with latitude/longitude/doa(or bearing)/confidence
 *  - DF Aggregator JSON export (array of {latitude, longitude, bearing|doa, confidence|conf, time})
 * Kraken DOA is reported as compass bearing (degrees from north, clockwise) when
 * the station heading is set. Confidence (0-~99) is mapped to σ.
 */
export function importKraken(text: string, freqHz = 0): FixRecord[] {
  const out: FixRecord[] = [];
  const add = (lat: number, lon: number, brg: number, conf: number | undefined, t: number | undefined, station?: string) => {
    if (![lat, lon, brg].every(Number.isFinite)) return;
    const sigma = conf === undefined || !Number.isFinite(conf) ? 10 : Math.max(2, 30 - 0.25 * Math.min(99, conf));
    out.push({ lat, lon, bearing: ((brg % 360) + 360) % 360, north: "T", sigma, beamwidth: NaN, snrDb: NaN, frontBackDb: null, level: NaN, units: "", gain: "", agc: false, headingSource: "krakensdr", mode: "peak", freqHz, t: t ?? Date.now(), station });
  };
  const s = text.trim();
  if (s.startsWith("<")) {
    const tag = (blk: string, n: string) => { const m = new RegExp(`<${n}>\\s*([^<]*)</${n}>`, "i").exec(blk); return m ? m[1].trim() : undefined; };
    const blocks = s.match(/<DATA>[\s\S]*?<\/DATA>/gi) ?? [s];
    for (const b of blocks) {
      const lat = parseFloat(tag(b, "LATITUDE") ?? ""), lon = parseFloat(tag(b, "LONGITUDE") ?? "");
      const doa = parseFloat(tag(b, "DOA") ?? tag(b, "DOA_RESULT") ?? tag(b, "BEARING") ?? "");
      const conf = parseFloat(tag(b, "CONF") ?? tag(b, "CONFIDENCE") ?? "");
      const ts = parseFloat(tag(b, "TIME") ?? "");
      const st = tag(b, "STATION_ID") ?? tag(b, "NAME");
      add(lat, lon, doa, Number.isFinite(conf) ? conf : undefined, Number.isFinite(ts) ? (ts > 1e12 ? ts : ts * 1000) : undefined, st);
    }
    return out;
  }
  if (s.startsWith("{") || s.startsWith("[")) {
    let j: any = JSON.parse(s);
    if (!Array.isArray(j)) j = j.fixes ?? j.bearings ?? j.data ?? [j];
    for (const o of j) {
      const n = (k: string[]) => { for (const x of k) if (o[x] !== undefined) return Number(o[x]); return NaN; };
      const ts = n(["time", "timestamp", "t", "tStamp"]);
      add(n(["latitude", "lat"]), n(["longitude", "lon", "lng"]), n(["bearing", "doa", "DOA", "heading"]), Number.isFinite(n(["confidence", "conf", "CONF"])) ? n(["confidence", "conf", "CONF"]) : undefined, Number.isFinite(ts) ? (ts > 1e12 ? ts : ts * 1000) : undefined, o.station_id ?? o.station ?? o.name);
    }
    return out;
  }
  // CSV: Kraken "Kerberos" CSV: time, doa, conf, rssi, freq, ant, latency, station, lat, lon, heading,...
  for (const line of s.split(/\r?\n/)) {
    const c = line.split(",").map((x) => x.trim());
    if (c.length < 10 || !Number.isFinite(+c[1])) continue;
    add(+c[8], +c[9], +c[1], +c[2], +c[0] > 1e12 ? +c[0] : +c[0] * 1000, c[7]);
  }
  return out;
}
