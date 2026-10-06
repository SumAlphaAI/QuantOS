from pathlib import Path
import os
import subprocess
import json
import hashlib
import datetime

root = Path("/Users/anray/Documents/project/SumAlpha/QuantOS")
env = os.environ.copy()
env["CARGO_HOME"] = "/private/tmp/quantos-ci-5da474e-empty-cargo"
env["CARGO_TARGET_DIR"] = "/private/tmp/quantos-ci-5da474e-cold-target"
assert not Path(env["CARGO_TARGET_DIR"]).exists(), "cold build target must start empty"
rows = []
for name, args in [
    ("lib", ["--lib"]),
    ("reference", ["--test", "auth_settings_provider"]),
]:
    command = ["cargo", "test", "--locked", "--offline", "-p", "bff-gateway"] + args
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    p = subprocess.run(command, cwd=root, env=env, capture_output=True, timeout=600)
    raw = p.stdout + p.stderr
    file = Path(f"/private/tmp/quantos-ci-5da474e-cold-{name}-after.log")
    file.write_bytes(raw)
    rows.append(
        {
            "command": command,
            "executedAt": started,
            "exitCode": p.returncode,
            "status": "PASS" if p.returncode == 0 else "FAIL",
            "log": file.name,
            "sha256": "sha256:" + hashlib.sha256(raw).hexdigest(),
        }
    )
    print(name, p.returncode, flush=True)
    assert p.returncode == 0, raw.decode(errors="replace")[-3000:]
Path("/private/tmp/quantos-ci-5da474e-cold-offline-proof.json").write_text(
    json.dumps(
        {
            "status": "PASS",
            "cacheInitiallyEmpty": True,
            "compiledTargetInitiallyEmpty": True,
            "prefetch": "cargo fetch --locked",
            "temporaryProbeNetworkOverrides": {
                "CARGO_HTTP_MULTIPLEXING": "false",
                "CARGO_HTTP_TIMEOUT": "30",
                "CARGO_NET_RETRY": "1",
            },
            "checks": rows,
        },
        indent=2,
    )
    + "\n"
)
