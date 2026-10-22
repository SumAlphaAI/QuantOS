"""Immutable local journey packet. Explicit ports cannot grant full G1 or release."""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path("docs/audit/evidence/g1-journey-local-20261022")
MANIFEST = ROOT / "manifest.json"
SOURCE = "38569928f3557f80ca8bf3717d1f77882cf1e5ae"
EXTERNAL = [Path("docs/audit/G1-REC02-local-journey-review-2026-10-22.md"),
            Path("docs/operations/g1-local-journey.md"),
            Path("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md")]


def digest(raw):
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def read(name):
    return json.loads((ROOT / name).read_text())


def metadata():
    receipt = read("receipt.json")
    assert receipt["sourceCommit"] == SOURCE and receipt["attempt"].endswith("/attempt-01")
    assert len(receipt["inputs"]) == 577 and len(receipt["executions"]) == 9
    assert receipt["engineeringGate"] == "PASS_LOCAL_JOURNEY_WITH_EXPLICIT_PORT_SUBSTITUTIONS"
    assert receipt["confirmation"] == "PENDING" and receipt["formalAccepted"] is False
    assert receipt["g1Gate"] == receipt["fep1Gate"] == "NOT_READY_GAPS_OPEN"
    assert receipt["stageGate"] == "NOT_ASSESSED" and receipt["runtimeAdmission"] == "DENIED"
    assert receipt["idpSession"] == "SYNTHETIC_LOOPBACK_PKCE_AND_SESSION_BRIDGE"
    assert receipt["exportCreation"] == "NODE_CONTROL_PORT_NO_EXPORT_UI"
    scope = read("scope.json")
    payload = scope["payload"]
    assert payload["inputs"] == receipt["inputs"] and payload["sourceCommit"] == SOURCE
    assert payload["taskIds"] == ["G1-REC-02"]
    assert scope["inputsDigest"] == digest(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode())
    for key in ["receipt", "journeyMatrix", "retainedBoundaries"]:
        item = payload[key]
        assert digest(Path(item["path"]).read_bytes()) == item["sha256"]
    request = read("confirmation-request.json")
    draft = json.loads(re.search(r"```json\n(.*?)\n```", (ROOT / "confirmation-draft.md").read_text(), re.S).group(1))
    assert draft["schema"] == "quantos-acceptance-draft/v1" and draft["draftedBy"] == "Codex"
    assert draft["request"] == request and request["inputsDigest"] == scope["inputsDigest"]
    assert request["sourceCommit"] == SOURCE
    assert draft["reviewDimensions"] == request["reviewDimensions"] == ["Product", "Frontend", "BFF", "QA", "Security", "Risk"]
    status = read("remediation-status.json")
    assert status["localReferenceTasksVerified"] == status["otherObligationsRetained"] == 4
    assert status["g1Gate"] == "NOT_READY_GAPS_OPEN" and status["stageGate"] == "NOT_ASSESSED"
    prior = status["priorStatus"]
    assert digest(Path(prior["path"]).read_bytes()) == prior["sha256"]
    old = json.loads(Path(prior["path"]).read_text())
    for action, before in zip(status["actions"], old["actions"], strict=True):
        if action["id"] == "G1-REC-02":
            assert action["status"] == "IMPLEMENTED_VERIFIED_LOCAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS"
            assert action["confirmation"] == "PENDING" and action["sourceCommit"] == SOURCE
            assert action["scope"] == "LOCAL_REFERENCE_JOURNEY_ONLY_NOT_FULL_G1"
            assert action["fullG1BusinessJourney"] == "NOT_RUN" and action["formalAccepted"] is False
        else:
            assert action == before
    assert status["nextExecutable"] == ["G1-DEP-01"]
    retained = read("retained-boundaries.json")
    prior = retained["prior"]
    assert digest(Path(prior["path"]).read_bytes()) == prior["sha256"]
    assert retained["historical"] == json.loads(Path(prior["path"]).read_text())
    assert retained["thisScope"] == {k: v for k, v in receipt.items() if v == "NOT_RUN"}
    assert retained["firefoxBrowser"] == "BLOCKED_ENVIRONMENT"
    assert retained["webKitAttachmentBrowser"] == "BLOCKED_ENVIRONMENT_TEST_INTERCEPTION"
    assert retained["additionalNotRun"]["actualReferenceMfaCooldownExpiry"] == "NOT_RUN_60_SECOND_REFERENCE_WINDOW"
    matrix = read("journey-matrix.json")
    assert matrix["sourceCommit"] == SOURCE and len(matrix["cases"]) == 10
    for case in matrix["cases"]:
        assert digest(Path(case["path"]).read_bytes()) == case["sha256"]
        assert case["outcome"]["status"] == "PASS"
    for row in read("final-static-checks.json")["checks"]:
        assert row["exitCode"] == 0 and row["signal"] is None and row["errorCode"] is None
        assert digest(Path(row["log"]).read_bytes()) == row["sha256"]


def entries():
    paths = sorted([p for p in ROOT.rglob("*") if p.is_file() and p != MANIFEST] + EXTERNAL)
    return [{"path": str(p), "sha256": digest(p.read_bytes())} for p in paths]


assert len(sys.argv) == 2 and sys.argv[1] in ("--write", "--verify")
metadata()
if sys.argv[1] == "--write":
    assert not MANIFEST.exists(), "Never replace a sealed packet"
    manifest = {"schema": "quantos-g1-journey-packet-seal/v1", "sourceCommit": SOURCE,
                "selfExcluded": str(MANIFEST), "scope": "LOCAL_REFERENCE_JOURNEY_WITH_EXPLICIT_PORT_SUBSTITUTIONS_ONLY", "files": entries()}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
else:
    manifest = read("manifest.json")
    assert manifest["schema"] == "quantos-g1-journey-packet-seal/v1"
    assert manifest["sourceCommit"] == SOURCE and manifest["selfExcluded"] == str(MANIFEST)
    assert manifest["files"] == entries(), "Packet bytes or file set changed"
print(json.dumps({"packetIntegrity": "PASS", "files": len(manifest["files"]),
                  "confirmation": "PENDING", "g1Gate": "NOT_READY_GAPS_OPEN", "formalAccepted": False}))
