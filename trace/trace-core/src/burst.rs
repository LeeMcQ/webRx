//! Lossless 8-bit I/Q for burst captures (spec §6, tier 5).
//!
//! Each frame picks the better of two predictors — none, or the previous
//! sample of the same channel — and Rice-codes the zigzag residuals. Every
//! bit survives, as cross-correlation for TDoA needs.
//!
//! Payload: `u32 complex samples · u8 order (0 or 1) · Rice stream`.

use crate::bits::{BitReader, BitWriter};
use crate::{rice, unzigzag, zigzag, Error, Result};

fn residuals(iq: &[i8], order: u8) -> Vec<u32> {
    let mut out = Vec::with_capacity(iq.len());
    let (mut pi, mut pq) = (0i32, 0i32);
    for c in iq.chunks(2) {
        let (i, q) = (c[0] as i32, c[1] as i32);
        if order == 0 {
            out.push(zigzag(i));
            out.push(zigzag(q));
        } else {
            out.push(zigzag(i - pi));
            out.push(zigzag(q - pq));
            pi = i;
            pq = q;
        }
    }
    out
}

pub fn encode(iq: &[i8]) -> Vec<u8> {
    assert!(iq.len() % 2 == 0);
    let mut best: Option<Vec<u8>> = None;
    for order in [0u8, 1] {
        let mut w = BitWriter::new();
        w.out
            .extend_from_slice(&((iq.len() / 2) as u32).to_le_bytes());
        w.out.push(order);
        rice::encode_into(&mut w, &residuals(iq, order));
        let b = w.finish();
        if best.as_ref().map_or(true, |x| b.len() < x.len()) {
            best = Some(b);
        }
    }
    best.unwrap()
}

pub fn decode(payload: &[u8]) -> Result<Vec<i8>> {
    if payload.len() < 5 {
        return Err(Error::Truncated);
    }
    let n = u32::from_le_bytes(payload[..4].try_into().unwrap()) as usize;
    if n > 1 << 26 {
        return Err(Error::Invalid("burst length"));
    }
    let order = payload[4];
    let mut r = BitReader::new(&payload[5..]);
    let mut res = Vec::new();
    rice::decode_from(&mut r, 2 * n, &mut res)?;
    let mut out = Vec::with_capacity(2 * n);
    let (mut pi, mut pq) = (0i32, 0i32);
    for c in res.chunks(2) {
        let (mut i, mut q) = (unzigzag(c[0]), unzigzag(c[1]));
        match order {
            0 => {}
            1 => {
                i += pi;
                q += pq;
                pi = i;
                pq = q;
            }
            _ => return Err(Error::Invalid("burst order")),
        }
        if !(-128..=127).contains(&i) || !(-128..=127).contains(&q) {
            return Err(Error::Invalid("burst sample range"));
        }
        out.push(i as i8);
        out.push(q as i8);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lossless() {
        let mut s = 1u32;
        let iq: Vec<i8> = (0..20000)
            .map(|i| {
                s = s.wrapping_mul(1_103_515_245).wrapping_add(12345);
                let tone = (40.0 * ((i / 2) as f64 * 0.01).cos()) as i32;
                (tone + ((s >> 16) % 7) as i32 - 3) as i8
            })
            .collect();
        let p = encode(&iq);
        assert_eq!(decode(&p).unwrap(), iq);
        assert!(p.len() < iq.len(), "{} vs {}", p.len(), iq.len());
    }
}
