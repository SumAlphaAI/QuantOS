#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${repo_root}/artifacts/sbom"
output_file="${output_dir}/quantos.spdx.json"
document_namespace="https://sumalpha.ai/spdx/sumalpha-quantos/$(date -u +"%Y%m%d%H%M%S")"

mkdir -p "${output_dir}"

cat > "${output_file}" <<EOF
{
  "spdxVersion": "SPDX-2.3",
  "dataLicense": "CC0-1.0",
  "SPDXID": "SPDXRef-DOCUMENT",
  "name": "sumalpha-quantos",
  "documentNamespace": "${document_namespace}",
  "creationInfo": {
    "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "creators": ["Tool: generate-sbom.sh"]
  },
  "packages": [
    {
      "name": "sumalpha-quantos",
      "SPDXID": "SPDXRef-Package-QuantOS",
      "downloadLocation": "NOASSERTION",
      "licenseConcluded": "NOASSERTION",
      "licenseDeclared": "NOASSERTION",
      "filesAnalyzed": false
    },
    {
      "name": "Cargo.lock",
      "SPDXID": "SPDXRef-CargoLock",
      "downloadLocation": "NOASSERTION",
      "licenseConcluded": "NOASSERTION",
      "licenseDeclared": "NOASSERTION",
      "filesAnalyzed": false
    },
    {
      "name": "pnpm-lock.yaml",
      "SPDXID": "SPDXRef-PnpmLock",
      "downloadLocation": "NOASSERTION",
      "licenseConcluded": "NOASSERTION",
      "licenseDeclared": "NOASSERTION",
      "filesAnalyzed": false
    },
    {
      "name": "engines/uv.lock",
      "SPDXID": "SPDXRef-UvLock",
      "downloadLocation": "NOASSERTION",
      "licenseConcluded": "NOASSERTION",
      "licenseDeclared": "NOASSERTION",
      "filesAnalyzed": false
    }
  ]
}
EOF

echo "Generated placeholder SPDX SBOM at ${output_file}."
