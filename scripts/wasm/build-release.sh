#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
website_root="$(cd "${script_dir}/../.." && pwd)"
source "${script_dir}/resolve-sources.sh"

development_ray_source="${OOA_RAY_MODE_SOURCE}"
development_normal_source="${OOA_NORMAL_MODE_SOURCE}"
development_pe_source="${OOA_PE_SOURCE}"
release_root="${website_root}/.field-release-sources"

prepare_worktree() {
  local source_repository="$1"
  local target_directory="$2"
  local label="$3"

  if [[ ! -d "${source_repository}/.git" && ! -f "${source_repository}/.git" ]]; then
    echo "${label}: source repository is missing at ${source_repository}" >&2
    return 1
  fi

  git -C "${source_repository}" fetch origin main
  if [[ -e "${target_directory}" ]]; then
    if ! git -C "${target_directory}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      echo "${label}: release target exists but is not a Git worktree: ${target_directory}" >&2
      return 1
    fi
    if [[ -n "$(git -C "${target_directory}" status --porcelain)" ]]; then
      echo "${label}: release worktree is dirty: ${target_directory}" >&2
      return 1
    fi
    git -C "${target_directory}" switch --detach origin/main
  else
    mkdir -p "$(dirname "${target_directory}")"
    git -C "${source_repository}" worktree add --detach "${target_directory}" origin/main
  fi

  if [[ -n "$(git -C "${target_directory}" status --porcelain)" ]]; then
    echo "${label}: prepared release worktree is not clean" >&2
    return 1
  fi
}

ray_release_source="${release_root}/ray-mode"
normal_release_source="${release_root}/normal-mode"
pe_release_source="${release_root}/pe"

prepare_worktree "${development_ray_source}" "${ray_release_source}" "Ray Mode"
prepare_worktree "${development_normal_source}" "${normal_release_source}" "Normal Mode"
prepare_worktree "${development_pe_source}" "${pe_release_source}" "PE"

export OOA_RAY_MODE_SOURCE="${ray_release_source}"
export OOA_NORMAL_MODE_SOURCE="${normal_release_source}"
export OOA_PE_SOURCE="${pe_release_source}"

bash "${script_dir}/build-all.sh"
npm install --prefix "${website_root}"
node "${script_dir}/verify-packages.mjs"
node "${script_dir}/verify-release-sources.mjs" \
  "${development_ray_source}" "${ray_release_source}" \
  "${development_normal_source}" "${normal_release_source}" \
  "${development_pe_source}" "${pe_release_source}"
node "${script_dir}/print-provenance.mjs"
node "${script_dir}/refresh-dev-cache.mjs"
