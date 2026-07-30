"""QuantOS TP02 RD-Agent package."""

from rd_agent.service import RdAgentService
from quantos_engine_sdk import workspace_name


def run() -> str:
    """Return a deterministic engine banner."""

    return f"{workspace_name()}:rd-agent"


__all__ = ["RdAgentService", "run"]
