// RM survey parameters (PROPOSAL §11.2 step 3): every value is user-defined;
// DEFAULT_PARAMS are only prefilled suggestions. Named profiles are stored locally.

export type Detector = "peak" | "avg" | "rms";
export type Reduction = "none" | "peakmean" | "subbands";
export type DeviceKind = "hackrf" | "rtlsdr" | "remote" | "none";

export interface Range {
  startMHz: number;
  stopMHz: number;
}

export interface SweepParams {
  ranges: Range[];
  binKHz: number;
  fftSize: number;
  dwellMs: number;
  repeatS: number;
  detector: Detector;
  lnaDb: number;
  vgaDb: number;
  amp: boolean;
  bias: boolean;
  thresholdDb: number;
  hysteresisDb: number;
  distM: number;
  timeS: number;
  changeDb: number;
  reduction: Reduction;
  subBands: number;
  quantDb: number;
  snapshotEvery: "off" | "100m" | "60s";
  mode: "vehicle" | "walking" | "static";
  heightM: number;
  notes: string;
}

export const DEFAULT_PARAMS: SweepParams = {
  ranges: [{ startMHz: 1, stopMHz: 6000 }],
  binKHz: 1000,
  fftSize: 1024,
  dwellMs: 20,
  repeatS: 2,
  detector: "peak",
  lnaDb: 24,
  vgaDb: 20,
  amp: false,
  bias: false,
  thresholdDb: 6,
  hysteresisDb: 2,
  distM: 10,
  timeS: 30,
  changeDb: 3,
  reduction: "subbands",
  subBands: 60,
  quantDb: 0.5,
  snapshotEvery: "off",
  mode: "vehicle",
  heightM: 1.6,
  notes: "",
};

export const RTL_MAX_MHZ = 1766;
export const RTL_MIN_MHZ = 24;
export const HACKRF_MIN_MHZ = 1;
export const HACKRF_MAX_MHZ = 6000;

/** Calibration needed for dBm output (Lee, 13 Oct: uploads must be dBm). */
export interface DbmCalibration {
  /** dBFS → dBm offset measured against a reference source (dB). */
  offsetDb: number | null;
  antennaGainDbi: number | null;
  cableLossDb: number | null;
  serial?: string;
  createdAt?: number;
  method?: string;
}

/** dBm at the antenna terminals = dBFS + offset − antenna gain + cable loss. */
export function toDbm(dbfs: number, c: DbmCalibration): number {
  return dbfs + (c.offsetDb ?? 0) - (c.antennaGainDbi ?? 0) + (c.cableLossDb ?? 0);
}

export function calibrationComplete(c: DbmCalibration | null | undefined): c is DbmCalibration {
  return !!c && Number.isFinite(c.offsetDb) && Number.isFinite(c.antennaGainDbi) && Number.isFinite(c.cableLossDb);
}

/**
 * Errors that block the survey from starting. The full user range is always
 * covered: if the connected device can't reach it, starting is blocked with a
 * clear message (no silent skipping).
 */
export function validateParams(p: SweepParams, device: DeviceKind, cal: DbmCalibration | null): string[] {
  const e: string[] = [];
  if (!p.ranges.length) e.push("Add at least one frequency range.");
  for (const [i, r] of p.ranges.entries()) {
    if (!(r.stopMHz > r.startMHz)) e.push(`Range ${i + 1}: stop must be above start.`);
    if (r.startMHz < HACKRF_MIN_MHZ || r.stopMHz > HACKRF_MAX_MHZ) e.push(`Range ${i + 1}: outside ${HACKRF_MIN_MHZ}–${HACKRF_MAX_MHZ} MHz.`);
  }
  if (device === "none") e.push("Connect a receiver first (HackRF recommended for wideband sweeps).");
  if (device === "rtlsdr") {
    const out = p.ranges.filter((r) => r.stopMHz > RTL_MAX_MHZ || r.startMHz < RTL_MIN_MHZ);
    if (out.length)
      e.push(
        `The configured range needs a HackRF: ${out.map((r) => `${r.startMHz}–${r.stopMHz} MHz`).join(", ")} is outside the RTL-SDR's ${RTL_MIN_MHZ}–${RTL_MAX_MHZ} MHz. Connect a HackRF or change the ranges.`
      );
  }
  if (device === "remote") e.push("Surveys need a local receiver (remote servers can't sweep).");
  if (!calibrationComplete(cal)) e.push("Complete the dBm calibration (reference offset, antenna gain, cable loss) in step 2.");
  for (const [k, v] of Object.entries({ binKHz: p.binKHz, fftSize: p.fftSize, dwellMs: p.dwellMs, repeatS: p.repeatS, quantDb: p.quantDb }))
    if (!(v > 0)) e.push(`${k} must be > 0.`);
  if (p.reduction === "subbands" && !(p.subBands >= 1)) e.push("Sub-bands must be ≥ 1.");
  if (p.hysteresisDb < 0 || p.distM < 0 || p.timeS < 0 || p.changeDb < 0) e.push("Gates and hysteresis can't be negative.");
  return e;
}

/** Values stored per sample for these params. */
export function valuesPerSample(p: SweepParams): number {
  const mhz = p.ranges.reduce((a, r) => a + Math.max(0, r.stopMHz - r.startMHz), 0);
  if (p.reduction === "none") return Math.ceil((mhz * 1000) / p.binKHz);
  if (p.reduction === "peakmean") return 2 * p.ranges.length;
  return 2 * p.subBands * p.ranges.length;
}

/** Rough samples/hour after gating, by mode (vehicle 50 km/h, walking 5 km/h). */
export function samplesPerHour(p: SweepParams): number {
  const speed = p.mode === "vehicle" ? 13.9 : p.mode === "walking" ? 1.4 : 0;
  const byDist = speed && p.distM ? (3600 * speed) / p.distM : 0;
  const byTime = p.timeS ? 3600 / p.timeS : 0;
  const bySweep = 3600 / Math.max(p.repeatS, 0.5);
  return Math.min(bySweep, Math.max(byDist, byTime));
}

/** Bytes/hour (raw and gzip at an assumed 2.6×). 14 B time/GPS/flags per sample. */
export function estimateBytesPerHour(p: SweepParams, gzipRatio = 2.6): { raw: number; gz: number; perSample: number } {
  const perSample = valuesPerSample(p) + 14;
  const raw = perSample * samplesPerHour(p);
  return { raw, gz: raw / gzipRatio, perSample };
}

// ── named profiles ──
export const PROFILES_KEY = "webrx.survey.profiles.v1";
export type Profiles = Record<string, SweepParams>;
export function loadProfiles(kv: { getItem(k: string): string | null }): Profiles {
  try {
    return { "Wideband 1–6000 MHz": DEFAULT_PARAMS, ...(JSON.parse(kv.getItem(PROFILES_KEY) || "{}") as Profiles) };
  } catch (_) {
    return { "Wideband 1–6000 MHz": DEFAULT_PARAMS };
  }
}
export function saveProfile(kv: { getItem(k: string): string | null; setItem(k: string, v: string): void }, name: string, p: SweepParams) {
  let all: Profiles = {};
  try {
    all = JSON.parse(kv.getItem(PROFILES_KEY) || "{}");
  } catch (_) {}
  all[name] = p;
  kv.setItem(PROFILES_KEY, JSON.stringify(all));
}
export function deleteProfile(kv: { getItem(k: string): string | null; setItem(k: string, v: string): void }, name: string) {
  let all: Profiles = {};
  try {
    all = JSON.parse(kv.getItem(PROFILES_KEY) || "{}");
  } catch (_) {}
  delete all[name];
  kv.setItem(PROFILES_KEY, JSON.stringify(all));
}
