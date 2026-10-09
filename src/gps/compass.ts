// Phone compass (magnetometer) for the GPS panel and the map.
//
// Android Chrome: `deviceorientationabsolute` gives orientation relative to
// magnetic north. iOS Safari: `deviceorientation` with `webkitCompassHeading`
// (needs a permission tap). Heading is tilt-compensated, corrected for screen
// rotation and smoothed. Desktops without a sensor report "unavailable".

export type CompassState = "off" | "starting" | "on" | "unavailable" | "denied";

export type CompassStatus = {
  state: CompassState;
  /** Degrees clockwise from magnetic north that the top of the screen points to. */
  heading?: number;
  /** Accuracy in degrees when the platform reports it (iOS). */
  accuracy?: number;
  /** "absolute" (Android), "ios" or "relative" (no north reference). */
  source?: "absolute" | "ios" | "relative";
  /** Epoch ms of the last reading. */
  timestamp?: number;
  message?: string;
};

const STORAGE_KEY = "webrx.compass.enabled";
/** Readings slower than this are treated as "no sensor". */
const NO_DATA_MS = 3000;

/** 16-point compass name for a heading in degrees. */
export function cardinal(deg: number): string {
  const names = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return names[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/**
 * Compass heading from W3C device orientation angles (alpha, beta, gamma in
 * degrees), tilt-compensated: the direction the top of the device points,
 * clockwise from north. Formula from the DeviceOrientation spec examples.
 */
export function headingFromOrientation(alpha: number, beta: number, gamma: number): number {
  const rad = Math.PI / 180;
  const x = beta * rad;
  const y = gamma * rad;
  const z = alpha * rad;
  const cX = Math.cos(x);
  const cY = Math.cos(y);
  const cZ = Math.cos(z);
  const sX = Math.sin(x);
  const sY = Math.sin(y);
  const sZ = Math.sin(z);
  const vx = -cZ * sY - sZ * sX * cY;
  const vy = -sZ * sY + cZ * sX * cY;
  let h = Math.atan2(vx, vy);
  if (h < 0) h += 2 * Math.PI;
  // The tilt formula gives the direction the back of the phone faces, which is
  // what you want when holding it upright. It degenerates when the phone lies
  // flat; there the top edge points to 360 - alpha (both agree in between).
  const flat = Math.abs(beta) < 25 && Math.abs(gamma) < 25;
  const deg = flat ? 360 - alpha : (h * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

function screenAngle(): number {
  if (typeof screen !== "undefined" && screen.orientation && typeof screen.orientation.angle === "number") {
    return screen.orientation.angle;
  }
  const w = typeof window !== "undefined" ? (window as any).orientation : 0;
  return typeof w === "number" ? w : 0;
}

export function hasCompassApi(): boolean {
  return typeof window !== "undefined" && ("ondeviceorientationabsolute" in window || "DeviceOrientationEvent" in window);
}

export class CompassService extends EventTarget {
  private _status: CompassStatus = { state: "off" };
  private sx = 0;
  private sy = 0;
  private primed = false;
  private lastEmit = 0;
  private watchdog: number | null = null;
  private onAbsolute = (e: Event) => this.handle(e as DeviceOrientationEvent, "absolute");
  private onRelative = (e: Event) => this.handle(e as DeviceOrientationEvent, "relative");

  get status(): CompassStatus {
    return this._status;
  }

  /** Whether the user switched the compass on before (it starts automatically then). */
  wasEnabled(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "0";
    } catch (_) {
      return true;
    }
  }

  /** True on iOS, where a tap is needed before the compass can start. */
  needsPermissionTap(): boolean {
    const D = (window as any).DeviceOrientationEvent;
    return !!D && typeof D.requestPermission === "function";
  }

  /** Starts the compass. On iOS call this from a tap. */
  async start(): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (_) {}
    if (!hasCompassApi()) {
      this.update({ state: "unavailable", message: "No compass in this browser" });
      return;
    }
    const D = (window as any).DeviceOrientationEvent;
    if (D && typeof D.requestPermission === "function") {
      try {
        const r = await D.requestPermission();
        if (r !== "granted") {
          this.update({ state: "denied", message: "Motion & orientation access was not allowed" });
          return;
        }
      } catch (e) {
        this.update({ state: "denied", message: "Tap the compass button to allow motion & orientation access" });
        return;
      }
    }
    this.stopListening();
    this.primed = false;
    this.update({ state: "starting", message: "Waiting for the compass sensor…" });
    if ("ondeviceorientationabsolute" in window) {
      window.addEventListener("deviceorientationabsolute", this.onAbsolute);
    }
    window.addEventListener("deviceorientation", this.onRelative);
    this.watchdog = setTimeout(() => {
      if (this._status.state === "starting") {
        this.update({ state: "unavailable", message: "No compass sensor on this device" });
      }
    }, NO_DATA_MS) as unknown as number;
  }

  stop() {
    try {
      localStorage.setItem(STORAGE_KEY, "0");
    } catch (_) {}
    this.stopListening();
    this.update({ state: "off" });
  }

  private stopListening() {
    window.removeEventListener("deviceorientationabsolute", this.onAbsolute);
    window.removeEventListener("deviceorientation", this.onRelative);
    if (this.watchdog !== null) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private handle(e: DeviceOrientationEvent, kind: "absolute" | "relative") {
    const ios = (e as any).webkitCompassHeading;
    let heading: number | undefined;
    let source: CompassStatus["source"];
    let accuracy: number | undefined;
    if (typeof ios === "number" && !Number.isNaN(ios)) {
      heading = (ios + screenAngle()) % 360; // clockwise from north, relative to the device's top edge
      source = "ios";
      const acc = (e as any).webkitCompassAccuracy;
      if (typeof acc === "number" && acc >= 0) accuracy = acc;
    } else if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
      // A relative event without a north reference is useless as a compass;
      // prefer the absolute stream when the browser has one.
      if (kind === "relative" && !e.absolute && "ondeviceorientationabsolute" in window) return;
      heading = (headingFromOrientation(e.alpha, e.beta, e.gamma) + screenAngle()) % 360;
      source = kind === "absolute" || e.absolute ? "absolute" : "relative";
    } else {
      return;
    }
    // Circular exponential smoothing (avoids the 359°→0° jump).
    const r = (heading * Math.PI) / 180;
    const k = this.primed ? 0.25 : 1;
    this.sx = this.sx * (1 - k) + Math.sin(r) * k;
    this.sy = this.sy * (1 - k) + Math.cos(r) * k;
    this.primed = true;
    const smooth = ((Math.atan2(this.sx, this.sy) * 180) / Math.PI + 360) % 360;
    const now = Date.now();
    if (this.watchdog !== null) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
    if (now - this.lastEmit < 80 && this._status.state === "on") {
      this._status = { ...this._status, heading: smooth, timestamp: now };
      return;
    }
    this.lastEmit = now;
    this.update({
      state: "on",
      heading: smooth,
      accuracy,
      source,
      timestamp: now,
      message: source === "relative" ? "No north reference: heading is relative" : undefined,
    });
  }

  private update(s: CompassStatus) {
    this._status = s;
    this.dispatchEvent(new Event("change"));
  }
}

/** One compass per page. */
export const compass = new CompassService();

/** "247° WSW" style text. */
export function formatHeading(deg: number | undefined): string {
  if (deg === undefined || Number.isNaN(deg)) return "—";
  return `${Math.round(deg) % 360}° ${cardinal(deg)}`;
}
