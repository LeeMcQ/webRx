//! CBOR records on the control (tier 0) and context (tier 1) tracks.
//!
//! Client → station: [`ClientMsg`]. Station → client: [`ServerMsg`] (hello,
//! context, clock, acknowledgements, errors). Context mirrors the VITA-49
//! context fields (spec §5); clock records carry the anchor of §4.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub fn to_cbor<T: Serialize>(v: &T) -> Vec<u8> {
    let mut o = Vec::new();
    ciborium::into_writer(v, &mut o).expect("CBOR encode");
    o
}

pub fn from_cbor<T: for<'de> Deserialize<'de>>(b: &[u8]) -> Result<T, String> {
    ciborium::from_reader(b).map_err(|e| e.to_string())
}

// ── client → station ──

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct SpectrumSub {
    /// Bins to deliver across the view (the station reduces by linear-power mean).
    pub bins: u32,
    pub fps: f32,
    /// Quantisation step in dB (0.25, 0.5, 1, 2 …).
    pub step_db: f32,
    /// View centre and span; defaults to the whole captured band.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub centre_hz: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub span_hz: Option<f64>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct AudioSub {
    pub freq_hz: f64,
    /// am, nfm, wfm, usb, lsb, cw
    pub mode: String,
    /// Passband edges relative to `freq_hz`, Hz.
    pub lo: f64,
    pub hi: f64,
    /// "opus" or "adpcm"
    pub codec: String,
    #[serde(default)]
    pub kbps: u32,
    #[serde(default)]
    pub squelch_db: Option<f64>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct IqSub {
    pub freq_hz: f64,
    /// Wanted complex sample rate; the station picks the nearest integer decimation.
    pub rate: f64,
    /// Mantissa bits, 2–16.
    pub bits: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum ClientMsg {
    Hello {
        client: String,
        /// Audio codecs the client can decode, best first.
        codecs: Vec<String>,
        #[serde(default)]
        token: Option<String>,
    },
    Subscribe {
        #[serde(default)]
        spectrum: Option<SpectrumSub>,
        #[serde(default)]
        audio: Option<AudioSub>,
        #[serde(default)]
        iq: Option<IqSub>,
        #[serde(default)]
        pointing: bool,
    },
    /// Retune the receiver (needs control).
    Tune {
        centre_hz: f64,
    },
    SampleRate {
        hz: f64,
    },
    /// Named gain stages (lna, vga, amp, tuner, …); `auto` turns automatic gain on.
    Gain {
        #[serde(default)]
        stages: BTreeMap<String, f64>,
        #[serde(default)]
        auto: Option<bool>,
    },
    BiasTee {
        on: bool,
    },
    TakeControl,
    ReleaseControl,
    /// Raw full-rate I/Q around a GPS time window, for TDoA (tier 5).
    Fetch {
        from_ns: u64,
        duration_ns: u64,
    },
    /// A heading measured at the client (e.g. the phone's compass on the antenna boom).
    Pointing {
        heading_deg: f64,
        #[serde(default)]
        accuracy_deg: Option<f64>,
        #[serde(default)]
        magnetic: bool,
        #[serde(default)]
        declination_deg: Option<f64>,
        #[serde(default)]
        pitch_deg: Option<f64>,
        #[serde(default)]
        roll_deg: Option<f64>,
        /// When the client read it (Unix ms); the station maps it to its sample index.
        t_unix_ms: f64,
    },
    Ping {
        t: f64,
    },
}

// ── station → client ──

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct Station {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lat: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lon: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height_m: Option<f64>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct Device {
    pub kind: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub serial: Option<String>,
    pub min_hz: f64,
    pub max_hz: f64,
    /// Sample rates the device supports well.
    pub rates: Vec<f64>,
    /// Gain stages: name → [min, max, step].
    pub gain_stages: BTreeMap<String, [f64; 3]>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct Cal {
    pub id: String,
    pub version: u32,
    /// dBFS → dBm at the antenna terminals (antenna gain and feed loss included).
    pub offset_db: f64,
    pub uncertainty_db: f64,
    #[serde(default)]
    pub antenna_gain_dbi: f64,
    #[serde(default)]
    pub feed_loss_db: f64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct SpectrumCtx {
    pub fft_size: u32,
    pub rbw_hz: f64,
    pub detector: String,
    pub window: String,
    pub bins: u32,
    pub start_hz: f64,
    pub span_hz: f64,
    pub fps: f32,
    pub step_db: f32,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct AudioCtx {
    pub codec: String,
    pub rate: u32,
    pub channels: u32,
    pub mode: String,
    pub freq_hz: f64,
    pub lo: f64,
    pub hi: f64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct IqCtx {
    pub freq_hz: f64,
    pub rate: f64,
    pub decimation: u32,
    pub bits: u32,
    /// Level of a full-scale sine in dBm (None when uncalibrated).
    #[serde(default)]
    pub fs_dbm: Option<f64>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct PointingCtx {
    /// compass, rotator, gps_course, manual, array, client
    pub source: String,
    pub magnetic: bool,
    #[serde(default)]
    pub declination_deg: Option<f64>,
    pub element: u8,
    pub rate_hz: f64,
    /// Fixed bearing of the boom relative to the sensor's zero, degrees.
    #[serde(default)]
    pub mount_offset_deg: f64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct ContextRecord {
    pub rev: u16,
    pub epoch: u32,
    pub station: Station,
    pub device: Device,
    pub centre_hz: f64,
    pub sample_rate: f64,
    pub bandwidth_hz: f64,
    pub gains: BTreeMap<String, f64>,
    pub gain_auto: bool,
    pub bias_tee: bool,
    pub ppm: f64,
    /// "dBm" when a calibration covers the current settings, else "dBFS".
    pub units: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cal: Option<Cal>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spectrum: Option<SpectrumCtx>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio: Option<AudioCtx>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iq: Option<IqCtx>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pointing: Option<PointingCtx>,
    /// Who holds receiver control (None = free) and whether it is this client.
    #[serde(default)]
    pub control_holder: Option<String>,
    #[serde(default)]
    pub you_control: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct ClockRecord {
    /// 0 = A, 1 = B, 2 = C, 3 = D.
    pub class: u8,
    pub err_ns: u64,
    pub n0: u64,
    pub t0_ns: u64,
    pub t0_frac: u32,
    pub fs: f64,
    pub eps_ppb: f64,
    /// gpsdo, pps, host, none
    pub lock: String,
    pub holdover_s: u32,
    #[serde(default)]
    pub last_pps_index: Option<u64>,
    /// The class rests on the operator's configuration, not on a measurement.
    pub asserted: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMsg {
    Hello {
        station: Station,
        device: Device,
        version: u8,
        software: String,
        tracks: Vec<String>,
        codecs: Vec<String>,
        burst_seconds: f64,
    },
    Context(ContextRecord),
    Clock(ClockRecord),
    Ack {
        op: String,
        ok: bool,
        #[serde(default)]
        message: Option<String>,
    },
    Error {
        message: String,
    },
    Pong {
        t: f64,
        server_unix_ms: f64,
    },
    /// End of a burst fetch: how many samples were sent and from which index.
    BurstDone {
        from_index: u64,
        samples: u64,
        frames: u32,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn round_trip() {
        let m = ClientMsg::Subscribe {
            spectrum: Some(SpectrumSub {
                bins: 1024,
                fps: 10.0,
                step_db: 0.5,
                centre_hz: None,
                span_hz: Some(2e6),
            }),
            audio: None,
            iq: None,
            pointing: true,
        };
        let b = to_cbor(&m);
        assert_eq!(from_cbor::<ClientMsg>(&b).unwrap(), m);
        let s = ServerMsg::Ack {
            op: "tune".into(),
            ok: true,
            message: None,
        };
        assert_eq!(from_cbor::<ServerMsg>(&to_cbor(&s)).unwrap(), s);
    }
}
