"""TP09: validate the TrendRadar -> QuantOS Signal mapping samples.

The three samples under `third_party/trendradar/mappings/` prove that
TrendRadar-style trend/news inputs fit inside the QuantOS Signal contract,
and that any input missing a license label or source attribution is marked
100% non-tradable. These tests keep the samples replayable and enforce the
non-tradable rule.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

TP09_DIR = Path(__file__).resolve().parents[2] / "third_party" / "trendradar"
MAPPINGS_DIR = TP09_DIR / "mappings"

REQUIRED_METADATA_KEYS = {
    "tenant_id",
    "workspace_id",
    "actor_id",
    "correlation_id",
    "causation_id",
    "mode",
    "environment",
    "issued_at",
}

MAPPING_FILES = (
    "01-hotlist-theme-to-signal.json",
    "02-rss-theme-to-signal.json",
    "03-missing-license-non-tradable.json",
)


def _load(name: str) -> dict:
    return json.loads((MAPPINGS_DIR / name).read_text(encoding="utf-8"))


def _canonical_hash(doc: dict) -> str:
    payload = {key: value for key, value in doc.items() if key != "content_hash"}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _input_is_degraded(doc: dict) -> bool:
    return any(
        not item.get("license_label") or not item.get("source_id")
        for item in doc["trendradar_input"]["items"]
    )


def test_trend_mappings_match_signal_contract() -> None:
    for name in MAPPING_FILES:
        signal = _load(name)["quantos_signal"]

        assert REQUIRED_METADATA_KEYS.issubset(signal["metadata"].keys())
        for field in (
            "signal_id",
            "strategy_release_id",
            "symbol",
            "direction",
            "generated_at",
            "valid_until",
        ):
            assert signal[field], f"{name}: missing Signal field `{field}`"

        assert signal["direction"].startswith("SIGNAL_DIRECTION_")
        assert signal["strength"]["value"]
        assert signal["confidence"]["value"]
        assert signal["evidence_refs"], f"{name}: Signal must carry evidence refs"
        for ref in signal["evidence_refs"]:
            assert {"evidence_id", "artifact_id", "summary"}.issubset(ref.keys())

        diagnostics = signal["diagnostics"]["value"]
        assert "trading_approved" in diagnostics
        assert diagnostics["provenance"]["sources"], f"{name}: provenance sources required"


def test_degraded_inputs_are_always_non_tradable() -> None:
    for name in MAPPING_FILES:
        doc = _load(name)
        diagnostics = doc["quantos_signal"]["diagnostics"]["value"]
        tags = set(diagnostics["diagnostics_tags"])

        if _input_is_degraded(doc):
            assert diagnostics["trading_approved"] is False, f"{name}: degraded input became tradable"
            assert "not_tradable" in tags
            assert diagnostics["rejection_reasons"], f"{name}: degraded input without rejection reasons"


def test_all_trend_signals_remain_research_only() -> None:
    for name in MAPPING_FILES:
        diagnostics = _load(name)["quantos_signal"]["diagnostics"]["value"]
        assert diagnostics["trading_approved"] is False
        assert "research_only" in diagnostics["diagnostics_tags"]


def test_missing_license_and_source_markers_present_in_degraded_sample() -> None:
    doc = _load("03-missing-license-non-tradable.json")
    diagnostics = doc["quantos_signal"]["diagnostics"]["value"]
    tags = set(diagnostics["diagnostics_tags"])

    assert _input_is_degraded(doc)
    assert {"missing_license", "missing_source", "not_tradable"}.issubset(tags)
    assert diagnostics["trading_approved"] is False


def test_data_license_inventory_flags_every_class_non_tradable() -> None:
    inventory = json.loads((TP09_DIR / "data-license-inventory.json").read_text(encoding="utf-8"))
    assert inventory["inputClasses"], "inventory must enumerate TrendRadar input classes"

    for entry in inventory["inputClasses"]:
        for field in ("input_class", "source_attribution", "license_status", "license_label"):
            assert entry[field], f"inventory entry missing `{field}`"
        assert entry["trading_approved"] is False, (
            f"input class `{entry['input_class']}` must stay non-tradable"
        )


def test_mapping_samples_are_replayable() -> None:
    for name in MAPPING_FILES:
        doc = _load(name)
        assert doc["content_hash"] == _canonical_hash(doc), f"{name} content hash drifted"
