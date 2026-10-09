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
        "request_id": context.request_id,
        "correlation_id": context.correlation_id,
        "causation_id": context.causation_id,
        "tenant_id": context.tenant_id,
        "workspace_id": context.workspace_id,
        "workflow_run_id": context.workflow_run_id,
        "data_snapshot_ref": context.data_snapshot_ref,
        "protocol_version": contract.protocol_version,
        "policy_context_ref": context.policy_context_ref,
        "policy_decision": policy_decision,
        "fixture": contract.fixture_name,
        "workflow_family": contract.workflow_family,
        "actor_id": context.actor_id,
        "allowed_tools": list(context.allowed_tools),
    }
