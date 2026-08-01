"""Deterministic strategy draft generation and artifact mapping for TP06."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from quantos.common.v1 import common_pb2
from quantos_engine_sdk import input_hash, json_document_from_mapping

from strategy_lab.adapter import StrategyLabExecutionContext
from strategy_lab.fixtures import StrategyLabFixture
from strategy_lab.static_checks import run_static_checks


@dataclass(frozen=True)
class GeneratedStrategy:
    """Deterministic strategy draft payload plus draft/check artifacts."""

    draft_payload: dict
    draft_artifact: dict
    check_artifact: dict
    stream_events: tuple[dict, ...]


def map_prompt_to_strategy(
    metadata: common_pb2.CommandMetadata,
    context: StrategyLabExecutionContext,
    fixture: StrategyLabFixture,
) -> GeneratedStrategy:
    """Map a validated prompt to a strategy draft plus static check artifacts."""

    parameters = {
        "lookback": fixture.lookback,
        "entry_threshold_bps": fixture.entry_threshold_bps,
        "exit_threshold_bps": fixture.exit_threshold_bps,
        "max_position_notional": fixture.max_position_notional,
        "universe": list(fixture.universe),
    }
    report = run_static_checks(fixture.rule, parameters, fixture.rule_source)
    release_eligible = report.passed
    prompt_hash = hashlib.sha256(context.prompt.encode("utf-8")).hexdigest()

    draft_payload = {
        "artifact_type": "StrategyDraftArtifact",
        "engine": "strategy-lab",
        "request_id": metadata.request_id,
        "workflow_run_id": context.workflow_run_id,
        "prompt_hash": f"sha256:{prompt_hash}",
        "data_snapshot_ref": context.data_snapshot_ref,
        "policy_context_ref": context.policy_context_ref,
        "strategy": {
            "name": fixture.strategy_name,
            "rule": fixture.rule,
            "parameters": parameters,
            "rule_source": fixture.rule_source,
        },
        "release_eligible": release_eligible,
        "static_check": {
            "passed": report.passed,
            "findings": list(report.findings),
        },
        "summary": fixture.summary,
    }

    check_artifact = {
        "artifact_type": "StaticCheckArtifact",
        "engine": "strategy-lab",
        "workflow_run_id": context.workflow_run_id,
        "strategy_name": fixture.strategy_name,
        "passed": report.passed,
        "findings": list(report.findings),
        "blocked_release": not report.passed,
        "requested_tools": list(context.requested_tools),
    }

    draft_artifact = draft_payload | {"artifact_hash": _artifact_hash(draft_payload)}
    check_artifact = check_artifact | {"artifact_hash": _artifact_hash(check_artifact)}

    stream_events = (
        {
            "phase": "validated",
            "strategy_name": fixture.strategy_name,
            "prompt_hash": draft_payload["prompt_hash"],
        },
        {
            "phase": "draft_ready",
            "rule": fixture.rule,
            "lookback": fixture.lookback,
        },
        {
            "phase": "completed",
            "release_eligible": release_eligible,
            "finding_count": len(report.findings),
        },
    )
    return GeneratedStrategy(
        draft_payload=draft_payload,
        draft_artifact=draft_artifact,
        check_artifact=check_artifact,
        stream_events=stream_events,
    )


def build_evidence_refs(
    context: StrategyLabExecutionContext,
    fixture: StrategyLabFixture,
    release_eligible: bool,
) -> tuple[common_pb2.EvidenceRef, ...]:
    draft_artifact_id = f"strategy-draft:{context.workflow_run_id}"
    check_artifact_id = f"static-check:{context.workflow_run_id}"
    refs = [
        common_pb2.EvidenceRef(
            evidence_id=f"strategy-evidence:{context.workflow_run_id}:{index}",
            artifact_id=draft_artifact_id,
            summary=summary,
        )
        for index, summary in enumerate(fixture.evidence, start=1)
    ]
    refs.append(
        common_pb2.EvidenceRef(
            evidence_id=f"strategy-evidence:{context.workflow_run_id}:{len(refs) + 1}",
            artifact_id=check_artifact_id,
            summary=f"static check passed={release_eligible}",
        )
    )
    return tuple(refs)


def _artifact_hash(payload: dict) -> str:
    return input_hash(json_document_from_mapping(payload))
