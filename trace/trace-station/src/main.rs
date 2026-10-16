//! trace-station — a TRACE (Timestamped RF Adaptive Calibrated Encoding) station.
//!
//! ```text
//! trace-station --source sim                                   # no hardware: test signals
//! trace-station --source hackrf --freq 433.92e6 --rate 8e6 --gain lna=24,vga=20
//! trace-station --source rtlsdr --freq 145.5e6 --gain 30       # RTL-SDR on USB (librtlsdr)
//! trace-station --source rtltcp --device 192.168.1.20:1234     # an rtl_tcp server
//! ```
//! Then open webRx → Connect → Remote → `http://<station>:8090/` (choose TRACE).

mod dsp;
mod engine;
mod opus;
mod pointing_in;
mod ring;
mod server;
mod source;

use clap::Parser;
use engine::{CalConfig, Config, DevCmd, DevState, Engine, RxEvent};
use source::{parse_gains, Source};
use std::sync::atomic::AtomicU64;
use std::sync::mpsc::{channel, sync_channel, TrySendError};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use trace_core::clock::ClockClass;
use trace_core::context::{PointingCtx, Station};

#[derive(Parser, Debug)]
#[command(
    version,
    about = "TRACE station: serves an SDR's spectrum, audio, I/Q, pointing and bursts to browsers"
)]
struct Args {
    /// sim, hackrf, rtlsdr (USB via librtlsdr) or rtltcp
    #[arg(long, default_value = "sim")]
    source: String,
    /// rtltcp: host:port · rtlsdr: device index · hackrf: serial number
    #[arg(long)]
    device: Option<String>,
    /// Centre frequency, Hz
    #[arg(long, default_value_t = 433.92e6)]
    freq: f64,
    /// Sample rate, Hz
    #[arg(long)]
    rate: Option<f64>,
    /// Gains: "lna=24,vga=20,amp=0" (HackRF) or "30" (RTL tuner gain); empty = auto (RTL)
    #[arg(long, default_value = "")]
    gain: String,
    #[arg(long)]
    bias_tee: bool,
    #[arg(long, default_value_t = 0.0, allow_negative_numbers = true)]
    ppm: f64,
    /// Listen address
    #[arg(long, default_value = "0.0.0.0:8090")]
    listen: std::net::SocketAddr,
    #[arg(long, default_value = "TRACE station")]
    name: String,
    #[arg(long, allow_negative_numbers = true)]
    lat: Option<f64>,
    #[arg(long, allow_negative_numbers = true)]
    lon: Option<f64>,
    #[arg(long, allow_negative_numbers = true)]
    height: Option<f64>,
    /// FFT size of the shared spectrum engine
    #[arg(long, default_value_t = 4096)]
    fft: usize,
    /// Seconds of raw I/Q kept for burst fetches (TDoA)
    #[arg(long, default_value_t = 4.0)]
    burst_seconds: f64,
    /// dBFS → dBm offset at the antenna terminals; levels are dBm only at the gains given with --gain
    #[arg(long, allow_negative_numbers = true)]
    cal_offset_db: Option<f64>,
    #[arg(long, default_value_t = 1.5)]
    cal_uncertainty_db: f64,
    #[arg(long, default_value = "station-cal")]
    cal_id: String,
    #[arg(long, default_value_t = 0.0, allow_negative_numbers = true)]
    antenna_gain_dbi: f64,
    #[arg(long, default_value_t = 0.0, allow_negative_numbers = true)]
    feed_loss_db: f64,
    /// Token required for receiver control (view and listen stay open)
    #[arg(long)]
    token: Option<String>,
    /// HackRF: start sampling on the PPS edge at the trigger input
    #[arg(long)]
    pps_trigger: bool,
    /// Timing class you can vouch for with --pps-trigger: A (GPSDO 10 MHz on CLKIN) or B (PPS only)
    #[arg(long, default_value = "B")]
    clock_class: String,
    /// WFM de-emphasis, µs (50 in South Africa/Europe, 75 in the Americas)
    #[arg(long, default_value_t = 50.0)]
    deemph_us: f64,
    /// Fixed antenna bearing, degrees true
    #[arg(long, allow_negative_numbers = true)]
    heading: Option<f64>,
    /// Hamlib rotctld for a rotator, host:port
    #[arg(long)]
    rotctld: Option<String>,
    /// NMEA heading sensor: udp://0.0.0.0:10110 or tcp://host:port
    #[arg(long)]
    nmea_heading: Option<String>,
    /// Boom direction minus sensor zero, degrees
    #[arg(long, default_value_t = 0.0, allow_negative_numbers = true)]
    mount_offset: f64,
    /// The heading source reports magnetic north
    #[arg(long)]
    magnetic: bool,
    /// Simulator: bearing of the directional target, degrees
    #[arg(long, allow_negative_numbers = true)]
    sim_bearing: Option<f64>,
    /// Simulator: rotate the simulated antenna at this many degrees per second
    #[arg(long)]
    sim_rotate: Option<f64>,
}

fn open_source(a: &Args, heading: Arc<AtomicU64>) -> Result<Box<dyn Source>, String> {
    let gains = parse_gains(&a.gain);
    Ok(match a.source.as_str() {
        "sim" => Box::new(source::sim::Sim::new(
            a.freq,
            a.rate.unwrap_or(2.4e6),
            if gains.is_empty() {
                parse_gains("lna=20")
            } else {
                gains
            },
            heading,
            a.sim_bearing,
        )),
        "rtltcp" | "rtl_tcp" => Box::new(source::rtltcp::RtlTcp::new(
            a.device.as_deref().unwrap_or("127.0.0.1:1234"),
            a.freq,
            a.rate.unwrap_or(2.4e6),
            gains,
            a.ppm,
        )),
        "rtlsdr" | "rtl" => Box::new(source::rtlusb::RtlUsb::open(
            a.device.as_deref().unwrap_or("0").parse().unwrap_or(0),
            a.freq,
            a.rate.unwrap_or(2.4e6),
            gains,
            a.ppm,
        )?),
        "hackrf" => {
            let g = if gains.is_empty() {
                parse_gains("lna=16,vga=20,amp=0")
            } else {
                gains
            };
            Box::new(source::hackrf::HackRf::open(
                a.device.as_deref(),
                a.freq,
                a.rate.unwrap_or(8e6),
                g,
                a.pps_trigger,
            )?)
        }
        s => {
            return Err(format!(
                "unknown source {s:?} (sim, hackrf, rtlsdr, rtltcp)"
            ))
        }
    })
}

fn state(s: &dyn Source, start_unix_ns: u128) -> DevState {
    DevState {
        device: s.device(),
        centre: s.centre(),
        rate: s.sample_rate(),
        gains: s.gains(),
        auto: s.gain_auto(),
        bias: s.bias_tee(),
        ppm: s.ppm(),
        pps: s.pps_aligned(),
        start_unix_ns,
    }
}

fn main() {
    let a = Args::parse();
    let shared_heading = Arc::new(AtomicU64::new(0));
    let mut src = match open_source(&a, shared_heading.clone()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("trace-station: {e}");
            std::process::exit(1);
        }
    };
    if a.bias_tee {
        if let Err(e) = src.set_bias_tee(true) {
            eprintln!("bias-tee: {e}");
        }
    }
    let class = match a.clock_class.to_ascii_uppercase().as_str() {
        "A" => ClockClass::A,
        "B" => ClockClass::B,
        _ => ClockClass::C,
    };
    let pointing_ctx = if a.rotctld.is_some()
        || a.nmea_heading.is_some()
        || a.heading.is_some()
        || a.sim_rotate.is_some()
    {
        Some(PointingCtx {
            source: if a.rotctld.is_some() || a.sim_rotate.is_some() {
                "rotator".into()
            } else if a.nmea_heading.is_some() {
                "compass".into()
            } else {
                "manual".into()
            },
            magnetic: a.magnetic,
            declination_deg: None,
            element: 0,
            rate_hz: if a.heading.is_some() {
                1.0
            } else if a.sim_rotate.is_some() {
                20.0
            } else {
                10.0
            },
            mount_offset_deg: a.mount_offset,
        })
    } else {
        Some(PointingCtx {
            source: "client".into(),
            magnetic: false,
            declination_deg: None,
            element: 0,
            rate_hz: 0.0,
            mount_offset_deg: 0.0,
        })
    };
    let cfg = Config {
        station: Station {
            id: format!("{:016x}", std::process::id() as u64 ^ a.freq as u64),
            name: a.name.clone(),
            lat: a.lat,
            lon: a.lon,
            height_m: a.height,
        },
        fft: a.fft,
        burst_seconds: a.burst_seconds.clamp(0.1, 60.0),
        cal: a.cal_offset_db.map(|o| CalConfig {
            id: a.cal_id.clone(),
            offset_db: o,
            uncertainty_db: a.cal_uncertainty_db,
            antenna_gain_dbi: a.antenna_gain_dbi,
            feed_loss_db: a.feed_loss_db,
            gains: src.gains(),
        }),
        token: a.token.clone(),
        clock_class: if a.pps_trigger { class } else { ClockClass::C },
        deemph_us: a.deemph_us,
        pointing: pointing_ctx,
    };

    let (rx_tx, rx_rx) = sync_channel::<RxEvent>(256);
    let (dev_tx, dev_rx) = channel::<DevCmd>();
    let (cmd_tx, cmd_rx) = channel();
    let (pt_tx, pt_rx) = channel();

    // heading inputs
    if let Some(h) = a.heading {
        pointing_in::fixed(pt_tx.clone(), (h + a.mount_offset).rem_euclid(360.0));
    }
    if let Some(r) = a.rotctld.clone() {
        pointing_in::rotctld(pt_tx.clone(), r, a.mount_offset, a.magnetic);
    }
    if let Some(u) = a.nmea_heading.clone() {
        pointing_in::nmea(pt_tx.clone(), u, a.mount_offset);
    }
    if let Some(r) = a.sim_rotate {
        pointing_in::sim_rotator(pt_tx.clone(), shared_heading.clone(), r);
    }
    drop(pt_tx);

    let start_ns = pointing_in::now_ns();
    if let Err(e) = src.start() {
        eprintln!("trace-station: could not start the receiver: {e}");
        std::process::exit(1);
    }
    let dev0 = state(src.as_ref(), start_ns);
    eprintln!(
        "Receiver: {} · {:.6} MHz · {:.3} MS/s",
        dev0.device.name,
        dev0.centre / 1e6,
        dev0.rate / 1e6
    );

    // reader thread: owns the device
    std::thread::Builder::new()
        .name("reader".into())
        .spawn(move || {
            let mut dropped = 0u64;
            let mut buf = Vec::with_capacity(1 << 18);
            loop {
                let mut changed = false;
                while let Ok(c) = dev_rx.try_recv() {
                    let r = match c {
                        DevCmd::Tune(f) => src.tune(f).map(|_| ()),
                        DevCmd::Rate(r) => src.set_rate(r).map(|_| ()),
                        DevCmd::Gain(g, auto) => src.set_gain(&g, auto),
                        DevCmd::Bias(on) => src.set_bias_tee(on),
                    };
                    if let Err(e) = r {
                        let _ = rx_tx.send(RxEvent::Error(e));
                    }
                    changed = true;
                }
                if changed {
                    let _ = rx_tx.send(RxEvent::Config(
                        state(src.as_ref(), pointing_in::now_ns()),
                        false,
                    ));
                }
                buf.clear();
                match src.read(&mut buf) {
                    Ok(()) => {
                        dropped += src.take_dropped();
                        let ev = RxEvent::Block {
                            data: std::mem::take(&mut buf),
                            dropped,
                            arrival_unix_ns: pointing_in::now_ns(),
                        };
                        match rx_tx.try_send(ev) {
                            Ok(()) => dropped = 0,
                            Err(TrySendError::Full(RxEvent::Block { data, .. })) => {
                                dropped += (data.len() / 2) as u64;
                                buf = data;
                            }
                            Err(_) => return,
                        }
                    }
                    Err(e) => {
                        let _ = rx_tx.send(RxEvent::Error(e));
                        std::thread::sleep(Duration::from_secs(1));
                    }
                }
            }
        })
        .expect("reader thread");

    let engine = Engine::new(cfg, dev0.clone(), dev_tx);
    std::thread::Builder::new()
        .name("dsp".into())
        .spawn(move || engine.run(rx_rx, cmd_rx, pt_rx))
        .expect("dsp thread");

    let info = serde_json::json!({
        "trace": trace_core::VERSION,
        "software": format!("trace-station {}", env!("CARGO_PKG_VERSION")),
        "name": a.name,
        "device": dev0.device.name,
        "kind": dev0.device.kind,
        "centre_hz": dev0.centre,
        "sample_rate": dev0.rate,
        "ws": "trace/ws",
        "tracks": ["control", "context", "spectrum", "audio", "iq", "burst", "pointing"],
        "lat": a.lat, "lon": a.lon,
    });
    let state = server::AppState {
        dsp: Arc::new(Mutex::new(cmd_tx)),
        info: Arc::new(info),
        next: Arc::new(AtomicU64::new(1)),
    };
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .expect("runtime");
    if let Err(e) = rt.block_on(server::serve(a.listen, state)) {
        eprintln!("trace-station: {e}");
        std::process::exit(1);
    }
}
