#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/resolve-sources.sh"

verify_source() {
  local label="$1"
  local source_root="$2"
  local binding_directory="$3"
  local target_marker="$4"

  if [[ ! -d "${source_root}" ]]; then
    echo "${label} source directory is missing: ${source_root}" >&2
    return 1
  fi
  if [[ ! -f "${source_root}/CMakeLists.txt" ]]; then
    echo "${label} source has no CMakeLists.txt: ${source_root}" >&2
    return 1
  fi
  if [[ ! -f "${source_root}/${binding_directory}/CMakeLists.txt" ]]; then
    echo "${label} WASM binding is missing: ${source_root}/${binding_directory}" >&2
    return 1
  fi
  if ! rg --fixed-strings --quiet "${target_marker}" "${source_root}/${binding_directory}/CMakeLists.txt"; then
    echo "${label} WASM package target marker is missing (${target_marker}): ${source_root}/${binding_directory}/CMakeLists.txt" >&2
    return 1
  fi
}

verify_source "Ray Mode" "${OOA_RAY_MODE_SOURCE}" "bindings/wasm/bellhop_2d" "bellhop_2d_wasm_package"
verify_source "Normal Mode" "${OOA_NORMAL_MODE_SOURCE}" "bindings/wasm/kraken" "oonm_add_wasm_model(kraken"
verify_source "PE" "${OOA_PE_SOURCE}" "bindings/wasm/ram" "oope_add_wasm_model(ram"

printf 'Ray Mode source: %s\n' "${OOA_RAY_MODE_SOURCE}"
printf 'Normal Mode source: %s\n' "${OOA_NORMAL_MODE_SOURCE}"
printf 'PE source: %s\n' "${OOA_PE_SOURCE}"
