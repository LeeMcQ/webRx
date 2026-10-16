//! Spectrum codec v1 (spec §6, tier 2).
//!
//! Levels (dBm, or dBFS when uncalibrated) are quantised to integers of
//! `step` dB. A key frame predicts each bin from its lower neighbour; a delta
//! frame predicts each bin from the same bin in the previous frame, as the
//! decoder reconstructed it. Residuals are zigzag-mapped and Rice-coded.
//!
//! Payload: `u16 bins · u16 step (centi-dB) · u8 mode (0 key, 1 delta) · Rice stream`.

use crate::bits::{BitReader, BitWriter};
use crate::{rice, unzigzag, zigzag, Error, Result};

pub const MODE_KEY: u8 = 0;
pub const MODE_DELTA: u8 = 1;
/// Levels are clamped to this range before quantising.
pub const MIN_DB: f32 = -250.0;
pub const MAX_DB: f32 = 50.0;

#[inline]
fn quantise(v: f32, step: f32) -> i32 {
    let v = if v.is_finite() {
        v.clamp(MIN_DB, MAX_DB)
    } else {
        MIN_DB
    };
    (v / step).round() as i32
}

pub struct SpectrumEncoder {
    step_cdb: u16,
    prev: Vec<i32>,
}

impl SpectrumEncoder {
    /// `step_db` is the quantisation step (e.g. 0.25, 0.5, 1.0 dB).
    pub fn new(step_db: f32) -> Self {
        Self {
            step_cdb: (step_db * 100.0).round().clamp(1.0, 2000.0) as u16,
            prev: Vec::new(),
        }
    }

    pub fn step_db(&self) -> f32 {
        self.step_cdb as f32 / 100.0
    }

    pub fn set_step(&mut self, step_db: f32) {
        let s = (step_db * 100.0).round().clamp(1.0, 2000.0) as u16;
        if s != self.step_cdb {
            self.step_cdb = s;
            self.prev.clear();
        }
    }

    /// Whether the next frame must be a key frame (no reference yet, or the bin count changed).
    pub fn needs_key(&self, bins: usize) -> bool {
        self.prev.len() != bins
    }

    pub fn encode(&mut self, levels: &[f32], key: bool) -> Vec<u8> {
        let n = levels.len().min(u16::MAX as usize);
        let key = key || self.needs_key(n);
        let step = self.step_db();
        let q: Vec<i32> = levels[..n].iter().map(|&v| quantise(v, step)).collect();
        let mut res = Vec::with_capacity(n);
        if key {
            let mut p = 0i32;
            for &x in &q {
                res.push(zigzag(x - p));
                p = x;
            }
        } else {
            for (i, &x) in q.iter().enumerate() {
                res.push(zigzag(x - self.prev[i]));
            }
        }
        let mut w = BitWriter::new();
        w.out.extend_from_slice(&(n as u16).to_le_bytes());
        w.out.extend_from_slice(&self.step_cdb.to_le_bytes());
        w.out.push(if key { MODE_KEY } else { MODE_DELTA });
        rice::encode_into(&mut w, &res);
        self.prev = q;
        w.finish()
    }
}

#[derive(Default)]
pub struct SpectrumDecoder {
    step_cdb: u16,
    prev: Vec<i32>,
}

impl SpectrumDecoder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Forgets the reference (after a lost frame): only a key frame decodes next.
    pub fn reset(&mut self) {
        self.prev.clear();
    }

    pub fn decode(&mut self, payload: &[u8]) -> Result<Vec<f32>> {
        if payload.len() < 5 {
            return Err(Error::Truncated);
        }
        let n = u16::from_le_bytes([payload[0], payload[1]]) as usize;
        let step_cdb = u16::from_le_bytes([payload[2], payload[3]]);
        let mode = payload[4];
        if step_cdb == 0 {
            return Err(Error::Invalid("step"));
        }
        let mut r = BitReader::new(&payload[5..]);
        let mut res = Vec::new();
        rice::decode_from(&mut r, n, &mut res)?;
        let mut q = vec![0i32; n];
        match mode {
            MODE_KEY => {
                let mut p = 0i32;
                for i in 0..n {
                    p = p.wrapping_add(unzigzag(res[i]));
                    q[i] = p;
                }
            }
            MODE_DELTA => {
                if self.prev.len() != n || self.step_cdb != step_cdb {
                    return Err(Error::NeedKey);
                }
                for i in 0..n {
                    q[i] = self.prev[i].wrapping_add(unzigzag(res[i]));
                }
            }
            _ => return Err(Error::Invalid("spectrum mode")),
        }
        let step = step_cdb as f32 / 100.0;
        let out = q.iter().map(|&x| x as f32 * step).collect();
        self.prev = q;
        self.step_cdb = step_cdb;
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(seed: u32, n: usize) -> Vec<f32> {
        // noise floor around −100 dBm ± 3 dB, a carrier at bin n/3
        let mut s = seed;
        (0..n)
            .map(|i| {
                s = s.wrapping_mul(1_103_515_245).wrapping_add(12345);
                let noise = ((s >> 16) % 600) as f32 / 100.0 - 3.0;
                if i == n / 3 {
                    -40.0 + noise * 0.1
                } else {
                    -100.0 + noise
                }
            })
            .collect()
    }

    #[test]
    fn key_and_delta_round_trip_within_half_a_step() {
        let mut e = SpectrumEncoder::new(0.25);
        let mut d = SpectrumDecoder::new();
        for k in 0..10 {
            let f = frame(k, 1024);
            let p = e.encode(&f, k == 0);
            let g = d.decode(&p).unwrap();
            assert_eq!(g.len(), 1024);
            for (a, b) in f.iter().zip(&g) {
                assert!((a - b).abs() <= 0.125 + 1e-4, "{a} vs {b}");
            }
        }
    }

    #[test]
    fn delta_without_key_is_refused() {
        let mut e = SpectrumEncoder::new(0.5);
        let _ = e.encode(&frame(1, 64), true);
        let p = e.encode(&frame(2, 64), false);
        assert_eq!(
            SpectrumDecoder::new().decode(&p).unwrap_err(),
            Error::NeedKey
        );
    }

    #[test]
    fn coarser_steps_cost_fewer_bits() {
        let sizes: Vec<usize> = [0.25f32, 1.0, 2.0]
            .iter()
            .map(|&s| {
                let mut e = SpectrumEncoder::new(s);
                let _ = e.encode(&frame(1, 2048), true);
                e.encode(&frame(2, 2048), false).len()
            })
            .collect();
        assert!(sizes[0] > sizes[1] && sizes[1] > sizes[2], "{sizes:?}");
    }
}
