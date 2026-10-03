from pathlib import Path
import json
import re
import subprocess
import hashlib

f = Path(__file__).resolve().parent
root = f.parents[3]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


c = json.loads((f / "commands.json").read_text())
w = Path(c["workspace"])
assert len(c["results"]) == 28
expected_failures = {"visual-darwin", "terminal-firefox", "terminal-webkit"}
assert all(
    r["exit_code"] == (1 if r["name"] in expected_failures else 0) for r in c["results"]
)
probes = json.loads((f / "probes.json").read_text())
assert len(probes["results"]) == 14 and probes["unexpected_accepts"] == 10
mutations = json.loads((f / "mutations.json").read_text())
assert len(mutations["results"]) == 11 and all(
    r["exit_code"] == 0 and r["unexpected_accept"] for r in mutations["results"]
)
assert all(
    json.loads((f / (app + "-flaky.json")).read_text())["stats"]["flaky"] == 1
    for app in ["terminal", "website"]
)
unit = re.sub(r"\x1b\[[0-9;]*m", "", (f / "unit.log").read_text())
counts = sum(map(int, re.findall(r"Tests\s+(\d+) passed", unit)))
files = sum(map(int, re.findall(r"Test Files\s+(\d+) passed", unit)))
assert (counts, files) == (181, 25)
browsers = {
    name: json.loads((f / (name + ".json")).read_text())["stats"]
    for name in [
        app + "-" + browser
        for app in ["terminal", "website"]
        for browser in ["chromium", "firefox", "webkit"]
    ]
}
assert (
    sum(r["expected"] for r in browsers.values()) == 130
    and sum(r["unexpected"] for r in browsers.values()) == 5
)
assert sum(r["skipped"] + r["flaky"] for r in browsers.values()) == 0
matrix = json.loads((f / "task-matrix.json").read_text())
assert (
    matrix["total"] == 20
    and matrix["status_counts"] == {"PASS": 10, "PARTIAL": 5, "FAIL": 5}
    and matrix["strict_completion_percent"] == 50
)
ledger = json.loads((f / "issue-ledger.json").read_text())
assert len(ledger["issues"]) == 9 and ledger["severities"] == {
    "blocker": 0,
    "high": 2,
    "medium": 6,
    "low": 1,
}
report = root / "docs/audit/PRE-06-comprehensive-review-2026-10-02.md"
links = []
for link in re.findall(r"\]\(([^)]+)\)", report.read_text()):
    if "://" in link or link.startswith("#"):
        continue
    target = (report.parent / link.split("#")[0]).resolve()
    links.append(link)
    if target != (f / "manifest.json").resolve():
        assert target.exists(), link
# Compare all tracked audit inputs with the pristine baseline and restored validation copy.
paths = subprocess.check_output(
    [
        "git",
        "ls-files",
        "scripts",
        "tests",
        "apps/terminal",
        "apps/website",
        "packages",
        "env",
        ".github/workflows",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "playwright.config.ts",
        "playwright.website.config.ts",
        "vitest.coverage.config.ts",
        "eslint.config.mjs",
        "Makefile",
        "AGENTS.md",
        "docs/PRE-06-summary.md",
        "docs/PRE-05-environment-guide.md",
        "docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md",
        "docs/audit/PRE-06-acceptance-evidence-2026-09-16.md",
    ],
    cwd=root,
    text=True,
).splitlines()
for name in paths:
    assert (root / name).read_bytes() == (w / name).read_bytes(), (
        "audit input changed: " + name
    )
assert subprocess.check_output(["git", "diff", "HEAD"], cwd=root) == b""
cleanup = json.loads((f / "generated-snapshot-cleanup.json").read_text())
visual = json.loads((root / "tests/e2e/visual-baselines.json").read_text())
assert len(visual["entries"]) == 17
coverage = json.loads((f / "coverage-summary.json").read_text())["total"]
(f / "verification.json").write_text(
    json.dumps(
        {
            "status": "PASS for audit integrity, not PRE-06 acceptance",
            "source_inputs_equal_validation_workspace": True,
            "tracked_source_diff_empty": True,
            "local_links_checked": len(links),
            "tracked_visual_baselines": 17,
            "browser_stats": browsers,
            "coverage": coverage,
            "generated_baseline_cleanup": cleanup,
            "unit_tests": counts,
            "unit_test_files": files,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n"
)
manifest = {
    "schema": "quantos-pre06-review/v1",
    "date": "2026-10-02",
    "baseline": c["baseline"],
    "binding": "pristine Git archive; frozen offline install with host cache; every recorded tracked audit input byte-identical to root and restored validation copy",
    "review_result": "CHANGES_REQUESTED",
    "severities": ledger["severities"],
    "controls": matrix["status_counts"],
    "strict_completion_percent": 50,
    "scope": "repository audit and local macOS Web replay; not remote CI/Linux/provider/staging/database/native acceptance",
    "validation": {
        "main_commands": 28,
        "successful_commands": 25,
        "failed_commands": 3,
        "expected_rejection_probes": 14,
        "correct_rejections": 4,
        "unexpected_accepts": 10,
        "mutation_processes": 11,
        "mutation_unexpected_accepts": 11,
        "contract_tests": 13,
        "pre06_tests": 7,
        "unit_tests": 181,
        "unit_test_files": 25,
        "browser_passed": 130,
        "browser_failed": 5,
        "browser_skipped": 0,
        "browser_flaky": 0,
        "separate_policy_probe_flaky": 2,
        "visual_pngs": 17,
        "linux_visual_inventory": "PASS 12/12; execution NOT RUN",
        "darwin_visual_inventory": "FAIL 5/12 available",
        "coverage": coverage,
    },
    "not_run": [
        "remote CI on this SHA",
        "Linux browser execution",
        "formal G0 or designated-model review",
        "real staging/provider/BFF/IdP/Sentry/accounts",
        "database execution",
        "full business journeys",
        "Desktop/native",
    ],
    "input_sha256": {name: sha(root / name) for name in paths},
    "report_sha256": sha(report),
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
    "Audit integrity PASS:",
    len(paths),
    "source hashes,",
    len(links),
    "links; review CHANGES_REQUESTED; 50.00% completion",
)
