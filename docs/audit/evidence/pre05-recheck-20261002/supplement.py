from pathlib import Path
import os
import json
import subprocess
import time

f = Path(__file__).resolve().parent
root = f.parents[3]
c = json.loads((f / "commands.json").read_text())
w = Path(c["workspace"])
env = {
    k: os.environ[k]
    for k in ["PATH", "HOME", "USER", "LANG", "TMPDIR"]
    if k in os.environ
}
env["PATH"] = "/Users/anray/.nvm/versions/node/v24.12.0/bin:" + env["PATH"]
results = []


def run(name, args, expected):
    start = time.monotonic()
    with (f / (name + ".log")).open("w") as out:
        code = subprocess.run(
            args, cwd=w, env=env, stdout=out, stderr=subprocess.STDOUT, timeout=120
        ).returncode
    results.append(
        {
            "name": name,
            "command": args,
            "expected_exit": expected,
            "exit_code": code,
            "log": name + ".log",
            "seconds": round(time.monotonic() - start, 3),
        }
    )
    print(name, code, flush=True)
    assert code == expected, (name, code)


# Corpus mutations confined to disposable source archive.
paths = [w / "env/local-integrated.env.example", w / "env/staging.env.example"]
old = {p: p.read_bytes() for p in paths}
try:
    for p in paths:
        p.write_bytes((w / "env/local-mock.env.example").read_bytes())
    run("duplicate-profiles-cli", ["pnpm", "check:pre05"], 1)
    run("duplicate-profiles-tests", ["pnpm", "test:pre05"], 1)
finally:
    for p, data in old.items():
        p.write_bytes(data)
p = w / "env/staging.env.example"
old = p.read_bytes()
try:
    p.write_text(
        "\n".join(
            line
            for line in old.decode().splitlines()
            if not line.startswith("QUANTOS_E2E_ACCOUNT_")
        )
        + "\n"
    )
    run("missing-identities-cli", ["pnpm", "check:pre05"], 1)
    run("missing-identities-tests", ["pnpm", "test:pre05"], 1)
finally:
    p.write_bytes(old)
run(
    "absolute-cli-path",
    [
        "node",
        "packages/config/scripts/check-env.mjs",
        str(w / "env/local-mock.env.example"),
    ],
    0,
)
# Bypass input validation by injecting a synthetic token into actual built outputs.
for app in ["website", "terminal"]:
    for extension in ["js", "html", "map"]:
        probe = w / f"apps/{app}/out/__pre05_probe__.{extension}"
        probe.write_text("gh" + "p_" + "A" * 36)
        try:
            run(f"artifact-{app}-{extension}", ["pnpm", "check:client-secrets"], 1)
        finally:
            probe.unlink()
run("clean-client-artifacts", ["pnpm", "check:client-secrets"], 0)
(f / "supplement-commands.json").write_text(
    json.dumps(
        {
            "baseline": c["baseline"],
            "scope": "temporary archive and actual built client files; mutations restored; synthetic credentials only",
            "results": results,
        },
        indent=2,
    )
    + "\n"
)
