# Implementation status (branch `ui-layout-and-rm-survey`)

Implements `PROPOSAL.md` in the app. Lee's 13 Oct overrides: full range always (RTL blocked when the range needs HackRF) and dBm-only uploads (dBm calibration required before Start).

## Done
- **P0:** PR #9 review fixes merged from `main` (Kiwi x_bin axis, linear averaging, ENBW channel power, Kiwi audio rate, UberSDR race/JSON, reconnect/backoff, VHF S-meter); CSP hash refreshed. Shared tuning model (`src/apps/monitor/layout.ts`: tuned vs view, DT follow/lock, per-source memory, start-up), unit rules (dBFS local / dBm calibrated or Kiwi / dB UberSDR).
- **P1 shell:** SA·MT·DT·CM·RM·More, with WF, Bands, Settings and Help under More. The desktop rail shows every tab, with a separator. Remote renamed CM; aliases `#remote→cm`, `#rf→bands`, `#wifi→wf`, `#receiver/#map/#monitor`; `#rm` = survey. FAB stack: Connect (tap = sheet, long-press = reconnect last), Start/Stop, Rec+timer, on every tab incl. desktop. Live quick view grouped (Source/Measurement/Position/Session/Health), tap-to-jump, edge swipe, docked ≥1000 px. Bottom padding so the FAB never covers the end of a tab. Typed passband edges. Settings receiver summary. Start-tab options incl. CM/RM/WF/Bands. Storage migration (only `webrx.avgMode` removed; `rm→cm` for last/start tab).
- **RM survey:** 4-step wizard. (1) Equipment. (2) dBm calibration (saved device offset or reference measurement, antenna gain, cable loss, link to the noise-floor wizard). (3) Full parameter form with named profiles and a live size estimate. (4) Run: track map coloured by level (Douglas–Peucker display, 1 Hz redraw, paused when hidden), stats, storage vs the user limit (90 % warning, pause/stop), battery (half rate below 20 %), CPU per slice, Take snapshot, optional interval. HackRF sweep, or RTL-SDR hopping inside its range. Data path: dBm → band reduction → noise-floor squelch with hysteresis → distance/time/change gate → columnar varint chunk (0.5 dB codes, delta) → gzip → SHA-256 → IndexedDB. Upload queue: user https URL + token, Test connection, auto on Wi-Fi (Network Information) or manual "unmetered" toggle, resumable PUTs with backoff, delete 30 days after ack, never unuploaded.

## Follow-up (same PR)
- Survey processing runs in a Web Worker (`survey-worker.js`). Grid and chunk buffers are transferred to and from it; it falls back to the main thread if Workers aren't available.
- SA and DT use the shared tuning model. DT "Follow tuned / Lock to" replaces its old target field. Each source remembers its frequency. Start-up can be the last tuned or a fixed frequency. Old settings are seeded into the model.
- SA soft keys PRESET/FREQ/AMPL/BW/MARK/TRACE/MEAS: existing cards are moved into a bottom sheet (mobile) or a docked drawer (desktop). Parity check: all 121 SA element ids are present and reachable.
- The 12 presets plus a first-run flow (Connect radio / Try Remote / Demo → task grid).
- Background Sync (`webrx-survey-upload`) in the service worker, where the browser supports it.
- Proposal docs moved to `proposal/` (Pages is served from the `gh-pages` branch; this keeps them out of `docs/`).

## Remaining
- "Demo" has no synthetic SDR stream: it only lets you look around (WF has its own demo data).
- The RTL hopping and HackRF survey paths, dBm calibration and Background Sync on Android need real-hardware/device checks.
- Mockups for MT, Bands, WF and Settings are still follow-ups.
