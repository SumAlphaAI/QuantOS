"""TP12: validate the nautilus_agents no-coupling rules and baseline.

The rules file is machine-readable: every rule must carry enforcement
evidence that actually exists in the repository (path + symbol). These
tests keep the rules honest and verify the boundary-preservation claim.
"""

from __future__ import annotations

import json
from pathlib import Path

QUANTOS_ROOT = Path(__file__).resolve().parents[2]
TP12_DIR = QUANTOS_ROOT / "third_party" / "nautilus-agents"


def _load_rules() -> dict:
    return json.loads((TP12_DIR / "no-coupling-rules.json").read_text(encoding="utf-8"))


def test_at_least_five_no_coupling_rules() -> None:
    rules = _load_rules()["rules"]
    assert len(rules) >= 5, "TP12 requires at least 5 explicit no-coupling rules"
    ids = [rule["id"] for rule in rules]
    assert len(set(ids)) == len(ids), "rule ids must be unique"


def test_every_rule_has_existing_enforcement_evidence() -> None:
    for rule in _load_rules()["rules"]:
        assert rule["rule"].strip(), f"{rule['id']}: empty rule text"
        assert rule["enforcement"].strip(), f"{rule['id']}: missing enforcement description"
        assert rule["evidence"], f"{rule['id']}: at least one evidence pointer required"
        for pointer in rule["evidence"]:
            target = QUANTOS_ROOT / pointer["path"]
            assert target.is_file(), f"{rule['id']}: evidence path missing: {pointer['path']}"
            content = target.read_text(encoding="utf-8")
            assert pointer["symbol"] in content, (
                f"{rule['id']}: symbol `{pointer['symbol']}` not found in {pointer['path']}"
            )


def test_boundary_statement_preserves_agent_venue_isolation() -> None:
    statement = _load_rules()["boundaryStatement"]
    assert "never connects to a venue" in statement
    assert "does not change" in statement


def test_rules_cover_all_acceptance_critical_boundaries() -> None:
    rules = {rule["id"]: rule["rule"] for rule in _load_rules()["rules"]}
    joined = " ".join(rules.values())
    for keyword in ("venue", "executable=false", "RiskDecision", "BoundaryCommand", "lockfile"):
        assert keyword in joined, f"rules must cover `{keyword}`"


def test_baseline_lock_is_reference_only_and_pinned() -> None:
    baseline = json.loads((TP12_DIR / "baseline.lock.json").read_text(encoding="utf-8"))
    assert baseline["upstream"]["commit"] == "8d79877380f8617b45dff2b8c8b3790c2f9d963a"
    assert baseline["license"]["spdx"] == "LGPL-3.0-or-later"
    assert baseline["policy"]["decision"] == "reference_only"
    assert any(
        "lockfile" in surface
        for surface in baseline["policy"]["forbiddenSurfaces"]
    )


def test_no_upstream_dependency_in_quantos_lockfiles() -> None:
    for lockfile in ("Cargo.lock", "engines/uv.lock"):
        content = (QUANTOS_ROOT / lockfile).read_text(encoding="utf-8")
        assert "nautilus" not in content.lower(), f"upstream leaked into {lockfile}"


def test_interface_diff_lists_adoption_candidates_and_antipatterns() -> None:
    doc = (TP12_DIR / "interface-diff.md").read_text(encoding="utf-8")
    assert "adopt" in doc
    assert "Anti-patterns" in doc
    assert "confirms" in doc
