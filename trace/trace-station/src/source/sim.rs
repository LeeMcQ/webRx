//! Simulated receiver for tests and demos: Gaussian noise, a steady carrier,
//! an FM broadcast-style tone and — for direction finding — a target whose
//! level follows a directional antenna pattern as the shared heading turns.

use super::{Gains, Source};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use trace_core::context::Device;

/// Heading shared with the simulated rotator, in millidegrees.
pub type SharedHeading = Arc<AtomicU64>;

pub struct Sim {
    /// Signals sit at fixed RF frequencies around the start-up centre, like real transmitters.
    origin: f64,
    origin_rate: f64,
    centre: f64,
    rate: f64,
    gains: Gains,
    bias: bool,
    started: Option<Instant>,
    produced: u64,
    rng: u64,
    phases: [f64; 4],
    /// Transmitter bearing for the directional target (degrees), and the antenna heading.
    pub bearing: Option<f64>,
    pub heading: SharedHeading,
}

impl Sim {
    pub fn new(
        centre: f64,
        rate: f64,
        gains: Gains,
        heading: SharedHeading,
        bearing: Option<f64>,
    ) -> Self {
        Self {
            origin: centre,
            origin_rate: rate,
            centre,
            rate,
            gains,
            bias: false,
            started: None,
            produced: 0,
            rng: 0x2545_F491_4F6C_DD1D,
            phases: [0.0; 4],
            bearing,
            heading,
        }
    }

    #[inline]
    fn gauss(&mut self) -> f64 {
        // xorshift64* + Box–Muller
        let mut u = || {
            self.rng ^= self.rng >> 12;
            self.rng ^= self.rng << 25;
            self.rng ^= self.rng >> 27;
            ((self.rng.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 11) as f64 + 0.5)
                / (1u64 << 53) as f64
        };
        let (a, b) = (u(), u());
        (-2.0 * a.ln()).sqrt() * (2.0 * std::f64::consts::PI * b).cos()
    }

    /// Signals relative to the tuned centre: (offset Hz, amplitude in LSB, kind).
    fn signals(&self) -> [(f64, f64, u8); 4] {
        let tg = self
            .gains
            .get("lna")
            .or(self.gains.get("tuner"))
            .copied()
            .unwrap_or(20.0);
        let scale = 10f64.powf((tg - 20.0) / 20.0);
        let dir = match self.bearing {
            Some(b) => {
                let h = self.heading.load(Ordering::Relaxed) as f64 / 1000.0;
                let d = ((h - b + 540.0).rem_euclid(360.0) - 180.0).to_radians();
                (d / 2.0).cos().powi(8).max(0.03)
            }
            None => 1.0,
        };
        let at = |k: f64| self.origin + k * self.origin_rate - self.centre;
        let vis = |off: f64, a: f64| if off.abs() < self.rate / 2.0 { a } else { 0.0 };
        [
            (at(0.12), vis(at(0.12), 30.0 * scale), 0), // steady carrier
            (at(-0.20), vis(at(-0.20), 25.0 * scale), 1), // FM, 1 kHz tone, 5 kHz deviation
            (at(0.30), vis(at(0.30), 45.0 * scale * dir), 0), // directional target
            (at(-0.35), vis(at(-0.35), 20.0 * scale), 2), // AM, 400 Hz tone
        ]
    }
}

impl Source for Sim {
    fn device(&self) -> Device {
        Device {
            kind: "sim".into(),
            name: "Simulated receiver".into(),
            serial: None,
            min_hz: 1e6,
            max_hz: 6e9,
            rates: vec![1.024e6, 2.048e6, 2.4e6, 4e6, 8e6],
            gain_stages: [
                ("lna".to_string(), [0.0, 40.0, 8.0]),
                ("vga".to_string(), [0.0, 62.0, 2.0]),
            ]
            .into_iter()
            .collect(),
        }
    }
    fn centre(&self) -> f64 {
        self.centre
    }
    fn sample_rate(&self) -> f64 {
        self.rate
    }
    fn gains(&self) -> Gains {
        self.gains.clone()
    }
    fn gain_auto(&self) -> bool {
        false
    }
    fn bias_tee(&self) -> bool {
        self.bias
    }
    fn start(&mut self) -> Result<(), String> {
        self.started = Some(Instant::now());
        self.produced = 0;
        Ok(())
    }
    fn read(&mut self, out: &mut Vec<i8>) -> Result<(), String> {
        let t0 = *self.started.get_or_insert_with(Instant::now);
        // 16 ms blocks, paced to real time
        let n = ((self.rate * 0.016) as usize).max(256);
        let due = t0 + Duration::from_secs_f64((self.produced + n as u64) as f64 / self.rate);
        let now = Instant::now();
        if due > now {
            std::thread::sleep(due - now);
        }
        let sigs = self.signals();
        let fs = self.rate;
        let noise = 3.0;
        out.reserve(2 * n);
        for k in 0..n {
            let t = (self.produced + k as u64) as f64 / fs;
            let (mut i, mut q) = (noise * self.gauss(), noise * self.gauss());
            for (j, &(off, amp, kind)) in sigs.iter().enumerate() {
                let inst = match kind {
                    1 => off + 5_000.0 * (2.0 * std::f64::consts::PI * 1_000.0 * t).sin(),
                    _ => off,
                };
                self.phases[j] += 2.0 * std::f64::consts::PI * inst / fs;
                let a = if kind == 2 {
                    amp * (1.0 + 0.6 * (2.0 * std::f64::consts::PI * 400.0 * t).sin())
                } else {
                    amp
                };
                i += a * self.phases[j].cos();
                q += a * self.phases[j].sin();
            }
            out.push(i.round().clamp(-127.0, 127.0) as i8);
            out.push(q.round().clamp(-127.0, 127.0) as i8);
        }
        for p in &mut self.phases {
            *p %= 2.0 * std::f64::consts::PI;
        }
        self.produced += n as u64;
        Ok(())
    }
    fn tune(&mut self, hz: f64) -> Result<f64, String> {
        self.centre = hz;
        Ok(hz)
    }
    fn set_rate(&mut self, hz: f64) -> Result<f64, String> {
        self.rate = hz.clamp(250e3, 20e6);
        self.started = Some(Instant::now());
        self.produced = 0;
        Ok(self.rate)
    }
    fn set_gain(&mut self, stages: &Gains, _auto: Option<bool>) -> Result<(), String> {
        for (k, v) in stages {
            self.gains.insert(k.clone(), *v);
        }
        Ok(())
    }
    fn set_bias_tee(&mut self, on: bool) -> Result<(), String> {
        self.bias = on;
        Ok(())
    }
}
