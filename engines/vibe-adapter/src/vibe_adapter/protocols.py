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


STREAM_PHASES = ("context_translated", "workflow_planned", "artifact_recorded")


class ResearchContractError(ValueError):
    """A provider returned a contract outside the QuantOS research protocol."""


def validate_research_contract(contract: ResearchExecutionContract, *, fixture_name: str) -> None:
    """Validate provider output before audit, Artifact or stream projection."""

    def text(value: object) -> bool:
        return isinstance(value, str) and bool(value.strip()) and len(value) <= 8192

    def names(value: object) -> bool:
        return (
            isinstance(value, tuple)
            and 1 <= len(value) <= 32
            and all(text(item) for item in value)
            and len(set(value)) == len(value)
        )

    if not isinstance(contract, ResearchExecutionContract):
        raise ResearchContractError("ENGINE_CONTRACT_INVALID")
    provenance = contract.provenance
    if (
        contract.fixture_name != fixture_name
        or not all(
            text(v) for v in (contract.fixture_name, contract.workflow_family, contract.summary)
        )
        or contract.protocol_version != "quantos.research.v1"
        or contract.stream_profile != STREAM_PHASES
        or not names(contract.design_capabilities)
        or not isinstance(provenance, ResearchContractProvenance)
        or not text(provenance.source_adapter)
        or not text(provenance.source_surface)
        or not names(provenance.absorbed_designs)
    ):
        raise ResearchContractError("ENGINE_CONTRACT_INVALID")


class ResearchContractProvider(Protocol):
    """Provider interface that can replace catalog-backed TP01 implementations."""

    def list_fixture_names(self) -> tuple[str, ...]:
        """Return the supported fixture names."""
        ...

    def load_contract(self, fixture_name: str) -> ResearchExecutionContract:
        """Load one deterministic research execution contract."""
        ...
