//! Server-side demodulation for the audio track: AM, NFM, WFM, USB, LSB, CW.

use super::fir::{lowpass, Chain, Fir, Nco, RealFir, Resampler};
use rustfft::num_complex::Complex32 as C32;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Mode {
    Am,
    Nfm,
    Wfm,
    Usb,
    Lsb,
    Cw,
}

impl Mode {
    pub fn parse(s: &str) -> Mode {
        match s.to_ascii_lowercase().as_str() {
            "am" | "amn" | "sam" => Mode::Am,
            "wfm" | "fm" | "wbfm" => Mode::Wfm,
            "usb" => Mode::Usb,
            "lsb" => Mode::Lsb,
            "cw" => Mode::Cw,
            _ => Mode::Nfm,
        }
    }
    pub fn name(self) -> &'static str {
        match self {
            Mode::Am => "am",
            Mode::Nfm => "nfm",
            Mode::Wfm => "wfm",
            Mode::Usb => "usb",
            Mode::Lsb => "lsb",
            Mode::Cw => "cw",
        }
    }
}

pub struct AudioChain {
    pub mode: Mode,
    nco: Nco,
    chain: Chain,
    pub fi: f64,
    shift_in: Nco,
    shift_out: Nco,
    chan: Fir,
    last: C32,
    fm_scale: f32,
    de_alpha: f32,
    de_y: f32,
    dc: f32,
    peak: f32,
    afir: RealFir,
    rs: Resampler,
    pub out_rate: f64,
    bb: Vec<C32>,
    a: Vec<f32>,
}

impl AudioChain {
    /// `lo`/`hi` are passband edges relative to `freq` (Hz); `deemph_us` applies to WFM.
    pub fn new(
        fs: f64,
        centre: f64,
        freq: f64,
        mode: Mode,
        lo: f64,
        hi: f64,
        out_rate: f64,
        deemph_us: f64,
    ) -> Self {
        let (lo, hi) = if hi > lo { (lo, hi) } else { (hi, lo) };
        let bw = (hi - lo).max(200.0);
        let min_rate = if mode == Mode::Wfm {
            bw.max(200_000.0)
        } else {
            (2.0 * bw).max(48_000.0)
        };
        let chain = Chain::new(fs, min_rate);
        let fi = chain.rate_out;
        let c = (lo + hi) / 2.0;
        let taps = ((3.3 * fi / (bw * 0.25)).round() as usize).clamp(31, 401);
        let chan = Fir::new(lowpass((bw / 2.0 / fi).min(0.49), taps));
        let audio_cut = match mode {
            Mode::Wfm => 15_000.0,
            Mode::Am | Mode::Nfm => (bw / 2.0).min(out_rate * 0.45),
            _ => (bw / 2.0 + c.abs()).min(out_rate * 0.45),
        };
        let afir = RealFir::new(lowpass((audio_cut / fi).min(0.49), 63));
        let dev = match mode {
            Mode::Wfm => 75_000.0,
            _ => (bw / 2.0 * 0.8).max(1_000.0),
        };
        let tau = deemph_us * 1e-6;
        Self {
            mode,
            nco: Nco::new(-(freq - centre), fs),
            chain,
            fi,
            shift_in: Nco::new(-c, fi),
            shift_out: Nco::new(c, fi),
            chan,
            last: C32::new(1.0, 0.0),
            fm_scale: (fi / (2.0 * std::f64::consts::PI * dev)) as f32,
            de_alpha: if mode == Mode::Wfm && tau > 0.0 {
                (1.0 - (-1.0 / (fi * tau)).exp()) as f32
            } else {
                1.0
            },
            de_y: 0.0,
            dc: 0.0,
            peak: 1e-3,
            afir,
            rs: Resampler::new(fi, out_rate),
            out_rate,
            bb: Vec::new(),
            a: Vec::new(),
        }
    }

    /// Demodulates a block of device-rate samples; appends audio (−1…1) at `out_rate`.
    pub fn process(&mut self, x: &[C32], out: &mut Vec<f32>) {
        let mut v = x.to_vec();
        self.nco.mix(&mut v);
        self.bb.clear();
        self.chain.process(&v, &mut self.bb);
        if self.bb.is_empty() {
            return;
        }
        let mut bb = std::mem::take(&mut self.bb);
        self.shift_in.mix(&mut bb);
        self.chan.process(&mut bb);
        self.a.clear();
        match self.mode {
            Mode::Nfm | Mode::Wfm => {
                for &z in &bb {
                    let d = (z * self.last.conj()).arg();
                    self.last = z;
                    let s = d * self.fm_scale;
                    self.de_y += self.de_alpha * (s - self.de_y);
                    self.a.push(self.de_y);
                }
            }
            Mode::Am => {
                for &z in &bb {
                    let m = z.norm();
                    self.dc += 0.0005 * (m - self.dc);
                    self.a.push(m - self.dc);
                }
            }
            Mode::Usb | Mode::Lsb | Mode::Cw => {
                self.shift_out.mix(&mut bb);
                self.a.extend(bb.iter().map(|z| z.re));
            }
        }
        self.bb = bb;
        let mut a = std::mem::take(&mut self.a);
        self.afir.process(&mut a);
        if !matches!(self.mode, Mode::Nfm | Mode::Wfm) {
            // AGC: fast attack, slow release, to −6 dBFS
            let release = (-1.0 / (self.fi * 0.5)).exp() as f32;
            for s in a.iter_mut() {
                let m = s.abs();
                self.peak = if m > self.peak {
                    m
                } else {
                    (self.peak * release).max(1e-5)
                };
                *s *= 0.5 / self.peak;
            }
        }
        for s in a.iter_mut() {
            *s = s.clamp(-1.0, 1.0);
        }
        self.rs.process(&a, out);
        self.a = a;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn nfm_recovers_the_tone() {
        let fs = 2_400_000.0;
        let f0 = 100_000.0;
        let mut ch = AudioChain::new(fs, 0.0, f0, Mode::Nfm, -6000.0, 6000.0, 48_000.0, 0.0);
        let mut ph = 0f64;
        let x: Vec<C32> = (0..fs as usize / 2)
            .map(|n| {
                let t = n as f64 / fs;
                ph += 2.0
                    * std::f64::consts::PI
                    * (f0 + 3000.0 * (2.0 * std::f64::consts::PI * 1000.0 * t).sin())
                    / fs;
                C32::new(ph.cos() as f32 * 0.3, ph.sin() as f32 * 0.3)
            })
            .collect();
        let mut out = Vec::new();
        for c in x.chunks(38_400) {
            ch.process(c, &mut out);
        }
        assert!((out.len() as f64 - 24_000.0).abs() < 200.0, "{}", out.len());
        // the 1 kHz tone dominates: correlate with sin/cos at 1 kHz
        let tail = &out[out.len() / 2..];
        let (mut s, mut c, mut e) = (0f64, 0f64, 0f64);
        for (i, &v) in tail.iter().enumerate() {
            let a = 2.0 * std::f64::consts::PI * 1000.0 * i as f64 / 48_000.0;
            s += v as f64 * a.sin();
            c += v as f64 * a.cos();
            e += (v as f64).powi(2);
        }
        let tone = 2.0 * (s * s + c * c) / tail.len() as f64;
        assert!(tone / e > 0.8, "tone fraction {}", tone / e);
    }
}
