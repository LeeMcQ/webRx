// The one floating action button. It replaces the old stack (LIVE pill, Rec,
// Start/Stop and the plug bubble) and shows the measurement state with its
// own colour and symbol:
//
//   off         blue    plug        "Connect"     tap → connection sheet, long-press → reconnect last source
//   connecting  amber   plug + spin "Connecting"  tap → connection sheet
//   ready       green   ▶           "Start"       tap → start measuring
//   live        teal    pulse wave  "LIVE"        tap → menu (Stop · Rec · Connection)
//   rec         red     ● blinking  "REC 02:13"   tap → menu (Stop recording · Stop · Connection)
//   remote      indigo  remote      "Remote"      tap → menu (Rec · Connection)
//   play        violet  ▶           "Playback"    tap → menu
//   error       orange  !           "Check"       tap → connection sheet
//
// Stopping always goes through the menu, so a stray tap while driving can't
// end a measurement. Long-press or right-click opens the menu in any state.
// The menu holds the original btnStart / btnStop / btnRec, so their wiring and
// ids are unchanged.

export type FabInput = {
  /** State class of the source dot: "", ok, live, warn, err. */
  dot: string;
  text: string;
  running: boolean;
  recording: boolean;
  /** e.g. "02:13 · 1.4 MB" while recording. */
  recLabel: string;
  playing: boolean;
  remote: boolean;
};

export type FabState = "off" | "connecting" | "ready" | "live" | "rec" | "remote" | "play" | "error";

const LOOK: Record<FabState, { icon: string; label: string; aria: string }> = {
  off: { icon: "i-plug", label: "Connect", aria: "Connect a receiver" },
  connecting: { icon: "i-plug", label: "Connecting", aria: "Connecting — open the connection sheet" },
  ready: { icon: "i-play", label: "Start", aria: "Start measuring" },
  live: { icon: "i-activity", label: "LIVE", aria: "Measuring live — open controls" },
  rec: { icon: "i-rec", label: "REC", aria: "Recording — open controls" },
  remote: { icon: "i-remote", label: "Remote", aria: "Remote receiver connected — open controls" },
  play: { icon: "i-play", label: "Playback", aria: "Playing back a session — open controls" },
  error: { icon: "i-alert", label: "Check", aria: "Receiver problem — open the connection sheet" },
};

export function fabState(s: FabInput): FabState {
  if (s.recording) return "rec";
  if (s.running) return "live";
  if (s.playing) return "play";
  if (s.remote) return "remote";
  if (s.dot === "err") return "error";
  if (s.dot === "warn") return "connecting";
  if (s.dot === "ok" || s.dot === "live") return "ready";
  return "off";
}

let read: (() => FabInput) | null = null;
let current: FabState | null = null;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

export function initFab(input: () => FabInput) {
  read = input;
  const fab = el<HTMLButtonElement>("connBubble");
  const menu = el<HTMLElement>("fabMenu");
  if (!fab || !menu) return;

  const open = () => {
    refreshFab();
    menu.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    const first = Array.from(menu.querySelectorAll<HTMLButtonElement>("button")).find((b) => !b.hidden && !b.disabled);
    first?.focus({ preventScroll: true });
  };
  const close = () => {
    if (menu.hidden) return;
    menu.hidden = true;
    fab.setAttribute("aria-expanded", "false");
  };
  const toggle = () => (menu.hidden ? open() : close());
  const openSheet = () => el("btnOpenConn")?.click();

  let lpTimer = 0;
  let lpFired = false;
  fab.addEventListener("pointerdown", () => {
    lpFired = false;
    lpTimer = window.setTimeout(() => {
      lpFired = true;
      navigator.vibrate?.(20);
      // No source yet: long-press reconnects the last one (as before); otherwise it opens the menu.
      if (current === "off" || current === "error") el("btnConnect")?.click();
      else open();
    }, 600);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) fab.addEventListener(ev, () => clearTimeout(lpTimer));
  fab.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (!lpFired) open();
  });
  fab.addEventListener("click", (e) => {
    if (lpFired) {
      e.preventDefault();
      lpFired = false;
      return;
    }
    switch (current) {
      case "off":
      case "connecting":
      case "error":
        close();
        openSheet();
        break;
      case "ready":
        close();
        el("btnStart")?.click();
        break;
      default:
        toggle();
    }
  });
  menu.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    if (b.id === "fabConn") openSheet();
    // The action itself is handled by the button's own listener; just close.
    setTimeout(close, 0);
  });
  document.addEventListener("pointerdown", (e) => {
    if (menu.hidden) return;
    const t = e.target as Node;
    if (!menu.contains(t) && !fab.contains(t)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      close();
      fab.focus();
    }
  });
  refreshFab();
}

/** Re-reads the measurement state; call whenever it may have changed. */
export function refreshFab() {
  if (!read) return;
  const fab = el<HTMLButtonElement>("connBubble");
  if (!fab) return;
  const s = read();
  const st = fabState(s);
  const look = LOOK[st];
  if (st !== current) {
    current = st;
    fab.dataset.state = st;
    el("fabIcon")?.setAttribute("href", `#${look.icon}`);
  }
  const label = st === "rec" && s.recLabel ? `REC ${s.recLabel.split(" · ")[0]}` : look.label;
  const txt = el("fabTxt");
  if (txt && txt.textContent !== label) txt.textContent = label;
  fab.setAttribute("aria-label", `${look.aria}. ${s.text}`);
  fab.title = `${s.text} — ${look.aria}${st === "off" ? " (long-press: reconnect last source)" : " (long-press: controls)"}`;

  // Menu contents follow the state.
  const head = el("fabMenuTxt");
  if (head) head.textContent = s.text || "No source";
  const dot = el("fabMenuDot");
  if (dot) dot.className = `dot ${s.dot}`;
  const startB = el<HTMLButtonElement>("btnStart");
  const stopB = el<HTMLButtonElement>("btnStop");
  const recB = el<HTMLButtonElement>("btnRec");
  if (startB) startB.hidden = s.running || s.remote || s.playing;
  if (stopB) stopB.hidden = !s.running;
  if (recB) recB.hidden = !(s.running || s.remote || s.recording);
}
