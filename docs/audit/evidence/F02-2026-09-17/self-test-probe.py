"""Verify whether F02 self-tests distinguish rejection from unavailable tooling."""

from pathlib import Path
import tempfile
import subprocess
import shutil
import json

r = Path.cwd()
with tempfile.TemporaryDirectory(prefix="f02-self-test-") as td:
    p = Path(td)
    (p / "scripts").mkdir()
    (p / "node_modules/.bin").mkdir(parents=True)
    for name in [
        "test-quality-gates.mjs",
        "db-cli.cjs",
        "check-lockfiles.sh",
        "check-proto.sh",
        "check-migration-filenames.sh",
        "check-rls-baseline.sh",
        "check-secrets.mjs",
    ]:
        shutil.copy(r / "scripts" / name, p / "scripts")
    for name in ["buf.yaml", "buf.gen.yaml"]:
        shutil.copy(r / name, p)
    shutil.copytree(r / "proto", p / "proto")
    shutil.copytree(r / "supabase/migrations", p / "supabase/migrations")
    (p / "node_modules/pg").symlink_to(r / "node_modules/pg", target_is_directory=True)
    f = p / "node_modules/.bin/buf"
    f.write_text('#!/bin/sh\necho "fixture: buf unavailable" >&2\nexit 42\n')
    f.chmod(0o755)
    q = subprocess.run(
        ["node", str(p / "scripts/test-quality-gates.mjs")],
        cwd=p,
        capture_output=True,
        text=True,
    )
    print(
        json.dumps(
            {
                "kind": "SOURCE_MOCK_TOOL_FAILURE",
                "exitCode": q.returncode,
                "stdout": q.stdout,
                "stderr": q.stderr,
            },
            indent=2,
        )
    )
