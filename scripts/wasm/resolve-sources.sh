#!/usr/bin/env bash
set -euo pipefail

website_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

export OOA_RAY_MODE_SOURCE="${OOA_RAY_MODE_SOURCE:-${website_root}/../OpenOcean-Field-RayMode}"
export OOA_NORMAL_MODE_SOURCE="${OOA_NORMAL_MODE_SOURCE:-${website_root}/../OpenOcean-Field-NormalMode}"
export OOA_PE_SOURCE="${OOA_PE_SOURCE:-${website_root}/../OpenOcean-Field-PE}"

export OOA_WASM_BUILD_ROOT="${OOA_WASM_BUILD_ROOT:-${website_root}/.wasm-build/dev}"
export OOA_WASM_CACHE_ROOT="${website_root}/.wasm-cache"
export OOA_WASM_PACKAGE_ROOT="${website_root}/.wasm-packages"
export OOA_WASM_GENERATED_ROOT="${OOA_WASM_PACKAGE_ROOT}/generated"
export OOA_WASM_ACTIVE_ROOT="${OOA_WASM_PACKAGE_ROOT}/active"
