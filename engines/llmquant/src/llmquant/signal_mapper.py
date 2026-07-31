"""Signal and provenance mapping helpers for TP03 LLMQuant."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from google.protobuf import json_format

from quantos.common.v1 import common_pb2
from quantos.strategy.v1 import strategy_pb2
from quantos_engine_sdk import input_hash, json_document_from_mapping, timestamp_from_datetime

from llmquant.adapter import SignalExecutionContext
from llmquant.fixtures import SignalFixture


_BASE_GENERATED_AT = datetime(2026, 1, 1, tzinfo=timezone.utc)


@dataclass(frozen=True)
class MappedSignal:
    """Deterministic Signal payload plus auxiliary provenance artifacts."""

    signal: strategy_pb2.Signal
    signal_payload: dict
    signal_hash: str
    model_artifact: dict
    stream_events: tuple[dict, ...]


def map_signal(
    metadata: common_pb2.CommandMetadata,
    context: SignalExecutionContext,
    fixture: SignalFixture,
) -> MappedSignal:
    """Map a fixture-backed request to a QuantOS-native Signal payload."""

    generated_at, valid_until = _deterministic_window(context, fixture)
    diagnostics = build_model_provenance(context, fixture)
    signal = strategy_pb2.Signal(
        metadata=metadata,
        signal_id=_signal_id(context, fixture),
        strategy_release_id=context.strategy_release_id,
        symbol=fixture.symbol,
        direction=_direction_for_fixture(fixture),
        strength=common_pb2.DecimalValue(value=str(fixture.strength)),
        confidence=common_pb2.DecimalValue(value=str(fixture.confidence)),
        diagnostics=json_document_from_mapping(diagnostics),
        generated_at=timestamp_from_datetime(generated_at),
        valid_until=timestamp_from_datetime(valid_until),
        evidence_refs=_build_evidence_refs(context, fixture),
    )
    signal_payload = json_format.MessageToDict(signal, preserving_proto_field_name=True)
    signal_hash = input_hash(json_document_from_mapping(signal_payload))
    model_artifact = build_model_artifact(signal_hash, context, fixture, diagnostics)

    return MappedSignal(
        signal=signal,
        signal_payload=signal_payload,
        signal_hash=signal_hash,
        model_artifact=model_artifact,
        stream_events=build_stream_events(signal_payload, model_artifact),
    )


def build_model_provenance(
    context: SignalExecutionContext,
    fixture: SignalFixture,
) -> dict:
    """Build deterministic diagnostics/model provenance for a Signal."""

    return {
        "engine": "llmquant",
        "runtime": "python-sidecar",
        "deterministic_fixture": True,
        "summary": fixture.summary,
        "strategy_version": fixture.strategy_version,
        "model_version": fixture.model_version,
        "model_digest": fixture.model_digest,
        "data_version": fixture.data_version,
        "factor_family": list(fixture.factor_family),
        "diagnostics_tags": list(fixture.diagnostics_tags),
        "requested_tools": list(context.requested_tools),
        "model_provenance": {
            "strategy_release_id": context.strategy_release_id,
            "feature_snapshot_id": context.feature_snapshot_id,
            "data_snapshot_ref": context.data_snapshot_ref,
            "policy_context_ref": context.policy_context_ref,
            "model_version": fixture.model_version,
            "model_digest": fixture.model_digest,
            "data_version": fixture.data_version,
        },
    }


def build_model_artifact(
    signal_hash: str,
    context: SignalExecutionContext,
    fixture: SignalFixture,
    diagnostics: dict,
) -> dict:
    """Build a stable model provenance artifact referenced by ExecuteResponse."""

    artifact = {
        "artifact_type": "ModelDiagnosticsArtifact",
        "engine": "llmquant",
        "workflow_run_id": context.workflow_run_id,
        "strategy_release_id": context.strategy_release_id,
        "feature_snapshot_id": context.feature_snapshot_id,
        "signal_hash": signal_hash,
        "strategy_version": fixture.strategy_version,
        "model_version": fixture.model_version,
        "model_digest": fixture.model_digest,
        "data_version": fixture.data_version,
        "factor_family": list(fixture.factor_family),
        "diagnostics": diagnostics,
    }
    artifact["artifact_hash"] = input_hash(json_document_from_mapping(artifact))
    return artifact


def build_stream_events(signal_payload: dict, model_artifact: dict) -> tuple[dict, ...]:
    """Build the stable TP03 streaming phases."""

    return (
        {
            "phase": "validated",
            "signal_id": signal_payload["signal_id"],
            "strategy_release_id": signal_payload["strategy_release_id"],
        },
        {
            "phase": "signal_ready",
            "symbol": signal_payload["symbol"],
            "confidence": signal_payload["confidence"]["value"],
            "model_version": model_artifact["model_version"],
        },
        {
            "phase": "completed",
            "signal_hash": model_artifact["signal_hash"],
            "summary": model_artifact["diagnostics"]["summary"],
        },
    )


def _deterministic_window(
    context: SignalExecutionContext,
    fixture: SignalFixture,
) -> tuple[datetime, datetime]:
    seed = "|".join(
        (
            context.workflow_run_id,
            context.strategy_release_id,
            context.feature_snapshot_id,
            fixture.fixture_name,
        )
    ).encode("utf-8")
    digest = hashlib.sha256(seed).digest()
    offset_minutes = int.from_bytes(digest[:4], "big") % (366 * 24 * 60)
    generated_at = _BASE_GENERATED_AT + timedelta(minutes=offset_minutes)
    valid_until = generated_at + timedelta(minutes=fixture.validity_minutes)
    return generated_at, valid_until


def _signal_id(context: SignalExecutionContext, fixture: SignalFixture) -> str:
    seed = "|".join(
        (
            context.workflow_run_id,
            context.strategy_release_id,
            context.feature_snapshot_id,
            fixture.fixture_name,
        )
    ).encode("utf-8")
    return f"signal:{hashlib.sha256(seed).hexdigest()[:16]}"


def _build_evidence_refs(
    context: SignalExecutionContext,
    fixture: SignalFixture,
) -> tuple[common_pb2.EvidenceRef, ...]:
    model_artifact_id = f"model-diagnostics:{context.workflow_run_id}"
    signal_artifact_id = f"signal:{context.workflow_run_id}"
    evidence_refs: list[common_pb2.EvidenceRef] = []
    for index, summary in enumerate(fixture.evidence, start=1):
        evidence_refs.append(
            common_pb2.EvidenceRef(
                evidence_id=f"signal-evidence:{context.workflow_run_id}:{index}",
                artifact_id=model_artifact_id if summary.startswith("artifact:") else signal_artifact_id,
                summary=summary,
            )
        )
    return tuple(evidence_refs)


def _direction_for_fixture(fixture: SignalFixture) -> strategy_pb2.SignalDirection:
    direction_map = {
        "long": strategy_pb2.SIGNAL_DIRECTION_LONG,
        "short": strategy_pb2.SIGNAL_DIRECTION_SHORT,
        "flat": strategy_pb2.SIGNAL_DIRECTION_FLAT,
    }
    try:
        return direction_map[fixture.direction]
    except KeyError as error:
        raise ValueError(f"unsupported fixture direction `{fixture.direction}`") from error
