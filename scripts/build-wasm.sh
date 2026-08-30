#!/usr/bin/env bash
set -euo pipefail

website_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "${website_root}/scripts/build-ray-wasm.sh"
bash "${website_root}/scripts/build-normal-mode-wasm.sh"
bash "${website_root}/scripts/build-pe-wasm.sh"
