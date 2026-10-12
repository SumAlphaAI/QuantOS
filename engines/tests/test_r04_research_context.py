"""R04 context is evidence only; it cannot grant Engine execution authority."""
import pytest

from llmquant.adapter import LlmQuantRequestAdapter, RequestBoundaryError as SignalError
from trading_agents.adapter import TradingAgentsRequestAdapter, RequestBoundaryError as ProposalError
from test_llmquant_development import build_request as signal_request
from test_trading_agents_development import build_request as proposal_request


@pytest.mark.parametrize("kind", ["signal", "proposal"])
@pytest.mark.parametrize("context", [None, [], "forged", {"tenant_id": "other"},
                                    {"order": {"execute": True}}, {"shell": "forged"},
                                    {"external_url": "https://example.invalid"}])
def test_research_context_cannot_open_authority(kind, context):
    build, adapter, error = ((signal_request, LlmQuantRequestAdapter, SignalError)
                             if kind == "signal" else
                             (proposal_request, TradingAgentsRequestAdapter, ProposalError))
    request = build(42, "unused", {"research_context": context})
    with pytest.raises(error):
        adapter().translate(request)


@pytest.mark.parametrize("kind", ["signal", "proposal"])
def test_checked_context_remains_evidence(kind):
    build, adapter = ((signal_request, LlmQuantRequestAdapter) if kind == "signal" else
                      (proposal_request, TradingAgentsRequestAdapter))
    context = {"schema_version": "v1", "source": {"workflow_run_id": "synthetic",
               "content_hash": "sha256:" + "a" * 64}, "summary": "synthetic evidence"}
    translated = adapter().translate(build(42, "unused", {"research_context": context}))
    assert translated.context.research_context == context
