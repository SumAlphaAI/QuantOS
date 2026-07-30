"""Deterministic research fixtures for TP02 RD-Agent."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class ResearchFixture:
    fixture_name: str
    artifact_kind: str
    title: str
    summary: str
    hypothesis: str
    experiment_plan: tuple[str, ...]
    findings: tuple[str, ...]
    evidence: tuple[str, ...]


def _catalog_path() -> Path:
    return Path(__file__).with_name("fixtures") / "catalog.json"


@lru_cache(maxsize=1)
def fixture_catalog() -> tuple[ResearchFixture, ...]:
    parsed = json.loads(_catalog_path().read_text(encoding="utf-8"))
    return tuple(
        ResearchFixture(
            fixture_name=entry["fixture_name"],
            artifact_kind=entry["artifact_kind"],
            title=entry["title"],
            summary=entry["summary"],
            hypothesis=entry["hypothesis"],
            experiment_plan=tuple(entry["experiment_plan"]),
            findings=tuple(entry["findings"]),
            evidence=tuple(entry["evidence"]),
        )
        for entry in parsed["fixtures"]
    )


def fixture_names() -> tuple[str, ...]:
    return tuple(fixture.fixture_name for fixture in fixture_catalog())


def load_fixture(fixture_name: str) -> ResearchFixture:
    for fixture in fixture_catalog():
        if fixture.fixture_name == fixture_name:
            return fixture
    raise FileNotFoundError(f"fixture `{fixture_name}` was not found")
