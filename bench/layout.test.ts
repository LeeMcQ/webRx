// Layout model: hash aliases, storage migration, shared tuning state, unit badges.
import { TuningState, loadTuning, TUNING_KEY, migrateStorage, paneIdFor, resolveTab, unitFor, LAYOUT_VERSION_KEY } from "../src/apps/monitor/layout.js";

declare const process: { exit(code: number): never };
let failures = 0;
function check(name: string, cond: boolean, detail?: any) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  if (!cond) failures++;
}
class Mem {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

// ── hash aliases ──
const cases: [string, string | null][] = [
  ["#sa", "sa"], ["#receiver", "sa"], ["#map", "mt"], ["#monitor", "mt"], ["#dt", "dt"],
  ["#cm", "cm"], ["#remote", "cm"], ["#rm", "rm"], ["#wifi", "wf"], ["#wf", "wf"],
  ["#rf", "bands"], ["#bands", "bands"], ["#settings", "settings"], ["#help", "help"],
  ["#dt?dts=abc", "dt"], ["#nope", null], ["", null],
];
for (const [h, want] of cases) check(`hash ${h || "(empty)"} → ${want}`, resolveTab(h) === want, resolveTab(h));
check("Bands keeps pane-rf id", paneIdFor("bands") === "pane-rf");
check("CM pane id", paneIdFor("cm") === "pane-cm");

// ── migration ──
{
  const kv = new Mem();
  kv.setItem("webrx.avgMode", "db");
  kv.setItem("monitor.tab", "rm");
  kv.setItem("webrx.ui.v1", JSON.stringify({ startTab: "rm", theme: "dark" }));
  kv.setItem("webrx.calibrations.v1", "{\"x\":1}");
  const log = migrateStorage(kv);
  check("avgMode removed", kv.getItem("webrx.avgMode") === null);
  check("last tab rm → cm", kv.getItem("monitor.tab") === "cm");
  const ui = JSON.parse(kv.getItem("webrx.ui.v1")!);
  check("startTab rm → cm, other prefs kept", ui.startTab === "cm" && ui.theme === "dark", ui);
  check("unrelated keys untouched", kv.getItem("webrx.calibrations.v1") === "{\"x\":1}");
  check("migration logs a notice for dB averaging", log.some((l) => /linear/.test(l)), log);
  check("version stored", kv.getItem(LAYOUT_VERSION_KEY) === "3");
  kv.setItem("monitor.tab", "rm"); // user later opens the new survey tab
  check("idempotent: second run does nothing", migrateStorage(kv).length === 0 && kv.getItem("monitor.tab") === "rm");
}
{
  const kv = new Mem();
  kv.setItem("webrx.ui.v1", "not json");
  migrateStorage(kv);
  check("corrupt prefs left alone", kv.getItem("webrx.ui.v1") === "not json");
}

// ── tuning state ──
{
  const t = new TuningState(100e6);
  let calls = 0;
  t.on(() => calls++);
  t.tune(433.92e6, "local:rtl:0001");
  check("tune sets tuned frequency", t.s.tunedHz === 433.92e6);
  check("view independent of tuned", t.s.view.centreHz === 100e6);
  t.setView(435e6, 10e6);
  check("view pans without retuning", t.s.tunedHz === 433.92e6 && t.s.view.centreHz === 435e6);
  check("DT follows tuned by default", t.dtTargetHz() === 433.92e6);
  t.dtLock(145.5e6);
  t.tune(868e6, "local:rtl:0001");
  check("DT lock survives SA retune", t.dtTargetHz() === 145.5e6);
  t.dtFollow();
  check("DT follow returns to tuned", t.dtTargetHz() === 868e6);
  t.tune(7.1e6, "remote:kiwi");
  check("per-source memory restore", t.restore("local:rtl:0001")?.tunedHz === 868e6 && t.s.tunedHz === 868e6);
  check("unknown source keeps current", t.restore("remote:new") === null && t.s.tunedHz === 868e6);
  t.tune(-5);
  check("invalid frequency ignored", t.s.tunedHz === 868e6);
  check("listeners notified", calls >= 6, calls);
  const round = new TuningState(1, JSON.parse(JSON.stringify(t)));
  check("JSON round trip", round.s.memory["remote:kiwi"].tunedHz === 7.1e6 && round.s.dt.mode === "follow");
}

{
  const kv = new Mem();
  const t = loadTuning(kv, { freqHz: 145.5e6, dtTargetHz: 145.525e6 });
  check("seed from old settings: tuned = SA centre", t.s.tunedHz === 145.5e6);
  check("seed: old DT target becomes a DT lock", t.s.dt.mode === "lock" && t.dtTargetHz() === 145.525e6);
  t.setStartup(433.92e6, "fixed");
  kv.setItem(TUNING_KEY, JSON.stringify(t));
  const t2 = loadTuning(kv, { freqHz: 1, dtTargetHz: null });
  check("saved model wins over legacy", t2.s.tunedHz === 145.5e6 && t2.openingHz() === 433.92e6);
  t2.setStartup(433.92e6, "last");
  check("start-up 'last' opens on last tuned", t2.openingHz() === 145.5e6);
  check("no legacy DT target → follow", loadTuning(new Mem(), { freqHz: 1e8, dtTargetHz: null }).s.dt.mode === "follow");
}

// ── unit badges ──
check("RTL uncalibrated dBFS", unitFor("rtlsdr", false) === "dBFS");
check("HackRF calibrated dBm", unitFor("hackrf", true) === "dBm");
check("Kiwi dBm", unitFor("kiwisdr", false) === "dBm");
check("UberSDR dB", unitFor("ubersdr", true) === "dB");
check("OpenWebRX dBFS", unitFor("openwebrx", true) === "dBFS");

if (failures) {
  console.log(`${failures} failure(s)`);
  process.exit(1);
}
console.log("All layout tests passed.");
