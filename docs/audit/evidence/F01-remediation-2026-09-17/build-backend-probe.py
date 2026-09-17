"""Replay F01 pinned-backend rejection for every Python member without installing."""

import json
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path.cwd()
with tempfile.TemporaryDirectory(prefix="f01-backend-probe-") as directory:
    fixture = Path(directory)
    (fixture / "scripts").mkdir()
    shutil.copy(root / "scripts/f01-inventory.py", fixture / "scripts")
    (fixture / "engines").mkdir()
    for name in ["pyproject.toml", "uv.lock"]:
        shutil.copy(root / "engines" / name, fixture / "engines")
    manifests = sorted((root / "engines").glob("*/pyproject.toml"))
    for manifest in manifests:
        target = fixture / manifest.relative_to(root)
        target.parent.mkdir()
        shutil.copy(manifest, target)
    command = [
        str(root / "engines/.venv/bin/python"),
        str(fixture / "scripts/f01-inventory.py"),
    ]
    baseline = subprocess.run(command, capture_output=True, text=True)
    assert baseline.returncode == 0, baseline.stderr
    results = []
    for manifest in manifests:
        target = fixture / manifest.relative_to(root)
        original = target.read_text()
        target.write_text(original.replace("hatchling==1.27.0", "hatchling==1.26.0"))
        changed = subprocess.run(command, capture_output=True, text=True)
        assert changed.returncode != 0 and "AssertionError" in changed.stderr
        results.append(
            {"member": str(manifest.relative_to(root)), "driftRejected": True}
        )
        target.write_text(original)
    print(
        json.dumps(
            {
                "status": "PASS",
                "baselineExitCode": baseline.returncode,
                "cases": results,
            },
            indent=2,
        )
    )
