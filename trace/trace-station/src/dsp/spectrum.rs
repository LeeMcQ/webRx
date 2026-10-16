//! The shared spectrum engine: one FFT stream per receiver, whatever the number of clients.
//!
//! Blackman–Harris window, power normalised so a full-scale tone centred on a
//! bin reads 0 dBFS (as webRx's dsp-rs does). Power is averaged linearly; a
//! CPU budget caps FFTs per second on wide sample rates by skipping blocks.

use rustfft::num_complex::Complex32 as C32;
use rustfft::{Fft, FftPlanner};
use std::sync::Arc;

/// Equivalent noise bandwidth of the 4-term Blackman–Harris window, in bins.
pub const ENBW_BINS: f64 = 2.004;

pub struct SpecEngine {
    pub n: usize,
    fft: Arc<dyn Fft<f32>>,
    win: Vec<f32>,
    norm: f64,
    pend: Vec<C32>,
    acc: Vec<f64>,
    pub frames: u32,
    max_per_sec: f64,
    fs: f64,
    block_no: u64,
    scratch: Vec<C32>,
}

impl SpecEngine {
    pub fn new(n: usize, fs: f64, max_per_sec: f64) -> Self {
        let n = n.next_power_of_two().clamp(256, 65536);
        let fft = FftPlanner::new().plan_fft_forward(n);
        let win: Vec<f32> = (0..n)
            .map(|i| {
                let x = 2.0 * std::f64::consts::PI * i as f64 / (n - 1) as f64;
                (0.35875 - 0.48829 * x.cos() + 0.14128 * (2.0 * x).cos()
                    - 0.01168 * (3.0 * x).cos()) as f32
            })
            .collect();
        let wsum: f64 = win.iter().map(|&w| w as f64).sum();
        let scratch = vec![C32::new(0.0, 0.0); fft.get_inplace_scratch_len()];
        Self {
            n,
            fft,
            win,
            norm: 1.0 / (wsum * wsum),
            pend: Vec::new(),
            acc: vec![0.0; n],
            frames: 0,
            max_per_sec,
            fs,
            block_no: 0,
            scratch,
        }
    }

    pub fn set_rate(&mut self, fs: f64) {
        self.fs = fs;
        self.pend.clear();
        self.acc.iter_mut().for_each(|v| *v = 0.0);
        self.frames = 0;
    }

    pub fn feed(&mut self, x: &[C32]) {
        self.pend.extend_from_slice(x);
        let stride = ((self.fs / self.n as f64) / self.max_per_sec)
            .ceil()
            .max(1.0) as u64;
        let mut off = 0;
        while self.pend.len() - off >= self.n {
            self.block_no += 1;
            if self.block_no % stride == 0 {
                let mut b: Vec<C32> = self.pend[off..off + self.n]
                    .iter()
                    .zip(&self.win)
                    .map(|(s, &w)| s * w)
                    .collect();
                self.fft.process_with_scratch(&mut b, &mut self.scratch);
                let h = self.n / 2;
                for (k, v) in b.iter().enumerate() {
                    // ascending frequency: negative half first
                    let j = (k + h) % self.n;
                    self.acc[j] += v.norm_sqr() as f64 * self.norm;
                }
                self.frames += 1;
            }
            off += self.n;
        }
        self.pend.drain(..off);
    }

    /// Mean linear power per bin (lowest frequency first) since the last call.
    pub fn take(&mut self) -> Option<(Vec<f64>, u32)> {
        if self.frames == 0 {
            return None;
        }
        let f = self.frames as f64;
        let out = self.acc.iter().map(|v| v / f).collect();
        self.acc.iter_mut().for_each(|v| *v = 0.0);
        let n = self.frames;
        self.frames = 0;
        Some((out, n))
    }
}

/// Reduces `p` (linear power over [band_lo, band_lo + fs)) to a view of `bins` bins.
/// Returns (dB values, view start Hz, view span Hz).
pub fn view(
    p: &[f64],
    band_lo: f64,
    fs: f64,
    centre: Option<f64>,
    span: Option<f64>,
    bins: usize,
    offset_db: f64,
) -> (Vec<f32>, f64, f64) {
    let n = p.len();
    let bw = fs / n as f64;
    let span = span.unwrap_or(fs).clamp(bw * 8.0, fs);
    let c = centre.unwrap_or(band_lo + fs / 2.0);
    let start = (c - span / 2.0).clamp(band_lo, band_lo + fs - span);
    let a = (((start - band_lo) / bw).floor() as usize).min(n - 1);
    let b = ((((start + span) - band_lo) / bw).ceil() as usize).clamp(a + 1, n);
    let m = b - a;
    let out_n = bins.clamp(16, 65535).min(m);
    let mut out = Vec::with_capacity(out_n);
    for j in 0..out_n {
        let lo = a + j * m / out_n;
        let hi = (a + (j + 1) * m / out_n).max(lo + 1);
        let s: f64 = p[lo..hi].iter().sum::<f64>() / (hi - lo) as f64;
        out.push((10.0 * (s + 1e-20).log10() + offset_db) as f32);
    }
    (out, band_lo + a as f64 * bw, m as f64 * bw)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn full_scale_tone_reads_zero_dbfs() {
        let n = 1024;
        let fs = 1.024e6;
        let mut e = SpecEngine::new(n, fs, 1e9);
        let k0 = 100.0; // bin-centred tone at +100 bins
        let x: Vec<C32> = (0..n * 4)
            .map(|i| {
                let a = 2.0 * std::f64::consts::PI * k0 * i as f64 / n as f64;
                C32::new(a.cos() as f32, a.sin() as f32)
            })
            .collect();
        e.feed(&x);
        let (p, frames) = e.take().unwrap();
        assert_eq!(frames, 4);
        let (db, start, span) = view(&p, -fs / 2.0, fs, None, None, n, 0.0);
        assert_eq!((start, span), (-fs / 2.0, fs));
        let (imax, vmax) =
            db.iter()
                .enumerate()
                .fold((0, f32::MIN), |a, (i, &v)| if v > a.1 { (i, v) } else { a });
        assert_eq!(imax, n / 2 + 100);
        assert!(vmax.abs() < 0.05, "{vmax}");
        // a zoomed, reduced view keeps band power where the tone is
        let (z, zs, zspan) = view(
            &p,
            -fs / 2.0,
            fs,
            Some(100_000.0),
            Some(64_000.0),
            16,
            -30.0,
        );
        assert!(zs <= 100_000.0 && zs + zspan >= 100_000.0);
        assert!(z.iter().cloned().fold(f32::MIN, f32::max) > -45.0);
    }
}
