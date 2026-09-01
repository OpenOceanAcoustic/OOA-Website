#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/resolve-sources.sh"

node "${script_dir}/write-provenance.mjs" \
  "${OOA_RAY_MODE_SOURCE}" \
  "${OOA_NORMAL_MODE_SOURCE}" \
  "${OOA_PE_SOURCE}" \
  "${OOA_WASM_GENERATED_ROOT}" \
  "${OOA_WASM_ACTIVE_ROOT}" \
  "${OOA_WASM_PACKAGE_ROOT}/provenance.json"

