from pathlib import Path
import json
import subprocess
import os
import shutil
import base64

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
env["CI"] = "true"
env["GITHUB_SHA"] = c["baseline"]
env.update(
    {
        "NEXT_PUBLIC_QUANTOS_ENV": "local-mock",
        "NEXT_PUBLIC_SITE_ORIGIN": "https://sumalpha.ai",
        "NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN": "http://localhost:3190",
        "NEXT_PUBLIC_QUANTOS_BFF_ORIGIN": "http://localhost:4010",
        "NEXT_PUBLIC_QUANTOS_OIDC_ISSUER": "https://mock.idp.local",
        "NEXT_PUBLIC_QUANTOS_OIDC_CLIENT_ID": "quantos-terminal-ci",
        "NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI": "http://localhost:3190/auth/callback",
        "NEXT_PUBLIC_QUANTOS_DEFAULT_MODE": "paper",
        "NEXT_PUBLIC_QUANTOS_MOCK_ENABLED": "true",
        "NEXT_PUBLIC_QUANTOS_OBS_ENABLED": "false",
        "NEXT_PUBLIC_QUANTOS_FEATURE_ASSISTED_LIVE_TESTNET": "off",
    }
)
results = []


def run(name, args):
    r = subprocess.run(args, cwd=w, env=env, text=True, capture_output=True, timeout=60)
    out = r.stdout + r.stderr
    (f / (name + ".log")).write_text(out)
    results.append(
        {
            "name": name,
            "command": args,
            "expected_exit": 1,
            "exit_code": r.returncode,
            "log": name + ".log",
        }
    )
    assert r.returncode == 1, (name, r.returncode)
    print(name, r.returncode, flush=True)
    return out


for app in ["terminal", "website"]:
    manifest = json.loads((w / f"apps/{app}/.next/app-build-manifest.json").read_text())
    shared = set(next(iter(manifest["pages"].values())))
    for files in manifest["pages"].values():
        shared.intersection_update(files)
    path = (
        w
        / f"apps/{app}/out/_next"
        / next(path for path in sorted(shared) if path.endswith(".js"))
    )
    old = path.read_bytes()
    try:
        path.write_bytes(
            old + b"\n/*" + base64.b64encode(os.urandom(90 * 1024)) + b"*/"
        )
        out = run(
            app + "-route-budget-negative", ["pnpm", "check:perf", f"apps/{app}/out"]
        )
        assert "FAIL  route" in out
    finally:
        path.write_bytes(old)
    p = w / f"apps/{app}/out/pre03-build.json"
    old = p.read_bytes()
    try:
        receipt = json.loads(old)
        receipt["sourceDigest"] = "0" * 64
        p.write_text(json.dumps(receipt))
        out = run(
            app + "-stale-receipt-negative", ["pnpm", "check:perf", f"apps/{app}/out"]
        )
        assert "Stale build/source receipt" in out
    finally:
        p.write_bytes(old)
# Exercise the real pixel comparison and archive its actual trace/images locally.
p = next((w / "apps/terminal/out/_next").rglob("*.css"))
old = p.read_bytes()
env["PLAYWRIGHT_JSON_OUTPUT_FILE"] = str(f / "visual-runtime-negative.json")
try:
    p.write_bytes(old + b"\nhtml { filter: invert(1) !important; }")
    run(
        "visual-runtime-negative",
        [
            "pnpm",
            "exec",
            "playwright",
            "test",
            "--config",
            "playwright.config.ts",
            "--project=chromium",
            "--workers=1",
            "--retries=0",
            "--update-snapshots=none",
            "--grep",
            "视觉基线：1440",
        ],
    )
    target = f / "visual-runtime-negative-artifacts"
    shutil.copytree(
        w / "artifacts/browser/terminal/test-results", target, dirs_exist_ok=True
    )
    assert list(target.rglob("trace.zip")) and list(target.rglob("*-diff.png"))
finally:
    p.write_bytes(old)
(f / "supplement.json").write_text(
    json.dumps(
        {
            "baseline": c["baseline"],
            "scope": "actual built outputs temporarily changed and restored; route budgets/source receipts/real browser pixel rejection; local archive, no remote upload",
            "results": results,
        },
        indent=2,
    )
    + "\n"
)
# Run the original independent assertions against the final validation source.
script = w / f.relative_to(root) / "probes.mjs"
r = subprocess.run(
    ["node", str(script)], cwd=w, env=env, text=True, capture_output=True, timeout=30
)
assert r.returncode == 0, r.stderr
shutil.copy2(script.with_name("probes.json"), f / "probes.json")
assert json.loads((f / "probes.json").read_text())["unexpected_accepts"] == 0
