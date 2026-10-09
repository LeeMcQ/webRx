// Hardware-free tests for the HackRF driver, device provider, NMEA parser and GPS service.
// Run with:  npm run test:devices

import {
  HackRF,
  computeBasebandFilterBw,
  sampleRateParams,
  splitGain,
} from "../src/devices/hackrf.js";
import { SdrProvider } from "../src/devices/provider.js";
import { GpsService } from "../src/gps/gps.js";
import { applyNmea, nmeaChecksumOk, NmeaFix } from "../src/gps/nmea.js";

declare const process: { exit(code: number): never };

let failures = 0;
function check(name: string, cond: boolean, detail?: any) {
  console.log(`${cond ? "✓" : "✗"} ${name}${!cond && detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  if (!cond) failures++;
}

// ── mock WebUSB HackRF ──────────────────────────────────────

type Ctrl = { dir: "in" | "out"; request: number; value: number; index: number; data?: number[] };

class MockHackRF {
  vendorId = 0x1d50;
  productId = 0x6089;
  productName = "HackRF One";
  manufacturerName = "Great Scott Gadgets";
  opened = false;
  configuration: any = null;
  log: Ctrl[] = [];
  private counter = 0;
  constructor(private boardId: number) {}
  async open() {
    this.opened = true;
  }
  async close() {
    this.opened = false;
  }
  async selectConfiguration(v: number) {
    this.configuration = { configurationValue: v };
  }
  async claimInterface() {}
  async releaseInterface() {}
  async controlTransferOut(s: any, data?: ArrayBuffer) {
    this.log.push({ dir: "out", request: s.request, value: s.value, index: s.index, data: data ? [...new Uint8Array(data)] : undefined });
    return { status: "ok", bytesWritten: data ? data.byteLength : 0 };
  }
  async controlTransferIn(s: any, len: number) {
    this.log.push({ dir: "in", request: s.request, value: s.value, index: s.index });
    let bytes: Uint8Array;
    if (s.request === 14) bytes = new Uint8Array([this.boardId]);
    else if (s.request === 15) bytes = new TextEncoder().encode("2026.01.1\0junk");
    else bytes = new Uint8Array([1]);
    return { status: "ok", data: new DataView(bytes.buffer.slice(0, Math.min(len, bytes.length))) };
  }
  async transferIn(_ep: number, len: number) {
    await new Promise((r) => setTimeout(r, 1));
    // Signed int8 IQ: I = counter (wrapping), Q = -counter.
    const b = new Uint8Array(len);
    for (let i = 0; i < len; i += 2) {
      const v = ((this.counter++ % 256) + 256) % 256;
      b[i] = (v - 128) & 0xff; // int8 value v-128
      b[i + 1] = (127 - v) & 0xff;
    }
    return { status: "ok", data: new DataView(b.buffer) };
  }
}

async function testHackRF() {
  check("baseband filter 1.5 MHz → 1.75 MHz", computeBasebandFilterBw(1_500_000) === 1_750_000);
  check("baseband filter 7.5 MHz → 7 MHz", computeBasebandFilterBw(7_500_000) === 7_000_000);
  check("baseband filter 15 MHz → 15 MHz", computeBasebandFilterBw(15_000_000) === 15_000_000);
  check("sample rate 10 MHz → (10e6, 1)", JSON.stringify(sampleRateParams(10e6)) === JSON.stringify({ freqHz: 10_000_000, divider: 1 }));
  check("sample rate 2.5e6/3 → divider 3", sampleRateParams(2.5e6 / 3).divider === 3);
  const g = splitGain(50);
  check("gain 50 → LNA 40 / VGA 62", g.lna === 40 && g.vga === 62, g);
  const g0 = splitGain(0);
  check("gain 0 → LNA 0 / VGA 0", g0.lna === 0 && g0.vga === 0, g0);

  const dev = new MockHackRF(5);
  const hackrf = await HackRF.open(dev as unknown as USBDevice);
  check("board ID 5 identified as HackRF Pro", hackrf.info.boardName === "HackRF Pro", hackrf.info);
  check("firmware string read", hackrf.info.firmware === "2026.01.1", hackrf.info.firmware);
  check("RF amp off by default", dev.log.some((c) => c.request === 17 && c.value === 0));

  dev.log = [];
  const rate = await hackrf.setSampleRate(1_024_000);
  check("sub-2 Msps request clamped to 2 Msps", rate === 2_000_000, rate);
  const sr = dev.log.find((c) => c.request === 6)!;
  const dv = new DataView(new Uint8Array(sr.data!).buffer);
  check("SAMPLE_RATE_SET payload (2e6, 1)", dv.getUint32(0, true) === 2_000_000 && dv.getUint32(4, true) === 1);
  const bw = dev.log.find((c) => c.request === 7)!;
  check("baseband filter set to 1.75 MHz", bw.value + bw.index * 65536 === 1_750_000, bw);

  dev.log = [];
  await hackrf.setCenterFrequency(433_920_000);
  const f = dev.log.find((c) => c.request === 16)!;
  const fv = new DataView(new Uint8Array(f.data!).buffer);
  check("SET_FREQ payload 433 MHz + 920000 Hz", fv.getUint32(0, true) === 433 && fv.getUint32(4, true) === 920_000);

  dev.log = [];
  await hackrf.setGain(25);
  const lna = dev.log.find((c) => c.request === 19)!;
  const vga = dev.log.find((c) => c.request === 20)!;
  check("gain 25 → LNA 24 dB, VGA 32 dB (IN requests)", lna.dir === "in" && lna.index === 24 && vga.index === 32, { lna, vga });

  dev.log = [];
  await hackrf.enableBiasTee(true);
  check("bias tee → ANTENNA_ENABLE=1", dev.log.some((c) => c.request === 23 && c.value === 1));

  dev.log = [];
  await hackrf.resetBuffer();
  check("RX mode set on start", dev.log.some((c) => c.request === 1 && c.value === 1));
  const [a, b] = await Promise.all([hackrf.readSamples(100_000), hackrf.readSamples(100_000)]);
  const ua = new Uint8Array(a.data);
  const ub = new Uint8Array(b.data);
  check("block sizes are 2 bytes/sample", ua.length === 200_000 && ub.length === 200_000);
  // int8 (v-128) XOR 0x80 → uint8 v, i.e. the counter itself.
  let ordered = true;
  for (let i = 0; i < 1000; ++i) if (ua[2 * i] !== i % 256) ordered = false;
  check("int8 → uint8 conversion matches RTL format", ordered, [...ua.slice(0, 8)]);
  const lastA = ua[ua.length - 2];
  check("concurrent reads resolve in stream order", ub[0] === (lastA + 1) % 256, { lastA, firstB: ub[0] });
  check("frequency tagged on block", a.frequency === 433_920_000);
  await hackrf.close();
  check("RX mode off on close", dev.log.some((c) => c.request === 1 && c.value === 0));

  // Provider: a single granted HackRF is reused without the picker.
  let pickerShown = false;
  const usb = {
    getDevices: async () => [new MockHackRF(2)],
    requestDevice: async () => {
      pickerShown = true;
      throw new Error("no");
    },
  } as unknown as USB;
  let connectedName = "";
  const provider = new SdrProvider({ kind: () => "auto", usb, onConnect: (c) => (connectedName = c.name) });
  await provider.get();
  check("provider reuses granted HackRF without picker", !pickerShown && connectedName === "HackRF One", connectedName);
  const rtlOnly = new SdrProvider({ kind: () => "rtlsdr", usb });
  let threw = false;
  try {
    await rtlOnly.get();
  } catch (e) {
    threw = true;
  }
  check("RTL-only mode ignores the HackRF and asks for a device", threw && pickerShown);
}

// ── NMEA ────────────────────────────────────────────────────

function withChecksum(body: string): string {
  let cs = 0;
  for (let i = 0; i < body.length; ++i) cs ^= body.charCodeAt(i);
  return `$${body}*${cs.toString(16).toUpperCase().padStart(2, "0")}`;
}

const GGA = withChecksum("GNGGA,083012.00,3327.1234,S,01843.5678,E,1,09,0.92,61.3,M,32.1,M,,");
const RMC = withChecksum("GNRMC,083012.00,A,3327.1234,S,01843.5678,E,12.5,271.4,091026,,,A");
const GSA = withChecksum("GNGSA,A,3,05,13,15,18,20,23,24,,,,,,1.71,0.92,1.44");
const GSV1 = withChecksum("GPGSV,3,1,11,05,45,123,40,13,30,060,38,15,70,300,42,18,20,200,35");
const GSV2 = withChecksum("GLGSV,2,1,06,65,40,100,33,66,60,200,36,74,10,050,20,75,30,330,29");

function testNmea() {
  check("checksum accepts valid sentence", nmeaChecksumOk(GGA));
  check("checksum rejects corrupted sentence", !nmeaChecksumOk(GGA.replace("3327", "3328")));
  const fix: NmeaFix = {};
  for (const s of [GGA, RMC, GSA, GSV1, GSV2]) applyNmea(fix, s);
  check("latitude south is negative", Math.abs(fix.lat! - -(33 + 27.1234 / 60)) < 1e-9, fix.lat);
  check("longitude east is positive", Math.abs(fix.lon! - (18 + 43.5678 / 60)) < 1e-9, fix.lon);
  check("altitude, sats, HDOP from GGA", fix.alt === 61.3 && fix.satellites === 9 && fix.hdop === 0.92, fix);
  check("speed knots → km/h, heading", Math.abs(fix.speedKmh! - 12.5 * 1.852) < 1e-9 && fix.headingDeg === 271.4);
  check("3D fix and PDOP from GSA", fix.fixMode === "3D" && fix.pdop === 1.71);
  check("satellites in view summed across GPS+GLONASS", fix.satellitesInView === 17, fix.satellitesInView);
  const empty: NmeaFix = {};
  applyNmea(empty, withChecksum("GPGGA,083012.00,,,,,0,00,99.99,,,,,,"));
  check("no-fix GGA leaves position empty", empty.lat === undefined && empty.fixQuality === 0);
}

// ── mock Web Serial G-MOUSE (4800 baud) ─────────────────────

async function testGps() {
  const enc = new TextEncoder();
  let openedAt: number[] = [];
  const port = {
    baud: 0,
    readable: null as ReadableStream<Uint8Array> | null,
    async open(o: { baudRate: number }) {
      this.baud = o.baudRate;
      openedAt.push(o.baudRate);
      const baud = o.baudRate;
      let timer: any;
      this.readable = new ReadableStream<Uint8Array>({
        start(ctrl) {
          timer = setInterval(() => {
            // Correct NMEA only at 4800 baud; noise otherwise.
            if (baud === 4800) ctrl.enqueue(enc.encode(`${GGA}\r\n${RMC}\r\n${GSA}\r\n`));
            else ctrl.enqueue(new Uint8Array([0xff, 0x13, 0x7e, 0x00, 0xa5]));
          }, 100);
        },
        cancel() {
          clearInterval(timer);
        },
      });
    },
    async close() {
      this.readable = null;
    },
  };
  Object.defineProperty(globalThis.navigator, "serial", {
    configurable: true,
    value: { getPorts: async () => [port], requestPort: async () => port },
  });
  const svc = new GpsService();
  const got = new Promise<void>((resolve) => {
    svc.addEventListener("change", () => {
      if (svc.status.state === "fix") resolve();
    });
  });
  await svc.start("gmouse", { pickPort: false });
  await Promise.race([got, new Promise((r) => setTimeout(r, 8000))]);
  const s = svc.status;
  check("G-MOUSE baud auto-detected (9600 silent → 4800)", s.baud === 4800 && openedAt[0] === 9600, { baud: s.baud, openedAt });
  check("G-MOUSE fix decoded", s.state === "fix" && s.fix?.source === "gmouse" && Math.abs(s.fix!.lat + 33.452) < 0.001, s.fix);
  check("fix label includes 3D", (s.fix?.fixLabel ?? "").includes("3D"), s.fix?.fixLabel);
  await svc.stop();
  check("stop returns to off", svc.status.state === "off");
}

(async () => {
  await testHackRF();
  testNmea();
  await testGps();
  console.log(failures === 0 ? "\nAll device/GPS tests passed." : `\n${failures} test(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
})();
