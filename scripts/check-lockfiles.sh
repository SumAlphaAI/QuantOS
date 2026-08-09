#!/usr/bin/env bash

set -euo pipefail

repo_root="${QUANTOS_GATE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

required_files=(
  "${repo_root}/Cargo.lock"
  "${repo_root}/pnpm-lock.yaml"
  "${repo_root}/engines/uv.lock"
)

for path in "${required_files[@]}"; do
  if [[ ! -s "${path}" ]]; then
    echo "Missing required lockfile: ${path}" >&2
    exit 1
  fi
done

echo "All required lockfiles are present."
