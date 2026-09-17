"""Machine-readable Python workspace/build closure; run using the locked build group."""

import json
from pathlib import Path
import tomli

root = Path(__file__).resolve().parents[1]
workspace = tomli.loads((root / "engines/pyproject.toml").read_text())
lock = tomli.loads((root / "engines/uv.lock").read_text())
members = workspace["tool"]["uv"]["workspace"]["members"]
packages = []
for member in members:
    filename = root / "engines" / member / "pyproject.toml"
    data = tomli.loads(filename.read_text())
    assert data["build-system"]["requires"] == ["hatchling==1.27.0"], str(filename)
    packages.append(
        {
            "directory": f"engines/{member}",
            "name": data["project"]["name"],
            "version": data["project"]["version"],
        }
    )
# Build closure is resolved by uv.lock; no floating build dependencies are allowed.
by_name = {p["name"]: p for p in lock["package"]}
closure = {}


def visit(name):
    if name in closure:
        return
    package = by_name[name]
    closure[name] = package["version"]
    for dependency in package.get("dependencies", []):
        visit(dependency["name"])


visit("hatchling")
print(json.dumps({"python": packages, "buildClosure": closure}))
