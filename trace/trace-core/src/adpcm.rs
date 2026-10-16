//! IMA ADPCM audio (4 bits per sample) for clients without an Opus decoder.
//!
//! Each frame carries the coder state it starts from, so frames decode
//! independently and a lost frame costs only its own 20 ms.
//!
//! Payload: `u32 sample rate · i16 predictor · u8 step index · u8 reserved · nibbles (low first)`.

use crate::{Error, Result};

const INDEX: [i32; 16] = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];
const STEP: [i32; 89] = [
    7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66,
    73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449,
    494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272,
    2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493,
    10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
];

#[derive(Clone, Copy, Default)]
pub struct State {
    pub predictor: i32,
    pub index: i32,
}

#[inline]
fn step(st: &mut State, code: u8) -> i16 {
    let s = STEP[st.index as usize];
    let mut diff = s >> 3;
    if code & 1 != 0 {
        diff += s >> 2;
    }
    if code & 2 != 0 {
        diff += s >> 1;
    }
    if code & 4 != 0 {
        diff += s;
    }
    if code & 8 != 0 {
        st.predictor -= diff;
    } else {
        st.predictor += diff;
    }
    st.predictor = st.predictor.clamp(-32768, 32767);
    st.index = (st.index + INDEX[code as usize]).clamp(0, 88);
    st.predictor as i16
}

#[derive(Default)]
pub struct Encoder {
    st: State,
}

impl Encoder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Encodes an even number of 16-bit samples into one self-contained frame.
    pub fn encode(&mut self, pcm: &[i16], rate: u32) -> Vec<u8> {
        let mut o = Vec::with_capacity(8 + pcm.len() / 2 + 1);
        o.extend_from_slice(&rate.to_le_bytes());
        o.extend_from_slice(&(self.st.predictor as i16).to_le_bytes());
        o.push(self.st.index as u8);
        o.push(0);
        let mut byte = 0u8;
        for (i, &x) in pcm.iter().enumerate() {
            let s = STEP[self.st.index as usize];
            let mut diff = x as i32 - self.st.predictor;
            let mut code = 0u8;
            if diff < 0 {
                code = 8;
                diff = -diff;
            }
            let mut t = s;
            if diff >= t {
                code |= 4;
                diff -= t;
            }
            t >>= 1;
            if diff >= t {
                code |= 2;
                diff -= t;
            }
            t >>= 1;
            if diff >= t {
                code |= 1;
            }
            step(&mut self.st, code);
            if i % 2 == 0 {
                byte = code;
            } else {
                o.push(byte | (code << 4));
            }
        }
        if pcm.len() % 2 == 1 {
            o.push(byte);
        }
        o
    }
}

/// Decodes one frame; returns (sample rate, samples).
pub fn decode(payload: &[u8]) -> Result<(u32, Vec<i16>)> {
    if payload.len() < 8 {
        return Err(Error::Truncated);
    }
    let rate = u32::from_le_bytes(payload[..4].try_into().unwrap());
    let mut st = State {
        predictor: i16::from_le_bytes([payload[4], payload[5]]) as i32,
        index: payload[6] as i32,
    };
    if st.index > 88 {
        return Err(Error::Invalid("adpcm index"));
    }
    let mut out = Vec::with_capacity((payload.len() - 8) * 2);
    for &b in &payload[8..] {
        out.push(step(&mut st, b & 0x0f));
        out.push(step(&mut st, b >> 4));
    }
    Ok((rate, out))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn tone_snr() {
        let pcm: Vec<i16> = (0..4800)
            .map(|i| {
                (12000.0 * (i as f64 * 2.0 * std::f64::consts::PI * 440.0 / 12000.0).sin()) as i16
            })
            .collect();
        let mut e = Encoder::new();
        let mut out = Vec::new();
        for c in pcm.chunks(240) {
            let (rate, d) = decode(&e.encode(c, 12000)).unwrap();
            assert_eq!(rate, 12000);
            out.extend(d);
        }
        let (mut sig, mut err) = (0f64, 0f64);
        for (a, b) in pcm.iter().zip(&out).skip(200) {
            sig += (*a as f64).powi(2);
            err += (*a as f64 - *b as f64).powi(2);
        }
        let snr = 10.0 * (sig / err).log10();
        assert!(snr > 20.0, "SNR {snr:.1} dB");
    }
}
