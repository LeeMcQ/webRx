//! rtl_tcp client: a remote RTL-SDR served by `rtl_tcp` becomes a TRACE source.
//!
//! Protocol: 12-byte greeting "RTL0" · u32 BE tuner type · u32 BE gain count,
//! then unsigned 8-bit I/Q. Commands are 5 bytes: u8 command · u32 BE value.
//! Its timing is whatever the network gives, so it is a class C/D source.

use super::{Gains, Source};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;
use trace_core::context::Device;

const TUNERS: [&str; 7] = [
    "unknown", "E4000", "FC0012", "FC0013", "FC2580", "R820T", "R828D",
];

pub struct RtlTcp {
    addr: String,
    sock: Option<TcpStream>,
    tuner: String,
    centre: f64,
    rate: f64,
    gains: Gains,
    auto: bool,
    bias: bool,
    ppm: f64,
    buf: Vec<u8>,
}

impl RtlTcp {
    pub fn new(addr: &str, centre: f64, rate: f64, gains: Gains, ppm: f64) -> Self {
        let auto = gains.is_empty();
        Self {
            addr: addr.to_string(),
            sock: None,
            tuner: "unknown".into(),
            centre,
            rate,
            gains,
            auto,
            bias: false,
            ppm,
            buf: vec![0; 64 * 1024],
        }
    }

    fn cmd(&mut self, c: u8, v: u32) -> Result<(), String> {
        let s = self.sock.as_mut().ok_or("not connected")?;
        let mut m = [0u8; 5];
        m[0] = c;
        m[1..].copy_from_slice(&v.to_be_bytes());
        s.write_all(&m).map_err(|e| format!("rtl_tcp: {e}"))
    }

    fn apply_gain(&mut self) -> Result<(), String> {
        if self.auto {
            self.cmd(0x03, 0)
        } else {
            self.cmd(0x03, 1)?;
            let g = self.gains.get("tuner").copied().unwrap_or(30.0);
            self.cmd(0x04, (g * 10.0).round() as i32 as u32)
        }
    }
}

impl Source for RtlTcp {
    fn device(&self) -> Device {
        Device {
            kind: "rtl_tcp".into(),
            name: format!("RTL-SDR via rtl_tcp ({}, {})", self.addr, self.tuner),
            serial: None,
            min_hz: 24e6,
            max_hz: 1.766e9,
            rates: vec![1.024e6, 1.4e6, 1.8e6, 2.048e6, 2.4e6, 2.56e6],
            gain_stages: [("tuner".to_string(), [0.0, 49.6, 0.1])]
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
        self.auto
    }
    fn bias_tee(&self) -> bool {
        self.bias
    }
    fn ppm(&self) -> f64 {
        self.ppm
    }
    fn start(&mut self) -> Result<(), String> {
        let mut s =
            TcpStream::connect(&self.addr).map_err(|e| format!("rtl_tcp {}: {e}", self.addr))?;
        s.set_read_timeout(Some(Duration::from_secs(5))).ok();
        s.set_nodelay(true).ok();
        let mut hello = [0u8; 12];
        s.read_exact(&mut hello)
            .map_err(|e| format!("rtl_tcp greeting: {e}"))?;
        if &hello[..4] != b"RTL0" {
            return Err("not an rtl_tcp server (no RTL0 greeting)".into());
        }
        let t = u32::from_be_bytes(hello[4..8].try_into().unwrap()) as usize;
        self.tuner = TUNERS.get(t).unwrap_or(&"unknown").to_string();
        self.sock = Some(s);
        self.cmd(0x02, self.rate as u32)?;
        self.cmd(0x01, self.centre as u32)?;
        if self.ppm != 0.0 {
            self.cmd(0x05, self.ppm.round() as i32 as u32)?;
        }
        self.apply_gain()
    }
    fn read(&mut self, out: &mut Vec<i8>) -> Result<(), String> {
        let s = self.sock.as_mut().ok_or("not connected")?;
        let n = s
            .read(&mut self.buf)
            .map_err(|e| format!("rtl_tcp read: {e}"))?;
        if n == 0 {
            return Err("rtl_tcp server closed the connection".into());
        }
        let n = n & !1; // keep I/Q pairs; an odd byte is rare and costs one sample
        out.extend(self.buf[..n].iter().map(|&b| (b as i16 - 128) as i8));
        Ok(())
    }
    fn tune(&mut self, hz: f64) -> Result<f64, String> {
        self.cmd(0x01, hz.round() as u32)?;
        self.centre = hz.round();
        Ok(self.centre)
    }
    fn set_rate(&mut self, hz: f64) -> Result<f64, String> {
        self.cmd(0x02, hz.round() as u32)?;
        self.rate = hz.round();
        Ok(self.rate)
    }
    fn set_gain(&mut self, stages: &Gains, auto: Option<bool>) -> Result<(), String> {
        if let Some(a) = auto {
            self.auto = a;
        }
        if let Some(&g) = stages.get("tuner") {
            self.gains.insert("tuner".into(), g);
            self.auto = false;
        }
        self.apply_gain()
    }
    fn set_bias_tee(&mut self, on: bool) -> Result<(), String> {
        self.cmd(0x0e, on as u32)?;
        self.bias = on;
        Ok(())
    }
    fn stop(&mut self) {
        self.sock = None;
    }
}
