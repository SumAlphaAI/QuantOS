"""Deterministic signal fixtures for TP03 LLMQuant."""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class SignalFixture:
    fixture_name: str
    symbol: str
    direction: str
    strength: Decimal
    confidence: Decimal
    validity_minutes: int
    strategy_version: str
    model_version: str
    model_digest: str
    data_version: str
    summary: str
    factor_family: tuple[str, ...]
    diagnostics_tags: tuple[str, ...]
    evidence: tuple[str, ...]


@dataclass(frozen=True)
class FixedSignalInput:
    """Deterministic fixed-input case used by the TP03 contract harness."""

    case_id: str
    fixture_name: str
    strategy_release_id: str
    feature_snapshot_id: str
    policy_context_ref: str
    requested_tools: tuple[str, ...]


def _catalog_path() -> Path:
    return Path(__file__).with_name("fixtures") / "catalog.json"


@lru_cache(maxsize=1)
def fixture_catalog() -> tuple[SignalFixture, ...]:
    parsed = json.loads(_catalog_path().read_text(encoding="utf-8"))
    return tuple(
        SignalFixture(
            fixture_name=entry["fixture_name"],
            symbol=entry["symbol"],
            direction=entry["direction"],
            strength=Decimal(entry["strength"]),
            confidence=Decimal(entry["confidence"]),
            validity_minutes=int(entry["validity_minutes"]),
            strategy_version=entry["strategy_version"],
            model_version=entry["model_version"],
            model_digest=entry["model_digest"],
            data_version=entry["data_version"],
            summary=entry["summary"],
            factor_family=tuple(entry["factor_family"]),
            diagnostics_tags=tuple(entry["diagnostics_tags"]),
            evidence=tuple(entry["evidence"]),
        )
        for entry in parsed["fixtures"]
    )


def fixture_names() -> tuple[str, ...]:
    return tuple(fixture.fixture_name for fixture in fixture_catalog())


def load_fixture(fixture_name: str) -> SignalFixture:
    for fixture in fixture_catalog():
        if fixture.fixture_name == fixture_name:
            return fixture
    raise FileNotFoundError(f"fixture `{fixture_name}` was not found")


def fixed_input_cases(total: int = 100) -> tuple[FixedSignalInput, ...]:
    """Build a stable fixed-input matrix for schema and replay validation."""

    catalog = fixture_catalog()
    if total <= 0:
        return ()

    cases: list[FixedSignalInput] = []
    for index in range(total):
        fixture = catalog[index % len(catalog)]
        symbol = fixture.symbol.lower()
        cases.append(
            FixedSignalInput(
                case_id=f"case-{index:03d}",
                fixture_name=fixture.fixture_name,
                strategy_release_id=f"{fixture.strategy_version}.release.{index:03d}",
                feature_snapshot_id=f"feature-snapshot-{symbol}-{index:03d}",
                policy_context_ref=f"policy-signal-{index:03d}",
                requested_tools=("query_snapshot", "query_artifact"),
            )
        )
    return tuple(cases)
