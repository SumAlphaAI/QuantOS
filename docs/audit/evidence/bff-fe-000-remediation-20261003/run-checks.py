#!/usr/bin/env python3
"""Replay local engineering checks only; never deploys or connects a database."""

import os
import subprocess
import json
import time
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[4]
out = pathlib.Path(__file__).resolve().parent
commands = [
    ("bff-suite", ["make", "bff-contract-check"]),
    ("contract", ["pnpm", "test:contract"]),
    ("domain-sse-unit", ["pnpm", "--filter", "@sumalpha/api-client", "test"]),
    (
        "reference-provider",
        [
            "cargo",
            "test",
            "-p",
            "bff-gateway",
            "--test",
            "auth_settings_provider",
            "--test",
            "audit_export_provider",
            "--locked",
            "--offline",
        ],
    ),
    (
        "provider-http",
        [
            "node",
            "scripts/test-bff-provider-contract.mjs",
            str(out / "provider-contract.json"),
        ],
    ),
    (
        "clippy",
        [
            "cargo",
            "clippy",
            "-p",
            "bff-gateway",
            "--all-targets",
            "--locked",
            "--offline",
            "--",
            "-D",
            "warnings",
        ],
    ),
    ("fmt", ["cargo", "fmt", "--all", "--", "--check"]),
    ("lint", ["pnpm", "lint"]),
    ("typecheck", ["pnpm", "typecheck"]),
    ("web-coverage", ["pnpm", "coverage:web"]),
    ("pre01", ["pnpm", "check:pre01"]),
    ("pre01-negative", ["pnpm", "test:pre01"]),
    ("pre04", ["pnpm", "check:pre04"]),
    ("pre04-negative", ["pnpm", "test:pre04"]),
    ("pre06", ["pnpm", "check:pre06"]),
    ("pre06-negative", ["pnpm", "test:pre06"]),
    ("plans", ["pnpm", "check:development-plans"]),
    ("plans-negative", ["pnpm", "test:development-plans"]),
    ("g0", ["pnpm", "check:g0-records"]),
    ("locks", ["make", "lockfile-check"]),
    ("p0-admission", ["pnpm", "check:p0"]),
    ("staging-acceptance", ["pnpm", "check:bff-a1-acceptance"]),
]
env = os.environ.copy()
env["PATH"] = "/Users/anray/.nvm/versions/node/v24.12.0/bin:" + env["PATH"]
for key in list(env):
    if key.startswith("QUANTOS_RUN_"):
        del env[key]
requested = set(sys.argv[1:])
if requested and not requested.issubset({name for name, _ in commands}):
    raise SystemExit("Unknown check name")
records = (
    json.loads((out / "commands.json").read_text())
    if requested and (out / "commands.json").exists()
    else []
)
for name, command in commands:
    if requested and name not in requested:
        continue
    start = time.time()
    print("RUN", name, flush=True)
    result = subprocess.run(
        command,
        cwd=root,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    (out / (name + ".log")).write_text(result.stdout)
    expected = 1 if name in ["staging-acceptance", "p0-admission"] else 0
    record = {
        "name": name,
        "command": command,
        "exitCode": result.returncode,
        "expectedExitCode": expected,
        "result": "EXPECTED_NOT_ACCEPTED"
        if name in ["staging-acceptance", "p0-admission"]
        and result.returncode == expected
        else "PASS"
        if result.returncode == expected
        else "FAIL",
        "elapsedSeconds": round(time.time() - start, 2),
        "log": name + ".log",
    }
    records = [r for r in records if r["name"] != name]
    records.append(record)
    (out / "commands.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n"
    )
    print(record["result"], name, flush=True)
print(
    json.dumps(
        {
            "checks": len(records),
            "unexpectedFailures": [r["name"] for r in records if r["result"] == "FAIL"],
        }
    ),
    flush=True,
)
raise SystemExit(any(r["result"] == "FAIL" for r in records))
