"""QuantOS TP03 LLMQuant package."""

from llmquant.service import LlmQuantService
from quantos_engine_sdk import workspace_name


def run() -> str:
    """Return a deterministic engine banner."""

    return f"{workspace_name()}:llmquant"


__all__ = ["LlmQuantService", "run"]
