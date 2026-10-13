# Implementation status (branch `ui-layout-and-rm-survey`)

Implements `PROPOSAL.md` in the app. Lee's 13 Oct overrides: full range always (RTL blocked when the range needs HackRF) and dBm-only uploads (dBm calibration required before Start).

## Done
- **P0:** PR #9 review fixes merged from `main` (Kiwi x_bin axis, linear averaging, ENBW channel power, Kiwi audio rate, UberSDR race/JSON, reconnect/backoff, VHF S-meter); CSP hash refreshed. Shared tuning model (`src/apps/monitor/layout.ts`: tuned vs view, DT follow/lock, per-source memory, start-up), unit rules (dBFS local / dBm calibrated or Kiwi / dB UberSDR).
- **P1 shell:** SA·MT·DT·CM·RM·More, with WF, Bands, Settings and Help under More. The desktop rail shows every tab, with a separator. Remote renamed CM; aliases `#remote→cm`, `#rf→bands`, `#wifi→wf`, `#receiver/#map/#monitor`; `#rm` = survey. FAB stack: Connect (tap = sheet, long-press = reconnect last), Start/Stop, Rec+timer, on every tab incl. desktop. Live quick view grouped (Source/Measurement/Position/Session/Health), tap-to-jump, edge swipe, docked ≥1000 px. Bottom padding so the FAB never covers the end of a tab. Typed passband edges. Settings receiver summary. Start-tab options incl. CM/RM/WF/Bands. Storage migration (only `webrx.avgMode` removed; `rm→cm` for last/start tab).
- **RM survey:** 4-step wizard. (1) Equipment. (2) dBm calibration (saved device offset or reference measurement, antenna gain, cable loss, link to the noise-floor wizard). (3) Full parameter form with named profiles and a live size estimate. (4) Run: track map coloured by level (Douglas–Peucker display, 1 Hz redraw, paused when hidden), stats, storage vs the user limit (90 % warning, pause/stop), battery (half rate below 20 %), CPU per slice, Take snapshot, optional interval. HackRF sweep, or RTL-SDR hopping inside its range. Data path: dBm → band reduction → noise-floor squelch with hysteresis → distance/time/change gate → columnar varint chunk (0.5 dB codes, delta) → gzip → SHA-256 → IndexedDB. Upload queue: user https URL + token, Test connection, auto on Wi-Fi (Network Information) or manual "unmetered" toggle, resumable PUTs with backoff, delete 30 days after ack, never unuploaded.

## Remaining
- Survey DSP still runs on the main thread (HackRF sweep FFT lives in the device driver). Moving it to a Web Worker is the next step.
- SA soft-key bar + bottom sheets (SA keeps its existing cards/accordions); P2 presets/first-run flow; per-tab mockup gaps (MT, Bands, WF, Settings).
- Background Sync registration for uploads (uploads run while the page is open/online).
- TuningState is unit-tested but not yet the single source for SA/DT inputs (DT still has its own `dtFreq` "follows tuned" field).
