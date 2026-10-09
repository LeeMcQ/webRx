// One device provider for every supported SDR.
//
// Shows a single WebUSB picker that lists RTL-SDR dongles and HackRFs together
// (or only one family when the user has chosen it in Settings), reconnects to a
// previously authorised device without showing the picker again, and opens it
// with the right driver.

import { RadioError, RadioErrorType } from "@jtarrio/webrtlsdr/errors.js";
import { RTL2832U } from "@jtarrio/webrtlsdr/rtlsdr/rtl2832u.js";
import { RtlDevice, RtlDeviceProvider } from "@jtarrio/webrtlsdr/rtlsdr/rtldevice.js";
import { HACKRF_USB_FILTERS, HackRF, isHackRF } from "./hackrf.js";

export type SdrKind = "auto" | "rtlsdr" | "hackrf";

export const SDR_KIND_LABELS: Map<SdrKind, string> = new Map([
  ["auto", "Auto (RTL-SDR or HackRF)"],
  ["rtlsdr", "RTL-SDR"],
  ["hackrf", "HackRF One / HackRF Pro"],
]);

export const RTL_USB_FILTERS: USBDeviceFilter[] = [
  { vendorId: 0x0bda, productId: 0x2832 },
  { vendorId: 0x0bda, productId: 0x2838 },
];

export function isRtlSdr(device: USBDevice): boolean {
  return RTL_USB_FILTERS.some(
    (f) => f.vendorId === device.vendorId && f.productId === device.productId
  );
}

/** RTL2832U works at 225–300 ksps and 900 ksps–3.2 Msps; 2.4 Msps is the reliable maximum. */
export function clampRtlSampleRate(rate: number): number {
  if (rate > 2_880_000) return 2_400_000;
  if (rate > 300_000 && rate <= 900_000) return 1_024_000;
  if (rate <= 225_000) return 250_000;
  return rate;
}

export function filtersFor(kind: SdrKind): USBDeviceFilter[] {
  if (kind === "rtlsdr") return RTL_USB_FILTERS;
  if (kind === "hackrf") return HACKRF_USB_FILTERS;
  return [...RTL_USB_FILTERS, ...HACKRF_USB_FILTERS];
}

function matches(kind: SdrKind, device: USBDevice): boolean {
  if (kind === "rtlsdr") return isRtlSdr(device);
  if (kind === "hackrf") return isHackRF(device);
  return isRtlSdr(device) || isHackRF(device);
}

/** Description of the device that was opened. */
export type ConnectedSdr = {
  kind: "rtlsdr" | "hackrf";
  /** Human-readable model, e.g. "HackRF Pro" or "RTL2838UHIDIR". */
  name: string;
  /** Extra detail such as firmware version. */
  detail?: string;
  /** Frequency range the hardware can tune, in Hz. */
  minFrequency: number;
  maxFrequency: number;
  /** The open device. */
  device: RtlDevice;
};

export type SdrProviderOptions = {
  /** Which family to look for. Read every time a device is requested. */
  kind: () => SdrKind;
  /** Whether to enable the HackRF RF amplifier when opening it. */
  hackrfAmp?: () => boolean;
  /** Called after a device has been opened. */
  onConnect?: (sdr: ConnectedSdr) => void;
  /** Alternative WebUSB implementation (tests). */
  usb?: USB;
};

/** Provides an open RTL-SDR or HackRF, as an RtlDevice. */
export class SdrProvider implements RtlDeviceProvider {
  constructor(private options: SdrProviderOptions) {}

  private device?: USBDevice;
  private current?: ConnectedSdr;

  /** The device that was most recently opened, if any. */
  get connected(): ConnectedSdr | undefined {
    return this.current;
  }

  /** The underlying USB device, for matching `navigator.usb` disconnect events. */
  get usbDevice(): USBDevice | undefined {
    return this.device;
  }

  /** Forgets the remembered device so the picker is shown on the next start. */
  forgetDevice() {
    this.device = undefined;
  }

  async get(): Promise<RtlDevice> {
    const usb = this.options.usb ?? (typeof navigator !== "undefined" ? navigator.usb : undefined);
    if (!usb) {
      throw new RadioError(
        "This browser does not support WebUSB. Use Chrome or Edge on a computer or Android phone.",
        RadioErrorType.NoUsbSupport
      );
    }
    const kind = this.options.kind();

    if (this.device && !matches(kind, this.device)) this.device = undefined;
    if (!this.device) {
      // Reuse a device the user already granted, if exactly one is plugged in.
      const granted = (await usb.getDevices()).filter((d) => matches(kind, d));
      if (granted.length === 1) this.device = granted[0];
    }
    if (!this.device) {
      try {
        this.device = await usb.requestDevice({ filters: filtersFor(kind) });
      } catch (e) {
        throw new RadioError("No device was selected", RadioErrorType.NoDeviceSelected, {
          cause: e,
        });
      }
    }

    const dev = this.device;
    if (isHackRF(dev)) {
      const hackrf = await HackRF.open(dev, { ampEnabled: this.options.hackrfAmp?.() });
      this.current = {
        kind: "hackrf",
        name: hackrf.info.boardName,
        detail: hackrf.info.firmware ? `firmware ${hackrf.info.firmware}` : undefined,
        minFrequency: 1_000_000,
        maxFrequency: 6_000_000_000,
        device: hackrf,
      };
    } else {
      if (!dev.opened) await dev.open();
      const rtl = await RTL2832U.open(dev);
      // Keep requests inside the RTL2832U's usable ranges (e.g. after using a HackRF at 10 Msps).
      const setRate = rtl.setSampleRate.bind(rtl);
      rtl.setSampleRate = (rate: number) => setRate(clampRtlSampleRate(rate));
      this.current = {
        kind: "rtlsdr",
        name: dev.productName || "RTL-SDR",
        detail: dev.manufacturerName || undefined,
        minFrequency: 0,
        maxFrequency: 1_800_000_000,
        device: rtl,
      };
    }
    this.options.onConnect?.(this.current);
    return this.current.device;
  }
}
