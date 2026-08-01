"""TP13: validate the Loong evaluation deliverables and boundary.

The protocol/UX comparison must cover the six required axes, the baseline
must be pinned, and no Loong type may enter the QuantOS protocol, core, or
any lockfile.
"""

from __future__ import annotations

import json
from pathlib import Path

QUANTOS_ROOT = Path(__file__).resolve().parents[2]
TP13_DIR = QUANTOS_ROOT / "third_party" / "loong"

REQUIRED_AXES = ("Session", "Workflow", "Tool", "Memory", "权限", "审计")


def _comparison() -> str:
    return (TP13_DIR / "protocol-ux-comparison.md").read_text(encoding="utf-8")


def test_comparison_covers_all_six_required_axes() -> None:
    doc = _comparison()
    for axis in REQUIRED_AXES:
        assert axis in doc, f"comparison must cover `{axis}`"
    assert doc.count("| 维度 |") >= 6, "each axis must carry a comparison table"


def test_comparison_covers_protocol_runtime_and_ux_extras() -> None:
    doc = _comparison()
    for axis in ("Protocol", "Runtime", "UX"):
        assert axis in doc, f"comparison should also cover `{axis}`"


def test_adoption_candidates_and_rejections_are_explicit() -> None:
    doc = _comparison()
    assert "adopt" in doc and "reject" in doc
    for anti_pattern in ("trusted_internal_context", "MCP"):
        assert anti_pattern in doc, f"anti-pattern `{anti_pattern}` must be addressed"


def test_baseline_lock_is_reference_only_and_pinned() -> None:
    baseline = json.loads((TP13_DIR / "baseline.lock.json").read_text(encoding="utf-8"))
    assert baseline["upstream"]["commit"] == "3ab7936638e4772c1db95ebee7f5f643852697c2"
    assert baseline["license"]["spdx"] == "MIT"
    assert baseline["policy"]["decision"] == "reference_only"


def test_no_upstream_types_in_protocol_or_core() -> None:
    targets = [
        *QUANTOS_ROOT.glob("proto/**/*.proto"),
        QUANTOS_ROOT / "crates" / "quantos-core" / "src" / "lib.rs",
    ]
    assert targets, "expected proto files and core lib to exist"
    for target in targets:
        content = target.read_text(encoding="utf-8").lower()
        assert "loong" not in content, f"upstream type leaked into {target}"


def test_no_upstream_dependency_in_lockfiles() -> None:
    for lockfile in ("Cargo.lock", "engines/uv.lock"):
        content = (QUANTOS_ROOT / lockfile).read_text(encoding="utf-8").lower()
        assert "loong" not in content, f"upstream leaked into {lockfile}"
