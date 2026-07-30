"""QuantOS-native audit envelope builders for TP01-D."""

from __future__ import annotations

from vibe_adapter.context import VibeExecutionContext
from vibe_adapter.protocols import ResearchExecutionContract


def build_audit_envelope(
    context: VibeExecutionContext,
    contract: ResearchExecutionContract,
    *,
    policy_decision: str,
) -> dict:
    """Emit adapter-local audit metadata without reusing upstream session semantics."""

    return {
        "audit_adapter": "quantos.observability.audit_record",
        "runtime_adapter": "quantos.runtime.workflow_run",
        "auth_adapter": "quantos.auth.context",
        "protocol_version": contract.protocol_version,
        "policy_context_ref": context.policy_context_ref,
        "policy_decision": policy_decision,
        "fixture": contract.fixture_name,
        "workflow_family": contract.workflow_family,
        "actor_id": context.actor_id,
        "allowed_tools": list(context.allowed_tools),
    }
