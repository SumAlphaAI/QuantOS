#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
signature_dir="${repo_root}/artifacts/signatures"

if [[ $# -lt 1 ]]; then
  echo "Usage: sign-artifacts.sh <file> [file...]" >&2
  exit 1
fi

mkdir -p "${signature_dir}"

if [[ "${QUANTOS_REQUIRE_FORMAL_SIGNATURE:-0}" == "1" && -z "${QUANTOS_SIGNING_KEY:-}" ]]; then
  echo "QUANTOS_SIGNING_KEY is required when QUANTOS_REQUIRE_FORMAL_SIGNATURE=1." >&2
  exit 1
fi

for input in "$@"; do
  if [[ ! -f "${input}" ]]; then
    echo "Cannot sign missing file: ${input}" >&2
    exit 1
  fi

  base_name="$(basename "${input}")"
  output="${signature_dir}/${base_name}.sig"

  if [[ -n "${QUANTOS_SIGNING_KEY:-}" ]]; then
    openssl dgst -sha256 -hmac "${QUANTOS_SIGNING_KEY}" "${input}" | awk '{print $2}' > "${output}"
    signature_kind="HMAC-SHA256"
  else
    shasum -a 256 "${input}" | awk '{print $1}' > "${output}"
    signature_kind="SHA256-INTEGRITY-ONLY"
  fi

  echo "Wrote ${signature_kind} signature ${output}"
done
