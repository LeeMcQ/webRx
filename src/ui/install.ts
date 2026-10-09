// "Install app" support for the PWA: captures the browser's install prompt so a
// button can offer it at the right moment (Chrome/Edge on Android and desktop).
// iOS Safari has no prompt; users add the app with Share → Add to Home Screen.

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** True when the browser has offered to install the app and it isn't installed yet. */
export function canInstallApp(): boolean {
  return deferred !== null;
}

/** True when running as an installed app (standalone window). */
export function isInstalledApp(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true)
  );
}

export function onInstallAvailabilityChange(fn: () => void) {
  listeners.add(fn);
}

export async function promptInstallApp(): Promise<boolean> {
  if (!deferred) return false;
  const ev = deferred;
  deferred = null;
  await ev.prompt();
  const choice = await ev.userChoice;
  notify();
  return choice.outcome === "accepted";
}
