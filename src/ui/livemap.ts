// Live map for the MMN monitor: where you are, which way you face, where you
// have been, and what was measured along the way.
//
// • Position dot with an accuracy circle (phone GPS or G-MOUSE).
// • Heading cone from the phone's compass, or from GPS course while moving.
// • Track line of the route travelled, with distance.
// • Logged measurements as dots coloured by signal level (drive-test style).
// • Street and satellite base maps, follow mode, centre and clear buttons.

import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapFix = {
  lat: number;
  lon: number;
  accuracyM?: number;
  speedKmh?: number;
  courseDeg?: number;
  timestamp: number;
};

export type MapMeasurement = {
  lat: number;
  lon: number;
  level: number;
  label: string;
};

const TRACK_KEY = "webrx.map.track";
const MAX_TRACK = 5000;
/** Ignore jitter: only extend the track when we moved this far (metres). */
const MIN_STEP_M = 3;

function haversine(a: L.LatLngExpression, b: L.LatLngExpression): number {
  return L.latLng(a).distanceTo(L.latLng(b));
}

/** Level → colour, blue (weak) through green and yellow to red (strong). */
export function levelColor(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  const hue = 240 - x * 240;
  return `hsl(${hue}, 85%, ${45 + x * 10}%)`;
}

export class LiveMap {
  private map: L.Map;
  private dot: L.CircleMarker;
  private halo: L.Circle;
  private cone: L.Polygon;
  private track: L.Polyline;
  private points = L.layerGroup();
  private follow = true;
  private hasFix = false;
  private lastFix?: MapFix;
  private headingDeg?: number;
  private distanceM = 0;
  private trackPts: L.LatLng[] = [];
  private onStats?: (s: { distanceM: number; points: number; following: boolean }) => void;

  constructor(el: HTMLElement, opts?: { onStats?: (s: { distanceM: number; points: number; following: boolean }) => void }) {
    this.onStats = opts?.onStats;
    const street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Imagery &copy; Esri" }
    );
    // Default view: Western Cape until the first fix arrives.
    this.map = L.map(el, { zoomControl: true, attributionControl: true, layers: [street] }).setView([-33.46, 18.72], 9);
    L.control.layers({ Map: street, Satellite: satellite }, undefined, { position: "topright" }).addTo(this.map);
    L.control.scale({ metric: true, imperial: false }).addTo(this.map);

    this.track = L.polyline([], { color: "#22d3ee", weight: 4, opacity: 0.85 }).addTo(this.map);
    this.points.addTo(this.map);
    this.halo = L.circle([0, 0], { radius: 0, color: "#3b82f6", weight: 1, fillOpacity: 0.12, interactive: false });
    this.cone = L.polygon([], { color: "#fbbf24", weight: 1, fillColor: "#fbbf24", fillOpacity: 0.35, interactive: false });
    this.dot = L.circleMarker([0, 0], { radius: 7, color: "#fff", weight: 2, fillColor: "#3b82f6", fillOpacity: 1 });

    // Stop following when the user drags the map; the centre button resumes it.
    this.map.on("dragstart", () => {
      this.follow = false;
      this.emitStats();
    });
    this.map.on("zoomend", () => this.drawCone());
    this.restoreTrack();
    new ResizeObserver(() => this.map.invalidateSize()).observe(el);
  }

  /** New position from the GPS. */
  setFix(fix: MapFix) {
    const ll = L.latLng(fix.lat, fix.lon);
    this.lastFix = fix;
    if (!this.hasFix) {
      this.hasFix = true;
      this.halo.addTo(this.map);
      this.cone.addTo(this.map);
      this.dot.addTo(this.map);
      this.map.setView(ll, Math.max(this.map.getZoom(), 16));
    }
    this.dot.setLatLng(ll);
    this.halo.setLatLng(ll).setRadius(fix.accuracyM ?? 0);
    const last = this.trackPts[this.trackPts.length - 1];
    const step = last ? haversine(last, ll) : Infinity;
    // Don't let a poor fix (large accuracy circle) draw zig-zags while standing still.
    const threshold = Math.max(MIN_STEP_M, Math.min(30, (fix.accuracyM ?? 0) * 0.5));
    if (!last || step >= threshold) {
      if (last && step < 2000) this.distanceM += step;
      this.trackPts.push(ll);
      if (this.trackPts.length > MAX_TRACK) this.trackPts.shift();
      this.track.setLatLngs(this.trackPts);
      this.saveTrack();
    }
    this.drawCone();
    if (this.follow) this.map.panTo(ll, { animate: true, duration: 0.5 });
    this.emitStats();
  }

  /** Compass heading in degrees (undefined when there is no compass). */
  setHeading(deg: number | undefined) {
    this.headingDeg = deg;
    this.drawCone();
  }

  /** Replaces the measurement dots (level normalised against the set's own range). */
  setMeasurements(list: MapMeasurement[]) {
    this.points.clearLayers();
    if (!list.length) return;
    let lo = Infinity;
    let hi = -Infinity;
    for (const m of list) {
      lo = Math.min(lo, m.level);
      hi = Math.max(hi, m.level);
    }
    // At least a 10 dB window, centred on the data, so a steady signal shows
    // mid-scale instead of looking "weak".
    const span = Math.max(10, hi - lo);
    const base = (lo + hi) / 2 - span / 2;
    for (const m of list) {
      L.circleMarker([m.lat, m.lon], {
        radius: 6,
        weight: 1,
        color: "#0b1220",
        fillColor: levelColor((m.level - base) / span),
        fillOpacity: 0.9,
      })
        .bindTooltip(m.label)
        .addTo(this.points);
    }
  }

  centre() {
    this.follow = true;
    if (this.lastFix) this.map.setView([this.lastFix.lat, this.lastFix.lon], Math.max(this.map.getZoom(), 16));
    this.emitStats();
  }

  clearTrack() {
    this.trackPts = this.lastFix ? [L.latLng(this.lastFix.lat, this.lastFix.lon)] : [];
    this.distanceM = 0;
    this.track.setLatLngs(this.trackPts);
    this.saveTrack();
    this.emitStats();
  }

  /** Fits the view to the track and measurement points. */
  fitAll() {
    const b = L.latLngBounds(this.trackPts);
    this.points.eachLayer((l) => b.extend((l as L.CircleMarker).getLatLng()));
    if (b.isValid()) {
      this.follow = false;
      this.map.fitBounds(b.pad(0.15));
      this.emitStats();
    }
  }

  invalidate() {
    this.map.invalidateSize();
  }

  private drawCone() {
    if (!this.lastFix) return;
    // Prefer the compass; fall back to GPS course when moving (> 3 km/h).
    let h = this.headingDeg;
    if (h === undefined && (this.lastFix.speedKmh ?? 0) > 3) h = this.lastFix.courseDeg;
    if (h === undefined) {
      this.cone.setLatLngs([]);
      return;
    }
    const centre = L.latLng(this.lastFix.lat, this.lastFix.lon);
    // About 70 px long at any zoom: metres per pixel at this latitude and zoom.
    const zoom = this.map.getZoom();
    const mPerPx = (40075016.686 * Math.cos((centre.lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
    const len = 70 * mPerPx;
    const pts = [centre];
    for (let a = -25; a <= 25; a += 10) pts.push(this.offset(centre, h + a, len));
    this.cone.setLatLngs(pts);
  }

  /** Point `dist` metres from `p` on bearing `bearingDeg`. */
  private offset(p: L.LatLng, bearingDeg: number, dist: number): L.LatLng {
    const R = 6371000;
    const br = (bearingDeg * Math.PI) / 180;
    const lat1 = (p.lat * Math.PI) / 180;
    const lon1 = (p.lng * Math.PI) / 180;
    const d = dist / R;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
    const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return L.latLng((lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI);
  }

  private saveTrack() {
    try {
      const recent = this.trackPts.slice(-MAX_TRACK).map((p) => [+p.lat.toFixed(6), +p.lng.toFixed(6)]);
      localStorage.setItem(TRACK_KEY, JSON.stringify({ d: Math.round(this.distanceM), p: recent }));
    } catch (_) {}
  }

  private restoreTrack() {
    try {
      const raw = JSON.parse(localStorage.getItem(TRACK_KEY) || "null");
      if (raw && Array.isArray(raw.p) && raw.p.length) {
        this.trackPts = raw.p.map((x: [number, number]) => L.latLng(x[0], x[1]));
        this.distanceM = Number(raw.d) || 0;
        this.track.setLatLngs(this.trackPts);
        this.map.fitBounds(L.latLngBounds(this.trackPts).pad(0.2), { maxZoom: 16 });
      }
    } catch (_) {}
  }

  private emitStats() {
    this.onStats?.({ distanceM: this.distanceM, points: this.trackPts.length, following: this.follow });
  }
}
