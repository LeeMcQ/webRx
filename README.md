# Radio Receiver

An application to listen to radio transmissions from your browser using a cheap USB digital TV tuner.

Try it out at [radio.ea1iti.es](https://radio.ea1iti.es).

## What is this

Radio Receiver is an HTML5 webpage that uses an USB digital TV receiver to capture radio signals, demodulates them in the browser, and plays the demodulated audio through your computer's speakers or headphones. This is called SDR (Software-Defined Radio), because all the radio signal processing is done by software running in the computer instead of purpose-built hardware.

## webRx additions

This fork adds a Rust/WebAssembly DSP core, HackRF support, GPS, an RF monitoring dashboard and full PWA support on top of the original receiver.

### Rust/WebAssembly DSP core (`dsp-rs/`)

The hottest parts of the signal chain (FIR filters, FIR decimators and the FFT) run in Rust compiled to WebAssembly with SIMD. They are swapped in at build time for the matching `@jtarrio/signals` modules with identical behaviour (`build_dsp_plugin.mjs`, `src/dsp/shims/`); if WASM can't load, the original JavaScript is used automatically. The engine can be turned off in Settings → Performance.

Measured with `npm run bench:dsp` (Node 22, same input to both engines, outputs match to ~1e-6):

| Workload | JavaScript | Rust/WASM | Speed-up |
| --- | --- | --- | --- |
| WBFM stereo @ 1.024 Msps (default) | 36% of a core | 9% | ~4× |
| WBFM stereo @ 2.4 Msps (RTL-SDR max) | 44% | 10% | ~4.2× |
| WBFM stereo @ 10 Msps (HackRF) | 48% | 17% | ~2.8× |
| NBFM / AM @ 1.024 Msps | 6–7% | 1.3–1.4% | ~4.5× |
| Spectrum FFT 2048–131072 | — | — | 1.6–1.9× |
| Monitor spectrum, one HackRF USB transfer | 4.9 s (old O(N²) DFT) | 0.6 ms | ~7600× (algorithm + Rust) |

Rebuild the WASM module after changing `dsp-rs/src` (the compiled `apps/radioreceiver/webrx_dsp.wasm` is committed so the web build doesn't need Rust):

```shell
rustup target add wasm32-unknown-unknown
npm run build:wasm          # builds, copies into the app, runs the Rust tests
```

### Supported radios

- **RTL-SDR** (RTL2832U + R820T/R828D), as before. On Windows install the WinUSB driver with Zadig.
- **HackRF One and HackRF Pro** over WebUSB (`src/devices/hackrf.ts`), following the libhackrf protocol: 1 MHz–6 GHz, 2–20 Msps, LNA/VGA gain, optional +14 dB RF amp, antenna power. No driver install on Windows. HackRF Pro is identified by its board ID.
- Settings → Device chooses **Auto**, **RTL-SDR** or **HackRF**. A device you've already authorised reconnects without the picker.

Works in Chrome and Edge on Windows, macOS, Linux, ChromeOS and Android (USB-OTG). iPhone/iPad browsers can't access USB radios.

### GPS

- **Phone / device GPS** through the Geolocation API.
- **G-MOUSE USB GPS** (or any NMEA 0183 serial GPS) through Web Serial on Chrome/Edge desktop, with baud-rate auto-detection (9600/4800/38400/115200), checksum validation and GGA/RMC/GSA/GSV/VTG parsing.

### Compass and live map

- **Compass:** on Android phones the monitor and receiver show which way the phone points (magnetic heading, tilt-compensated), next to the GPS course over ground. It's logged in the CSV as `compass_deg` and `course_deg`. iPhones need a tap on 🧭 Compass to allow motion access.
- **Live map** (monitor): your position with its accuracy circle, a heading cone, the route you've travelled with its distance, and each logged measurement as a dot coloured from weak (blue) to strong (red). Street or satellite base map, follow mode, centre, fit route and clear route. The route is kept between visits.

### RF MMN Monitor (`thesis-view.html`)

Live spectrum with peak hold, waterfall, band detail, level meter and timeline; RTL-SDR or HackRF, or Wi-Fi/cellular quality estimates from the Network Information API. Values are dBFS unless a calibration offset is entered (then dBm). The screen is kept awake while measuring.

**Recording.** Every record (with GPS position, compass, units and calibration) is saved on the device while you measure (IndexedDB, every few seconds, and straight away when you stop, switch apps or close the page). A reload, crash or a phone that put the page to sleep doesn't lose the recording: it continues where it left off. *＋ New recording* keeps the current one and starts another. *🗺 Open in Map* opens it in the MMN map (in a new tab while measuring, so recording carries on and the map follows it live), *⬇ CSV* saves it as `mmn_<device>_<freq>_<date>_<time>.csv`, and *↗ Share* (phones) sends the CSV to email, Drive, WhatsApp and so on. *Only log when GPS has a fix* skips records without a position.

### MMN map (`map.html`)

The MMN Map Visualizer, now part of the app and working on phones and desktops, online or offline:

- **Opens** the Monitor's saved recordings (listed under *Saved on this device*), CSV files from the file picker or dropped on the map, files opened with the installed app on desktop (*Open with → webRx*), and CSV files shared to webRx from other Android apps.
- **Reads** webRx CSVs and older/other recorders: comma, semicolon or tab separated, decimal commas, quoted fields, headers in any language or none at all. Latitude/longitude columns that were swapped, and southern-hemisphere latitudes saved without the minus sign, are detected and corrected (and the file is marked as corrected).
- **Views:** *Heatmap*; *Route* coloured by level (gradient or the original red/orange/green/blue steps), not joined across gaps; *Coverage* — an inverse-distance estimate between measured points, only filled within a chosen distance of a measurement; *Source* — power-weighted centre of the strongest points, with an uncertainty circle and the strongest reading marked.
- Choose the measurement (peak, band mean, spectrum mean, Power1/Power2…), filter by frequency or device, set the level range, see min/mean/max, route length and time span, and export what's shown as one CSV. *📍 My location* shows where you are.
- Map tiles you've viewed are kept for offline use in the field.

The original stand-alone `map.html` in the repository root still works and links to the new one.

The receiver and the monitor can't use the same SDR at the same time; each page opens it separately.

### Installable app (PWA)

Install from the browser menu (or the Install button). All pages, the WASM core and the icons are cached for offline use, and the app has shortcuts to the Receiver, the Monitor and the Map. Once installed, it appears in Android's share sheet for CSV files and opens `.csv` files on desktop.

### Tests

```shell
npm run bench:dsp       # JS vs WASM speed and output equivalence
npm run test:devices    # HackRF protocol (mock WebUSB), NMEA parsing, G-MOUSE (mock Web Serial)
npm run test:map        # CSV importer: webRx, legacy, European, headerless and broken files; writer round trip
npm run typecheck
cd dsp-rs && cargo test --release
```

`npm run docs` rebuilds the app into `docs/` for GitHub Pages.

## Compatible hardware and software

Radio Receiver was written to work with an RTL-2832U-based DVB-T (European digital TV) USB receiver, with a R820T tuner chip. This hardware configuration is a little dated, but support for newer tuner chips is planned.

## Building

### During development

For a development build served from your computer with live reload:

```shell
$ npm run watch
```

This script should open Radio Receiver on your browser automatically. If it doesn't, check the output and open the URL that it gives you.

Whenever you make changes, they will be compiled and the page will be reloaded automatically.

If you want to build Radio Receiver manually for development, use this command:

```shell
$ npm run build
```

The compiled application is available in the `dist/apps/radioreceiver` directory.

### For release

For a release build:

```shell
$ npm run dist
```

The compiled application is available in the `dist/apps/radioreceiver` directory; you can copy its contents to your webserver.

Note: your website must be served over HTTPS, not HTTP. This is required for WebUSB.

## Acknowledgements

This started as a fork of https://github.com/google/radioreceiver that has been updated to use the HTML5 USB API and modern features, and converted to TypeScript.

Kudos and thanks to the [RTL-SDR project](http://sdr.osmocom.org/trac/wiki/rtl-sdr) for figuring out the magic numbers needed to drive the USB tuner.

If you want to experiment further with Software-Defined Radio and listen to more things using your cheap tuner, you can try [the various programs listed on rtl-sdr.com](http://www.rtl-sdr.com/big-list-rtl-sdr-supported-software/).
