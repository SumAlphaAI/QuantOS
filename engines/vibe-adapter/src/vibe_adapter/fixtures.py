"""Replay fixture catalog and default provider for TP01-D / TP01-G."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from vibe_adapter.protocols import (
    ResearchContractProvider,
    ResearchContractProvenance,
    ResearchExecutionContract,
)


def _catalog_path() -> Path:
    return Path(__file__).with_name("fixtures") / "catalog.json"


@lru_cache(maxsize=1)
def fixture_catalog() -> tuple[ResearchExecutionContract, ...]:
    parsed = json.loads(_catalog_path().read_text(encoding="utf-8"))
    return tuple(
        ResearchExecutionContract(
            fixture_name=entry["fixture_name"],
            workflow_family=entry["workflow_family"],
            summary=entry["summary"],
            stream_profile=tuple(entry["stream_phases"]),
            protocol_version=str(entry.get("protocol_version", "quantos.research.v1")),
            design_capabilities=tuple(
                entry.get("design_capabilities", entry["absorbed_designs"])
            ),
            provenance=ResearchContractProvenance(
                source_adapter=str(entry.get("source_adapter", "vibe-catalog")),
                source_surface=entry.get("source_surface", entry["upstream_surface"]),
                absorbed_designs=tuple(entry["absorbed_designs"]),
            ),
        )
        for entry in parsed["fixtures"]
    )


class CatalogResearchContractProvider(ResearchContractProvider):
    """Catalog-backed default provider shipped with the adapter."""

    def list_fixture_names(self) -> tuple[str, ...]:
        return tuple(contract.fixture_name for contract in fixture_catalog())

    def load_contract(self, fixture_name: str) -> ResearchExecutionContract:
        for contract in fixture_catalog():
            if contract.fixture_name == fixture_name:
                return contract
        raise FileNotFoundError(f"fixture `{fixture_name}` was not found")


@lru_cache(maxsize=1)
def default_contract_provider() -> CatalogResearchContractProvider:
    return CatalogResearchContractProvider()


def fixture_names() -> tuple[str, ...]:
    return default_contract_provider().list_fixture_names()


def load_fixture(fixture_name: str) -> ResearchExecutionContract:
    return default_contract_provider().load_contract(fixture_name)
