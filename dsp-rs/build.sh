#!/usr/bin/env bash
# Builds the Rust DSP core to WebAssembly (SIMD) and copies it into the app.
#
# Requirements: a Rust toolchain with the wasm32-unknown-unknown target:
#   rustup target add wasm32-unknown-unknown
#
# If the prebuilt target can't be installed (offline / restricted network) but
# the rust-src component is present, set BUILD_STD=1 to compile std from source.
#
# The compiled webrx_dsp.wasm is committed, so the web app builds and deploys
# without Rust; rerun this only after changing dsp-rs/src.

set -euo pipefail
cd "$(dirname "$0")"

export RUSTFLAGS="${RUSTFLAGS:-} -C target-feature=+simd128"
ARGS=(build --release --target wasm32-unknown-unknown)
if [[ "${BUILD_STD:-0}" == "1" ]]; then
  export RUSTC_BOOTSTRAP=1
  ARGS+=(-Zbuild-std=std,panic_abort)
fi

cargo "${ARGS[@]}"

OUT=target/wasm32-unknown-unknown/release/webrx_dsp.wasm
if command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -O3 --enable-simd --enable-bulk-memory --enable-nontrapping-float-to-int \
    --enable-sign-ext --enable-mutable-globals --enable-multivalue --enable-reference-types \
    "$OUT" -o "$OUT"
fi

cp "$OUT" ../apps/radioreceiver/webrx_dsp.wasm
echo "Wrote apps/radioreceiver/webrx_dsp.wasm ($(wc -c < ../apps/radioreceiver/webrx_dsp.wasm) bytes)"

cargo test --release --quiet
