// Gridded estimates between measured pins, for the coverage view.
//
// • Natural neighbour — the method the thesis uses for its predicted signal
//   strength maps (§2.4.3.2, Figs 4.7 and 4.9). Computed with the discrete
//   Sibson method (Park et al., 2006): every grid cell finds its nearest pin,
//   and spreads that pin's value over a circle reaching as far as that pin;
//   each cell's estimate is the mean of what lands on it. This equals
//   Sibson's natural-neighbour weights in the limit of a fine grid.
// • Inverse distance (p = 2) — a quicker, smoother alternative.
//
// Cells further than `reach` metres from every pin stay empty (NaN): the
// thesis notes interpolated values are calculated, not measured (§4.2.2.2).

export type XYV = { x: number; y: number; v: number };

export type Grid = {
  nx: number;
  ny: number;
  x0: number;
  y0: number;
  cell: number;
  /** Row-major, y0 row first; NaN = no estimate. */
  values: Float32Array;
};

export function makeGrid(pts: XYV[], targetCells: number, padM: number): Omit<Grid, "values"> {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  minX -= padM;
  maxX += padM;
  minY -= padM;
  maxY += padM;
  const cell = Math.max((maxX - minX) / targetCells, (maxY - minY) / targetCells, 1);
  return {
    nx: Math.max(1, Math.ceil((maxX - minX) / cell)),
    ny: Math.max(1, Math.ceil((maxY - minY) / cell)),
    x0: minX,
    y0: minY,
    cell,
  };
}

/** Buckets points in squares of `size` metres for neighbour searches. */
class Buckets {
  private map = new Map<string, number[]>();
  constructor(
    private pts: XYV[],
    readonly size: number
  ) {
    pts.forEach((p, i) => {
      const k = this.key(Math.floor(p.x / size), Math.floor(p.y / size));
      const list = this.map.get(k);
      if (list) list.push(i);
      else this.map.set(k, [i]);
    });
  }
  private key(i: number, j: number) {
    return `${i},${j}`;
  }
  /** Nearest point within maxD metres, or -1. */
  nearest(x: number, y: number, maxD: number): { i: number; d: number } {
    const bi = Math.floor(x / this.size);
    const bj = Math.floor(y / this.size);
    let best = -1;
    let bestD = Infinity;
    const rings = Math.ceil(maxD / this.size) + 1;
    for (let r = 0; r <= rings; r++) {
      // Every point in ring r is at least (r - 1) buckets away.
      if (best >= 0 && (r - 1) * this.size > bestD) break;
      for (let i = bi - r; i <= bi + r; i++)
        for (let j = bj - r; j <= bj + r; j++) {
          if (Math.max(Math.abs(i - bi), Math.abs(j - bj)) !== r) continue;
          const list = this.map.get(this.key(i, j));
          if (!list) continue;
          for (const k of list) {
            const d = Math.hypot(this.pts[k].x - x, this.pts[k].y - y);
            if (d < bestD) {
              bestD = d;
              best = k;
            }
          }
        }
    }
    return best >= 0 && bestD <= maxD ? { i: best, d: bestD } : { i: -1, d: Infinity };
  }
  within(x: number, y: number, r: number, fn: (k: number, d2: number) => void) {
    const n = Math.ceil(r / this.size);
    const bi = Math.floor(x / this.size);
    const bj = Math.floor(y / this.size);
    for (let i = bi - n; i <= bi + n; i++)
      for (let j = bj - n; j <= bj + n; j++) {
        const list = this.map.get(this.key(i, j));
        if (!list) continue;
        for (const k of list) {
          const d2 = (this.pts[k].x - x) ** 2 + (this.pts[k].y - y) ** 2;
          if (d2 <= r * r) fn(k, d2);
        }
      }
  }
}

/** Discrete Sibson natural-neighbour interpolation on a grid. */
export function naturalNeighbour(pts: XYV[], g: Omit<Grid, "values">, reachM: number): Grid {
  const { nx, ny, x0, y0, cell } = g;
  const n = nx * ny;
  const values = new Float32Array(n).fill(NaN);
  if (!pts.length) return { ...g, values };
  const buckets = new Buckets(pts, Math.max(cell * 4, reachM / 4));
  const nearest = new Int32Array(n).fill(-1);
  const radius = new Float32Array(n);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const r = buckets.nearest(x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell, reachM);
      nearest[c] = r.i;
      radius[c] = r.d;
    }
  const sum = new Float64Array(n);
  const cnt = new Float64Array(n);
  const maxR = 60; // cells — bounds the work on very coarse data
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const k = nearest[c];
      if (k < 0) continue;
      const v = pts[k].v;
      const rc = Math.min(maxR, radius[c] / cell);
      const r = Math.floor(rc);
      const r2 = rc * rc;
      for (let dj = -r; dj <= r; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= ny) continue;
        for (let di = -r; di <= r; di++) {
          if (di * di + dj * dj > r2) continue;
          const ii = i + di;
          if (ii < 0 || ii >= nx) continue;
          const cc = jj * nx + ii;
          sum[cc] += v;
          cnt[cc] += 1;
        }
      }
    }
  for (let c = 0; c < n; c++) if (nearest[c] >= 0 && cnt[c] > 0) values[c] = sum[c] / cnt[c];
  return { ...g, values };
}

/** Inverse-distance weighting (power 2) within reach. */
export function inverseDistance(pts: XYV[], g: Omit<Grid, "values">, reachM: number): Grid {
  const { nx, ny, x0, y0, cell } = g;
  const values = new Float32Array(nx * ny).fill(NaN);
  if (!pts.length) return { ...g, values };
  const buckets = new Buckets(pts, Math.max(cell * 2, reachM));
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let sw = 0;
      let sv = 0;
      buckets.within(x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell, reachM, (k, d2) => {
        const w = 1 / (d2 + 25);
        sw += w;
        sv += w * pts[k].v;
      });
      if (sw) values[j * nx + i] = sv / sw;
    }
  return { ...g, values };
}

/** MATLAB "jet" colour map (the thesis maps use it), t in 0…1 → [r, g, b] 0…255. */
export function jet(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  const c = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v)));
  return [c(1.5 - Math.abs(4 * x - 3)), c(1.5 - Math.abs(4 * x - 2)), c(1.5 - Math.abs(4 * x - 1))];
}

export function jetCss(t: number): string {
  const [r, g, b] = jet(t);
  return `rgb(${r},${g},${b})`;
}

/** CSS gradient of the jet map, for legends. */
export function jetGradient(): string {
  return `linear-gradient(90deg, ${[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((t) => jetCss(t)).join(", ")})`;
}
