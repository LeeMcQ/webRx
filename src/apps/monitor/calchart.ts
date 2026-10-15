// Pre-drive calibration chart (thesis §3.4): the receiver's own noise
// (dummy load, blue) and the noise with the vehicle running (amber), the
// measurement band (shaded) and the pin threshold = noise floor + guard band
// (dashed red).
import type { CalibrationStep } from "../../calibration/calibration.js";
import { bandBins } from "../../sampling/spatial.js";

/** Sizes a canvas's backing store to its CSS size × devicePixelRatio (max 2). */
export function fitCanvas(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(50, Math.round(c.clientWidth * dpr));
  const h = Math.max(30, Math.round(c.clientHeight * dpr));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c.getContext("2d")!;
}

export function drawCalibrationChart(cv: HTMLCanvasElement, inh: CalibrationStep | undefined, veh: CalibrationStep | undefined, guard: number, bandHz: number | null) {
  const ctx = fitCanvas(cv);
  const W = cv.width;
  const H = cv.height;
  const dpr = W / Math.max(1, cv.clientWidth);
  ctx.clearRect(0, 0, W, H);
  const ref = veh ?? inh;
  ctx.font = `${10 * dpr}px ui-monospace, monospace`;
  if (!ref) {
    ctx.fillStyle = "#64748b";
    ctx.fillText("Spectra appear here after each measurement", 10 * dpr, 20 * dpr);
    return;
  }
  const thr = (veh?.bandMeanDb ?? NaN) + guard;
  const all = [...(inh?.spectrum ?? []), ...(veh?.spectrum ?? [])];
  let lo = Math.min(...all);
  let hi = Math.max(...all, Number.isFinite(thr) ? thr : -Infinity);
  lo = Math.floor(lo / 5) * 5 - 5;
  hi = Math.ceil(hi / 5) * 5 + 5;
  const left = 36 * dpr;
  const bottom = 16 * dpr;
  const pw = W - left - 6 * dpr;
  const ph = H - bottom - 6 * dpr;
  const y = (v: number) => 6 * dpr + (1 - (v - lo) / (hi - lo)) * ph;
  const x = (i: number, n: number) => left + ((i + 0.5) / n) * pw;
  ctx.strokeStyle = "rgba(148,163,184,0.15)";
  ctx.fillStyle = "#64748b";
  ctx.lineWidth = 1;
  for (let v = lo; v <= hi; v += (hi - lo) / 5) {
    ctx.beginPath();
    ctx.moveTo(left, Math.round(y(v)) + 0.5);
    ctx.lineTo(left + pw, Math.round(y(v)) + 0.5);
    ctx.stroke();
    ctx.fillText(v.toFixed(0), 2 * dpr, y(v) + 3 * dpr);
  }
  ctx.fillText(`${(ref.freqStartHz / 1e6).toFixed(3)} MHz`, left, H - 3 * dpr);
  const endLabel = `${(ref.freqStopHz / 1e6).toFixed(3)} MHz`;
  ctx.fillText(endLabel, left + pw - ctx.measureText(endLabel).width, H - 3 * dpr);
  // measurement band
  const span = ref.freqStopHz - ref.freqStartHz;
  const [b0, b1] = bandBins(1000, span, bandHz);
  ctx.fillStyle = "rgba(59,130,246,0.12)";
  ctx.fillRect(left + (b0 / 1000) * pw, 6 * dpr, ((b1 - b0) / 1000) * pw, ph);
  const trace = (sp: number[] | undefined, colour: string) => {
    if (!sp?.length) return;
    ctx.beginPath();
    sp.forEach((v, i) => (i ? ctx.lineTo(x(i, sp.length), y(v)) : ctx.moveTo(x(i, sp.length), y(v))));
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();
  };
  trace(inh?.spectrum, "#60a5fa");
  trace(veh?.spectrum, "#f59e0b");
  if (Number.isFinite(thr)) {
    ctx.save();
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    ctx.strokeStyle = "#f87171";
    ctx.beginPath();
    ctx.moveTo(left, y(thr));
    ctx.lineTo(left + pw, y(thr));
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#f87171";
    ctx.fillText(`threshold ${thr.toFixed(1)}`, left + 4 * dpr, y(thr) - 4 * dpr);
  }
}
