#!/usr/bin/env bash
set -euo pipefail
repo_root="${QUANTOS_GATE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$repo_root"
for file in Cargo.lock buf.lock pnpm-lock.yaml engines/uv.lock; do
  test -s "$file" || { echo "Missing required lockfile: $file" >&2; exit 1; }
done
# --locked (not --frozen) checks manifest drift without rewriting a lock.
cargo metadata --locked --format-version 1 > /dev/null
uv lock --check --project engines
# Isolate pnpm's lock-only operation from the user's install tree.
node scripts/check-node-lock.mjs
printf '%s\n' 'All phase-1 locks parse and match their manifests.'
