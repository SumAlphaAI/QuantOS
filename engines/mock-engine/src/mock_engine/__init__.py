"""Mock QuantOS engine."""

from quantos_engine_sdk import workspace_name


def run() -> str:
    """Return a deterministic engine banner."""

    return f"{workspace_name()}:mock-engine"
