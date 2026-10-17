"""TP12 current-source boundary review. Reads reference bytes; never imports upstream."""

from __future__ import annotations

import argparse
import ast
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = Path("third_party/nautilus-agents")
SPEC = importlib.util.spec_from_file_location(
    "tp12_reference", ROOT / "scripts/tp12-evaluation.py"
)
REFERENCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REFERENCE)
PRODUCTION = (
    "crates/",
    "services/",
    "engines/",
    "apps/",
    "packages/",
    "tools/",
    "bff/",
)
EXTENSIONS = {".rs", ".py", ".toml", ".json", ".ts", ".tsx", ".js", ".mjs", ".cjs"}
UPSTREAM = re.compile(r"nautilus[-_](?:agents|trader)|nautechsystems/nautilus", re.I)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def runtime_inputs(root=ROOT):
    names = (
        subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
            cwd=root,
        )
        .decode()
        .split("\0")
    )
    locks = {
        "Cargo.toml",
        "Cargo.lock",
        "engines/uv.lock",
        "pnpm-lock.yaml",
        "package.json",
    }
    return sorted(
        {
            n
            for n in names
            if n
            and (
                n in locks
                or (
                    n.startswith(PRODUCTION)
                    and Path(n).suffix in EXTENSIONS
                    and not {"tests", "__pycache__"}.intersection(Path(n).parts)
                    and not re.search(r"(?:\.test\.|\.spec\.|test_)", Path(n).name)
                )
            )
        }
    )


def exclude_runtime(root=ROOT):
    """Static import/dependency checks; deliberately not an OS egress sandbox."""
    inputs = runtime_inputs(root)
    for name in inputs:
        path = root / name
        require(
            path.resolve().is_relative_to(root.resolve()),
            "runtime symlink escape: " + name,
        )
        text = path.read_text()
        if path.suffix in {".toml", ".json"} or name.endswith((".lock", "lock.yaml")):
            # Includes renamed dependencies, workspace overrides, extras and URL sources.
            require(not UPSTREAM.search(text), "runtime dependency/reference: " + name)
        elif path.suffix == ".py":
            tree = ast.parse(text, filename=name)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    values = [a.name for a in node.names]
                elif isinstance(node, ast.ImportFrom):
                    values = [node.module or ""]
                elif isinstance(node, ast.Call):
                    values = [
                        a.value
                        for a in node.args
                        if isinstance(a, ast.Constant) and isinstance(a.value, str)
                    ]
                else:
                    continue
                require(
                    not any(UPSTREAM.search(v) for v in values),
                    "upstream import/load: " + name,
                )
        else:
            require(
                not re.search(
                    r"\b(?:nautilus_agents|nautilus_trader)\s*::|"
                    r"\b(?:use|extern\s+crate)\s+(?:nautilus_agents|nautilus_trader)\b|"
                    r"(?:from\s*|require\s*\(|import\s*\(?\s*)\s*['\"][^'\"]*(?:nautilus[-_]|nautechsystems/nautilus)",
                    text,
                    re.I,
                ),
                "upstream import/link: " + name,
            )
    return [
        {
            "path": n,
            "sha256": "sha256:" + hashlib.sha256((root / n).read_bytes()).hexdigest(),
        }
        for n in inputs
    ]


def verify(root=ROOT):
    require(__debug__, "optimized Python cannot validate reference evidence")
    reference = REFERENCE.verify(root)
    review = json.loads((root / BASE / "x3-boundary-review.json").read_text())
    require(review["schema"] == "quantos-tp12-x3-boundary-review/v1", "review schema")
    require(review["upstreamCommit"] == REFERENCE.PIN, "review pin")
    require(review["decision"] == "reference_only", "reference decision")
    require(review["runtimeAdmission"] == "DENIED", "runtime admission")
    require(
        review["phases"]
        == {
            "functionImplementation": "IMPLEMENTED",
            "businessIntegration": "NOT_RUN",
            "releaseAcceptance": "NOT_RUN",
            "postTp07IntegrationFullReview": "NOT_RUN",
        },
        "phase promotion",
    )
    require(
        review["prerequisites"] == ["CORE:F07", "CORE:TP07", "CORE-GATE:S2-SERVICE"],
        "prerequisites",
    )
    require(
        review["upstreamExecuted"] is review["formalAccepted"] is False,
        "acceptance promotion",
    )
    require(
        [r["id"] for r in review["rules"]] == [f"NC-0{i}" for i in range(1, 8)],
        "rule set",
    )
    for rule in review["rules"]:
        require(rule["prohibition"] and rule["residualRisk"], "rule explanation")
        require(
            rule["evidenceKind"] == "CURRENT_SOURCE_AND_SCOPED_TEST", "evidence kind"
        )
        require(rule["targetStatus"] == "NOT_RUN", "target promotion")
        for p in rule["controls"] + rule["tests"]:
            REFERENCE.pointer(root, p)
    require(
        [i["id"] for i in review["interfaces"]]
        == [
            i["id"]
            for i in REFERENCE.load(root, BASE / "boundary-assessment.json")[
                "interfaces"
            ]
        ],
        "interface set",
    )
    for surface in review["interfaces"]:
        require(
            surface["wireCompatible"] is False
            and surface["runtimeAdoption"] == "DENIED",
            "wire or adoption promotion",
        )
        require(
            surface["difference"] and surface["authorityOwner"] and surface["openWork"],
            "interface semantics",
        )
        REFERENCE.pointer(root, surface["owned"])
        REFERENCE.pointer(root / BASE / "source-evidence", surface["upstream"])
    require(
        [t["id"] for t in review["threats"]] == [f"T{i}" for i in range(1, 9)],
        "threat set",
    )
    for threat in review["threats"]:
        require(
            threat["rules"]
            and set(threat["rules"]) <= {r["id"] for r in review["rules"]},
            "threat rule mapping",
        )
        require(
            threat["scenario"] and threat["currentControl"] and threat["residualRisk"],
            "threat explanation",
        )
        require(
            threat["disposition"] == "DESIGN_HYPOTHESIS"
            and threat["targetStatus"] == "NOT_RUN",
            "threat promotion",
        )
    runtime = exclude_runtime(root)
    return {
        "schema": "quantos-tp12-current-review/v1",
        "status": "PASS",
        "rules": 7,
        "interfaces": 6,
        "threats": 8,
        "reference": reference,
        "runtimeInputs": runtime,
        "runtimeDependency": "ABSENT_STATIC_CHECK",
        "agentVenueAuthority": "NOT_GRANTED",
        "runtimeAdmission": "DENIED",
        "postTp07IntegrationFullReview": "NOT_RUN",
        "formalAccepted": False,
        "reviewSha256": "sha256:"
        + hashlib.sha256(
            (root / BASE / "x3-boundary-review.json").read_bytes()
        ).hexdigest(),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime", action="store_true")
    parser.add_argument("--inputs", action="store_true")
    args = parser.parse_args()
    if args.runtime:
        parser.exit(
            2,
            "TP12 reference-only: runtime admission DENIED; target/full review NOT_RUN\n",
        )
    if args.inputs:
        print(json.dumps(runtime_inputs()))
        return
    result = verify()
    result["observedSourceCommit"] = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
