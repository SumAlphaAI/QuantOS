"""Seal or verify the gap-review packet; never grants integration admission."""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path("docs/audit/evidence/frontend-g1-gap-20261022")
MANIFEST = ROOT / "manifest.json"
EXTERNAL = [
    Path("docs/audit/FRONTEND-G1-FEP1-local-gap-review-2026-10-22.md"),
    Path("docs/operations/frontend-g1-gap-review.md"),
    Path("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md"),
]


def entries():
    paths = sorted([p for p in ROOT.rglob("*") if p.is_file() and p != MANIFEST] + EXTERNAL)
    return [{"path": str(p), "sha256": "sha256:" + hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in paths]


assert len(sys.argv) == 2 and sys.argv[1] in ("--write", "--verify")
if sys.argv[1] == "--write":
    assert not MANIFEST.exists(), "Do not silently replace a sealed manifest"
    manifest = {
        "schema": "quantos-g1-gap-packet-seal/v1",
        "sourceCommit": "2ccceeffe290611ddd75ee22fe5ce56e06909f21",
        "selfExcluded": str(MANIFEST),
        "scope": "Packet integrity only; G1/FEP-1 remain NOT_READY_GAPS_OPEN",
        "files": entries(),
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
else:
    manifest = json.loads(MANIFEST.read_text())
    assert manifest["schema"] == "quantos-g1-gap-packet-seal/v1"
    assert manifest["sourceCommit"] == "2ccceeffe290611ddd75ee22fe5ce56e06909f21"
    assert manifest["selfExcluded"] == str(MANIFEST)
    assert manifest["files"] == entries(), "Packet bytes or file set changed"
print(json.dumps({"packetIntegrity": "PASS", "files": len(manifest["files"]),
                  "g1Gate": "NOT_READY_GAPS_OPEN", "formalAccepted": False}))
