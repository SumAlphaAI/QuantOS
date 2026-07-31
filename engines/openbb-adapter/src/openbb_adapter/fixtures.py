"""Deterministic data query fixtures for TP05 OpenBB adapter."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class QuerySource:
    source_id: str
    provider: str
    dataset: str
    license_label: str


@dataclass(frozen=True)
class QueryFixture:
    fixture_name: str
    dataset: str
    schema_ref: str
    symbols: tuple[str, ...]
    window: dict
    records: tuple[dict, ...]
    sources: tuple[QuerySource, ...]
    license_label: str
    cache_ttl_secs: int
    lineage_tags: tuple[str, ...]
    allowed_workflows: tuple[str, ...]


@dataclass(frozen=True)
class FixedQueryInput:
    """Deterministic fixed-input case used by the TP05 contract harness."""

    case_id: str
    fixture_name: str
    provider: str
    dataset: str
    schema_ref: str
    query_text: str
    symbols: tuple[str, ...]
    intended_use: str
    deployment_target: str
    requested_tools: tuple[str, ...]


def _catalog_path() -> Path:
    return Path(__file__).with_name("fixtures") / "catalog.json"


@lru_cache(maxsize=1)
def fixture_catalog() -> tuple[QueryFixture, ...]:
    parsed = json.loads(_catalog_path().read_text(encoding="utf-8"))
    return tuple(
        QueryFixture(
            fixture_name=entry["fixture_name"],
            dataset=entry["dataset"],
            schema_ref=entry["schema_ref"],
            symbols=tuple(entry["symbols"]),
            window=dict(entry["window"]),
            records=tuple(dict(record) for record in entry["records"]),
            sources=tuple(
                QuerySource(
                    source_id=source["source_id"],
                    provider=source["provider"],
                    dataset=source["dataset"],
                    license_label=source["license_label"],
                )
                for source in entry["sources"]
            ),
            license_label=entry["license_label"],
            cache_ttl_secs=int(entry["cache_ttl_secs"]),
            lineage_tags=tuple(entry["lineage_tags"]),
            allowed_workflows=tuple(entry["allowed_workflows"]),
        )
        for entry in parsed["fixtures"]
    )


def fixture_names() -> tuple[str, ...]:
    return tuple(fixture.fixture_name for fixture in fixture_catalog())


def load_fixture(fixture_name: str) -> QueryFixture:
    for fixture in fixture_catalog():
        if fixture.fixture_name == fixture_name:
            return fixture
    raise FileNotFoundError(f"fixture `{fixture_name}` was not found")


def fixed_input_cases(total: int = 100) -> tuple[FixedQueryInput, ...]:
    """Build a stable fixed-input matrix for schema and replay validation."""

    catalog = fixture_catalog()
    if total <= 0:
        return ()

    cases: list[FixedQueryInput] = []
    for index in range(total):
        fixture = catalog[index % len(catalog)]
        provider = "mock" if index % 2 == 0 else "openbb"
        cases.append(
            FixedQueryInput(
                case_id=f"case-{index:03d}",
                fixture_name=fixture.fixture_name,
                provider=provider,
                dataset=fixture.dataset,
                schema_ref=fixture.schema_ref,
                query_text=f"query {fixture.dataset} for {'/'.join(fixture.symbols)}",
                symbols=fixture.symbols,
                intended_use="research",
                deployment_target="evaluation" if provider == "openbb" else "test",
                requested_tools=("query_snapshot", "query_artifact"),
            )
        )
    return tuple(cases)
