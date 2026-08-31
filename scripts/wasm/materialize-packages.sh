#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/resolve-sources.sh"

materialize_one() {
  local package_pattern="$1"
  local destination_name="$2"
  local expected_package_name="$3"
  local tarball
  mapfile -t matches < <(find "${OOA_WASM_GENERATED_ROOT}" -type f -name "${package_pattern}" -print | sort)
  if [[ "${#matches[@]}" -ne 1 ]]; then
    echo "Expected exactly one ${package_pattern} below ${OOA_WASM_GENERATED_ROOT}; found ${#matches[@]}" >&2
    return 1
  fi
  tarball="${matches[0]}"

  local staging
  staging="$(mktemp -d "${OOA_WASM_PACKAGE_ROOT}/.${destination_name}.XXXXXX")"
  trap 'rm -rf -- "${staging}"' RETURN
  tar -xzf "${tarball}" --strip-components=1 -C "${staging}"
  local actual_name
  actual_name="$(node -e 'const p=require(process.argv[1]); process.stdout.write(p.name)' "${staging}/package.json")"
  if [[ "${actual_name}" != "${expected_package_name}" ]]; then
    echo "Materialized package name ${actual_name} does not match ${expected_package_name}" >&2
    return 1
  fi

  local destination="${OOA_WASM_ACTIVE_ROOT}/${destination_name}"
  rm -rf -- "${destination}"
  mv "${staging}" "${destination}"
  trap - RETURN
  printf '%s\t%s\n' "${expected_package_name}" "${tarball}"
}

case "${1:-all}" in
  ray)
    materialize_one 'openocean-field-bellhop-2d-*.tgz' 'field-bellhop-2d' '@openocean/field-bellhop-2d'
    ;;
  normal)
    materialize_one 'openocean-field-normal-mode-kraken-*.tgz' 'field-normal-mode-kraken' '@openocean/field-normal-mode-kraken'
    ;;
  pe)
    materialize_one 'openocean-field-pe-ram-*.tgz' 'field-pe-ram' '@openocean/field-pe-ram'
    ;;
  all)
    materialize_one 'openocean-field-bellhop-2d-*.tgz' 'field-bellhop-2d' '@openocean/field-bellhop-2d'
    materialize_one 'openocean-field-normal-mode-kraken-*.tgz' 'field-normal-mode-kraken' '@openocean/field-normal-mode-kraken'
    materialize_one 'openocean-field-pe-ram-*.tgz' 'field-pe-ram' '@openocean/field-pe-ram'
    ;;
  *)
    echo "Usage: $0 [ray|normal|pe|all]" >&2
    exit 2
    ;;
esac

