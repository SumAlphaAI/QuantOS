"""Offline reference assessment; never grants execution or runs upstream code."""

from __future__ import annotations

import argparse
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tomllib

ROOT = Path(__file__).resolve().parents[1]
BASE = Path("third_party/nautilus-agents")
PIN = "8d79877380f8617b45dff2b8c8b3790c2f9d963a"
INTERFACES = {
    "observations",
    "proposals",
    "transport",
    "advisory",
    "retention",
    "field-governance",
}
DECISIONS = [
    "DIFFERENT",
    "DIFFERENT",
    "DIFFERENT_LAYER",
    "DESIGN_REFERENCE",
    "CANDIDATE_ONLY",
    "CANDIDATE_ONLY",
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(root, path):
    return json.loads((root / path).read_bytes())


def pointer(root, p):
    path = Path(p["path"])
    assert not path.is_absolute() and ".." not in path.parts, "unconfined evidence"
    assert (root / path).resolve().is_relative_to(root.resolve()), (
        "symlink evidence escape"
    )
    assert p["symbol"] and p["symbol"] in (root / path).read_text(), (
        "missing source anchor"
    )


def verify_git_paths(root, files):
    decoded = {}
    for oid, r in load(root, BASE / "source-git-objects.json").items():
        data = base64.b64decode(r["base64"], validate=True)
        assert r["kind"] in {"commit", "tree"}
        assert (
            hashlib.sha1(
                r["kind"].encode() + b" " + str(len(data)).encode() + b"\0" + data
            ).hexdigest()
            == oid
        )
        decoded[oid] = data
    tree = decoded[PIN].splitlines()[0].decode().removeprefix("tree ")
    for f in files:
        current = tree
        for name in Path(f["path"]).parts:
            data, entries = decoded[current], {}
            while data:
                end = data.index(b"\0")
                entries[data[:end].decode().split(" ", 1)[1]] = data[
                    end + 1 : end + 21
                ].hex()
                data = data[end + 21 :]
            current = entries[name]
        assert current == f["gitBlob"], "source not in pinned commit tree"


def assert_production_excluded(root):
    spec = importlib.util.spec_from_file_location(
        "tp07_owned_evaluation", ROOT / "scripts/tp07-evaluation.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.assert_production_excluded(root)


def verify(root=ROOT):
    if not __debug__:
        raise RuntimeError("optimized Python cannot validate assessment")
    b = load(root, BASE / "baseline.lock.json")
    assert b["upstream"]["commit"] == PIN
    assert b["license"]["spdx"] == b["license"]["concluded"] == "LGPL-3.0-or-later"
    assert (
        b["policy"]["readOnlyReference"] is True
        and b["policy"]["decision"] == "reference_only"
    )
    assert b["policy"]["runtimeAdmission"] == "DENIED"
    assert (
        b["policy"]["productionApproved"] is False
        and b["policy"]["formalAccepted"] is False
    )
    assert (
        b["provenance"]["upstreamExecuted"]
        is b["provenance"]["upstreamInstalled"]
        is False
    )
    assert b["provenance"]["authenticatedRemoteSignature"] == "NOT_RUN"
    assert b["cveAudit"]["status"] == "not_run", "no TP12 vulnerability-free claim"
    files = b["sourceFiles"]
    assert len(files) == len({f["path"] for f in files}) == 12
    verify_git_paths(root, files)
    for f in files:
        path = Path(f["path"])
        assert not path.is_absolute() and ".." not in path.parts
        data = (root / BASE / "source-evidence" / path).read_bytes()
        assert sha(data) == f["sha256"], "source byte tampering"
        assert (
            hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
            == f["gitBlob"]
        )
    by_name = {f["path"]: f for f in files}
    for entry in [
        b["license"]["licenseFile"],
        b["dependencyDigests"]["projectDescriptor"],
        b["dependencyDigests"]["cargoLock"],
    ]:
        assert entry["sha256"] == by_name[entry["path"]]["sha256"]
    cargo = tomllib.loads((root / BASE / "source-evidence/Cargo.toml").read_text())
    assert (
        cargo["package"]["version"] == "0.2.0"
        and cargo["package"]["license"] == "LGPL-3.0-or-later"
    )
    rules = load(root, BASE / "no-coupling-rules.json")
    assert rules["upstreamCommit"] == PIN
    assert (
        "never connects to a venue" in rules["boundaryStatement"]
        and "does not change" in rules["boundaryStatement"]
    )
    assert [r["id"] for r in rules["rules"]] == [f"NC-0{i}" for i in range(1, 8)]
    for r in rules["rules"]:
        assert r["rule"] and r["enforcement"] and r["evidence"]
        assert (
            r["assessment"] == "LOCAL_CONTROL_MAPPING_ONLY"
            and r["targetStatus"] == "NOT_RUN"
        )
        for p in r["evidence"] + [r["behavioralEvidence"]]:
            pointer(root, p)
    matrix = load(root, BASE / "boundary-assessment.json")
    assert matrix["schema"] == "quantos-tp12-boundary-assessment/v1"
    assert matrix["upstreamCommit"] == PIN and matrix["decision"] == "reference_only"
    assert matrix["basedOn"] == {
        "nodeId": "EVALUATION:TP07",
        "commit": "fa86c6e39e8f064d5922c0ee4da5e2a9a2716408",
    }
    tp07 = load(root, Path("third_party/nautilus-trader/baseline.lock.json"))
    assert (
        tp07["upstream"]["commit"] == matrix["basedOn"]["commit"]
        and tp07["policy"]["runtimeAdmission"] == "DENIED"
    )
    assert (
        matrix["runtimeAdmission"] == "DENIED"
        and matrix["upstreamExecuted"] is matrix["formalAccepted"] is False
    )
    assert (
        matrix["securityAudit"] == "NOT_RUN"
        and matrix["fullReview"] == "CORE:TP12/X3-SERVICE"
    )
    assert {x["id"] for x in matrix["interfaces"]} == INTERFACES and len(
        matrix["interfaces"]
    ) == 6
    assert [x["decision"] for x in matrix["interfaces"]] == DECISIONS
    for x in matrix["interfaces"]:
        assert x["runtimeAdmission"] == "DENIED" and x["reason"]
        assert x["upstream"]["path"] in by_name
        pointer(root / BASE / "source-evidence", x["upstream"])
        pointer(root, x["owned"])
    assert [t["id"] for t in matrix["threats"]] == [f"T{i}" for i in range(1, 9)]
    assert {r for t in matrix["threats"] for r in t["rules"]} == {
        r["id"] for r in rules["rules"]
    }
    for t in matrix["threats"]:
        assert t["rules"] and set(t["rules"]) <= {r["id"] for r in rules["rules"]}
        assert t["prerequisites"] and t["impact"] and t["scenario"]
        assert (
            t["disposition"] == "DESIGN_HYPOTHESIS"
            and t["targetStatus"] == "NOT_RUN"
            and t["residualRisk"] == "UNASSESSED"
        )
    assert_production_excluded(root)
    return {
        "schema": "quantos-tp12-evaluation/v1",
        "status": "PASS",
        "upstreamCommit": PIN,
        "license": "LGPL-3.0-or-later",
        "sourceFiles": 12,
        "rules": 7,
        "interfaces": 6,
        "threats": 8,
        "decision": "reference_only",
        "runtimeAdmission": "DENIED",
        "upstreamExecuted": False,
        "formalAccepted": False,
        "securityAudit": "NOT_RUN",
        "cveAudit": "NOT_RUN",
        **{
            name: sha((root / BASE / name).read_bytes())
            for name in [
                "baseline.lock.json",
                "no-coupling-rules.json",
                "boundary-assessment.json",
            ]
        },
        "tp07BaselineSha256": sha(
            (root / "third_party/nautilus-trader/baseline.lock.json").read_bytes()
        ),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime", action="store_true")
    args = parser.parse_args()
    if args.runtime:
        raise SystemExit(
            "TP12 evaluation cannot grant runtime admission; full CORE:TP12 review remains X3"
        )
    r = verify()
    r["observedSourceCommit"] = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    print(json.dumps(r, sort_keys=True))


if __name__ == "__main__":
    main()
