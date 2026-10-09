// Spatial sampling (thesis §3.5) and calibration helpers.
import {
  PowerAverager,
  SpatialSampler,
  bandBins,
  euclideanM,
  haversineM,
  spectrumLevels,
} from "../src/sampling/spatial.js";
import { Calibration, calibrationCsv, mismatches, reduceSpectrum, withGuard } from "../src/calibration/calibration.js";

declare const process: { exit(code: number): never };
let failures = 0;
function check(name: string, cond: boolean, detail?: any) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  if (!cond) failures++;
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ── distances ──
const M = { lat: -33.4609, lon: 18.7265 }; // Malmesbury
check("haversine: 1° of latitude ≈ 111.13 km (r = 6367.45 km)", near(haversineM(0, 0, 1, 0), 111_133, 5), haversineM(0, 0, 1, 0));
check("euclidean (Eq 3-6): 1° = 111 319 m", near(euclideanM(0, 0, 0, 1), 111_319, 0.5));
const ewH = haversineM(M.lat, M.lon, M.lat, M.lon + 0.001);
const ewE = euclideanM(M.lat, M.lon, M.lat, M.lon + 0.001);
check("east–west at 33.5° S: haversine ≈ 92.7 m", near(ewH, 92.7, 0.3), ewH);
check("east–west at 33.5° S: Eq 3-6 reads ~20 % long", near(ewE / ewH, 1.2, 0.01), ewE / ewH);
const nsH = haversineM(M.lat, M.lon, M.lat + 0.0001, M.lon);
check("north–south: both formulas agree", near(nsH, euclideanM(M.lat, M.lon, M.lat + 0.0001, M.lon), 0.05), nsH);

// ── sampler: walk north 2 m per fix with 5 m spacing ──
const mPerDegLat = haversineM(0, 0, 1, 0);
const s = new SpatialSampler({ spacingM: 5, formula: "haversine", jitterGuard: true });
const pins: number[] = [];
for (let i = 0; i <= 30; i++) {
  const p = { lat: M.lat + (i * 2) / mPerDegLat, lon: M.lon, t: i * 1000, accuracyM: 4, speedKmh: 7.2 };
  const d = s.decide(p);
  if (d.place) {
    pins.push(i);
    s.commit(p);
  }
}
check("first fix places a pin", pins[0] === 0, pins);
check("pins every 3rd fix (6 m ≥ 5 m)", pins.join() === "0,3,6,9,12,15,18,21,24,27,30", pins);

// ── stationary jitter: parked, GPS wandering ±4 m, accuracy 8 m, no speed ──
const j = new SpatialSampler({ spacingM: 5, formula: "haversine", jitterGuard: true });
let seed = 3;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
let parkedPins = 0;
for (let i = 0; i < 120; i++) {
  const p = { lat: M.lat + (rnd() * 4) / mPerDegLat, lon: M.lon + (rnd() * 4) / 92_700 * 0.001 * 1000 / 1, t: i * 1000, accuracyM: 8, speedKmh: 0 };
  const d = j.decide(p);
  if (d.place) {
    parkedPins++;
    j.commit(p);
  }
}
check("parked with GPS drift: only the first pin", parkedPins === 1, parkedPins);
const noGuard = new SpatialSampler({ spacingM: 5, formula: "haversine", jitterGuard: false });
seed = 3;
let unguarded = 0;
for (let i = 0; i < 120; i++) {
  const p = { lat: M.lat + (rnd() * 4) / mPerDegLat, lon: M.lon + (rnd() * 4) / 92_700 * 0.001 * 1000, t: i * 1000, accuracyM: 8, speedKmh: 0 };
  if (noGuard.decide(p).place) {
    unguarded++;
    noGuard.commit(p);
  }
}
check("without the guard the drift drops extra pins", unguarded > 1, unguarded);

// ── fast vehicle: 120 km/h, phone GPS at 1 Hz → 33 m between fixes ──
const fast = new SpatialSampler({ spacingM: 5, formula: "haversine", jitterGuard: true });
let fastPins = 0;
for (let i = 0; i < 10; i++) {
  const p = { lat: M.lat + (i * 33.33) / mPerDegLat, lon: M.lon, t: i * 1000, accuracyM: 5, speedKmh: 120 };
  if (fast.decide(p).place) {
    fastPins++;
    fast.commit(p);
  }
}
check("120 km/h at 1 Hz: one pin per fix", fastPins === 10, fastPins);

// ── averaging in linear power ──
const avg = new PowerAverager();
avg.addLevels({ band: -30 });
avg.addLevels({ band: -20 });
check("linear mean of −30 and −20 dB = −22.6 dB", near(avg.meanLevels().band, -22.596, 0.01), avg.meanLevels());
avg.addSpectrum([-30, -40]);
avg.addSpectrum([-20, -40]);
const ms = avg.meanSpectrum()!;
check("per-bin spectrum average", near(ms[0], -22.596, 0.01) && near(ms[1], -40, 0.001) && avg.blocks === 2, Array.from(ms));
avg.reset();
check("reset clears", avg.meanSpectrum() === null && avg.blocks === 0);

// ── levels inside the measurement bandwidth (thesis A-2: peak/mean of the band) ──
const n = 1024;
const spec = new Float32Array(n).fill(-60);
spec[512 + 20] = -10; // inside 150 kHz at 2.048 Msps (±37 bins)
spec[512 + 300] = 0; // outside the band
const [b0, b1] = bandBins(n, 2_048_000, 150_000);
check("150 kHz at 2.048 Msps = 76 bins around the centre", b0 === 474 && b1 === 550, [b0, b1]);
const lv = spectrumLevels(spec, 100.1e6, 2_048_000, 150_000);
check("peak is the strongest bin inside the band", lv.peak === -10 && near(lv.peakHz, 100.1e6 + 40_000, 1), lv);
check("band mean = linear mean of the 76 band bins", near(lv.band, 10 * Math.log10((0.1 + 75e-6) / 76), 1e-6), lv);
check("spectrum mean covers the whole span (incl. the out-of-band 0 dB bin)", near(lv.spec, 10 * Math.log10((1 + 0.1 + 1022e-6) / 1024), 1e-6), lv);
const half = bandBins(n, 2_048_000, null);
check("no bandwidth = centre 50 % of the span", half[0] === 256 && half[1] === 768, half);

// ── calibration helpers ──
const cal: Calibration = {
  id: "c1",
  createdAt: Date.UTC(2020, 11, 3, 13, 0),
  device: "RTL-SDR",
  centerHz: 100.1e6,
  sampleRate: 2_048_000,
  bwHz: 150_000,
  fftSize: 1024,
  gain: 29.7,
  amp: false,
  biasTee: false,
  calDb: 0,
  units: "dBm(cal)",
  noiseFloorDb: -25.1,
  guardDb: 5,
  thresholdDb: -20.1,
  inherent: { measuredAt: 0, durationS: 10, blocks: 100, bandMeanDb: -31, peakDb: -28, spectrumMeanDb: -32, spectrum: [-31, -30, -32], freqStartHz: 99e6, freqStopHz: 102e6 },
  vehicle: { measuredAt: 0, durationS: 10, blocks: 100, bandMeanDb: -25.1, peakDb: -22, spectrumMeanDb: -26, spectrum: [-25, -24, -26], freqStartHz: 99e6, freqStopHz: 102e6 },
};
check("threshold = noise floor + guard (pilot: −25.1 + 5 = −20.1)", near(withGuard(cal, 5).thresholdDb, -20.1, 1e-9));
check("10 dB guard", near(withGuard(cal, 10).thresholdDb, -15.1, 1e-9));
const same = { device: "RTL-SDR", centerHz: 100.1e6, sampleRate: 2_048_000, bwHz: 150_000, fftSize: 1024, gain: 29.7, amp: false, biasTee: false, calDb: 0, units: "dBm(cal)" };
check("matching settings", mismatches(cal, same).length === 0, mismatches(cal, same));
check("gain change invalidates", mismatches(cal, { ...same, gain: null }).some((m) => /gain/.test(m)));
check("frequency change invalidates", mismatches(cal, { ...same, centerHz: 95.5e6 }).some((m) => /frequency/.test(m)));
const csv = calibrationCsv(cal).trim().split(/\r?\n/);
const dataRows = csv.filter((l) => !l.startsWith("#"));
check("calibration CSV: header + 3 rows", dataRows.length === 4 && /frequency_mhz/.test(dataRows[0]), dataRows);
check("calibration CSV: first bin at 99.5 MHz", dataRows[1].startsWith("99.50000,-31.00"), dataRows[1]);
check("calibration CSV: threshold in header", csv.some((l) => l === "# threshold_db,-20.10"));
check("reduceSpectrum keeps short spectra", reduceSpectrum([-1, -2]).join() === "-1,-2");
check("reduceSpectrum to 512 points", reduceSpectrum(new Float32Array(2048).fill(-50)).length === 512);

console.log(failures ? `\n${failures} failed` : "\nAll sampling/calibration tests passed.");
process.exit(failures ? 1 : 0);
