"""Integrity of this confirmation overlay; never grants G1 or release admission."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path("docs/audit/evidence/g1-download-confirmation-20261022")
MANIFEST = ROOT / "manifest.json"
PLAN = Path("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md")
SOURCE = "71b26d54998c3117391f01cac9a7e8681c5880ac"
PACKET = "1698bea12789d4219b3020d5ed3d6951b9756448"


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
assert proof["confirmedTaskIds"] == ["G1-DL-01", "G1-DL-02"]
assert proof["g1Gate"] == proof["fep1Gate"] == "NOT_READY_GAPS_OPEN"
assert proof["stageGate"] == "NOT_ASSESSED" and proof["formalAccepted"] is False
assert proof["runtimeAdmission"] == "DENIED" and proof["functionalTestsRerun"] is False
assert len(proof["negativeProbes"]) == 39
if sys.argv[1] == "--write":
    assert not MANIFEST.exists(), "Never replace an existing seal"
    manifest = {"schema": "quantos-g1-download-confirmation-seal/v1", "sourceCommit": SOURCE,
                "sourcePacket": PACKET, "selfExcluded": str(MANIFEST), "files": entries()}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
else:
    manifest = json.loads(MANIFEST.read_text())
    assert manifest["schema"] == "quantos-g1-download-confirmation-seal/v1"
    assert manifest["sourceCommit"] == SOURCE and manifest["sourcePacket"] == PACKET
    assert manifest["selfExcluded"] == str(MANIFEST) and manifest["files"] == entries()
print(json.dumps({"confirmationPacketIntegrity": "PASS", "files": len(manifest["files"]),
                  "g1Gate": "NOT_READY_GAPS_OPEN", "formalAccepted": False}))
