"""Project an approved workflow into the QuantOS R03 ResearchArtifact contract.

The projection is data only. It never invokes the reference tool names, loads
upstream memory, or acquires execution authority. R03 verifies and archives it.
"""

from __future__ import annotations

from vibe_adapter.context import VibeExecutionContext
from vibe_adapter.protocols import ResearchExecutionContract


def research_artifact_output(
    output: dict,
    context: VibeExecutionContext,
    contract: ResearchExecutionContract,
    *,
    engine_version: str,
) -> dict:
    return {
        **output,
        "artifact_type": "ResearchArtifact",
        "artifact_kind": "workflow_reference",
        "summary": contract.summary,
        "hypothesis": "Research workflow reference: " + contract.summary,
        "trade_executable": False,
        "environment": {
            "engine_version": engine_version,
            "runtime": "python-sidecar",
            "deterministic_fixture": True,
            "tools_executed": False,
            "snapshot_bytes_resolved": False,
        },
        "data_snapshot_ref": context.data_snapshot_ref,
        "policy_context_ref": context.policy_context_ref,
    }
