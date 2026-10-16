//! Sample index ↔ GPS time (spec §4).
//!
//! t(n) = t0 + (n − n0) / (fs · (1 + ε)), with t in nanoseconds since the GPS
//! epoch (1980-01-06) plus a 32-bit fraction, fs a ratio of integers and ε the
//! measured clock error in parts per billion.

use serde::{Deserialize, Serialize};

/// Seconds between the Unix epoch and the GPS epoch.
pub const GPS_EPOCH_UNIX_S: u64 = 315_964_800;
/// GPS − UTC in seconds (leap seconds since 1980; unchanged since 2017).
pub const LEAP_SECONDS: u64 = 18;

pub fn unix_ns_to_gps_ns(unix_ns: u128) -> u64 {
    (unix_ns - (GPS_EPOCH_UNIX_S as u128) * 1_000_000_000 + (LEAP_SECONDS as u128) * 1_000_000_000)
        as u64
}

pub fn gps_ns_to_unix_ns(gps_ns: u64) -> u128 {
    gps_ns as u128 + (GPS_EPOCH_UNIX_S as u128) * 1_000_000_000
        - (LEAP_SECONDS as u128) * 1_000_000_000
}

/// Accuracy classes (spec §4).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum ClockClass {
    /// GPSDO reference + PPS in the samples: ≤ 50 ns.
    A = 0,
    /// PPS in the samples, free-running clock: ≤ 1 µs.
    B = 1,
    /// Host clock (NTP / phone GPS): ≤ 10 ms.
    C = 2,
    /// Unknown.
    D = 3,
}

impl ClockClass {
    pub fn target_ns(self) -> u64 {
        match self {
            ClockClass::A => 50,
            ClockClass::B => 1_000,
            ClockClass::C => 10_000_000,
            ClockClass::D => u64::MAX,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Anchor {
    pub n0: u64,
    pub t0_ns: u64,
    pub t0_frac: u32,
    pub fs_num: u64,
    pub fs_den: u64,
    /// Measured clock error in parts per billion (positive = the device runs fast).
    pub eps_ppb: f64,
}

impl Anchor {
    pub fn new(n0: u64, t0_ns: u64, fs_num: u64, fs_den: u64) -> Self {
        Self {
            n0,
            t0_ns,
            t0_frac: 0,
            fs_num,
            fs_den,
            eps_ppb: 0.0,
        }
    }

    /// GPS time of sample `n` as (ns, fraction in 2^-32 ns).
    pub fn time_of(&self, n: u64) -> (u64, u32) {
        let dn = n as i128 - self.n0 as i128;
        // elapsed time in units of 2^-32 ns
        let mut dq =
            dn * 1_000_000_000i128 * (1i128 << 32) * self.fs_den as i128 / self.fs_num as i128;
        if self.eps_ppb != 0.0 {
            dq -= ((dq as f64) * self.eps_ppb / 1e9) as i128;
        }
        let t = (((self.t0_ns as i128) << 32) | self.t0_frac as i128) + dq;
        ((t >> 32) as u64, (t & 0xffff_ffff) as u32)
    }

    /// Sample index nearest to a GPS time.
    pub fn index_of(&self, t_ns: u64) -> u64 {
        let dt = t_ns as f64 - self.t0_ns as f64 - self.t0_frac as f64 / 4_294_967_296.0;
        let fs = self.fs_num as f64 / self.fs_den as f64 * (1.0 + self.eps_ppb / 1e9);
        let n = self.n0 as f64 + dt * 1e-9 * fs;
        if n <= 0.0 {
            0
        } else {
            n.round() as u64
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn time_of_index() {
        let a = Anchor::new(1000, 1_400_000_000_000_000_000, 2_400_000, 1);
        assert_eq!(a.time_of(1000), (1_400_000_000_000_000_000, 0));
        // 2.4 MS/s: 2 400 000 samples = 1 s exactly
        assert_eq!(a.time_of(2_401_000), (1_400_000_001_000_000_000, 0));
        // one sample = 416.666… ns
        let (ns, frac) = a.time_of(1001);
        assert_eq!(ns, 1_400_000_000_000_000_416);
        assert!((frac as f64 / 4294967296.0 - 2.0 / 3.0).abs() < 1e-6);
        assert_eq!(a.index_of(1_400_000_001_000_000_000), 2_401_000);
        // a device running 10 ppm fast: 1 s of nominal samples is 10 µs short
        let fast = Anchor {
            eps_ppb: 10_000.0,
            ..a
        };
        let (ns, _) = fast.time_of(2_401_000);
        assert!(
            (ns as i64 - 1_400_000_000_999_990_000i64).abs() <= 1,
            "{ns}"
        );
    }

    #[test]
    fn epochs() {
        // 2026-10-16T00:00:00Z
        let unix = 1_792_108_800u128 * 1_000_000_000;
        let gps = unix_ns_to_gps_ns(unix);
        assert_eq!(gps, (1_792_108_800 - 315_964_800 + 18) * 1_000_000_000);
        assert_eq!(gps_ns_to_unix_ns(gps), unix);
    }
}
