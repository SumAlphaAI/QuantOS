"""Selective workflow absorption for TP01-D."""

from __future__ import annotations

from dataclasses import dataclass

from vibe_adapter.context import VibeExecutionContext
from vibe_adapter.protocols import ResearchExecutionContract


@dataclass(frozen=True)
class WorkflowPlan:
    """QuantOS-native execution plan derived from an approved fixture."""

    fixture_name: str
    workflow_family: str
    protocol_version: str
    design_capabilities: tuple[str, ...]
    tool_allowlist: tuple[str, ...]
    prompt: str
    data_snapshot_ref: str
    policy_context_ref: str
    provenance: dict[str, object]

    def to_output(self, *, engine_name: str, capability: str, workflow_run_id: str) -> dict:
        return {
            "engine": engine_name,
            "capability": capability,
            "workflow_run_id": workflow_run_id,
            "workflow_contract": "quantos.research.execution_contract",
            "protocol_version": self.protocol_version,
            "fixture": self.fixture_name,
            "workflow_family": self.workflow_family,
            "design_capabilities": list(self.design_capabilities),
            "provenance": self.provenance,
            # Compatibility aliases kept until TP01 deprecation plan is executed.
            "upstream_surface": str(self.provenance["source_surface"]),
            "absorbed_designs": list(self.provenance["absorbed_designs"]),
            "tool_allowlist": list(self.tool_allowlist),
            "prompt": self.prompt,
            "artifact_api": "quantos-artifact-api",
            "data_snapshot_ref": self.data_snapshot_ref,
            "policy_context_ref": self.policy_context_ref,
        }


def build_workflow_plan(
    context: VibeExecutionContext,
    contract: ResearchExecutionContract,
) -> WorkflowPlan:
    """Translate an approved fixture into a QuantOS-native workflow plan."""

    return WorkflowPlan(
        fixture_name=contract.fixture_name,
        workflow_family=contract.workflow_family,
        protocol_version=contract.protocol_version,
        design_capabilities=contract.design_capabilities,
        tool_allowlist=context.allowed_tools,
        prompt=context.prompt,
        data_snapshot_ref=context.data_snapshot_ref,
        policy_context_ref=context.policy_context_ref,
        provenance={
            "source_adapter": contract.provenance.source_adapter,
            "source_surface": contract.provenance.source_surface,
            "absorbed_designs": list(contract.provenance.absorbed_designs),
        },
    )
