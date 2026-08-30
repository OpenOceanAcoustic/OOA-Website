#!/usr/bin/env bash
set -euo pipefail

website_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pe_source="${website_root}/OpenOcean-Field-PE"
wasm_build="${website_root}/.wasm-build/pe-main-v2"
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
if [[ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]] && command -v chromium >/dev/null 2>&1; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$(command -v chromium)"
fi

emcmake cmake -S "${pe_source}" -B "${wasm_build}" -G Ninja \
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
  -DOOPE_WASM_INITIAL_MEMORY_MB=256 \
  -DOOPE_WASM_MAXIMUM_MEMORY_MB=2048 \
  -DOOPE_PACKAGE_OUTPUT_ROOT="${wasm_packages}"

cmake --build "${wasm_build}" \
  --target ram_wasm_package_smoke ram_wasm_browser_smoke -j2
