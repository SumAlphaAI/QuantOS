from pathlib import Path
import hashlib
import json
import re
import subprocess

folder = Path(__file__).resolve().parent
root = folder.parents[3]
report = root / "docs/audit/PRE-04-comprehensive-review-2026-10-02.md"
links = []
errors = []
for value in re.findall(r"\]\(([^)]+)\)", report.read_text()):
    if "://" in value or value.startswith("#"):
        continue
    links.append(value)
    if not (report.parent / value.split("#")[0]).exists():
        errors.append(value)
# The manifest is written below and is the only permitted not-yet-created link.
errors = [e for e in errors if e != "./evidence/pre04-review-20261002/manifest.json"]
assert not errors, errors
(folder / "document-check.json").write_text(
    json.dumps(
        {"result": "PASS", "checked_links": len(links), "errors": errors}, indent=2
    )
    + "\n"
)
paths = [
    "AGENTS.md",
    "package.json",
    "pnpm-lock.yaml",
    "docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md",
    "docs/SumAlpha-QuantOS-Development-Plan.md",
    "docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md",
    "docs/SumAlpha-QuantOS-Web-and-Terminal-Design.md",
    "docs/PRE-01-page-ledger-and-stories.md",
    "docs/PRE-01-page-api-coverage-register.md",
    "docs/PRE-04-contract-ledger.md",
    "docs/PRE-04-openapi-gap-list.md",
    "docs/PRE-04-field-dictionary.md",
    "docs/PRE-04-summary.md",
    "bff/openapi/quantos-bff.v1.yaml",
    "bff/page-operation-catalog.yaml",
    ".github/workflows/frontend-baseline.yml",
    "scripts/pre04-inventory.mjs",
    "scripts/pre04-gate-negative.mjs",
    "scripts/check-bff-openapi.mjs",
    "scripts/check-bff-contract-coverage.mjs",
    "scripts/check-bff-generated.mjs",
    "scripts/check-pre01.mjs",
    "scripts/check-pre06.mjs",
    "tests/contract/contract.test.ts",
    "tests/contract/validate.mjs",
]
for pattern in [
    "proto/quantos/*/v1/*.proto",
    "proto/jsonschema/*.schema.json",
    "tests/contract/generated/*",
    "tests/contract/fixtures/**/*.json",
    "packages/api-client/src/gen/**/*.ts",
    "packages/api-client/src/bff-gen/*",
    "packages/api-client/src/*.ts",
]:
    paths.extend(str(p.relative_to(root)) for p in root.glob(pattern) if p.is_file())


def hash_file(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


artifacts = {
    str(p.relative_to(folder)): hash_file(p)
    for p in sorted(folder.rglob("*"))
    if p.is_file() and p.name != "manifest.json"
}
probes = json.loads((folder / "probes.json").read_text())
commands = json.loads((folder / "commands.json").read_text())
inspection = json.loads((folder / "inspection.json").read_text())
manifest = {
    "schema": "quantos-pre04-comprehensive-review/v1",
    "date": "2026-10-02",
    "baseline": subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=root, text=True
    ).strip(),
    "initial_worktree": "clean",
    "result": "PARTIAL",
    "control_points": {
        "total": 16,
        "pass": 8,
        "partial": 8,
        "fail": 0,
        "strict_completion_percent": 50,
        "weighted_progress_percent": 75,
    },
    "required_outputs": {"present": 4, "total": 4, "fully_verified": 1},
    "issues": {
        "blocker": 0,
        "high": 2,
        "medium": 6,
        "low": 1,
        "total": 9,
        "ids": ["H-01", "H-02", "M-01", "M-02", "M-03", "M-04", "M-05", "M-06", "L-01"],
    },
    "observed_inventory": {
        "contracts": 17,
        "gaps": 17,
        "field_table_rows": 144,
        "p0_expected": 23,
        "p0_registered": 18,
        "p0_missing": inspection["scope"]["p0_missing"],
        "bff_version": "1.3.0",
        "bff_operations": 62,
        "bff_schemas": 51,
        "published_operations": 62,
        "planned_operations": 46,
        "proto_files": 6,
        "proto_messages": 38,
        "proto_enums": 15,
        "proto_services": 2,
        "proto_rpcs": 7,
        "json_schemas": 50,
    },
    "execution": {
        "os": "macOS",
        "node": "24.12.0",
        "pnpm": "10.20.0",
        "mode": "current workspace with existing installed dependencies; no install/build/database",
        "commands": len(commands["results"]),
        "all_exit_zero": all(r["exit_code"] == 0 for r in commands["results"]),
        "pre04_tests": 7,
        "contract_tests": 13,
    },
    "independent_probes": {
        "total": len(probes),
        "positive_controls": 1,
        "negative_inputs": 14,
        "correct_rejections": 2,
        "false_passes": 12,
        "mutation_scope": "structured-cloned in-memory inputs only; production source unchanged",
    },
    "not_run": [
        "fresh dependency install",
        "Web build/browser matrix",
        "full F03 generation and target acceptance",
        "full F06 target acceptance",
        "remote CI",
        "formal G0",
        "designated-model review",
        "provider/staging",
        "database/IdP/object storage",
        "Desktop/native acceptance",
    ],
    "report_sha256": hash_file(report),
    "input_sha256": {p: hash_file(root / p) for p in sorted(set(paths))},
    "artifact_sha256": artifacts,
}
(folder / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
)
print(
    "Report links:",
    len(links),
    "PASS; input hashes:",
    len(manifest["input_sha256"]),
    "artifact hashes:",
    len(artifacts),
)
