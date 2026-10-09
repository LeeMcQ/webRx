// WebUSB driver for HackRF One and HackRF Pro (also Jawbreaker and rad1o).
//
// Protocol follows libhackrf (greatscottgadgets/hackrf, host/libhackrf/src/hackrf.c):
// vendor control requests for configuration, bulk IN endpoint 1 for samples,
// samples are interleaved signed 8-bit I/Q. HackRF Pro ("Praline") uses the
// same USB product ID as HackRF One and is told apart by its board ID.
//
// The class implements webrtlsdr's RtlDevice interface so the existing radio,
// demodulators and spectrum work unchanged: samples are handed over as unsigned
// 8-bit pairs exactly like an RTL-SDR (int8 XOR 0x80 → uint8).

import { RadioError, RadioErrorType } from "@jtarrio/webrtlsdr/errors.js";
import {
  DirectSampling,
  RtlDevice,
  SampleBlock,
} from "@jtarrio/webrtlsdr/rtlsdr/rtldevice.js";

export const HACKRF_VENDOR_ID = 0x1d50;
export const HACKRF_USB_FILTERS: USBDeviceFilter[] = [
  { vendorId: HACKRF_VENDOR_ID, productId: 0x6089 }, // HackRF One, HackRF Pro
  { vendorId: HACKRF_VENDOR_ID, productId: 0x604b }, // Jawbreaker
  { vendorId: HACKRF_VENDOR_ID, productId: 0xcc15 }, // rad1o
];

export function isHackRF(device: USBDevice): boolean {
  return HACKRF_USB_FILTERS.some(
    (f) => f.vendorId === device.vendorId && f.productId === device.productId
  );
}

/** libhackrf vendor request numbers. */
const enum Req {
  SET_TRANSCEIVER_MODE = 1,
  SAMPLE_RATE_SET = 6,
  BASEBAND_FILTER_BANDWIDTH_SET = 7,
  BOARD_ID_READ = 14,
  VERSION_STRING_READ = 15,
  SET_FREQ = 16,
  AMP_ENABLE = 17,
  SET_LNA_GAIN = 19,
  SET_VGA_GAIN = 20,
  ANTENNA_ENABLE = 23,
}

const enum Mode {
  OFF = 0,
  RECEIVE = 1,
}

const BOARD_NAMES: Record<number, string> = {
  0: "Jellybean",
  1: "Jawbreaker",
  2: "HackRF One",
  3: "rad1o",
  4: "HackRF One (r9)",
  5: "HackRF Pro",
};

/** MAX2837 baseband filter bandwidths (Hz), from libhackrf. */
const BASEBAND_FILTERS = [
  1750000, 2500000, 3500000, 5000000, 5500000, 6000000, 7000000, 8000000,
  9000000, 10000000, 12000000, 14000000, 15000000, 20000000, 24000000, 28000000,
];

/** Same selection rule as hackrf_compute_baseband_filter_bw(). */
export function computeBasebandFilterBw(bandwidthHz: number): number {
  let i = BASEBAND_FILTERS.findIndex((bw) => bw >= bandwidthHz);
  if (i < 0) i = BASEBAND_FILTERS.length - 1;
  if (i > 0 && BASEBAND_FILTERS[i] > bandwidthHz) i--;
  return BASEBAND_FILTERS[i];
}

/** Splits a 0–50 gain setting across the LNA (0–40 dB, 8 dB steps) and VGA (0–62 dB, 2 dB steps). */
export function splitGain(gain: number): { lna: number; vga: number } {
  const g = Math.max(0, Math.min(50, gain)) / 50;
  return {
    lna: Math.min(40, 8 * Math.round((g * 40) / 8)),
    vga: Math.min(62, 2 * Math.round((g * 62) / 2)),
  };
}

/** Sample rate as (freq_hz, divider) with a small integer divider, like hackrf_set_sample_rate(). */
export function sampleRateParams(rate: number): { freqHz: number; divider: number } {
  for (let d = 1; d < 32; ++d) {
    const f = rate * d;
    if (Math.abs(f - Math.round(f)) < 1e-6) return { freqHz: Math.round(f), divider: d };
  }
  return { freqHz: Math.round(rate), divider: 1 };
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** What to do when the HackRF can't be claimed, worded for the platform. */
export function claimHelp(): string {
  const common =
    "The HackRF is in use by something else. Close any other webRx tab (Receiver or Monitor) that is using it";
  return isAndroid()
    ? `${common}, and any SDR app on the phone. Unplug the HackRF, plug it back in, and if Android asks which app should open it, dismiss the prompt. Then press Start again.`
    : `${common}, and other SDR software (SDR#, SDR++, GQRX, hackrf_transfer). Then press Start again.`;
}

export const HACKRF_MIN_SAMPLE_RATE = 2_000_000;
export const HACKRF_MAX_SAMPLE_RATE = 20_000_000;
export const HACKRF_MIN_FREQUENCY = 1_000_000;
export const HACKRF_MAX_FREQUENCY = 6_000_000_000;

const TRANSFER_BYTES = 262144; // libhackrf TRANSFER_BUFFER_SIZE
const TRANSFERS_IN_FLIGHT = 4; // libhackrf TRANSFER_COUNT
const RX_ENDPOINT = 1;

export type HackRFInfo = {
  boardId: number;
  boardName: string;
  firmware: string;
};

export type HackRFOptions = {
  /** Enable the +14 dB RF amplifier. Off by default to protect the front end. */
  ampEnabled?: boolean;
};

/** A HackRF presented as an RtlDevice. */
export class HackRF implements RtlDevice {
  private constructor(
    private readonly device: USBDevice,
    readonly info: HackRFInfo
  ) {}

  private sampleRate = 2_048_000;
  private centerFrequency = 100_000_000;
  private ppm = 0;
  private gain: number | null = null;
  private biasTee = false;
  private ampEnabled = false;
  private directSampling = DirectSampling.Off;

  // Streaming state
  private streaming = false;
  private generation = 0;
  private inFlight = 0;
  private chunks: Uint8Array[] = [];
  private chunkOffset = 0;
  private buffered = 0;
  private waiters: { bytes: number; resolve: (b: Uint8Array) => void; reject: (e: any) => void }[] = [];
  private failure: any = null;
  /** Keep at most ~0.5 s of samples queued; older data is dropped to bound latency. */
  private maxBuffered = 0;

  /**
   * Opens the device and claims interface 0, recovering from the usual causes of
   * "Unable to claim interface": a session left over from an earlier attempt in
   * this page (reuse it, or close and reopen), or a stuck USB state (port reset).
   */
  static async claim(device: USBDevice): Promise<void> {
    const iface0 = () => device.configuration?.interfaces?.find((i) => i.interfaceNumber === 0);
    const attempt = async () => {
      if (!device.opened) await device.open();
      if (!device.configuration || device.configuration.configurationValue !== 1) {
        await device.selectConfiguration(1);
      }
      if (!iface0()?.claimed) await device.claimInterface(0);
    };
    let last: unknown;
    const recoveries: (() => Promise<void>)[] = [
      async () => {},
      async () => {
        if (device.opened) await device.close();
      },
      async () => {
        if (!device.opened) await device.open();
        await device.reset();
        await new Promise((r) => setTimeout(r, 300));
      },
    ];
    for (const recover of recoveries) {
      try {
        await recover();
      } catch (_) {}
      try {
        await attempt();
        return;
      } catch (e) {
        last = e;
      }
    }
    throw new RadioError(claimHelp(), RadioErrorType.UsbTransferError, { cause: last });
  }

  /** Opens and initialises a HackRF. */
  static async open(device: USBDevice, options?: HackRFOptions): Promise<HackRF> {
    await HackRF.claim(device);
    const boardId = await HackRF.readByte(device, Req.BOARD_ID_READ);
    const firmware = await HackRF.readString(device, Req.VERSION_STRING_READ);
    const info: HackRFInfo = {
      boardId,
      boardName: BOARD_NAMES[boardId] ?? (device.productName || "HackRF"),
      firmware,
    };
    const hackrf = new HackRF(device, info);
    hackrf.ampEnabled = options?.ampEnabled === true;
    await hackrf.setMode(Mode.OFF);
    await hackrf.setSampleRate(hackrf.sampleRate);
    await hackrf.applyGain();
    await hackrf.ctrlOut(Req.AMP_ENABLE, hackrf.ampEnabled ? 1 : 0, 0);
    await hackrf.ctrlOut(Req.ANTENNA_ENABLE, 0, 0);
    return hackrf;
  }

  // ── RtlDevice ──────────────────────────────────────────────

  async setSampleRate(rate: number): Promise<number> {
    const actual = Math.max(HACKRF_MIN_SAMPLE_RATE, Math.min(HACKRF_MAX_SAMPLE_RATE, rate));
    const { freqHz, divider } = sampleRateParams(actual);
    const buf = new DataView(new ArrayBuffer(8));
    buf.setUint32(0, freqHz, true);
    buf.setUint32(4, divider, true);
    await this.ctrlOut(Req.SAMPLE_RATE_SET, 0, 0, buf.buffer);
    const bw = computeBasebandFilterBw(Math.floor((0.75 * freqHz) / divider));
    await this.ctrlOut(Req.BASEBAND_FILTER_BANDWIDTH_SET, bw & 0xffff, bw >>> 16);
    this.sampleRate = freqHz / divider;
    this.maxBuffered = Math.max(4 * TRANSFER_BYTES, Math.ceil(this.sampleRate)); // ~0.5 s of IQ bytes
    return this.sampleRate;
  }

  async setFrequencyCorrection(ppm: number): Promise<void> {
    this.ppm = ppm;
    await this.tune(this.centerFrequency);
  }

  getFrequencyCorrection(): number {
    return this.ppm;
  }

  async setGain(gain: number | null): Promise<void> {
    this.gain = gain;
    await this.applyGain();
  }

  getGain(): number | null {
    return this.gain;
  }

  async setCenterFrequency(freq: number): Promise<number> {
    const f = Math.max(HACKRF_MIN_FREQUENCY, Math.min(HACKRF_MAX_FREQUENCY, freq));
    await this.tune(f);
    this.centerFrequency = f;
    return f;
  }

  /** HackRF tunes HF natively, so direct sampling is accepted but has no effect. */
  async setDirectSamplingMethod(method: DirectSampling): Promise<void> {
    this.directSampling = method;
  }

  getDirectSamplingMethod(): DirectSampling {
    return this.directSampling;
  }

  /** Maps the bias tee to HackRF antenna port power (3.3 V, ~50 mA). */
  async enableBiasTee(enable: boolean): Promise<void> {
    this.biasTee = enable;
    await this.ctrlOut(Req.ANTENNA_ENABLE, enable ? 1 : 0, 0);
  }

  isBiasTeeEnabled(): boolean {
    return this.biasTee;
  }

  async resetBuffer(): Promise<void> {
    this.chunks = [];
    this.chunkOffset = 0;
    this.buffered = 0;
    this.failure = null;
    if (!this.streaming) await this.startStreaming();
  }

  readSamples(length: number): Promise<SampleBlock> {
    const bytes = length * 2;
    const frequency = this.centerFrequency;
    return new Promise<Uint8Array>((resolve, reject) => {
      if (this.failure) return reject(this.failure);
      if (!this.streaming) this.startStreaming().catch(reject);
      this.waiters.push({ bytes, resolve, reject });
      this.serveWaiters();
    }).then((data) => ({
      frequency,
      directSampling: false,
      data: data.buffer as ArrayBuffer,
    }));
  }

  async close(): Promise<void> {
    this.stopStreaming(new RadioError("Device closed", RadioErrorType.UsbTransferError));
    try {
      await this.setMode(Mode.OFF);
    } catch (_) {}
    try {
      await this.device.releaseInterface(0);
    } catch (_) {}
    try {
      await this.device.close();
    } catch (_) {}
  }

  // ── HackRF extras ──────────────────────────────────────────

  /** Stops streaming and turns the receiver off (resetBuffer() restarts it). */
  async pause(): Promise<void> {
    this.stopStreaming(new RadioError("Receiving paused", RadioErrorType.UsbTransferError));
    this.failure = null;
    await this.setMode(Mode.OFF);
  }

  /** Enables the +14 dB front-end amplifier. */
  async setAmpEnabled(enabled: boolean): Promise<void> {
    this.ampEnabled = enabled;
    await this.ctrlOut(Req.AMP_ENABLE, enabled ? 1 : 0, 0);
  }

  isAmpEnabled(): boolean {
    return this.ampEnabled;
  }

  // ── streaming ──────────────────────────────────────────────

  private async startStreaming() {
    if (this.streaming) return;
    await this.setMode(Mode.RECEIVE);
    this.streaming = true;
    const gen = ++this.generation;
    for (let i = 0; i < TRANSFERS_IN_FLIGHT; ++i) this.submitTransfer(gen);
  }

  private stopStreaming(reason: any) {
    this.streaming = false;
    ++this.generation;
    const waiters = this.waiters;
    this.waiters = [];
    for (const w of waiters) w.reject(reason);
  }

  private submitTransfer(gen: number) {
    ++this.inFlight;
    this.device.transferIn(RX_ENDPOINT, TRANSFER_BYTES).then(
      (result) => {
        --this.inFlight;
        if (gen !== this.generation) return;
        if (result.status !== "ok" || !result.data) {
          this.fail(new Error(`USB transfer status: ${result.status}`));
          return;
        }
        this.push(
          new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength)
        );
        if (this.streaming && gen === this.generation) this.submitTransfer(gen);
      },
      (e) => {
        --this.inFlight;
        if (gen !== this.generation) return;
        this.fail(e);
      }
    );
  }

  private fail(cause: any) {
    this.failure = new RadioError(
      "HackRF sample transfer failed. Did you unplug the device?",
      RadioErrorType.UsbTransferError,
      { cause }
    );
    this.stopStreaming(this.failure);
  }

  private push(chunk: Uint8Array) {
    if (chunk.length === 0) return;
    // Signed → unsigned in place, 4 bytes at a time when aligned.
    if ((chunk.byteOffset & 3) === 0 && (chunk.length & 3) === 0) {
      const w = new Uint32Array(chunk.buffer, chunk.byteOffset, chunk.length >> 2);
      for (let i = 0; i < w.length; ++i) w[i] ^= 0x80808080;
    } else {
      for (let i = 0; i < chunk.length; ++i) chunk[i] ^= 0x80;
    }
    this.chunks.push(chunk);
    this.buffered += chunk.length;
    // Drop the oldest data if the consumer can't keep up, so latency stays bounded.
    while (this.buffered - this.chunkOffset > this.maxBuffered && this.chunks.length > 1) {
      const dropped = this.chunks.shift()!;
      this.buffered -= dropped.length;
      this.chunkOffset = 0;
    }
    this.serveWaiters();
  }

  private serveWaiters() {
    while (this.waiters.length > 0) {
      const w = this.waiters[0];
      if (this.buffered - this.chunkOffset < w.bytes) return;
      this.waiters.shift();
      w.resolve(this.take(w.bytes));
    }
  }

  private take(bytes: number): Uint8Array {
    const out = new Uint8Array(bytes);
    let filled = 0;
    while (filled < bytes) {
      const c = this.chunks[0];
      const n = Math.min(bytes - filled, c.length - this.chunkOffset);
      out.set(c.subarray(this.chunkOffset, this.chunkOffset + n), filled);
      filled += n;
      this.chunkOffset += n;
      if (this.chunkOffset === c.length) {
        this.chunks.shift();
        this.buffered -= c.length;
        this.chunkOffset = 0;
      }
    }
    return out;
  }

  // ── control transfers ──────────────────────────────────────

  private async tune(freq: number) {
    const corrected = Math.round(freq / (1 + this.ppm / 1e6));
    const mhz = Math.floor(corrected / 1e6);
    const hz = corrected - mhz * 1e6;
    const buf = new DataView(new ArrayBuffer(8));
    buf.setUint32(0, mhz, true);
    buf.setUint32(4, hz, true);
    await this.ctrlOut(Req.SET_FREQ, 0, 0, buf.buffer);
  }

  private async applyGain() {
    // "Auto" (null) uses libhackrf's recommended starting point: LNA 16 dB, VGA 20 dB.
    const { lna, vga } = this.gain === null ? { lna: 16, vga: 20 } : splitGain(this.gain);
    await this.ctrlInExpectOk(Req.SET_LNA_GAIN, lna);
    await this.ctrlInExpectOk(Req.SET_VGA_GAIN, vga);
  }

  private setMode(mode: Mode) {
    return this.ctrlOut(Req.SET_TRANSCEIVER_MODE, mode, 0);
  }

  private async ctrlOut(request: number, value: number, index: number, data?: ArrayBuffer) {
    const r = await this.device.controlTransferOut(
      { requestType: "vendor", recipient: "device", request, value, index },
      data
    );
    if (r.status !== "ok") {
      throw new RadioError(`HackRF request ${request} failed (${r.status})`, RadioErrorType.UsbTransferError);
    }
  }

  private async ctrlInExpectOk(request: number, index: number) {
    const r = await this.device.controlTransferIn(
      { requestType: "vendor", recipient: "device", request, value: 0, index },
      1
    );
    if (r.status !== "ok" || !r.data || r.data.byteLength < 1 || r.data.getUint8(0) === 0) {
      throw new RadioError(`HackRF rejected setting ${request}=${index}`, RadioErrorType.TunerError);
    }
  }

  private static async readByte(device: USBDevice, request: number): Promise<number> {
    const r = await device.controlTransferIn(
      { requestType: "vendor", recipient: "device", request, value: 0, index: 0 },
      1
    );
    return r.data && r.data.byteLength > 0 ? r.data.getUint8(0) : 0xff;
  }

  private static async readString(device: USBDevice, request: number): Promise<string> {
    try {
      const r = await device.controlTransferIn(
        { requestType: "vendor", recipient: "device", request, value: 0, index: 0 },
        255
      );
      if (!r.data) return "";
      return new TextDecoder()
        .decode(new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength))
        .replace(/\0.*$/, "");
    } catch (_) {
      return "";
    }
  }
}
