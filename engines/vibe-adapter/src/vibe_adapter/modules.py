"""QuantOS-owned replaceable research modules and invariant checks.

Implementations are supplied by the host at service construction. Protocol/policy
validation and rollout authority remain in the host, never in request payloads.
"""

from __future__ import annotations

from typing import Protocol

from quantos.engine.v1 import engine_pb2
from vibe_adapter.artifact_api import ArtifactBundle
from vibe_adapter.context import TranslationResult, VibeExecutionContext
from vibe_adapter.protocols import ResearchContractError, ResearchExecutionContract, STREAM_PHASES
from vibe_adapter.workflow import WorkflowPlan


class ResearchContextTranslator(Protocol):
    def translate(self, request: engine_pb2.ExecuteRequest) -> TranslationResult: ...


class ResearchWorkflowPlanner(Protocol):
    def __call__(
        self, context: VibeExecutionContext, contract: ResearchExecutionContract
    ) -> WorkflowPlan: ...


class ResearchAuditBuilder(Protocol):
    def __call__(
        self,
        context: VibeExecutionContext,
        contract: ResearchExecutionContract,
        *,
        policy_decision: str,
    ) -> dict: ...


class ResearchStreamProjector(Protocol):
    def __call__(
        self,
        context: VibeExecutionContext,
        contract: ResearchExecutionContract,
        plan: WorkflowPlan,
        *,
        audit: dict,
    ) -> list[dict]: ...


class ResearchArtifactStore(Protocol):
    def record_json_artifact(
        self, *, workflow_run_id: str, tenant_id: str, artifact_kind: str, payload: dict
    ) -> ArtifactBundle: ...
    def read_json_artifact(self, *, tenant_id: str, artifact_id: str) -> dict: ...


def validate_plan(
    plan: WorkflowPlan, context: VibeExecutionContext, contract: ResearchExecutionContract
) -> None:
    if not isinstance(plan, WorkflowPlan) or (
        plan.fixture_name,
        plan.workflow_family,
        plan.protocol_version,
        plan.design_capabilities,
        plan.tool_allowlist,
        plan.prompt,
        plan.data_snapshot_ref,
        plan.policy_context_ref,
        plan.provenance,
    ) != (
        contract.fixture_name,
        contract.workflow_family,
        contract.protocol_version,
        contract.design_capabilities,
        context.allowed_tools,
        context.prompt,
        context.data_snapshot_ref,
        context.policy_context_ref,
        {
            "source_adapter": contract.provenance.source_adapter,
            "source_surface": contract.provenance.source_surface,
            "absorbed_designs": list(contract.provenance.absorbed_designs),
        },
    ):
        raise ResearchContractError("ENGINE_CONTRACT_INVALID")


def validate_audit(
    audit: dict, context: VibeExecutionContext, contract: ResearchExecutionContract
) -> None:
    expected = {
        "audit_adapter": "quantos.observability.audit_record",
        "runtime_adapter": "quantos.runtime.workflow_run",
        "auth_adapter": "quantos.auth.context",
        **{
            key: getattr(context, key)
            for key in (
                "request_id",
                "correlation_id",
                "causation_id",
                "tenant_id",
                "workspace_id",
                "workflow_run_id",
                "data_snapshot_ref",
                "policy_context_ref",
                "actor_id",
            )
        },
        "protocol_version": contract.protocol_version,
        "policy_decision": "allowed",
        "fixture": contract.fixture_name,
        "workflow_family": contract.workflow_family,
        "allowed_tools": list(context.allowed_tools),
    }
    if audit != expected:
        raise ResearchContractError("ENGINE_CONTRACT_INVALID")


def validate_deltas(
    deltas: list[dict],
    context: VibeExecutionContext,
    contract: ResearchExecutionContract,
    plan: WorkflowPlan,
    audit: dict,
) -> None:
    expected = [
        {
            "phase": STREAM_PHASES[0],
            "fixture": contract.fixture_name,
            "allowed_tools": list(plan.tool_allowlist),
            "workflow_contract": "quantos.research.execution_contract",
            "protocol_version": contract.protocol_version,
        },
        {
            "phase": STREAM_PHASES[1],
            "workflow_family": contract.workflow_family,
            "design_capabilities": list(contract.design_capabilities),
            "data_snapshot_ref": context.data_snapshot_ref,
        },
        {"phase": STREAM_PHASES[2], "summary": contract.summary, "audit": audit},
    ]
    if not isinstance(deltas, list) or deltas != expected:
        raise ResearchContractError("ENGINE_CONTRACT_INVALID")
