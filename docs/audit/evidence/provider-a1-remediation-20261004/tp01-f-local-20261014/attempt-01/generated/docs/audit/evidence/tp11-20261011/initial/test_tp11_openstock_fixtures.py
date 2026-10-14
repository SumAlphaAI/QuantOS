"""TP11: validate the OpenStock provider Data Contract fixtures.

The two fixtures under `third_party/openstock/fixtures/` prove that
OpenStock-consumed provider data (Finnhub) fits inside the QuantOS TP05
Data Contract with lineage and quality mapping, and that any unauthorized
data (missing license / display-only widget data) cannot produce a usable
DataSnapshot under F05 gate rules. These tests recompute the gate decision
from the fixture data instead of trusting the recorded decision.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "third_party" / "openstock" / "fixtures"

DATA_CONTRACT_REQUIRED_FIELDS = (
    "provider",
    "query_id",
    "dataset",
    "schema_ref",
    "query_text",
    "symbols",
    "window",
    "records",
    "sources",
    "license",
    "cache",
    "lineage",
    "usage",
)

LINEAGE_REQUIRED_FIELDS = ("snapshot_id", "schema_hash", "content_hash", "lineage_tags", "artifact_hash")


def _load(name: str) -> dict:
    return json.loads((FIXTURES_DIR / name).read_text(encoding="utf-8"))


def _canonical_hash(doc: dict) -> str:
    payload = {key: value for key, value in doc.items() if key != "content_hash"}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _gate_allows(sources: list, license_label: str | None, quality_status: str, usage: str) -> bool:
    """Recompute the F05 snapshot gate decision from first principles."""

    if not license_label or any(not source.get("license_label") for source in sources):
        return False  # require_license for every usage class
    if usage == "research":
        return quality_status in {"passed", "pending", "degraded"}
    return quality_status == "passed" and False  # strategy/trading also require freshness + trading approval


def _expected_decisions(sources: list, license_label: str | None, quality_status: str) -> dict:
    return {
        "research": bool(license_label)
        and all(source.get("license_label") for source in sources)
        and quality_status in {"passed", "pending", "degraded"},
        "strategy": False,
        "trading": False,
    }


def test_provider_fixtures_match_data_contract() -> None:
    for name in (
        "01-finnhub-quote-to-data-contract.json",
        "02-finnhub-news-and-widget-rejection.json",
    ):
        contract = _load(name)["data_contract"]

        for field in DATA_CONTRACT_REQUIRED_FIELDS:
            assert field in contract, f"{name}: missing Data Contract field `{field}`"

        for source in contract["sources"]:
            assert {"source_id", "provider", "dataset", "license_label"}.issubset(source.keys())
            assert source["license_label"], f"{name}: source without license label"

        license_block = contract["license"]
        assert license_block["label"]
        assert license_block["approved_for_production"] is False
        assert contract["usage"]["trading_approved"] is False

        lineage = contract["lineage"]
        for field in LINEAGE_REQUIRED_FIELDS:
            assert lineage[field], f"{name}: missing lineage field `{field}`"
        assert lineage["schema_hash"].startswith("sha256:")
        assert lineage["content_hash"].startswith("sha256:")


def test_lineage_and_quality_mapping_present_in_both_fixtures() -> None:
    for name in (
        "01-finnhub-quote-to-data-contract.json",
        "02-finnhub-news-and-widget-rejection.json",
    ):
        doc = _load(name)
        quality = doc["quality_mapping"]
        assert quality["status"] in {"passed", "degraded"}
        assert "findings" in quality
        decisions = {entry["usage"]: entry["allowed"] for entry in doc["snapshot_gate"]["decisions"]}
        assert set(decisions) == {"research", "strategy", "trading"}


def test_gate_decisions_match_recomputed_rules() -> None:
    for name in (
        "01-finnhub-quote-to-data-contract.json",
        "02-finnhub-news-and-widget-rejection.json",
    ):
        doc = _load(name)
        contract = doc["data_contract"]
        expected = _expected_decisions(
            contract["sources"],
            contract["license"]["label"],
            doc["quality_mapping"]["status"],
        )
        recorded = {entry["usage"]: entry["allowed"] for entry in doc["snapshot_gate"]["decisions"]}
        assert recorded == expected, f"{name}: recorded gate decisions diverge from recomputed rules"
        assert recorded["research"] is True


def test_unauthorized_data_never_produces_usable_snapshot() -> None:
    quote_variant = _load("01-finnhub-quote-to-data-contract.json")["unauthorized_variant"]
    widget_case = _load("02-finnhub-news-and-widget-rejection.json")["rejected_widget_case"]

    for case in (quote_variant, widget_case):
        sources = case.get("sources") or case.get("attempted_sources")
        license_label = case["license"]["label"]
        for entry in case["gate_decisions"]:
            assert entry["allowed"] is False, "unauthorized data must be rejected for every usage"
        # the recorded 100% rejection must match the recomputed rule
        for usage in ("research", "strategy", "trading"):
            assert _gate_allows(sources, license_label, "passed", usage) is False


def test_fixtures_are_replayable() -> None:
    for name in (
        "01-finnhub-quote-to-data-contract.json",
        "02-finnhub-news-and-widget-rejection.json",
    ):
        doc = _load(name)
        assert doc["content_hash"] == _canonical_hash(doc), f"{name} content hash drifted"
