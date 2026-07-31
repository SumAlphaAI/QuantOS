from llmquant import run as llmquant_run
from mock_engine import run
from quantos_engine_sdk import workspace_name
from rd_agent import run as rd_run
from vibe_adapter import run as vibe_run


def test_workspace_name_is_stable() -> None:
    assert workspace_name() == "sumalpha-quantos"


def test_mock_engine_is_deterministic() -> None:
    assert run() == "sumalpha-quantos:mock-engine"


def test_llmquant_is_deterministic() -> None:
    assert llmquant_run() == "sumalpha-quantos:llmquant"


def test_rd_agent_is_deterministic() -> None:
    assert rd_run() == "sumalpha-quantos:rd-agent"


def test_vibe_adapter_is_deterministic() -> None:
    assert vibe_run() == "sumalpha-quantos:vibe-adapter"
