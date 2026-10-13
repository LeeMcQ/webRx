// Douglas–Peucker track simplification in a local metric frame (PROPOSAL §11.4).
// Measurement points are never removed — callers pass only track-only fixes, or
// mark points to keep.

export interface P {
  lat: number;
  lon: number;
  keep?: boolean;
}

function toXY(p: P, lat0: number): [number, number] {
  const k = 111_319.49;
  return [p.lon * k * Math.cos((lat0 * Math.PI) / 180), p.lat * k];
}

function segDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Returns the indices kept (always first, last and any `keep` point). */
export function simplify(pts: P[], epsilonM: number): number[] {
  const n = pts.length;
  if (n <= 2) return pts.map((_, i) => i);
  const lat0 = pts[0].lat;
  const xy = pts.map((p) => toXY(p, lat0));
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  pts.forEach((p, i) => p.keep && (keep[i] = 1));
  // split at forced points, then DP each segment
  const anchors = [...keep.keys()].filter((i) => keep[i]);
  const stack: [number, number][] = [];
  for (let k = 1; k < anchors.length; k++) stack.push([anchors[k - 1], anchors[k]]);
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(xy[i], xy[a], xy[b]);
      if (d > best) (best = d), (bi = i);
    }
    if (best > epsilonM && bi > 0) {
      keep[bi] = 1;
      stack.push([a, bi], [bi, b]);
    }
  }
  return [...keep.keys()].filter((i) => keep[i]);
}
