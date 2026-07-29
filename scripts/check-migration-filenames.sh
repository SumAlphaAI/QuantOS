#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migrations_dir="${repo_root}/supabase/migrations"
pattern='^[0-9]{14}_[a-z0-9][a-z0-9_]*\.sql$'

shopt -s nullglob
migration_files=("${migrations_dir}"/*.sql)
shopt -u nullglob

if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "No Supabase migration files found in ${migrations_dir}" >&2
  exit 1
fi

previous_timestamp=""
for path in "${migration_files[@]}"; do
  filename="$(basename "${path}")"

  if [[ ! "${filename}" =~ ${pattern} ]]; then
    echo "Invalid migration filename: ${filename}" >&2
    echo "Expected format: YYYYMMDDHHMMSS_slug.sql" >&2
    exit 1
  fi

  timestamp="${filename%%_*}"
  if [[ -n "${previous_timestamp}" && "${timestamp}" < "${previous_timestamp}" ]]; then
    echo "Migration order is not monotonic: ${filename}" >&2
    exit 1
  fi

  if [[ ! -s "${path}" ]]; then
    echo "Migration file is empty: ${filename}" >&2
    exit 1
  fi

  previous_timestamp="${timestamp}"
done

echo "Supabase migration filenames are valid."
