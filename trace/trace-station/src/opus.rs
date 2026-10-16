//! Opus encoder through libopus (loaded at run time). Without libopus the
//! station falls back to IMA ADPCM, which every client can decode.

use crate::source::load_lib;
use libloading::Library;
use std::ffi::{c_int, c_void};

const APPLICATION_AUDIO: c_int = 2049;
const SET_BITRATE: c_int = 4002;

type Create = unsafe extern "C" fn(i32, c_int, c_int, *mut c_int) -> *mut c_void;
type EncodeFloat = unsafe extern "C" fn(*mut c_void, *const f32, c_int, *mut u8, i32) -> i32;
type Ctl = unsafe extern "C" fn(*mut c_void, c_int, ...) -> c_int;
type Destroy = unsafe extern "C" fn(*mut c_void);

pub struct OpusEnc {
    lib: Library,
    enc: *mut c_void,
    out: Vec<u8>,
}

unsafe impl Send for OpusEnc {}

impl OpusEnc {
    pub const RATE: u32 = 48_000;
    /// 20 ms frames.
    pub const FRAME: usize = 960;

    pub fn available() -> bool {
        load_lib(&[
            "libopus.so.0",
            "libopus.so",
            "libopus.0.dylib",
            "libopus.dylib",
            "opus.dll",
        ])
        .is_ok()
    }

    pub fn new(kbps: u32) -> Result<Self, String> {
        let lib = load_lib(&[
            "libopus.so.0",
            "libopus.so",
            "libopus.0.dylib",
            "libopus.dylib",
            "opus.dll",
        ])?;
        let enc = unsafe {
            let create: libloading::Symbol<Create> = lib
                .get(b"opus_encoder_create\0")
                .map_err(|e| e.to_string())?;
            let mut err: c_int = 0;
            let e = create(Self::RATE as i32, 1, APPLICATION_AUDIO, &mut err);
            if e.is_null() || err != 0 {
                return Err(format!("opus_encoder_create failed ({err})"));
            }
            let ctl: libloading::Symbol<Ctl> =
                lib.get(b"opus_encoder_ctl\0").map_err(|e| e.to_string())?;
            ctl(e, SET_BITRATE, (kbps.clamp(8, 256) * 1000) as c_int);
            e
        };
        Ok(Self {
            lib,
            enc,
            out: vec![0; 4000],
        })
    }

    /// Encodes one 20 ms frame (960 samples at 48 kHz).
    pub fn encode(&mut self, pcm: &[f32]) -> Result<Vec<u8>, String> {
        let n = unsafe {
            let f: libloading::Symbol<EncodeFloat> = self
                .lib
                .get(b"opus_encode_float\0")
                .map_err(|e| e.to_string())?;
            f(
                self.enc,
                pcm.as_ptr(),
                pcm.len() as c_int,
                self.out.as_mut_ptr(),
                self.out.len() as i32,
            )
        };
        if n < 0 {
            return Err(format!("opus_encode_float failed ({n})"));
        }
        Ok(self.out[..n as usize].to_vec())
    }
}

impl Drop for OpusEnc {
    fn drop(&mut self) {
        unsafe {
            if let Ok(d) = self.lib.get::<Destroy>(b"opus_encoder_destroy\0") {
                d(self.enc);
            }
        }
    }
}
