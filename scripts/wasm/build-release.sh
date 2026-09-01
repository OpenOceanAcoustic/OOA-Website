#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
website_root="$(cd "${script_dir}/../.." && pwd)"
source "${script_dir}/resolve-sources.sh"

mode="${1:---locked}"
if [[ "${mode}" != "--freeze" && "${mode}" != "--locked" ]]; then
  echo "Usage: $0 [--freeze|--locked]" >&2
  exit 2
fi

development_ray_source="${OOA_RAY_MODE_SOURCE}"
development_normal_source="${OOA_NORMAL_MODE_SOURCE}"
development_pe_source="${OOA_PE_SOURCE}"
release_root="${website_root}/.field-release-sources"

locked_commit() {
  local package_name="$1"
  node -e '
    const fs = require("node:fs");
    const lock = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const record = lock.packages.find((item) => item.packageName === process.argv[2]);
    if (!record) throw new Error(`missing lock entry for ${process.argv[2]}`);
    process.stdout.write(record.sourceCommit);
  ' "${website_root}/wasm-package-lock.json" "${package_name}"
}

prepare_worktree() {
  local source_repository="$1"
  local target_directory="$2"
  local label="$3"
  local package_name="$4"
  local target_commit

  if [[ ! -d "${source_repository}/.git" && ! -f "${source_repository}/.git" ]]; then
    echo "${label}: source repository is missing at ${source_repository}" >&2
    return 1
  fi

  git -C "${source_repository}" fetch origin main
  if [[ "${mode}" == "--freeze" ]]; then
    target_commit="$(git -C "${source_repository}" rev-parse origin/main)"
  else
    target_commit="$(locked_commit "${package_name}")"
    if ! git -C "${source_repository}" cat-file -e "${target_commit}^{commit}"; then
      echo "${label}: locked commit is unavailable after fetching origin: ${target_commit}" >&2
      return 1
    fi
  fi
  if [[ -e "${target_directory}" ]]; then
    if ! git -C "${target_directory}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      echo "${label}: release target exists but is not a Git worktree: ${target_directory}" >&2
      return 1
    fi
    if [[ -n "$(git -C "${target_directory}" status --porcelain)" ]]; then
      echo "${label}: release worktree is dirty: ${target_directory}" >&2
      return 1
    fi
    git -C "${target_directory}" switch --detach "${target_commit}"
  else
    mkdir -p "$(dirname "${target_directory}")"
    git -C "${source_repository}" worktree add --detach "${target_directory}" "${target_commit}"
  fi

  if [[ -n "$(git -C "${target_directory}" status --porcelain)" ]]; then
    echo "${label}: prepared release worktree is not clean" >&2
    return 1
  fi
}

ray_release_source="${release_root}/ray-mode"
normal_release_source="${release_root}/normal-mode"
pe_release_source="${release_root}/pe"

prepare_worktree "${development_ray_source}" "${ray_release_source}" "Ray Mode" '@openocean/field-bellhop-2d'
prepare_worktree "${development_normal_source}" "${normal_release_source}" "Normal Mode" '@openocean/field-normal-mode-kraken'
prepare_worktree "${development_pe_source}" "${pe_release_source}" "PE" '@openocean/field-pe-ram'

export OOA_RAY_MODE_SOURCE="${ray_release_source}"
export OOA_NORMAL_MODE_SOURCE="${normal_release_source}"
export OOA_PE_SOURCE="${pe_release_source}"
export OOA_WASM_BUILD_ROOT="${website_root}/.wasm-build/release"

bash "${script_dir}/build-all.sh"
npm install --prefix "${website_root}"
node "${script_dir}/verify-packages.mjs"
node "${script_dir}/verify-release-sources.mjs" "${mode}" \
  "${development_ray_source}" "${ray_release_source}" \
  "${development_normal_source}" "${normal_release_source}" \
  "${development_pe_source}" "${pe_release_source}"
if [[ "${mode}" == "--freeze" ]]; then
  node "${script_dir}/write-package-lock.mjs"
else
  node "${script_dir}/verify-package-lock.mjs"
fi
node "${script_dir}/print-provenance.mjs"
node "${script_dir}/refresh-dev-cache.mjs"
