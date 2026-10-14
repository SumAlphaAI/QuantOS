"""Offline upstream patch check against pinned bytes; never edits the submodule."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PATCH_DIR = ROOT / "forks/vibe-trading/upstream-prs/20261015-atomic-replay-handoff"


def verify(output: Path) -> dict:
    manifest = json.loads((PATCH_DIR / "manifest.json").read_bytes())
    assert manifest["schema"] == "quantos-upstream-review-patch/v1"
    assert manifest["status"] == "DRAFT_NOT_SUBMITTED"
    assert manifest["upstreamPrUrl"] is None
    assert (
        manifest["externalPublished"] is False
        and manifest["productionAuthorization"] is False
    )
    assert manifest["baseCommit"] == "c33133f4fd5e978d21d2a61fdd8787fb352b4687"
    assert manifest["sourcePath"] == "agent/src/session/events.py"
    assert manifest["changedPaths"] == [
        "agent/src/session/events.py",
        "tests/test_event_bus_replay_handoff.py",
    ]
    assert manifest["patch"] == "0001-atomic-replay-handoff.patch"
    source = subprocess.check_output(
        [
            "git",
            "-C",
            str(ROOT / "third_party/vibe-trading/upstream-src"),
            "show",
            manifest["baseCommit"] + ":" + manifest["sourcePath"],
        ]
    )
    patch = (PATCH_DIR / manifest["patch"]).read_bytes()
    assert hashlib.sha256(source).hexdigest() == manifest["sourceSha256"]
    assert hashlib.sha256(patch).hexdigest() == manifest["patchSha256"]
    output.mkdir(parents=True, exist_ok=True)
    records = []
    with tempfile.TemporaryDirectory(prefix="quantos-tp01-g-patch-") as scratch:
        directory = Path(scratch)
        target = directory / manifest["sourcePath"]
        target.parent.mkdir(parents=True)
        target.write_bytes(source)

        def run(name, command, expected):
            result = subprocess.run(
                command, cwd=directory, capture_output=True, text=True, timeout=20
            )
            log = result.stdout + result.stderr
            (output / (name + ".log")).write_text(log)
            assert result.returncode == expected, (name, result.returncode, log)
            records.append(
                {
                    "id": name,
                    "command": command,
                    "exitCode": result.returncode,
                    "expectedExitCode": expected,
                    "status": "PASS",
                    "log": name + ".log",
                    "logSha256": hashlib.sha256(log.encode()).hexdigest(),
                }
            )
            return log

        run(
            "apply-check",
            ["git", "apply", "--check", str(PATCH_DIR / manifest["patch"])],
            0,
        )
        run("apply", ["git", "apply", str(PATCH_DIR / manifest["patch"])], 0)
        # Run the exact regression against the unmodified pinned implementation first.
        fixed = target.read_bytes()
        target.write_bytes(source)
        (output / "pinned-source.py").write_bytes(source)
        (output / "patched-source.py").write_bytes(fixed)
        (output / "regression.py").write_bytes(
            (directory / "tests/test_event_bus_replay_handoff.py").read_bytes()
        )
        command = [
            sys.executable,
            "-B",
            "-m",
            "unittest",
            "discover",
            "-s",
            "tests",
            "-p",
            "test_event_bus_replay_handoff.py",
            "-v",
        ]
        before = run("baseline-regression", command, 1)
        assert "Ran 4 tests" in before and "FAILED (failures=2)" in before
        target.write_bytes(fixed)
        after = run("patched-regression", command, 0)
        assert "Ran 4 tests" in after and "\nOK\n" in after
    result = {
        "schema": "quantos-upstream-patch-check/v1",
        "status": "PASS",
        "baselineCommit": manifest["baseCommit"],
        "sourceSha256": manifest["sourceSha256"],
        "patchSha256": manifest["patchSha256"],
        "regressionTests": 4,
        "baselineExpectedFailures": 2,
        "upstreamPrUrl": None,
        "externalPublished": False,
        "productionAuthorization": False,
        "formalAccepted": False,
        "records": records,
    }
    (output / "patch-check.json").write_text(json.dumps(result, indent=2) + "\n")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    verify(args.output_dir.resolve())
    print(
        "TP01-G_UPSTREAM_PATCH PASS tests=4 baseline_expected_failures=2 externalPublished=false"
    )
