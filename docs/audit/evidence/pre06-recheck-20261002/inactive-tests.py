from pathlib import Path
import json
import os
import subprocess

f = Path(__file__).resolve().parent
c = json.loads((f / "commands.json").read_text())
w = Path(c["workspace"])
env = dict(os.environ)
env["PATH"] = "/Users/anray/.nvm/versions/node/v24.12.0/bin:" + env["PATH"]
env["CI"] = "true"
results = []
cases = [
    (
        "visual-test-skip",
        "tests/e2e/command.spec.ts",
        'test("视觉基线：1440 深主题"',
        'test.skip("视觉基线：1440 深主题"',
        ["check:pre06", "sabotage:pre06", "test:browser"],
    ),
    (
        "visual-suite-skip",
        "tests/e2e/command.spec.ts",
        "test.describe(",
        "test.describe.skip(",
        ["check:pre06", "sabotage:pre06", "test:browser"],
    ),
    (
        "visual-dead-branch",
        "tests/e2e/command.spec.ts",
        "await expect(page).toHaveScreenshot",
        "if (false) await expect(page).toHaveScreenshot",
        ["check:pre06", "sabotage:pre06", "test:browser"],
    ),
    (
        "contract-suite-skip",
        "tests/contract/contract.test.ts",
        "describe(",
        "describe.skip(",
        ["check:pre06", "test:contract"],
    ),
]
for name, path, a, b, commands in cases:
    p = w / path
    old = p.read_bytes()
    try:
        assert a in old.decode()
        p.write_text(old.decode().replace(a, b))
        for command in commands:
            r = subprocess.run(
                ["pnpm", command],
                cwd=w,
                env=env,
                capture_output=True,
                text=True,
                timeout=30,
            )
            log = name + "-" + command.replace(":", "-") + ".log"
            (f / log).write_text(r.stdout + r.stderr)
            assert r.returncode == 1, (name, command, r.returncode)
            assert "missing executable" in r.stdout + r.stderr
            results.append(
                {
                    "case": name,
                    "command": ["pnpm", command],
                    "expected_exit": 1,
                    "exit_code": r.returncode,
                    "log": log,
                }
            )
    finally:
        p.write_bytes(old)
(f / "inactive-tests.json").write_text(
    json.dumps(
        {"baseline": c["baseline"], "workspace": str(w), "results": results}, indent=2
    )
    + "\n"
)
print("inactive-test probes rejected", len(results))
