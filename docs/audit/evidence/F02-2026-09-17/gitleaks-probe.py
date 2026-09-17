"""Compare CI's exact Gitleaks configuration with defaults using fake token history."""

from pathlib import Path
import tempfile
import subprocess
import json
import os

root = Path.cwd()
binary = Path(os.environ.get("GITLEAKS_BIN", "/tmp/quantos-f02-audit/gitleaks"))
out = []
with tempfile.TemporaryDirectory(prefix="f02-secret-") as td:
    p = Path(td)

    def run(cmd):
        return subprocess.run(
            cmd,
            cwd=p,
            env={**os.environ, "GITLEAKS_CONFIG": ""},
            capture_output=True,
            text=True,
        )

    assert run(["git", "init"]).returncode == 0
    # Synthetic Slack token is outside the custom four-pattern Node secret scanner.
    (p / "fixture.txt").write_text(
        "SLACK_TOKEN="
        + "xoxb-"
        + "123456789012-"
        + "1234567890123-"
        + "AbCdEfGhIjKlMnOpQrStUvWx"
        + "\n"
    )
    assert run(["git", "add", "."]).returncode == 0
    assert (
        run(
            [
                "git",
                "-c",
                "user.name=Audit",
                "-c",
                "user.email=audit@example.invalid",
                "commit",
                "-m",
                "fixture",
            ]
        ).returncode
        == 0
    )
    for name, args in [
        ("CI configuration", ["--config", str(root / ".gitleaks.toml")]),
        ("default configuration", []),
    ]:
        x = run([str(binary), "git", "--redact", "--no-banner", *args, "."])
        out.append(
            {
                "case": name,
                "exitCode": x.returncode,
                "stdout": x.stdout,
                "stderr": x.stderr,
            }
        )
    x = subprocess.run(
        ["node", str(root / "scripts/check-secrets.mjs")],
        cwd=p,
        env={**os.environ, "QUANTOS_GATE_ROOT": str(p)},
        capture_output=True,
        text=True,
    )
    out.append(
        {
            "case": "Node fallback scanner",
            "exitCode": x.returncode,
            "stdout": x.stdout,
            "stderr": x.stderr,
        }
    )
print(json.dumps({"kind": "SYNTHETIC_SECRET_ONLY", "results": out}, indent=2))
