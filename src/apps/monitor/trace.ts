// TRACE client: a trace-station (trace/trace-station) as a remote source.
//
// One WebSocket carries every track as TRACE frames: control (CBOR, client →
// station), context and clock records (CBOR), spectrum (Rice-coded dBm),
// audio (Opus through WebCodecs, else IMA ADPCM), I/Q (block floating
// point), antenna pointing (heading on the station's sample clock) and bursts
// (lossless I/Q for TDoA). The station's spectrum is calibrated dBm when it has
// a calibration covering its current gains; `units` says which.
import { Pcm, normaliseUrl, type Label, type OwrxMode, type OwrxState } from "./owrx.js";
import { decodeCbor, encodeCbor, type CborValue } from "../../trace/cbor.js";
import {
  adpcmDecode,
  bfpDecode,
  burstDecode,
  CLOCK_CLASSES,
  Codec,
  Flags,
  headingAt,
  parseFrame,
  pointingDecode,
  POINTING_SOURCES,
  SpectrumDecoder,
  Tier,
  timeOf,
  TrackReader,
  unixMsToGpsNs,
  gpsNsToUnixMs,
  writeFullFrame,
  type ClockRecord,
  type PointingSample,
} from "../../trace/codec.js";

const MODES: [string, string, number, number][] = [
  ["nfm", "NFM", -6000, 6000],
  ["am", "AM", -4900, 4900],
  ["wfm", "WFM", -100000, 100000],
  ["usb", "USB", 300, 2700],
  ["lsb", "LSB", -2700, -300],
  ["cw", "CW", 300, 700],
];

/** Fetches /trace.json from a server; true when it is a TRACE station. */
export async function looksLikeTrace(page: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(new URL("trace.json", page).href, { signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!r.ok) return false;
    const j = await r.json();
    return j && j.trace === 1;
  } catch (_) {
    return false;
  }
}

type Ctx = { [k: string]: any };

export class TraceClient {
  readonly kind = "trace";
  readonly label = "TRACE";
  state: OwrxState = "idle";
  error = "";
  url = { page: "", ws: "", insecure: false, blocked: false };
  version = "";
  name = "";
  location = "";
  /** Spectrum view (what onFft frames span). */
  centreHz = 433_920_000;
  rateHz = 2_400_000;
  /** Width of the band the receiver captures (its sample rate). */
  bandHz = 2_400_000;
  bandCentreHz = 433_920_000;
  fftSize = 1024;
  profiles: { id: string; name: string }[] = [];
  profileId = "";
  modes: OwrxMode[] = MODES.map(([m, n, lo, hi]) => ({ modulation: m, name: n, bandpass: { low_cut: lo, high_cut: hi } }));
  clients = 0;
  maxClients = 0;
  smeterDb = NaN;
  mod = "nfm";
  freqHz = 433_920_000;
  squelch = -150;
  lowCut: number | null = -6000;
  highCut: number | null = 6000;
  audioOn = false;
  fftFrames = 0;
  audioBytes = 0;
  bytes = 0;
  bookmarks: Label[] = [];
  bands: Label[] = [];
  /** "dBm" when the station's calibration covers its current settings, else "dBFS". */
  units = "dBFS";
  context: Ctx | null = null;
  clock: ClockRecord | null = null;
  youControl = false;
  controlHolder: string | null = null;
  /** Recent antenna pointing samples from the station (rotator, compass, phone). */
  pointing: PointingSample[] = [];
  pointingMeta: { magnetic: boolean; declination: number | null; source: string } | null = null;
  /** Heading at the newest spectrum frame (station clock), for direction finding. */
  headingAtSpectrum: number | null = null;
  /** Sample index of the newest spectrum frame. */
  spectrumIndex = 0n;
  overload = false;
  dropped = 0;
  /** Spectrum view requested by the client. */
  bins = 1024;
  fps = 10;
  stepDb = 0.5;
  spanReq: number | null = null;
  viewCentreReq: number | null = null;
  iqRate = 0;
  iqBits = 8;

  onFft?: (spec: Float32Array) => void;
  onChange?: () => void;
  onLog?: (msg: string, kind?: string) => void;
  onIq?: (iq: Int16Array, index: bigint, rate: number) => void;
  onBurst?: (iq: Int8Array, fromIndex: bigint, timeNs: bigint) => void;
  onPointing?: (samples: PointingSample[]) => void;

  private ws: WebSocket | null = null;
  private readers = new Map<number, TrackReader>();
  private spec = new SpectrumDecoder();
  private pcm = new Pcm();
  private opus: any = null;
  private opusOk = false;
  private ts = 0;
  private burstParts: { index: bigint; data: Int8Array; timeNs: bigint }[] = [];

  get tunedHz() {
    return this.freqHz;
  }
  get offsetHz() {
    return this.freqHz - this.centreHz;
  }
  get connected() {
    return this.state === "open";
  }
  get clockClass(): string {
    return this.clock ? CLOCK_CLASSES[this.clock.class] ?? "?" : "—";
  }

  private reader(tier: number) {
    let r = this.readers.get(tier);
    if (!r) this.readers.set(tier, (r = new TrackReader()));
    return r;
  }

  private send(msg: CborValue) {
    if (this.ws?.readyState !== 1) return false;
    this.ws.send(writeFullFrame({ tier: Tier.Control, codec: Codec.Cbor }, encodeCbor(msg)));
    return true;
  }

  connect(input: string) {
    this.disconnect(true);
    this.url = normaliseUrl(input);
    if (this.url.blocked) {
      this.state = "error";
      this.error = "mixed";
      this.onChange?.();
      throw new Error("This TRACE station only offers http:// — browsers block insecure connections from an https:// page. Put it behind https (e.g. Caddy) or open webRx from http://localhost.");
    }
    this.state = "connecting";
    this.error = "";
    this.fftFrames = this.bytes = this.audioBytes = 0;
    this.readers.clear();
    this.spec.reset();
    this.pointing = [];
    this.name = new URL(this.url.page).host;
    this.onChange?.();
    const ws = new WebSocket(this.url.ws.replace(/ws\/$/, "trace/ws"));
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    const timer = setTimeout(() => {
      if (this.ws === ws && this.state === "connecting") {
        this.error ||= "No answer from the TRACE station (timeout)";
        this.state = "error";
        ws.close();
        this.onChange?.();
      }
    }, 10000);
    ws.onopen = async () => {
      this.opusOk = await opusSupported();
      this.send({ op: "hello", client: "webRx", codecs: this.opusOk ? ["opus", "adpcm"] : ["adpcm"] });
      this.subscribe();
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      const u8 = new Uint8Array(e.data as ArrayBuffer);
      this.bytes += u8.length;
      try {
        this.frame(u8, () => {
          if (this.state === "connecting") {
            clearTimeout(timer);
            this.state = "open";
            this.onLog?.(`Connected to ${this.name} (TRACE ${this.version || "?"}, clock class ${this.clockClass})`, "ok");
            this.onChange?.();
          }
        });
      } catch (err: any) {
        this.onLog?.(`TRACE: dropped a bad frame (${err?.message ?? err})`, "wn");
      }
    };
    ws.onclose = () => {
      clearTimeout(timer);
      if (this.ws !== ws) return;
      const was = this.state;
      this.state = was === "connecting" || this.error ? "error" : "closed";
      if (was === "connecting" && !this.error) this.error = "TRACE station closed the connection before it was ready";
      this.cleanup();
      this.onLog?.(this.state === "error" ? `TRACE: ${this.error}` : "TRACE station disconnected", this.state === "error" ? "er" : "wn");
      this.onChange?.();
    };
  }

  private frame(u8: Uint8Array, opened: () => void) {
    const raw = parseFrame(u8);
    const f = this.reader(raw.tier).accept(raw);
    if (!f) return; // compact frame before its group's key frame
    switch (f.tier) {
      case Tier.Context:
        if (f.codec === Codec.Cbor) this.record(decodeCbor(f.payload) as Ctx, opened);
        else if (f.codec === Codec.Pointing) {
          const p = pointingDecode(f.sampleIndex, f.payload);
          this.pointingMeta = { magnetic: p.magnetic, declination: p.declination, source: POINTING_SOURCES[p.source] ?? "?" };
          this.pointing.push(...p.samples);
          if (this.pointing.length > 600) this.pointing.splice(0, this.pointing.length - 600);
          this.onPointing?.(p.samples);
        }
        break;
      case Tier.Spectrum: {
        if (f.gap) this.spec.reset();
        const d = this.spec.decode(f.payload);
        if (!d) return;
        this.overload = !!(f.flags & Flags.Overload);
        this.units = f.flags & Flags.Uncalibrated ? "dBFS" : this.context?.units ?? "dBFS";
        this.spectrumIndex = f.sampleIndex;
        this.headingAtSpectrum = headingAt(this.pointing, f.sampleIndex);
        this.smeterDb = this.bandLevel(d, this.freqHz + (this.lowCut ?? -5000), this.freqHz + (this.highCut ?? 5000));
        ++this.fftFrames;
        opened();
        this.onFft?.(d);
        break;
      }
      case Tier.Audio:
        this.audio(f.codec, f.payload);
        break;
      case Tier.Iq:
        this.onIq?.(bfpDecode(f.payload), f.sampleIndex, this.context?.iq?.rate ?? 0);
        break;
      case Tier.Burst:
        this.burstParts.push({ index: f.sampleIndex, data: burstDecode(f.payload), timeNs: f.timeNs });
        break;
    }
  }

  private record(m: Ctx, opened: () => void) {
    switch (m?.type) {
      case "hello":
        this.version = String(m.software ?? "");
        this.name = String(m.station?.name || this.name);
        if (m.station?.lat != null) this.location = `${(+m.station.lat).toFixed(4)}, ${(+m.station.lon).toFixed(4)}`;
        break;
      case "context": {
        this.context = m;
        this.units = m.units === "dBm" ? "dBm" : "dBFS";
        this.bandHz = +m.sample_rate || this.bandHz;
        this.bandCentreHz = +m.centre_hz || this.bandCentreHz;
        if (m.spectrum) {
          this.rateHz = +m.spectrum.span_hz;
          this.centreHz = +m.spectrum.start_hz + this.rateHz / 2;
          this.fftSize = +m.spectrum.bins;
          this.spec.reset();
        } else {
          this.rateHz = this.bandHz;
          this.centreHz = this.bandCentreHz;
        }
        this.youControl = !!m.you_control;
        this.controlHolder = m.control_holder ?? null;
        if (this.state === "connecting" && !m.spectrum) break;
        opened();
        break;
      }
      case "clock":
        this.clock = m as ClockRecord;
        break;
      case "ack":
        if (!m.ok && m.message) this.onLog?.(`TRACE: ${m.op} refused — ${m.message}`, "wn");
        break;
      case "error":
        this.onLog?.(`TRACE: ${m.message}`, "wn");
        break;
      case "burst_done": {
        const parts = this.burstParts.splice(0).sort((a, b) => (a.index < b.index ? -1 : 1));
        const n = parts.reduce((a, p) => a + p.data.length, 0);
        const all = new Int8Array(n);
        let o = 0;
        for (const p of parts) all.set(p.data, (o += p.data.length) - p.data.length);
        if (parts.length) this.onBurst?.(all, parts[0].index, parts[0].timeNs);
        this.onLog?.(`TRACE burst: ${(n / 2).toLocaleString()} samples from index ${m.from_index}`, "ok");
        break;
      }
    }
    this.onChange?.();
  }

  private bandLevel(d: Float32Array, lo: number, hi: number): number {
    const start = this.centreHz - this.rateHz / 2, bw = this.rateHz / d.length;
    const a = Math.max(0, Math.floor((Math.min(lo, hi) - start) / bw)), b = Math.min(d.length - 1, Math.ceil((Math.max(lo, hi) - start) / bw));
    let s = 0, c = 0;
    for (let i = a; i <= b; i++) (s += 10 ** (d[i] / 10)), c++;
    return c ? 10 * Math.log10(s) : NaN;
  }

  private audio(codec: number, p: Uint8Array) {
    if (!this.audioOn) return;
    this.audioBytes += p.length;
    if (codec === Codec.ImaAdpcm) {
      const { rate, pcm } = adpcmDecode(p);
      this.pcm.push(pcm, rate);
    } else if (codec === Codec.Opus && this.opus) {
      const A = (globalThis as any).EncodedAudioChunk;
      this.opus.decode(new A({ type: "key", timestamp: (this.ts += 20000), data: p }));
    }
  }

  private subscribe() {
    const audio = this.audioOn
      ? { freq_hz: this.freqHz, mode: this.mod, lo: this.lowCut ?? -5000, hi: this.highCut ?? 5000, codec: this.opusOk ? "opus" : "adpcm", kbps: 48 }
      : null;
    const iq = this.iqRate > 0 ? { freq_hz: this.freqHz, rate: this.iqRate, bits: this.iqBits } : null;
    this.send({
      op: "subscribe",
      spectrum: { bins: this.bins, fps: this.fps, step_db: this.stepDb, centre_hz: this.viewCentreReq ?? undefined, span_hz: this.spanReq ?? undefined },
      audio,
      iq,
      pointing: true,
    });
  }

  disconnect(silent = false) {
    const had = !!this.ws;
    const w = this.ws;
    this.ws = null;
    w?.close();
    this.cleanup();
    if (had && !silent) {
      this.state = "closed";
      this.onLog?.("Disconnected from the TRACE station");
      this.onChange?.();
    }
  }

  private cleanup() {
    this.audioOn = false;
    this.pcm.close();
    try {
      this.opus?.close();
    } catch (_) {}
    this.opus = null;
  }

  setMode(mod: string, push = true) {
    const m = MODES.find((x) => x[0] === mod) ?? MODES[0];
    this.mod = m[0];
    this.lowCut = m[2];
    this.highCut = m[3];
    if (push) this.subscribe();
    this.onChange?.();
  }

  /** Tunes the listening frequency; retunes the receiver when it lies outside the captured band. */
  tune(hz: number): boolean {
    if (!(hz > 0)) return false;
    this.freqHz = Math.round(hz);
    const lo = this.bandCentreHz - this.bandHz * 0.45, hi = this.bandCentreHz + this.bandHz * 0.45;
    if (hz < lo || hz > hi) {
      this.send({ op: "tune", centre_hz: Math.round(hz) });
      this.viewCentreReq = null;
    }
    this.subscribe();
    this.onChange?.();
    return true;
  }

  setPassband(lo: number, hi: number) {
    this.lowCut = Math.round(lo);
    this.highCut = Math.round(hi);
    this.subscribe();
    this.onChange?.();
  }

  /** Server-side zoom: the station sends only the view, reduced to `bins`. */
  zoom(centreHz: number, spanHz: number) {
    if (!this.connected) return false;
    this.spanReq = Math.min(this.bandHz, Math.max(10_000, spanHz));
    this.viewCentreReq = centreHz;
    this.subscribe();
    return true;
  }

  setSquelch(db: number) {
    this.squelch = db;
  }
  selectProfile(_id: string) {}

  setAudio(on: boolean) {
    this.audioOn = on;
    if (on) {
      this.pcm.ensure();
      if (this.opusOk && !this.opus) this.opus = makeOpusDecoder((f, rate) => this.pcm.push(f, rate), (e) => this.onLog?.(`Opus: ${e}`, "wn"));
    } else {
      this.pcm.close();
      try {
        this.opus?.close();
      } catch (_) {}
      this.opus = null;
    }
    this.subscribe();
    this.onChange?.();
  }

  setVolume(v: number) {
    this.pcm.setVolume(v);
  }

  // ── TRACE extras ──

  /** Narrowband I/Q around the tuned frequency (0 = off). */
  setIq(rate: number, bits = 8) {
    this.iqRate = rate;
    this.iqBits = bits;
    this.subscribe();
  }

  setView(opts: { bins?: number; fps?: number; stepDb?: number }) {
    if (opts.bins) this.bins = opts.bins;
    if (opts.fps) this.fps = opts.fps;
    if (opts.stepDb) this.stepDb = opts.stepDb;
    this.subscribe();
  }

  takeControl() {
    return this.send({ op: "take_control" });
  }
  releaseControl() {
    return this.send({ op: "release_control" });
  }
  setGain(stages: Record<string, number>, auto?: boolean) {
    return this.send({ op: "gain", stages, auto: auto ?? null });
  }
  setSampleRate(hz: number) {
    return this.send({ op: "sample_rate", hz });
  }
  setBiasTee(on: boolean) {
    return this.send({ op: "bias_tee", on });
  }

  /** Raw full-rate I/Q around a moment (Unix ms), for TDoA. */
  fetchBurst(fromUnixMs: number, durationMs: number) {
    return this.send({ op: "fetch", from_ns: unixMsToGpsNs(fromUnixMs), duration_ns: Math.round(durationMs * 1e6) });
  }

  /** Sends this phone's compass heading as the antenna pointing (phone mounted on the boom). */
  sendPointing(headingDeg: number, opts: { accuracy?: number | null; magnetic?: boolean; declination?: number | null; pitch?: number | null; roll?: number | null; tUnixMs?: number } = {}) {
    return this.send({
      op: "pointing",
      heading_deg: headingDeg,
      accuracy_deg: opts.accuracy ?? null,
      magnetic: !!opts.magnetic,
      declination_deg: opts.declination ?? null,
      pitch_deg: opts.pitch ?? null,
      roll_deg: opts.roll ?? null,
      t_unix_ms: opts.tUnixMs ?? Date.now(),
    });
  }

  /** Unix ms of a station sample index under the current clock record. */
  unixMsOf(index: bigint): number | null {
    return this.clock ? gpsNsToUnixMs(timeOf(this.clock, index)) : null;
  }

  ping() {
    return this.send({ op: "ping", t: performance.now() });
  }
}

async function opusSupported(): Promise<boolean> {
  const AD = (globalThis as any).AudioDecoder;
  if (!AD?.isConfigSupported) return false;
  try {
    const r = await AD.isConfigSupported({ codec: "opus", sampleRate: 48000, numberOfChannels: 1 });
    return !!r?.supported;
  } catch (_) {
    return false;
  }
}

function makeOpusDecoder(out: (f: Float32Array, rate: number) => void, err: (e: string) => void): any {
  const AD = (globalThis as any).AudioDecoder;
  const d = new AD({
    output: (a: any) => {
      const f = new Float32Array(a.numberOfFrames);
      a.copyTo(f, { planeIndex: 0, format: "f32-planar" });
      out(f, a.sampleRate);
      a.close();
    },
    error: (e: any) => err(String(e?.message ?? e)),
  });
  d.configure({ codec: "opus", sampleRate: 48000, numberOfChannels: 1 });
  return d;
}

export const trace = new TraceClient();
// console aid: inspect the live TRACE session (clock, context, pointing) from devtools
if (typeof window !== "undefined") (window as any).webrxTrace = trace;
