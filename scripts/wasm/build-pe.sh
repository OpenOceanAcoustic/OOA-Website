#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/build-common.sh"
bash "${script_dir}/verify-sources.sh" >/dev/null
load_emscripten
prepare_wasm_directories

emcmake cmake --fresh -S "${OOA_PE_SOURCE}" -B "${OOA_WASM_BUILD_ROOT}/pe" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DOOPE_BUILD_STANDALONE=ON \
  -DOOPE_BUILD_FIELDCORE=OFF \
  -DOOPE_BUILD_MIGRATION=OFF \
  -DOOPE_BUILD_LEGACY_IO=ON \
  -DOOPE_BUILD_C_BINDINGS=OFF \
  -DOOPE_BUILD_PYTHON=OFF \
  -DOOPE_BUILD_WASM=ON \
  -DOOPE_BUILD_CLI=OFF \
  -DOOPE_BUILD_TESTING=OFF \
  -DOOPE_BUILD_PACKAGES=OFF \
  -DOOPE_BUILD_RAM=ON \
  -DOOPE_BUILD_RAMGEO=OFF \
  -DOOPE_BUILD_RAMS=OFF \
  -DOOPE_LIBRARY_TYPE=STATIC \
  -DOOPE_NPM_EXECUTABLE="${OOA_NPM_EXECUTABLE}" \
  -DOOPE_PACKAGE_OUTPUT_ROOT="${OOA_WASM_GENERATED_ROOT}"

cmake --build "${OOA_WASM_BUILD_ROOT}/pe" \
  --target ram_wasm_package -j2
bash "${script_dir}/materialize-packages.sh" pe
