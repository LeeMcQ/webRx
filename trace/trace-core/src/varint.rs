//! QUIC variable-length integers (RFC 9000 §16): 1, 2, 4 or 8 bytes,
//! the two top bits of the first byte give the length.

use crate::{Error, Result};

pub const MAX: u64 = (1 << 62) - 1;

pub fn write(out: &mut Vec<u8>, v: u64) {
    assert!(v <= MAX, "varint out of range");
    if v < 1 << 6 {
        out.push(v as u8);
    } else if v < 1 << 14 {
        out.extend_from_slice(&((v as u16) | 0x4000).to_be_bytes());
    } else if v < 1 << 30 {
        out.extend_from_slice(&((v as u32) | 0x8000_0000).to_be_bytes());
    } else {
        out.extend_from_slice(&(v | 0xc000_0000_0000_0000).to_be_bytes());
    }
}

/// Reads a varint at `pos`; returns the value and the bytes consumed.
pub fn read(b: &[u8], pos: usize) -> Result<(u64, usize)> {
    let first = *b.get(pos).ok_or(Error::Truncated)?;
    let len = 1usize << (first >> 6);
    if b.len() < pos + len {
        return Err(Error::Truncated);
    }
    let mut v = (first & 0x3f) as u64;
    for i in 1..len {
        v = (v << 8) | b[pos + i] as u64;
    }
    Ok((v, len))
}

#[cfg(test)]
mod tests {
    #[test]
    fn round_trip() {
        for v in [
            0u64,
            1,
            63,
            64,
            16383,
            16384,
            (1 << 30) - 1,
            1 << 30,
            super::MAX,
        ] {
            let mut o = Vec::new();
            super::write(&mut o, v);
            let (r, n) = super::read(&o, 0).unwrap();
            assert_eq!((r, n), (v, o.len()));
        }
        // RFC 9000 example: 0x7bbd = 15293
        assert_eq!(super::read(&[0x7b, 0xbd], 0).unwrap(), (15293, 2));
    }
}
