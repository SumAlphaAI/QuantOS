"""F01 audit probes. All mutations and fake builds run in temporary directories.
Run: python3 docs/audit/evidence/F01-2026-09-17/probes.py
These probe validator behavior, NOT real build reproducibility.
"""

import os
import pathlib
import subprocess
import tempfile
import json

ROOT = pathlib.Path(__file__).resolve().parents[4]
BASE_COMMIT = "a44220d26ffa9fa7ae5efd0e8e2c56e60eebd183"


def baseline(name):
    return subprocess.check_output(
        ["git", "show", f"{BASE_COMMIT}:scripts/{name}"], cwd=ROOT, text=True
    )


results = []
with tempfile.TemporaryDirectory(prefix="quantos-f01-probes-") as td:
    root = pathlib.Path(td)
    locks = root / "locks"
    original_lock_gate = root / "check-lockfiles.sh"
    original_lock_gate.write_text(baseline("check-lockfiles.sh"))
    for f in [
        "Cargo.lock",
        "buf.lock",
        "pnpm-lock.yaml",
        "engines/uv.lock",
        "apps/terminal-desktop/src-tauri/Cargo.lock",
    ]:
        p = locks / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("not a lockfile\n")
    p = subprocess.run(
        ["bash", str(original_lock_gate)],
        env={**os.environ, "QUANTOS_GATE_ROOT": str(locks)},
        capture_output=True,
        text=True,
    )
    results.append(
        {
            "probe": "invalid nonempty lockfiles",
            "expected": "reject",
            "exitCode": p.returncode,
            "output": p.stdout.strip(),
        }
    )
    repo = root / "repo"
    (repo / "scripts").mkdir(parents=True)
    (repo / "scripts/verify-reproducible-builds.mjs").write_text(
        baseline("verify-reproducible-builds.mjs")
    )
    binpath = root / "bin"
    binpath.mkdir()
    fake = """#!/usr/bin/env python3
import os,pathlib,sys
name=pathlib.Path(sys.argv[0]).name
if name=='git': print('abc123' if 'rev-parse' in sys.argv else '1700000000')
if name=='cargo':
 p=pathlib.Path(os.environ['CARGO_TARGET_DIR'])/'release';p.mkdir(parents=True)
 for n in ['execution-gateway','market-ingestor','portfolio-rebuild','replay-cli','runtime-gateway','bff-gateway','capacity-monitor']:
  (p/n).write_text(os.environ['CARGO_TARGET_DIR'] if n in ['bff-gateway','capacity-monitor'] else 'fixed')
if name=='uv':
 p=pathlib.Path(sys.argv[sys.argv.index('--out-dir')+1]);p.mkdir();(p/'fixture.whl').write_text('fixed')
# pnpm intentionally does not build anything: pre-existing web outputs remain.
"""
    for n in ["git", "cargo", "pnpm", "uv"]:
        p = binpath / n
        p.write_text(fake)
        p.chmod(0o755)
    for d in ["apps/terminal-desktop/dist", "apps/terminal/out", "apps/website/out"] + [
        "packages/" + n + "/dist"
        for n in ["api-client", "config", "domain-ui", "platform", "ui"]
    ]:
        p = repo / d
        p.mkdir(parents=True)
        (p / "stale.js").write_text("old web output")
    for runs in [3, 1]:
        env = {k: v for k, v in os.environ.items() if k in ["PATH", "HOME", "TMPDIR"]}
        env["PATH"] = str(binpath) + ":" + env["PATH"]
        p = subprocess.run(
            [
                "node",
                str(repo / "scripts/verify-reproducible-builds.mjs"),
                "--runs",
                str(runs),
            ],
            env=env,
            capture_output=True,
            text=True,
        )
        receipt = json.loads(
            (repo / "artifacts/reproducibility/f01-build-digests.json").read_text()
        )
        results.append(
            {
                "probe": f"{runs} mock build(s), varying omitted binaries, stale web output",
                "expected": "reject",
                "exitCode": p.returncode,
                "runCount": receipt["runCount"],
                "reproducible": receipt["reproducible"],
                "hashedRust": [f["path"] for f in receipt["runs"][0]["rust"]["files"]],
            }
        )
print(json.dumps({"kind": "SOURCE_MOCK_NEGATIVE_PROBES", "results": results}, indent=2))
