//! webRx DSP core.
//!
//! A small, dependency-light DSP kernel compiled to WebAssembly (with SIMD) that
//! replaces the hottest parts of the `@jtarrio/signals` JavaScript pipeline:
//!
//! * FIR filtering and FIR decimation (the library notes ~85% of runtime is here)
//! * Forward / inverse FFT (rustfft, WASM SIMD planner)
//! * Unsigned 8-bit IQ (RTL-SDR) to float conversion
//! * One-call averaged power spectral density from raw 8-bit IQ (RTL-SDR or HackRF)
//!
//! The ABI is plain C (`extern "C"`, pointers into linear memory) so the JS glue
//! needs no generated bindings. Every object is created with `*_new` and must be
//! released with the matching `*_free`.
//!
//! Numerical conventions match `@jtarrio/signals` exactly so the WASM modules are
//! drop-in replacements:
//! * `FIRFilter.get(i) = sum_k coefs[k] * cur[i + k]` (correlation form, history first)
//! * forward FFT input is multiplied by `window[i] / N`; inverse FFT is unscaled
//! * U8 samples map to `u / 128 - 0.995`

use rustfft::num_complex::Complex32;
use rustfft::{Fft, FftPlanner};
use std::alloc::{alloc_zeroed, dealloc, Layout};
use std::sync::Arc;

const ALIGN: usize = 16;

// ───────────────────────────── memory ─────────────────────────────

/// Allocates `bytes` zeroed bytes aligned to 16. Returns a non-null pointer.
#[no_mangle]
pub extern "C" fn wrx_alloc(bytes: usize) -> *mut u8 {
    if bytes == 0 {
        return ALIGN as *mut u8;
    }
    // SAFETY: ALIGN is a power of two and bytes > 0.
    unsafe { alloc_zeroed(Layout::from_size_align_unchecked(bytes, ALIGN)) }
}

/// Frees memory returned by `wrx_alloc` with the same `bytes`.
///
/// # Safety
/// `ptr` must come from `wrx_alloc(bytes)` and not have been freed already.
#[no_mangle]
pub unsafe extern "C" fn wrx_free(ptr: *mut u8, bytes: usize) {
    if bytes == 0 || ptr.is_null() {
        return;
    }
    dealloc(ptr, Layout::from_size_align_unchecked(bytes, ALIGN));
}

/// ABI version, bumped whenever an export's signature changes.
#[no_mangle]
pub extern "C" fn wrx_version() -> u32 {
    1
}

/// 1 when compiled with WASM SIMD (or native), so the JS side can report it.
#[no_mangle]
pub extern "C" fn wrx_simd() -> u32 {
    if cfg!(all(target_arch = "wasm32", target_feature = "simd128")) {
        1
    } else {
        0
    }
}

// ───────────────────────────── dot product ─────────────────────────────

#[inline(always)]
pub fn dot(a: &[f32], b: &[f32]) -> f32 {
    let n = a.len().min(b.len());
    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    // SAFETY: both slices have at least n elements.
    unsafe {
        return dot_simd(a.as_ptr(), b.as_ptr(), n);
    }
    #[allow(unreachable_code)]
    dot_scalar(&a[..n], &b[..n])
}

#[inline(always)]
fn dot_scalar(a: &[f32], b: &[f32]) -> f32 {
    let mut acc = [0f32; 8];
    let ca = a.chunks_exact(8);
    let cb = b.chunks_exact(8);
    let (ra, rb) = (ca.remainder(), cb.remainder());
    for (x, y) in ca.zip(cb) {
        for l in 0..8 {
            acc[l] += x[l] * y[l];
        }
    }
    let mut s = acc.iter().sum::<f32>();
    for (x, y) in ra.iter().zip(rb) {
        s += x * y;
    }
    s
}

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline(always)]
unsafe fn dot_simd(a: *const f32, b: *const f32, n: usize) -> f32 {
    use core::arch::wasm32::*;
    let mut a0 = f32x4_splat(0.0);
    let mut a1 = f32x4_splat(0.0);
    let mut a2 = f32x4_splat(0.0);
    let mut a3 = f32x4_splat(0.0);
    let mut i = 0usize;
    while i + 16 <= n {
        a0 = f32x4_add(a0, f32x4_mul(v128_load(a.add(i) as *const v128), v128_load(b.add(i) as *const v128)));
        a1 = f32x4_add(a1, f32x4_mul(v128_load(a.add(i + 4) as *const v128), v128_load(b.add(i + 4) as *const v128)));
        a2 = f32x4_add(a2, f32x4_mul(v128_load(a.add(i + 8) as *const v128), v128_load(b.add(i + 8) as *const v128)));
        a3 = f32x4_add(a3, f32x4_mul(v128_load(a.add(i + 12) as *const v128), v128_load(b.add(i + 12) as *const v128)));
        i += 16;
    }
    while i + 4 <= n {
        a0 = f32x4_add(a0, f32x4_mul(v128_load(a.add(i) as *const v128), v128_load(b.add(i) as *const v128)));
        i += 4;
    }
    let s = f32x4_add(f32x4_add(a0, a1), f32x4_add(a2, a3));
    let mut sum = f32x4_extract_lane::<0>(s)
        + f32x4_extract_lane::<1>(s)
        + f32x4_extract_lane::<2>(s)
        + f32x4_extract_lane::<3>(s);
    while i < n {
        sum += *a.add(i) * *b.add(i);
        i += 1;
    }
    sum
}

// ───────────────────────────── FIR filter ─────────────────────────────

/// Streaming FIR filter with the same state semantics as signals' `FIRFilter`.
pub struct Fir {
    coefs: Vec<f32>,
    /// `offset` samples of history followed by the latest loaded block.
    cur: Vec<f32>,
    offset: usize,
}

impl Fir {
    pub fn new(coefs: &[f32]) -> Self {
        let offset = coefs.len().saturating_sub(1);
        Fir { coefs: coefs.to_vec(), cur: vec![0.0; offset], offset }
    }

    pub fn delay(&self) -> usize {
        self.coefs.len() / 2
    }

    pub fn set_coefs(&mut self, coefs: &[f32]) {
        let old = std::mem::take(&mut self.cur);
        self.coefs = coefs.to_vec();
        self.offset = coefs.len().saturating_sub(1);
        self.cur = vec![0.0; self.offset];
        self.load(&old);
    }

    pub fn load(&mut self, samples: &[f32]) {
        let off = self.offset;
        let len = samples.len() + off;
        if self.cur.len() != len {
            let mut next = vec![0.0f32; len];
            let have = self.cur.len();
            let take = off.min(have);
            next[off - take..off].copy_from_slice(&self.cur[have - take..]);
            self.cur = next;
        } else {
            self.cur.copy_within(samples.len().., 0);
        }
        self.cur[off..].copy_from_slice(samples);
    }

    #[inline(always)]
    pub fn get(&self, index: usize) -> f32 {
        let n = self.coefs.len();
        dot(&self.coefs, &self.cur[index..index + n])
    }

    pub fn in_place(&mut self, samples: &mut [f32]) {
        self.load(samples);
        for (i, s) in samples.iter_mut().enumerate() {
            *s = self.get(i);
        }
    }

    /// Filters and decimates by `ratio` (may be fractional), returning the output length.
    pub fn downsample(&mut self, input: &[f32], ratio: f64, out: &mut [f32]) -> usize {
        self.load(input);
        let len = ((input.len() as f64) / ratio).floor() as usize;
        let len = len.min(out.len());
        for (i, o) in out[..len].iter_mut().enumerate() {
            *o = self.get(((i as f64) * ratio).floor() as usize);
        }
        len
    }
}

unsafe fn slice<'a, T>(p: *const T, n: usize) -> &'a [T] {
    if n == 0 {
        &[]
    } else {
        std::slice::from_raw_parts(p, n)
    }
}
unsafe fn slice_mut<'a, T>(p: *mut T, n: usize) -> &'a mut [T] {
    if n == 0 {
        &mut []
    } else {
        std::slice::from_raw_parts_mut(p, n)
    }
}

/// # Safety
/// `coefs` must point to `n` floats.
#[no_mangle]
pub unsafe extern "C" fn fir_new(coefs: *const f32, n: usize) -> *mut Fir {
    Box::into_raw(Box::new(Fir::new(slice(coefs, n))))
}
/// # Safety
/// `h` must come from `fir_new`.
#[no_mangle]
pub unsafe extern "C" fn fir_free(h: *mut Fir) {
    if !h.is_null() {
        drop(Box::from_raw(h));
    }
}
/// # Safety
/// `h` valid; `coefs` points to `n` floats.
#[no_mangle]
pub unsafe extern "C" fn fir_set_coefs(h: *mut Fir, coefs: *const f32, n: usize) {
    (*h).set_coefs(slice(coefs, n));
}
/// # Safety
/// `h` valid.
#[no_mangle]
pub unsafe extern "C" fn fir_delay(h: *const Fir) -> usize {
    (*h).delay()
}
/// # Safety
/// `h` valid; `p` points to `n` floats.
#[no_mangle]
pub unsafe extern "C" fn fir_load(h: *mut Fir, p: *const f32, n: usize) {
    (*h).load(slice(p, n));
}
/// # Safety
/// `h` valid and `index` < length of the last loaded block.
#[no_mangle]
pub unsafe extern "C" fn fir_get(h: *const Fir, index: usize) -> f32 {
    (*h).get(index)
}
/// # Safety
/// `h` valid; `p` points to `n` floats.
#[no_mangle]
pub unsafe extern "C" fn fir_in_place(h: *mut Fir, p: *mut f32, n: usize) {
    // The filter keeps its own copy of the input, so aliasing the output is fine.
    let s = slice_mut(p, n);
    (*h).in_place(s);
}
/// # Safety
/// `h` valid; `input` points to `n` floats; `out` has room for `out_cap` floats and
/// does not overlap `input`.
#[no_mangle]
pub unsafe extern "C" fn fir_downsample(
    h: *mut Fir,
    input: *const f32,
    n: usize,
    ratio: f64,
    out: *mut f32,
    out_cap: usize,
) -> usize {
    (*h).downsample(slice(input, n), ratio, slice_mut(out, out_cap))
}

// ───────────────────────────── FFT ─────────────────────────────

/// FFT state with planar staging buffers the JS side reads and writes directly.
pub struct FftState {
    n: usize,
    fwd: Arc<dyn Fft<f32>>,
    inv: Arc<dyn Fft<f32>>,
    window: Vec<f32>,
    buf: Vec<Complex32>,
    scratch: Vec<Complex32>,
    in_re: Vec<f32>,
    in_im: Vec<f32>,
    out_re: Vec<f32>,
    out_im: Vec<f32>,
    psd: Vec<f32>,
}

impl FftState {
    pub fn new(n: usize) -> Self {
        let mut planner = FftPlanner::<f32>::new();
        let fwd = planner.plan_fft_forward(n);
        let inv = planner.plan_fft_inverse(n);
        let scratch_len = fwd.get_inplace_scratch_len().max(inv.get_inplace_scratch_len());
        FftState {
            n,
            fwd,
            inv,
            window: vec![1.0; n],
            buf: vec![Complex32::new(0.0, 0.0); n],
            scratch: vec![Complex32::new(0.0, 0.0); scratch_len],
            in_re: vec![0.0; n],
            in_im: vec![0.0; n],
            out_re: vec![0.0; n],
            out_im: vec![0.0; n],
            psd: vec![0.0; n],
        }
    }

    fn write_out(&mut self) {
        for (i, c) in self.buf.iter().enumerate() {
            self.out_re[i] = c.re;
            self.out_im[i] = c.im;
        }
    }

    /// Windowed, 1/N-scaled forward transform of the first `len` staged samples.
    pub fn forward(&mut self, len: usize, has_imag: bool) {
        let n = self.n;
        let m = len.min(n);
        let scale = 1.0 / n as f32;
        for i in 0..m {
            let w = self.window[i] * scale;
            let im = if has_imag { self.in_im[i] * w } else { 0.0 };
            self.buf[i] = Complex32::new(self.in_re[i] * w, im);
        }
        for c in &mut self.buf[m..] {
            *c = Complex32::new(0.0, 0.0);
        }
        self.fwd.process_with_scratch(&mut self.buf, &mut self.scratch);
        self.write_out();
    }

    /// Unscaled, unwindowed inverse transform of the first `len` staged samples.
    pub fn reverse(&mut self, len: usize) {
        let m = len.min(self.n);
        for i in 0..m {
            self.buf[i] = Complex32::new(self.in_re[i], self.in_im[i]);
        }
        for c in &mut self.buf[m..] {
            *c = Complex32::new(0.0, 0.0);
        }
        self.inv.process_with_scratch(&mut self.buf, &mut self.scratch);
        self.write_out();
    }

    /// Averaged, windowed, FFT-shifted power spectrum in dBFS of raw 8-bit IQ.
    ///
    /// `signed`: HackRF (int8) when true, RTL-SDR (uint8, centred on 127.5) when false.
    /// Returns the number of N-sample blocks averaged (0 if `raw` is too short).
    pub fn psd_iq8(&mut self, raw: &[u8], signed: bool, out: &mut [f32], offset_db: f32) -> usize {
        let n = self.n;
        let blocks = raw.len() / (2 * n);
        if blocks == 0 {
            return 0;
        }
        self.psd.iter_mut().for_each(|v| *v = 0.0);
        let (scale, bias) = if signed { (1.0 / 128.0, 0.0) } else { (1.0 / 127.5, -127.5) };
        for b in 0..blocks {
            let blk = &raw[b * 2 * n..(b + 1) * 2 * n];
            for i in 0..n {
                let (ri, rq) = if signed {
                    (blk[2 * i] as i8 as f32, blk[2 * i + 1] as i8 as f32)
                } else {
                    (blk[2 * i] as f32 + bias, blk[2 * i + 1] as f32 + bias)
                };
                let w = self.window[i] * scale;
                self.buf[i] = Complex32::new(ri * w, rq * w);
            }
            self.fwd.process_with_scratch(&mut self.buf, &mut self.scratch);
            for (acc, c) in self.psd.iter_mut().zip(&self.buf) {
                *acc += c.re * c.re + c.im * c.im;
            }
        }
        // Normalise by the window's coherent gain so a full-scale tone centred on a bin
        // reads 0 dBFS regardless of FFT size or window shape.
        let wsum: f32 = self.window.iter().sum::<f32>();
        let norm = 1.0 / (blocks as f32 * (wsum * wsum).max(1e-30));
        let half = n / 2;
        let m = out.len().min(n);
        for k in 0..m {
            // fftshift: output index k shows bin (k + n/2) mod n, so DC is in the middle.
            let src = (k + half) % n;
            out[k] = 10.0 * (self.psd[src] * norm + 1e-30).log10() + offset_db;
        }
        blocks
    }
}

/// # Safety
/// `n` must be > 0.
#[no_mangle]
pub unsafe extern "C" fn fft_new(n: usize) -> *mut FftState {
    Box::into_raw(Box::new(FftState::new(n.max(1))))
}
/// # Safety
/// `h` from `fft_new`.
#[no_mangle]
pub unsafe extern "C" fn fft_free(h: *mut FftState) {
    if !h.is_null() {
        drop(Box::from_raw(h));
    }
}
/// # Safety
/// `h` valid. Pointers stay valid until `fft_free` (memory may move on growth; re-read views).
#[no_mangle]
pub unsafe extern "C" fn fft_window_ptr(h: *mut FftState) -> *mut f32 {
    (*h).window.as_mut_ptr()
}
/// # Safety
/// `h` valid.
#[no_mangle]
pub unsafe extern "C" fn fft_in_re_ptr(h: *mut FftState) -> *mut f32 {
    (*h).in_re.as_mut_ptr()
}
/// # Safety
/// `h` valid.
#[no_mangle]
pub unsafe extern "C" fn fft_in_im_ptr(h: *mut FftState) -> *mut f32 {
    (*h).in_im.as_mut_ptr()
}
/// # Safety
/// `h` valid.
#[no_mangle]
pub unsafe extern "C" fn fft_out_re_ptr(h: *mut FftState) -> *mut f32 {
    (*h).out_re.as_mut_ptr()
}
/// # Safety
/// `h` valid.
#[no_mangle]
pub unsafe extern "C" fn fft_out_im_ptr(h: *mut FftState) -> *mut f32 {
    (*h).out_im.as_mut_ptr()
}
/// # Safety
/// `h` valid.
#[no_mangle]
pub unsafe extern "C" fn fft_forward(h: *mut FftState, len: usize, has_imag: u32) {
    (*h).forward(len, has_imag != 0);
}
/// # Safety
/// `h` valid.
#[no_mangle]
pub unsafe extern "C" fn fft_reverse(h: *mut FftState, len: usize) {
    (*h).reverse(len);
}
/// Writes `20*log10(|X[k]|)` of the last transform into `out` (natural order).
///
/// # Safety
/// `h` valid; `out` has room for `n` floats.
#[no_mangle]
pub unsafe extern "C" fn fft_mag_db(h: *mut FftState, out: *mut f32, n: usize) {
    let s = &*h;
    let o = slice_mut(out, n.min(s.n));
    for (k, v) in o.iter_mut().enumerate() {
        let p = s.out_re[k] * s.out_re[k] + s.out_im[k] * s.out_im[k];
        *v = 10.0 * p.log10();
    }
}
/// # Safety
/// `h` valid; `raw` points to `nbytes`; `out` to `out_n` floats.
#[no_mangle]
pub unsafe extern "C" fn fft_psd_iq8(
    h: *mut FftState,
    raw: *const u8,
    nbytes: usize,
    signed: u32,
    out: *mut f32,
    out_n: usize,
    offset_db: f32,
) -> usize {
    (*h).psd_iq8(slice(raw, nbytes), signed != 0, slice_mut(out, out_n), offset_db)
}

// ───────────────────────────── converters ─────────────────────────────

/// RTL-SDR uint8 interleaved IQ → planar float, matching `U8ToFloat32` exactly.
///
/// # Safety
/// `input` has `nbytes`; `out_i`/`out_q` have room for `nbytes/2` floats.
#[no_mangle]
pub unsafe extern "C" fn u8_to_f32_iq(input: *const u8, nbytes: usize, out_i: *mut f32, out_q: *mut f32) {
    let n = nbytes / 2;
    let src = slice(input, n * 2);
    let oi = slice_mut(out_i, n);
    let oq = slice_mut(out_q, n);
    for k in 0..n {
        oi[k] = (src[2 * k] as f64 / 128.0 - 0.995) as f32;
        oq[k] = (src[2 * k + 1] as f64 / 128.0 - 0.995) as f32;
    }
}

// ───────────────────────────── tests ─────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn naive_fir(coefs: &[f32], hist: &[f32], x: &[f32]) -> Vec<f32> {
        let mut cur = hist.to_vec();
        cur.extend_from_slice(x);
        (0..x.len())
            .map(|i| coefs.iter().enumerate().map(|(k, c)| (*c as f64) * (cur[i + k] as f64)).sum::<f64>() as f32)
            .collect()
    }

    fn lcg(seed: &mut u64) -> f32 {
        *seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        ((*seed >> 33) as f32 / (1u64 << 31) as f32) * 2.0 - 1.0
    }

    #[test]
    fn fir_matches_naive_across_blocks() {
        let mut s = 7;
        let coefs: Vec<f32> = (0..63).map(|_| lcg(&mut s)).collect();
        let mut f = Fir::new(&coefs);
        let mut hist = vec![0.0f32; 62];
        for blk in [100usize, 37, 512, 1] {
            let x: Vec<f32> = (0..blk).map(|_| lcg(&mut s)).collect();
            let want = naive_fir(&coefs, &hist, &x);
            let mut got = x.clone();
            f.in_place(&mut got);
            for (a, b) in want.iter().zip(&got) {
                assert!((a - b).abs() < 1e-4, "{a} vs {b}");
            }
            let mut all = hist.clone();
            all.extend_from_slice(&x);
            hist = all[all.len() - 62..].to_vec();
        }
    }

    #[test]
    fn downsample_fractional_ratio() {
        let coefs = vec![0.25f32; 4];
        let mut f = Fir::new(&coefs);
        let x: Vec<f32> = (0..20).map(|i| i as f32).collect();
        let mut out = vec![0.0; 20];
        let n = f.downsample(&x, 2.5, &mut out);
        assert_eq!(n, 8);
        // index 0 → mean(0,0,0,x0)=0; index floor(2.5)=2 → mean(x0..x2 with 1 history 0)
        assert!((out[1] - (0.0 + 0.0 + 1.0 + 2.0) / 4.0).abs() < 1e-6);
    }

    #[test]
    fn set_coefs_keeps_history() {
        let mut f = Fir::new(&[1.0, 0.0, 0.0]);
        let mut x = vec![1.0, 2.0, 3.0, 4.0];
        f.in_place(&mut x);
        f.set_coefs(&[1.0, 0.0, 0.0, 0.0, 0.0]);
        let mut y = vec![5.0];
        f.in_place(&mut y);
        // history kept = last 4 samples [1,2,3,4] → first tap reads 1.0
        assert_eq!(y[0], 1.0);
    }

    #[test]
    fn fft_matches_dft_convention() {
        let n = 64;
        let mut st = FftState::new(n);
        let mut s = 3;
        let re: Vec<f32> = (0..n).map(|_| lcg(&mut s)).collect();
        let im: Vec<f32> = (0..n).map(|_| lcg(&mut s)).collect();
        st.in_re.copy_from_slice(&re);
        st.in_im.copy_from_slice(&im);
        st.forward(n, true);
        for k in [0usize, 1, 5, 31, 63] {
            let (mut xr, mut xi) = (0f64, 0f64);
            for t in 0..n {
                let a = -2.0 * std::f64::consts::PI * (k * t) as f64 / n as f64;
                xr += re[t] as f64 * a.cos() - im[t] as f64 * a.sin();
                xi += re[t] as f64 * a.sin() + im[t] as f64 * a.cos();
            }
            xr /= n as f64;
            xi /= n as f64;
            assert!((xr as f32 - st.out_re[k]).abs() < 1e-5);
            assert!((xi as f32 - st.out_im[k]).abs() < 1e-5);
        }
        // Round trip: inverse is unscaled, so inverse(forward(x)) == x.
        st.in_re.copy_from_slice(&st.out_re.clone());
        st.in_im.copy_from_slice(&st.out_im.clone());
        st.reverse(n);
        for t in 0..n {
            assert!((st.out_re[t] - re[t]).abs() < 1e-5);
        }
    }

    #[test]
    fn psd_finds_tone_for_signed_and_unsigned() {
        let n = 256;
        let mut st = FftState::new(n);
        for (i, w) in st.window.iter_mut().enumerate() {
            *w = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / n as f32).cos();
        }
        let bin = 40usize; // +40 bins above centre
        for signed in [true, false] {
            let mut raw = vec![0u8; 2 * n * 8];
            for t in 0..n * 8 {
                let ph = 2.0 * std::f32::consts::PI * (bin * t) as f32 / n as f32;
                let (i, q) = (100.0 * ph.cos(), 100.0 * ph.sin());
                if signed {
                    raw[2 * t] = (i.round() as i8) as u8;
                    raw[2 * t + 1] = (q.round() as i8) as u8;
                } else {
                    raw[2 * t] = (i + 127.5).round() as u8;
                    raw[2 * t + 1] = (q + 127.5).round() as u8;
                }
            }
            let mut out = vec![0.0; n];
            assert_eq!(st.psd_iq8(&raw, signed, &mut out, 0.0), 8);
            let peak = out.iter().enumerate().fold(0, |m, (i, v)| if *v > out[m] { i } else { m });
            assert_eq!(peak, n / 2 + bin, "signed={signed}");
        }
    }

    #[test]
    fn psd_full_scale_tone_is_near_0_dbfs() {
        for n in [256usize, 4096] {
            let mut st = FftState::new(n);
            for (i, w) in st.window.iter_mut().enumerate() {
                *w = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / n as f32).cos();
            }
            let bin = n / 8;
            let mut raw = vec![0u8; 2 * n * 4];
            for t in 0..n * 4 {
                let ph = 2.0 * std::f32::consts::PI * (bin * t) as f32 / n as f32;
                raw[2 * t] = ((127.0 * ph.cos()).round() as i8) as u8;
                raw[2 * t + 1] = ((127.0 * ph.sin()).round() as i8) as u8;
            }
            let mut out = vec![0.0; n];
            st.psd_iq8(&raw, true, &mut out, 0.0);
            let peak = out.iter().cloned().fold(f32::MIN, f32::max);
            assert!((peak - 20.0 * (127.0f32 / 128.0).log10()).abs() < 0.1, "n={n} peak={peak}");
        }
    }

    #[test]
    fn u8_conversion_matches_js() {
        let raw = [0u8, 255, 128, 127];
        let mut i = [0f32; 2];
        let mut q = [0f32; 2];
        unsafe { u8_to_f32_iq(raw.as_ptr(), 4, i.as_mut_ptr(), q.as_mut_ptr()) };
        assert_eq!(i[0], (0.0f64 / 128.0 - 0.995) as f32);
        assert_eq!(q[0], (255.0f64 / 128.0 - 0.995) as f32);
        assert_eq!(q[1], (127.0f64 / 128.0 - 0.995) as f32);
    }
}
