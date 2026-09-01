#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${OOA_REAL_NPM:-}" || -z "${OOA_WASM_TSC_COMPAT:-}" ]]; then
  echo "OOA_REAL_NPM and OOA_WASM_TSC_COMPAT must be set" >&2
  exit 2
fi

"${OOA_REAL_NPM}" "$@"

is_ci=false
prefix=""
previous=""
for argument in "$@"; do
  if [[ "${argument}" == "ci" ]]; then
    is_ci=true
  elif [[ "${previous}" == "--prefix" ]]; then
    prefix="${argument}"
  elif [[ "${argument}" == --prefix=* ]]; then
    prefix="${argument#--prefix=}"
  fi
  previous="${argument}"
done

if [[ "${is_ci}" == true && "${prefix}" == */node-tools ]]; then
  tsc_launcher="${prefix}/node_modules/.bin/tsc"
  if [[ -e "${tsc_launcher}" || -L "${tsc_launcher}" ]]; then
    unlink "${tsc_launcher}"
    install -m 755 "${OOA_WASM_TSC_COMPAT}" "${tsc_launcher}"
  fi
fi
