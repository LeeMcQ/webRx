//! HackRF One / HackRF Pro through libhackrf (loaded at run time).
//!
//! With `pps_trigger`, the HackRF waits for a rising edge on its trigger input
//! before it samples (`hackrf_set_hw_sync_mode`), so sample 0 sits on a GPS
//! PPS edge to within one sample period — the basis of class A/B timing.

use super::{load_lib, Gains, Source};
use libloading::{Library, Symbol};
use std::ffi::{c_int, c_void, CString};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{sync_channel, Receiver, SyncSender, TrySendError};
use std::sync::Arc;
use std::time::Duration;
use trace_core::context::Device;

type Dev = *mut c_void;

/// `hackrf_transfer` from hackrf.h.
#[repr(C)]
struct Transfer {
    device: Dev,
    buffer: *mut u8,
    buffer_length: c_int,
    valid_length: c_int,
    rx_ctx: *mut c_void,
    tx_ctx: *mut c_void,
}

struct RxCtx {
    tx: SyncSender<Vec<i8>>,
    dropped: Arc<AtomicU64>,
}

extern "C" fn rx_callback(t: *mut Transfer) -> c_int {
    unsafe {
        let t = &*t;
        let ctx = &*(t.rx_ctx as *const RxCtx);
        let n = (t.valid_length.max(0) as usize) & !1;
        let v = std::slice::from_raw_parts(t.buffer as *const i8, n).to_vec();
        if let Err(TrySendError::Full(v)) = ctx.tx.try_send(v) {
            ctx.dropped
                .fetch_add((v.len() / 2) as u64, Ordering::Relaxed);
        }
    }
    0
}

pub struct HackRf {
    lib: Library,
    dev: Dev,
    serial: Option<String>,
    centre: f64,
    rate: f64,
    gains: Gains,
    bias: bool,
    pps: bool,
    rx: Option<Receiver<Vec<i8>>>,
    ctx: Option<Box<RxCtx>>,
    /// Samples dropped because the station could not keep up.
    pub dropped: Arc<AtomicU64>,
}

unsafe impl Send for HackRf {}

macro_rules! call {
    ($self:expr, $name:literal, $t:ty, $($arg:expr),*) => {{
        let f: Symbol<$t> = unsafe { $self.lib.get(concat!($name, "\0").as_bytes()) }.map_err(|e| format!("libhackrf {}: {e}", $name))?;
        let r = unsafe { f($($arg),*) };
        if r != 0 { return Err(format!("{} failed ({r})", $name)); }
    }};
}

impl HackRf {
    pub fn open(
        serial: Option<&str>,
        centre: f64,
        rate: f64,
        gains: Gains,
        pps_trigger: bool,
    ) -> Result<Self, String> {
        let lib = load_lib(&[
            "libhackrf.so.0",
            "libhackrf.so",
            "libhackrf.0.dylib",
            "libhackrf.dylib",
            "hackrf.dll",
        ])?;
        let mut s = Self {
            lib,
            dev: std::ptr::null_mut(),
            serial: serial.map(str::to_string),
            centre,
            rate,
            gains,
            bias: false,
            pps: pps_trigger,
            rx: None,
            ctx: None,
            dropped: Arc::new(AtomicU64::new(0)),
        };
        call!(s, "hackrf_init", unsafe extern "C" fn() -> c_int,);
        let mut dev: Dev = std::ptr::null_mut();
        match serial {
            Some(sn) => {
                let c = CString::new(sn).map_err(|_| "bad serial")?;
                call!(
                    s,
                    "hackrf_open_by_serial",
                    unsafe extern "C" fn(*const std::ffi::c_char, *mut Dev) -> c_int,
                    c.as_ptr(),
                    &mut dev
                );
            }
            None => call!(
                s,
                "hackrf_open",
                unsafe extern "C" fn(*mut Dev) -> c_int,
                &mut dev
            ),
        }
        s.dev = dev;
        Ok(s)
    }

    fn apply_gains(&mut self) -> Result<(), String> {
        let dev = self.dev;
        let lna = (self.gains.get("lna").copied().unwrap_or(16.0) / 8.0)
            .round()
            .clamp(0.0, 5.0) as u32
            * 8;
        let vga = (self.gains.get("vga").copied().unwrap_or(20.0) / 2.0)
            .round()
            .clamp(0.0, 31.0) as u32
            * 2;
        let amp = self.gains.get("amp").copied().unwrap_or(0.0) > 0.0;
        self.gains.insert("lna".into(), lna as f64);
        self.gains.insert("vga".into(), vga as f64);
        self.gains
            .insert("amp".into(), if amp { 14.0 } else { 0.0 });
        call!(
            self,
            "hackrf_set_lna_gain",
            unsafe extern "C" fn(Dev, u32) -> c_int,
            dev,
            lna
        );
        call!(
            self,
            "hackrf_set_vga_gain",
            unsafe extern "C" fn(Dev, u32) -> c_int,
            dev,
            vga
        );
        call!(
            self,
            "hackrf_set_amp_enable",
            unsafe extern "C" fn(Dev, u8) -> c_int,
            dev,
            amp as u8
        );
        Ok(())
    }

    fn apply_rate(&mut self) -> Result<(), String> {
        let dev = self.dev;
        let rate = self.rate;
        call!(
            self,
            "hackrf_set_sample_rate",
            unsafe extern "C" fn(Dev, f64) -> c_int,
            dev,
            rate
        );
        let bw: Symbol<unsafe extern "C" fn(u32) -> u32> =
            unsafe { self.lib.get(b"hackrf_compute_baseband_filter_bw\0") }
                .map_err(|e| e.to_string())?;
        let b = unsafe { bw((rate * 0.75) as u32) };
        call!(
            self,
            "hackrf_set_baseband_filter_bandwidth",
            unsafe extern "C" fn(Dev, u32) -> c_int,
            dev,
            b
        );
        Ok(())
    }
}

impl Source for HackRf {
    fn device(&self) -> Device {
        Device {
            kind: "hackrf".into(),
            name: "HackRF".into(),
            serial: self.serial.clone(),
            min_hz: 1e6,
            max_hz: 6e9,
            rates: vec![2e6, 4e6, 8e6, 10e6, 16e6, 20e6],
            gain_stages: [
                ("lna".to_string(), [0.0, 40.0, 8.0]),
                ("vga".to_string(), [0.0, 62.0, 2.0]),
                ("amp".to_string(), [0.0, 14.0, 14.0]),
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
    fn pps_aligned(&self) -> bool {
        self.pps
    }
    fn take_dropped(&mut self) -> u64 {
        self.dropped.swap(0, Ordering::Relaxed)
    }
    fn start(&mut self) -> Result<(), String> {
        let dev = self.dev;
        self.apply_rate()?;
        let f = self.centre as u64;
        call!(
            self,
            "hackrf_set_freq",
            unsafe extern "C" fn(Dev, u64) -> c_int,
            dev,
            f
        );
        self.apply_gains()?;
        if self.pps {
            call!(
                self,
                "hackrf_set_hw_sync_mode",
                unsafe extern "C" fn(Dev, u8) -> c_int,
                dev,
                1u8
            );
        }
        let (tx, rx) = sync_channel::<Vec<i8>>(64);
        let ctx = Box::new(RxCtx {
            tx,
            dropped: self.dropped.clone(),
        });
        let p = &*ctx as *const RxCtx as *mut c_void;
        call!(
            self,
            "hackrf_start_rx",
            unsafe extern "C" fn(Dev, extern "C" fn(*mut Transfer) -> c_int, *mut c_void) -> c_int,
            dev,
            rx_callback,
            p
        );
        self.ctx = Some(ctx);
        self.rx = Some(rx);
        Ok(())
    }
    fn read(&mut self, out: &mut Vec<i8>) -> Result<(), String> {
        let rx = self.rx.as_ref().ok_or("not started")?;
        // with a PPS trigger the first block waits for the edge; allow 2 s
        match rx.recv_timeout(Duration::from_secs(if self.pps { 3 } else { 2 })) {
            Ok(v) => {
                out.extend_from_slice(&v);
                Ok(())
            }
            Err(_) => Err(if self.pps {
                "no samples: is PPS reaching the trigger input?".into()
            } else {
                "HackRF stopped streaming".into()
            }),
        }
    }
    fn tune(&mut self, hz: f64) -> Result<f64, String> {
        let dev = self.dev;
        let f = hz.round() as u64;
        call!(
            self,
            "hackrf_set_freq",
            unsafe extern "C" fn(Dev, u64) -> c_int,
            dev,
            f
        );
        self.centre = f as f64;
        Ok(self.centre)
    }
    fn set_rate(&mut self, hz: f64) -> Result<f64, String> {
        self.rate = hz.clamp(2e6, 20e6);
        self.apply_rate()?;
        Ok(self.rate)
    }
    fn set_gain(&mut self, stages: &Gains, _auto: Option<bool>) -> Result<(), String> {
        for (k, v) in stages {
            self.gains.insert(k.clone(), *v);
        }
        self.apply_gains()
    }
    fn set_bias_tee(&mut self, on: bool) -> Result<(), String> {
        let dev = self.dev;
        call!(
            self,
            "hackrf_set_antenna_enable",
            unsafe extern "C" fn(Dev, u8) -> c_int,
            dev,
            on as u8
        );
        self.bias = on;
        Ok(())
    }
    fn stop(&mut self) {
        if self.dev.is_null() {
            return;
        }
        unsafe {
            if let Ok(f) = self
                .lib
                .get::<unsafe extern "C" fn(Dev) -> c_int>(b"hackrf_stop_rx\0")
            {
                f(self.dev);
            }
            if let Ok(f) = self
                .lib
                .get::<unsafe extern "C" fn(Dev) -> c_int>(b"hackrf_close\0")
            {
                f(self.dev);
            }
        }
        self.dev = std::ptr::null_mut();
        self.rx = None;
        self.ctx = None;
    }
}

impl Drop for HackRf {
    fn drop(&mut self) {
        self.stop();
    }
}
