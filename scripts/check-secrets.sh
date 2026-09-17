#!/usr/bin/env bash
set -euo pipefail
root="${QUANTOS_GATE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
binary="${GITLEAKS_BIN:-gitleaks}"
[[ "$("$binary" version)" == "8.28.0" ]] || { echo 'Expected Gitleaks 8.28.0' >&2; exit 2; }
exec "$binary" git --config "$(dirname "${BASH_SOURCE[0]}")/../.gitleaks.toml" --gitleaks-ignore-path "$(dirname "${BASH_SOURCE[0]}")/../.gitleaksignore" --redact --no-banner "$root"
