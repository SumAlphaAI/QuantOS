#!/usr/bin/env bash

set -euo pipefail

db_cli="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/db-cli.cjs"
max_attempts=3

for attempt in $(seq 1 "$max_attempts"); do
  if node "$db_cli" reset; then
    exit 0
  fi
  if [[ "$attempt" -eq "$max_attempts" ]]; then
    echo "Database reset failed after ${max_attempts} attempts." >&2
    exit 1
  fi
  delay=$((attempt * 2))
  echo "Database reset attempt ${attempt} failed; retrying in ${delay}s." >&2
  sleep "$delay"
done
