#!/usr/bin/env bash
set -euo pipefail

website_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
raymode_source="${website_root}/OpenOcean-Field-RayMode"
wasm_build="${website_root}/.wasm-build/ray-mode"
wasm_packages="${website_root}/.wasm-packages"
wasm_cache="${website_root}/.wasm-cache"
emsdk_root="${EMSDK:-/opt/emsdk}"

if [[ ! -r "${emsdk_root}/emsdk_env.sh" ]]; then
  echo "Emscripten SDK not found at ${emsdk_root}" >&2
  exit 1
fi

source "${emsdk_root}/emsdk_env.sh" >/dev/null
mkdir -p "${wasm_cache}/emscripten" "${wasm_cache}/ccache" "${wasm_cache}/npm"
export EM_CACHE="${wasm_cache}/emscripten"
export CCACHE_DIR="${wasm_cache}/ccache"
export NPM_CONFIG_CACHE="${wasm_cache}/npm"

emcmake cmake -S "${raymode_source}" -B "${wasm_build}" -G Ninja \
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
  -DOOB_WASM_PTHREAD_POOL_SIZE=4 \
  -DOOB_WASM_INITIAL_MEMORY_MB=256 \
  -DOOB_WASM_MAXIMUM_MEMORY_MB=2048 \
  -DOOB_PACKAGE_OUTPUT_ROOT="${wasm_packages}"

cmake --build "${wasm_build}" \
  --target bellhop_2d_wasm_package_smoke -j2
