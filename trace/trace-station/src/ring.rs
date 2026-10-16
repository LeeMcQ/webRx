//! Ring buffer of raw device samples for burst fetches (TDoA).

pub struct Ring {
    buf: Vec<i8>,
    cap: usize,
    /// Index of the sample after the newest stored one.
    pub end: u64,
    filled: usize,
    write: usize,
}

impl Ring {
    /// `cap` complex samples.
    pub fn new(cap: usize) -> Self {
        Self {
            buf: vec![0; 2 * cap.max(1)],
            cap: cap.max(1),
            end: 0,
            filled: 0,
            write: 0,
        }
    }

    pub fn clear(&mut self, at: u64) {
        self.end = at;
        self.filled = 0;
        self.write = 0;
    }

    /// Stores interleaved I/Q starting at device index `start`. A gap clears the history.
    pub fn push(&mut self, iq: &[i8], start: u64) {
        if start != self.end {
            self.clear(start);
        }
        let n = iq.len() / 2;
        let src = if n > self.cap {
            &iq[2 * (n - self.cap)..]
        } else {
            iq
        };
        let mut pos = 0;
        while pos < src.len() {
            let k = (src.len() - pos).min(self.buf.len() - 2 * self.write);
            self.buf[2 * self.write..2 * self.write + k].copy_from_slice(&src[pos..pos + k]);
            self.write = (self.write + k / 2) % self.cap;
            pos += k;
        }
        self.filled = (self.filled + n).min(self.cap);
        self.end = start + n as u64;
    }

    pub fn oldest(&self) -> u64 {
        self.end - self.filled as u64
    }

    /// Copies `count` samples from index `from`, if they are all still held.
    pub fn read(&self, from: u64, count: usize) -> Option<Vec<i8>> {
        if from < self.oldest() || from + count as u64 > self.end {
            return None;
        }
        let back = (self.end - from) as usize; // samples from `from` to the end
        let start = (self.write + self.cap - back) % self.cap;
        let mut out = Vec::with_capacity(2 * count);
        for k in 0..count {
            let p = (start + k) % self.cap;
            out.push(self.buf[2 * p]);
            out.push(self.buf[2 * p + 1]);
        }
        Some(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn wraps_and_reads_back() {
        let mut r = Ring::new(100);
        let mut idx = 1000u64;
        for k in 0..7 {
            let blk: Vec<i8> = (0..60).map(|i| ((k * 30 + i / 2) % 120) as i8).collect();
            r.push(&blk, idx);
            idx += 30;
        }
        assert_eq!(r.end, 1210);
        assert_eq!(r.oldest(), 1110);
        assert!(r.read(1100, 10).is_none());
        let v = r.read(1150, 20).unwrap();
        // sample at index 1150 was written by block k=5 (start 1150), i = 0 → value (150 % 120)
        assert_eq!(v[0], 30);
        assert_eq!(v[38], ((150 + 19) % 120) as i8);
        // a gap clears the history
        r.push(&[1, 2], 5000);
        assert_eq!(r.oldest(), 5000);
    }
}
