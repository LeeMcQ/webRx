// UberSDR client (ka9q-radio based, https://ubersdr.org). Protocol as used by
// the server's own minimal-radio.js / v2 UI:
//   POST /connection {user_session_id: uuid}  → {allowed: true, …}   (CORS: origin reflected)
//   WS /ws/user-spectrum?user_session_id=…&mode=binary8&version=2
//      ← gzip JSON {type:"config", centerFreq, binCount, binBandwidth, totalBandwidth}
//      ← binary "SPEC" frames: v2 full (0x05: ref i16 cdB, step u8, codes) / delta (0x06: bit mask + codes)
//        bins arrive FFT-ordered (DC first) and are swapped to low→high
//      → {type:"zoom", frequency, binBandwidth} · {type:"pan", frequency} · {type:"ping"}
//   WS /ws?frequency=…&mode=…&user_session_id=…&format=opus&version=4
//      → {type:"tune", frequency, mode, bandwidthLow, bandwidthHigh}
//      ← binary Opus v4: flags u8 (bit0 quality, bit1 metadata) · [metadata: ts u64, uvarint rate, u8 channels | delta ts varint]
//        · [quality: power i16 cdB, noise i16 cdB] · Opus packet.   "PCM4" magic = lossless PCM (IQ modes, ignored here)
//   GET /api/description, /api/bookmarks, /api/bands  (CORS enabled)
// Opus is decoded with WebCodecs AudioDecoder where the browser has it.
import { normaliseUrl, Pcm, type Label, type OwrxMode, type OwrxState } from "./owrx.js";

const POP = new Uint8Array(256);
for (let i = 0; i < 256; i++) POP[i] = POP[i >> 1] + (i & 1);

const MODES: [string, string, number, number][] = [
  ["lsb", "LSB", -2700, -50],
  ["usb", "USB", 50, 2700],
  ["am", "AM", -5000, 5000],
  ["sam", "SAM", -5000, 5000],
  ["nfm", "NFM", -6250, 6250],
  ["fm", "FM", -10000, 10000],
  ["cwl", "CW-L", -700, -300],
  ["cwu", "CW-U", 300, 700],
];

function uvarint(u8: Uint8Array, off: number): [number, number] | null {
  let x = 0, s = 0;
  for (let i = off; i < u8.length && i < off + 10; i++) {
    const b = u8[i];
    if (b < 0x80) return [x + b * 2 ** s, i + 1];
    x += (b & 0x7f) * 2 ** s;
    s += 7;
  }
  return null;
}
function varint(u8: Uint8Array, off: number): [number, number] | null {
  const r = uvarint(u8, off);
  if (!r) return null;
  return [r[0] % 2 === 0 ? r[0] / 2 : -(r[0] + 1) / 2, r[1]];
}

export class UberClient {
  readonly kind = "ubersdr";
  readonly label = "UberSDR";
  state: OwrxState = "idle";
  error = "";
  url = { page: "", ws: "", insecure: false, blocked: false };
  version = "";
  name = "";
  location = "";
  centreHz = 0;
  rateHz = 0;
  fftSize = 0;
  profiles: { id: string; name: string }[] = [];
  profileId = "";
  modes: OwrxMode[] = MODES.map(([m, n, lo, hi]) => ({ modulation: m, name: n, bandpass: { low_cut: lo, high_cut: hi } }));
  clients = 0;
  maxClients = 0;
  smeterDb = NaN;
  noiseDb = NaN;
  mod = "usb";
  freqHz = 14_200_000;
  squelch = -150;
  lowCut: number | null = 50;
  highCut: number | null = 2700;
  audioOn = false;
  fftFrames = 0;
  audioBytes = 0;
  bytes = 0;
  bookmarks: Label[] = [];
  bands: Label[] = [];
  minHz = 10_000;
  maxHz = 30_000_000;
  audioNote = "";
  onFft?: (spec: Float32Array) => void;
  onChange?: () => void;
  onLog?: (msg: string, kind?: string) => void;
  private sid = "";
  private spec: WebSocket | null = null;
  private aud: WebSocket | null = null;
  private codes: Uint8Array | null = null;
  private scale: { ref: number; step: number } | null = null;
  private ping = 0;
  private pcm = new Pcm();
  private dec: any = null;
  private decCfg = "";
  private hdr = { have: false, rate: 0, ch: 1, ts: 0 };
  private host = "";

  get tunedHz() {
    return this.freqHz;
  }
  get offsetHz() {
    return this.freqHz - this.centreHz;
  }
  get connected() {
    return this.state === "open";
  }

  async connect(input: string) {
    this.disconnect(true);
    this.url = normaliseUrl(input);
    // the UberSDR UI lives at /v2/; the API is at the host root
    const root = this.url.page.replace(/\/v2\/$/, "/");
    this.url.page = root;
    this.url.ws = root.replace(/^http/, "ws");
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
    this.codes = null;
    this.scale = null;
    this.onChange?.();
    this.sid = crypto.randomUUID();
    try {
      const d = await (await fetch(root + "api/description")).json();
      this.name = String(d.receiver?.name || d.name || d.callsign || "").trim() || new URL(root).host;
      this.location = String(d.receiver?.location || d.location || "");
      this.version = String(d.version || "");
      this.maxClients = d.max_clients ?? 0;
      if (d.default_frequency) this.freqHz = d.default_frequency;
      if (d.default_mode) this.setMode(String(d.default_mode).toLowerCase(), false);
    } catch (_) {
      this.name = new URL(root).host;
    }
    try {
      const r = await fetch(root + "connection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_session_id: this.sid }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.allowed) throw new Error(j.reason || `server refused (${r.status})`);
    } catch (e: any) {
      this.state = "error";
      this.error = `UberSDR refused the connection: ${e?.message ?? e}`;
      this.onLog?.(this.error, "er");
      this.onChange?.();
      return;
    }
    const ws = new WebSocket(`${this.url.ws}ws/user-spectrum?user_session_id=${encodeURIComponent(this.sid)}&mode=binary8&version=2`);
    ws.binaryType = "arraybuffer";
    this.spec = ws;
    const timer = setTimeout(() => {
      if (this.spec === ws && this.state === "connecting") {
        this.error = "No answer from the server (timeout)";
        this.state = "error";
        ws.close();
        this.onChange?.();
      }
    }, 10000);
    ws.onmessage = async (e) => {
      if (this.spec !== ws) return;
      if (typeof e.data === "string") return this.json(JSON.parse(e.data));
      const buf = e.data as ArrayBuffer;
      this.bytes += buf.byteLength;
      const u8 = new Uint8Array(buf);
      if (u8[0] === 0x53 && u8[1] === 0x50 && u8[2] === 0x45 && u8[3] === 0x43) this.frame(u8);
      else if (u8[0] === 0x1f && u8[1] === 0x8b) {
        try {
          const txt = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
          this.json(JSON.parse(txt));
        } catch (_) {}
      }
      if (this.state === "connecting" && this.centreHz && this.fftFrames) {
        clearTimeout(timer);
        this.state = "open";
        this.onLog?.(`Connected to ${this.name} (UberSDR ${this.version || "?"})`, "ok");
        this.onChange?.();
      }
    };
    ws.onclose = () => {
      clearTimeout(timer);
      if (this.spec !== ws) return;
      const was = this.state;
      this.state = was === "connecting" || this.error ? "error" : "closed";
      if (was === "connecting" && !this.error) this.error = "Server closed the connection";
      this.cleanup();
      this.onLog?.(this.state === "error" ? `UberSDR: ${this.error}` : "UberSDR server disconnected", this.state === "error" ? "er" : "wn");
      this.onChange?.();
    };
    this.ping = window.setInterval(() => {
      for (const w of [this.spec, this.aud]) if (w?.readyState === 1) w.send(JSON.stringify({ type: "ping" }));
    }, 30000);
    // labels (best effort)
    fetch(root + "api/bookmarks").then((r) => r.json()).then((b) => {
      this.bookmarks = (Array.isArray(b) ? b : []).slice(0, 3000).map((x: any) => ({ hz: x.frequency, text: String(x.name || ""), kind: "bookmark" as const }));
      this.onChange?.();
    }).catch(() => {});
    fetch(root + "api/bands").then((r) => r.json()).then((b) => {
      this.bands = (Array.isArray(b) ? b : []).map((x: any) => ({ hz: x.start, hi: x.end, text: String(x.label || ""), kind: "band" as const }));
    }).catch(() => {});
  }

  private json(m: any) {
    if (m.type === "config") {
      if (m.centerFreq) this.centreHz = m.centerFreq;
      if (m.totalBandwidth) this.rateHz = m.totalBandwidth;
      else if (m.binCount && m.binBandwidth) this.rateHz = m.binCount * m.binBandwidth;
      if (m.binCount) this.fftSize = m.binCount;
      this.onChange?.();
    } else if (m.type === "error") {
      this.onLog?.(`UberSDR: ${m.error}`, "er");
    }
  }

  private frame(u8: Uint8Array) {
    const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const ver = u8[4], flags = u8[5];
    const hl = ver === 2 ? 24 : 22;
    if (u8.length < hl) return;
    const centre = Number(v.getBigUint64((ver === 2 ? 8 : 6) + 8, true));
    const body = u8.subarray(hl);
    if (flags === 0x05) {
      if (body.length < 3 || !body[2]) return;
      this.scale = { ref: ((body[0] | (body[1] << 8)) << 16) >> 16, step: body[2] };
      const n = body.length - 3;
      if (!this.codes || this.codes.length !== n) this.codes = new Uint8Array(n);
      this.codes.set(body.subarray(3));
    } else if (flags === 0x06) {
      const c = this.codes;
      if (!c || !this.scale) return;
      const n = c.length, ml = (n + 7) >> 3;
      let exp = 0;
      for (let b = 0; b < ml; b++) exp += POP[body[b]];
      if (body.length !== ml + exp) return;
      let vi = ml;
      for (let b = 0; b < ml; b++) {
        let m = body[b];
        if (b === ml - 1 && n & 7) m &= (1 << (n & 7)) - 1;
        const base = b << 3;
        while (m) {
          c[base + (31 - Math.clz32(m & -m))] = body[vi++];
          m &= m - 1;
        }
      }
    } else if (flags === 0x03) {
      if (!this.codes || this.codes.length !== body.length) this.codes = new Uint8Array(body.length);
      this.codes.set(body);
      this.scale = null;
    } else if (flags === 0x04) {
      const c = this.codes;
      if (!c || body.length < 2) return;
      const cnt = body[0] | (body[1] << 8);
      for (let i = 0; i < cnt && 4 + i * 3 < body.length; i++) {
        const o = 2 + i * 3, idx = body[o] | (body[o + 1] << 8);
        if (idx < c.length) c[idx] = body[o + 2];
      }
    } else return;
    if (!this.codes) return;
    if (centre) this.centreHz = centre;
    const n = this.codes.length, h = n >> 1, sc = this.scale;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const code = this.codes[(i + h) % n]; // swap halves: radiod sends DC first
      out[i] = sc ? (sc.ref + code * sc.step) / 100 : code - 256;
    }
    ++this.fftFrames;
    this.onFft?.(out);
  }

  disconnect(silent = false) {
    const had = !!this.spec;
    const s = this.spec;
    this.spec = null;
    s?.close();
    this.cleanup();
    if (had && !silent) {
      this.state = "closed";
      this.onLog?.("Disconnected from UberSDR server");
      this.onChange?.();
    }
  }

  private cleanup() {
    clearInterval(this.ping);
    const a = this.aud;
    this.aud = null;
    a?.close();
    this.audioOn = false;
    this.pcm.close();
    try {
      this.dec?.close();
    } catch (_) {}
    this.dec = null;
    this.decCfg = "";
  }

  private sendTune() {
    if (this.aud?.readyState === 1)
      this.aud.send(JSON.stringify({ type: "tune", frequency: Math.round(this.freqHz), mode: this.mod, bandwidthLow: this.lowCut, bandwidthHigh: this.highCut }));
  }

  setMode(mod: string, push = true) {
    const m = MODES.find((x) => x[0] === mod) ?? MODES[1];
    this.mod = m[0];
    this.lowCut = m[2];
    this.highCut = m[3];
    if (push) this.sendTune();
    this.onChange?.();
  }

  tune(hz: number): boolean {
    if (!(hz >= this.minHz && hz <= this.maxHz)) return false;
    this.freqHz = Math.round(hz);
    this.sendTune();
    // keep the tuned frequency in view
    if (this.rateHz && Math.abs(hz - this.centreHz) > this.rateHz * 0.45 && this.spec?.readyState === 1) this.spec.send(JSON.stringify({ type: "pan", frequency: Math.round(hz) }));
    this.onChange?.();
    return true;
  }

  setPassband(lo: number, hi: number) {
    this.lowCut = Math.round(lo);
    this.highCut = Math.round(hi);
    this.sendTune();
    this.onChange?.();
  }

  /** Server-side zoom: the server re-centres its FFT, so the bins keep full resolution. */
  zoom(centreHz: number, spanHz: number) {
    if (this.spec?.readyState !== 1) return false;
    const bins = this.fftSize || 1024;
    const span = Math.max(10_000, Math.min(this.maxHz, spanHz));
    this.spec.send(JSON.stringify({ type: "zoom", frequency: Math.round(centreHz), binBandwidth: span / bins }));
    return true;
  }

  setSquelch(_db: number) {}
  selectProfile(_id: string) {}

  setAudio(on: boolean) {
    if (!on) {
      const a = this.aud;
      this.aud = null;
      a?.close();
      this.audioOn = false;
      this.pcm.close();
      this.onChange?.();
      return;
    }
    const AD = (window as any).AudioDecoder;
    if (!AD) {
      this.audioNote = "This browser has no WebCodecs Opus decoder; open the server page for audio.";
      this.onLog?.(this.audioNote, "wn");
      this.onChange?.();
      return;
    }
    this.audioOn = true;
    this.pcm.ensure();
    this.hdr = { have: false, rate: 0, ch: 1, ts: 0 };
    const ws = new WebSocket(`${this.url.ws}ws?frequency=${Math.round(this.freqHz)}&mode=${this.mod}&user_session_id=${encodeURIComponent(this.sid)}&format=opus&version=4`);
    ws.binaryType = "arraybuffer";
    this.aud = ws;
    ws.onopen = () => this.sendTune();
    ws.onmessage = (e) => {
      if (this.aud !== ws) return;
      if (typeof e.data === "string") {
        try {
          const m = JSON.parse(e.data);
          if (m.type === "error") this.onLog?.(`UberSDR audio: ${m.error}`, "er");
        } catch (_) {}
        return;
      }
      this.audio(new Uint8Array(e.data as ArrayBuffer));
    };
    ws.onclose = () => {
      if (this.aud === ws) {
        this.aud = null;
        this.audioOn = false;
        this.pcm.close();
        this.onChange?.();
      }
    };
    this.onChange?.();
  }

  private audio(u8: Uint8Array) {
    this.audioBytes += u8.length;
    this.bytes += u8.length;
    if (u8.length >= 5 && u8[0] === 0x50 && u8[1] === 0x43 && u8[2] === 0x4d && u8[3] === 0x34) return; // lossless PCM (IQ modes)
    const flags = u8[0];
    if (flags & ~3) return;
    const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let off = 1;
    const h = this.hdr;
    if (flags & 2) {
      if (off + 8 > u8.length) return;
      h.ts = Number(v.getBigUint64(off, true));
      off += 8;
      const r = uvarint(u8, off);
      if (!r) return;
      h.rate = r[0];
      off = r[1];
      h.ch = u8[off++] || 1;
      h.have = true;
    } else {
      if (!h.have) return;
      const d = varint(u8, off);
      if (!d) return;
      h.ts += d[0];
      off = d[1];
    }
    if (flags & 1) {
      if (off + 4 > u8.length) return;
      const p = v.getInt16(off, true), nz = v.getInt16(off + 2, true);
      if (p !== -32768) this.smeterDb = p / 100;
      if (nz !== -32768) this.noiseDb = nz / 100;
      off += 4;
    }
    if (!h.rate) return;
    const cfg = `${h.rate}/${h.ch}`;
    if (!this.dec || this.decCfg !== cfg) {
      try {
        this.dec?.close();
      } catch (_) {}
      const AD = (window as any).AudioDecoder;
      this.dec = new AD({
        output: (ad: any) => {
          const n = ad.numberOfFrames;
          const out = new Float32Array(n);
          try {
            ad.copyTo(out, { planeIndex: 0, format: "f32-planar" });
          } catch (_) {}
          this.pcm.push(out, ad.sampleRate);
          ad.close();
        },
        error: (e: any) => this.onLog?.(`Opus decoder: ${e?.message ?? e}`, "er"),
      });
      this.dec.configure({ codec: "opus", sampleRate: h.rate, numberOfChannels: h.ch });
      this.decCfg = cfg;
    }
    try {
      this.dec.decode(new (window as any).EncodedAudioChunk({ type: "key", timestamp: Math.round(h.ts / 1000), data: u8.subarray(off) }));
    } catch (_) {}
  }

  setVolume(v: number) {
    this.pcm.setVolume(v);
  }
}

export const uber = new UberClient();

export async function looksLikeUber(page: string): Promise<boolean> {
  if (/ubersdr|\/v2\/?$/i.test(page)) return true;
  try {
    const r = await fetch(page.replace(/\/v2\/$/, "/") + "api/description", { cache: "no-store" });
    if (!r.ok) return false;
    const j = await r.json();
    return typeof j === "object" && ("default_frequency" in j || "cw_skimmer" in j || "available_clients" in j);
  } catch (_) {
    return false;
  }
}
