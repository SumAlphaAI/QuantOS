"""Run the public Rust schema validators without modifying product source."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys
import tempfile

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[3]
out = (ROOT / sys.argv[1]).resolve()
assert out.is_relative_to(BASE) and not out.exists()
out.mkdir()
build_command = ["cargo", "build", "--locked", "--offline", "-p", "quantos-runtime", "--message-format=json"]
built = subprocess.run(build_command, cwd=ROOT, capture_output=True, text=True)
(out / "build.log").write_text(built.stderr)
assert built.returncode == 0
artifacts = [json.loads(line) for line in built.stdout.splitlines() if line.startswith("{")]


def library(name):
    records = [r for r in artifacts if r.get("reason") == "compiler-artifact" and r["target"]["name"] == name]
    return next(f for f in records[-1]["filenames"] if f.endswith(".rlib"))


native = sorted({p for r in artifacts if r.get("reason") == "build-script-executed" for p in r.get("linked_paths", [])})
with tempfile.TemporaryDirectory(prefix="quantos-r04-contract-") as temp:
    binary = str(Path(temp) / "probe")
    command = ["rustc", "--edition=2024", str(BASE / "runtime-contract-probe.rs"),
               "--extern", "quantos_runtime=" + library("quantos_runtime"),
               "--extern", "serde_json=" + library("serde_json"),
               "-L", "dependency=" + str(ROOT / "target/debug/deps"),
               *[arg for path in native for arg in ["-L", path]], "-o", binary]
    compiled = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    (out / "compile.log").write_text(compiled.stdout + compiled.stderr)
    assert compiled.returncode == 0
    executed = subprocess.run([binary, str(BASE / "attempt-02/signal-matrix.json"), str(BASE / "attempt-02/proposal-matrix.json")], capture_output=True, text=True)
    (out / "probe.log").write_text(executed.stdout + executed.stderr)
    assert executed.returncode == 0
    result = json.loads(executed.stdout)
    (out / "result.json").write_text(json.dumps(result, indent=2) + "\n")


def hashed(path):
    return {"path": str(path.relative_to(ROOT)), "sha256": "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()}


receipt = {"schema": "quantos-r04-contract-probe-receipt/v1", "observedSourceCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
           "executedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "executionStatus": "PASS", "requirementStatus": "GAPS_FOUND", "formalAccepted": False, "databaseExecution": False,
           "buildCommand": build_command, "compileCommand": command, "probeExitCode": executed.returncode,
           "files": [hashed(p) for p in [Path(__file__).resolve(), BASE / "runtime-contract-probe.rs", BASE / "attempt-02/manifest.json", ROOT / "crates/quantos-runtime/src/signal_proposal.rs", ROOT / "Cargo.lock", out / "build.log", out / "compile.log", out / "probe.log", out / "result.json"]]}
(out / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(result, indent=2))
