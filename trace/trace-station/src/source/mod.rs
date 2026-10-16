//! Receiver sources. Every source delivers signed 8-bit interleaved I/Q, the
//! native format of the RTL-SDR (after re-centring) and the HackRF.
//!
//! Native libraries (librtlsdr, libhackrf) are loaded at run time, so the
//! station builds anywhere and only the machine with the SDR needs them.

use std::collections::BTreeMap;
use trace_core::context::Device;

pub mod hackrf;
pub mod rtltcp;
pub mod rtlusb;
pub mod sim;

pub type Gains = BTreeMap<String, f64>;

pub trait Source: Send {
    fn device(&self) -> Device;
    fn centre(&self) -> f64;
    fn sample_rate(&self) -> f64;
    fn gains(&self) -> Gains;
    fn gain_auto(&self) -> bool;
    fn bias_tee(&self) -> bool;
    fn ppm(&self) -> f64 {
        0.0
    }
    /// Starts streaming.
    fn start(&mut self) -> Result<(), String>;
    /// Blocks until samples arrive, then appends them (I, Q, I, Q …) to `out`.
    fn read(&mut self, out: &mut Vec<i8>) -> Result<(), String>;
    /// Returns the frequency actually set.
    fn tune(&mut self, hz: f64) -> Result<f64, String>;
    fn set_rate(&mut self, hz: f64) -> Result<f64, String>;
    fn set_gain(&mut self, stages: &Gains, auto: Option<bool>) -> Result<(), String>;
    fn set_bias_tee(&mut self, on: bool) -> Result<(), String>;
    /// True when sample 0 was triggered by a PPS edge (HackRF hardware sync).
    fn pps_aligned(&self) -> bool {
        false
    }
    /// Samples the driver had to drop since the last call (its own buffer overflowed).
    fn take_dropped(&mut self) -> u64 {
        0
    }
    fn stop(&mut self) {}
}

/// Parses "lna=24,vga=20,amp=0" or a bare number (tuner gain).
pub fn parse_gains(s: &str) -> Gains {
    let mut g = Gains::new();
    for part in s.split(',').map(str::trim).filter(|p| !p.is_empty()) {
        if let Some((k, v)) = part.split_once('=') {
            if let Ok(x) = v.trim().parse() {
                g.insert(k.trim().to_lowercase(), x);
            }
        } else if let Ok(x) = part.parse() {
            g.insert("tuner".into(), x);
        }
    }
    g
}

/// Opens a library under any of its usual names.
pub fn load_lib(names: &[&str]) -> Result<libloading::Library, String> {
    let mut errs = Vec::new();
    for n in names {
        match unsafe { libloading::Library::new(n) } {
            Ok(l) => return Ok(l),
            Err(e) => errs.push(format!("{n}: {e}")),
        }
    }
    Err(format!("could not load any of {}", errs.join("; ")))
}
