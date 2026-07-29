#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
signature_dir="${repo_root}/artifacts/signatures"

if [[ $# -lt 1 ]]; then
  echo "Usage: sign-artifacts.sh <file> [file...]" >&2
  exit 1
fi

mkdir -p "${signature_dir}"

for input in "$@"; do
  if [[ ! -f "${input}" ]]; then
    echo "Cannot sign missing file: ${input}" >&2
    exit 1
  fi

  base_name="$(basename "${input}")"
  output="${signature_dir}/${base_name}.sig"

  if [[ -n "${QUANTOS_SIGNING_KEY:-}" ]]; then
    openssl dgst -sha256 -hmac "${QUANTOS_SIGNING_KEY}" "${input}" | awk '{print $2}' > "${output}"
  else
    shasum -a 256 "${input}" | awk '{print $1}' > "${output}"
  fi

  echo "Wrote signature ${output}"
done
