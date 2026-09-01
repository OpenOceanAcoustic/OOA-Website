#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/resolve-sources.sh"

load_emscripten() {
  if command -v emcmake >/dev/null 2>&1 && command -v emcc >/dev/null 2>&1; then
    return
  fi
  if [[ -n "${EMSDK:-}" && -r "${EMSDK}/emsdk_env.sh" ]]; then
    source "${EMSDK}/emsdk_env.sh" >/dev/null
  fi
  if ! command -v emcmake >/dev/null 2>&1 || ! command -v emcc >/dev/null 2>&1; then
    echo "Emscripten is unavailable. Set EMSDK to an emsdk checkout or add emcmake/emcc to PATH." >&2
    return 1
  fi
}

prepare_wasm_directories() {
  mkdir -p \
    "${OOA_WASM_BUILD_ROOT}" \
    "${OOA_WASM_CACHE_ROOT}/emscripten" \
    "${OOA_WASM_CACHE_ROOT}/ccache" \
    "${OOA_WASM_CACHE_ROOT}/npm" \
    "${OOA_WASM_GENERATED_ROOT}" \
    "${OOA_WASM_ACTIVE_ROOT}" \
    "${OOA_WASM_BUILD_ROOT}/tooling"

  export OOA_REAL_NPM
  OOA_REAL_NPM="$(command -v npm)"
  export OOA_WASM_TSC_COMPAT="${script_dir}/tsc-compat.cjs"
  install -m 755 "${script_dir}/npm-compat.sh" \
    "${OOA_WASM_BUILD_ROOT}/tooling/npm"
  export OOA_NPM_EXECUTABLE="${OOA_WASM_BUILD_ROOT}/tooling/npm"
  export PATH="${OOA_WASM_BUILD_ROOT}/tooling:${PATH}"
  # Distribution packages ship a frozen cache without every LTO/threading
  # variant used by the model builds. Override only the cache policy through
  # Emscripten's supported EM_* configuration variables and let the compiler
  # populate this project-local cache; never write into /usr/share/emscripten.
  if [[ "$(em-config FROZEN_CACHE 2>/dev/null || true)" == "True" ]]; then
    export EM_FROZEN_CACHE=0
  fi
  export EM_CACHE="${OOA_WASM_CACHE_ROOT}/emscripten"
  export CCACHE_DIR="${OOA_WASM_CACHE_ROOT}/ccache"
  export NPM_CONFIG_CACHE="${OOA_WASM_CACHE_ROOT}/npm"
}
