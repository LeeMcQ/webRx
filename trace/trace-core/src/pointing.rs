//! Antenna pointing for direction finding (spec §6, context track, codec `POINTING`).
//!
//! Heading samples are stamped with the receiver's own sample index, the same
//! clock as the spectrum and I/Q they belong to, so a client lines up "level
//! at this instant" with "antenna pointing at this instant" exactly — no
//! guessing from arrival times. One frame carries a batch (typically 50–200 ms
//! of a 10–50 Hz compass).
//!
//! Payload:
//! ```text
//! u8  count
//! u8  north        0 true, 1 magnetic
//! i16 declination  0.01° (east positive) used or known at the station; i16::MIN = unknown
//! u8  source       0 compass · 1 rotator · 2 GPS course · 3 manual · 4 array element · 5 client phone
//! u8  element      antenna / array element ID
//! per sample:
//!   varint delta   device samples since the frame's sample_index (first) or the previous sample
//!   u16 heading    0.01°, 0–35999
//!   i16 pitch      0.01°, i16::MIN = unknown
//!   i16 roll       0.01°, i16::MIN = unknown
//!   u8  accuracy   0.1° (0–25.4°), 255 = unknown
//! ```

use crate::{varint, Error, Result};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum Source {
    Compass = 0,
    Rotator = 1,
    GpsCourse = 2,
    Manual = 3,
    ArrayElement = 4,
    ClientPhone = 5,
}

impl Source {
    pub fn from_u8(v: u8) -> Source {
        match v {
            1 => Source::Rotator,
            2 => Source::GpsCourse,
            3 => Source::Manual,
            4 => Source::ArrayElement,
            5 => Source::ClientPhone,
            _ => Source::Compass,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Sample {
    /// Device sample index at which the heading was read.
    pub index: u64,
    pub heading_deg: f64,
    pub pitch_deg: Option<f64>,
    pub roll_deg: Option<f64>,
    pub accuracy_deg: Option<f64>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Meta {
    pub magnetic: bool,
    pub declination_deg: Option<f64>,
    pub source: Source,
    pub element: u8,
}

fn angle_u16(deg: f64) -> u16 {
    let d = deg.rem_euclid(360.0);
    ((d * 100.0).round() as u32 % 36000) as u16
}

fn opt_i16(v: Option<f64>) -> i16 {
    match v {
        Some(x) if x.is_finite() => (x * 100.0).round().clamp(-32767.0, 32767.0) as i16,
        _ => i16::MIN,
    }
}

fn i16_opt(v: i16) -> Option<f64> {
    (v != i16::MIN).then(|| v as f64 / 100.0)
}

/// Encodes up to 255 samples (sorted by index, all ≥ `base_index`).
pub fn encode(base_index: u64, meta: &Meta, samples: &[Sample]) -> Vec<u8> {
    let n = samples.len().min(255);
    let mut o = Vec::with_capacity(6 + n * 10);
    o.push(n as u8);
    o.push(meta.magnetic as u8);
    o.extend_from_slice(&opt_i16(meta.declination_deg).to_le_bytes());
    o.push(meta.source as u8);
    o.push(meta.element);
    let mut prev = base_index;
    for s in &samples[..n] {
        let idx = s.index.max(prev);
        varint::write(&mut o, idx - prev);
        prev = idx;
        o.extend_from_slice(&angle_u16(s.heading_deg).to_le_bytes());
        o.extend_from_slice(&opt_i16(s.pitch_deg).to_le_bytes());
        o.extend_from_slice(&opt_i16(s.roll_deg).to_le_bytes());
        o.push(match s.accuracy_deg {
            Some(a) if a.is_finite() && a >= 0.0 => (a * 10.0).round().min(254.0) as u8,
            _ => 255,
        });
    }
    o
}

pub fn decode(base_index: u64, payload: &[u8]) -> Result<(Meta, Vec<Sample>)> {
    if payload.len() < 6 {
        return Err(Error::Truncated);
    }
    let n = payload[0] as usize;
    let meta = Meta {
        magnetic: payload[1] != 0,
        declination_deg: i16_opt(i16::from_le_bytes([payload[2], payload[3]])),
        source: Source::from_u8(payload[4]),
        element: payload[5],
    };
    let mut pos = 6;
    let mut idx = base_index;
    let mut out = Vec::with_capacity(n);
    for _ in 0..n {
        let (d, len) = varint::read(payload, pos)?;
        pos += len;
        if payload.len() < pos + 7 {
            return Err(Error::Truncated);
        }
        idx += d;
        let h = u16::from_le_bytes([payload[pos], payload[pos + 1]]);
        if h >= 36000 {
            return Err(Error::Invalid("heading"));
        }
        let pitch = i16::from_le_bytes([payload[pos + 2], payload[pos + 3]]);
        let roll = i16::from_le_bytes([payload[pos + 4], payload[pos + 5]]);
        let acc = payload[pos + 6];
        pos += 7;
        out.push(Sample {
            index: idx,
            heading_deg: h as f64 / 100.0,
            pitch_deg: i16_opt(pitch),
            roll_deg: i16_opt(roll),
            accuracy_deg: (acc != 255).then(|| acc as f64 / 10.0),
        });
    }
    Ok((meta, out))
}

/// Heading at `index`, interpolated along the shortest arc between the samples around it.
pub fn heading_at(samples: &[Sample], index: u64) -> Option<f64> {
    let i = samples.partition_point(|s| s.index <= index);
    if i == 0 || i == samples.len() {
        return None;
    }
    let (a, b) = (&samples[i - 1], &samples[i]);
    let span = (b.index - a.index) as f64;
    let f = if span > 0.0 {
        (index - a.index) as f64 / span
    } else {
        0.0
    };
    let d = (b.heading_deg - a.heading_deg + 540.0).rem_euclid(360.0) - 180.0;
    Some((a.heading_deg + f * d).rem_euclid(360.0))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn round_trip_and_interpolation() {
        let meta = Meta {
            magnetic: false,
            declination_deg: Some(-25.43),
            source: Source::Rotator,
            element: 2,
        };
        let samples: Vec<Sample> = (0..20)
            .map(|k| Sample {
                index: 1_000_000 + k * 120_000,
                heading_deg: (350.0 + k as f64 * 1.5) % 360.0,
                pitch_deg: Some(-1.25),
                roll_deg: None,
                accuracy_deg: Some(2.0),
            })
            .collect();
        let p = encode(1_000_000, &meta, &samples);
        assert!(p.len() <= 6 + 20 * 11);
        let (m, d) = decode(1_000_000, &p).unwrap();
        assert_eq!(m, meta);
        for (a, b) in samples.iter().zip(&d) {
            assert_eq!(a.index, b.index);
            assert!((a.heading_deg - b.heading_deg).abs() < 0.006);
            assert_eq!(b.pitch_deg, Some(-1.25));
            assert_eq!(b.roll_deg, None);
            assert_eq!(b.accuracy_deg, Some(2.0));
        }
        // across north: 359.0 → 0.5 halfway = 359.75
        let wrap = [
            Sample {
                index: 0,
                heading_deg: 359.0,
                pitch_deg: None,
                roll_deg: None,
                accuracy_deg: None,
            },
            Sample {
                index: 100,
                heading_deg: 0.5,
                pitch_deg: None,
                roll_deg: None,
                accuracy_deg: None,
            },
        ];
        assert!((heading_at(&wrap, 50).unwrap() - 359.75).abs() < 1e-9);
        assert_eq!(heading_at(&wrap, 101), None);
    }
}
