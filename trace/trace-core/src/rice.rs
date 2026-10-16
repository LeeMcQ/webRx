//! Adaptive Golomb–Rice coding in blocks of 32 values (CCSDS 121 style).
//!
//! Each block starts with a 5-bit parameter k (0–24), chosen to minimise the
//! block's size. A value v is coded as q = v >> k in unary (ones, then a
//! zero) followed by the k low bits. Quotients ≥ 24 escape: 24 ones, then
//! the value in 32 bits — so one outlier never costs more than 56 bits.

use crate::bits::{BitReader, BitWriter};
use crate::Result;

pub const BLOCK: usize = 32;
pub const ESCAPE: u32 = 24;
const K_BITS: u32 = 5;
const K_MAX: u32 = 24;

#[inline]
fn cost(v: u32, k: u32) -> u32 {
    let q = v >> k;
    if q < ESCAPE {
        q + 1 + k
    } else {
        ESCAPE + 32
    }
}

pub fn encode_into(w: &mut BitWriter, vals: &[u32]) {
    for block in vals.chunks(BLOCK) {
        let mut best_k = 0;
        let mut best = u32::MAX;
        for k in 0..=K_MAX {
            let c: u32 = block.iter().map(|&v| cost(v, k)).sum();
            if c < best {
                best = c;
                best_k = k;
            }
        }
        w.put(best_k, K_BITS);
        for &v in block {
            let q = v >> best_k;
            if q < ESCAPE {
                w.unary(q);
                w.put(v, best_k);
            } else {
                w.put((1u32 << ESCAPE) - 1, ESCAPE);
                w.put(v, 32);
            }
        }
    }
}

pub fn decode_from(r: &mut BitReader, n: usize, out: &mut Vec<u32>) -> Result<()> {
    out.reserve(n);
    let mut left = n;
    while left > 0 {
        let len = left.min(BLOCK);
        let k = r.get(K_BITS)?;
        if k > K_MAX {
            return Err(crate::Error::Invalid("rice parameter"));
        }
        for _ in 0..len {
            let q = r.unary(ESCAPE)?;
            let v = if q < ESCAPE {
                (q << k) | r.get(k)?
            } else {
                r.get(32)?
            };
            out.push(v);
        }
        left -= len;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn round_trip_with_escapes() {
        let vals: Vec<u32> = (0..1000u32)
            .map(|i| {
                if i % 97 == 0 {
                    0xffff_fff0
                } else {
                    (i * 7919) % 40
                }
            })
            .collect();
        let mut w = BitWriter::new();
        encode_into(&mut w, &vals);
        let b = w.finish();
        let mut r = BitReader::new(&b);
        let mut out = Vec::new();
        decode_from(&mut r, vals.len(), &mut out).unwrap();
        assert_eq!(out, vals);
        // small values compress: < 8 bits each on average
        assert!(b.len() * 8 < vals.len() * 8, "{} bytes", b.len());
    }
}
