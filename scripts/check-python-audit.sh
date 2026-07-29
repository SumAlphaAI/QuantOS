#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_requirements="$(mktemp)"
filtered_requirements="$(mktemp)"
trap 'rm -f "${tmp_requirements}" "${filtered_requirements}"' EXIT

uv export --project "${repo_root}/engines" --all-packages --no-dev --no-hashes --format requirements-txt > "${tmp_requirements}"

grep -vE '^(#|$|-e |\./|file:)' "${tmp_requirements}" > "${filtered_requirements}" || true

if [[ ! -s "${filtered_requirements}" ]]; then
  echo "No external Python runtime dependencies to audit."
  exit 0
fi

uv run --project "${repo_root}/engines" --with pip-audit==2.9.0 pip-audit --requirement "${filtered_requirements}"
