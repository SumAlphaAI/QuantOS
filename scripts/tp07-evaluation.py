"""Offline evaluation of a pinned candidate. Never installs/imports/executes upstream."""

from __future__ import annotations
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tomllib

ROOT = Path(__file__).resolve().parents[1]
BASE = Path("third_party/nautilus-trader")
PIN = "fa86c6e39e8f064d5922c0ee4da5e2a9a2716408"
LICENSE = "LGPL-3.0-or-later"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def load(root, path):
    return json.loads((root / path).read_bytes())


def inventory(root=ROOT):
    packages = []
    for ecosystem, filename in [("crates.io", "Cargo.lock"), ("PyPI", "uv.lock")]:
        data = tomllib.loads((root / BASE / "source-evidence" / filename).read_text())
        for p in data["package"]:
            source = p.get("source", {})
            registry = (
                (isinstance(source, str) and source.startswith("registry+"))
                if ecosystem == "crates.io"
                else isinstance(source, dict)
                and source.get("registry") == "https://pypi.org/simple"
            )
            packages.append(
                {
                    "ecosystem": ecosystem,
                    "name": p["name"],
                    "version": p["version"],
                    "source": source,
                    "registryMatched": bool(registry),
                    "checksum": p.get("checksum"),
                    "lock": filename,
                }
            )
    return sorted(
        packages,
        key=lambda p: (
            p["ecosystem"],
            p["name"],
            p["version"],
            json.dumps(p["source"], sort_keys=True),
        ),
    )


def sbom(root=ROOT):
    baseline = load(root, BASE / "baseline.lock.json")
    packages = []
    for i, p in enumerate(inventory(root)):
        packages.append(
            {
                "SPDXID": f"SPDXRef-Package-{i}",
                "name": p["name"],
                "versionInfo": p["version"],
                "downloadLocation": "NOASSERTION",
                "filesAnalyzed": False,
                "licenseConcluded": "NOASSERTION",
                "licenseDeclared": "NOASSERTION",
                "copyrightText": "NOASSERTION",
                "comment": json.dumps(p, sort_keys=True),
            }
        )
    return {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": "TP07 pinned upstream lock inventory (not deployed runtime)",
        "documentNamespace": "https://sumalpha.invalid/spdx/tp07/" + PIN,
        "creationInfo": {
            "created": "2026-10-16T00:00:00Z",
            "creators": ["Tool: QuantOS-tp07-evaluation-v1"],
        },
        "documentDescribes": [p["SPDXID"] for p in packages],
        "packages": packages,
        "comment": baseline["sbomScope"],
    }


def queries(root=ROOT):
    return {
        "queries": [
            {
                "package": {"ecosystem": p["ecosystem"], "name": p["name"]},
                "version": p["version"],
            }
            for p in inventory(root)
            if p["registryMatched"]
        ]
    }


def assert_production_excluded(root=ROOT):
    for filename in ["Cargo.lock", "engines/uv.lock", "pnpm-lock.yaml"]:
        text = (root / filename).read_text().lower()
        assert not re.search(
            r"(?:\bnautilus[-_]|github\.com/nautechsystems/nautilus|@nautechsystems/nautilus)",
            text,
        ), filename + ": upstream runtime dependency forbidden"
    names = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=root,
        text=True,
    ).splitlines()
    for name in names:
        p = Path(name)
        if not name.startswith(
            ("crates/", "services/", "engines/", "apps/", "packages/", "tools/")
        ) or p.suffix not in {".rs", ".py", ".toml"}:
            continue
        text = (root / p).read_text()
        for line in text.splitlines():
            if line.lstrip().startswith(("#", "//")):
                continue
            assert not re.search(
                r"(?:\b(?:use|extern crate|import|from)\s+nautilus[_-]|\bnautilus_trader::|^\s*nautilus[-_][\w-]+\s*=)",
                line,
            ), name + ": upstream import/link forbidden"


def verify_git_paths(root, files):
    objects = load(root, BASE / "source-git-objects.json")
    decoded = {}
    for oid, record in objects.items():
        data = base64.b64decode(record["base64"], validate=True)
        kind = record["kind"]
        assert kind in {"commit", "tree"}
        assert (
            hashlib.sha1(
                kind.encode() + b" " + str(len(data)).encode() + b"\0" + data
            ).hexdigest()
            == oid
        )
        decoded[oid] = data
    tree = decoded[PIN].splitlines()[0].decode().removeprefix("tree ")
    for f in files:
        current = tree
        for name in Path(f["path"]).parts:
            data = decoded[current]
            entries = {}
            while data:
                end = data.index(b"\0")
                mode_name = data[:end].decode().split(" ", 1)
                entries[mode_name[1]] = data[end + 1 : end + 21].hex()
                data = data[end + 21 :]
            current = entries[name]
        assert current == f["gitBlob"], "blob not in pinned commit tree"


def verify(root=ROOT):
    if not __debug__:
        raise RuntimeError("optimized Python cannot validate evaluation evidence")
    b = load(root, BASE / "baseline.lock.json")
    assert b["task"] == "EVALUATION:TP07" and b["upstream"]["commit"] == PIN
    assert b["license"] == LICENSE
    assert b["policy"] == {
        "decision": "EVALUATION_ONLY",
        "runtimeAdmission": "DENIED",
        "productionApproved": False,
        "upstreamExecuted": False,
        "upstreamInstalled": False,
        "legalAccepted": False,
    }
    verify_git_paths(root, b["sourceFiles"])
    paths = set()
    for f in b["sourceFiles"]:
        name = f["path"]
        assert (
            name not in paths
            and not Path(name).is_absolute()
            and ".." not in Path(name).parts
        )
        paths.add(name)
        data = (root / BASE / "source-evidence" / name).read_bytes()
        assert sha(data) == f["sha256"], "source bytes changed: " + name
        assert (
            hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
            == f["gitBlob"]
        ), "Git blob changed"
    assert {"LICENSE", "Cargo.toml", "Cargo.lock", "pyproject.toml", "uv.lock"} <= paths
    for filename, table in [
        ("Cargo.toml", ("workspace", "package")),
        ("pyproject.toml", ("project",)),
    ]:
        d = tomllib.loads((root / BASE / "source-evidence" / filename).read_text())
        for key in table:
            d = d[key]
        declared = d["license"]
        assert (declared["text"] if isinstance(declared, dict) else declared) == LICENSE
    assert load(root, BASE / "sbom.spdx.json") == sbom(root), (
        "complete lock inventory differs"
    )
    assert load(root, BASE / "osv-request.json") == queries(root), (
        "advisory query inventory differs"
    )
    a = load(root, BASE / "cve-audit.json")
    assert a["runtimeAdmission"] == "DENIED" and a["vulnerabilityFree"] is False
    assert a["requestSha256"] == sha((root / BASE / "osv-request.json").read_bytes())
    assert a["lockHashes"] == {
        f: sha((root / BASE / "source-evidence" / f).read_bytes())
        for f in ["Cargo.lock", "uv.lock"]
    }
    if a["status"] == "RECORDED":
        response = (root / BASE / "osv-response.json").read_bytes()
        assert sha(response) == a["responseSha256"]
        results = json.loads(response)["results"]
        assert len(results) == len(queries(root)["queries"]) == a["queriedPackages"]
        ids = sorted({v["id"] for r in results for v in r.get("vulns", [])})
        assert ids == a["advisoryIds"]
    else:
        assert (
            a["status"] == "UNKNOWN_NETWORK"
            and a["responseSha256"] is None
            and a["queriedPackages"] == 0
            and a["error"]
        )
    cap = load(root, BASE / "capability-inventory.json")
    expected = {
        "backtest",
        "execution",
        "risk",
        "live",
        "model",
        "portfolio",
        "persistence",
    }
    assert {x["name"] for x in cap["capabilities"]} == expected
    for c in cap["capabilities"]:
        for key in [
            "input",
            "output",
            "sideEffects",
            "permissions",
            "forbidden",
            "replacement",
        ]:
            assert c[key]
        assert (
            c["evidence"] == f"crates/{c['name']}/Cargo.toml" and c["evidence"] in paths
        )
        assert c["runtimeAdmission"] == "DENIED"
    assert_production_excluded(root)
    return {
        "schema": "quantos-tp07-evaluation/v1",
        "status": "PASS",
        "upstreamCommit": PIN,
        "license": LICENSE,
        "packages": len(inventory(root)),
        "sourceFiles": len(paths),
        "capabilities": len(expected),
        "cveStatus": a["status"],
        "advisoryIds": len(a.get("advisoryIds", [])),
        "runtimeAdmission": "DENIED",
        "upstreamExecuted": False,
        "productionApproved": False,
        "formalAccepted": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--runtime", action="store_true")
    args = parser.parse_args()
    if args.runtime:
        raise SystemExit(
            "TP07 evaluation cannot grant runtime admission; X3/Beta obligations NOT_RUN"
        )
    if args.generate:
        (ROOT / BASE / "sbom.spdx.json").write_bytes(encode(sbom()))
        (ROOT / BASE / "osv-request.json").write_bytes(encode(queries()))
    else:
        result = verify()
        result["observedSourceCommit"] = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip()
        for name in ["baseline.lock.json", "sbom.spdx.json", "cve-audit.json"]:
            result[name] = sha((ROOT / BASE / name).read_bytes())
        print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
