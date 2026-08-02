#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migrations_dir="${repo_root}/supabase/migrations"
bundle_file="$(mktemp)"
trap 'rm -f "${bundle_file}"' EXIT

shopt -s nullglob
migration_files=("${migrations_dir}"/*.sql)
shopt -u nullglob

if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "No Supabase migration files found in ${migrations_dir}" >&2
  exit 1
fi

cat "${migration_files[@]}" > "${bundle_file}"

if ! grep -nE "references[[:space:]]+auth\.users" "${bundle_file}" >/dev/null; then
  echo "Expected at least one Supabase auth.users reference in migrations." >&2
  exit 1
fi

if ! grep -nE "gen_random_uuid\(" "${bundle_file}" >/dev/null; then
  echo "Expected gen_random_uuid() defaults in migrations." >&2
  exit 1
fi

if ! grep -nE "timestamptz" "${bundle_file}" >/dev/null; then
  echo "Expected timestamptz columns in migrations." >&2
  exit 1
fi

quantos_tables=()
while IFS= read -r table; do
  if [[ -n "${table}" && "${table}" != "quantos.schema_migrations" ]]; then
    quantos_tables+=("${table}")
  fi
done < <(
  sed -nE 's/^[[:space:]]*create table( if not exists)?[[:space:]]+(quantos\.[a-zA-Z0-9_]+).*/\2/ip' "${migration_files[@]}" | sort -u
)

if [[ ${#quantos_tables[@]} -eq 0 ]]; then
  echo "Expected at least one quantos schema table in migrations." >&2
  exit 1
fi

for table in "${quantos_tables[@]}"; do
  table_pattern="${table//./\\.}"

  if ! grep -inE "alter table( only)?[[:space:]]+${table_pattern}[[:space:]]+enable row level security" "${bundle_file}" >/dev/null; then
    echo "Missing RLS enablement for ${table}" >&2
    exit 1
  fi

  if ! grep -inE "alter table( only)?[[:space:]]+${table_pattern}[[:space:]]+force row level security" "${bundle_file}" >/dev/null; then
    echo "Missing FORCE RLS for ${table}" >&2
    exit 1
  fi

  if ! grep -inE "on[[:space:]]+${table_pattern}" "${bundle_file}" >/dev/null; then
    echo "Missing RLS policy for ${table}" >&2
    exit 1
  fi
done

echo "Supabase RLS baseline checks passed."
