"""Functional stage boundary: an injected slow statistic is release-only failure."""

from importlib import import_module
from typing import Any

import pytest


@pytest.mark.parametrize("component", ["rd_agent", "openbb_adapter", "llmquant", "trading_agents"])
@pytest.mark.parametrize("release", [False, True])
def test_engine_performance_is_release_only(
    component: str, release: bool, monkeypatch: Any
) -> None:
    module = import_module(f"test_{component}_contract")
    monkeypatch.setenv("QUANTOS_RELEASE_PERFORMANCE", "1" if release else "0")
    monkeypatch.setattr(module, "quantiles", lambda *_args, **_kwargs: [2.0] * 19)
    run = getattr(module, f"test_{component}_p95_response_stays_under_one_second")
    if release:
        with pytest.raises(AssertionError, match="release performance"):
            run()
    else:
        run()
