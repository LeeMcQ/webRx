//! TRACE — Timestamped RF Adaptive Calibrated Encoding (draft v0.1).
//!
//! The wire format and codecs shared by stations, relays and clients:
//!
//! * [`header`] — full (40-byte) and compact frame headers, CRC-checked.
//! * [`clock`] — sample index ↔ GPS time anchors and accuracy classes.
//! * [`spectrum`] — calibrated spectrum frames: 0.25 dB-step integers,
//!   temporal/neighbour prediction, adaptive Rice coding.
//! * [`bfp`] — narrowband I/Q in block floating point (O-RAN style).
//! * [`burst`] — lossless 8-bit I/Q for TDoA bursts.
//! * [`adpcm`] — IMA ADPCM audio for clients without Opus.
//! * [`pointing`] — antenna heading samples on the receiver's sample clock.
//! * [`context`] — CBOR context, clock and control records.
//!
//! Every codec has a TypeScript twin in webRx (`src/trace/`); the test
//! vectors written by `cargo test -p trace-core -- --ignored vectors` keep the
//! two byte-for-byte compatible.

pub mod adpcm;
pub mod bfp;
pub mod bits;
pub mod burst;
pub mod clock;
pub mod context;
pub mod crc;
pub mod header;
pub mod pointing;
pub mod rice;
pub mod spectrum;
pub mod varint;

/// Draft version carried in every full header.
pub const VERSION: u8 = 1;

/// Track types (the `tier` field).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Tier {
    Control = 0,
    Context = 1,
    Spectrum = 2,
    Audio = 3,
    Iq = 4,
    Burst = 5,
    Decoded = 6,
    Repair = 7,
}

impl Tier {
    pub fn from_u8(v: u8) -> Option<Tier> {
        Some(match v {
            0 => Tier::Control,
            1 => Tier::Context,
            2 => Tier::Spectrum,
            3 => Tier::Audio,
            4 => Tier::Iq,
            5 => Tier::Burst,
            6 => Tier::Decoded,
            7 => Tier::Repair,
            _ => return None,
        })
    }
}

/// Payload codecs (the `codec` field).
pub mod codec {
    pub const NONE: u8 = 0;
    pub const CBOR: u8 = 1;
    pub const SPECTRUM_RICE: u8 = 2;
    pub const OPUS: u8 = 3;
    pub const IMA_ADPCM: u8 = 4;
    pub const BFP: u8 = 5;
    pub const LOSSLESS_I8: u8 = 6;
    /// Antenna heading samples on the context track (see [`crate::pointing`]).
    pub const POINTING: u8 = 7;
}

/// Full-header flag bits.
pub mod flags {
    pub const PHASE_BREAK: u16 = 1 << 0;
    pub const DROPPED: u16 = 1 << 1;
    pub const OVERLOAD: u16 = 1 << 2;
    pub const CAL_CHANGED: u16 = 1 << 3;
    pub const CLOCK_DEGRADED: u16 = 1 << 4;
    pub const KEY: u16 = 1 << 5;
    pub const UNCALIBRATED: u16 = 1 << 6;
}

/// Errors from parsing or decoding.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    Truncated,
    BadVersion(u8),
    BadTier(u8),
    Crc,
    /// A delta frame arrived without the frame it predicts from.
    NeedKey,
    Invalid(&'static str),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Truncated => write!(f, "truncated frame"),
            Error::BadVersion(v) => write!(f, "unsupported TRACE version {v}"),
            Error::BadTier(t) => write!(f, "unknown tier {t}"),
            Error::Crc => write!(f, "checksum mismatch"),
            Error::NeedKey => write!(f, "delta frame without its key frame"),
            Error::Invalid(s) => write!(f, "invalid payload: {s}"),
        }
    }
}

impl std::error::Error for Error {}

pub type Result<T> = std::result::Result<T, Error>;

/// ZigZag-maps a signed integer to unsigned (0, −1, 1, −2 … → 0, 1, 2, 3 …).
#[inline]
pub fn zigzag(v: i32) -> u32 {
    ((v << 1) ^ (v >> 31)) as u32
}

#[inline]
pub fn unzigzag(u: u32) -> i32 {
    ((u >> 1) as i32) ^ -((u & 1) as i32)
}

#[cfg(test)]
mod vectors;
