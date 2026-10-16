//! Narrowband I/Q channel: shift to the wanted frequency, decimate by an integer.

use super::fir::{Chain, Nco};
use rustfft::num_complex::Complex32 as C32;

pub struct IqChain {
    nco: Nco,
    chain: Chain,
    pub rate: f64,
    pub decimation: usize,
    pub delay: f64,
    tmp: Vec<C32>,
}

impl IqChain {
    pub fn new(fs: f64, centre: f64, freq: f64, rate: f64) -> Self {
        let chain = Chain::new(fs, rate.max(1000.0));
        Self {
            nco: Nco::new(-(freq - centre), fs),
            rate: chain.rate_out,
            decimation: chain.decimation,
            delay: chain.delay(),
            chain,
            tmp: Vec::new(),
        }
    }

    pub fn process(&mut self, x: &[C32], out: &mut Vec<C32>) {
        self.tmp.clear();
        self.tmp.extend_from_slice(x);
        self.nco.mix(&mut self.tmp);
        self.chain.process(&self.tmp, out);
    }
}
