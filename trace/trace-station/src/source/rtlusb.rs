//! RTL-SDR over USB through librtlsdr (loaded at run time).
#![allow(unused_unsafe)]

use super::{load_lib, Gains, Source};
use libloading::{Library, Symbol};
use std::ffi::{c_int, c_void, CStr};
use trace_core::context::Device;

type Dev = *mut c_void;

pub struct RtlUsb {
    lib: Library,
    dev: Dev,
    index: u32,
    name: String,
    serial: Option<String>,
    centre: f64,
    rate: f64,
    gains: Gains,
    auto: bool,
    bias: bool,
    ppm: f64,
    tuner_gains: Vec<i32>,
    buf: Vec<u8>,
}

// The device handle is only used from the reader thread.
unsafe impl Send for RtlUsb {}

macro_rules! sym {
    ($lib:expr, $name:literal, $t:ty) => {{
        let s: Symbol<$t> = unsafe { $lib.get(concat!($name, "\0").as_bytes()) }
            .map_err(|e| format!("librtlsdr {}: {e}", $name))?;
        s
    }};
}

impl RtlUsb {
    pub fn open(
        index: u32,
        centre: f64,
        rate: f64,
        gains: Gains,
        ppm: f64,
    ) -> Result<Self, String> {
        let lib = load_lib(&[
            "librtlsdr.so.0",
            "librtlsdr.so",
            "librtlsdr.0.dylib",
            "librtlsdr.dylib",
            "rtlsdr.dll",
        ])?;
        let count = sym!(
            lib,
            "rtlsdr_get_device_count",
            unsafe extern "C" fn() -> u32
        );
        let n = unsafe { count() };
        if n == 0 {
            return Err("no RTL-SDR found on USB".into());
        }
        let get_name = sym!(
            lib,
            "rtlsdr_get_device_name",
            unsafe extern "C" fn(u32) -> *const std::ffi::c_char
        );
        let name = unsafe { CStr::from_ptr(get_name(index)) }
            .to_string_lossy()
            .into_owned();
        let open = sym!(
            lib,
            "rtlsdr_open",
            unsafe extern "C" fn(*mut Dev, u32) -> c_int
        );
        let mut dev: Dev = std::ptr::null_mut();
        let r = unsafe { open(&mut dev, index) };
        if r < 0 || dev.is_null() {
            return Err(format!(
                "rtlsdr_open({index}) failed ({r}) — is another program using it?"
            ));
        }
        let mut s = Self {
            lib,
            dev,
            index,
            name,
            serial: None,
            centre,
            rate,
            gains: gains.clone(),
            auto: gains.is_empty(),
            bias: false,
            ppm,
            tuner_gains: Vec::new(),
            buf: vec![0; 256 * 1024],
        };
        {
            let get_gains = sym!(
                s.lib,
                "rtlsdr_get_tuner_gains",
                unsafe extern "C" fn(Dev, *mut c_int) -> c_int
            );
            let k = unsafe { get_gains(s.dev, std::ptr::null_mut()) };
            if k > 0 {
                let mut g = vec![0 as c_int; k as usize];
                unsafe { get_gains(s.dev, g.as_mut_ptr()) };
                s.tuner_gains = g;
            }
        }
        Ok(s)
    }

    fn call(
        &self,
        name: &'static str,
        f: impl FnOnce(&Library) -> Result<c_int, String>,
    ) -> Result<(), String> {
        let r = f(&self.lib)?;
        if r < 0 {
            Err(format!("{name} failed ({r})"))
        } else {
            Ok(())
        }
    }

    fn apply(&mut self) -> Result<(), String> {
        let dev = self.dev;
        let rate = self.rate as u32;
        let centre = self.centre as u32;
        self.call("rtlsdr_set_sample_rate", |l| {
            Ok(unsafe {
                sym!(
                    l,
                    "rtlsdr_set_sample_rate",
                    unsafe extern "C" fn(Dev, u32) -> c_int
                )(dev, rate)
            })
        })?;
        self.call("rtlsdr_set_center_freq", |l| {
            Ok(unsafe {
                sym!(
                    l,
                    "rtlsdr_set_center_freq",
                    unsafe extern "C" fn(Dev, u32) -> c_int
                )(dev, centre)
            })
        })?;
        if self.ppm != 0.0 {
            let p = self.ppm.round() as c_int;
            let _ = self.call("rtlsdr_set_freq_correction", |l| {
                Ok(unsafe {
                    sym!(
                        l,
                        "rtlsdr_set_freq_correction",
                        unsafe extern "C" fn(Dev, c_int) -> c_int
                    )(dev, p)
                })
            });
        }
        self.apply_gain()
    }

    fn apply_gain(&mut self) -> Result<(), String> {
        let dev = self.dev;
        let manual = !self.auto as c_int;
        self.call("rtlsdr_set_tuner_gain_mode", |l| {
            Ok(unsafe {
                sym!(
                    l,
                    "rtlsdr_set_tuner_gain_mode",
                    unsafe extern "C" fn(Dev, c_int) -> c_int
                )(dev, manual)
            })
        })?;
        if !self.auto {
            let want = (self.gains.get("tuner").copied().unwrap_or(30.0) * 10.0).round() as i32;
            // nearest supported step
            let g = self
                .tuner_gains
                .iter()
                .copied()
                .min_by_key(|g| (g - want).abs())
                .unwrap_or(want);
            self.gains.insert("tuner".into(), g as f64 / 10.0);
            self.call("rtlsdr_set_tuner_gain", |l| {
                Ok(unsafe {
                    sym!(
                        l,
                        "rtlsdr_set_tuner_gain",
                        unsafe extern "C" fn(Dev, c_int) -> c_int
                    )(dev, g)
                })
            })?;
        }
        Ok(())
    }
}

impl Source for RtlUsb {
    fn device(&self) -> Device {
        let max = self.tuner_gains.iter().copied().max().unwrap_or(496) as f64 / 10.0;
        Device {
            kind: "rtlsdr".into(),
            name: format!("{} (#{})", self.name, self.index),
            serial: self.serial.clone(),
            min_hz: 24e6,
            max_hz: 1.766e9,
            rates: vec![1.024e6, 1.4e6, 1.8e6, 2.048e6, 2.4e6, 2.56e6],
            gain_stages: [("tuner".to_string(), [0.0, max, 0.1])]
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
        self.apply()?;
        let dev = self.dev;
        self.call("rtlsdr_reset_buffer", |l| {
            Ok(unsafe { sym!(l, "rtlsdr_reset_buffer", unsafe extern "C" fn(Dev) -> c_int)(dev) })
        })
    }
    fn read(&mut self, out: &mut Vec<i8>) -> Result<(), String> {
        let dev = self.dev;
        let len = self.buf.len() as c_int;
        let mut n: c_int = 0;
        let ptr = self.buf.as_mut_ptr() as *mut c_void;
        self.call("rtlsdr_read_sync", |l| {
            Ok(unsafe {
                sym!(
                    l,
                    "rtlsdr_read_sync",
                    unsafe extern "C" fn(Dev, *mut c_void, c_int, *mut c_int) -> c_int
                )(dev, ptr, len, &mut n)
            })
        })?;
        let n = (n.max(0) as usize) & !1;
        out.extend(self.buf[..n].iter().map(|&b| (b as i16 - 128) as i8));
        Ok(())
    }
    fn tune(&mut self, hz: f64) -> Result<f64, String> {
        let dev = self.dev;
        let f = hz.round() as u32;
        self.call("rtlsdr_set_center_freq", |l| {
            Ok(unsafe {
                sym!(
                    l,
                    "rtlsdr_set_center_freq",
                    unsafe extern "C" fn(Dev, u32) -> c_int
                )(dev, f)
            })
        })?;
        self.centre = f as f64;
        Ok(self.centre)
    }
    fn set_rate(&mut self, hz: f64) -> Result<f64, String> {
        let dev = self.dev;
        let r = hz.round() as u32;
        self.call("rtlsdr_set_sample_rate", |l| {
            Ok(unsafe {
                sym!(
                    l,
                    "rtlsdr_set_sample_rate",
                    unsafe extern "C" fn(Dev, u32) -> c_int
                )(dev, r)
            })
        })?;
        self.rate = r as f64;
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
        let dev = self.dev;
        self.call("rtlsdr_set_bias_tee", |l| {
            Ok(unsafe {
                sym!(
                    l,
                    "rtlsdr_set_bias_tee",
                    unsafe extern "C" fn(Dev, c_int) -> c_int
                )(dev, on as c_int)
            })
        })?;
        self.bias = on;
        Ok(())
    }
    fn stop(&mut self) {
        if !self.dev.is_null() {
            if let Ok(close) = unsafe {
                self.lib
                    .get::<unsafe extern "C" fn(Dev) -> c_int>(b"rtlsdr_close\0")
            } {
                unsafe { close(self.dev) };
            }
            self.dev = std::ptr::null_mut();
        }
    }
}

impl Drop for RtlUsb {
    fn drop(&mut self) {
        self.stop();
    }
}
