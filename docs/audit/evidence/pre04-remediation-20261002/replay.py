from pathlib import Path
import subprocess
import os
import time
import json
import io
import tarfile
import shutil
import tempfile

root = Path(__file__).resolve().parents[4]
folder = Path(__file__).parent
base = subprocess.check_output(
    ["git", "rev-parse", "HEAD"], cwd=root, text=True
).strip()
workspace = Path(tempfile.mkdtemp(prefix="quantos-pre04-remediation-"))
with tarfile.open(
    fileobj=io.BytesIO(subprocess.check_output(["git", "archive", base], cwd=root))
) as archive:
    archive.extractall(workspace, filter="data")
changed = set(
    subprocess.check_output(
        ["git", "diff", "HEAD", "--name-only"], cwd=root, text=True
    ).splitlines()
)
changed.update(
    subprocess.check_output(
        ["git", "ls-files", "--others", "--exclude-standard"], cwd=root, text=True
    ).splitlines()
)
for relative in changed:
    source = root / relative
    target = workspace / relative
    if source.is_file():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    elif target.exists():
        target.unlink()
env = os.environ.copy()
env["PATH"] = "/Users/anray/.nvm/versions/node/v24.12.0/bin:" + env["PATH"]
env["NEXT_TELEMETRY_DISABLED"] = "1"
commands = [
    ("bootstrap", ["pnpm", "install", "--frozen-lockfile", "--offline"]),
    ("pre04", ["pnpm", "check:pre04"]),
    ("pre04-negative", ["pnpm", "test:pre04"]),
    ("pre01", ["pnpm", "check:pre01"]),
    ("pre01-negative", ["pnpm", "test:pre01"]),
    ("plans", ["pnpm", "check:development-plans"]),
    ("plan-negative", ["pnpm", "test:development-plans"]),
    ("openapi", ["pnpm", "check:bff-openapi"]),
    ("generated", ["pnpm", "check:bff-generated"]),
    ("coverage", ["pnpm", "check:bff-contract-coverage"]),
    ("pre06", ["pnpm", "check:pre06"]),
    ("contract", ["pnpm", "test:contract"]),
    ("bff000", ["pnpm", "check:bff-fe-000"]),
    ("bff000-negative", ["pnpm", "test:bff-fe-000"]),
    ("bff001", ["pnpm", "check:bff-fe-001"]),
    ("bff001-negative", ["pnpm", "test:bff-fe-001"]),
    ("bff007", ["pnpm", "check:bff-fe-007"]),
    ("bff007-negative", ["pnpm", "test:bff-fe-007"]),
    ("lint", ["pnpm", "lint"]),
    ("typecheck", ["pnpm", "typecheck"]),
    ("unit", ["pnpm", "test"]),
]
results = []
for name, command in commands:
    start = time.monotonic()
    with (folder / (name + ".log")).open("w") as out:
        try:
            code = subprocess.run(
                command,
                cwd=workspace,
                env=env,
                stdout=out,
                stderr=subprocess.STDOUT,
                timeout=180,
            ).returncode
        except subprocess.TimeoutExpired:
            code = 124
    results.append(
        {
            "name": name,
            "command": command,
            "exit_code": code,
            "seconds": round(time.monotonic() - start, 3),
            "log": name + ".log",
        }
    )
    (folder / "commands.json").write_text(
        json.dumps(
            {
                "baseline": base,
                "workspace": str(workspace),
                "overlay_files": sorted(changed),
                "scope": "fresh source and installed dependencies; existing offline download store; no build/database/target operations",
                "results": results,
            },
            indent=2,
        )
        + "\n"
    )
    print(name, code, flush=True)
    if code:
        raise SystemExit("validation failed; inspect commands.json")
print("all 21 commands PASS", flush=True)
