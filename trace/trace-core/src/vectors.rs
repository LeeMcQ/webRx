//! Cross-language test vectors: the TypeScript decoders in webRx
//! (`src/trace/`) must reproduce these bytes and values exactly.
//!
//! `cargo test -p trace-core -- --ignored write_vectors` rewrites
//! `bench/trace-vectors.json`; `vectors_are_current` fails when the codecs
//! drift from the committed file.

use crate::*;
use serde_json::{json, Value};

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn build() -> Value {
    // headers
    let full = header::FullHeader {
        version: VERSION,
        tier: Tier::Spectrum as u8,
        flags: flags::KEY | flags::UNCALIBRATED,
        epoch: 7,
        sample_index: 123_456_789_012,
        time_ns: 1_476_144_018_000_000_000,
        time_frac: 0x8000_0000,
        clock_class: 2,
        codec: codec::SPECTRUM_RICE,
        context_rev: 513,
    };
    let mut tw = header::TrackWriter::new();
    let f1 = tw.write(true, &full, b"hello");
    let f2 = tw.write(
        false,
        &header::FullHeader {
            sample_index: full.sample_index + 204_800,
            flags: flags::OVERLOAD,
            ..full.clone()
        },
        b"world!",
    );
    // spectrum: key + two deltas
    let mut se = spectrum::SpectrumEncoder::new(0.25);
    let mut sd = spectrum::SpectrumDecoder::new();
    let mut spec = Vec::new();
    for k in 0..3u32 {
        let lv: Vec<f32> = (0..300)
            .map(|i| {
                -100.0 + ((i * 37 + k * 11) % 23) as f32 * 0.3 + if i == 150 { 55.0 } else { 0.0 }
                    - if i == 7 { 300.0 } else { 0.0 }
            })
            .collect();
        let p = se.encode(&lv, k == 0);
        let d = sd.decode(&p).unwrap();
        spec.push(json!({ "payload": hex(&p), "levels": d }));
    }
    // bfp
    let iq: Vec<i16> = (0..70)
        .map(|i: i32| ((i * 977) % 2000 - 1000) as i16 * if i > 40 { 30 } else { 1 })
        .collect();
    let bfp_p = bfp::encode(&iq, 6);
    let bfp_d = bfp::decode(&bfp_p).unwrap();
    // burst
    let b8: Vec<i8> = (0..64).map(|i: i32| (((i * 13) % 31) - 15) as i8).collect();
    let burst_p = burst::encode(&b8);
    // adpcm
    let pcm: Vec<i16> = (0..64)
        .map(|i| (8000.0 * (i as f64 * 0.37).sin()) as i16)
        .collect();
    let mut ae = adpcm::Encoder::new();
    let a1 = ae.encode(&pcm[..32], 12000);
    let a2 = ae.encode(&pcm[32..], 12000);
    let (_, d1) = adpcm::decode(&a1).unwrap();
    let (_, d2) = adpcm::decode(&a2).unwrap();
    // pointing
    let meta = pointing::Meta {
        magnetic: true,
        declination_deg: Some(-25.43),
        source: pointing::Source::ClientPhone,
        element: 0,
    };
    let ps: Vec<pointing::Sample> = (0..4)
        .map(|k| pointing::Sample {
            index: 5000 + k * 70_000,
            heading_deg: 358.5 + k as f64,
            pitch_deg: if k == 1 { None } else { Some(2.5) },
            roll_deg: None,
            accuracy_deg: Some(4.5),
        })
        .collect();
    let pp = pointing::encode(5000, &meta, &ps);
    // cbor
    let msg = context::ServerMsg::Ack {
        op: "tune".into(),
        ok: true,
        message: Some("ok".into()),
    };
    let clk = context::ServerMsg::Clock(context::ClockRecord {
        class: 2,
        err_ns: 10_000_000,
        n0: 0,
        t0_ns: 1_476_144_018_000_000_000,
        t0_frac: 0,
        fs: 2_400_000.0,
        eps_ppb: -1250.5,
        lock: "host".into(),
        holdover_s: 0,
        last_pps_index: None,
        asserted: false,
    });
    let sub = context::ClientMsg::Subscribe {
        spectrum: Some(context::SpectrumSub {
            bins: 512,
            fps: 10.0,
            step_db: 0.5,
            centre_hz: None,
            span_hz: Some(1e6),
        }),
        audio: None,
        iq: None,
        pointing: true,
    };
    json!({
        "crc": { "crc32c_123456789": crc::crc32c(&[b"123456789"]), "crc16_123456789": crc::crc16(&[b"123456789"]) },
        "frames": [
            { "bytes": hex(&f1), "full": true, "tier": 2, "flags": full.flags, "epoch": 7, "sample_index": full.sample_index.to_string(), "time_ns": full.time_ns.to_string(), "time_frac": full.time_frac, "clock_class": 2, "codec": codec::SPECTRUM_RICE, "context_rev": 513, "payload": hex(b"hello") },
            { "bytes": hex(&f2), "full": false, "tier": 2, "flags": flags::OVERLOAD, "sample_index": (full.sample_index + 204_800).to_string(), "seq": 1, "payload": hex(b"world!") }
        ],
        "spectrum": spec,
        "bfp": { "payload": hex(&bfp_p), "decoded": bfp_d },
        "burst": { "payload": hex(&burst_p), "decoded": b8 },
        "adpcm": [ { "payload": hex(&a1), "decoded": d1 }, { "payload": hex(&a2), "decoded": d2 } ],
        "pointing": { "base": 5000, "payload": hex(&pp), "magnetic": true, "declination": -25.43, "source": 5, "samples": ps.iter().map(|s| json!({"index": s.index, "heading": (s.heading_deg * 100.0).round() / 100.0 % 360.0, "pitch": s.pitch_deg, "accuracy": s.accuracy_deg })).collect::<Vec<_>>() },
        "cbor": [
            { "bytes": hex(&context::to_cbor(&msg)), "value": { "type": "ack", "op": "tune", "ok": true, "message": "ok" } },
            { "bytes": hex(&context::to_cbor(&clk)), "value": serde_json::to_value(match &clk { context::ServerMsg::Clock(c) => c, _ => unreachable!() }).unwrap() },
            { "bytes": hex(&context::to_cbor(&sub)), "value": { "op": "subscribe", "spectrum": { "bins": 512, "fps": 10.0, "step_db": 0.5, "span_hz": 1e6 }, "audio": null, "iq": null, "pointing": true } }
        ]
    })
}

const PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../bench/trace-vectors.json"
);

#[test]
#[ignore]
fn write_vectors() {
    std::fs::write(PATH, serde_json::to_string_pretty(&build()).unwrap() + "\n").unwrap();
}

#[test]
fn vectors_are_current() {
    let Ok(text) = std::fs::read_to_string(PATH) else {
        return;
    };
    let committed: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(committed, build(), "codecs changed: rerun `cargo test -p trace-core -- --ignored write_vectors` and update the TypeScript decoders");
}
