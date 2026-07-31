"""QuantOS TP04 TradingAgents package."""

from quantos_engine_sdk import workspace_name
from trading_agents.service import TradingAgentsService


def run() -> str:
    """Return a deterministic engine banner."""

    return f"{workspace_name()}:trading-agents"


__all__ = ["TradingAgentsService", "run"]
