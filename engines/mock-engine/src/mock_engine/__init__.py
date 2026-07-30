"""Deterministic mock engine package."""

from mock_engine.service import MockEngineService
from quantos_engine_sdk import workspace_name


def run() -> str:
    """Return a deterministic engine banner."""

    return f"{workspace_name()}:mock-engine"


__all__ = ["MockEngineService", "run"]
