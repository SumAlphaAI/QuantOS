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
  "${buf_cmd[@]}" generate
  node ./scripts/extract-json-schemas.mjs
)

generated_paths=(
  "crates/quantos-proto/src/generated"
  "engines/engine-sdk/src"
  "packages/api-client/src/gen"
  "proto/openapi"
  "proto/jsonschema"
)

if [[ -d "${repo_root}/.git" ]]; then
  if ! git -C "${repo_root}" diff --exit-code -- "${generated_paths[@]}"; then
    echo "Proto/SDK/OpenAPI/JSON Schema generated artifacts drifted. Run: pnpm proto:generate" >&2
    exit 1
  fi
  untracked="$(git -C "${repo_root}" ls-files --others --exclude-standard -- "${generated_paths[@]}")"
  if [[ -n "${untracked}" ]]; then
    echo "Untracked generated Proto artifacts detected:" >&2
    echo "${untracked}" >&2
    echo "Run: pnpm proto:generate and commit the generated artifacts." >&2
    exit 1
  fi
fi

if [[ -d "${repo_root}/.git" ]]; then
  if git -C "${repo_root}" rev-parse --verify HEAD >/dev/null 2>&1; then
    "${buf_cmd[@]}" breaking --against '.git#branch=main' || {
      echo "Buf breaking check failed against main." >&2
      exit 1
    }
  fi
fi

echo "Proto checks passed."
