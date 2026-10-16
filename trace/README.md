# TRACE — Timestamped RF Adaptive Calibrated Encoding

A streaming format and a station server that put one SDR's spectrum, audio,
phase-true I/Q, antenna pointing and raw bursts in any browser, with every
sample tied to GPS time and every level tied to a calibration. webRx is the
first client (Connect → Remote → server type **TRACE station**).

```
trace-core/     wire format + codecs (Rust); TypeScript twin in ../src/trace/
trace-station/  the station: drives the SDR, does the DSP once, serves clients
```

## Run a station

```shell
cd trace
cargo build --release
./target/release/trace-station --source sim                      # no hardware: test signals
./target/release/trace-station --source hackrf --freq 433.92e6 --rate 8e6 --gain lna=24,vga=20
./target/release/trace-station --source rtlsdr --freq 145.5e6 --gain 30
./target/release/trace-station --source rtltcp --device 192.168.1.20:1234 --freq 100e6
```

Then in webRx: **CM · Remote** → address `http://localhost:8090/` → type
**TRACE station** → Connect. A browser on an `https://` page may reach a
station on the same computer (`http://localhost`); a station elsewhere needs
https in front of it, for example Caddy:

```
station.example.org {
    reverse_proxy 127.0.0.1:8090
}
```

Native drivers are loaded at run time, so the station builds anywhere and only
the machine with the radio needs them: `librtlsdr` (RTL-SDR), `libhackrf`
(HackRF One / Pro), `libopus` (Opus audio; without it the station sends IMA
ADPCM). On Debian/Ubuntu/Raspberry Pi OS: `sudo apt install librtlsdr0 libhackrf0 libopus0`.

### Useful options

| Option | Meaning |
| --- | --- |
| `--source sim\|hackrf\|rtlsdr\|rtltcp`, `--device` | Receiver (rtl_tcp host:port, RTL index, HackRF serial) |
| `--freq`, `--rate`, `--gain`, `--bias-tee`, `--ppm` | Tuning and gain (`lna=24,vga=20,amp=0` or `30`) |
| `--cal-offset-db`, `--cal-uncertainty-db`, `--antenna-gain-dbi`, `--feed-loss-db` | dBFS → dBm at the antenna terminals; valid only at the gains given with `--gain` (other gains report dBFS) |
| `--heading 120` | Fixed antenna bearing (true) |
| `--rotctld host:4533` | Hamlib rotator: azimuth/elevation polled 10× a second |
| `--nmea-heading udp://0.0.0.0:10110` | NMEA heading sensor (HDT true; HDG/HDM magnetic, HDG variation used as declination) |
| `--mount-offset`, `--magnetic` | Boom vs sensor zero; the sensor reads magnetic north |
| `--pps-trigger --clock-class A\|B` | HackRF: start sampling on the PPS edge at the trigger input (A = GPSDO 10 MHz on CLKIN as well) |
| `--burst-seconds 4` | Raw I/Q history kept for burst fetches (TDoA) |
| `--token` | Required for receiver control (view and listen stay open) |
| `--lat`, `--lon`, `--height`, `--name` | Station description |
| `--sim-bearing 120 --sim-rotate 30` | Simulator: a directional target and a rotating antenna |

Without a heading source of its own, a station accepts the heading of a phone
running webRx (compass on, phone fixed to the antenna boom).

## Tracks (one WebSocket, `/trace/ws`)

| Tier | Track | Codec | Measured with the simulator |
| --- | --- | --- | --- |
| 0 | control (client → station) | CBOR | — |
| 1 | context, clock, acks | CBOR | < 1 kbit/s |
| 1 | pointing | heading samples on the station's sample clock | ≈ 3 kbit/s at 20 Hz |
| 2 | spectrum | 0.25–2 dB steps, temporal prediction, adaptive Rice | 7.4 kbit/s (256 bins, 5 fps, 1 dB) · 24.6 kbit/s (1024, 10 fps, 0.5 dB) · 171 kbit/s (2048, 25 fps, 0.25 dB) |
| 3 | audio | Opus 48 kHz (WebCodecs), else IMA ADPCM 12 kHz | ≈ 54 kbit/s at the 48 kbit/s setting |
| 4 | I/Q | block floating point, 2–16-bit mantissas | ≈ 790 kbit/s at 48 kS/s, 8 bits (formula: rate × (2m + 0.25)) |
| 5 | burst | lossless 8-bit I/Q, fetched by GPS time | 10 ms at 2.4 MS/s = 24 000 samples |

Every frame carries a 40-byte full header (sample index, GPS time, clock class,
epoch, codec, CRC-32C) at each group start and a 6–12-byte compact header
otherwise. All tracks of one receiver count the same device sample index, so
audio, spectrum, I/Q and antenna heading line up to the sample.

## Timing classes

| Class | How | Target |
| --- | --- | --- |
| A | HackRF with `--pps-trigger`, GPSDO 10 MHz on CLKIN | ≤ 50 ns |
| B | HackRF with `--pps-trigger`, own TCXO | ≤ 1 µs |
| C | host clock (NTP), steered from block arrival times | ≤ 10 ms |
| D | unknown | — |

Classes A and B are what the operator states about the wiring (`asserted` in
the clock record); they still need a bench check with two stations and a
known transmitter before TDoA results are trusted.

## Tests

```shell
cargo test                                       # codecs, DSP, ring buffer, NMEA
cargo test -p trace-core -- --ignored write_vectors   # rewrite ../bench/trace-vectors.json
cd .. && npm run test:trace                      # TypeScript decoders vs the Rust vectors
```

Not yet built (spec milestones M2–M5): WebTransport/MOQT relay, layered
(LCEVC-style) spectrum, bit-plane I/Q layers, signed records, and the TDoA
solver. Browser decoders are TypeScript for now; the Rust codecs compile to
WebAssembly once the `wasm32` target is available on the build machine.
