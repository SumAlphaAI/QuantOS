#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
signature_dir="${repo_root}/artifacts/signatures"

if [[ $# -lt 1 ]]; then
  echo "Usage: verify-artifact-signatures.sh <file> [file...]" >&2
  exit 1
fi

if [[ -z "${QUANTOS_SIGNING_KEY:-}" ]]; then
  echo "QUANTOS_SIGNING_KEY is required to verify formal artifact signatures." >&2
  exit 1
fi

expected="$(mktemp)"
trap 'rm -f "${expected}"' EXIT

for input in "$@"; do
  signature="${signature_dir}/$(basename "${input}").sig"
  if [[ ! -s "${input}" || ! -s "${signature}" ]]; then
    echo "Cannot verify missing artifact or signature: ${input}" >&2
    exit 1
  fi
  openssl dgst -sha256 -hmac "${QUANTOS_SIGNING_KEY}" "${input}" | awk '{print $2}' > "${expected}"
  if ! cmp -s "${expected}" "${signature}"; then
    echo "Formal signature verification failed for ${input}" >&2
    exit 1
  fi
  echo "Verified HMAC-SHA256 signature for ${input}"
done
