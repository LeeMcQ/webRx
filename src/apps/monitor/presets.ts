// The 12 presets (PROPOSAL §5) and the first-run flow (§6). Presets drive the
// existing controls by id (same path as a user typing), so every listener,
// persisted setting and the shared tuning model stay in charge.

export type Gain = "agc" | "fixed-mid" | "fixed-low" | "fixed-max" | "server";
export type Home = "sa" | "dt" | "wf" | "cm" | "sweep";
export interface Preset {
  id: string;
  name: string;
  centreMHz: number;
  spanMHz: number; // view span (zoom inside the captured bandwidth)
  mode?: string; // listen scheme
  ifKHz?: number;
  gain: Gain;
  maxHold?: boolean;
  /** device needs: "any" local SDR, "hackrf" (range > RTL), "remote" server, "monitor" (Wi-Fi AP list) */
  needs: "any" | "hackrf" | "remote" | "monitor";
  home: Home;
  sweep?: [number, number];
  dtLock?: boolean;
  note: string;
}

export const PRESETS: Preset[] = [
  { id: "fm", name: "FM broadcast", centreMHz: 98.0, spanMHz: 2.0, mode: "WBFM", ifKHz: 200, gain: "agc", needs: "any", home: "sa", note: "WFM 200 kHz, stereo, 50 µs de-emphasis" },
  { id: "air", name: "Airband", centreMHz: 121.5, spanMHz: 2.0, mode: "AM", ifKHz: 8, gain: "fixed-mid", needs: "any", home: "sa", note: "AM 8 kHz, 25 kHz steps (8.33 option), 121.5 guard" },
  { id: "adsb", name: "ADS-B 1090", centreMHz: 1090, spanMHz: 2, gain: "fixed-max", maxHold: true, needs: "any", home: "sa", note: "Spectrum/burst view only — use a decoder for messages" },
  { id: "2m", name: "2 m ham", centreMHz: 145.0, spanMHz: 2.0, mode: "NBFM", ifKHz: 12.5, gain: "fixed-mid", needs: "any", home: "sa", note: "NFM 12.5 kHz, 145.500 calling" },
  { id: "pmr", name: "PMR446", centreMHz: 446.1, spanMHz: 0.2, mode: "NBFM", ifKHz: 12.5, gain: "fixed-mid", maxHold: true, needs: "any", home: "sa", note: "16 channels from 446.00625 MHz" },
  { id: "ism", name: "LoRa / ISM 433", centreMHz: 433.92, spanMHz: 2.0, mode: "NBFM", ifKHz: 200, gain: "fixed-mid", maxHold: true, needs: "any", home: "sa", note: "Bursty — max hold on" },
  { id: "noaa", name: "NOAA APT", centreMHz: 137.5, spanMHz: 1.0, mode: "WBFM", ifKHz: 38, gain: "fixed-mid", needs: "any", home: "sa", note: "137.100 / 137.620 / 137.9125; consider bias-tee for an LNA" },
  { id: "cell", name: "Cellular bands (ZA)", centreMHz: 1842.5, spanMHz: 20, gain: "fixed-mid", needs: "hackrf", home: "sweep", sweep: [700, 2700], note: "Measurement only; RTL covers ≤1766 MHz" },
  { id: "wifi", name: "Wi-Fi survey", centreMHz: 2442, spanMHz: 20, gain: "fixed-mid", maxHold: true, needs: "monitor", home: "wf", sweep: [2400, 2500], note: "Opens WF (AP list); HackRF sweep for 2.4 GHz spectrum" },
  { id: "fox", name: "Fox-hunt DF", centreMHz: 145.5, spanMHz: 0.1, mode: "NBFM", ifKHz: 12.5, gain: "fixed-low", needs: "any", home: "dt", dtLock: true, note: "Fixed low gain, AGC off, audio tone — opens DT" },
  { id: "hf", name: "HF via Kiwi", centreMHz: 7.1, spanMHz: 0.2, mode: "LSB", ifKHz: 2.7, gain: "server", needs: "remote", home: "cm", note: "Pick a KiwiSDR/UberSDR in CM" },
  { id: "sweep", name: "Wideband sweep", centreMHz: 1000, spanMHz: 20, gain: "fixed-mid", maxHold: true, needs: "hackrf", home: "sweep", sweep: [1, 6000], note: "HackRF 1–6000 MHz; RTL steps 24–1766" },
];

export type SourcePath = "radio" | "remote" | "demo";
export type DeviceKind = "rtlsdr" | "hackrf" | "remote" | "none";
export const RTL_MAX_MHZ = 1766;

/** Can this preset run with the chosen path / device? Returns null when OK, else the reason. */
export function supportFor(p: Preset, path: SourcePath, dev: DeviceKind): string | null {
  if (p.needs === "monitor") return null; // WF works without an SDR
  if (p.needs === "remote") return path === "radio" && dev !== "remote" ? "Needs a remote server (Try Remote)" : null;
  if (path === "remote" || dev === "remote") return p.centreMHz < 30 ? null : "Needs a local radio, or a server that covers it";
  if (p.needs === "hackrf" && dev === "rtlsdr") return "Needs HackRF (above the RTL-SDR's 1766 MHz)";
  if (dev === "rtlsdr" && p.centreMHz > RTL_MAX_MHZ) return "Needs HackRF";
  return null;
}

/** First-run tasks (§6) → presets. */
export const TASKS: { label: string; preset: string }[] = [
  { label: "FM radio", preset: "fm" },
  { label: "Aircraft", preset: "air" },
  { label: "Ham 2 m", preset: "2m" },
  { label: "Weather satellites", preset: "noaa" },
  { label: "Find a transmitter", preset: "fox" },
  { label: "Check Wi-Fi", preset: "wifi" },
  { label: "Phone bands", preset: "cell" },
  { label: "HF (remote)", preset: "hf" },
  { label: "Explore everything", preset: "sweep" },
];

export const FIRST_RUN_KEY = "webrx.firstrun.v1";
export const USER_PRESETS_KEY = "webrx.presets.user.v1";
export const RECENT_KEY = "webrx.presets.recent.v1";

export function pushRecent(list: string[], id: string, max = 5): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

// ── DOM glue ──
type Ctx = { show: (tab: string) => void; deviceKind: () => DeviceKind; openConnect: () => void; openSoftKey: (k: string) => void; log: (m: string, k?: string) => void; dtLock: (hz: number) => void };

function setVal(id: string, v: string | boolean, ev = "change") {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (!el) return false;
  if (el instanceof HTMLSelectElement && !Array.from(el.options).some((o) => o.value === v)) return false;
  if (typeof v === "boolean") (el as HTMLInputElement).checked = v;
  else el.value = v;
  el.dispatchEvent(new Event(ev, { bubbles: true }));
  return true;
}

export function applyPreset(p: Preset | UserPreset, ctx: Ctx) {
  setVal("freq", String(p.centreMHz));
  setVal("saCentre", String(p.centreMHz));
  if ("spanMHz" in p && p.spanMHz) {
    setVal("saStart", String(+(p.centreMHz - p.spanMHz / 2).toFixed(6)));
    setVal("saStop", String(+(p.centreMHz + p.spanMHz / 2).toFixed(6)));
  }
  if (p.mode) setVal("demodMode", p.mode);
  if (p.ifKHz) setVal("demodBw", String(p.ifKHz));
  if ("maxHold" in p) setVal("saMax", !!p.maxHold);
  if ("gain" in p) {
    if (p.gain === "agc") setVal("gainAuto", true);
    else if (p.gain !== "server") {
      setVal("gainAuto", false);
      setVal("gain", p.gain === "fixed-low" ? "10" : p.gain === "fixed-max" ? "49" : "30", "input");
      setVal("gain", p.gain === "fixed-low" ? "10" : p.gain === "fixed-max" ? "49" : "30");
    }
  }
  if ("sweep" in p && p.sweep) {
    setVal("sweepLo", String(p.sweep[0]));
    setVal("sweepHi", String(p.sweep[1]));
  }
  if ("dtLock" in p && p.dtLock) ctx.dtLock(p.centreMHz * 1e6);
  const home: string = ("home" in p && p.home) || "sa";
  if (home === "sweep") {
    ctx.show("sa");
    ctx.openSoftKey("freq");
  } else ctx.show(home);
  ctx.log(`Preset: ${p.name}`, "ok");
}

export type UserPreset = { id: string; name: string; centreMHz: number; spanMHz?: number; mode?: string; ifKHz?: number; home?: "sa" };

function load<T>(k: string, d: T): T {
  try {
    return JSON.parse(localStorage.getItem(k) || "null") ?? d;
  } catch (_) {
    return d;
  }
}
const store = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (_) {}
};

/** Builds the preset chips (PRESET soft key), user presets/recent, and the first-run dialog. */
export function initPresets(ctx: Ctx) {
  const box = document.getElementById("presetBox");
  const byId = (id: string) => PRESETS.find((p) => p.id === id) ?? load<UserPreset[]>(USER_PRESETS_KEY, []).find((p) => p.id === id);
  const use = (id: string) => {
    const p = byId(id);
    if (!p) return;
    store(RECENT_KEY, pushRecent(load<string[]>(RECENT_KEY, []), id));
    applyPreset(p, ctx);
    render();
  };
  const chip = (id: string, name: string, why: string | null, extra = "") =>
    `<button type="button" class="btn ghost small pchip" data-preset="${id}"${why ? ` aria-disabled="true" title="${why}"` : ""}>${name}${why ? ` <small>${why}</small>` : ""}${extra}</button>`;
  function render() {
    if (!box) return;
    const dev = ctx.deviceKind();
    const path: SourcePath = dev === "remote" ? "remote" : "radio";
    const recent = load<string[]>(RECENT_KEY, []).map(byId).filter(Boolean) as (Preset | UserPreset)[];
    const mine = load<UserPreset[]>(USER_PRESETS_KEY, []);
    box.innerHTML =
      `<h3>Presets</h3><div class="pchips">${PRESETS.map((p) => chip(p.id, p.name, dev === "none" ? null : supportFor(p, path, dev))).join("")}</div>` +
      (recent.length ? `<h3>Recent</h3><div class="pchips">${recent.map((p) => chip(p.id, p.name, null)).join("")}</div>` : "") +
      `<h3>My presets</h3><div class="pchips">${mine.map((p) => chip(p.id, p.name, null, ` <span class="pdel" data-del="${p.id}" role="button" aria-label="Delete ${p.name}">✕</span>`)).join("") || '<span class="hint">None yet</span>'}</div>` +
      `<div class="btns"><button type="button" class="btn ghost small" id="presetSave">Save current as my preset</button><button type="button" class="btn ghost small" id="presetSetup">Run setup again</button></div>`;
  }
  box?.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const del = t.closest<HTMLElement>("[data-del]");
    if (del) {
      e.stopPropagation();
      store(USER_PRESETS_KEY, load<UserPreset[]>(USER_PRESETS_KEY, []).filter((p) => p.id !== del.dataset.del));
      return render();
    }
    const b = t.closest<HTMLElement>("[data-preset]");
    if (b && b.getAttribute("aria-disabled") !== "true") return use(b.dataset.preset!);
    if (t.id === "presetSave") {
      const name = prompt("Preset name", "My preset");
      if (!name) return;
      const v = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
      const lo = parseFloat(v("saStart")), hi = parseFloat(v("saStop"));
      const p: UserPreset = { id: "u" + Date.now().toString(36), name, centreMHz: parseFloat(v("freq")), spanMHz: hi > lo ? hi - lo : undefined, mode: v("demodMode") || undefined, ifKHz: parseFloat(v("demodBw")) || undefined };
      store(USER_PRESETS_KEY, [...load<UserPreset[]>(USER_PRESETS_KEY, []), p]);
      render();
    }
    if (t.id === "presetSetup") openFirstRun(true);
  });
  render();
  window.addEventListener("webrx:rxrange", render);
  setInterval(render, 5000);

  // ── first run ──
  const dlg = document.getElementById("firstRun") as HTMLDialogElement | null;
  let path: SourcePath = "radio";
  function tasks() {
    const grid = document.getElementById("frTasks")!;
    const dev = ctx.deviceKind();
    grid.innerHTML = TASKS.map((t) => {
      const p = PRESETS.find((x) => x.id === t.preset)!;
      const why = path === "demo" ? (p.needs === "remote" ? "Needs a remote server" : null) : supportFor(p, path, path === "radio" ? dev : "remote");
      return `<button type="button" class="frtask" data-task="${t.preset}"${why ? ` aria-disabled="true"` : ""}><b>${t.label}</b><small>${why ?? p.note}</small></button>`;
    }).join("");
  }
  function openFirstRun(force = false) {
    if (!dlg || (!force && localStorage.getItem(FIRST_RUN_KEY))) return;
    (document.getElementById("frStep1") as HTMLElement).hidden = false;
    (document.getElementById("frStep2") as HTMLElement).hidden = true;
    if (!dlg.open) dlg.showModal();
  }
  const done = () => {
    store(FIRST_RUN_KEY, { at: Date.now(), path });
    dlg?.close();
  };
  dlg?.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const src = t.closest<HTMLElement>("[data-path]");
    if (src) {
      path = src.dataset.path as SourcePath;
      (document.getElementById("frStep1") as HTMLElement).hidden = true;
      (document.getElementById("frStep2") as HTMLElement).hidden = false;
      (document.getElementById("frPathNote") as HTMLElement).textContent =
        path === "radio" ? "Plug in your RTL-SDR or HackRF and press Connect on the next screen if it doesn't connect automatically." : path === "remote" ? "Tasks open CM to pick a nearby public receiver." : "Demo: no receiver needed to look around. Spectrum appears when you connect one; WF has a built-in demo.";
      tasks();
      if (path === "radio") ctx.openConnect();
      return;
    }
    const task = t.closest<HTMLElement>("[data-task]");
    if (task && task.getAttribute("aria-disabled") !== "true") {
      done();
      const p = PRESETS.find((x) => x.id === task.dataset.task)!;
      if (path === "remote" && p.home !== "wf") {
        applyPreset({ ...p, home: "cm" }, ctx);
      } else use(p.id);
      return;
    }
    if (t.id === "frSkip") done();
    if (t.id === "frBack") openFirstRun(true);
  });
  dlg?.addEventListener("cancel", () => done());
  // first visit only, and not when a deep link (#tab) was opened
  if (!location.hash || location.hash === "#") setTimeout(() => openFirstRun(false), 300);
  return { openFirstRun };
}
