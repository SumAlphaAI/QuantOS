from pathlib import Path
import json
import os
import subprocess

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
env["NEXT_TELEMETRY_DISABLED"] = "1"
for script, args in [
    ("probes.mjs", []),
    ("parser-comparison.mjs", [str(w)]),
    ("boundary-probes.mjs", []),
]:
    p = w / f.relative_to(root) / script
    r = subprocess.run(
        ["node", str(p), *args],
        cwd=w,
        env=env,
        text=True,
        capture_output=True,
        timeout=30,
    )
    assert r.returncode == 0, r.stderr
    if script == "boundary-probes.mjs":
        (f / "after.json").write_text(r.stdout)
        assert all(json.loads(r.stdout).values())
    else:
        name = script.replace(".mjs", ".json")
        (f / name).write_bytes((p.parent / name).read_bytes())
results = []
for app in ["website", "terminal"]:
    name = "missing-env-dev-" + app
    args = ["pnpm", "--filter", "@sumalpha/" + app, "exec", "next", "dev", "-p", "0"]
    r = subprocess.run(args, cwd=w, env=env, text=True, capture_output=True, timeout=30)
    out = r.stdout + r.stderr
    (f / (name + ".log")).write_text(out)
    result = {
        "name": name,
        "command": args,
        "exit_code": r.returncode,
        "fail_fast_logged": "fail-fast" in out,
        "log": name + ".log",
    }
    assert r.returncode == 1 and result["fail_fast_logged"]
    results.append(result)
(f / "startup-commands.json").write_text(json.dumps(results, indent=2) + "\n")
# Check the changed executable .mjs files with the repository ESLint rules.
args = [
    "pnpm",
    "exec",
    "eslint",
    "scripts/check-client-secrets.mjs",
    "scripts/pre05-gate-negative.mjs",
    "--no-ignore",
    "--format",
    "json",
]
r = subprocess.run(args, cwd=w, env=env, text=True, capture_output=True, timeout=30)
(f / "script-lint.log").write_text(r.stdout + r.stderr)
print(
    "independent probes, Next parser and two startup rejection checks passed; script lint exit",
    r.returncode,
)
