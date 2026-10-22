"""Seal bounded FEP1 function closure; no stage or production admission."""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path("docs/audit/evidence/fep1-function-local-20261022")
MANIFEST = ROOT / "manifest.json"
SOURCE = "08aa95f9b14692a93b78f36a7c6910d816ffec92"
EXTERNAL = [Path("docs/audit/FEP-1-function-closure-2026-10-22.md"),
            Path("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md")]


def digest(raw):
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def read(name):
    return json.loads((ROOT / name).read_text())


def metadata():
    r = read("receipt.json")
    assert r["sourceCommit"] == SOURCE and r["attempt"].endswith("/attempt-02")
    assert r["engineeringGate"] == "PASS_FEP1_FUNCTION_CLOSURE"
    assert r["functionExecution"] == "COMPLETED" and r["developmentContinuation"] == "ALLOWED"
    assert r["stageGate"] == "NOT_ASSESSED" and r["g1Gate"] == "NOT_READY_GAPS_OPEN"
    assert r["formalAccepted"] is False and r["runtimeAdmission"] == "DENIED"
    for key in ["fullChainRerun", "browserRerun", "buildRerun", "recursiveDependencyRevalidation", "productionCredentialsUsed", "externalPublished"]:
        assert r[key] is False
    assert r["businessIntegration"] == "NOT_RUN_FULL_ACCEPTANCE" and r["releaseAcceptance"] == "NOT_RUN"
    assert r["confirmation"] == "NOT_REQUESTED_FUNCTION_EXECUTION_ONLY" and r["p15Confirmation"] == "PENDING"
    assert r["nextTask"] == "FE:UI-507" and len(r["inputs"]) == 291
    assert len(r["executions"]) == 9 and len(r["reusedEvidence"]["receipts"]) == 9
    for row in r["executions"]:
        expected = 1 if row["id"] == "integration-refusal" else 0
        assert row["exitCode"] == row["expectedExitCode"] == expected
        assert row["signal"] is None and row["errorCode"] is None
        assert digest(Path(row["log"]).read_bytes()) == row["logSha256"]
    unit = json.loads(Path(r["attempt"], "unit.json").read_text())
    assert unit["success"] is True and unit["numTotalTests"] == unit["numPassedTests"] == 67
    assert unit["numPendingTests"] == 0
    assert "ℹ tests 104" in Path(r["attempt"], "execution-negative.log").read_text()
    assert read("evidence-reuse.json") == r["reusedEvidence"]
    for ref in r["reusedEvidence"]["receipts"]:
        assert ref["reexecuted"] is False and ref["status"] == "ORIGINAL_SCOPE_ONLY"
        assert digest(Path(ref["path"]).read_bytes()) == ref["sha256"]
    disposition = read("execution-disposition.json")
    assert disposition["development"]["allowed"] is True
    assert disposition["nextDevelopment"]["allowed"] is True
    assert disposition["integration"]["allowed"] is False
    assert disposition["integration"]["reason"] == "STAGE_NOT_READY"
    assert disposition["development"]["auxiliaryPrerequisites"] == []
    decision = read("correction-decision.json")
    assert decision["auxiliaryPrerequisites"] == [] and decision["noNewAcceptanceLoop"] is True
    retained = read("retained-boundaries.json")
    assert retained["prior"] == r["reusedEvidence"]["retainedBoundaries"]
    assert retained["confirmationP15"] == "PENDING"
    assert retained["firefoxBrowser"] == "BLOCKED_ENVIRONMENT"
    assert retained["webKitAttachmentBrowser"] == "BLOCKED_ENVIRONMENT_TEST_INTERCEPTION"
    assert retained["fullPageBilingualLaunchAcceptance"] == "NOT_RUN"
    matrix = read("functional-scope-matrix.json")
    assert matrix["sourceCommit"] == SOURCE and len(matrix["areas"]) == 9
    for area in matrix["areas"]:
        for source in area["currentSources"]:
            assert digest(Path(source["path"]).read_bytes()) == source["sha256"]
    assert read("review-dimensions.json")["humanConfirmationRequiredToContinueDevelopment"] is False
    for row in read("final-static-checks.json")["checks"]:
        assert row["exitCode"] == 0 and digest(Path(row["log"]).read_bytes()) == row["sha256"]
    for attempt in read("attempt-history.json")["attempts"]:
        assert digest(Path(attempt["receipt"]).read_bytes()) == attempt["sha256"]


def entries():
    paths = sorted([p for p in ROOT.rglob("*") if p.is_file() and p != MANIFEST] + EXTERNAL)
    return [{"path": str(p), "sha256": digest(p.read_bytes())} for p in paths]


assert len(sys.argv) == 2 and sys.argv[1] in ("--write", "--verify")
metadata()
if sys.argv[1] == "--write":
    assert not MANIFEST.exists(), "Never replace a sealed packet"
    manifest = {"schema": "quantos-fep1-function-seal/v1", "sourceCommit": SOURCE,
                "selfExcluded": str(MANIFEST), "files": entries()}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
else:
    manifest = read("manifest.json")
    assert manifest["sourceCommit"] == SOURCE and manifest["selfExcluded"] == str(MANIFEST)
    assert manifest["files"] == entries(), "Packet file set or bytes changed"
print(json.dumps({"packetIntegrity": "PASS", "files": len(manifest["files"]),
                  "functionExecution": "COMPLETED", "stageGate": "NOT_ASSESSED", "formalAccepted": False}))
