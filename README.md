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

### RF MMN Monitor (`thesis-view.html`)

Live spectrum with peak hold, waterfall, band detail, level meter and timeline; RTL-SDR or HackRF, or Wi-Fi/cellular quality estimates from the Network Information API. Measurements are logged with GPS position and exported as CSV. The CSV column names (`latitude`, `longitude`, `peak_power_db`, `band_mean_level_db`, …) are picked up directly by `map.html`. Values are dBFS unless a calibration offset is entered (then dBm). The screen is kept awake while measuring.

The receiver and the monitor can't use the same SDR at the same time; each page opens it separately.

### Installable app (PWA)

Install from the browser menu (or the Install button). Both pages, the WASM core and the icons are cached for offline use, and the app has shortcuts to the Receiver and the Monitor.

### Tests

```shell
npm run bench:dsp       # JS vs WASM speed and output equivalence
npm run test:devices    # HackRF protocol (mock WebUSB), NMEA parsing, G-MOUSE (mock Web Serial)
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
