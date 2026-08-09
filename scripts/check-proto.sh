#!/usr/bin/env bash

set -euo pipefail

repo_root="${QUANTOS_GATE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
buf_cmd=()

for path in "${repo_root}/buf.yaml" "${repo_root}/buf.gen.yaml" "${repo_root}/proto/README.md"; do
  if [[ ! -f "${path}" ]]; then
    echo "Missing required proto workspace file: ${path}" >&2
    exit 1
  fi
done

if [[ -x "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/node_modules/.bin/buf" ]]; then
  buf_cmd=("$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/node_modules/.bin/buf")
elif command -v buf >/dev/null 2>&1; then
  buf_cmd=(buf)
elif command -v pnpm >/dev/null 2>&1; then
  buf_cmd=(pnpm exec buf)
else
  echo "buf is required for proto checks." >&2
  exit 1
fi

(
  cd "${repo_root}"
  "${buf_cmd[@]}" format --diff --exit-code
  "${buf_cmd[@]}" lint
  "${buf_cmd[@]}" build
)

if [[ -d "${repo_root}/.git" ]]; then
  if git -C "${repo_root}" rev-parse --verify HEAD >/dev/null 2>&1; then
    "${buf_cmd[@]}" breaking --against '.git#branch=main' || {
      echo "Buf breaking check failed against main." >&2
      exit 1
    }
  fi
fi

echo "Proto checks passed."
