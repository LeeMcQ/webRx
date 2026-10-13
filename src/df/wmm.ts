// World Magnetic Model 2025 (offline). Declination for converting the phone's
// magnetic heading to true north. Standard WMM algorithm (NOAA tech report):
// geodetic → geocentric, Schmidt semi-normalised associated Legendre functions.
import { WMM2025 } from "./wmm-coef.js";

const N = 12, EPOCH = 2025.0, A = 6371.2;
const g: number[][] = [], h: number[][] = [], gd: number[][] = [], hd: number[][] = [];
for (let n = 0; n <= N; ++n) { g.push(new Array(N + 1).fill(0)); h.push(new Array(N + 1).fill(0)); gd.push(new Array(N + 1).fill(0)); hd.push(new Array(N + 1).fill(0)); }
for (const [n, m, G, H, GD, HD] of WMM2025) { g[n][m] = G; h[n][m] = H; gd[n][m] = GD; hd[n][m] = HD; }

export function decimalYear(d: Date = new Date()): number {
  const y = d.getUTCFullYear();
  const s = Date.UTC(y, 0, 1), e = Date.UTC(y + 1, 0, 1);
  return y + (d.getTime() - s) / (e - s);
}

export type MagField = { declination: number; inclination: number; H: number; X: number; Y: number; Z: number; F: number };

/** Magnetic field at geodetic lat/lon (deg), height above ellipsoid (km), decimal year. */
export function magField(latDeg: number, lonDeg: number, altKm = 0, year = decimalYear()): MagField {
  const dt = year - EPOCH;
  const rad = Math.PI / 180;
  const a = 6378.137, f = 1 / 298.257223563, e2 = f * (2 - f);
  const phi = latDeg * rad, lam = lonDeg * rad;
  const Rc = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const p = (Rc + altKm) * Math.cos(phi);
  const z = (Rc * (1 - e2) + altKm) * Math.sin(phi);
  const r = Math.hypot(p, z);
  const phic = Math.asin(z / r);
  const t = Math.sin(phic), u = Math.cos(phic);
  // Schmidt semi-normalised P[n][m](sin phic) and derivative wrt phic
  const P: number[][] = [], dP: number[][] = [];
  for (let n = 0; n <= N; ++n) { P.push(new Array(N + 1).fill(0)); dP.push(new Array(N + 1).fill(0)); }
  P[0][0] = 1; dP[0][0] = 0;
  for (let n = 1; n <= N; ++n) {
    for (let m = 0; m <= n; ++m) {
      if (n === m) {
        const k = n === 1 ? 1 : Math.sqrt((2 * n - 1) / (2 * n));
        P[n][m] = k * u * P[n - 1][m - 1];
        dP[n][m] = k * (u * dP[n - 1][m - 1] - t * P[n - 1][m - 1]);
      } else {
        const k1 = (2 * n - 1) / Math.sqrt(n * n - m * m);
        const k2 = n - 1 >= m ? Math.sqrt(((n - 1) ** 2 - m * m) / (n * n - m * m)) : 0;
        const p2 = n - 2 >= m ? P[n - 2][m] : 0, dp2 = n - 2 >= m ? dP[n - 2][m] : 0;
        P[n][m] = k1 * t * P[n - 1][m] - k2 * p2;
        dP[n][m] = k1 * (t * dP[n - 1][m] + u * P[n - 1][m]) - k2 * dp2;
      }
    }
  }
  let Xc = 0, Yc = 0, Zc = 0;
  for (let n = 1; n <= N; ++n) {
    const ar = (A / r) ** (n + 2);
    for (let m = 0; m <= n; ++m) {
      const G = g[n][m] + dt * gd[n][m], H = h[n][m] + dt * hd[n][m];
      const cm = Math.cos(m * lam), sm = Math.sin(m * lam);
      Xc += -ar * (G * cm + H * sm) * dP[n][m];
      Yc += (u !== 0 ? ar * m * (G * sm - H * cm) * P[n][m] / u : 0);
      Zc += -(n + 1) * ar * (G * cm + H * sm) * P[n][m];
    }
  }
  const psi = phic - phi;
  const X = Xc * Math.cos(psi) - Zc * Math.sin(psi);
  const Z = Xc * Math.sin(psi) + Zc * Math.cos(psi);
  const Y = Yc;
  const H = Math.hypot(X, Y);
  return { declination: Math.atan2(Y, X) / rad, inclination: Math.atan2(Z, H) / rad, H, X, Y, Z, F: Math.hypot(H, Z) };
}

export const declination = (lat: number, lon: number, altKm = 0, year?: number) => magField(lat, lon, altKm, year).declination;
