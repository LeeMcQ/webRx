// Layout model for the proposal UI (proposal/PROPOSAL.md §1, §11.1, Appendix A):
// tab routes and hash aliases, one-shot storage migration, the shared tuning
// state (tuned vs view, DT follow/lock, per-source memory, start-up frequency)
// and unit badges. Pure logic; the DOM wiring lives in thesis-view.html / monitor.ts.

export const TABS = ["sa", "mt", "dt", "cm", "rm", "wf", "bands", "settings", "help"] as const;
export type Tab = (typeof TABS)[number];
/** Tabs that live in the "More" sheet on mobile. */
export const MORE_TABS: Tab[] = ["wf", "bands", "settings", "help"];
/** Old hash names → current tab. `#rm` is NOT an alias: it is the new survey tab. */
export const TAB_ALIASES: Record<string, Tab> = {
  receiver: "sa",
  map: "mt",
  monitor: "mt",
  remote: "cm",
  wifi: "wf",
  rf: "bands",
};

/** Resolves a hash / stored tab name to a tab; unknown → null. */
export function resolveTab(name: string | null | undefined): Tab | null {
  if (!name) return null;
  const n = name.replace(/^#/, "").split(/[?&]/)[0].toLowerCase();
  const t = (TAB_ALIASES[n] ?? n) as Tab;
  return (TABS as readonly string[]).includes(t) ? t : null;
}

/** DOM ids keep their historic names: the Bands pane is still `pane-rf`. */
export function paneIdFor(tab: Tab): string {
  return "pane-" + (tab === "bands" ? "rf" : tab);
}

// ── storage migration ─────────────────────────────────────────

export const LAYOUT_VERSION_KEY = "webrx.layout.version";
export const LAYOUT_VERSION = 3;

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/**
 * One-shot, idempotent migration run before UI init. No key is renamed; the
 * only removal is the orphaned `webrx.avgMode` (averaging is always linear power now).
 * v<3: the remote tab moved from "rm" to "cm" ("rm" is now the survey tab).
 */
export function migrateStorage(kv: KV): string[] {
  const log: string[] = [];
  const v = Number(kv.getItem(LAYOUT_VERSION_KEY) || "0");
  if (v >= LAYOUT_VERSION) return log;
  const avg = kv.getItem("webrx.avgMode");
  if (avg !== null) {
    if (/db/i.test(avg)) log.push("Averaging is now linear power (more accurate); the old dB-averaging setting was removed.");
    kv.removeItem("webrx.avgMode");
  }
  if (v < 3) {
    if (kv.getItem("monitor.tab") === "rm") {
      kv.setItem("monitor.tab", "cm");
      log.push("Last tab 'RM' (remote) → 'CM'.");
    }
    const raw = kv.getItem("webrx.ui.v1");
    if (raw) {
      try {
        const ui = JSON.parse(raw);
        if (ui && ui.startTab === "rm") {
          ui.startTab = "cm";
          kv.setItem("webrx.ui.v1", JSON.stringify(ui));
          log.push("Start tab 'RM' (remote) → 'CM'.");
        }
        if (ui && ui.startTab === "rf") {
          /* still valid: opens Bands */
        }
      } catch (_) {
        /* leave unreadable value alone */
      }
    }
  }
  kv.setItem(LAYOUT_VERSION_KEY, String(LAYOUT_VERSION));
  return log;
}

// ── shared tuning state ───────────────────────────────────────

export type SourceKey = string; // "local:<serial|kind>" or "remote:<url>"
export type Memory = { tunedHz: number; mode?: string; bwHz?: number };

export interface TuningSnapshot {
  tunedHz: number;
  view: { centreHz: number; spanHz: number };
  dt: { mode: "follow" | "lock"; lockHz: number | null };
  startupHz: number;
  /** "last": open on the last tuned frequency; "fixed": always open on startupHz. */
  startupMode: "last" | "fixed";
  memory: Record<SourceKey, Memory>;
}

export const TUNING_KEY = "webrx.tuning.v1";

/** Loads the saved tuning model, seeding it from pre-v3 settings (SA centre, DT target) so nothing is lost. */
export function loadTuning(kv: Pick<KV, "getItem">, legacy: { freqHz: number; dtTargetHz: number | null }): TuningState {
  let saved: Partial<TuningSnapshot> | null = null;
  try {
    saved = JSON.parse(kv.getItem(TUNING_KEY) || "null");
  } catch (_) {}
  const t = new TuningState(legacy.freqHz, saved);
  if (!saved && legacy.dtTargetHz) t.s.dt = { mode: "lock", lockHz: legacy.dtTargetHz };
  return t;
}

/**
 * One tuned frequency, a separate SA view, an optional DT lock, a start-up
 * frequency and per-source memory. Listeners get every change.
 */
export class TuningState {
  s: TuningSnapshot;
  private subs = new Set<(s: TuningSnapshot) => void>();
  constructor(startupHz = 433.92e6, saved?: Partial<TuningSnapshot> | null) {
    this.s = {
      tunedHz: startupHz,
      view: { centreHz: startupHz, spanHz: 2.4e6 },
      dt: { mode: "follow", lockHz: null },
      startupHz,
      startupMode: "last",
      memory: {},
      ...(saved || {}),
    } as TuningSnapshot;
  }
  on(fn: (s: TuningSnapshot) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }
  private emit() {
    for (const f of this.subs) f(this.s);
  }
  tune(hz: number, source?: SourceKey) {
    if (!Number.isFinite(hz) || hz <= 0) return;
    this.s.tunedHz = hz;
    if (source) this.s.memory[source] = { ...(this.s.memory[source] || {}), tunedHz: hz };
    this.emit();
  }
  setView(centreHz: number, spanHz: number) {
    if (!(spanHz > 0) || !Number.isFinite(centreHz)) return;
    this.s.view = { centreHz, spanHz };
    this.emit();
  }
  centreOnTuned() {
    this.setView(this.s.tunedHz, this.s.view.spanHz);
  }
  dtFollow() {
    this.s.dt = { mode: "follow", lockHz: null };
    this.emit();
  }
  dtLock(hz = this.s.tunedHz) {
    this.s.dt = { mode: "lock", lockHz: hz };
    this.emit();
  }
  /** The frequency DT measures: the locked target, else the tuned frequency. */
  dtTargetHz(): number {
    return this.s.dt.mode === "lock" && this.s.dt.lockHz ? this.s.dt.lockHz : this.s.tunedHz;
  }
  setStartup(hz: number, mode: "last" | "fixed" = this.s.startupMode) {
    if (hz > 0) this.s.startupHz = hz;
    this.s.startupMode = mode;
    this.emit();
  }
  /** Frequency to open on: fixed start-up, else the last tuned one. */
  openingHz(): number {
    return this.s.startupMode === "fixed" ? this.s.startupHz : this.s.tunedHz;
  }
  remember(source: SourceKey, m: Partial<Memory>) {
    this.s.memory[source] = { ...(this.s.memory[source] || { tunedHz: this.s.tunedHz }), ...m };
  }
  /** Switching source restores that source's last frequency (or keeps the current one). */
  restore(source: SourceKey): Memory | null {
    const m = this.s.memory[source];
    if (m) {
      this.s.tunedHz = m.tunedHz;
      this.emit();
    }
    return m ?? null;
  }
  toJSON(): TuningSnapshot {
    return this.s;
  }
}

// ── unit badges ───────────────────────────────────────────────

export type SourceKind = "rtlsdr" | "hackrf" | "kiwisdr" | "openwebrx" | "ubersdr" | "wifi" | "cellular" | "demo" | string;

/** dBFS for a local SDR; dBm only when calibrated or Kiwi; OWRX dBFS; UberSDR dB; monitors dBm (OS-reported). */
export function unitFor(kind: SourceKind, calibrated: boolean): "dBm" | "dBFS" | "dB" {
  if (kind === "kiwisdr") return "dBm";
  if (kind === "ubersdr") return "dB";
  if (kind === "openwebrx") return "dBFS";
  if (kind === "wifi" || kind === "cellular") return "dBm";
  return calibrated ? "dBm" : "dBFS";
}
