// Listening (audio) on the monitor's single SDR stream.
//
// The monitor owns the one USB connection and its sample loop. Every block it
// reads is measured (unchanged thesis path) and also fanned out, as float I/Q,
// to a CompositeReceiver. Today that holds the audio Demodulator; more
// receivers (DT, IQ recorder, remote node) can be added without opening the
// SDR again.

import { Demodulator } from "@jtarrio/signals/demod/demodulator.js";
import { getMode, getSchemes, modeParameters, type Mode } from "@jtarrio/signals/demod/modes.js";
import { CompositeReceiver, type SampleReceiver } from "@jtarrio/signals/radio/sample_receiver.js";

const KEY = "webrx.listen.v1";

type ListenCfg = {
  scheme: string;
  bandwidth: number | null;
  stereo: boolean;
  squelch: number;
  volume: number;
  offsetHz: number;
};

const defaults: ListenCfg = { scheme: "WBFM", bandwidth: null, stereo: true, squelch: 0, volume: 0.5, offsetHz: 0 };

function load(): ListenCfg {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch (_) {
    return { ...defaults };
  }
}

export class SharedStream {
  /** Extra float receivers fed from the one SDR stream. */
  private extra: SampleReceiver[] = [];
  private composite: SampleReceiver | null = null;
  private demod: Demodulator | null = null;
  private rate = 0;
  private I = new Float32Array(0);
  private Q = new Float32Array(0);
  cfg: ListenCfg = load();
  audioOn = false;
  stereoStatus = false;
  onChange?: () => void;

  schemes(): string[] {
    return getSchemes();
  }

  /** Audio needs a user gesture to start, so the demodulator is created on first use. */
  private ensureDemod() {
    if (this.demod) return;
    this.demod = new Demodulator();
    this.demod.addEventListener("stereo-status", (e: any) => {
      this.stereoStatus = !!e.detail;
      this.onChange?.();
    });
    this.applyMode();
    this.demod.setVolume(this.cfg.volume);
    this.demod.setFrequencyOffset(this.cfg.offsetHz);
    if (this.rate) this.demod.setSampleRate(this.rate);
    this.rebuild();
  }

  private rebuild() {
    const list: SampleReceiver[] = [];
    if (this.demod && this.audioOn) list.push(this.demod);
    list.push(...this.extra);
    this.composite = list.length ? CompositeReceiver.of(list[0], ...list.slice(1)) : null;
    if (this.composite && this.rate) this.composite.setSampleRate(this.rate);
  }

  addReceiver(r: SampleReceiver) {
    this.extra.push(r);
    this.rebuild();
  }

  setAudio(on: boolean) {
    this.audioOn = on;
    if (on) this.ensureDemod();
    else this.demod?.setVolume(0);
    if (on) this.demod?.setVolume(this.cfg.volume);
    this.rebuild();
    this.onChange?.();
  }

  private applyMode() {
    if (!this.demod) return;
    let mode: Mode;
    try {
      mode = getMode(this.cfg.scheme);
    } catch (_) {
      mode = getMode("WBFM");
      this.cfg.scheme = "WBFM";
    }
    let p = modeParameters(mode);
    if (p.hasBandwidth() && this.cfg.bandwidth) p = p.setBandwidth(this.cfg.bandwidth);
    if (p.hasStereo()) p = p.setStereo(this.cfg.stereo);
    if (p.hasSquelch()) p = p.setSquelch(this.cfg.squelch);
    this.demod.setMode(p.mode);
  }

  modeInfo() {
    const p = modeParameters(getMode(this.cfg.scheme));
    return { hasBandwidth: p.hasBandwidth(), hasStereo: p.hasStereo(), hasSquelch: p.hasSquelch(), defaultBandwidth: p.hasBandwidth() ? (p.mode as any).bandwidth : null };
  }

  set(patch: Partial<ListenCfg>) {
    if (patch.scheme && patch.scheme !== this.cfg.scheme) patch.bandwidth = patch.bandwidth ?? null;
    this.cfg = { ...this.cfg, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.cfg));
    } catch (_) {}
    if (this.demod) {
      if ("volume" in patch) this.demod.setVolume(this.audioOn ? this.cfg.volume : 0);
      if ("offsetHz" in patch) this.demod.setFrequencyOffset(this.cfg.offsetHz);
      if ("scheme" in patch || "bandwidth" in patch || "stereo" in patch || "squelch" in patch) this.applyMode();
    }
    this.onChange?.();
  }

  setSampleRate(rate: number) {
    this.rate = rate;
    this.composite?.setSampleRate(rate);
  }

  /** Feed one raw block (unsigned 8-bit I/Q pairs, as read from the SDR). */
  feed(bytes: Uint8Array, centerHz: number) {
    if (!this.composite) return;
    const n = bytes.length >> 1;
    if (this.I.length !== n) {
      this.I = new Float32Array(n);
      this.Q = new Float32Array(n);
    }
    const I = this.I, Q = this.Q;
    for (let k = 0, j = 0; k < n; ++k, j += 2) {
      I[k] = (bytes[j] - 127.5) / 128;
      Q[k] = (bytes[j + 1] - 127.5) / 128;
    }
    // The receivers keep no reference to the arrays after returning, but hand
    // over copies anyway so a slow demodulator can never see half-written data.
    this.composite.receiveSamples({ I: I.slice(), Q: Q.slice(), frequency: centerHz });
  }
}

export const shared = new SharedStream();
