#!/usr/bin/env bash
set -euo pipefail

website_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ray_mode_default="${website_root}/OpenOcean-Field-RayMode"
normal_mode_default="${website_root}/OpenOcean-Field-NormalMode"
pe_default="${website_root}/OpenOcean-Field-PE"

# Prefer the repository-owned submodules introduced by dev_qp. Keep the old
# sibling checkout layout as a fallback for existing developer workspaces.
[[ -d "${ray_mode_default}" ]] || ray_mode_default="${website_root}/../OpenOcean-Field-RayMode"
[[ -d "${normal_mode_default}" ]] || normal_mode_default="${website_root}/../OpenOcean-Field-NormalMode"
[[ -d "${pe_default}" ]] || pe_default="${website_root}/../OpenOcean-Field-PE"

export OOA_RAY_MODE_SOURCE="${OOA_RAY_MODE_SOURCE:-${ray_mode_default}}"
export OOA_NORMAL_MODE_SOURCE="${OOA_NORMAL_MODE_SOURCE:-${normal_mode_default}}"
export OOA_PE_SOURCE="${OOA_PE_SOURCE:-${pe_default}}"

export OOA_WASM_BUILD_ROOT="${OOA_WASM_BUILD_ROOT:-${website_root}/.wasm-build/dev}"
export OOA_WASM_CACHE_ROOT="${website_root}/.wasm-cache"
export OOA_WASM_PACKAGE_ROOT="${website_root}/.wasm-packages"
export OOA_WASM_GENERATED_ROOT="${OOA_WASM_PACKAGE_ROOT}/generated"
export OOA_WASM_ACTIVE_ROOT="${OOA_WASM_PACKAGE_ROOT}/active"
