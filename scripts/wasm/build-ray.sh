#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/build-common.sh"
bash "${script_dir}/verify-sources.sh" >/dev/null
load_emscripten
prepare_wasm_directories

emcmake cmake --fresh -S "${OOA_RAY_MODE_SOURCE}" -B "${OOA_WASM_BUILD_ROOT}/ray-mode" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DOOB_BUILD_2D=ON \
  -DOOB_BUILD_NX2D=OFF \
  -DOOB_BUILD_3D=OFF \
  -DOOB_BUILD_STANDALONE=ON \
  -DOOB_BUILD_FIELDCORE=OFF \
  -DOOB_BUILD_MIGRATION=OFF \
  -DOOB_BUILD_LEGACY_IO=ON \
  -DOOB_BUILD_C_BINDINGS=OFF \
  -DOOB_BUILD_PYTHON=OFF \
  -DOOB_BUILD_WASM=ON \
  -DOOB_BUILD_CLI=OFF \
  -DOOB_BUILD_TESTING=OFF \
  -DOOB_BUILD_PACKAGES=OFF \
  -DOOB_LIBRARY_TYPE=STATIC \
  -DOOB_WASM_BUILD_SINGLE_THREAD=ON \
  -DOOB_WASM_BUILD_PTHREAD=ON \
  -DOOB_NPM_EXECUTABLE="${OOA_NPM_EXECUTABLE}" \
  -DOOB_PACKAGE_OUTPUT_ROOT="${OOA_WASM_GENERATED_ROOT}"

cmake --build "${OOA_WASM_BUILD_ROOT}/ray-mode" --target bellhop_2d_wasm_package -j2
bash "${script_dir}/materialize-packages.sh" ray
