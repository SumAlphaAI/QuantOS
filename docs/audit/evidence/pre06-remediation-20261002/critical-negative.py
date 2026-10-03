from pathlib import Path
import json
import subprocess
import os

f = Path(__file__).resolve().parent
c = json.loads((f / "commands.json").read_text())
w = Path(c["workspace"])
p = w / "packages/ui/src/components/DangerConfirmDialog/confirmation-policy.ts"
old = p.read_bytes()
env = dict(os.environ)
env["PATH"] = "/Users/anray/.nvm/versions/node/v24.12.0/bin:" + env["PATH"]
try:
    p.write_bytes(
        old.replace(
            b"  return phrase",
            b'  if (phrase === "__uncovered_pre06_probe__") return false;\n  return phrase',
        )
    )
    r = subprocess.run(
        ["pnpm", "coverage:critical"], cwd=w, env=env, capture_output=True, text=True
    )
    out = r.stdout + r.stderr
    (f / "critical-branch-negative.log").write_text(out)
    assert r.returncode == 1 and "Coverage for branches (80%)" in out
    (f / "critical-branch-negative.json").write_text(
        json.dumps(
            {
                "workspace": str(w),
                "command": ["pnpm", "coverage:critical"],
                "mutation": "insert untested branch into frozen confirmation policy; restored after check",
                "expected_exit": 1,
                "exit_code": r.returncode,
            },
            indent=2,
        )
        + "\n"
    )
    print("critical branch rejection", r.returncode)
finally:
    p.write_bytes(old)
