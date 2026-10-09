// GPS service shared by the receiver and the MMN monitor.
//
// Two sources, same output:
//  • "phone"  – the device's own GPS through the Geolocation API (phones, tablets,
//               laptops with location services).
//  • "gmouse" – a USB G-MOUSE (or any NMEA 0183 serial GPS) through Web Serial on
//               Chrome/Edge desktop. Baud rate is auto-detected (9600, 4800, 38400, 115200).
//
// Listen for "change" events and read `status`.

import { FIX_QUALITY_LABELS, LineSplitter, NmeaFix, applyNmea } from "./nmea.js";

export type GpsSource = "off" | "phone" | "gmouse";

export const GPS_SOURCE_LABELS: Map<GpsSource, string> = new Map([
  ["off", "Off"],
  ["phone", "Phone / device GPS"],
  ["gmouse", "G-MOUSE USB GPS (NMEA)"],
]);

export type GpsFix = {
  source: "phone" | "gmouse";
  lat: number;
  lon: number;
  altM?: number;
  speedKmh?: number;
  headingDeg?: number;
  /** Horizontal accuracy in metres (phone), or HDOP-derived estimate (G-MOUSE). */
  accuracyM?: number;
  hdop?: number;
  satellites?: number;
  satellitesInView?: number;
  fixLabel: string;
  /** Epoch ms when the fix was received. */
  timestamp: number;
  utcTime?: string;
  nmea?: string;
};

export type GpsState = "off" | "connecting" | "searching" | "fix" | "error";

export type GpsStatus = {
  source: GpsSource;
  state: GpsState;
  message?: string;
  fix?: GpsFix;
  /** Serial baud rate in use (G-MOUSE). */
  baud?: number;
  /** Satellites in view while still searching (G-MOUSE). */
  satellitesInView?: number;
};

const BAUD_RATES = [9600, 4800, 38400, 115200];
const BAUD_PROBE_MS = 2500;
const STORAGE_KEY = "webrx.gps.source";
/** A fix older than this is reported as lost. */
const STALE_MS = 15000;

type SerialPortLike = {
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
};

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as any).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function hasWebSerial(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export function hasGeolocation(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

/** Default source: phone GPS on mobile, G-MOUSE on desktop when Web Serial exists. */
export function defaultGpsSource(): GpsSource {
  if (isMobileDevice()) return "phone";
  return hasWebSerial() ? "gmouse" : "phone";
}

export class GpsService extends EventTarget {
  private _status: GpsStatus = { source: "off", state: "off" };
  private watchId: number | null = null;
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private session = 0;
  private staleTimer: number | null = null;

  get status(): GpsStatus {
    return this._status;
  }

  get fix(): GpsFix | undefined {
    return this._status.fix;
  }

  /** The source saved from the last session, or the platform default. */
  savedSource(): GpsSource {
    try {
      const s = localStorage.getItem(STORAGE_KEY) as GpsSource | null;
      if (s === "off" || s === "phone" || s === "gmouse") return s;
    } catch (_) {}
    return defaultGpsSource();
  }

  /**
   * Starts the given source. For "gmouse" this must be called from a user
   * gesture the first time (the browser shows a port picker); afterwards a
   * previously granted port is reopened automatically.
   */
  async start(source: GpsSource, opts?: { pickPort?: boolean }): Promise<void> {
    await this.stop();
    try {
      localStorage.setItem(STORAGE_KEY, source);
    } catch (_) {}
    if (source === "off") return;
    if (source === "phone") return this.startPhone();
    // The serial read loop runs until stop(); resolve once the port is chosen and opening.
    let opened!: () => void;
    const ready = new Promise<void>((r) => (opened = r));
    this.startGMouse(opts?.pickPort ?? true, opened)
      .catch((e) => this.update({ source: "gmouse", state: "error", message: String(e) }))
      .finally(() => opened());
    return ready;
  }

  /** True when the user picked a source in an earlier session. */
  hasSavedChoice(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch (_) {
      return false;
    }
  }

  /** Reopens the saved source without prompting (phone, or a granted G-MOUSE port). */
  async resume(): Promise<void> {
    const source = this.savedSource();
    if (source === "phone") return this.start("phone");
    if (source === "gmouse" && hasWebSerial()) {
      const ports = await (navigator as any).serial.getPorts();
      if (ports.length > 0) return this.start("gmouse", { pickPort: false });
      this.update({ source: "gmouse", state: "off", message: "Press “Connect GPS” to pick the G-MOUSE port" });
    }
  }

  async stop(): Promise<void> {
    ++this.session;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.reader) {
      try {
        await this.reader.cancel();
        this.reader.releaseLock();
      } catch (_) {}
      this.reader = null;
    }
    if (this.port) {
      try {
        await this.port.close();
      } catch (_) {}
      this.port = null;
    }
    if (this.staleTimer !== null) clearInterval(this.staleTimer);
    this.staleTimer = null;
    this.update({ source: "off", state: "off" });
  }

  // ── phone ─────────────────────────────────────────────────

  private startPhone() {
    if (!hasGeolocation()) {
      this.update({ source: "phone", state: "error", message: "This browser has no Geolocation API" });
      return;
    }
    this.update({ source: "phone", state: "searching", message: "Waiting for location permission / first fix" });
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords;
        this.setFix({
          source: "phone",
          lat: c.latitude,
          lon: c.longitude,
          altM: c.altitude ?? undefined,
          speedKmh: c.speed !== null && c.speed !== undefined ? c.speed * 3.6 : undefined,
          headingDeg: c.heading !== null && !Number.isNaN(c.heading) ? c.heading ?? undefined : undefined,
          accuracyM: c.accuracy,
          fixLabel: c.accuracy <= 20 ? "GPS" : c.accuracy <= 100 ? "Approximate" : "Coarse",
          timestamp: pos.timestamp || Date.now(),
        });
      },
      (err) => {
        // Phones report brief "unavailable"/timeout blips between good fixes;
        // keep a recent fix instead of flipping to an error. The stale-fix
        // watchdog reports a real loss after STALE_MS.
        const fix = this._status.fix;
        if (err.code !== 1 && fix && Date.now() - fix.timestamp < STALE_MS) return;
        const msg =
          err.code === 1
            ? "Location permission denied — allow it in the browser's site settings"
            : err.code === 2
              ? "Position unavailable — turn on location services"
              : "Timed out waiting for a fix — move to open sky";
        const state: GpsState = err.code === 1 ? "error" : "searching";
        if (this._status.state === state && this._status.message === msg) return;
        this.update({ ...this._status, source: "phone", state, message: msg });
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 }
    );
    this.watchStale();
  }

  // ── G-MOUSE (Web Serial NMEA) ─────────────────────────────

  private async startGMouse(pickPort: boolean, onPortReady: () => void) {
    if (!hasWebSerial()) {
      this.update({
        source: "gmouse",
        state: "error",
        message: "Web Serial isn't available here — use Chrome or Edge on a computer, or choose phone GPS",
      });
      return;
    }
    const serial = (navigator as any).serial;
    const session = this.session;
    this.update({ source: "gmouse", state: "connecting", message: "Choose the G-MOUSE serial port" });
    let port: SerialPortLike;
    try {
      const granted: SerialPortLike[] = await serial.getPorts();
      port = !pickPort && granted.length > 0 ? granted[0] : await serial.requestPort();
    } catch (e) {
      this.update({ source: "gmouse", state: "off", message: "No serial port selected" });
      return;
    }
    if (session !== this.session) return;
    this.port = port;
    this.watchStale();
    onPortReady();

    for (let i = 0; session === this.session; i = (i + 1) % BAUD_RATES.length) {
      const baud = BAUD_RATES[i];
      this.update({ ...this._status, source: "gmouse", state: this._status.fix ? "fix" : "connecting", baud, message: `Listening at ${baud} baud…` });
      const result = await this.readPort(port, baud, session);
      if (result === "stopped") return;
      if (result === "error") {
        this.update({ source: "gmouse", state: "error", message: "The GPS was disconnected or the port is in use by another program" });
        return;
      }
      // "silent": wrong baud rate, try the next one.
    }
  }

  /** Reads NMEA until stopped; returns "silent" if nothing valid arrives within the probe window. */
  private async readPort(
    port: SerialPortLike,
    baud: number,
    session: number
  ): Promise<"stopped" | "silent" | "error"> {
    try {
      await port.open({ baudRate: baud });
    } catch (e) {
      return "error";
    }
    const fix: NmeaFix = {};
    const lines = new LineSplitter();
    const decoder = new TextDecoder();
    let valid = 0;
    const reader = port.readable!.getReader();
    this.reader = reader;
    let probeTimer: number | undefined;
    const probe = new Promise<null>((resolve) => {
      probeTimer = setTimeout(() => resolve(null), BAUD_PROBE_MS) as unknown as number;
    });
    // Keep one read outstanding so racing it against the probe timer never drops bytes.
    let pending: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;
    try {
      while (session === this.session) {
        if (!pending) pending = reader.read();
        const r = valid === 0 ? await Promise.race([pending, probe]) : await pending;
        if (r === null) {
          // Probe window elapsed without a single valid sentence: wrong baud rate.
          await reader.cancel().catch(() => {});
          try {
            reader.releaseLock();
          } catch (_) {}
          this.reader = null;
          await port.close().catch(() => {});
          return "silent";
        }
        pending = null;
        if (r.done) break;
        for (const line of lines.push(decoder.decode(r.value, { stream: true }))) {
          const type = applyNmea(fix, line);
          if (!type) continue;
          ++valid;
          this.onNmea(fix, baud);
        }
      }
    } catch (e) {
      if (session !== this.session) return "stopped";
      return "error";
    } finally {
      clearTimeout(probeTimer);
      try {
        reader.releaseLock();
      } catch (_) {}
    }
    return session === this.session ? "error" : "stopped";
  }

  private onNmea(fix: NmeaFix, baud: number) {
    const q = fix.fixQuality ?? 0;
    if (q > 0 && fix.lat !== undefined && fix.lon !== undefined) {
      this.setFix(
        {
          source: "gmouse",
          lat: fix.lat,
          lon: fix.lon,
          altM: fix.alt,
          speedKmh: fix.speedKmh,
          headingDeg: fix.headingDeg,
          hdop: fix.hdop,
          // Rough horizontal accuracy: HDOP × ~2.5 m UERE for a consumer receiver.
          accuracyM: fix.hdop !== undefined ? fix.hdop * 2.5 : undefined,
          satellites: fix.satellites,
          satellitesInView: fix.satellitesInView,
          fixLabel: `${FIX_QUALITY_LABELS[q] ?? "Fix"}${fix.fixMode && fix.fixMode !== "No fix" ? " " + fix.fixMode : ""}`,
          timestamp: Date.now(),
          utcTime: fix.utcTime,
          nmea: fix.lastSentence,
        },
        baud
      );
    } else {
      this.update({
        source: "gmouse",
        state: "searching",
        baud,
        satellitesInView: fix.satellitesInView,
        fix: this._status.fix,
        message: `Receiving NMEA at ${baud} baud — acquiring satellites${fix.satellitesInView ? ` (${fix.satellitesInView} in view)` : ""}`,
      });
    }
  }

  // ── shared ────────────────────────────────────────────────

  private setFix(fix: GpsFix, baud?: number) {
    this.update({ source: fix.source, state: "fix", fix, baud, satellitesInView: fix.satellitesInView });
  }

  private watchStale() {
    if (this.staleTimer !== null) clearInterval(this.staleTimer);
    this.staleTimer = setInterval(() => {
      const s = this._status;
      if (s.state === "fix" && s.fix && Date.now() - s.fix.timestamp > STALE_MS) {
        this.update({ ...s, state: "searching", message: "Fix lost — last position kept" });
      }
    }, 3000) as unknown as number;
  }

  private update(status: GpsStatus) {
    this._status = status;
    this.dispatchEvent(new Event("change"));
  }
}

/** One GPS service per page. */
export const gps = new GpsService();

/** Formats a coordinate pair for display. */
export function formatLatLon(fix: { lat: number; lon: number }, digits = 5): string {
  const ns = fix.lat >= 0 ? "N" : "S";
  const ew = fix.lon >= 0 ? "E" : "W";
  return `${Math.abs(fix.lat).toFixed(digits)}° ${ns}, ${Math.abs(fix.lon).toFixed(digits)}° ${ew}`;
}
