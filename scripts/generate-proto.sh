#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
buf_cmd=()

if command -v buf >/dev/null 2>&1; then
  buf_cmd=(buf)
elif command -v pnpm >/dev/null 2>&1; then
  buf_cmd=(pnpm exec buf)
else
  echo "buf is required for proto generation." >&2
  exit 1
fi

"${buf_cmd[@]}" format -w
"${buf_cmd[@]}" lint
"${buf_cmd[@]}" generate
descriptor_file="$(mktemp)"
trap 'rm -f "$descriptor_file"' EXIT
"${buf_cmd[@]}" build -o "$descriptor_file"
cargo run --locked --quiet -p quantos-proto-json-codegen -- "$descriptor_file"
python3 - <<'PY'
from pathlib import Path

root = Path("engines/engine-sdk/src")
for path in sorted(root.rglob("*_pb2.py")):
    package_dir = path.parent
    while package_dir != root.parent and package_dir != root:
        if package_dir.is_relative_to(root / "google"):
            break
        init_file = package_dir / "__init__.py"
        if not init_file.exists():
            init_file.write_text("\n", encoding="utf-8")
        package_dir = package_dir.parent
PY
node "${repo_root}/scripts/extract-json-schemas.mjs"

echo "Generated Rust, Python, TypeScript, OpenAPI, and JSON schema artifacts."
