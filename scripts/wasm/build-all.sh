#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/resolve-sources.sh"
rm -rf -- "${OOA_WASM_GENERATED_ROOT}"
mkdir -p "${OOA_WASM_GENERATED_ROOT}"
bash "${script_dir}/build-ray.sh"
bash "${script_dir}/build-normal-mode.sh"
bash "${script_dir}/build-pe.sh"
bash "${script_dir}/write-provenance.sh"
node "${script_dir}/verify-packages.mjs" "${OOA_WASM_ACTIVE_ROOT}"
