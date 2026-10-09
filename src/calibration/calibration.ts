// Pre-drive noise-floor calibration, as set out in the thesis (§3.4, §4.3.1):
//
//   1. Inherent (internal) noise — antenna replaced by a 50 Ω dummy load, so
//      only the receiver's own noise is measured (§3.4.4.2, Fig 3.14).
//   2. Vehicle noise — antenna back in its driving position, engine running,
//      air-con, lights and radio on, so everything the vehicle adds is
//      included (§3.4.4.3, §4.3.1).
//   3. Threshold = vehicle noise floor + guard band. Only measurements above
//      it count as signal (§2.4.3.3: 3–5 dB; pilot §4.3.4: 5 dB; §3.4.6: 10 dB).
//
// A calibration only holds for the settings it was made with (receiver,
// frequency, bandwidth, sample rate, gain, amplifier, calibration offset).

export type CalibrationStep = {
  measuredAt: number;
  durationS: number;
  blocks: number;
  /** Mean level inside the measurement bandwidth — the noise floor figure. */
  bandMeanDb: number;
  peakDb: number;
  spectrumMeanDb: number;
  /** Mean spectrum (dB), reduced to at most 512 points, from freqStartHz to freqStopHz. */
  spectrum: number[];
  freqStartHz: number;
  freqStopHz: number;
};

export type CalibrationSettings = {
  device: string;
  centerHz: number;
  sampleRate: number;
  bwHz: number | null;
  fftSize: number;
  gain: number | null;
  amp: boolean;
  biasTee: boolean;
  calDb: number;
  units: string;
};

export type Calibration = CalibrationSettings & {
  id: string;
  createdAt: number;
  lat?: number;
  lon?: number;
  inherent?: CalibrationStep;
  vehicle?: CalibrationStep;
  noiseFloorDb: number;
  guardDb: number;
  thresholdDb: number;
};

export const DEFAULT_GUARD_DB = 5;
const KEY = "webrx.calibration";
const HISTORY_KEY = "webrx.calibration.history";

let cache: Calibration | null | undefined;
if (typeof window !== "undefined") {
  // Another tab saved a calibration.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) cache = undefined;
  });
}

export function loadCalibration(): Calibration | null {
  if (cache !== undefined) return cache;
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    cache = c && typeof c.thresholdDb === "number" ? c : null;
  } catch (_) {
    cache = null;
  }
  return cache ?? null;
}

export function saveCalibration(c: Calibration) {
  cache = c;
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
    const hist: Calibration[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const next = [c, ...hist.filter((h) => h.id !== c.id)].slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch (_) {}
}

export function clearCalibration() {
  cache = null;
  try {
    localStorage.removeItem(KEY);
  } catch (_) {}
}

export function newCalibrationId(): string {
  return `cal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function withGuard(c: Calibration, guardDb: number): Calibration {
  return { ...c, guardDb, thresholdDb: c.noiseFloorDb + guardDb };
}

/** Why a calibration doesn't apply to the current settings (empty = it applies). */
export function mismatches(c: Calibration, s: CalibrationSettings): string[] {
  const out: string[] = [];
  if (c.device !== s.device) out.push(`receiver (${c.device})`);
  if (Math.abs(c.centerHz - s.centerHz) > 1000) out.push(`frequency (${(c.centerHz / 1e6).toFixed(3)} MHz)`);
  if (c.sampleRate !== s.sampleRate) out.push(`sample rate (${c.sampleRate / 1e6} Msps)`);
  if ((c.bwHz ?? 0) !== (s.bwHz ?? 0)) out.push(`bandwidth (${c.bwHz ? `${c.bwHz / 1e3} kHz` : "50% of span"})`);
  if (c.gain !== s.gain) out.push(`gain (${c.gain === null ? "auto" : `${c.gain} dB`})`);
  if (c.amp !== s.amp) out.push(`RF amp (${c.amp ? "on" : "off"})`);
  if (c.calDb !== s.calDb) out.push(`calibration offset (${c.calDb} dB)`);
  return out;
}

export function reduceSpectrum(db: ArrayLike<number>, max = 512): number[] {
  const n = db.length;
  if (n <= max) return Array.from(db, (v) => +v.toFixed(2));
  const step = n / max;
  const out: number[] = [];
  for (let i = 0; i < max; i++) {
    const a = Math.floor(i * step);
    const b = Math.max(a + 1, Math.floor((i + 1) * step));
    let s = 0;
    for (let k = a; k < b; k++) s += Math.pow(10, db[k] / 10);
    out.push(+(10 * Math.log10(s / (b - a))).toFixed(2));
  }
  return out;
}

/** Spectrum sweep CSV like thesis Table 3.5, with both calibration steps side by side. */
export function calibrationCsv(c: Calibration): string {
  const meta = [
    `# webRx pre-drive noise-floor calibration (thesis §3.4 / §4.3.1)`,
    `# created,${new Date(c.createdAt).toISOString()}`,
    `# receiver,${c.device}`,
    `# centre_frequency_hz,${c.centerHz}`,
    `# sample_rate_hz,${c.sampleRate}`,
    `# measurement_bandwidth_hz,${c.bwHz ?? "50% of span"}`,
    `# gain_db,${c.gain ?? "auto"}`,
    `# units,${c.units}`,
    `# inherent_noise_band_mean_db,${c.inherent ? c.inherent.bandMeanDb.toFixed(2) : "not measured"}`,
    `# vehicle_noise_band_mean_db,${c.vehicle ? c.vehicle.bandMeanDb.toFixed(2) : "not measured"}`,
    `# noise_floor_db,${c.noiseFloorDb.toFixed(2)}`,
    `# guard_band_db,${c.guardDb}`,
    `# threshold_db,${c.thresholdDb.toFixed(2)}`,
    c.lat !== undefined ? `# location,${c.lat.toFixed(6)} ${c.lon!.toFixed(6)}` : `# location,unknown`,
  ];
  const ref = c.vehicle ?? c.inherent;
  const lines = ["frequency_mhz,inherent_noise_db,inherent_relative_power,vehicle_noise_db,vehicle_relative_power"];
  if (ref) {
    const n = ref.spectrum.length;
    for (let i = 0; i < n; i++) {
      const f = ref.freqStartHz + ((ref.freqStopHz - ref.freqStartHz) * (i + 0.5)) / n;
      const a = c.inherent?.spectrum[i];
      const b = c.vehicle?.spectrum[i];
      lines.push(
        [
          (f / 1e6).toFixed(5),
          a !== undefined ? a.toFixed(2) : "",
          a !== undefined ? Math.pow(10, a / 10).toExponential(4) : "",
          b !== undefined ? b.toFixed(2) : "",
          b !== undefined ? Math.pow(10, b / 10).toExponential(4) : "",
        ].join(",")
      );
    }
  }
  return [...meta, ...lines].join("\r\n") + "\r\n";
}
