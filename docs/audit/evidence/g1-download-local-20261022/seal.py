"""Packet integrity and pending-scope metadata only; no integration admission."""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path("docs/audit/evidence/g1-download-local-20261022")
MANIFEST = ROOT / "manifest.json"
SOURCE = "71b26d54998c3117391f01cac9a7e8681c5880ac"
EXTERNAL = [Path("docs/audit/G1-DL01-DL02-reference-download-review-2026-10-22.md"),
            Path("docs/operations/g1-reference-downloads.md"),
            Path("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md")]


def digest(raw):
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def read(name):
    return json.loads((ROOT / name).read_text())


def metadata():
    receipt = read("receipt.json")
    assert receipt["sourceCommit"] == SOURCE
    assert receipt["confirmation"] == "PENDING" and receipt["formalAccepted"] is False
    assert receipt["runtimeAdmission"] == "DENIED"
    assert receipt["stageGate"] == "NOT_ASSESSED"
    assert receipt["g1Gate"] == receipt["fep1Gate"] == "NOT_READY_GAPS_OPEN"
    scope = read("scope.json")
    assert scope["payload"]["inputs"] == receipt["inputs"]
    assert scope["payload"]["sourceCommit"] == SOURCE
    assert scope["payload"]["taskIds"] == ["G1-DL-01", "G1-DL-02"]
    assert scope["inputsDigest"] == digest(json.dumps(scope["payload"], ensure_ascii=False, separators=(",", ":")).encode())
    request = read("confirmation-request.json")
    draft = json.loads(re.search(r"```json\n(.*?)\n```", (ROOT / "confirmation-draft.md").read_text(), re.S).group(1))
    assert draft["schema"] == "quantos-acceptance-draft/v1"
    assert draft["draftedBy"] == "Codex" and draft["mode"] == "AGENT_DRAFT_USER_CONFIRMATION"
    assert draft["request"] == request
    assert request["sourceCommit"] == SOURCE and request["inputsDigest"] == scope["inputsDigest"]
    assert request["reviewDimensions"] == draft["reviewDimensions"] == ["Product", "Frontend", "BFF", "QA", "Security", "Risk"]
    actions = read("remediation-status.json")
    assert actions["localReferenceTasksVerified"] == 2 and actions["otherObligationsRetained"] == 6
    assert len(actions["actions"]) == 8
    for row in actions["actions"]:
        if row["id"] in ("G1-DL-01", "G1-DL-02"):
            assert row["status"] == "IMPLEMENTED_VERIFIED_LOCAL_REFERENCE"
            assert row["confirmation"] == "PENDING" and row["targetTopologyAndLiveDelivery"] == "NOT_RUN"
        else:
            assert row["status"] == row["originalStatus"]
    retained = read("retained-boundaries.json")
    old = Path(retained["historicalLedger"])
    assert digest(old.read_bytes()) == retained["historicalLedgerSha256"]
    assert json.loads(old.read_text()) == retained["historical"]
    assert retained["thisScope"] == {k: v for k, v in receipt.items() if v == "NOT_RUN"}
    assert retained["firefoxBrowser"] == "BLOCKED_ENVIRONMENT"
    assert retained["webKitAttachmentBrowser"] == "BLOCKED_ENVIRONMENT_TEST_INTERCEPTION"
    checks = read("final-static-checks.json")
    for check in checks["checks"]:
        assert check["exitCode"] == 0 and digest(Path(check["log"]).read_bytes()) == check["sha256"]


def entries():
    paths = sorted([p for p in ROOT.rglob("*") if p.is_file() and p != MANIFEST] + EXTERNAL)
    return [{"path": str(p), "sha256": digest(p.read_bytes())} for p in paths]


assert len(sys.argv) == 2 and sys.argv[1] in ("--write", "--verify")
metadata()
if sys.argv[1] == "--write":
    assert not MANIFEST.exists(), "Never silently replace a sealed packet"
    manifest = {"schema": "quantos-g1-download-packet-seal/v1", "sourceCommit": SOURCE,
                "selfExcluded": str(MANIFEST), "scope": "LOCAL_REFERENCE_DOWNLOAD_ENGINEERING_ONLY",
                "files": entries()}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
else:
    manifest = read("manifest.json")
    assert manifest["schema"] == "quantos-g1-download-packet-seal/v1"
    assert manifest["sourceCommit"] == SOURCE and manifest["selfExcluded"] == str(MANIFEST)
    assert manifest["files"] == entries(), "Packet bytes or file set changed"
print(json.dumps({"packetIntegrity": "PASS", "files": len(manifest["files"]),
                  "confirmation": "PENDING", "g1Gate": "NOT_READY_GAPS_OPEN", "formalAccepted": False}))
