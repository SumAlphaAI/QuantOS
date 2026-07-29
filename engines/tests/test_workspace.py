from mock_engine import run
from quantos_engine_sdk import workspace_name


def test_workspace_name_is_stable() -> None:
    assert workspace_name() == "sumalpha-quantos"


def test_mock_engine_is_deterministic() -> None:
    assert run() == "sumalpha-quantos:mock-engine"
