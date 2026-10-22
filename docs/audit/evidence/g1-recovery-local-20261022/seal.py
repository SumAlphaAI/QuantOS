"""Seal current reference route evidence; never promotes G1 or release readiness."""
from pathlib import Path
import hashlib
import json
import re
import sys
ROOT = Path("docs/audit/evidence/g1-recovery-local-20261022")
MANIFEST = ROOT / "manifest.json"
SOURCE = "75451b08bf97f3b85d49d6f9eca9da23975e974a"
EXTERNAL = [Path("docs/audit/G1-REC01-route-recovery-review-2026-10-22.md"),
            Path("docs/operations/g1-route-recovery.md"),
            Path("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md")]


def digest(raw):
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def read(name):
    return json.loads((ROOT / name).read_text())


def metadata():
    receipt = read("receipt.json")
    assert receipt["sourceCommit"] == SOURCE and receipt["attempt"].endswith("/attempt-02")
    assert receipt["engineeringGate"] == "PASS_ROUTE_INVALIDATION_REFERENCE_SCOPE"
    assert receipt["confirmation"] == "PENDING" and receipt["formalAccepted"] is False
    assert receipt["g1Gate"] == receipt["fep1Gate"] == "NOT_READY_GAPS_OPEN"
    assert receipt["stageGate"] == "NOT_ASSESSED" and receipt["runtimeAdmission"] == "DENIED"
    assert receipt["policy"] == {"pollMs": 5000, "requestMs": 3000, "maxUnverifiedMs": 8000, "maxFrameChars": 16384}
    scope = read("scope.json")
    assert scope["payload"]["inputs"] == receipt["inputs"] and scope["payload"]["sourceCommit"] == SOURCE
    assert scope["payload"]["taskIds"] == ["G1-REC-01"]
    assert scope["inputsDigest"] == digest(json.dumps(scope["payload"], ensure_ascii=False, separators=(",", ":")).encode())
    request = read("confirmation-request.json")
    draft = json.loads(re.search(r"```json\n(.*?)\n```", (ROOT / "confirmation-draft.md").read_text(), re.S).group(1))
    assert draft["schema"] == "quantos-acceptance-draft/v1" and draft["draftedBy"] == "Codex"
    assert draft["request"] == request and request["inputsDigest"] == scope["inputsDigest"]
    assert request["sourceCommit"] == SOURCE
    assert draft["reviewDimensions"] == request["reviewDimensions"] == ["Product", "Frontend", "BFF", "QA", "Security", "Risk"]
    status = read("remediation-status.json")
    assert status["localReferenceTasksVerified"] == 3 and status["otherObligationsRetained"] == 5
    assert status["g1Gate"] == "NOT_READY_GAPS_OPEN" and status["stageGate"] == "NOT_ASSESSED"
    prior = status["priorStatus"]
    assert digest(Path(prior["path"]).read_bytes()) == prior["sha256"]
    old = json.loads(Path(prior["path"]).read_text())
    for a, before in zip(status["actions"], old["actions"], strict=True):
        if a["id"] == "G1-REC-01":
            assert a["status"] == "IMPLEMENTED_VERIFIED_LOCAL_REFERENCE" and a["confirmation"] == "PENDING"
            assert a["sourceCommit"] == SOURCE and a["targetPersistentRevocation"] == "NOT_RUN"
        else:
            assert a == before
    retained = read("retained-boundaries.json")
    prior = retained["prior"]
    assert digest(Path(prior["path"]).read_bytes()) == prior["sha256"]
    assert retained["historical"] == json.loads(Path(prior["path"]).read_text())
    assert retained["thisScope"] == {k: v for k, v in receipt.items() if v == "NOT_RUN"}
    assert retained["firefoxBrowser"] == "BLOCKED_ENVIRONMENT"
    assert retained["webKitAttachmentBrowser"] == "BLOCKED_ENVIRONMENT_TEST_INTERCEPTION"
    for c in read("final-static-checks.json")["checks"]:
        assert c["exitCode"] == 0 and digest(Path(c["log"]).read_bytes()) == c["sha256"]


def entries():
    paths = sorted([p for p in ROOT.rglob("*") if p.is_file() and p != MANIFEST] + EXTERNAL)
    return [{"path": str(p), "sha256": digest(p.read_bytes())} for p in paths]


assert len(sys.argv) == 2 and sys.argv[1] in ("--write", "--verify")
metadata()
if sys.argv[1] == "--write":
    assert not MANIFEST.exists(), "Never replace a sealed packet"
    manifest = {"schema": "quantos-g1-recovery-packet-seal/v1", "sourceCommit": SOURCE,
                "selfExcluded": str(MANIFEST), "scope": "LOCAL_ROUTE_INVALIDATION_REFERENCE_ONLY", "files": entries()}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
else:
    manifest = read("manifest.json")
    assert manifest["schema"] == "quantos-g1-recovery-packet-seal/v1"
    assert manifest["sourceCommit"] == SOURCE and manifest["selfExcluded"] == str(MANIFEST)
    assert manifest["files"] == entries(), "Packet bytes or file set changed"
print(json.dumps({"packetIntegrity": "PASS", "files": len(manifest["files"]),
                  "confirmation": "PENDING", "g1Gate": "NOT_READY_GAPS_OPEN", "formalAccepted": False}))
