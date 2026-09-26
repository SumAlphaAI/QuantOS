import json
import sys
from pathlib import Path
from datetime import datetime, timezone

p = Path(sys.argv[1])
sha = sys.argv[2]


def read(name):
    return json.loads((p / name).read_text())


required = [
    "verify",
    "verify-download",
    "frontend-baseline",
    "Web contract (chromium)",
    "Web contract (firefox)",
    "Web contract (webkit)",
    "acceptance (clean-room)",
    "acceptance (reproducibility)",
]
rules = read("main-ruleset.json")
assert {"deletion", "non_fast_forward", "required_status_checks"} <= {
    r["type"] for r in rules["rules"]
}
assert rules["enforcement"] == "active" and rules["bypass_actors"] == []
assert rules["conditions"]["ref_name"] == {
    "include": ["refs/heads/main"],
    "exclude": [],
}
policy = next(
    r["parameters"] for r in rules["rules"] if r["type"] == "required_status_checks"
)
assert policy["strict_required_status_checks_policy"] is True
assert {r["context"] for r in policy["required_status_checks"]} == set(required)
assert all(r["integration_id"] == 15368 for r in policy["required_status_checks"])
suite = read("main-merge-rule-suite.json")
assert suite["result"] == "pass" and suite["after_sha"] == sha
assert any(
    r["rule_type"] == "required_status_checks"
    and r["result"] == "pass"
    and r["enforcement"] == "active"
    for r in suite["rule_evaluations"]
)
assert read("main-branch.json")["commit"]["sha"] == sha
checks = read("main-check-runs.json")["check_runs"]
confirmed = []
for name in required:
    candidates = [c for c in checks if c["name"] == name and c["app"]["id"] == 15368]
    assert candidates, name
    check = max(candidates, key=lambda c: c["id"])
    assert (
        check["head_sha"] == sha
        and check["status"] == "completed"
        and check["conclusion"] == "success"
    ), name
    confirmed.append(
        {
            "name": name,
            "id": check["id"],
            "url": check["html_url"],
            "headSha": check["head_sha"],
            "conclusion": check["conclusion"],
        }
    )
for name in [
    "main-ci-run.json",
    "main-f01-run.json",
    "main-frontend-run.json",
    "main-compatibility-run.json",
]:
    run = read(name)
    assert (
        run["head_sha"] == sha
        and run["head_branch"] == "main"
        and run["event"] == "push"
    )
    assert run["status"] == "completed" and run["conclusion"] == "success"
jobs = read("main-ci-jobs.json")["jobs"]
for name in [
    "verify",
    "signing-policy",
    "sign-main",
    "verify-download-main",
    "verify-download",
]:
    assert any(
        j["name"] == name
        and j["status"] == "completed"
        and j["conclusion"] == "success"
        for j in jobs
    ), name
expected_workflows = {
    "QuantOS CI",
    "F01 Clean Room",
    "F03 Protocol Acceptance",
    "F04 Core Branch Coverage",
    "F08 Engine CI",
    "Frontend Baseline (FEP-0)",
    "QuantOS Compatibility",
}
workflows = [r for r in read("main-workflows.json") if r["name"] in expected_workflows]
assert len(workflows) == 7 and all(
    r["headSha"] == sha and r["status"] == "completed" and r["conclusion"] == "success"
    for r in workflows
)
repro = read("main-reproducibility.json")
clean = read("main-clean-room.json")
download = read("main-download-receipt.json")
for receipt in [repro, clean]:
    assert (
        receipt["source"]["commit"] == sha
        and receipt["source"]["dirty"] is False
        and receipt["status"] == "PASS"
        and receipt["passed"] is True
    )
assert repro["reproducible"] is True and len(repro["runs"]) >= 3
assert len({r["combinedSha256"] for r in repro["runs"]}) == 1
assert clean["runs"][0]["elapsedSeconds"] <= 1800
assert (
    download["commit"] == sha
    and download["status"] == "PASS"
    and download["downloadVerified"] is True
    and download["formalSignatureVerified"] is True
)
assert download["artifact"] == "quantos-build-artifacts"
assert str(read("main-ci-run.json")["id"]) == download["run"].rsplit("/", 1)[-1]
pr = read("merged-pr.json")
assert (
    pr["merged"] is True
    and pr["merge_commit_sha"] == sha
    and pr["base"]["ref"] == "main"
)
summary = {
    "schema": "quantos-f02-main-acceptance/v1",
    "kind": "DERIVED_VERIFICATION_OF_GITHUB_AND_REMOTE_RECEIPTS",
    "status": "PASS",
    "sourceCommit": sha,
    "validatedAt": datetime.now(timezone.utc).isoformat(),
    "requiredChecks": confirmed,
    "formalSignatureVerified": True,
    "downloadVerified": True,
    "reproducibilityRuns": len(repro["runs"]),
    "reproducibilityDigest": repro["runs"][0]["combinedSha256"],
    "pullRequest": pr["html_url"],
    "pullRequestHead": pr["head"]["sha"],
    "ciRun": read("main-ci-run.json")["html_url"],
    "f01Run": read("main-f01-run.json")["html_url"],
}
if "--write" in sys.argv:
    (p / "acceptance-verification.json").write_text(
        json.dumps(summary, indent=2) + "\n"
    )
else:
    stored = read("acceptance-verification.json")
    assert {k: v for k, v in stored.items() if k != "validatedAt"} == {
        k: v for k, v in summary.items() if k != "validatedAt"
    }
    manifest = p / "sha256-manifest.json"
    if manifest.exists():
        import hashlib

        for item in read("sha256-manifest.json")["files"]:
            data = (p / item["path"]).read_bytes()
            assert (
                len(data) == item["sizeBytes"]
                and hashlib.sha256(data).hexdigest() == item["sha256"]
            ), item["path"]
print(
    json.dumps(
        {
            "status": "PASS",
            "sourceCommit": sha,
            "requiredChecks": len(confirmed),
            "workflows": len(workflows),
            "formalSignatureVerified": True,
        },
        indent=2,
    )
)
