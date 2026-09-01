#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/build-common.sh"
bash "${script_dir}/verify-sources.sh" >/dev/null
load_emscripten
prepare_wasm_directories

emcmake cmake --fresh -S "${OOA_NORMAL_MODE_SOURCE}" -B "${OOA_WASM_BUILD_ROOT}/normal-mode" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DOONM_BUILD_STANDALONE=ON \
  -DOONM_BUILD_FIELDCORE=OFF \
  -DOONM_BUILD_MIGRATION=OFF \
  -DOONM_BUILD_LEGACY_IO=ON \
  -DOONM_BUILD_C_BINDINGS=OFF \
  -DOONM_BUILD_PYTHON=OFF \
  -DOONM_BUILD_WASM=ON \
  -DOONM_BUILD_CLI=OFF \
  -DOONM_BUILD_TESTING=OFF \
  -DOONM_BUILD_PACKAGES=OFF \
  -DOONM_BUILD_KRAKEN=ON \
  -DOONM_BUILD_KRAKENC=OFF \
  -DOONM_LIBRARY_TYPE=STATIC \
  -DOONM_WASM_BUILD_SINGLE_THREAD=ON \
  -DOONM_WASM_BUILD_PTHREAD=ON \
  -DOONM_NPM_EXECUTABLE="${OOA_NPM_EXECUTABLE}" \
  -DOONM_PACKAGE_OUTPUT_ROOT="${OOA_WASM_GENERATED_ROOT}"

cmake --build "${OOA_WASM_BUILD_ROOT}/normal-mode" \
  --target kraken_wasm_package -j2
bash "${script_dir}/materialize-packages.sh" normal
