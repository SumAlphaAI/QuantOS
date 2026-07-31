"""QuantOS TP05 OpenBB adapter package."""

from openbb_adapter.service import OpenBBAdapterService
from quantos_engine_sdk import workspace_name


def run() -> str:
    """Return a deterministic engine banner."""

    return f"{workspace_name()}:openbb-adapter"


__all__ = ["OpenBBAdapterService", "run"]
