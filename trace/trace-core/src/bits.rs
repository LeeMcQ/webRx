//! MSB-first bit writer and reader.

use crate::{Error, Result};

#[derive(Default)]
pub struct BitWriter {
    pub out: Vec<u8>,
    acc: u64,
    n: u32,
}

impl BitWriter {
    pub fn new() -> Self {
        Self::default()
    }

    /// Appends the low `bits` bits of `v` (bits ≤ 32).
    #[inline]
    pub fn put(&mut self, v: u32, bits: u32) {
        debug_assert!(bits <= 32);
        if bits == 0 {
            return;
        }
        let v = (v as u64) & ((1u64 << bits) - 1);
        self.acc = (self.acc << bits) | v;
        self.n += bits;
        while self.n >= 8 {
            self.n -= 8;
            self.out.push((self.acc >> self.n) as u8);
        }
        self.acc &= (1u64 << self.n) - 1;
    }

    /// `count` one-bits followed by a zero.
    #[inline]
    pub fn unary(&mut self, mut count: u32) {
        while count >= 32 {
            self.put(u32::MAX, 32);
            count -= 32;
        }
        // count ones then one zero: (2^count − 1) << 1
        self.put(((1u64 << count) - 1) as u32 * 2, count + 1);
    }

    /// Pads the last byte with zeros and returns the bytes.
    pub fn finish(mut self) -> Vec<u8> {
        if self.n > 0 {
            self.out.push((self.acc << (8 - self.n)) as u8);
        }
        self.out
    }
}

pub struct BitReader<'a> {
    b: &'a [u8],
    pos: usize,
    acc: u64,
    n: u32,
}

impl<'a> BitReader<'a> {
    pub fn new(b: &'a [u8]) -> Self {
        Self {
            b,
            pos: 0,
            acc: 0,
            n: 0,
        }
    }

    #[inline]
    fn fill(&mut self, need: u32) -> Result<()> {
        while self.n < need {
            let byte = *self.b.get(self.pos).ok_or(Error::Truncated)?;
            self.pos += 1;
            self.acc = (self.acc << 8) | byte as u64;
            self.n += 8;
        }
        Ok(())
    }

    #[inline]
    pub fn get(&mut self, bits: u32) -> Result<u32> {
        if bits == 0 {
            return Ok(0);
        }
        self.fill(bits)?;
        self.n -= bits;
        let v = (self.acc >> self.n) & ((1u64 << bits) - 1);
        self.acc &= (1u64 << self.n) - 1;
        Ok(v as u32)
    }

    /// Counts one-bits up to the terminating zero (at most `cap` ones; then returns `cap` without consuming a zero).
    #[inline]
    pub fn unary(&mut self, cap: u32) -> Result<u32> {
        let mut c = 0;
        while c < cap {
            if self.get(1)? == 0 {
                return Ok(c);
            }
            c += 1;
        }
        Ok(cap)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn round_trip() {
        let mut w = BitWriter::new();
        w.put(5, 3);
        w.unary(0);
        w.unary(40);
        w.put(0xdead_beef, 32);
        w.put(1, 1);
        let b = w.finish();
        let mut r = BitReader::new(&b);
        assert_eq!(r.get(3).unwrap(), 5);
        assert_eq!(r.unary(64).unwrap(), 0);
        assert_eq!(r.unary(64).unwrap(), 40);
        assert_eq!(r.get(32).unwrap(), 0xdead_beef);
        assert_eq!(r.get(1).unwrap(), 1);
    }
}
