import { bestChannels, centreChannel, channelLabel, channelToFreq, freqToChannel, fsplDistanceM, rateChannels, span } from "../src/apps/monitor/wifimath.js";
declare const process: { exit(code: number): never };
let failures = 0;
function check(name: string, cond: boolean, detail?: any) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  if (!cond) failures++;
}
const eq = (n: string, a: any, b: any) => check(n, JSON.stringify(a) === JSON.stringify(b), { got: a, want: b });
eq("2412 → ch1", freqToChannel(2412), 1);
eq("2484 → ch14", freqToChannel(2484), 14);
eq("5180 → ch36", freqToChannel(5180), 36);
eq("5955 → 6G ch1", freqToChannel(5955), 1);
eq("6G ch93 → 6415", channelToFreq(93, "6"), 6415);
eq("ch1 40 MHz → 1(3)", channelLabel(2412, 40), "1(3)");
eq("ch11 40 MHz → 11(9)", channelLabel(2462, 40), "11(9)");
eq("ch1 40 span", span(2412, 40), [2402, 2442]);
eq("ch6 20 span", span(2437, 20), [2427, 2447]);
eq("ch40 80 MHz → 40(42)", channelLabel(5200, 80), "40(42)");
eq("ch36 80 span 5170-5250", span(5180, 80), [5170, 5250]);
eq("ch149 80 MHz → 149(155)", channelLabel(5745, 80), "149(155)");
eq("ch161 80 MHz → 161(155)", channelLabel(5805, 80), "161(155)");
eq("ch100 160 → 114", centreChannel(5500, 160), 114);
eq("ch44 40 → 46", centreChannel(5220, 40), 46);
eq("centerFreq0 wins", centreChannel(5180, 80, 5210), 42);
eq("6G ch5 80 → 7", centreChannel(5975, 80), 7);
eq("6G ch1 40 → 3", centreChannel(5955, 40), 3);
check("FSPL -40 dBm @2437 ≈ 0.98 m", Math.abs(fsplDistanceM(-40, 2437) - 0.98) < 0.05, fsplDistanceM(-40, 2437));
check("FSPL -70 dBm @5180 ≈ 14.6 m", Math.abs(fsplDistanceM(-70, 5180) - 14.6) < 0.5, fsplDistanceM(-70, 5180));
const aps = [{ ssid: "a", bssid: "1", rssi: -40, freq: 2412, width: 20 as const }, { ssid: "b", bssid: "2", rssi: -50, freq: 2437, width: 20 as const }];
const r = rateChannels(aps, "2.4");
eq("ch3 overlaps ch1 and ch6 APs", r.find((x) => x.ch === 3)!.count, 2);
eq("ch13 clear of ch1/ch6", r.find((x) => x.ch === 13)!.count, 0);
eq("ch11 clear", r.find((x) => x.ch === 11)!.count, 0);
eq("best 2.4 = 11 first, 1/6/11 only", bestChannels(aps, "2.4"), [11, 6, 1]);
if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nAll Wi-Fi maths tests passed.");
