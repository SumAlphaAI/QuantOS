"""QuantOS-native contracts for replaceable TP01 research providers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ResearchContractProvenance:
    """Compatibility metadata retained while TP01 finishes decoupling."""

    source_adapter: str
    source_surface: str
    absorbed_designs: tuple[str, ...]


@dataclass(frozen=True)
class ResearchExecutionContract:
    """Stable QuantOS contract used by workflow and streaming modules."""

    fixture_name: str
    workflow_family: str
    summary: str
    stream_profile: tuple[str, ...]
    protocol_version: str
    design_capabilities: tuple[str, ...]
    provenance: ResearchContractProvenance


class ResearchContractProvider(Protocol):
    """Provider interface that can replace catalog-backed TP01 implementations."""

    def list_fixture_names(self) -> tuple[str, ...]:
        """Return the supported fixture names."""

    def load_contract(self, fixture_name: str) -> ResearchExecutionContract:
        """Load one deterministic research execution contract."""
