"""QuantOS TP01 vibe-adapter package."""

from vibe_adapter.manifest import build_manifest
from vibe_adapter.fixtures import fixture_names
from vibe_adapter.providers import InMemoryResearchContractProvider
from vibe_adapter.service import VibeAdapterService
from quantos_engine_sdk import workspace_name


def run() -> str:
    """Return a deterministic adapter banner."""

    return f"{workspace_name()}:vibe-adapter"


__all__ = [
    "InMemoryResearchContractProvider",
    "VibeAdapterService",
    "build_manifest",
    "fixture_names",
    "run",
]
