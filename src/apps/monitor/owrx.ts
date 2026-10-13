// OpenWebRX client: speaks the receiver WebSocket protocol (/ws/) so a remote
// OpenWebRX server can stand in for the local SDR. The server does the DSP
// (FFT + demodulation, csdr); we receive FFT rows and audio and send tuning.
//
// Protocol (OpenWebRX 1.x / OpenWebRX+):
//   → "SERVER DE CLIENT client=openwebrx.js type=receiver"
//   ← "CLIENT DE SERVER server=openwebrx version=…"
//   → {"type":"connectionproperties","params":{"output_rate":12000,"hd_output_rate":48000}}
//   ← JSON: config (center_freq, samp_rate, fft_size, fft_compression, audio_compression,
//      start_mod, start_offset_freq, waterfall_levels…), profiles, modes, smeter, clients…
//   → {"type":"dspcontrol","action":"start"} then {"type":"dspcontrol","params":{mod, offset_freq, low_cut, high_cut, squelch_level}}
//   → {"type":"selectprofile","params":{"profile":"sdr|profile"}}
//   ← binary, first byte = type: 1 FFT, 2 audio, 3 secondary FFT, 4 HD audio (WFM)
// FFT and audio are IMA-ADPCM ("adpcm", default) or raw (float32 FFT, int16 audio).
// FFT frames are ADPCM with the codec reset per frame and 10 padding samples, ×0.01 dB.
// Audio uses a sync-word variant: "SYNC" + int16 stepIndex + int16 predictor every 1000 bytes.
// OpenWebRX has no Opus; there is no origin check on the WebSocket.

const IDX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];
const STEP = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337,
  371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894,
  6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
];
const FFT_PAD = 10;

/** Returns a normalised http(s) URL string, or null for anything else (javascript:, data:, garbage). */
export function safeHttp(u: unknown): string | null {
  if (typeof u !== "string" || u.length > 2048) return null;
  try {
    const x = new URL(u.trim());
    return x.protocol === "http:" || x.protocol === "https:" ? x.href : null;
  } catch (_) {
    return null;
  }
}

/** JSON.parse that returns null instead of throwing. */
export function safeJson(t: string): any {
  try {
    return JSON.parse(t);
  } catch (_) {
    return null;
  }
}

export const REMOTE_KINDS = ["openwebrx", "ubersdr", "kiwisdr"] as const;
export type RemoteKindName = (typeof REMOTE_KINDS)[number];
export function safeKind(k: unknown): RemoteKindName | undefined {
  return REMOTE_KINDS.includes(k as RemoteKindName) ? (k as RemoteKindName) : undefined;
}

/** Hard cap on spectrum bins accepted from any server. */
export const MAX_BINS = 65536;

export class Adpcm {
  stepIndex = 0;
  predictor = 0;
  step = 0;
  private phase = 0;
  private sync = 0;
  private sb = new Uint8Array(4);
  private sbi = 0;
  private counter = 0;
  reset() {
    this.stepIndex = this.predictor = this.step = 0;
    this.phase = this.sync = this.sbi = this.counter = 0;
  }
  private nib(n: number) {
    this.stepIndex = Math.min(88, Math.max(0, this.stepIndex + IDX[n]));
    let d = this.step >> 3;
    if (n & 1) d += this.step >> 2;
    if (n & 2) d += this.step >> 1;
    if (n & 4) d += this.step;
    if (n & 8) d = -d;
    this.predictor = Math.min(32767, Math.max(-32768, this.predictor + d));
    this.step = STEP[this.stepIndex];
    return this.predictor;
  }
  decode(data: Uint8Array): Int16Array {
    const out = new Int16Array(data.length * 2);
    for (let i = 0; i < data.length; ++i) {
      out[i * 2] = this.nib(data[i] & 15);
      out[i * 2 + 1] = this.nib(data[i] >> 4);
    }
    return out;
  }
  decodeWithSync(data: Uint8Array): Int16Array {
    const out = new Int16Array(data.length * 2);
    let o = 0;
    for (let i = 0; i < data.length; ++i) {
      const b = data[i];
      if (this.phase === 0) {
        if (b !== "SYNC".charCodeAt(this.sync++)) this.sync = 0;
        if (this.sync === 4) {
          this.sbi = 0;
          this.phase = 1;
        }
      } else if (this.phase === 1) {
        this.sb[this.sbi++] = b;
        if (this.sbi === 4) {
          const v = new DataView(this.sb.buffer);
          this.stepIndex = v.getInt16(0, true);
          this.predictor = v.getInt16(2, true);
          this.counter = 1000;
          this.phase = 2;
        }
      } else {
        out[o++] = this.nib(b & 15);
        out[o++] = this.nib(b >> 4);
        if (this.counter-- === 0) {
          this.sync = 0;
          this.phase = 0;
        }
      }
    }
    return out.slice(0, o);
  }
}

export function decodeFft(data: Uint8Array, compression: string, codec: Adpcm): Float32Array {
  if (compression === "none") return new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + (data.byteLength & ~3)));
  codec.reset();
  const i16 = codec.decode(data);
  const out = new Float32Array(Math.max(0, i16.length - FFT_PAD));
  for (let i = 0; i < out.length; ++i) out[i] = i16[i + FFT_PAD] / 100;
  return out;
}

export type OwrxMode = { modulation: string; name: string; type?: string; squelch?: boolean; bandpass?: { low_cut: number; high_cut: number } };
export type OwrxState = "idle" | "connecting" | "open" | "closed" | "error";

/** Turn whatever the user typed into the server page URL and its WebSocket URL. */
export function normaliseUrl(input: string, pageHttps = location.protocol === "https:"): { page: string; ws: string; insecure: boolean; blocked: boolean } {
  let s = input.trim();
  if (!s) throw new Error("Enter a server address");
  if (!/^[a-z]+:\/\//i.test(s)) s = (pageHttps ? "https://" : "http://") + s;
  const u = new URL(s);
  if (u.protocol === "ws:") u.protocol = "http:";
  if (u.protocol === "wss:") u.protocol = "https:";
  if (!/^https?:$/.test(u.protocol)) throw new Error("Use an http(s):// address");
  let path = u.pathname.replace(/\/ws\/?$/, "/").replace(/[^/]*\.html?$/, "");
  if (!path.endsWith("/")) path += "/";
  const page = `${u.protocol}//${u.host}${path}`;
  const insecure = u.protocol === "http:";
  return { page, ws: `${insecure ? "ws" : "wss"}://${u.host}${path}ws/`, insecure, blocked: insecure && pageHttps };
}

/** Plays 16-bit PCM chunks at their own rate through one AudioContext with a small jitter buffer. */
export class Pcm {
  ctx: AudioContext | null = null;
  gain: GainNode | null = null;
  private next = 0;
  volume = 0.8;
  ensure() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.volume;
    this.gain.connect(this.ctx.destination);
  }
  setVolume(v: number) {
    this.volume = v;
    if (this.gain) this.gain.gain.value = v;
  }
  push(pcm: Int16Array | Float32Array, rate: number) {
    if (!this.ctx || !this.gain || !pcm.length) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    const buf = this.ctx.createBuffer(1, pcm.length, rate);
    const ch = buf.getChannelData(0);
    if (pcm instanceof Float32Array) ch.set(pcm);
    else for (let i = 0; i < pcm.length; ++i) ch[i] = pcm[i] / 32768;
    const now = this.ctx.currentTime;
    // keep 150–600 ms queued: restart the queue after an underrun, drop when far ahead
    if (this.next < now + 0.05) this.next = now + 0.15;
    if (this.next > now + 0.6) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    src.start(this.next);
    this.next += buf.duration;
  }
  close() {
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.gain = null;
    this.next = 0;
  }
}

export type Label = { hz: number; text: string; hi?: number; kind?: "bookmark" | "band" };

export class OwrxClient {
  readonly kind = "openwebrx";
  readonly label = "OpenWebRX";
  bookmarks: Label[] = [];
  bands: Label[] = [];
  state: OwrxState = "idle";
  error = "";
  url = { page: "", ws: "", insecure: false, blocked: false };
  version = "";
  name = "";
  location = "";
  centreHz = 0;
  rateHz = 0;
  fftSize = 0;
  fftCompression = "adpcm";
  audioCompression = "adpcm";
  levels: { min: number; max: number } | null = null;
  profiles: { id: string; name: string }[] = [];
  profileId = "";
  modes: OwrxMode[] = [];
  clients = 0;
  maxClients = 0;
  smeterDb = NaN;
  mod = "nfm";
  offsetHz = 0;
  squelch = -150;
  lowCut: number | null = null;
  highCut: number | null = null;
  audioOn = false;
  fftFrames = 0;
  audioBytes = 0;
  bytes = 0;
  private ws: WebSocket | null = null;
  private fftCodec = new Adpcm();
  private audCodec = new Adpcm();
  private hdCodec = new Adpcm();
  private pcm = new Pcm();
  private started = false;
  onFft?: (spec: Float32Array) => void;
  onChange?: () => void;
  onLog?: (msg: string, kind?: string) => void;

  get tunedHz() {
    return this.centreHz + this.offsetHz;
  }
  get connected() {
    return this.state === "open";
  }

  connect(input: string) {
    this.disconnect(true);
    this.url = normaliseUrl(input);
    if (this.url.blocked) {
      this.state = "error";
      this.error = "mixed";
      this.onChange?.();
      throw new Error("This server only offers http:// — browsers block insecure connections from an https:// page. Open it in a new tab instead.");
    }
    this.state = "connecting";
    this.error = "";
    this.fftFrames = this.bytes = this.audioBytes = 0;
    this.centreHz = this.rateHz = 0;
    this.started = false;
    this.onChange?.();
    const ws = new WebSocket(this.url.ws);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    const timer = setTimeout(() => {
      if (this.ws === ws && this.state === "connecting") {
        this.error = "No answer from the server (timeout)";
        this.state = "error";
        ws.close();
        this.onChange?.();
      }
    }, 10000);
    ws.onopen = () => {
      ws.send("SERVER DE CLIENT client=openwebrx.js type=receiver");
      ws.send(JSON.stringify({ type: "connectionproperties", params: { output_rate: 12000, hd_output_rate: 48000 } }));
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      if (typeof e.data === "string") {
        this.bytes += e.data.length;
        this.text(e.data);
        if (this.state === "connecting" && this.centreHz) {
          clearTimeout(timer);
          this.state = "open";
          this.onLog?.(`Connected to ${this.name || this.url.page} (OpenWebRX ${this.version || "?"})`, "ok");
          this.onChange?.();
        }
      } else this.binary(new Uint8Array(e.data as ArrayBuffer));
    };
    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.error ||= "Connection failed (server offline, wrong address, or a certificate problem)";
    };
    ws.onclose = (e) => {
      clearTimeout(timer);
      if (this.ws !== ws) return;
      const was = this.state;
      this.state = was === "connecting" || this.error ? "error" : "closed";
      if (!this.error && was === "connecting") this.error = `Server closed the connection${e.code ? ` (${e.code})` : ""}`;
      this.ws = null;
      this.audioOn = false;
      this.pcm.close();
      this.onLog?.(this.state === "error" ? `OpenWebRX: ${this.error}` : "OpenWebRX server disconnected", this.state === "error" ? "er" : "wn");
      this.onChange?.();
    };
  }

  disconnect(silent = false) {
    const ws = this.ws;
    this.ws = null;
    if (ws) ws.close();
    this.pcm.close();
    this.audioOn = false;
    if (ws && !silent) {
      this.state = "closed";
      this.onLog?.("Disconnected from OpenWebRX server");
      this.onChange?.();
    }
  }

  private send(o: unknown) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(o));
  }

  private text(s: string) {
    if (s.startsWith("CLIENT DE SERVER")) {
      const m = s.match(/version=(\S+)/);
      this.version = m ? m[1] : "";
      return;
    }
    let j: any;
    try {
      j = JSON.parse(s);
    } catch (_) {
      return;
    }
    const v = j.value;
    switch (j.type) {
      case "config": {
        if ("center_freq" in v) this.centreHz = v.center_freq;
        if ("samp_rate" in v) this.rateHz = v.samp_rate;
        if ("fft_size" in v) this.fftSize = v.fft_size;
        if ("fft_compression" in v) this.fftCompression = v.fft_compression;
        if ("audio_compression" in v) this.audioCompression = v.audio_compression;
        if ("waterfall_levels" in v) this.levels = v.waterfall_levels;
        if ("max_clients" in v) this.maxClients = v.max_clients;
        if ("sdr_id" in v && "profile_id" in v) this.profileId = `${v.sdr_id}|${v.profile_id}`;
        if ("start_mod" in v) this.setMode(v.start_mod, false);
        if ("start_offset_freq" in v) this.offsetHz = v.start_offset_freq;
        if ("initial_squelch_level" in v && Number.isFinite(v.initial_squelch_level)) this.squelch = v.initial_squelch_level;
        if ("receiver_name" in v && !this.name) this.name = String(v.receiver_name);
        if (this.started) this.pushDsp();
        else if (this.centreHz && this.rateHz) {
          this.started = true;
          this.send({ type: "dspcontrol", action: "start" });
          this.pushDsp();
        }
        this.onChange?.();
        break;
      }
      case "receiver_details":
        this.name = String(v.receiver_name || "").trim();
        this.location = String(v.receiver_location || "").trim();
        this.onChange?.();
        break;
      case "profiles":
        this.profiles = Array.isArray(v) ? v : [];
        this.onChange?.();
        break;
      case "modes":
        this.modes = (Array.isArray(v) ? v : []).filter((m: OwrxMode) => !m.type || m.type === "analog");
        if (this.lowCut === null) this.setMode(this.mod, false);
        this.onChange?.();
        break;
      case "bookmarks":
        this.bookmarks = (Array.isArray(v) ? v : []).map((b: any) => ({ hz: b.frequency, text: String(b.name || ""), kind: "bookmark" as const }));
        this.onChange?.();
        break;
      case "bands":
        this.bands = (Array.isArray(v) ? v : []).map((b: any) => ({ hz: b.low_bound, hi: b.high_bound, text: String(b.name || ""), kind: "band" as const }));
        break;
      case "smeter":
        this.smeterDb = v > 0 ? 10 * Math.log10(v) : NaN;
        break;
      case "clients":
        this.clients = v;
        break;
      case "sdr_error":
      case "demodulator_error":
        this.onLog?.(`OpenWebRX: ${v}`, "er");
        break;
    }
  }

  private binary(d: Uint8Array) {
    this.bytes += d.byteLength;
    const type = d[0];
    const body = d.subarray(1);
    if (type === 1) {
      ++this.fftFrames;
      if (body.length <= MAX_BINS * 4) this.onFft?.(decodeFft(body, this.fftCompression, this.fftCodec));
    } else if (type === 2 || type === 4) {
      this.audioBytes += body.byteLength;
      if (!this.audioOn) return;
      const codec = type === 2 ? this.audCodec : this.hdCodec;
      const pcm = this.audioCompression === "adpcm" ? codec.decodeWithSync(body) : new Int16Array(body.buffer.slice(body.byteOffset, body.byteOffset + (body.byteLength & ~1)));
      this.pcm.push(pcm, type === 2 ? 12000 : 48000);
    }
  }

  private pushDsp() {
    if (!this.started) return;
    this.send({
      type: "dspcontrol",
      params: { mod: this.mod, offset_freq: Math.round(this.offsetHz), low_cut: this.lowCut, high_cut: this.highCut, squelch_level: this.squelch },
    });
  }

  /** Choose a modulation; the passband follows the server's default for it. */
  setMode(mod: string, push = true) {
    this.mod = mod;
    const m = this.modes.find((x) => x.modulation === mod);
    if (m?.bandpass) {
      this.lowCut = m.bandpass.low_cut;
      this.highCut = m.bandpass.high_cut;
    } else if (!this.modes.length) {
      const bw: Record<string, [number, number]> = { nfm: [-4000, 4000], wfm: [-75000, 75000], am: [-4000, 4000], usb: [300, 3000], lsb: [-3000, -300], cw: [700, 900] };
      [this.lowCut, this.highCut] = bw[mod] ?? [-4000, 4000];
    }
    if (push) this.pushDsp();
    this.onChange?.();
  }

  /** Tune to an absolute frequency inside the server's current span. */
  tune(hz: number): boolean {
    if (!this.rateHz) return false;
    const off = Math.round(hz - this.centreHz);
    if (Math.abs(off) > this.rateHz / 2) return false;
    this.offsetHz = off;
    this.pushDsp();
    this.onChange?.();
    return true;
  }

  /** Passband edges relative to the tuned frequency (Hz). */
  setPassband(lo: number, hi: number) {
    this.lowCut = Math.round(lo);
    this.highCut = Math.round(hi);
    this.pushDsp();
    this.onChange?.();
  }

  /** OpenWebRX zooms on the client only; the server span is fixed by the profile. */
  zoom(_centreHz: number, _spanHz: number) {
    return false;
  }

  setSquelch(db: number) {
    this.squelch = db;
    this.pushDsp();
  }

  selectProfile(id: string) {
    this.profileId = id;
    this.send({ type: "selectprofile", params: { profile: id } });
  }

  /** Must be called from a user gesture (autoplay policy). */
  setAudio(on: boolean) {
    this.audioOn = on;
    if (on) this.pcm.ensure();
    else this.pcm.close();
    this.onChange?.();
  }
  setVolume(v: number) {
    this.pcm.setVolume(v);
  }
}

export const owrx = new OwrxClient();
