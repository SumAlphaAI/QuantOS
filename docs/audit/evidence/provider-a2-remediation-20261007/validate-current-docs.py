from pathlib import Path
import json
import re
from urllib.parse import unquote

base = Path("docs/audit/evidence/provider-a2-remediation-20261007")
paths = [
    Path("docs/audit") / n
    for n in [
        "PROVIDER-A2-comprehensive-review-2026-10-07.md",
        "BFF-FE-001-comprehensive-review-2026-10-05.md",
        "BFF-FE-007-comprehensive-review-2026-10-06.md",
    ]
]
checks = []
for p in paths:
    text = p.read_text()
    assert len(re.findall(r"^## [一二三四]、", text, re.M)) == 4, str(p)
    for raw in re.findall(r"(?<!!)\[[^\]]+\]\(([^)]+)\)", text):
        raw = raw.strip("<>")
        if raw.startswith(("https:", "http:", "mailto:")):
            continue
        target, _, anchor = raw.partition("#")
        q = (p.parent / unquote(target)).resolve() if target else p.resolve()
        assert q.is_file(), f"{p}: missing {raw}"
        if anchor:
            assert (
                f'id="{anchor}"' in q.read_text()
                or f'<a name="{anchor}"' in q.read_text()
            ), f"{p}: missing anchor {raw}"
        checks.append({"document": str(p), "target": raw, "status": "PASS"})
x = json.loads((base / "control-matrix.json").read_text())
assert (
    len(x["rows"]) == 24
    and x["pass"] == 24
    and all(r["result"] == "PASS" for r in x["rows"])
)
f = json.loads((base / "closed-findings.json").read_text())
assert len(f["items"]) == 4 and all(r["status"] == "CLOSED" for r in f["items"])
a = json.loads((base / "audit-control-matrix.json").read_text())
assert len(a["controls"]) == 31 and all(r["status"] == "PASS" for r in a["controls"])
n = json.loads((base / "negative-summary.json").read_text())
assert n["passed"] == 127 and n["failed"] == 0
v = {
    "schema": "quantos-provider-a2-document-verification/v1",
    "status": "PASS",
    "checks": checks,
    "controls": 24,
    "closedFindings": 4,
    "auditControls": 31,
    "uniqueGateCases": 127,
}
(base / "document-validation.json").write_text(
    json.dumps(v, ensure_ascii=False, indent=2) + "\n"
)
print(
    "PASS",
    len(checks),
    "local links; 24 A2 controls; 4 closed findings; 31 Audit controls; 127 gate cases",
)
