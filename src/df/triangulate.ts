// Multi-station triangulation in a local East-North (ENU) plane.
// Each bearing i from station p_i with azimuth θ_i defines a line; the
// perpendicular distance of x from it is d_i = (x - p_i)·n_i with
// n_i = (cos θ, -sin θ) in (E, N). Weighted least squares (Stansfield-style):
// weight w_i = 1 / (r_i σ_i)², r_i = range from station to estimate (iterated),
// so angular error is converted into cross-track metres.

export type Bearing = { lat: number; lon: number; bearing: number; sigma: number; label?: string };
export type Ellipse = { a: number; b: number; angle: number }; // semi-axes (m) and major-axis azimuth (° from N)
export type Solution = { lat: number; lon: number; e: number; n: number; ellipse95: Ellipse; cov: [number, number, number]; rms: number; used: number; cockedHat: [number, number][] | null };

const R = 6371008.8;
const rad = Math.PI / 180;

export function toEnu(lat0: number, lon0: number, lat: number, lon: number): [number, number] {
  return [(lon - lon0) * rad * R * Math.cos(lat0 * rad), (lat - lat0) * rad * R];
}
export function fromEnu(lat0: number, lon0: number, e: number, n: number): [number, number] {
  return [lat0 + n / R / rad, lon0 + e / (R * Math.cos(lat0 * rad)) / rad];
}

/** Intersection of two bearing lines (ENU), or null if near-parallel / behind a station. */
export function intersect2(p1: [number, number], t1: number, p2: [number, number], t2: number): [number, number] | null {
  const d1 = [Math.sin(t1 * rad), Math.cos(t1 * rad)], d2 = [Math.sin(t2 * rad), Math.cos(t2 * rad)];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-6) return null;
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const s = (dx * d2[1] - dy * d2[0]) / den, u = (dx * d1[1] - dy * d1[0]) / den;
  if (s < 0 || u < 0) return null; // bearings point away from each other
  return [p1[0] + s * d1[0], p1[1] + s * d1[1]];
}

/** χ²(2 dof) 95 % = 5.991 → scale √5.991 on 1-σ axes. */
export function ellipseFromCov(cxx: number, cxy: number, cyy: number, k2 = 5.991): Ellipse {
  const tr = cxx + cyy, det = cxx * cyy - cxy * cxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc);
  // eigenvector of l1 in (E,N); azimuth from north
  const vx = Math.abs(cxy) > 1e-12 ? l1 - cyy : cxx >= cyy ? 1 : 0;
  const vy = Math.abs(cxy) > 1e-12 ? cxy : cxx >= cyy ? 0 : 1;
  const angle = ((Math.atan2(vx, vy) / rad) + 360) % 180;
  return { a: Math.sqrt(k2 * l1), b: Math.sqrt(k2 * l2), angle };
}

export function triangulate(list: Bearing[], iterations = 5): Solution | null {
  if (list.length < 2) return null;
  const lat0 = list.reduce((s, b) => s + b.lat, 0) / list.length, lon0 = list.reduce((s, b) => s + b.lon, 0) / list.length;
  const st = list.map((b) => ({ p: toEnu(lat0, lon0, b.lat, b.lon), th: b.bearing, sig: Math.max(0.5, b.sigma) * rad }));
  // initial: mean of pairwise intersections
  const pts: [number, number][] = [];
  for (let i = 0; i < st.length; ++i) for (let j = i + 1; j < st.length; ++j) { const x = intersect2(st[i].p, st[i].th, st[j].p, st[j].th); if (x) pts.push(x); }
  let x = pts.length ? [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length] : [0, 0];
  let A = [0, 0, 0], rms = 0;
  for (let it = 0; it < iterations; ++it) {
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
    for (const s of st) {
      const nE = Math.cos(s.th * rad), nN = -Math.sin(s.th * rad);
      const r = Math.max(10, Math.hypot(x[0] - s.p[0], x[1] - s.p[1]));
      const w = 1 / (r * s.sig) ** 2;
      const c = nE * s.p[0] + nN * s.p[1];
      a11 += w * nE * nE; a12 += w * nE * nN; a22 += w * nN * nN; b1 += w * nE * c; b2 += w * nN * c;
    }
    const det = a11 * a22 - a12 * a12;
    if (Math.abs(det) < 1e-30) return null;
    x = [(a22 * b1 - a12 * b2) / det, (a11 * b2 - a12 * b1) / det];
    A = [a22 / det, -a12 / det, a11 / det]; // covariance = (AᵀWA)⁻¹
  }
  let ss = 0;
  for (const s of st) { const d = (x[0] - s.p[0]) * Math.cos(s.th * rad) - (x[1] - s.p[1]) * Math.sin(s.th * rad); ss += d * d; }
  rms = Math.sqrt(ss / st.length);
  // with >2 bearings, inflate covariance by the reduced χ² if the bearings disagree more than their σ
  let scale = 1;
  if (st.length > 2) {
    let chi = 0;
    for (const s of st) { const r = Math.max(10, Math.hypot(x[0] - s.p[0], x[1] - s.p[1])); const d = (x[0] - s.p[0]) * Math.cos(s.th * rad) - (x[1] - s.p[1]) * Math.sin(s.th * rad); chi += (d / (r * s.sig)) ** 2; }
    scale = Math.max(1, chi / (st.length - 2));
  }
  const cov: [number, number, number] = [A[0] * scale, A[1] * scale, A[2] * scale];
  const [lat, lon] = fromEnu(lat0, lon0, x[0], x[1]);
  const cockedHat = st.length === 3 ? (() => {
    const q = [intersect2(st[0].p, st[0].th, st[1].p, st[1].th), intersect2(st[1].p, st[1].th, st[2].p, st[2].th), intersect2(st[0].p, st[0].th, st[2].p, st[2].th)];
    return q.every(Boolean) ? q.map((p) => fromEnu(lat0, lon0, p![0], p![1])) as [number, number][] : null;
  })() : null;
  return { lat, lon, e: x[0], n: x[1], ellipse95: ellipseFromCov(cov[0], cov[1], cov[2]), cov, rms, used: st.length, cockedHat };
}

/** Ellipse outline as lat/lon points for drawing. */
export function ellipsePoints(lat: number, lon: number, e: Ellipse, k = 48): [number, number][] {
  const out: [number, number][] = [];
  const th = e.angle * rad;
  for (let i = 0; i <= k; ++i) {
    const t = (i / k) * 2 * Math.PI;
    const u = e.a * Math.cos(t), v = e.b * Math.sin(t);
    // major axis along azimuth th: unit (sin th, cos th) in (E,N)
    const E = u * Math.sin(th) + v * Math.cos(th), N = u * Math.cos(th) - v * Math.sin(th);
    out.push(fromEnu(lat, lon, E, N));
  }
  return out;
}

/** Great-circle destination point. */
export function destination(lat: number, lon: number, bearing: number, dist: number): [number, number] {
  const d = dist / R, br = bearing * rad, p1 = lat * rad, l1 = lon * rad;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(br));
  const l2 = l1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 / rad, l2 / rad];
}
