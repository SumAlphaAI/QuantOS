"""TradeProposal and committee artifact mapping helpers for TP04."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json

from google.protobuf import json_format

from quantos.common.v1 import common_pb2
from quantos.trading.v1 import trading_pb2
from quantos_engine_sdk import input_hash, json_document_from_mapping, timestamp_from_datetime

from trading_agents.adapter import ProposalExecutionContext
from trading_agents.fixtures import DecisionFixture


@dataclass(frozen=True)
class MappedProposal:
    """Deterministic TradeProposal plus auxiliary committee artifacts."""

    proposal: trading_pb2.TradeProposal
    proposal_payload: dict
    proposal_hash: str
    committee_artifact: dict
    policy_artifact: dict
    stream_events: tuple[dict, ...]


def map_proposal(
    metadata: common_pb2.CommandMetadata,
    context: ProposalExecutionContext,
    fixture: DecisionFixture,
) -> MappedProposal:
    """Map a fixture-backed request to a non-executable TradeProposal."""

    proposal_id = _proposal_id(context, fixture)
    expires_at = _proposal_expiry(context, fixture)
    committee_artifact = build_committee_artifact(context, fixture)
    policy_artifact = build_policy_artifact(context, fixture)

    proposal = trading_pb2.TradeProposal(
        metadata=metadata,
        proposal_id=proposal_id,
        account_id=context.account_id,
        symbol=context.signal.symbol,
        action=_proposal_action_for_fixture(fixture),
        quantity=common_pb2.DecimalValue(value=str(fixture.quantity)),
        notional=common_pb2.DecimalValue(value=str(fixture.notional)),
        signal=context.signal,
        evidence_refs=_build_evidence_refs(context, fixture),
        rationale=fixture.rationale,
        confidence=common_pb2.DecimalValue(value=str(fixture.proposal_confidence)),
        expires_at=timestamp_from_datetime(expires_at),
        executable=False,
        counter_views=list(fixture.counter_views),
    )
    if fixture.limit_price is not None:
        proposal.limit_price.CopyFrom(common_pb2.DecimalValue(value=str(fixture.limit_price)))
    if fixture.stop_price is not None:
        proposal.stop_price.CopyFrom(common_pb2.DecimalValue(value=str(fixture.stop_price)))

    proposal_payload = json_format.MessageToDict(proposal, preserving_proto_field_name=True)
    proposal_payload["executable"] = proposal.executable
    proposal_hash = input_hash(json_document_from_mapping(proposal_payload))

    return MappedProposal(
        proposal=proposal,
        proposal_payload=proposal_payload,
        proposal_hash=proposal_hash,
        committee_artifact=committee_artifact,
        policy_artifact=policy_artifact,
        stream_events=build_stream_events(proposal_payload, committee_artifact, policy_artifact),
    )


def build_committee_artifact(
    context: ProposalExecutionContext,
    fixture: DecisionFixture,
) -> dict:
    """Build stable multi-view committee debate details."""

    return {
        "artifact_type": "CommitteeDebateArtifact",
        "artifact_id": "committee-debate:" + _content_id(context, fixture),
        **_provenance(context, fixture),
        "engine": "trading-agents",
        "workflow_run_id": context.workflow_run_id,
        "proposal_symbol": context.signal.symbol,
        "proposal_action": fixture.action,
        "supporting_views": list(fixture.supporting_views),
        "counter_views": list(fixture.counter_views),
        "research_evidence": list(fixture.evidence),
        "requested_tools": list(context.requested_tools),
        "signal_id": context.signal.signal_id,
    }


def build_policy_artifact(
    context: ProposalExecutionContext,
    fixture: DecisionFixture,
) -> dict:
    """Build stable policy and portfolio context for a proposal."""

    return {
        "artifact_type": "PolicyFixtureArtifact",
        "artifact_id": "policy-fixture:" + _content_id(context, fixture),
        **_provenance(context, fixture),
        "engine": "trading-agents",
        "workflow_run_id": context.workflow_run_id,
        "policy_snapshot_id": context.policy_snapshot_id,
        "portfolio_snapshot_id": context.portfolio_snapshot_id,
        "policy_rules": list(fixture.policy_rules),
        "risk_flags": list(fixture.risk_flags),
        "signal_strategy_release_id": context.signal.strategy_release_id,
        "account_id": context.account_id,
    }


def build_stream_events(
    proposal_payload: dict,
    committee_artifact: dict,
    policy_artifact: dict,
) -> tuple[dict, ...]:
    """Build stable TP04 streaming phases."""

    return (
        {
            "phase": "validated",
            "proposal_id": proposal_payload["proposal_id"],
            "signal_id": proposal_payload["signal"]["signal_id"],
        },
        {
            "phase": "committee_ready",
            "action": proposal_payload["action"],
            "counter_view_count": len(committee_artifact["counter_views"]),
            "policy_snapshot_id": policy_artifact["policy_snapshot_id"],
        },
        {
            "phase": "completed",
            "executable": proposal_payload["executable"],
            "rationale": proposal_payload["rationale"],
        },
    )


def _proposal_expiry(
    context: ProposalExecutionContext,
    fixture: DecisionFixture,
) -> datetime:
    generated = context.signal.generated_at.ToDatetime(tzinfo=timezone.utc)
    valid_until = context.signal.valid_until.ToDatetime(tzinfo=timezone.utc)
    return min(valid_until, generated + timedelta(minutes=fixture.validity_minutes))


def _content_id(context: ProposalExecutionContext, fixture: DecisionFixture) -> str:
    seed = json.dumps(
        [
            context.tenant_id,
            context.workspace_id,
            context.actor_id,
            context.workflow_run_id,
            context.input_hash,
            context.metadata_hash,
            context.policy_context_ref,
            fixture.fixture_digest,
        ],
        separators=(",", ":"),
    )
    return hashlib.sha256(seed.encode()).hexdigest()


def _proposal_id(context: ProposalExecutionContext, fixture: DecisionFixture) -> str:
    return "proposal:" + _content_id(context, fixture)


def _provenance(context: ProposalExecutionContext, fixture: DecisionFixture) -> dict:
    return {
        "audit": {
            "tenant_id": context.tenant_id,
            "workspace_id": context.workspace_id,
            "actor_id": context.actor_id,
            "input_hash": context.input_hash,
            "metadata_hash": context.metadata_hash,
        },
        "fixture_digest": fixture.fixture_digest,
        "decision_basis": "deterministic_committee_fixture_not_live_agents",
        "time_basis": "input_signal_generation_replay",
        "upstream_runtime_loaded": False,
        "tools_executed": False,
        "snapshots_resolved": False,
        "risk_evaluation_performed": False,
        "executable": False,
        "data_query_context": context.data_query_context,
    }


def _build_evidence_refs(
    context: ProposalExecutionContext,
    fixture: DecisionFixture,
) -> tuple[common_pb2.EvidenceRef, ...]:
    committee_artifact_id = "committee-debate:" + _content_id(context, fixture)
    policy_artifact_id = "policy-fixture:" + _content_id(context, fixture)
    evidence_refs = [
        common_pb2.EvidenceRef(
            evidence_id=f"proposal-evidence:{context.workflow_run_id}:1",
            artifact_id=committee_artifact_id,
            summary=fixture.evidence[0],
        )
    ]
    for index, counter_view in enumerate(fixture.counter_views, start=2):
        evidence_refs.append(
            common_pb2.EvidenceRef(
                evidence_id=f"proposal-evidence:{context.workflow_run_id}:{index}",
                artifact_id=committee_artifact_id,
                summary=counter_view,
            )
        )
    evidence_refs.append(
        common_pb2.EvidenceRef(
            evidence_id=f"proposal-evidence:{context.workflow_run_id}:{len(fixture.counter_views) + 2}",
            artifact_id=policy_artifact_id,
            summary=f"policy fixture: {fixture.policy_rules[0]}",
        )
    )
    return tuple(evidence_refs)


def _proposal_action_for_fixture(fixture: DecisionFixture) -> trading_pb2.ProposalAction:
    mapping = {
        "buy": trading_pb2.PROPOSAL_ACTION_BUY,
        "sell": trading_pb2.PROPOSAL_ACTION_SELL,
        "hold": trading_pb2.PROPOSAL_ACTION_HOLD,
        "reduce": trading_pb2.PROPOSAL_ACTION_REDUCE,
    }
    try:
        return mapping[fixture.action]
    except KeyError as error:
        raise ValueError(f"unsupported proposal action `{fixture.action}`") from error


def _artifact_hash(payload: dict) -> str:
    return input_hash(json_document_from_mapping(payload))
