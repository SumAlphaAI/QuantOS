"""Integrity of this confirmation overlay; never grants G1 or release admission."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path("docs/audit/evidence/g1-journey-confirmation-20261022")
MANIFEST = ROOT / "manifest.json"
PLAN = Path("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md")
SOURCE = "38569928f3557f80ca8bf3717d1f77882cf1e5ae"
PACKET = "309492b0054747d46ca4a3d587dc64910f78e3c1"


def digest(raw):
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def entries():
    paths = sorted([p for p in ROOT.rglob("*") if p.is_file() and p != MANIFEST] + [PLAN])
    return [{"path": str(p), "sha256": digest(p.read_bytes())} for p in paths]


assert len(sys.argv) == 2 and sys.argv[1] in ("--write", "--verify")
checks = json.loads((ROOT / "checks.json").read_text())
assert checks["scope"] == "CONFIRMATION_CLOSURE_ONLY"
assert checks["functionalTestsRerun"] is False
assert checks["integrationAdmission"] == checks["releaseAdmission"] == "NOT_GRANTED"
for row in checks["checks"]:
    assert row["exitCode"] == 0 and row["signal"] is None and row["errorCode"] is None
    assert digest(Path(row["log"]).read_bytes()) == row["logSha256"]
proof = json.loads((ROOT / "closure-proof.json").read_text())
assert proof["confirmation"]["status"] == "CONFIRMED"
assert proof["sourceCommit"] == SOURCE and proof["sourcePacket"] == PACKET
assert proof["confirmedTaskIds"] == ["G1-REC-02"]
assert proof["g1Gate"] == proof["fep1Gate"] == "NOT_READY_GAPS_OPEN"
assert proof["stageGate"] == "NOT_ASSESSED" and proof["formalAccepted"] is False
assert proof["runtimeAdmission"] == "DENIED" and proof["functionalTestsRerun"] is False
assert len(proof["negativeProbes"]) == 48
assert len(checks["checks"]) == 6
assert proof["preservedManifestEntries"] == 120 and proof["preservedSourceInputs"] == 577
assert proof["preservedPlanStageGates"] == 159 and proof["otherObligationsRetained"] == 4
assert proof["originalPacketPending"] == "PENDING" and proof["p15Confirmation"] == "PENDING"
scope = json.loads((ROOT / "scope-summary.json").read_text())
record = json.loads((ROOT / "user-confirmation.json").read_text())
for key in ["request", "document", "documentSha256", "confirmedTaskIds", "scopeSummary", "notRun", "historicalBoundaries", "firefoxBrowser", "webKitAttachmentBrowser", "integrationAdmission", "releaseAdmission", "g1Gate", "fep1Gate", "stageGate", "formalAccepted", "runtimeAdmission", "idpSession", "exportCreation", "transportTopology", "additionalNotRun"]:
    assert scope[key] == record[key]
assert scope["scope"] == proof["scopeAdmission"] == record["scopeAdmission"]
assert scope["sourceCommit"] == SOURCE and scope["sourcePacket"] == PACKET
assert scope["confirmation"] == "CONFIRMED" and scope["originalReceiptPendingRetained"] is True
assert scope["functionalTestsRerun"] is False
assert record["idpSession"] == proof["idpSession"] == "SYNTHETIC_LOOPBACK_PKCE_AND_SESSION_BRIDGE"
assert record["exportCreation"] == proof["exportCreation"] == "NODE_CONTROL_PORT_NO_EXPORT_UI"
assert record["transportTopology"] == proof["transportTopology"] == "HTTPS_LOOPBACK_ORIGINAL_PROVIDER_BYTES_NO_URL_REWRITE"
assert record["additionalNotRun"] == proof["additionalNotRun"]
assert record["additionalNotRun"]["actualReferenceMfaCooldownExpiry"] == "NOT_RUN_60_SECOND_REFERENCE_WINDOW"
assert record["additionalNotRun"]["fullUnsubstitutedIdentityJourney"] == "NOT_RUN"
assert record["additionalNotRun"]["fullExportCreationUiJourney"] == "NOT_RUN"
if sys.argv[1] == "--write":
    assert not MANIFEST.exists(), "Never replace an existing seal"
    manifest = {"schema": "quantos-g1-journey-confirmation-seal/v1", "sourceCommit": SOURCE,
                "sourcePacket": PACKET, "selfExcluded": str(MANIFEST), "files": entries()}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
else:
    manifest = json.loads(MANIFEST.read_text())
    assert manifest["schema"] == "quantos-g1-journey-confirmation-seal/v1"
    assert manifest["sourceCommit"] == SOURCE and manifest["sourcePacket"] == PACKET
    assert manifest["selfExcluded"] == str(MANIFEST) and manifest["files"] == entries()
print(json.dumps({"confirmationPacketIntegrity": "PASS", "files": len(manifest["files"]),
                  "g1Gate": "NOT_READY_GAPS_OPEN", "formalAccepted": False}))
