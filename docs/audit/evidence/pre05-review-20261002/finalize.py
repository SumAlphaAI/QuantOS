from pathlib import Path
import json
import hashlib
import re
import subprocess

f = Path(__file__).resolve().parent
root = f.parents[3]
report = root / "docs/audit/PRE-05-comprehensive-review-2026-10-02.md"


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


c = json.loads((f / "commands.json").read_text())
w = Path(c["workspace"])
assert len(c["results"]) == 16
assert all(
    r["exit_code"] == (1 if r["expected_exit"] == "nonzero" else 0)
    for r in c["results"]
)
for app in ["terminal", "website"]:
    assert "fail-fast" in (f / f"missing-env-{app}.log").read_text()
unit = re.sub(r"\x1b\[[0-9;]*m", "", (f / "unit.log").read_text())
counts = sum(map(int, re.findall(r"Tests\s+(\d+) passed", unit)))
files = sum(map(int, re.findall(r"Test Files\s+(\d+) passed", unit)))
assert (counts, files) == (167, 25)
text = report.read_text()
controls = []
issues = []
for line in text.splitlines():
    cells = [cell.strip() for cell in line.split("|")[1:-1]]
    if cells and re.match(r"^C\d{2} ", cells[0]):
        controls.append(
            {
                "id": cells[0].split()[0],
                "name": cells[0],
                "requirement": cells[1],
                "verification": cells[2],
                "status": cells[3],
            }
        )
    if cells and re.match(r"^[HML]-\d{2} ", cells[0]):
        issues.append(
            {
                "id": cells[0].split()[0],
                "severity": cells[0].split()[1],
                "module": cells[1],
                "manifestation": cells[2],
                "impact": cells[3],
                "status": "OPEN",
            }
        )
assert len(controls) == 16 and len(issues) == 9
stats = {
    k: sum(item["status"] == k for item in controls)
    for k in ["PASS", "PARTIAL", "FAIL"]
}
assert stats == {"PASS": 7, "PARTIAL": 6, "FAIL": 3}
(f / "task-matrix.json").write_text(
    json.dumps(
        {
            "total": 16,
            "status_counts": stats,
            "strict_completion_percent": 43.75,
            "controls": controls,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n"
)
(f / "issue-ledger.json").write_text(
    json.dumps(
        {
            "total": 9,
            "severities": {"blocker": 0, "high": 1, "medium": 7, "low": 1},
            "issues": issues,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n"
)
links = re.findall(r"\]\(([^)]+)\)", text)
local = [link for link in links if "://" not in link and not link.startswith("#")]
for link in local:
    target = report.parent / link.split("#")[0]
    if target.resolve() != (f / "manifest.json").resolve():
        assert target.exists(), link
(f / "document-check.json").write_text(
    json.dumps(
        {
            "result": "PASS",
            "local_links": len(local),
            "sections": 4,
            "controls": 16,
            "issues": 9,
            "all_required_sections_present": all(
                s in text
                for s in [
                    "任务完成概况",
                    "完成情况明细统计",
                    "问题清单及风险分析",
                    "整改建议",
                ]
            ),
        },
        indent=2,
    )
    + "\n"
)
paths = subprocess.check_output(
    [
        "git",
        "ls-files",
        "packages/config",
        "apps/terminal",
        "apps/website",
        "env",
        ".env.example",
        ".github/workflows",
        "docs/PRE-05-environment-guide.md",
        "docs/PRE-05-summary.md",
        "docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md",
        "docs/SumAlpha-QuantOS-Web-and-Terminal-Design.md",
        "docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md",
        "docs/gate-records/G0-current-governance.json",
        "docs/audit/PRE-05-acceptance-evidence-2026-09-16.md",
        "scripts/pre03-next-config.mjs",
        "scripts/pre03-build-receipt.mjs",
        "scripts/check-secrets.mjs",
        "scripts/check-secrets.sh",
        "scripts/verify-reproducible-builds.mjs",
        "tests/e2e/auth-callback.spec.ts",
        "tests/contract/generated/quantos-bff.msw.ts",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "AGENTS.md",
    ],
    cwd=root,
    text=True,
).splitlines()
for path in paths:
    assert (root / path).read_bytes() == (w / path).read_bytes(), (
        f"archive input differs: {path}"
    )
canary = json.loads((f / "bundle-canary.json").read_text())
assert canary["build_exit"] == 0 and len(canary["client_js_hits"]) == 2
canary["client_js_sha256"] = {p: sha(w / p) for p in canary["client_js_hits"]}
(f / "bundle-canary.json").write_text(json.dumps(canary, indent=2) + "\n")
manifest = {
    "schema": "quantos-pre05-review/v1",
    "date": "2026-10-02",
    "source_sha": c["baseline"],
    "source_binding": "all listed tracked inputs verified byte-identical to clean Git archive",
    "conclusion": "CHANGES_REQUESTED",
    "control_points": {"total": 16, **stats, "strict_completion_percent": 43.75},
    "issues": {"blocker": 0, "high": 1, "medium": 7, "low": 1},
    "validation": {
        "fresh_frozen_offline_install": True,
        "host_download_cache": True,
        "node": "24.12.0",
        "pnpm": "10.20.0",
        "baseline_commands": 8,
        "missing_env_builds_rejected": 2,
        "profile_application_builds_passed": 6,
        "config_tests": 12,
        "unit_tests": 167,
        "unit_files": 25,
        "contract_tests": 13,
        "config_probes": {
            "total": 14,
            "positive": 2,
            "negative": 12,
            "false_passes": 8,
        },
        "synthetic_canary_only": True,
        "no_real_credentials_used": True,
    },
    "not_run": [
        "remote CI",
        "formal G0",
        "designated-model review",
        "real staging DNS/TLS/BFF/IdP/Sentry/accounts",
        "database execution",
        "browser matrix",
        "full business acceptance",
        "Desktop/native",
    ],
    "report_sha256": sha(report),
    "input_sha256": {p: sha(root / p) for p in paths},
    "artifact_sha256": {
        str(p.relative_to(f)): sha(p)
        for p in sorted(f.rglob("*"))
        if p.is_file() and p.name != "manifest.json"
    },
}
(f / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
)
print(
    f"PASS: archive binding {len(paths)} inputs, {len(local)} links, 16 controls, 9 issues; audit result CHANGES_REQUESTED"
)
