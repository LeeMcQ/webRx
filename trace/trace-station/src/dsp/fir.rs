//! FIR filters, decimators, NCO and a fractional resampler.

use rustfft::num_complex::Complex32 as C32;

/// Windowed-sinc low-pass (Blackman), unity DC gain. `cutoff` is a fraction of the sample rate (0–0.5).
pub fn lowpass(cutoff: f64, taps: usize) -> Vec<f32> {
    let taps = taps.max(3) | 1;
    let m = (taps - 1) as f64;
    let mut h: Vec<f64> = (0..taps)
        .map(|i| {
            let x = i as f64 - m / 2.0;
            let sinc = if x == 0.0 {
                2.0 * cutoff
            } else {
                (2.0 * std::f64::consts::PI * cutoff * x).sin() / (std::f64::consts::PI * x)
            };
            let w = 0.42 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / m).cos()
                + 0.08 * (4.0 * std::f64::consts::PI * i as f64 / m).cos();
            sinc * w
        })
        .collect();
    let s: f64 = h.iter().sum();
    for v in &mut h {
        *v /= s;
    }
    h.into_iter().map(|v| v as f32).collect()
}

/// One decimating FIR stage on complex samples; computes only the kept outputs.
pub struct Decim {
    taps: Vec<f32>,
    pub factor: usize,
    buf: Vec<C32>,
    pos: usize,
}

impl Decim {
    pub fn new(factor: usize, taps: Vec<f32>) -> Self {
        let n = taps.len();
        Self {
            taps,
            factor: factor.max(1),
            buf: vec![C32::new(0.0, 0.0); n - 1],
            pos: 0,
        }
    }

    pub fn process(&mut self, input: &[C32], out: &mut Vec<C32>) {
        self.buf.extend_from_slice(input);
        let n = self.taps.len();
        while self.pos + n <= self.buf.len() {
            let w = &self.buf[self.pos..self.pos + n];
            let (mut re, mut im) = (0f32, 0f32);
            for (x, &t) in w.iter().zip(&self.taps) {
                re += x.re * t;
                im += x.im * t;
            }
            out.push(C32::new(re, im));
            self.pos += self.factor;
        }
        self.buf.drain(..self.pos.min(self.buf.len()));
        self.pos = self.pos.saturating_sub(self.pos);
    }

    pub fn delay(&self) -> f64 {
        (self.taps.len() - 1) as f64 / 2.0
    }
}

/// Largest D' ≤ d whose prime factors are all ≤ 7, factored into stages of at most 8.
pub fn plan_stages(d: usize) -> Vec<usize> {
    let mut d = d.max(1);
    let smooth = |mut x: usize| {
        for p in [2, 3, 5, 7] {
            while x % p == 0 {
                x /= p;
            }
        }
        x == 1
    };
    while !smooth(d) {
        d -= 1;
    }
    let mut primes = Vec::new();
    let mut x = d;
    for p in [7, 5, 3, 2] {
        while x % p == 0 {
            primes.push(p);
            x /= p;
        }
    }
    // group into stages ≤ 8, biggest factors first (they run at the highest rate with short filters)
    let mut stages: Vec<usize> = Vec::new();
    for p in primes {
        if let Some(last) = stages.last_mut() {
            if *last * p <= 8 {
                *last *= p;
                continue;
            }
        }
        stages.push(p);
    }
    stages
}

/// A chain of decimating stages from `fs_in` down to at least `min_rate`.
pub struct Chain {
    stages: Vec<Decim>,
    pub decimation: usize,
    pub rate_out: f64,
    tmp: Vec<C32>,
}

impl Chain {
    pub fn new(fs_in: f64, min_rate: f64) -> Self {
        let d = ((fs_in / min_rate).floor() as usize).max(1);
        let plan = if d > 1 { plan_stages(d) } else { vec![] };
        let decimation: usize = plan.iter().product::<usize>().max(1);
        let stages = plan
            .iter()
            .map(|&f| {
                // pass 0.8 of the output Nyquist band; the channel filter after the chain sets the final edge
                let cutoff = 0.42 / f as f64;
                Decim::new(f, lowpass(cutoff, 8 * f + 1))
            })
            .collect();
        Self {
            stages,
            decimation,
            rate_out: fs_in / decimation as f64,
            tmp: Vec::new(),
        }
    }

    pub fn process(&mut self, input: &[C32], out: &mut Vec<C32>) {
        if self.stages.is_empty() {
            out.extend_from_slice(input);
            return;
        }
        let mut cur = input.to_vec();
        for s in &mut self.stages {
            self.tmp.clear();
            s.process(&cur, &mut self.tmp);
            std::mem::swap(&mut cur, &mut self.tmp);
        }
        out.extend_from_slice(&cur);
    }

    /// Group delay in input samples.
    pub fn delay(&self) -> f64 {
        let mut d = 0.0;
        let mut scale = 1.0;
        for s in &self.stages {
            d += s.delay() * scale;
            scale *= s.factor as f64;
        }
        d
    }
}

/// Plain (non-decimating) complex FIR.
pub struct Fir {
    taps: Vec<f32>,
    hist: Vec<C32>,
}

impl Fir {
    pub fn new(taps: Vec<f32>) -> Self {
        let n = taps.len();
        Self {
            taps,
            hist: vec![C32::new(0.0, 0.0); n - 1],
        }
    }
    pub fn process(&mut self, x: &mut [C32]) {
        let n = self.taps.len();
        self.hist.extend_from_slice(x);
        for (i, y) in x.iter_mut().enumerate() {
            let w = &self.hist[i..i + n];
            let (mut re, mut im) = (0f32, 0f32);
            for (s, &t) in w.iter().zip(&self.taps) {
                re += s.re * t;
                im += s.im * t;
            }
            *y = C32::new(re, im);
        }
        let len = self.hist.len();
        self.hist.drain(..len - (n - 1));
    }
}

/// Real FIR (audio).
pub struct RealFir {
    taps: Vec<f32>,
    hist: Vec<f32>,
}

impl RealFir {
    pub fn new(taps: Vec<f32>) -> Self {
        let n = taps.len();
        Self {
            taps,
            hist: vec![0.0; n - 1],
        }
    }
    pub fn process(&mut self, x: &mut [f32]) {
        let n = self.taps.len();
        self.hist.extend_from_slice(x);
        for (i, y) in x.iter_mut().enumerate() {
            *y = self.hist[i..i + n]
                .iter()
                .zip(&self.taps)
                .map(|(a, b)| a * b)
                .sum();
        }
        let len = self.hist.len();
        self.hist.drain(..len - (n - 1));
    }
}

/// Numerically controlled oscillator: multiplies by e^{j2π f n / fs}.
pub struct Nco {
    z: C32,
    w: C32,
    n: u32,
}

impl Nco {
    pub fn new(freq: f64, fs: f64) -> Self {
        let a = 2.0 * std::f64::consts::PI * freq / fs;
        Self {
            z: C32::new(1.0, 0.0),
            w: C32::new(a.cos() as f32, a.sin() as f32),
            n: 0,
        }
    }
    pub fn mix(&mut self, x: &mut [C32]) {
        for s in x.iter_mut() {
            *s *= self.z;
            self.z *= self.w;
            self.n += 1;
            if self.n & 1023 == 0 {
                let m = self.z.norm();
                self.z /= m;
            }
        }
    }
}

/// Linear-interpolating resampler for audio after band-limiting.
pub struct Resampler {
    ratio: f64,
    pos: f64,
    last: f32,
}

impl Resampler {
    pub fn new(fs_in: f64, fs_out: f64) -> Self {
        Self {
            ratio: fs_in / fs_out,
            pos: 0.0,
            last: 0.0,
        }
    }
    pub fn process(&mut self, x: &[f32], out: &mut Vec<f32>) {
        // pos counts input samples from `last` (index −1)
        while self.pos < x.len() as f64 {
            let i = self.pos.floor();
            let f = (self.pos - i) as f32;
            let a = if i < 1.0 {
                self.last
            } else {
                x[i as usize - 1]
            };
            let b = x[i as usize];
            out.push(a + (b - a) * f);
            self.pos += self.ratio;
        }
        self.pos -= x.len() as f64;
        if let Some(&l) = x.last() {
            self.last = l;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn plan_is_smooth() {
        assert_eq!(plan_stages(50).iter().product::<usize>(), 50);
        assert_eq!(plan_stages(208).iter().product::<usize>(), 200); // 208 = 16·13 → 200 = 2³·5²
        assert!(plan_stages(4166).iter().all(|&f| f <= 8));
    }

    #[test]
    fn chain_passes_inband_and_rejects_alias() {
        let fs = 2_400_000.0;
        let tone = |f: f64| -> f32 {
            let mut ch = Chain::new(fs, 48_000.0);
            let x: Vec<C32> = (0..240_000)
                .map(|n| {
                    let a = 2.0 * std::f64::consts::PI * f * n as f64 / fs;
                    C32::new(a.cos() as f32, a.sin() as f32)
                })
                .collect();
            let mut y = Vec::new();
            ch.process(&x, &mut y);
            let tail = &y[y.len() / 2..];
            (tail.iter().map(|c| c.norm_sqr()).sum::<f32>() / tail.len() as f32).sqrt()
        };
        let pass = tone(5_000.0);
        let stop = tone(200_000.0);
        assert!((pass - 1.0).abs() < 0.05, "passband gain {pass}");
        assert!(stop < 0.01, "alias leaks {stop}");
    }
}
