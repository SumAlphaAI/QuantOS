"""Provider implementations used to prove TP01-G replaceability."""

from __future__ import annotations

from dataclasses import dataclass

from vibe_adapter.protocols import ResearchContractProvider, ResearchExecutionContract


@dataclass(frozen=True)
class InMemoryResearchContractProvider(ResearchContractProvider):
    """Provider used by tests to replace catalog-backed contracts."""

    contracts: tuple[ResearchExecutionContract, ...]

    def list_fixture_names(self) -> tuple[str, ...]:
        return tuple(contract.fixture_name for contract in self.contracts)

    def load_contract(self, fixture_name: str) -> ResearchExecutionContract:
        for contract in self.contracts:
            if contract.fixture_name == fixture_name:
                return contract
        raise FileNotFoundError(f"fixture `{fixture_name}` was not found")
