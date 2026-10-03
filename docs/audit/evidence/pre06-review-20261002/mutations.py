from pathlib import Path
import json
import os
import subprocess
import shutil

f = Path(__file__).resolve().parent
root = f.parents[3]
c = json.loads((f / "commands.json").read_text())
w = Path(c["workspace"])
results = []
env = {
    k: os.environ[k]
    for k in ["PATH", "HOME", "USER", "LANG", "TMPDIR"]
    if k in os.environ
}
env["PATH"] = "/Users/anray/.nvm/versions/node/v24.12.0/bin:" + env["PATH"]
env["CI"] = "true"


def run(name, args, expected_reject=True):
    r = subprocess.run(args, cwd=w, env=env, text=True, capture_output=True, timeout=60)
    (f / (name + ".log")).write_text(r.stdout + r.stderr)
    results.append(
        {
            "name": name,
            "command": args,
            "exit_code": r.returncode,
            "expected": "nonzero" if expected_reject else "zero",
            "unexpected_accept": expected_reject and r.returncode == 0,
            "log": name + ".log",
        }
    )
    print(name, r.returncode, flush=True)


p = w / "tests/contract/fixtures/command-center/default.json"
old = p.read_bytes()
try:
    data = json.loads(old)
    data["venueApiKey"] = "synthetic-private-fixture-marker"
    p.write_text(json.dumps(data))
    run("unused-fixture-contract", ["pnpm", "test:contract"])
    run("unused-fixture-sabotage", ["pnpm", "sabotage:pre06"])
    run("unused-fixture-pre06", ["pnpm", "check:pre06"])
finally:
    p.write_bytes(old)
# Current executable visual assertions can disappear while independent integrity checks stay green.
paths = [
    w / "tests/e2e" / name
    for name in ["command.spec.ts", "ui102-auth.spec.ts", "ui104-settings.spec.ts"]
]
olds = {p: p.read_bytes() for p in paths}
try:
    for p in paths:
        p.write_text(
            "\n".join(
                line
                for line in p.read_text().splitlines()
                if ".toHaveScreenshot(" not in line
            )
            + "\n"
        )
    run("removed-visual-assertions-pre06", ["pnpm", "check:pre06"])
    run("removed-visual-assertions-sabotage", ["pnpm", "sabotage:pre06"])
    run(
        "removed-visual-assertions-browser",
        ["pnpm", "test:browser", "--project=chromium", "--workers=2", "--retries=0"],
    )
finally:
    for p, data in olds.items():
        p.write_bytes(data)
# Re-run the executable structure Gate with real workflow and test-file mutations.
p = w / ".github/workflows/frontend-baseline.yml"
old = p.read_bytes()
try:
    p.write_text(
        p.read_text().replace(
            "run: pnpm test:browser:website --project=chromium",
            "if: false\n        run: pnpm test:browser:website --project=chromium",
        )
    )
    run("disabled-ci-step-pre06", ["pnpm", "check:pre06"])
finally:
    p.write_bytes(old)
p = w / "tests/contract/contract.test.ts"
old = p.read_bytes()
try:
    p.write_text(
        'import {it,expect} from "vitest";\nit("synthetic vacuous test",()=>expect(true).toBe(true));\n// MOCK_NOT_CONFIGURED currentVersion retryAfter venueApiKey executable=true\n'
    )
    run("marker-only-contract-pre06", ["pnpm", "check:pre06"])
    run("marker-only-contract-tests", ["pnpm", "test:contract"])
finally:
    p.write_bytes(old)
# Browser-free one-retry test inherits the actual CI retry policy.
d = w / "__pre06_audit_flaky"
d.mkdir(exist_ok=True)
try:
    (d / "flaky.spec.ts").write_text(
        'import {test,expect} from "@playwright/test"; test("synthetic flaky baseline",async ({},info)=>{expect(info.retry).toBe(1);});\n'
    )
    for app, config in [
        ("terminal", "playwright.config.ts"),
        ("website", "playwright.website.config.ts"),
    ]:
        (d / "config.ts").write_text(
            'import base from "../'
            + config
            + '"; export default {...base,testDir:".",testMatch:"flaky.spec.ts",testIgnore:[],webServer:undefined,projects:[{name:"probe"}],reporter:[["list"],["json",{outputFile:'
            + json.dumps(str(f / (app + "-flaky.json")))
            + "}]]};\n"
        )
        run(
            app + "-flaky",
            [
                "pnpm",
                "exec",
                "playwright",
                "test",
                "--config",
                str(d / "config.ts"),
                "--workers=1",
            ],
        )
finally:
    shutil.rmtree(d)
(f / "mutations.json").write_text(
    json.dumps(
        {
            "baseline": c["baseline"],
            "workspace": str(w),
            "scope": "temporary files restored; browser-free retry control and actual Chromium tests; synthetic values only",
            "results": results,
        },
        indent=2,
    )
    + "\n"
)
