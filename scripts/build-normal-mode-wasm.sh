#!/usr/bin/env bash
set -euo pipefail

website_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
normal_source="${website_root}/OpenOcean-Field-NormalMode"
wasm_build="${website_root}/.wasm-build/normal-mode-main-v2"
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

emcmake cmake -S "${normal_source}" -B "${wasm_build}" -G Ninja \
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
  -DOONM_WASM_BUILD_COUNTERPART=ON \
  -DOONM_WASM_EXECUTION_VARIANT=PTHREAD \
  -DOONM_WASM_PTHREAD_POOL_SIZE=4 \
  -DOONM_WASM_INITIAL_MEMORY_MB=256 \
  -DOONM_WASM_MAXIMUM_MEMORY_MB=2048 \
  -DOONM_PACKAGE_OUTPUT_ROOT="${wasm_packages}"

cmake --build "${wasm_build}" \
  --target kraken_wasm_package_smoke kraken_wasm_browser_smoke -j2
