//! The station's DSP thread: one receiver, one spectrum engine, one clock,
//! one burst ring — and per client only what that client subscribed to.
//!
//! Inputs: sample blocks from the reader thread, commands from WebSocket
//! sessions, heading samples from pointing inputs. Outputs: TRACE frames into
//! each client's two queues — `crit` (unbounded: control, context, clock,
//! bursts) and `media` (bounded: spectrum, audio, I/Q, pointing; frames are
//! dropped, never queued without limit, when a client falls behind).

use crate::dsp::audio::{AudioChain, Mode};
use crate::dsp::iq::IqChain;
use crate::dsp::spectrum::{view, SpecEngine, ENBW_BINS};
use crate::opus::OpusEnc;
use crate::pointing_in::PointIn;
use crate::ring::Ring;
use crate::source::Gains;
use rustfft::num_complex::Complex32 as C32;
use std::collections::BTreeMap;
use std::sync::mpsc::{Receiver, Sender};
use std::time::{Duration, Instant};
use tokio::sync::mpsc::{error::TrySendError, Sender as TSender, UnboundedSender};
use trace_core::clock::{unix_ns_to_gps_ns, Anchor, ClockClass};
use trace_core::context::*;
use trace_core::header::{FullHeader, TrackWriter};
use trace_core::{
    adpcm, bfp, burst, codec, flags, pointing, spectrum::SpectrumEncoder, Tier, VERSION,
};

/// Commands to the reader thread (it owns the device).
pub enum DevCmd {
    Tune(f64),
    Rate(f64),
    Gain(Gains, Option<bool>),
    Bias(bool),
}

#[derive(Clone, Debug)]
pub struct DevState {
    pub device: Device,
    pub centre: f64,
    pub rate: f64,
    pub gains: Gains,
    pub auto: bool,
    pub bias: bool,
    pub ppm: f64,
    pub pps: bool,
    /// When the reader started the stream (Unix ns), for PPS-aligned anchors.
    pub start_unix_ns: u128,
}

pub enum RxEvent {
    Block {
        data: Vec<i8>,
        dropped: u64,
        arrival_unix_ns: u128,
    },
    Config(DevState, bool),
    Error(String),
}

pub enum DspCmd {
    Add {
        id: u64,
        peer: String,
        crit: UnboundedSender<Vec<u8>>,
        media: TSender<Vec<u8>>,
    },
    Remove {
        id: u64,
    },
    Msg {
        id: u64,
        msg: ClientMsg,
    },
}

#[derive(Clone, Debug)]
pub struct CalConfig {
    pub id: String,
    pub offset_db: f64,
    pub uncertainty_db: f64,
    pub antenna_gain_dbi: f64,
    pub feed_loss_db: f64,
    /// Gains the calibration was made at; other gains make levels dBFS.
    pub gains: Gains,
}

#[derive(Clone, Debug)]
pub struct Config {
    pub station: Station,
    pub fft: usize,
    pub burst_seconds: f64,
    pub cal: Option<CalConfig>,
    pub token: Option<String>,
    /// Operator's statement of the timing hardware (A/B need PPS in the samples).
    pub clock_class: ClockClass,
    pub deemph_us: f64,
    pub pointing: Option<PointingCtx>,
}

struct AudioState {
    sub: AudioSub,
    chain: AudioChain,
    opus: Option<OpusEnc>,
    adpcm: adpcm::Encoder,
    pcm: Vec<f32>,
    /// Device index of pcm[0].
    pcm_index: f64,
    writer: TrackWriter,
    last_key: Instant,
}

struct IqState {
    sub: IqSub,
    chain: IqChain,
    buf: Vec<C32>,
    /// Device index (fractional, delay-corrected) of buf[0].
    origin: f64,
    writer: TrackWriter,
    last_key: Instant,
}

struct Client {
    peer: String,
    name: String,
    crit: UnboundedSender<Vec<u8>>,
    media: TSender<Vec<u8>>,
    authed: bool,
    codecs: Vec<String>,
    spec: Option<SpectrumSub>,
    spec_enc: SpectrumEncoder,
    spec_w: TrackWriter,
    spec_acc: Vec<f64>,
    spec_n: u32,
    spec_index: u64,
    spec_last: Instant,
    spec_key: Instant,
    spec_force_key: bool,
    spec_ctx: Option<SpectrumCtx>,
    audio: Option<AudioState>,
    iq: Option<IqState>,
    pointing: bool,
    ctx_w: TrackWriter,
    point_w: TrackWriter,
    burst_w: TrackWriter,
    rev: u16,
    dropped: u64,
}

struct PendingFetch {
    client: u64,
    from: u64,
    count: usize,
    deadline: Instant,
}

pub struct Engine {
    cfg: Config,
    dev: DevState,
    dev_tx: Sender<DevCmd>,
    epoch: u32,
    index: u64,
    anchor: Option<Anchor>,
    class: ClockClass,
    asserted: bool,
    resid_min: Option<i64>,
    resid_window: Instant,
    corrected_ns: i64,
    anchor_since: Instant,
    spec: SpecEngine,
    tick_last: Instant,
    ring: Ring,
    clients: BTreeMap<u64, Client>,
    holder: Option<u64>,
    last_clock: Instant,
    overload: bool,
    pending_flags: u16,
    points: Vec<(PointIn, u64)>,
    points_last: Instant,
    fetches: Vec<PendingFetch>,
    opus_ok: bool,
    cvt: Vec<C32>,
}

fn class_u8(c: ClockClass) -> u8 {
    c as u8
}

impl Engine {
    pub fn new(cfg: Config, dev: DevState, dev_tx: Sender<DevCmd>) -> Self {
        let ring = Ring::new((cfg.burst_seconds * dev.rate) as usize);
        Self {
            spec: SpecEngine::new(cfg.fft, dev.rate, 3000.0),
            cfg,
            dev,
            dev_tx,
            epoch: 0,
            index: 0,
            anchor: None,
            class: ClockClass::C,
            asserted: false,
            resid_min: None,
            resid_window: Instant::now(),
            corrected_ns: 0,
            anchor_since: Instant::now(),
            tick_last: Instant::now(),
            ring,
            clients: BTreeMap::new(),
            holder: None,
            last_clock: Instant::now(),
            overload: false,
            pending_flags: 0,
            points: Vec::new(),
            points_last: Instant::now(),
            fetches: Vec::new(),
            opus_ok: OpusEnc::available(),
            cvt: Vec::new(),
        }
    }

    pub fn run(mut self, rx: Receiver<RxEvent>, cmds: Receiver<DspCmd>, points: Receiver<PointIn>) {
        loop {
            while let Ok(c) = cmds.try_recv() {
                self.command(c);
            }
            while let Ok(p) = points.try_recv() {
                self.point(p);
            }
            match rx.recv_timeout(Duration::from_millis(20)) {
                Ok(RxEvent::Block {
                    data,
                    dropped,
                    arrival_unix_ns,
                }) => self.block(data, dropped, arrival_unix_ns),
                Ok(RxEvent::Config(d, restarted)) => self.reconfigured(d, restarted),
                Ok(RxEvent::Error(e)) => {
                    eprintln!("receiver: {e}");
                    self.broadcast_msg(&ServerMsg::Error {
                        message: format!("Receiver: {e}"),
                    });
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(_) => return,
            }
            self.housekeeping();
        }
    }

    // ── time ──

    fn time_of(&self, n: u64) -> (u64, u32) {
        self.anchor.map(|a| a.time_of(n)).unwrap_or((0, 0))
    }

    fn header(&self, tier: Tier, codec: u8, flags: u16, index: u64, rev: u16) -> FullHeader {
        let (t, frac) = self.time_of(index);
        let mut f = flags | self.pending_flags;
        if self.overload {
            f |= trace_core::flags::OVERLOAD;
        }
        if !self.calibrated() && matches!(tier, Tier::Spectrum | Tier::Iq) {
            f |= trace_core::flags::UNCALIBRATED;
        }
        FullHeader {
            version: VERSION,
            tier: tier as u8,
            flags: f,
            epoch: self.epoch,
            sample_index: index,
            time_ns: t,
            time_frac: frac,
            clock_class: if self.anchor.is_some() {
                class_u8(self.class)
            } else {
                3
            },
            codec,
            context_rev: rev,
        }
    }

    fn establish_anchor(&mut self, first_index: u64, n: usize, arrival: u128) {
        let fs = self.dev.rate;
        let (num, den) = rational(fs);
        if self.dev.pps && self.cfg.clock_class != ClockClass::C {
            // sample 0 sits on the PPS edge that followed the start command
            let start_gps = unix_ns_to_gps_ns(self.dev.start_unix_ns);
            let edge = start_gps.div_ceil(1_000_000_000) * 1_000_000_000;
            self.anchor = Some(Anchor::new(0, edge, num, den));
            self.class = self.cfg.clock_class;
            self.asserted = true;
        } else {
            let t_first = unix_ns_to_gps_ns(arrival) as i128 - (n as f64 / fs * 1e9) as i128;
            self.anchor = Some(Anchor::new(first_index, t_first.max(0) as u64, num, den));
            self.class = ClockClass::C;
            self.asserted = false;
        }
        self.anchor_since = Instant::now();
        self.corrected_ns = 0;
        self.resid_min = None;
        self.resid_window = Instant::now();
    }

    /// Host-clock anchors: track the smallest arrival residual over 2 s windows and steer towards it.
    fn steer(&mut self, end_index: u64, arrival: u128) {
        let Some(a) = self.anchor else { return };
        if self.class != ClockClass::C {
            return;
        }
        let (t, _) = a.time_of(end_index);
        let r = unix_ns_to_gps_ns(arrival) as i64 - t as i64;
        self.resid_min = Some(self.resid_min.map_or(r, |m| m.min(r)));
        if self.resid_window.elapsed() >= Duration::from_secs(2) {
            let m = self.resid_min.take().unwrap_or(0);
            // half-gain correction; arrivals are late by USB/thread latency, never early
            let step = m / 2;
            let (t_now, f_now) = a.time_of(end_index);
            let t_new = (t_now as i64 + step).max(0) as u64;
            self.anchor = Some(Anchor {
                n0: end_index,
                t0_ns: t_new,
                t0_frac: f_now,
                ..a
            });
            self.corrected_ns += step;
            self.resid_window = Instant::now();
        }
    }

    fn clock_record(&self) -> Option<ClockRecord> {
        let a = self.anchor?;
        let eps = if self.class == ClockClass::C {
            -(self.corrected_ns as f64) / self.anchor_since.elapsed().as_secs_f64().max(1.0)
        } else {
            0.0
        };
        Some(ClockRecord {
            class: class_u8(self.class),
            err_ns: self.class.target_ns(),
            n0: a.n0,
            t0_ns: a.t0_ns,
            t0_frac: a.t0_frac,
            fs: a.fs_num as f64 / a.fs_den as f64,
            eps_ppb: eps,
            lock: match self.class {
                ClockClass::A => "gpsdo".into(),
                ClockClass::B => "pps".into(),
                ClockClass::C => "host".into(),
                ClockClass::D => "none".into(),
            },
            holdover_s: 0,
            last_pps_index: if self.dev.pps { Some(0) } else { None },
            asserted: self.asserted,
        })
    }

    // ── calibration ──

    fn calibrated(&self) -> bool {
        match &self.cfg.cal {
            Some(c) => {
                c.gains.iter().all(|(k, v)| {
                    self.dev
                        .gains
                        .get(k)
                        .map_or(false, |g| (g - v).abs() < 0.05)
                }) && !self.dev.auto
            }
            None => false,
        }
    }

    fn offset_db(&self) -> f64 {
        if self.calibrated() {
            self.cfg.cal.as_ref().map_or(0.0, |c| c.offset_db)
        } else {
            0.0
        }
    }

    // ── samples ──

    fn block(&mut self, data: Vec<i8>, dropped: u64, arrival: u128) {
        let n = data.len() / 2;
        if n == 0 {
            return;
        }
        if dropped > 0 {
            self.index += dropped;
            self.epoch += 1;
            self.pending_flags |= flags::DROPPED | flags::PHASE_BREAK;
        }
        let first = self.index;
        if self.anchor.is_none() {
            self.establish_anchor(first, n, arrival);
        }
        self.ring.push(&data, first);
        self.overload |= data.iter().any(|&v| v == 127 || v == -128 || v == -127);
        self.cvt.clear();
        self.cvt.extend(
            data.chunks(2)
                .map(|c| C32::new(c[0] as f32 / 128.0, c[1] as f32 / 128.0)),
        );
        let x = std::mem::take(&mut self.cvt);
        self.spec.feed(&x);
        let ids: Vec<u64> = self.clients.keys().copied().collect();
        for id in ids {
            self.client_audio(id, &x, first);
            self.client_iq(id, &x, first);
        }
        self.cvt = x;
        self.index += n as u64;
        self.steer(self.index, arrival);
        self.serve_fetches();
        if self.tick_last.elapsed() >= Duration::from_millis(33) {
            self.tick_last = Instant::now();
            if let Some((p, _)) = self.spec.take() {
                self.spectrum_tick(&p, first);
            }
            self.overload = false;
            self.pending_flags = 0;
        }
    }

    fn spectrum_tick(&mut self, p: &[f64], index: u64) {
        let band_lo = self.dev.centre - self.dev.rate / 2.0;
        let fs = self.dev.rate;
        let off = self.offset_db();
        let ids: Vec<u64> = self.clients.keys().copied().collect();
        for id in ids {
            let Some(c) = self.clients.get_mut(&id) else {
                continue;
            };
            let Some(sub) = c.spec.clone() else { continue };
            if c.spec_acc.len() != p.len() {
                c.spec_acc = vec![0.0; p.len()];
                c.spec_n = 0;
            }
            if c.spec_n == 0 {
                c.spec_index = index;
            }
            for (a, v) in c.spec_acc.iter_mut().zip(p) {
                *a += v;
            }
            c.spec_n += 1;
            let period = Duration::from_secs_f32(1.0 / sub.fps.clamp(0.5, 30.0));
            if c.spec_last.elapsed() < period {
                continue;
            }
            c.spec_last = Instant::now();
            let k = c.spec_n as f64;
            let avg: Vec<f64> = c.spec_acc.iter().map(|v| v / k).collect();
            c.spec_acc.iter_mut().for_each(|v| *v = 0.0);
            c.spec_n = 0;
            let (db, start, span) = view(
                &avg,
                band_lo,
                fs,
                sub.centre_hz,
                sub.span_hz,
                sub.bins as usize,
                off,
            );
            c.spec_enc.set_step(sub.step_db.clamp(0.05, 10.0));
            let ctx = SpectrumCtx {
                fft_size: p.len() as u32,
                rbw_hz: ENBW_BINS * fs / p.len() as f64
                    * (span / fs * p.len() as f64 / db.len() as f64).max(1.0),
                detector: "rms".into(),
                window: "blackman-harris".into(),
                bins: db.len() as u32,
                start_hz: start,
                span_hz: span,
                fps: sub.fps,
                step_db: c.spec_enc.step_db(),
            };
            let changed = c.spec_ctx.as_ref().map_or(true, |o| {
                o.bins != ctx.bins
                    || (o.start_hz - ctx.start_hz).abs() > 1e-3
                    || (o.span_hz - ctx.span_hz).abs() > 1e-3
                    || o.step_db != ctx.step_db
            });
            let spec_index = c.spec_index;
            if changed {
                c.spec_ctx = Some(ctx);
                c.spec_force_key = true;
                self.send_context(id);
            }
            let Some(c) = self.clients.get_mut(&id) else {
                continue;
            };
            let key = c.spec_force_key || c.spec_key.elapsed() >= Duration::from_secs(1);
            if key {
                c.spec_key = Instant::now();
                c.spec_force_key = false;
            }
            let payload = c.spec_enc.encode(&db, key);
            let rev = c.rev;
            let h = self.header(
                Tier::Spectrum,
                codec::SPECTRUM_RICE,
                if key { flags::KEY } else { 0 },
                spec_index,
                rev,
            );
            let c = self.clients.get_mut(&id).unwrap();
            let frame = c.spec_w.write(key, &h, &payload);
            if !push_media(c, frame) {
                // the decoder would miss this frame's reference: restart from a key frame
                c.spec_force_key = true;
                c.spec_w.reset();
            }
        }
    }

    fn client_audio(&mut self, id: u64, x: &[C32], first: u64) {
        let fs = self.dev.rate;
        let Some(c) = self.clients.get_mut(&id) else {
            return;
        };
        let Some(a) = c.audio.as_mut() else { return };
        if a.pcm.is_empty() {
            a.pcm_index = first as f64;
        }
        a.chain.process(x, &mut a.pcm);
        let frame = if a.opus.is_some() {
            OpusEnc::FRAME
        } else {
            240
        };
        let rate = a.chain.out_rate;
        let mut out = Vec::new();
        while a.pcm.len() >= frame {
            let chunk: Vec<f32> = a.pcm.drain(..frame).collect();
            let idx = a.pcm_index.round() as u64;
            a.pcm_index += frame as f64 * fs / rate;
            let (codec_id, payload) = match a.opus.as_mut() {
                Some(o) => match o.encode(&chunk) {
                    Ok(p) => (codec::OPUS, p),
                    Err(_) => continue,
                },
                None => {
                    let pcm: Vec<i16> = chunk.iter().map(|v| (v * 32767.0) as i16).collect();
                    (codec::IMA_ADPCM, a.adpcm.encode(&pcm, rate as u32))
                }
            };
            let key = a.last_key.elapsed() >= Duration::from_secs(1);
            if key {
                a.last_key = Instant::now();
            }
            out.push((key, codec_id, idx, payload));
        }
        let rev = c.rev;
        for (key, codec_id, idx, payload) in out {
            let h = self.header(
                Tier::Audio,
                codec_id,
                if key { flags::KEY } else { 0 },
                idx,
                rev,
            );
            let c = self.clients.get_mut(&id).unwrap();
            let a = c.audio.as_mut().unwrap();
            let f = a.writer.write(key, &h, &payload);
            if !push_media(c, f) {
                c.audio.as_mut().unwrap().writer.reset();
            }
        }
    }

    fn client_iq(&mut self, id: u64, x: &[C32], first: u64) {
        let Some(c) = self.clients.get_mut(&id) else {
            return;
        };
        let Some(q) = c.iq.as_mut() else { return };
        if q.buf.is_empty() && q.origin < 0.0 {
            q.origin = first as f64 - q.chain.delay;
        }
        q.chain.process(x, &mut q.buf);
        let per = ((q.chain.rate * 0.02) as usize).clamp(256, 8192);
        let d = q.chain.decimation as f64;
        let mut frames = Vec::new();
        while q.buf.len() >= per {
            let blk: Vec<C32> = q.buf.drain(..per).collect();
            let idx = q.origin.max(0.0).round() as u64;
            q.origin += per as f64 * d;
            let iq16: Vec<i16> = blk
                .iter()
                .flat_map(|z| {
                    [
                        (z.re * 32767.0).round().clamp(-32768.0, 32767.0) as i16,
                        (z.im * 32767.0).round().clamp(-32768.0, 32767.0) as i16,
                    ]
                })
                .collect();
            let payload = bfp::encode(&iq16, q.sub.bits.clamp(2, 16));
            let key = q.last_key.elapsed() >= Duration::from_secs(1);
            if key {
                q.last_key = Instant::now();
            }
            frames.push((key, idx, payload));
        }
        let rev = c.rev;
        for (key, idx, payload) in frames {
            let h = self.header(
                Tier::Iq,
                codec::BFP,
                if key { flags::KEY } else { 0 },
                idx,
                rev,
            );
            let c = self.clients.get_mut(&id).unwrap();
            let f = c.iq.as_mut().unwrap().writer.write(key, &h, &payload);
            if !push_media(c, f) {
                c.iq.as_mut().unwrap().writer.reset();
            }
        }
    }

    // ── pointing ──

    fn point(&mut self, p: PointIn) {
        let Some(a) = self.anchor else { return };
        let idx = a.index_of(unix_ns_to_gps_ns(p.unix_ns));
        // keep one batch per source; flush when the source changes
        if let Some((last, _)) = self.points.last() {
            if last.source != p.source || last.magnetic != p.magnetic {
                self.flush_points();
            }
        }
        self.points.push((p, idx));
        if self.points.len() >= 40 {
            self.flush_points();
        }
    }

    fn flush_points(&mut self) {
        self.points_last = Instant::now();
        if self.points.is_empty() {
            return;
        }
        let mut pts = std::mem::take(&mut self.points);
        pts.sort_by_key(|(_, i)| *i);
        let (p0, base) = (&pts[0].0, pts[0].1);
        let meta = pointing::Meta {
            magnetic: p0.magnetic,
            declination_deg: p0.declination,
            source: p0.source,
            element: p0.element,
        };
        let samples: Vec<pointing::Sample> = pts
            .iter()
            .map(|(p, i)| pointing::Sample {
                index: *i,
                heading_deg: p.heading,
                pitch_deg: p.pitch,
                roll_deg: p.roll,
                accuracy_deg: p.accuracy,
            })
            .collect();
        let payload = pointing::encode(base, &meta, &samples);
        let ids: Vec<u64> = self
            .clients
            .iter()
            .filter(|(_, c)| c.pointing)
            .map(|(i, _)| *i)
            .collect();
        for id in ids {
            let rev = self.clients[&id].rev;
            let h = self.header(Tier::Context, codec::POINTING, flags::KEY, base, rev);
            let c = self.clients.get_mut(&id).unwrap();
            let f = c.point_w.write(true, &h, &payload);
            push_media(c, f);
        }
    }

    // ── bursts ──

    fn serve_fetches(&mut self) {
        if self.fetches.is_empty() {
            return;
        }
        let now = Instant::now();
        let mut keep = Vec::new();
        for f in std::mem::take(&mut self.fetches) {
            if f.from + f.count as u64 <= self.ring.end {
                self.send_burst(f.client, f.from, f.count);
            } else if now < f.deadline {
                keep.push(f);
            } else {
                self.reply(
                    f.client,
                    &ServerMsg::Error {
                        message: "Burst window never arrived (the receiver stopped?)".into(),
                    },
                );
            }
        }
        self.fetches = keep;
    }

    fn send_burst(&mut self, id: u64, from: u64, count: usize) {
        let Some(data) = self.ring.read(from, count) else {
            self.reply(
                id,
                &ServerMsg::Error {
                    message: "That window is no longer in the station's burst buffer".into(),
                },
            );
            return;
        };
        const CHUNK: usize = 65_536;
        let mut frames = 0u32;
        for (k, part) in data.chunks(2 * CHUNK).enumerate() {
            let idx = from + (k * CHUNK) as u64;
            let payload = burst::encode(part);
            let rev = self.clients.get(&id).map_or(0, |c| c.rev);
            let h = self.header(Tier::Burst, codec::LOSSLESS_I8, flags::KEY, idx, rev);
            if let Some(c) = self.clients.get_mut(&id) {
                let f = c.burst_w.write(true, &h, &payload);
                let _ = c.crit.send(f);
                frames += 1;
            }
        }
        self.reply(
            id,
            &ServerMsg::BurstDone {
                from_index: from,
                samples: count as u64,
                frames,
            },
        );
    }

    // ── messages ──

    fn send_cbor(&mut self, id: u64, msg: &ServerMsg) {
        let payload = to_cbor(msg);
        let rev = self.clients.get(&id).map_or(0, |c| c.rev);
        let h = self.header(Tier::Context, codec::CBOR, flags::KEY, self.index, rev);
        if let Some(c) = self.clients.get_mut(&id) {
            let f = c.ctx_w.write(true, &h, &payload);
            let _ = c.crit.send(f);
        }
    }

    fn reply(&mut self, id: u64, msg: &ServerMsg) {
        self.send_cbor(id, msg);
    }

    fn broadcast_msg(&mut self, msg: &ServerMsg) {
        let ids: Vec<u64> = self.clients.keys().copied().collect();
        for id in ids {
            self.send_cbor(id, msg);
        }
    }

    fn context_for(&self, id: u64) -> Option<ContextRecord> {
        let c = self.clients.get(&id)?;
        let cal = self
            .cfg
            .cal
            .as_ref()
            .filter(|_| self.calibrated())
            .map(|k| Cal {
                id: k.id.clone(),
                version: 1,
                offset_db: k.offset_db,
                uncertainty_db: k.uncertainty_db,
                antenna_gain_dbi: k.antenna_gain_dbi,
                feed_loss_db: k.feed_loss_db,
            });
        Some(ContextRecord {
            rev: c.rev,
            epoch: self.epoch,
            station: self.cfg.station.clone(),
            device: self.dev.device.clone(),
            centre_hz: self.dev.centre,
            sample_rate: self.dev.rate,
            bandwidth_hz: self.dev.rate * 0.8,
            gains: self.dev.gains.clone(),
            gain_auto: self.dev.auto,
            bias_tee: self.dev.bias,
            ppm: self.dev.ppm,
            units: if self.calibrated() {
                "dBm".into()
            } else {
                "dBFS".into()
            },
            cal,
            spectrum: c.spec_ctx.clone(),
            audio: c.audio.as_ref().map(|a| AudioCtx {
                codec: if a.opus.is_some() {
                    "opus".into()
                } else {
                    "adpcm".into()
                },
                rate: a.chain.out_rate as u32,
                channels: 1,
                mode: a.chain.mode.name().into(),
                freq_hz: a.sub.freq_hz,
                lo: a.sub.lo,
                hi: a.sub.hi,
            }),
            iq: c.iq.as_ref().map(|q| IqCtx {
                freq_hz: q.sub.freq_hz,
                rate: q.chain.rate,
                decimation: q.chain.decimation as u32,
                bits: q.sub.bits,
                fs_dbm: if self.calibrated() {
                    Some(self.offset_db())
                } else {
                    None
                },
            }),
            pointing: if c.pointing {
                self.cfg.pointing.clone()
            } else {
                None
            },
            control_holder: self
                .holder
                .and_then(|h| self.clients.get(&h))
                .map(|h| h.name.clone()),
            you_control: self.holder == Some(id),
        })
    }

    fn send_context(&mut self, id: u64) {
        if let Some(c) = self.clients.get_mut(&id) {
            c.rev = c.rev.wrapping_add(1);
        }
        if let Some(ctx) = self.context_for(id) {
            self.send_cbor(id, &ServerMsg::Context(ctx));
        }
    }

    fn broadcast_context(&mut self) {
        let ids: Vec<u64> = self.clients.keys().copied().collect();
        for id in ids {
            self.send_context(id);
        }
    }

    fn may_control(&mut self, id: u64) -> bool {
        match self.holder {
            Some(h) if h == id => true,
            Some(_) => false,
            None => {
                let ok = self.clients.get(&id).map_or(false, |c| c.authed);
                if ok {
                    self.holder = Some(id);
                }
                ok
            }
        }
    }

    fn command(&mut self, c: DspCmd) {
        match c {
            DspCmd::Add {
                id,
                peer,
                crit,
                media,
            } => {
                let authed = self.cfg.token.is_none();
                self.clients.insert(
                    id,
                    Client {
                        peer,
                        name: format!("client {id}"),
                        crit,
                        media,
                        authed,
                        codecs: vec![],
                        spec: None,
                        spec_enc: SpectrumEncoder::new(0.5),
                        spec_w: TrackWriter::new(),
                        spec_acc: vec![],
                        spec_n: 0,
                        spec_index: 0,
                        spec_last: Instant::now(),
                        spec_key: Instant::now(),
                        spec_force_key: true,
                        spec_ctx: None,
                        audio: None,
                        iq: None,
                        pointing: false,
                        ctx_w: TrackWriter::new(),
                        point_w: TrackWriter::new(),
                        burst_w: TrackWriter::new(),
                        rev: 0,
                        dropped: 0,
                    },
                );
            }
            DspCmd::Remove { id } => {
                self.clients.remove(&id);
                if self.holder == Some(id) {
                    self.holder = None;
                    self.broadcast_context();
                }
            }
            DspCmd::Msg { id, msg } => self.message(id, msg),
        }
    }

    fn message(&mut self, id: u64, msg: ClientMsg) {
        match msg {
            ClientMsg::Hello {
                client,
                codecs,
                token,
            } => {
                let need = self.cfg.token.clone();
                if let Some(c) = self.clients.get_mut(&id) {
                    c.name = format!(
                        "{} ({})",
                        client.chars().take(40).collect::<String>(),
                        c.peer
                    );
                    c.codecs = codecs;
                    c.authed = need
                        .as_ref()
                        .map_or(true, |t| token.as_deref() == Some(t.as_str()));
                }
                let hello = ServerMsg::Hello {
                    station: self.cfg.station.clone(),
                    device: self.dev.device.clone(),
                    version: VERSION,
                    software: format!("trace-station {}", env!("CARGO_PKG_VERSION")),
                    tracks: [
                        "control", "context", "spectrum", "audio", "iq", "burst", "pointing",
                    ]
                    .iter()
                    .map(|s| s.to_string())
                    .collect(),
                    codecs: if self.opus_ok {
                        vec!["opus".into(), "adpcm".into()]
                    } else {
                        vec!["adpcm".into()]
                    },
                    burst_seconds: self.cfg.burst_seconds,
                };
                self.reply(id, &hello);
                if let Some(r) = self.clock_record() {
                    self.reply(id, &ServerMsg::Clock(r));
                }
                self.send_context(id);
            }
            ClientMsg::Subscribe {
                spectrum,
                audio,
                iq,
                pointing,
            } => {
                let (fs, centre, opus_ok, deemph) = (
                    self.dev.rate,
                    self.dev.centre,
                    self.opus_ok,
                    self.cfg.deemph_us,
                );
                let Some(c) = self.clients.get_mut(&id) else {
                    return;
                };
                c.spec = spectrum.map(|mut s| {
                    s.bins = s.bins.clamp(16, 16384);
                    s
                });
                c.spec_force_key = true;
                c.pointing = pointing;
                c.audio = audio.map(|a| {
                    let want_opus =
                        a.codec == "opus" && opus_ok && c.codecs.iter().any(|x| x == "opus");
                    let opus = if want_opus {
                        OpusEnc::new(if a.kbps > 0 { a.kbps } else { 48 }).ok()
                    } else {
                        None
                    };
                    let out_rate = if opus.is_some() {
                        OpusEnc::RATE as f64
                    } else {
                        12_000.0
                    };
                    let chain = AudioChain::new(
                        fs,
                        centre,
                        a.freq_hz,
                        Mode::parse(&a.mode),
                        a.lo,
                        a.hi,
                        out_rate,
                        deemph,
                    );
                    AudioState {
                        sub: a,
                        chain,
                        opus,
                        adpcm: adpcm::Encoder::new(),
                        pcm: Vec::new(),
                        pcm_index: 0.0,
                        writer: TrackWriter::new(),
                        last_key: Instant::now() - Duration::from_secs(2),
                    }
                });
                c.iq = iq.map(|mut q| {
                    q.bits = q.bits.clamp(2, 16);
                    let chain = IqChain::new(fs, centre, q.freq_hz, q.rate.clamp(1000.0, fs));
                    IqState {
                        sub: q,
                        chain,
                        buf: Vec::new(),
                        origin: -1.0,
                        writer: TrackWriter::new(),
                        last_key: Instant::now() - Duration::from_secs(2),
                    }
                });
                self.reply(
                    id,
                    &ServerMsg::Ack {
                        op: "subscribe".into(),
                        ok: true,
                        message: None,
                    },
                );
                self.send_context(id);
            }
            ClientMsg::Tune { centre_hz } => self.device_cmd(id, "tune", DevCmd::Tune(centre_hz)),
            ClientMsg::SampleRate { hz } => self.device_cmd(id, "sample_rate", DevCmd::Rate(hz)),
            ClientMsg::Gain { stages, auto } => {
                self.device_cmd(id, "gain", DevCmd::Gain(stages, auto))
            }
            ClientMsg::BiasTee { on } => self.device_cmd(id, "bias_tee", DevCmd::Bias(on)),
            ClientMsg::TakeControl => {
                let ok = self.may_control(id);
                let msg = if ok {
                    None
                } else {
                    Some(self.control_refusal(id))
                };
                self.reply(
                    id,
                    &ServerMsg::Ack {
                        op: "take_control".into(),
                        ok,
                        message: msg,
                    },
                );
                self.broadcast_context();
            }
            ClientMsg::ReleaseControl => {
                if self.holder == Some(id) {
                    self.holder = None;
                }
                self.reply(
                    id,
                    &ServerMsg::Ack {
                        op: "release_control".into(),
                        ok: true,
                        message: None,
                    },
                );
                self.broadcast_context();
            }
            ClientMsg::Fetch {
                from_ns,
                duration_ns,
            } => {
                let Some(a) = self.anchor else {
                    self.reply(
                        id,
                        &ServerMsg::Error {
                            message: "No clock anchor yet".into(),
                        },
                    );
                    return;
                };
                let from = a.index_of(from_ns);
                let count =
                    ((duration_ns as f64 * 1e-9 * self.dev.rate) as usize).clamp(1, 1 << 22);
                if from < self.ring.oldest() {
                    self.reply(
                        id,
                        &ServerMsg::Error {
                            message: format!(
                                "That window is older than the {:.0} s burst buffer",
                                self.cfg.burst_seconds
                            ),
                        },
                    );
                    return;
                }
                self.fetches.push(PendingFetch {
                    client: id,
                    from,
                    count,
                    deadline: Instant::now()
                        + Duration::from_secs(10)
                        + Duration::from_secs_f64(duration_ns as f64 * 1e-9),
                });
                self.serve_fetches();
            }
            ClientMsg::Pointing {
                heading_deg,
                accuracy_deg,
                magnetic,
                declination_deg,
                pitch_deg,
                roll_deg,
                t_unix_ms,
            } => {
                if !heading_deg.is_finite() || !t_unix_ms.is_finite() {
                    return;
                }
                self.point(PointIn {
                    unix_ns: (t_unix_ms * 1e6) as u128,
                    heading: heading_deg.rem_euclid(360.0),
                    pitch: pitch_deg,
                    roll: roll_deg,
                    accuracy: accuracy_deg,
                    magnetic,
                    declination: declination_deg,
                    source: pointing::Source::ClientPhone,
                    element: 0,
                });
            }
            ClientMsg::Ping { t } => {
                let now = crate::pointing_in::now_ns() as f64 / 1e6;
                self.reply(
                    id,
                    &ServerMsg::Pong {
                        t,
                        server_unix_ms: now,
                    },
                );
            }
        }
    }

    fn control_refusal(&self, id: u64) -> String {
        if !self.clients.get(&id).map_or(false, |c| c.authed) {
            "This station needs a token for control".into()
        } else {
            format!(
                "{} is controlling the receiver",
                self.holder
                    .and_then(|h| self.clients.get(&h))
                    .map_or("Someone".to_string(), |c| c.name.clone())
            )
        }
    }

    fn device_cmd(&mut self, id: u64, op: &str, cmd: DevCmd) {
        if !self.may_control(id) {
            let m = self.control_refusal(id);
            self.reply(
                id,
                &ServerMsg::Ack {
                    op: op.into(),
                    ok: false,
                    message: Some(m),
                },
            );
            return;
        }
        let what = match &cmd {
            DevCmd::Tune(f) => format!("tune {:.6} MHz", f / 1e6),
            DevCmd::Rate(r) => format!("sample rate {:.3} MS/s", r / 1e6),
            DevCmd::Gain(g, a) => format!("gain {g:?} auto {a:?}"),
            DevCmd::Bias(b) => format!("bias-tee {b}"),
        };
        eprintln!(
            "{}: {what}",
            self.clients
                .get(&id)
                .map_or("?".to_string(), |c| c.name.clone())
        );
        let _ = self.dev_tx.send(cmd);
        self.reply(
            id,
            &ServerMsg::Ack {
                op: op.into(),
                ok: true,
                message: None,
            },
        );
    }

    fn reconfigured(&mut self, d: DevState, restarted: bool) {
        let rate_changed = (d.rate - self.dev.rate).abs() > 0.5;
        let tuned = (d.centre - self.dev.centre).abs() > 0.5;
        self.dev = d;
        self.epoch += 1;
        self.pending_flags |= flags::PHASE_BREAK;
        if rate_changed || restarted {
            // keep time continuous across the rate change: re-anchor at the current index
            if let Some(a) = self.anchor {
                let (t, f) = a.time_of(self.index);
                let (num, den) = rational(self.dev.rate);
                self.anchor = Some(Anchor {
                    n0: self.index,
                    t0_ns: t,
                    t0_frac: f,
                    fs_num: num,
                    fs_den: den,
                    eps_ppb: 0.0,
                });
            }
            self.spec.set_rate(self.dev.rate);
            self.ring = Ring::new((self.cfg.burst_seconds * self.dev.rate) as usize);
            self.ring.clear(self.index);
        }
        if tuned || rate_changed {
            let (fs, centre, deemph) = (self.dev.rate, self.dev.centre, self.cfg.deemph_us);
            for c in self.clients.values_mut() {
                if let Some(a) = c.audio.as_mut() {
                    let rate = a.chain.out_rate;
                    a.chain = AudioChain::new(
                        fs,
                        centre,
                        a.sub.freq_hz,
                        Mode::parse(&a.sub.mode),
                        a.sub.lo,
                        a.sub.hi,
                        rate,
                        deemph,
                    );
                    a.pcm.clear();
                }
                if let Some(q) = c.iq.as_mut() {
                    q.chain = IqChain::new(fs, centre, q.sub.freq_hz, q.sub.rate.clamp(1000.0, fs));
                    q.buf.clear();
                    q.origin = -1.0;
                    q.writer.reset();
                }
                c.spec_acc.clear();
                c.spec_n = 0;
                c.spec_force_key = true;
            }
        }
        self.broadcast_context();
    }

    fn housekeeping(&mut self) {
        if self.last_clock.elapsed() >= Duration::from_secs(1) {
            self.last_clock = Instant::now();
            if let Some(r) = self.clock_record() {
                self.broadcast_msg(&ServerMsg::Clock(r));
            }
        }
        if self.points_last.elapsed() >= Duration::from_millis(200) {
            self.flush_points();
        }
    }
}

/// Pushes a media frame; false when the client's queue was full and the frame was dropped.
fn push_media(c: &mut Client, frame: Vec<u8>) -> bool {
    match c.media.try_send(frame) {
        Ok(()) => true,
        Err(TrySendError::Full(_)) => {
            c.dropped += 1;
            false
        }
        Err(TrySendError::Closed(_)) => false,
    }
}

/// Sample rate as a ratio of integers (exact for whole-Hz rates and common fractions).
pub fn rational(fs: f64) -> (u64, u64) {
    for den in [1u64, 2, 3, 4, 5, 8, 10, 100, 1000] {
        let num = fs * den as f64;
        if (num - num.round()).abs() < 1e-6 {
            return (num.round() as u64, den);
        }
    }
    ((fs * 1000.0).round() as u64, 1000)
}
