"""Read-only delivery verification; target execution and formal approval are excluded."""
from pathlib import Path
import hashlib
import json
import re

base = Path("docs/audit/evidence/research-local-20261012")
index = json.loads((base / "evidence-index.json").read_text())
assert index["sourceCommit"] == "31f434f75f6da9bd42b9066d9f7c909d56973e66"
assert len({x["path"] for x in index["files"]}) == len(index["files"])
for item in index["files"]:
    assert "sha256:" + hashlib.sha256(Path(item["path"]).read_bytes()).hexdigest() == item["sha256"], item["path"]
results = json.loads(Path(index["executionResults"]).read_text())
assert len(results) == 135 and len({x["id"] for x in results}) == 135
assert all(x["status"] == "PASS" and x["exitCode"] == 0 for x in results)
for profile, count in [("a2-local", 17), ("r1-local", 27), ("bff003-local", 40)]:
    receipt = json.loads((base / (profile + ".json")).read_text())
    assert receipt["status"] == "READY" and receipt["observedSourceCommit"] == index["sourceCommit"]
    assert all(receipt[k] is False for k in ["databaseExecution", "externalExecution", "performanceAccepted", "production", "formalAccepted"])
    assert receipt["release"]["status"] == "NOT_RUN"
    local = json.loads(Path(receipt["localPrerequisites"]["manifest"]).read_text())
    assert len(local["nodes"]) == count
plans = json.loads((base / "plans.log").read_text())
assert plans["stage_status_counts"] == {"NOT_ASSESSED": 156, "READY": 3, "BLOCKED": 0}
assert plans["frontend_handoffs"]["tasks"] == 64 and plans["frontend_handoffs"]["checkpoints"] == 16
assert plans["frontend_handoffs"]["externalEarlyGates"] == plans["frontend_handoffs"]["performanceEarlyGates"] == 0
post = json.loads((base / "postchecks.json").read_text())
assert post["status"] == "PASS" and len(post["results"]) == 7
assert all(x["expectationMet"] for x in post["results"])
assert next(x for x in post["results"] if x["id"] == "strict-target-denial")["exitCode"] == 1
probe = json.loads((base / "tamper-probes.json").read_text())
assert probe["status"] == "PASS" and probe["restored"] is True and len(probe["probes"]) == 4
assert all(x["status"] == "REJECTED" for x in probe["probes"])
source = json.loads((base / "source-binding.json").read_text())
assert source["uniqueBoundInputs"] == 1431 and source["currentBytesMatchCandidate"] and source["normativeScopesMatchCandidate"]
closure = json.loads((base / "failure-closure.json").read_text())
assert [x["failedChecks"] for x in closure["attempts"]] == [10, 2] and closure["splicedResults"] is False
history = json.loads((base / "historical-evidence-integrity.json").read_text())
assert history["preExistingEvidenceFiles"] == 17207 and history["changedHistoricalEvidence"] == []
missing = []
for name in index["markdownChecks"]:
    path = Path(name)
    for link in re.findall(r"\]\(([^)]+)\)", path.read_text()):
        if "://" not in link and not link.startswith("#") and not (path.parent / link.split("#")[0]).exists():
            missing.append([name, link])
assert not missing, missing
print(json.dumps({"status": "PASS", "files": len(index["files"]), "groups": 135, "gate": "3 consumer-local READY", "formalAccepted": False, "targetAcceptance": "NOT_RUN", "performanceAcceptance": "NOT_RUN", "missingLinks": []}, indent=2))
