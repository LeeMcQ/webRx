//! Frame headers (spec §5).
//!
//! A frame is one MOQT object or one WebSocket binary message: a header, then
//! the codec payload. The first object of every group carries the 40-byte full
//! header (bit 7 of byte 0 clear: it is the version, 1). Every other object
//! carries a compact header (bit 7 set):
//!
//! ```text
//! byte 0      1 ttt ffff   compact marker · tier (3 bits) · flags: phase break, dropped, overload, uncalibrated
//! byte 1      seq          object number within the group (full header = 0)
//! varint      delta_index  device samples since the previous object's first sample
//! u8          context_rev  low byte of the context revision
//! u16 LE      crc16        CRC-16/CCITT-FALSE over the header bytes before it and the payload
//! ```
//!
//! A client rebuilds each compact frame's sample index and time from its
//! group's full header; a gap in `seq` tells it an object was lost.

use crate::{crc, flags, varint, Error, Result, Tier, VERSION};

pub const FULL_LEN: usize = 40;

#[derive(Clone, Debug, PartialEq, Eq, Default)]
pub struct FullHeader {
    pub version: u8,
    pub tier: u8,
    pub flags: u16,
    pub epoch: u32,
    pub sample_index: u64,
    /// GPS time of `sample_index`, ns since 1980-01-06T00:00:00 (GPS epoch).
    pub time_ns: u64,
    /// Fraction of a nanosecond, units of 2^-32 ns.
    pub time_frac: u32,
    /// 0 = A, 1 = B, 2 = C, 3 = D.
    pub clock_class: u8,
    pub codec: u8,
    pub context_rev: u16,
}

#[derive(Clone, Debug, PartialEq, Eq, Default)]
pub struct CompactHeader {
    pub tier: u8,
    /// Low 4 flag bits: phase break, dropped, overload, uncalibrated.
    pub flags: u8,
    pub seq: u8,
    pub delta_index: u64,
    pub context_rev_lo: u8,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Header {
    Full(FullHeader),
    Compact(CompactHeader),
}

impl Header {
    pub fn tier(&self) -> u8 {
        match self {
            Header::Full(h) => h.tier,
            Header::Compact(h) => h.tier,
        }
    }
}

/// Maps full-header flags to the 4 compact flag bits.
pub fn compact_flags(f: u16) -> u8 {
    ((f & flags::PHASE_BREAK != 0) as u8)
        | (((f & flags::DROPPED != 0) as u8) << 1)
        | (((f & flags::OVERLOAD != 0) as u8) << 2)
        | (((f & flags::UNCALIBRATED != 0) as u8) << 3)
}

/// Maps the 4 compact flag bits back to full-header flags.
pub fn expand_flags(c: u8) -> u16 {
    let mut f = 0;
    if c & 1 != 0 {
        f |= flags::PHASE_BREAK;
    }
    if c & 2 != 0 {
        f |= flags::DROPPED;
    }
    if c & 4 != 0 {
        f |= flags::OVERLOAD;
    }
    if c & 8 != 0 {
        f |= flags::UNCALIBRATED;
    }
    f
}

pub fn write_full(h: &FullHeader, payload: &[u8]) -> Vec<u8> {
    let mut o = Vec::with_capacity(FULL_LEN + payload.len());
    o.push(h.version);
    o.push(h.tier);
    o.extend_from_slice(&h.flags.to_le_bytes());
    o.extend_from_slice(&h.epoch.to_le_bytes());
    o.extend_from_slice(&h.sample_index.to_le_bytes());
    o.extend_from_slice(&h.time_ns.to_le_bytes());
    o.extend_from_slice(&h.time_frac.to_le_bytes());
    o.push(h.clock_class);
    o.push(h.codec);
    o.extend_from_slice(&h.context_rev.to_le_bytes());
    o.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    let c = crc::crc32c(&[&o, payload]);
    o.extend_from_slice(&c.to_le_bytes());
    o.extend_from_slice(payload);
    o
}

pub fn write_compact(h: &CompactHeader, payload: &[u8]) -> Vec<u8> {
    let mut o = Vec::with_capacity(8 + payload.len());
    o.push(0x80 | ((h.tier & 7) << 4) | (h.flags & 0x0f));
    o.push(h.seq);
    varint::write(&mut o, h.delta_index);
    o.push(h.context_rev_lo);
    let c = crc::crc16(&[&o, payload]);
    o.extend_from_slice(&c.to_le_bytes());
    o.extend_from_slice(payload);
    o
}

/// Parses and checks one frame; returns the header and its payload.
pub fn parse(b: &[u8]) -> Result<(Header, &[u8])> {
    let first = *b.first().ok_or(Error::Truncated)?;
    if first & 0x80 == 0 {
        if b.len() < FULL_LEN {
            return Err(Error::Truncated);
        }
        if first != VERSION {
            return Err(Error::BadVersion(first));
        }
        let u16_at = |i: usize| u16::from_le_bytes([b[i], b[i + 1]]);
        let u32_at = |i: usize| u32::from_le_bytes(b[i..i + 4].try_into().unwrap());
        let u64_at = |i: usize| u64::from_le_bytes(b[i..i + 8].try_into().unwrap());
        let len = u32_at(32) as usize;
        if b.len() < FULL_LEN + len {
            return Err(Error::Truncated);
        }
        let payload = &b[FULL_LEN..FULL_LEN + len];
        if crc::crc32c(&[&b[..36], payload]) != u32_at(36) {
            return Err(Error::Crc);
        }
        let tier = b[1];
        Tier::from_u8(tier).ok_or(Error::BadTier(tier))?;
        Ok((
            Header::Full(FullHeader {
                version: first,
                tier,
                flags: u16_at(2),
                epoch: u32_at(4),
                sample_index: u64_at(8),
                time_ns: u64_at(16),
                time_frac: u32_at(24),
                clock_class: b[28],
                codec: b[29],
                context_rev: u16_at(30),
            }),
            payload,
        ))
    } else {
        let (delta, n) = varint::read(b, 2)?;
        let rev_at = 2 + n;
        let crc_at = rev_at + 1;
        if b.len() < crc_at + 2 {
            return Err(Error::Truncated);
        }
        let payload = &b[crc_at + 2..];
        if crc::crc16(&[&b[..crc_at], payload]) != u16::from_le_bytes([b[crc_at], b[crc_at + 1]]) {
            return Err(Error::Crc);
        }
        Ok((
            Header::Compact(CompactHeader {
                tier: (first >> 4) & 7,
                flags: first & 0x0f,
                seq: b[1],
                delta_index: delta,
                context_rev_lo: b[rev_at],
            }),
            payload,
        ))
    }
}

/// Per-track writer: a full header to open each group, compact headers after.
#[derive(Default)]
pub struct TrackWriter {
    last_index: Option<u64>,
    seq: u8,
}

impl TrackWriter {
    pub fn new() -> Self {
        Self::default()
    }

    /// Writes one frame. `key` (or the first frame, or a sequence wrap) opens a group with a full header.
    pub fn write(&mut self, key: bool, full: &FullHeader, payload: &[u8]) -> Vec<u8> {
        let need_full = key
            || self.last_index.is_none()
            || self.seq == u8::MAX
            || Some(full.sample_index) < self.last_index;
        let out = if need_full {
            self.seq = 0;
            write_full(full, payload)
        } else {
            self.seq += 1;
            write_compact(
                &CompactHeader {
                    tier: full.tier,
                    flags: compact_flags(full.flags),
                    seq: self.seq,
                    delta_index: full.sample_index - self.last_index.unwrap(),
                    context_rev_lo: full.context_rev as u8,
                },
                payload,
            )
        };
        self.last_index = Some(full.sample_index);
        out
    }

    /// Forces the next frame to open a new group.
    pub fn reset(&mut self) {
        self.last_index = None;
    }
}

/// Per-track reader: rebuilds every frame's sample index and detects losses.
#[derive(Default)]
pub struct TrackReader {
    group: Option<FullHeader>,
    index: u64,
    seq: u8,
}

/// What a client knows about one received frame.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FrameInfo {
    pub tier: u8,
    pub flags: u16,
    pub sample_index: u64,
    pub codec: u8,
    pub key: bool,
    /// An earlier object of this group was lost.
    pub gap: bool,
}

impl TrackReader {
    pub fn new() -> Self {
        Self::default()
    }

    /// The group's full header (time anchor, clock class, codec).
    pub fn group(&self) -> Option<&FullHeader> {
        self.group.as_ref()
    }

    pub fn accept(&mut self, h: &Header) -> Option<FrameInfo> {
        match h {
            Header::Full(f) => {
                self.group = Some(f.clone());
                self.index = f.sample_index;
                self.seq = 0;
                Some(FrameInfo {
                    tier: f.tier,
                    flags: f.flags,
                    sample_index: f.sample_index,
                    codec: f.codec,
                    key: true,
                    gap: false,
                })
            }
            Header::Compact(c) => {
                let g = self.group.as_ref()?;
                let gap = c.seq != self.seq.wrapping_add(1);
                self.seq = c.seq;
                self.index += c.delta_index;
                Some(FrameInfo {
                    tier: c.tier,
                    flags: expand_flags(c.flags),
                    sample_index: self.index,
                    codec: g.codec,
                    key: false,
                    gap,
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn h(idx: u64) -> FullHeader {
        FullHeader {
            version: VERSION,
            tier: Tier::Spectrum as u8,
            flags: flags::KEY,
            epoch: 3,
            sample_index: idx,
            time_ns: 1_400_000_000_000_000_000,
            time_frac: 7,
            clock_class: 2,
            codec: crate::codec::SPECTRUM_RICE,
            context_rev: 0x1234,
        }
    }

    #[test]
    fn full_and_compact_round_trip() {
        let mut w = TrackWriter::new();
        let mut r = TrackReader::new();
        let a = w.write(true, &h(1000), b"abc");
        assert_eq!(a.len(), FULL_LEN + 3);
        let b = w.write(false, &h(1000 + 81920), b"defg");
        assert!(b.len() <= 6 + 4 + 4, "compact header is small: {}", b.len());
        let (ha, pa) = parse(&a).unwrap();
        assert_eq!(pa, b"abc");
        assert!(matches!(ha, Header::Full(ref f) if *f == h(1000)));
        let fa = r.accept(&ha).unwrap();
        assert!(fa.key && fa.sample_index == 1000);
        let (hb, pb) = parse(&b).unwrap();
        assert_eq!(pb, b"defg");
        let fb = r.accept(&hb).unwrap();
        assert_eq!(fb.sample_index, 1000 + 81920);
        assert!(!fb.gap && !fb.key && fb.codec == crate::codec::SPECTRUM_RICE);
        // a lost object shows as a gap
        let _lost = w.write(false, &h(200_000), b"x");
        let c = w.write(false, &h(300_000), b"y");
        let fc = r.accept(&parse(&c).unwrap().0).unwrap();
        assert!(fc.gap);
    }

    #[test]
    fn corruption_is_detected() {
        let mut w = TrackWriter::new();
        let mut a = w.write(true, &h(5), b"payload");
        a[45] ^= 1;
        assert_eq!(parse(&a).unwrap_err(), Error::Crc);
        let mut b = w.write(false, &h(9), b"payload");
        let n = b.len();
        b[n - 1] ^= 0x40;
        assert_eq!(parse(&b).unwrap_err(), Error::Crc);
    }
}
