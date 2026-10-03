#!/usr/bin/env python3
"""Validate A1 review-stage scheduling only; no DB or staging execution."""

import os
import json
import subprocess
import pathlib
import time

root = pathlib.Path(__file__).resolve().parents[4]
out = pathlib.Path(__file__).resolve().parent
env = os.environ.copy()
env["PATH"] = "/Users/anray/.nvm/versions/node/v24.12.0/bin:" + env["PATH"]
commands = [
    ("development", ["pnpm", "check:bff-a1-development"], 0),
    ("final-review", ["pnpm", "check:bff-a1-final-review"], 1),
    ("legacy-final-review", ["pnpm", "check:bff-a1-acceptance"], 1),
    (
        "invalid-stage",
        ["node", "scripts/check-bff-a1-acceptance.mjs", "--stage", "unknown"],
        1,
    ),
    ("bff-suite", ["make", "bff-contract-check"], 0),
    ("plans", ["pnpm", "check:development-plans"], 0),
    ("plans-negative", ["pnpm", "test:development-plans"], 0),
    ("pre06", ["pnpm", "check:pre06"], 0),
    ("pre06-negative", ["pnpm", "test:pre06"], 0),
    ("g0", ["pnpm", "check:g0-records"], 0),
]
records = []
for name, command, expected in commands:
    start = time.time()
    result = subprocess.run(
        command,
        cwd=root,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    (out / (name + ".log")).write_text(result.stdout)
    status = (
        "PASS"
        if result.returncode == 0 == expected
        else "EXPECTED_REFUSAL"
        if result.returncode == expected
        else "FAIL"
    )
    if name == "development":
        value = json.loads(result.stdout[result.stdout.index("{") :])
        assert (
            value["stagingStatus"] == "DEFERRED_TO_FINAL_REVIEW"
            and value["formalAccepted"] is False
        )
    if name in ["final-review", "legacy-final-review"]:
        value = json.loads(
            result.stdout[result.stdout.index("{") : result.stdout.rindex("}") + 1]
        )
        assert (
            value["stage"] == "final-review"
            and value["status"] == "NOT_ACCEPTED"
            and value["formalAccepted"] is False
        )
    records.append(
        {
            "name": name,
            "command": command,
            "exitCode": result.returncode,
            "expectedExitCode": expected,
            "result": status,
            "elapsedSeconds": round(time.time() - start, 2),
            "log": name + ".log",
        }
    )
    print(status, name, flush=True)
    (out / "commands.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n"
    )
raise SystemExit(any(r["result"] == "FAIL" for r in records))
