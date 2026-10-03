"""Replay repository-only checks for the A1 audit. Does not connect to a database."""
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
ENV = dict(os.environ)
ENV["PATH"] = "/Users/anray/.nvm/versions/node/v24.12.0/bin:" + ENV["PATH"]
CHECKS = [
    ("lockfiles", ["bash", "scripts/check-lockfiles.sh"]),
    ("openapi", ["pnpm", "check:bff-openapi"]),
    ("generated", ["pnpm", "check:bff-generated"]),
    ("coverage", ["pnpm", "check:bff-contract-coverage"]),
    ("a1-gate", ["pnpm", "check:bff-fe-000"]),
    ("a1-negative", ["pnpm", "test:bff-fe-000"]),
    ("contract", ["pnpm", "test:contract"]),
    ("api-lint", ["pnpm", "--filter", "@sumalpha/api-client", "lint"]),
    ("api-typecheck", ["pnpm", "--filter", "@sumalpha/api-client", "typecheck"]),
    ("api-test", ["pnpm", "--filter", "@sumalpha/api-client", "test"]),
    ("pre01", ["pnpm", "check:pre01"]),
    ("pre04", ["pnpm", "check:pre04"]),
    ("pre06", ["pnpm", "check:pre06"]),
    ("plan", ["pnpm", "check:development-plans"]),
    ("g0-governance", ["pnpm", "check:g0-records"]),
]

if __name__ == "__main__":
    results = []
    for name, command in CHECKS:
        start = time.monotonic()
        try:
            result = subprocess.run(command, cwd=ROOT, env=ENV, capture_output=True, text=True, timeout=180)
            code, output = result.returncode, result.stdout + result.stderr
        except subprocess.TimeoutExpired as error:
            code, output = 124, str(error)
        (OUT / (name + ".log")).write_text(output)
        results.append({"name": name, "command": command, "exit_code": code,
                        "seconds": round(time.monotonic()-start, 3), "log": name + ".log"})
        print(name, code, flush=True)
    (OUT / "commands.json").write_text(json.dumps(results, indent=2) + "\n")
