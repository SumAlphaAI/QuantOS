from pathlib import Path
import os
import json
import time
import subprocess
import io
import tarfile
import tempfile

root = Path(__file__).resolve().parents[4]
evidence = root / "docs/audit/evidence/pre03-review-20261002"
source = "695c5f021aaa702f94fb82b1a17314ba8df182bd"
workspace = Path(tempfile.mkdtemp(prefix="quantos-pre03-clean-", dir="/private/tmp"))
with tarfile.open(
    fileobj=io.BytesIO(subprocess.check_output(["git", "archive", source], cwd=root))
) as archive:
    archive.extractall(workspace, filter="data")
(evidence / "workspace.json").write_text(
    json.dumps(
        {
            "source_sha": source,
            "workspace": str(workspace),
            "cache": "host pnpm store reused; clean tracked archive",
        },
        indent=2,
    )
    + "\n"
)
root = Path(__file__).resolve().parents[4]
evidence = root / "docs/audit/evidence/pre03-review-20261002"
workspace = Path(json.loads((evidence / "workspace.json").read_text())["workspace"])
env = os.environ.copy()
env["PATH"] = "/Users/anray/.nvm/versions/node/v24.12.0/bin:" + env["PATH"]
env["NEXT_TELEMETRY_DISABLED"] = "1"
env["STORYBOOK_DISABLE_TELEMETRY"] = "1"
env["GITHUB_SHA"] = json.loads((evidence / "workspace.json").read_text())["source_sha"]
for line in (workspace / "env/local-mock.env.example").read_text().splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k] = v
commands = [
    ("bootstrap", ["pnpm", "install", "--frozen-lockfile", "--offline"]),
    ("lint", ["pnpm", "lint"]),
    ("typecheck", ["pnpm", "typecheck"]),
    ("test", ["pnpm", "test"]),
    ("build", ["pnpm", "build"]),
    ("storybook", ["pnpm", "--filter", "@sumalpha/ui", "build-storybook"]),
    ("pre03-negative", ["pnpm", "test:pre03"]),
    ("pre03-web", ["pnpm", "check:pre03:web"]),
    ("pre02", ["pnpm", "check:pre02"]),
    ("plan", ["pnpm", "check:development-plans"]),
]
results = []
start = time.monotonic()
for name, cmd in commands:
    t = time.monotonic()
    with (evidence / (name + ".log")).open("w") as out:
        try:
            r = subprocess.run(
                cmd,
                cwd=workspace,
                env=env,
                stdout=out,
                stderr=subprocess.STDOUT,
                timeout=600,
            )
            code = r.returncode
        except subprocess.TimeoutExpired:
            code = 124
    results.append(
        {
            "name": name,
            "command": cmd,
            "exit_code": code,
            "seconds": round(time.monotonic() - t, 3),
            "log": name + ".log",
        }
    )
    (evidence / "clean-run.json").write_text(
        json.dumps(
            {
                "workspace": str(workspace),
                "env_profile": "env/local-mock.env.example injected into process; GITHUB_SHA frozen to source SHA",
                "seconds": round(time.monotonic() - start, 3),
                "results": results,
            },
            indent=2,
        )
        + "\n"
    )
    print(name, code, results[-1]["seconds"], flush=True)
    if name == "bootstrap" and code:
        break
