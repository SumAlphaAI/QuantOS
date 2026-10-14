"""TP10: validate the ValueCell evaluation deliverables and boundary.

The UX gap report must map at least 10 UI patterns to the Terminal design
spec, the no-coupling list must be complete, and no upstream reference may
leak into QuantOS protocol, core, frontend source, or lockfiles.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

QUANTOS_ROOT = Path(__file__).resolve().parents[2]
TP10_DIR = QUANTOS_ROOT / "third_party" / "valuecell"
FRONTEND_SRC = Path("/Users/anray/Documents/project/SumAlpha/SumAlpha/apps/desktop_frontend/src")


def _report() -> str:
    return (TP10_DIR / "ux-gap-report.md").read_text(encoding="utf-8")


def test_at_least_ten_ui_patterns_mapped() -> None:
    rows = re.findall(r"^\| (\d+) \| ", _report(), flags=re.MULTILINE)
    assert len(rows) >= 10, "TP10 requires at least 10 UI patterns mapped to the Terminal design spec"
    assert len(set(rows)) == len(rows), "pattern rows must be unique"


def test_each_pattern_maps_to_a_terminal_surface() -> None:
    doc = _report()
    for marker in ("P03", "Research", "Proposal", "Terminal", "X06", "U01"):
        assert marker in doc, f"pattern mappings must reference Terminal surfaces (`{marker}`)"


def test_no_coupling_list_is_complete() -> None:
    items = re.findall(r"^\d+\. ", _report().split("禁止耦合清单")[1], flags=re.MULTILINE)
    assert len(items) >= 7, "no-coupling list must cover data model, account system, runtime, trading, data sources, MCP, and assets"


def test_ux_gaps_have_assigned_owners() -> None:
    section = _report().split("UX gap report")[1]
    for owner in ("U01", "X06", "S02"):
        assert owner in section, f"gap report must assign gaps to `{owner}`"


def test_baseline_lock_is_reference_only_and_pinned() -> None:
    baseline = json.loads((TP10_DIR / "baseline.lock.json").read_text(encoding="utf-8"))
    assert baseline["upstream"]["commit"] == "9793e9c0563fbf56fc096757d8bb80e209ac7aab"
    assert baseline["license"]["spdx"] == "Apache-2.0"
    assert baseline["policy"]["decision"] == "reference_only"
    assert any("verbatim source" in surface for surface in baseline["policy"]["forbiddenSurfaces"])


def test_no_upstream_reference_in_protocol_core_or_frontend() -> None:
    targets = [
        *QUANTOS_ROOT.glob("proto/**/*.proto"),
        QUANTOS_ROOT / "crates" / "quantos-core" / "src" / "lib.rs",
    ]
    if FRONTEND_SRC.is_dir():
        targets.extend(FRONTEND_SRC.rglob("*.ts"))
        targets.extend(FRONTEND_SRC.rglob("*.tsx"))
    assert targets, "expected proto/core/frontend sources to exist"
    for target in targets:
        content = target.read_text(encoding="utf-8").lower()
        assert "valuecell" not in content, f"upstream reference leaked into {target}"


def test_no_upstream_dependency_in_lockfiles() -> None:
    for lockfile in ("Cargo.lock", "engines/uv.lock"):
        content = (QUANTOS_ROOT / lockfile).read_text(encoding="utf-8").lower()
        assert "valuecell" not in content, f"upstream leaked into {lockfile}"
