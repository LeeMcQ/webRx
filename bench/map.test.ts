// Importer tests: every CSV style the MMN map has to open.
import { parseMeasurementCsv, detectDelimiter, toNum, fromDatenum } from "../src/apps/map/parse.js";
import { toCsv, csvFileName } from "../src/storage/recordings.js";

declare const process: { exit(code: number): never };
let failures = 0;
function check(name: string, cond: boolean, detail?: any) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  if (!cond) failures++;
}

// 1. webRx monitor export (exact header the recorder writes).
const webrx = [
  "timestamp,device,center_freq_hz,sample_rate_hz,gps_source,latitude,longitude,altitude_m,gps_accuracy_m,gps_sats,compass_deg,course_deg,peak_power_db,peak_freq_hz,band_mean_level_db,spectrum_mean_level_db,units,calibration_db,net_quality_pct",
  '2026-10-09T08:34:09.117Z,"HackRF Pro",95500000,10000000,phone,-33.460420,18.726860,,6.0,,251,,-9.10,96496094,-32.20,-34.70,dBFS,0,',
  '2026-10-09T08:34:08.117Z,"HackRF Pro",95500000,10000000,phone,-33.460540,18.726770,,6.0,,251,,-9.03,96496094,-32.12,-34.65,dBFS,0,',
  "2026-10-09T08:34:10.117Z,\"HackRF Pro\",95500000,10000000,phone,,,,,,,,-9.2,96496094,-32.3,-34.8,dBFS,0,",
].join("\r\n");
const a = parseMeasurementCsv(webrx, "webrx.csv");
check("webRx: 2 positioned points, 1 skipped", a.points.length === 2 && a.skipped === 1, { n: a.points.length, s: a.skipped });
check("webRx: measures named from header", a.measures.map((m) => m.key).join() === "peak_power_db,band_mean_level_db,spectrum_mean_level_db", a.measures);
check("webRx: label", a.measures[1].label === "Band mean level (dB)", a.measures[1].label);
check("webRx: units dBFS", a.units === "dBFS", a.units);
check("webRx: sorted by time", a.points[0].t! < a.points[1].t!);
check("webRx: freq/device/accuracy", a.points[0].freqHz === 95.5e6 && a.points[0].device === "HackRF Pro" && a.points[0].accuracyM === 6);
check("webRx: value", a.points[0].values.band_mean_level_db === -32.12);
check("webRx: no repair notes", !a.notes.some((n) => /corrected/.test(n)), a.notes);

// 2. Older SA recorder: latitude saved without the minus sign, generic headers.
const saOld = ["Lat,Lon,Power1 (dBm),Power2 (dBm)", "33.4609,18.7265,-41.5,-55.0", "33.4611,18.7268,-40.9,-54.2", "33.4614,18.7271,-39.8,-53.9"].join("\n");
const b = parseMeasurementCsv(saOld, "sa_old.csv");
check("SA old: sign repaired", b.points.length === 3 && b.points.every((p) => p.lat < 0), b.points.map((p) => p.lat));
check("SA old: note explains repair", b.notes.some((n) => /minus sign/.test(n)), b.notes);
check("SA old: two bands, units dBm", b.measures.length === 2 && b.units === "dBm", { m: b.measures, u: b.units });

// 3. Czech / European spreadsheet: semicolons + decimal commas, lat ~49.9–50.1 must NOT be flipped or swapped.
const cz = ["Čas;Zeměpisná šířka (latitude);longitude;RSSI dBm;level", "08:00:01;49,9871;14,4210;-61,5;-70,2", "08:00:02;50,0012;14,4215;-60,9;-69,8", "08:00:03;50,0105;14,4221;-59,7;-68,1"].join("\n");
check("delimiter ;", detectDelimiter(cz) === ";");
const c = parseMeasurementCsv(cz, "praha.csv");
check("Czech: positions kept in Europe", c.points.length === 3 && c.points.every((p) => p.lat > 49 && p.lat < 51 && p.lon > 14 && p.lon < 15), c.points.map((p) => [p.lat, p.lon]));
check("Czech: decimal comma values", c.points[0].values[c.measures[0].key] === -61.5, c.points[0].values);
check("Czech: no SA repair", !c.notes.some((n) => /minus sign|swapped/.test(n)), c.notes);

// 4. Headerless numeric file with lon/lat order swapped.
const bare = ["18.7265,-33.4609,-45.2,-60.1", "18.7268,-33.4611,-44.8,-59.5", "18.7271,-33.4614,-44.1,-58.9", "18.7275,-33.4618,-43.0,-58.0"].join("\n");
const e = parseMeasurementCsv(bare, "bare.csv");
check("headerless: coordinates found and in SA", e.points.length === 4 && e.points.every((p) => p.lat < -33 && p.lon > 18), e.points.map((p) => [p.lat, p.lon]));
check("headerless: Band 1/2 labels", e.measures.map((m) => m.label).join() === "Band 1,Band 2", e.measures);

// 5. Quoted fields containing delimiters and newlines.
const quoted = ['latitude,longitude,note,level_dbm', '-33.46,18.72,"car park, north side",-50', '-33.47,18.73,"line one\nline two",-48'].join("\n");
const f = parseMeasurementCsv(quoted, "q.csv");
check("quoted fields parsed", f.points.length === 2 && f.points[1].values.level_dbm === -48, f.points);

// 6. Garbage handled without throwing.
const g = parseMeasurementCsv("hello\nworld", "junk.csv");
check("junk file reports why", g.points.length === 0 && g.notes.length > 0, g.notes);

// 7. Writer round trip: what the recorder writes, the map reads back.
const cols = ["timestamp", "device", "latitude", "longitude", "band_mean_level_db", "units"];
const csv = toCsv(cols, [
  { timestamp: "2026-10-09T08:00:00Z", device: 'HackRF "Pro", unit 2', latitude: "-33.460000", longitude: "18.720000", band_mean_level_db: "-31.5", units: "dBFS" },
]);
const h = parseMeasurementCsv(csv, "rt.csv");
check("writer → reader round trip", h.points.length === 1 && h.points[0].device === 'HackRF "Pro", unit 2' && h.points[0].values.band_mean_level_db === -31.5, h.points[0]);
check("file name", /^mmn_hackrf-pro_95\.5MHz_\d{4}-\d{2}-\d{2}_\d{4}\.csv$/.test(csvFileName({ startedAt: Date.now(), summary: "HackRF Pro · 95.5 MHz" })), csvFileName({ startedAt: Date.now(), summary: "HackRF Pro · 95.5 MHz" }));
check("toNum unicode minus + unit", toNum("−45.5 dBm", false) === -45.5);

// 8. Thesis MATLAB tool output (Appendix A-2): no header; lon, lat (N/S dropped), peak, band mean, spectrum mean, datenum.
const mat = [
  "18.465623,33.412550,-27.1,-29.205972,-31.0,738128.773250",
  "18.466909,33.413254,-25.9,-27.735385,-30.2,738128.773482",
  "18.467945,33.413945,-26.4,-28.187192,-30.8,738128.773718",
].join("\n");
const m = parseMeasurementCsv(mat, "matlab.csv");
check("MATLAB: 3 points in Malmesbury area", m.points.length === 3 && m.points.every((p) => p.lat < -33.4 && p.lat > -33.42 && p.lon > 18.46 && p.lon < 18.47), m.points.map((p) => [p.lat, p.lon]));
check("MATLAB: measures named like webRx", m.measures.map((x) => x.key).join() === "peak_power_db,band_mean_level_db,spectrum_mean_level_db", m.measures);
check("MATLAB: band mean value", m.points[0].values.band_mean_level_db === -29.205972, m.points[0].values);
const d0 = new Date(m.points[0].t!);
check("MATLAB datenum → 3 Dec 2020 18:33 local", d0.getFullYear() === 2020 && d0.getMonth() === 11 && d0.getDate() === 3 && d0.getHours() === 18 && d0.getMinutes() === 33, d0.toString());
check("datenum 738128.5 = 3 Dec 2020 12:00 (MATLAB epoch)", (() => { const d = new Date(fromDatenum(738128.5)); return d.getDate() === 3 && d.getHours() === 12 && d.getMinutes() === 0; })());
check("MATLAB: units dBm, note", m.units === "dBm" && m.notes.some((n) => /MATLAB/.test(n)), { u: m.units, n: m.notes });

// 9. Thesis Table 4.1 layout: headers say Latitude/Longitude but the columns are swapped.
const t41 = ["Latitude,Longitude,Power level,Date and Time", "18.465623,-33.412550,-29.205972,738128.773250", "18.466909,-33.413254,-27.735385,738128.773482"].join("\n");
const t = parseMeasurementCsv(t41, "table41.csv");
check("Table 4.1: swapped columns corrected", t.points.length === 2 && t.points[0].lat === -33.41255 && t.points[0].lon === 18.465623, t.points[0]);
check("Table 4.1: time from datenum", t.points[0].t !== undefined && new Date(t.points[0].t).getFullYear() === 2020);

// 10. webRx pins with calibration columns.
const cal = [
  "timestamp,device,center_freq_hz,latitude,longitude,peak_power_db,band_mean_level_db,units,sampling,pin_spacing_m,samples_averaged,gain_db,noise_floor_db,threshold_db,above_threshold",
  "2026-10-09T08:00:00Z,HackRF Pro,100100000,-33.46,18.72,-40.1,-49.9,dBFS,distance 5 m,,4,30,-57.3,-52.3,1",
  "2026-10-09T08:00:02Z,HackRF Pro,100100000,-33.4601,18.7201,-48.2,-55.0,dBFS,distance 5 m,6.0,4,30,-57.3,-52.3,0",
].join("\n");
const c2 = parseMeasurementCsv(cal, "cal.csv");
check("calibration columns are not measures", c2.measures.map((x) => x.key).join() === "peak_power_db,band_mean_level_db", c2.measures);
check("threshold / floor / verdict read", c2.points[0].threshold === -52.3 && c2.points[0].noiseFloor === -57.3 && c2.points[0].above === true && c2.points[1].above === false, c2.points);
check("pin spacing + samples read", c2.points[1].spacingM === 6 && c2.points[1].samples === 4, c2.points[1]);

console.log(failures ? `\n${failures} failed` : "\nAll map importer tests passed.");
process.exit(failures ? 1 : 0);
