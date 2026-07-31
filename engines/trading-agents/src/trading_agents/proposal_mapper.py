"""TradeProposal and committee artifact mapping helpers for TP04."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from google.protobuf import json_format

from quantos.common.v1 import common_pb2
from quantos.trading.v1 import trading_pb2
from quantos_engine_sdk import input_hash, json_document_from_mapping, timestamp_from_datetime

from trading_agents.adapter import ProposalExecutionContext
from trading_agents.fixtures import DecisionFixture


_BASE_EXPIRES_AT = datetime(2026, 1, 1, tzinfo=timezone.utc)


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
        committee_artifact=committee_artifact | {"artifact_hash": _artifact_hash(committee_artifact)},
        policy_artifact=policy_artifact | {"artifact_hash": _artifact_hash(policy_artifact)},
        stream_events=build_stream_events(proposal_payload, committee_artifact, policy_artifact),
    )


def build_committee_artifact(
    context: ProposalExecutionContext,
    fixture: DecisionFixture,
) -> dict:
    """Build stable multi-view committee debate details."""

    return {
        "artifact_type": "CommitteeDebateArtifact",
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
    seed = "|".join(
        (
            context.workflow_run_id,
            context.account_id,
            context.signal.signal_id,
            fixture.fixture_name,
        )
    ).encode("utf-8")
    digest = hashlib.sha256(seed).digest()
    offset_minutes = int.from_bytes(digest[:4], "big") % (366 * 24 * 60)
    deterministic_start = _BASE_EXPIRES_AT + timedelta(minutes=offset_minutes)

    signal_valid_until = context.signal.valid_until.ToDatetime().astimezone(timezone.utc)
    proposal_window_end = deterministic_start + timedelta(minutes=fixture.validity_minutes)
    return min(signal_valid_until, proposal_window_end)


def _proposal_id(context: ProposalExecutionContext, fixture: DecisionFixture) -> str:
    seed = "|".join(
        (
            context.workflow_run_id,
            context.account_id,
            context.signal.signal_id,
            fixture.fixture_name,
        )
    ).encode("utf-8")
    return f"proposal:{hashlib.sha256(seed).hexdigest()[:16]}"


def _build_evidence_refs(
    context: ProposalExecutionContext,
    fixture: DecisionFixture,
) -> tuple[common_pb2.EvidenceRef, ...]:
    committee_artifact_id = f"committee-debate:{context.workflow_run_id}"
    policy_artifact_id = f"policy-fixture:{context.workflow_run_id}"
    evidence_refs = [
        common_pb2.EvidenceRef(
            evidence_id=f"proposal-evidence:{context.workflow_run_id}:1",
            artifact_id=committee_artifact_id,
            summary=fixture.evidence[0],
        ),
        common_pb2.EvidenceRef(
            evidence_id=f"proposal-evidence:{context.workflow_run_id}:2",
            artifact_id=committee_artifact_id,
            summary=fixture.counter_views[0],
        ),
        common_pb2.EvidenceRef(
            evidence_id=f"proposal-evidence:{context.workflow_run_id}:3",
            artifact_id=policy_artifact_id,
            summary=f"policy fixture: {fixture.policy_rules[0]}",
        ),
    ]
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
