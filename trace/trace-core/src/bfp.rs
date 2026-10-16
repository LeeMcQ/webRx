//! Block floating point I/Q (spec §6, tier 4), after O-RAN fronthaul compression.
//!
//! Complex samples (interleaved i16, full scale ±32767) are coded in blocks of
//! 16: a 4-bit shared exponent e, then 32 signed m-bit mantissas, x ≈ mant · 2^e.
//! Phase survives: every sample keeps its own I and Q, only the precision of
//! quiet blocks drops to what the loudest sample in the block needs.
//!
//! Payload: `u8 m · u8 block · u32 complex samples · bit-packed blocks`.

use crate::bits::{BitReader, BitWriter};
use crate::{Error, Result};

pub const BLOCK: usize = 16;

fn exponent_for(maxabs: i32, m: u32) -> u32 {
    let lim = (1i32 << (m - 1)) - 1;
    let mut e = 0;
    // after rounding, (maxabs + half) >> e must still fit
    while e < 15 && ((maxabs + if e > 0 { 1 << (e - 1) } else { 0 }) >> e) > lim {
        e += 1;
    }
    e
}

/// Encodes interleaved I/Q (`iq.len()` even) with `m` mantissa bits (2–16).
pub fn encode(iq: &[i16], m: u32) -> Vec<u8> {
    assert!((2..=16).contains(&m), "mantissa bits 2..16");
    assert!(iq.len() % 2 == 0);
    let n = iq.len() / 2;
    let mut w = BitWriter::new();
    w.out.push(m as u8);
    w.out.push(BLOCK as u8);
    w.out.extend_from_slice(&(n as u32).to_le_bytes());
    let lim = (1i32 << (m - 1)) - 1;
    for block in iq.chunks(2 * BLOCK) {
        let maxabs = block.iter().map(|&x| (x as i32).abs()).max().unwrap_or(0);
        let e = exponent_for(maxabs, m);
        w.put(e, 4);
        for &x in block {
            let x = x as i32;
            let mant = if e == 0 { x } else { (x + (1 << (e - 1))) >> e };
            let mant = mant.clamp(-lim - 1, lim);
            w.put(mant as u32, m);
        }
    }
    w.finish()
}

pub fn decode(payload: &[u8]) -> Result<Vec<i16>> {
    if payload.len() < 6 {
        return Err(Error::Truncated);
    }
    let m = payload[0] as u32;
    let block = payload[1] as usize;
    if !(2..=16).contains(&m) || block == 0 {
        return Err(Error::Invalid("bfp parameters"));
    }
    let n = u32::from_le_bytes(payload[2..6].try_into().unwrap()) as usize;
    if n > 1 << 24 {
        return Err(Error::Invalid("bfp length"));
    }
    let mut r = BitReader::new(&payload[6..]);
    let mut out = Vec::with_capacity(2 * n);
    let mut left = 2 * n;
    while left > 0 {
        let len = left.min(2 * block);
        let e = r.get(4)?;
        for _ in 0..len {
            let raw = r.get(m)?;
            // sign-extend m bits
            let mant = ((raw << (32 - m)) as i32) >> (32 - m);
            out.push((mant << e).clamp(i16::MIN as i32, i16::MAX as i32) as i16);
        }
        left -= len;
    }
    Ok(out)
}

/// Bits per complex sample for `m` mantissa bits: 2m + 4/16.
pub fn bits_per_sample(m: u32) -> f64 {
    2.0 * m as f64 + 4.0 / BLOCK as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phase_survives_and_error_is_bounded() {
        // a tone that fades in, so blocks need different exponents
        let n = 1000;
        let mut iq = Vec::new();
        for i in 0..n {
            let a = 20000.0 * (i as f64 / n as f64);
            let ph = i as f64 * 0.3;
            iq.push((a * ph.cos()) as i16);
            iq.push((a * ph.sin()) as i16);
        }
        for m in [4u32, 8, 12] {
            let p = encode(&iq, m);
            let d = decode(&p).unwrap();
            assert_eq!(d.len(), iq.len());
            let expect_bytes = 6 + ((n as f64 * bits_per_sample(m)) / 8.0).ceil() as usize;
            assert!(
                p.len() <= expect_bytes + 1,
                "m={m}: {} vs {expect_bytes}",
                p.len()
            );
            for i in (0..n).step_by(7) {
                let (a, b) = (
                    (iq[2 * i] as f64, iq[2 * i + 1] as f64),
                    (d[2 * i] as f64, d[2 * i + 1] as f64),
                );
                let mag = (a.0 * a.0 + a.1 * a.1).sqrt();
                if mag < 2000.0 {
                    continue;
                }
                let dphi = (a.1.atan2(a.0) - b.1.atan2(b.0)).sin().abs();
                let tol = 4.0 / (1u32 << (m - 1)) as f64 * 32767.0 / mag;
                assert!(dphi < tol.max(1e-3), "m={m} i={i} dphi={dphi} tol={tol}");
            }
        }
    }

    #[test]
    fn full_scale_does_not_overflow() {
        let iq = [32767i16, -32768, -32767, 32767, 0, 1];
        for m in 2..=16 {
            let d = decode(&encode(&iq, m)).unwrap();
            for (a, b) in iq.iter().zip(&d) {
                let err = (*a as i32 - *b as i32).abs();
                assert!(err <= 1 << (17 - m).max(0), "m={m}: {a} vs {b}");
            }
        }
    }
}
