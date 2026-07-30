"""Streaming projection helpers for TP01-D."""

from __future__ import annotations

from vibe_adapter.audit import build_audit_envelope
from vibe_adapter.context import VibeExecutionContext
from vibe_adapter.protocols import ResearchExecutionContract
from vibe_adapter.workflow import WorkflowPlan


def build_stream_deltas(
    context: VibeExecutionContext,
    contract: ResearchExecutionContract,
    plan: WorkflowPlan,
) -> list[dict]:
    """Project a workflow plan into QuantOS-native streaming deltas."""

    phases = list(contract.stream_profile)
    audit = build_audit_envelope(context, contract, policy_decision="allowed")

    deltas = [
        {
            "phase": phases[0],
            "fixture": contract.fixture_name,
            "allowed_tools": list(plan.tool_allowlist),
            "workflow_contract": "quantos.research.execution_contract",
            "protocol_version": contract.protocol_version,
        },
        {
            "phase": phases[1],
            "workflow_family": contract.workflow_family,
            "design_capabilities": list(contract.design_capabilities),
            "data_snapshot_ref": context.data_snapshot_ref,
        },
        {
            "phase": phases[2],
            "summary": contract.summary,
            "audit": audit,
        },
    ]
    return deltas
