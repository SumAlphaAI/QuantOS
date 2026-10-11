"""Independent TP10 mapping and current-workspace boundary checks; no upstream runtime."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = ROOT / "third_party/valuecell"
INVENTORY = json.loads((REFERENCE / "patterns.json").read_text())
SPEC = (ROOT / "docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md").read_text()


def test_twelve_unique_spec_mappings() -> None:
    patterns = INVENTORY["patterns"]
    assert len(patterns) >= 10
    assert len({p["id"] for p in patterns}) == len(patterns)
    for pattern in patterns:
        path, anchor = pattern["terminalSpec"].split("#")
        assert (ROOT / path).is_file()
        assert SPEC.count(f'<a id="{anchor}"></a>') == 1
        section = SPEC.split(f'<a id="{anchor}"></a>')[1].split('<a id="')[0]
        assert pattern["requirement"] in section
        assert pattern["acceptance"] in section
        assert pattern["implementationStatus"] == "NOT_ASSESSED"


def test_five_gaps_are_design_followups_not_ui_closure() -> None:
    assert len(INVENTORY["gaps"]) == 5
    ids = {p["id"] for p in INVENTORY["patterns"]}
    for gap in INVENTORY["gaps"]:
        assert gap["owner"] in {"U01", "X06", "S02"}
        assert gap["status"] == "DESIGNED_PENDING_IMPLEMENTATION"
        assert set(gap["patternRefs"]) <= ids
    assert len(INVENTORY["forbidden"]) == 7


def test_no_upstream_source_or_assets_in_reference_directory() -> None:
    assert {p.name for p in REFERENCE.iterdir()} == {
        "README.md",
        "baseline.lock.json",
        "patterns.json",
        "provenance.json",
        "ux-gap-report.md",
        "check-development.mjs",
    }


def test_source_grades_do_not_equate_roadmap_to_shipped_behavior() -> None:
    grades = [p["basis"] for p in INVENTORY["patterns"]]
    assert grades.count("DOCUMENTED") == 3
    assert grades.count("ROADMAP") == 2
    assert grades.count("QUANTOS_EXTENSION") == 7
    assert INVENTORY["formalAccepted"] is False


@pytest.mark.parametrize("scope", ["proto", "crates", "apps", "packages", "engines"])
def test_current_source_scopes_exist_and_are_uncoupled(scope: str) -> None:
    folder = ROOT / scope
    assert folder.is_dir()
    files = []
    for path in folder.rglob("*"):
        if not path.is_file() or path.suffix not in {".proto", ".rs", ".py", ".ts", ".tsx"}:
            continue
        if set(path.parts) & {"node_modules", ".next", "target", ".venv", "__pycache__", "tests"}:
            continue
        if ".test." in path.name:
            continue
        files.append(path)
        assert not re.search(r"value[\s_.-]*cell", path.read_text(), re.I), path
    assert files, f"must scan the actual {scope} sources"


@pytest.mark.parametrize(
    "file",
    [
        "Cargo.lock",
        "pnpm-lock.yaml",
        "engines/uv.lock",
        "Cargo.toml",
        "package.json",
        "pnpm-workspace.yaml",
        "engines/pyproject.toml",
        ".gitmodules",
    ],
)
def test_manifest_lock_and_submodule_exclusion(file: str) -> None:
    assert not re.search(r"value[\s_.-]*cell", (ROOT / file).read_text(), re.I)
