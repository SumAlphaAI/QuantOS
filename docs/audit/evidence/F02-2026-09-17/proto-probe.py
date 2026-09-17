from pathlib import Path
import tempfile
import subprocess
import json

root = Path.cwd()
buf = root / "node_modules/.bin/buf"
out = []
with tempfile.TemporaryDirectory(prefix="f02-proto-") as d:
    p = Path(d)

    def run(args):
        return subprocess.run(args, cwd=p, capture_output=True, text=True)

    assert run(["git", "init", "-b", "main"]).returncode == 0
    (p / "buf.yaml").write_text(
        "version: v2\nmodules:\n  - path: .\nbreaking:\n  use:\n    - FILE\n"
    )
    f = p / "fixture.proto"
    f.write_text(
        'syntax = "proto3";\npackage fixture.v1;\nmessage Foo { string value = 1; }\n'
    )

    def commit():
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

    commit()
    f.write_text('syntax = "proto3";\npackage fixture.v1;\nmessage Foo {}\n')
    commit()
    for baseline in [".git#branch=main", ".git#ref=HEAD~1"]:
        r = run([str(buf), "breaking", "--against", baseline])
        out.append(
            {
                "baseline": baseline,
                "exitCode": r.returncode,
                "stdout": r.stdout,
                "stderr": r.stderr,
            }
        )
print(json.dumps({"kind": "SOURCE_MOCK_PROTO_BREAKING", "results": out}, indent=2))
