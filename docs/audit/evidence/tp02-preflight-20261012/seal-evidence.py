"""Seal this preflight's evidence, then verify bytes and frozen Git inputs read-only."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

BASE = Path("docs/audit/evidence/tp02-preflight-20261012")
ATTEMPT = BASE
REPORT = Path("docs/audit/TP02-local-preflight-2026-10-12.md")
SOURCE = json.loads((BASE / "attempt-01/receipt.json").read_text())["sourceCommit"]
BASELINE = "5821bb19c694e231113daf7b143503162cb16cbb"
SEAL = BASE / "seal.json"


def sha(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


def source_inputs():
    inputs = {item["path"]: item for item in json.loads((BASE / "attempt-01/inputs.json").read_text())}
    tree = {}
    for record in subprocess.check_output(["git", "ls-tree", "-r", "-z", SOURCE]).split(b"\0"):
        if record:
            meta, path = record.split(b"\t", 1)
            tree[path.decode()] = meta.split()[2].decode()
    gitlinks = 0
    for path, item in inputs.items():
        if "gitCommit" in item:
            gitlinks += 1
            blob = item["gitCommit"]
            actual = sha(("gitlink:" + blob).encode())
            assert subprocess.check_output(["git", "-C", path, "rev-parse", "HEAD"], text=True).strip() == blob
            assert not subprocess.check_output(["git", "-C", path, "status", "--porcelain"], text=True).strip()
        else:
            data = Path(path).read_bytes()
            actual = sha(data)
            blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        assert actual == item["sha256"], path + ": input hash changed"
        assert tree[path] == blob, path + ": differs from frozen Git source"
    assert len(inputs) == json.loads((BASE / "verification.json").read_text())["inputEntries"]
    return {"status": "PASS", "inputs": len(inputs), "files": len(inputs) - gitlinks, "gitlinks": gitlinks}


def links():
    count = 0
    for target in re.findall(r"\]\(([^)]+)\)", REPORT.read_text()):
        if "://" in target or target.startswith("#"):
            continue
        assert (REPORT.parent / target.split("#")[0]).exists(), target
        count += 1
    return count


def verify():
    record = json.loads(SEAL.read_text())
    assert record["sourceCommit"] == SOURCE
    for item in record["files"]:
        data = Path(item["path"]).read_bytes()
        assert sha(data) == item["sha256"], item["path"]
        assert len(data) == item["bytes"], item["path"]
    assert source_inputs() == record["frozenInputVerification"]
    assert links() == record["reportLinks"]
    results = json.loads((BASE / "final-01/results.json").read_text())
    assert len(results) == 11 and all(r["status"] == "PASS" for r in results)
    for r in results:
        assert sha(Path(r["log"]).read_bytes()) == r["logSha256"]
    print(json.dumps({"status": "PASS", "sealedFiles": len(record["files"]), "frozenInputs": record["frozenInputVerification"]["inputs"], "reportLinks": record["reportLinks"]}))


if sys.argv[1:] == ["--create"]:
    assert not SEAL.exists(), "preserve prior seals"
    paths = set(subprocess.check_output(["git", "diff", "--name-only", BASELINE], text=True).splitlines())
    paths.update(str(p) for root in (BASE, ATTEMPT) for p in root.rglob("*") if p.is_file())
    paths.update([str(REPORT), str(BASE / "changed-files.txt"), str(SEAL)])
    (BASE / "changed-files.txt").write_text("\n".join(sorted(paths)) + "\n")
    # The seal excludes its own bytes to avoid a circular digest.
    files = [{"path": p, "sha256": sha(Path(p).read_bytes()), "bytes": Path(p).stat().st_size} for p in sorted(paths - {str(SEAL)})]
    SEAL.write_text(json.dumps({"schema": "quantos-tp02-preflight-evidence-seal/v1", "sourceCommit": SOURCE, "baselineCommit": BASELINE, "files": files, "frozenInputVerification": source_inputs(), "reportLinks": 0}, indent=2) + "\n")
    record = json.loads(SEAL.read_text())
    record["reportLinks"] = links()
    SEAL.write_text(json.dumps(record, indent=2) + "\n")
    verify()
elif sys.argv[1:] == ["--verify"]:
    verify()
else:
    raise SystemExit("usage: seal-evidence.py --create | --verify")
