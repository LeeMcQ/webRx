// KiwiSDR client. Protocol (as used by kiwirecorder.py and the Kiwi web UI):
//   two WebSockets on the same timestamp: wss://host/<ts>/SND (audio) and wss://host/<ts>/W/F (waterfall)
//   → "SET auth t=kiwi p=<pwd>", "SET ident_user=…", "SET keepalive" every few seconds
//   SND → "SET mod=usb low_cut=300 high_cut=2700 freq=<kHz>", "SET compression=1", "SET AR OK in=12000 out=48000", "SET agc=…"
//   W/F → "SET zoom=<z> cf=<kHz>", "SET maxdb=0 mindb=-100", "SET wf_speed=4", "SET wf_comp=0"
//   ← "MSG k=v …" text frames (url-encoded values): center_freq, bandwidth, audio_rate, wf_fft_size, zoom_max, badp, too_busy…
//   ← "SND" flags u8 · seq u32 · S-meter u16 BE (dBm = 0.1·v − 127) · audio (IMA ADPCM when flags & 0x10, else int16 BE)
//   ← "W/F" pad u8 · x_bin u32 · flags_zoom u32 · seq u32 · 1024 bytes (dB = byte − 255)
// Only https Kiwis can be reached from an https page; most Kiwis are http on port 8073.
import { Adpcm, normaliseUrl, Pcm, type Label, type OwrxMode, type OwrxState } from "./owrx.js";

const MODES: [string, string, number, number][] = [
  ["am", "AM", -4900, 4900],
  ["amn", "AM-N", -2500, 2500],
  ["usb", "USB", 300, 2700],
  ["lsb", "LSB", -2700, -300],
  ["cw", "CW", 300, 700],
  ["nbfm", "NBFM", -6000, 6000],
  ["sam", "SAM", -4900, 4900],
];

/** W/F header: "W/F" · pad u8 · x_bin u32 LE @4 · flags|zoom u32 LE @8 · seq u32 @12.
 *  x_bin counts bins at maximum zoom, i.e. full span = fftSize · 2^zoomMax bins. */
export function parseWf(u8: Uint8Array, fullHz: number, zoomMax: number, fftSize = 1024) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const xBin = dv.getUint32(4, true);
  const zoom = dv.getUint32(8, true) & 0xffff;
  const spanHz = fullHz / 2 ** zoom;
  const startHz = (xBin / (fftSize * 2 ** zoomMax)) * fullHz;
  return { xBin, zoom, seq: dv.getUint32(12, true), spanHz, centreHz: startHz + spanHz / 2 };
}

/** SND frame: "SND" · flags u8 · seq u32 LE · S-meter u16 BE (dBm = 0.1·v − 127) · audio. */
export function parseSnd(u8: Uint8Array) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  return { flags: u8[3], seq: dv.getUint32(4, true), smeterDbm: 0.1 * dv.getUint16(8, false) - 127, body: u8.subarray(10), compressed: (u8[3] & 0x10) !== 0 };
}

export class KiwiClient {
  readonly kind = "kiwisdr";
  readonly label = "KiwiSDR";
  state: OwrxState = "idle";
  error = "";
  url = { page: "", ws: "", insecure: false, blocked: false };
  version = "";
  name = "";
  location = "";
  centreHz = 15_000_000;
  rateHz = 30_000_000;
  fullHz = 30_000_000;
  fftSize = 1024;
  profiles: { id: string; name: string }[] = [];
  profileId = "";
  modes: OwrxMode[] = MODES.map(([m, n, lo, hi]) => ({ modulation: m, name: n, bandpass: { low_cut: lo, high_cut: hi } }));
  clients = 0;
  maxClients = 0;
  smeterDb = NaN;
  mod = "am";
  freqHz = 9_500_000;
  squelch = -150;
  lowCut: number | null = -4900;
  highCut: number | null = 4900;
  audioOn = false;
  fftFrames = 0;
  audioBytes = 0;
  bytes = 0;
  bookmarks: Label[] = [];
  bands: Label[] = [];
  zoomLevel = 0;
  zoomMax = 14;
  audioRate = 12000;
  /** Exact rate the server reports (MSG sample_rate=11998.9…); falls back to audio_rate. */
  sampleRate = 0;
  onFft?: (spec: Float32Array) => void;
  onChange?: () => void;
  onLog?: (msg: string, kind?: string) => void;
  private wf: WebSocket | null = null;
  private snd: WebSocket | null = null;
  private keep = 0;
  private codec = new Adpcm();
  private pcm = new Pcm();
  private ts = 0;

  get tunedHz() {
    return this.freqHz;
  }
  get offsetHz() {
    return this.freqHz - this.centreHz;
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
      throw new Error("This KiwiSDR only offers http:// (port 8073) — browsers block insecure connections from an https:// page. Open it in a new tab instead.");
    }
    this.state = "connecting";
    this.error = "";
    this.fftFrames = this.bytes = this.audioBytes = 0;
    this.zoomLevel = 0;
    this.name = new URL(this.url.page).host;
    this.onChange?.();
    this.ts = Date.now();
    const base = this.url.ws.replace(/ws\/$/, "");
    const ws = new WebSocket(`${base}${this.ts}/W/F`);
    ws.binaryType = "arraybuffer";
    this.wf = ws;
    const timer = setTimeout(() => {
      if (this.wf === ws && this.state === "connecting") {
        this.error ||= "No answer from the KiwiSDR (timeout)";
        this.state = "error";
        ws.close();
        this.onChange?.();
      }
    }, 12000);
    ws.onopen = () => {
      ws.send("SET auth t=kiwi p=#");
      ws.send("SET ident_user=webRx");
      ws.send("SET maxdb=0 mindb=-100");
      ws.send("SET wf_speed=4");
      ws.send("SET wf_comp=0");
      this.sendZoom();
    };
    ws.onmessage = (e) => {
      if (this.wf !== ws) return;
      const u8 = new Uint8Array(e.data as ArrayBuffer);
      this.bytes += u8.length;
      const tag = String.fromCharCode(u8[0], u8[1], u8[2]);
      if (tag === "MSG") this.msg(new TextDecoder().decode(u8.subarray(4)));
      else if (tag === "W/F" && u8.length > 16) {
        const h = parseWf(u8, this.fullHz, this.zoomMax, this.fftSize);
        this.centreHz = h.centreHz;
        this.rateHz = h.spanHz;
        this.zoomLevel = h.zoom;
        const d = u8.subarray(16, 16 + Math.min(u8.length - 16, 65536));
        const out = new Float32Array(d.length);
        for (let i = 0; i < d.length; ++i) out[i] = d[i] - 255;
        ++this.fftFrames;
        if (this.state === "connecting") {
          clearTimeout(timer);
          this.state = "open";
          this.onLog?.(`Connected to ${this.name} (KiwiSDR ${this.version || "?"})`, "ok");
          this.onChange?.();
        }
        this.onFft?.(out);
      }
    };
    ws.onclose = () => {
      clearTimeout(timer);
      if (this.wf !== ws) return;
      const was = this.state;
      this.state = was === "connecting" || this.error ? "error" : "closed";
      if (was === "connecting" && !this.error) this.error = "KiwiSDR closed the connection before it was ready";
      this.cleanup();
      this.onLog?.(this.state === "error" ? `KiwiSDR: ${this.error}` : "KiwiSDR disconnected", this.state === "error" ? "er" : "wn");
      this.onChange?.();
    };
    this.keep = window.setInterval(() => {
      for (const w of [this.wf, this.snd]) if (w?.readyState === 1) w.send("SET keepalive");
    }, 5000);
  }

  private msg(s: string) {
    for (const part of s.split(" ")) {
      const i = part.indexOf("=");
      const k = i < 0 ? part : part.slice(0, i);
      let v = i < 0 ? "" : part.slice(i + 1);
      try {
        v = decodeURIComponent(v);
      } catch (_) {}
      switch (k) {
        case "center_freq":
          this.fullHz = this.fullHz || 30e6;
          break;
        case "bandwidth":
          this.fullHz = +v || 30e6;
          if (!this.zoomLevel) {
            this.rateHz = this.fullHz;
            this.centreHz = this.fullHz / 2;
          }
          break;
        case "zoom_max":
          this.zoomMax = +v || 14;
          break;
        case "wf_fft_size":
          this.fftSize = +v || 1024;
          break;
        case "version_maj":
          this.version = v;
          break;
        case "version_min":
          this.version = `${this.version}.${v}`;
          break;
        case "rx_chans":
          this.maxClients = +v || this.maxClients;
          break;
        case "sample_rate":
          this.sampleRate = +v || 0;
          break;
        case "audio_rate":
          this.audioRate = +v || 12000;
          break;
        case "badp":
          if (v === "1") {
            this.error = "This KiwiSDR needs a password";
            this.wf?.close();
          }
          break;
        case "too_busy":
          if (v && v !== "0") {
            this.error = "All channels on this KiwiSDR are in use";
            this.wf?.close();
          }
          break;
        case "down":
          this.error = "This KiwiSDR is down";
          break;
        case "load_cfg":
          try {
            const c = JSON.parse(v);
            if (c.rx_name) this.name = String(c.rx_name).replace(/<[^>]*>/g, "").trim();
            if (c.rx_location) this.location = String(c.rx_location);
          } catch (_) {}
          break;
      }
    }
    this.onChange?.();
  }

  private sendZoom() {
    if (this.wf?.readyState !== 1) return;
    this.wf.send(`SET zoom=${this.zoomLevel} cf=${(this.centreHz / 1000).toFixed(3)}`);
  }

  private sendTune() {
    if (this.snd?.readyState === 1) this.snd.send(`SET mod=${this.mod} low_cut=${this.lowCut} high_cut=${this.highCut} freq=${(this.freqHz / 1000).toFixed(3)}`);
  }

  disconnect(silent = false) {
    const had = !!this.wf;
    const w = this.wf;
    this.wf = null;
    w?.close();
    this.cleanup();
    if (had && !silent) {
      this.state = "closed";
      this.onLog?.("Disconnected from KiwiSDR");
      this.onChange?.();
    }
  }

  private cleanup() {
    clearInterval(this.keep);
    const s = this.snd;
    this.snd = null;
    s?.close();
    this.audioOn = false;
    this.pcm.close();
  }

  setMode(mod: string, push = true) {
    const m = MODES.find((x) => x[0] === mod) ?? MODES[0];
    this.mod = m[0];
    this.lowCut = m[2];
    this.highCut = m[3];
    if (push) this.sendTune();
    this.onChange?.();
  }

  tune(hz: number): boolean {
    if (!(hz > 0 && hz <= this.fullHz)) return false;
    this.freqHz = Math.round(hz);
    this.sendTune();
    if (Math.abs(hz - this.centreHz) > this.rateHz * 0.45) {
      this.centreHz = Math.min(this.fullHz - this.rateHz / 2, Math.max(this.rateHz / 2, hz));
      this.sendZoom();
    }
    this.onChange?.();
    return true;
  }

  setPassband(lo: number, hi: number) {
    this.lowCut = Math.round(lo);
    this.highCut = Math.round(hi);
    this.sendTune();
    this.onChange?.();
  }

  /** Server zoom in powers of two: span = full / 2^zoom. */
  zoom(centreHz: number, spanHz: number) {
    if (this.wf?.readyState !== 1) return false;
    const z = Math.max(0, Math.min(this.zoomMax, Math.round(Math.log2(this.fullHz / Math.max(1000, spanHz)))));
    this.zoomLevel = z;
    this.rateHz = this.fullHz / 2 ** z;
    this.centreHz = Math.min(this.fullHz - this.rateHz / 2, Math.max(this.rateHz / 2, centreHz));
    this.sendZoom();
    this.onChange?.();
    return true;
  }

  setSquelch(_db: number) {}
  selectProfile(_id: string) {}

  setAudio(on: boolean) {
    if (!on) {
      const s = this.snd;
      this.snd = null;
      s?.close();
      this.audioOn = false;
      this.pcm.close();
      this.onChange?.();
      return;
    }
    this.audioOn = true;
    this.pcm.ensure();
    this.codec.reset();
    const base = this.url.ws.replace(/ws\/$/, "");
    const ws = new WebSocket(`${base}${this.ts}/SND`);
    ws.binaryType = "arraybuffer";
    this.snd = ws;
    ws.onopen = () => {
      ws.send("SET auth t=kiwi p=#");
      ws.send("SET ident_user=webRx");
      ws.send("SET compression=1");
      ws.send("SET agc=1 hang=0 thresh=-100 slope=6 decay=1000 manGain=50");
      ws.send(`SET AR OK in=12000 out=${this.pcm.ctx?.sampleRate ?? 48000}`);
      ws.send("SET squelch=0 max=0");
      this.sendTune();
    };
    ws.onmessage = (e) => {
      if (this.snd !== ws) return;
      const u8 = new Uint8Array(e.data as ArrayBuffer);
      this.bytes += u8.length;
      const tag = String.fromCharCode(u8[0], u8[1], u8[2]);
      if (tag === "MSG") return this.msg(new TextDecoder().decode(u8.subarray(4)));
      if (tag !== "SND" || u8.length < 10) return;
      const f = parseSnd(u8);
      const flags = f.flags;
      this.smeterDb = f.smeterDbm;
      const body = f.body;
      if (body.length > 65536) return; // oversize audio chunk from a hostile server
      this.audioBytes += body.length;
      let pcm: Int16Array;
      if (flags & 0x10) pcm = this.codec.decode(body);
      else {
        pcm = new Int16Array(body.length >> 1);
        for (let i = 0; i < pcm.length; ++i) pcm[i] = (body[i * 2] << 24) >> 16 | body[i * 2 + 1];
      }
      this.pcm.push(pcm, this.sampleRate || this.audioRate);
    };
    ws.onclose = () => {
      if (this.snd === ws) {
        this.snd = null;
        this.audioOn = false;
        this.pcm.close();
        this.onChange?.();
      }
    };
    this.onChange?.();
  }

  setVolume(v: number) {
    this.pcm.setVolume(v);
  }
}

export const kiwi = new KiwiClient();
