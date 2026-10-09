// Coverage maths for the MMN map: natural-neighbour / IDW grids, jet colours,
// licence site parsing and licensed-vs-measured comparison (thesis §4.3.5).
import { inverseDistance, jet, makeGrid, naturalNeighbour } from "../src/apps/map/interp.js";
import { bearingDeg, compareCoverage, compassName, parseSite } from "../src/apps/map/licence.js";
import { haversineM } from "../src/sampling/spatial.js";

declare const process: { exit(code: number): never };
let failures = 0;
function check(name: string, cond: boolean, detail?: any) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  if (!cond) failures++;
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ── licence site formats ──
const site = { lat: -(33 + 27 / 60 + 55 / 3600), lon: 18 + 42 / 60 + 2 / 3600 };
const a = parseSite("18E42 02 / 33S27 55");
check("ICASA licence format (Table 4.1)", !!a && near(a.lat, site.lat, 1e-6) && near(a.lon, site.lon, 1e-6), a);
const b = parseSite(`33°27'55"S 18°42'02"E`);
check("degrees-minutes-seconds", !!b && near(b.lat, site.lat, 1e-6) && near(b.lon, site.lon, 1e-6), b);
const c = parseSite("-33.465278, 18.700556");
check("decimal pair", !!c && near(c.lat, -33.465278, 1e-9) && near(c.lon, 18.700556, 1e-9), c);
const d = parseSite("33.465278 S 18.700556 E");
check("decimal with hemispheres", !!d && near(d.lat, -33.465278, 1e-9) && near(d.lon, 18.700556, 1e-9), d);
check("rubbish rejected", parseSite("somewhere") === null && parseSite("") === null);

// ── bearings ──
check("bearing north", near(bearingDeg(site, { lat: site.lat + 0.1, lon: site.lon }), 0, 0.01));
check("bearing east", near(bearingDeg(site, { lat: site.lat, lon: site.lon + 0.1 }), 90, 0.1));
check("compass names", compassName(0) === "N" && compassName(310) === "NW" && compassName(350) === "N" && compassName(202) === "SSW");

// ── licensed vs measured ──
const mPerDegLat = haversineM(0, 0, 1, 0);
const at = (dN: number, dE: number) => ({ lat: site.lat + dN / mPerDegLat, lon: site.lon + dE / (mPerDegLat * Math.cos((site.lat * Math.PI) / 180)) });
const pins = [
  { ...at(12_000, 0), above: true },
  { ...at(5_000, 0), above: true },
  { ...at(-8_000, 0), above: true },
  { ...at(0, 15_000), above: false },
];
const cmp = compareCoverage(site, 10_000, pins);
check("furthest above-threshold pin 12 km north", near(cmp.furthestM, 12_000, 30) && compassName(cmp.furthestBearing) === "N", cmp);
check("reach +20 % over the licensed radius", near(cmp.reachDelta, 0.2, 0.01), cmp.reachDelta);
check("one pin beyond the licensed radius", cmp.beyondCount === 1 && cmp.aboveCount === 3, cmp);
check("east driven but nothing above threshold there", cmp.driven.filter(Boolean).length === 3, cmp.driven);
check("area over driven directions: (144+64+0)/(3·100) − 1 = −30.7 %", near(cmp.areaDelta, 208 / 300 - 1, 0.01), cmp.areaDelta);

// ── grids ──
const pts = [
  { x: 0, y: 0, v: -40 },
  { x: 100, y: 0, v: -60 },
];
const g = makeGrid(pts, 60, 100);
const nn = naturalNeighbour(pts, g, 80);
const idw = inverseDistance(pts, g, 80);
const at2 = (grid: typeof nn, x: number, y: number) => grid.values[Math.floor((y - grid.y0) / grid.cell) * grid.nx + Math.floor((x - grid.x0) / grid.cell)];
check("NN: next to A ≈ A", near(at2(nn, 1, 1), -40, 1.5), at2(nn, 1, 1));
check("NN: next to B ≈ B", near(at2(nn, 99, 1), -60, 1.5), at2(nn, 99, 1));
check("NN: midway ≈ mean", near(at2(nn, 50, 0.5), -50, 3), at2(nn, 50, 0.5));
const finite = Array.from(nn.values).filter(Number.isFinite);
check("NN: never outside the data range", finite.every((v) => v >= -60.0001 && v <= -39.9999), [Math.min(...finite), Math.max(...finite)]);
check("NN: empty beyond reach", Number.isNaN(at2(nn, 50, 95)), at2(nn, 50, 95));
check("IDW: midway ≈ mean, beyond reach empty", near(at2(idw, 50, 0.5), -50, 1.5) && Number.isNaN(at2(idw, -90, 0)), [at2(idw, 50, 0.5), at2(idw, -90, 0)]);

// Natural neighbour reproduces a linear field away from the edges (a property IDW lacks).
const lin: { x: number; y: number; v: number }[] = [];
for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) lin.push({ x: i * 50 + (j % 2) * 7, y: j * 50, v: -80 + (i * 50 + (j % 2) * 7) * 0.05 });
const lg = makeGrid(lin, 60, 0);
const lnn = naturalNeighbour(lin, lg, 200);
const errs: number[] = [];
for (let y = 150; y <= 350; y += 20) for (let x = 150; x <= 350; x += 20) errs.push(Math.abs(at2(lnn, x, y) - (-80 + x * 0.05)));
check("NN: linear field reproduced within 0.6 dB in the interior", Math.max(...errs) < 0.6, Math.max(...errs));

// ── jet ──
check("jet ends: dark blue → dark red", jet(0).join() === "0,0,128" && jet(1).join() === "128,0,0", [jet(0), jet(1)]);
check("jet middle is green-ish", jet(0.5)[1] === 255, jet(0.5));

console.log(failures ? `\n${failures} failed` : "\nAll coverage tests passed.");
process.exit(failures ? 1 : 0);
