"""ResearchArtifact builders for TP02 RD-Agent."""

from __future__ import annotations

from quantos_engine_sdk import input_hash, json_document_from_mapping

from rd_agent.adapter import ResearchExecutionContext
from rd_agent.fixtures import ResearchFixture


def build_research_artifact(
    context: ResearchExecutionContext,
    fixture: ResearchFixture,
) -> dict:
    """Create a deterministic QuantOS-native ResearchArtifact payload."""

    artifact = {
        "artifact_type": "ResearchArtifact",
        "artifact_kind": fixture.artifact_kind,
        "engine": "rd-agent",
        "capability": context.capability,
        "workflow_run_id": context.workflow_run_id,
        "fixture": fixture.fixture_name,
        "title": fixture.title,
        "summary": fixture.summary,
        "hypothesis": fixture.hypothesis,
        "experiment_plan": list(fixture.experiment_plan),
        "findings": list(fixture.findings),
        "evidence": list(fixture.evidence),
        "data_snapshot_ref": context.data_snapshot_ref,
        "policy_context_ref": context.policy_context_ref,
        "requested_tools": list(context.requested_tools),
        "trade_executable": False,
        "environment": {
            "engine_version": "0.1.0",
            "runtime": "python-sidecar",
            "deterministic_fixture": True,
        },
    }
    artifact["artifact_hash"] = input_hash(json_document_from_mapping(artifact))
    return artifact


def build_stream_events(artifact: dict) -> list[dict]:
    return [
        {
            "phase": "validated",
            "artifact_type": artifact["artifact_type"],
            "requested_tools": artifact["requested_tools"],
        },
        {
            "phase": "research_artifact_ready",
            "artifact_kind": artifact["artifact_kind"],
            "artifact_hash": artifact["artifact_hash"],
        },
        {
            "phase": "completed",
            "summary": artifact["summary"],
        },
    ]
