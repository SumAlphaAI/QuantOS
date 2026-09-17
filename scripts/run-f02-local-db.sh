#!/usr/bin/env bash
# Dedicated temporary cluster only. Never touches an existing database.
set -euo pipefail
: "${PG_BIN:?Set PG_BIN to a PostgreSQL 17 bin directory}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scratch="$(mktemp -d /tmp/quantos-f02-pg.XXXXXX)"
cleanup() { "$PG_BIN/pg_ctl" -D "$scratch/data" -m immediate -w stop >/dev/null 2>&1 || true; rm -rf "$scratch"; }
trap cleanup EXIT
"$PG_BIN/initdb" -D "$scratch/data" -U postgres --encoding=UTF8 --no-locale --auth=trust >/dev/null
port="$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')"
"$PG_BIN/pg_ctl" -D "$scratch/data" -l "$scratch/postgres.log" -o "-h 127.0.0.1 -p $port -k $scratch" -w start >/dev/null
F02_PG_ADMIN_URL="postgresql://postgres@127.0.0.1:$port/postgres" node "$root/scripts/f02-db-gate.cjs"
