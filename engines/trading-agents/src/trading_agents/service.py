"""Deterministic QuantOS TradingAgents decision service."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import grpc

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import (
    EngineManifest,
    input_hash,
    json_document_from_mapping,
    timestamp_now,
)

from trading_agents.adapter import RequestBoundaryError, TradingAgentsRequestAdapter
from trading_agents.fixtures import load_fixture
from trading_agents.manifest import build_manifest
from trading_agents.proposal_mapper import map_proposal


@dataclass
class TradingAgentsService:
    """Contract-complete TP04 engine for deterministic TradeProposals."""

    manifest: EngineManifest = field(default_factory=build_manifest)
    request_adapter: TradingAgentsRequestAdapter = field(default_factory=TradingAgentsRequestAdapter)
    _cancelled: set[str] = field(default_factory=set)

    def get_metadata(
        self,
        request: engine_pb2.GetMetadataRequest,
        context: grpc.ServicerContext,
    ) -> engine_pb2.GetMetadataResponse:
        del context
        return self.manifest.to_proto(request.metadata)

    def health(
        self,
        request: engine_pb2.HealthRequest,
        context: grpc.ServicerContext,
    ) -> engine_pb2.HealthResponse:
        del context
        return engine_pb2.HealthResponse(
            metadata=request.metadata,
            ready=True,
            status="ready",
            observed_at=timestamp_now(),
        )

    def execute(
        self,
        request: engine_pb2.ExecuteRequest,
        context: grpc.ServicerContext,
    ) -> engine_pb2.ExecuteResponse:
        translated, mapped = self._prepare_execution(request, context)
        execution_id = self._execution_id(request)
        self._sleep_with_cancel(execution_id, self._execution_sleep_ms(translated.payload), context)

        committee_artifact = common_pb2.ArtifactRef(
            artifact_id=f"committee-debate:{request.workflow_run_id}",
            uri=(
                f"supabase://quantos-artifacts/tenant/{translated.context.tenant_id}/"
                f"trading-agents/{request.workflow_run_id}/committee-debate.json"
            ),
            media_type="application/json",
            sha256=mapped.committee_artifact["artifact_hash"],
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )
        policy_artifact = common_pb2.ArtifactRef(
            artifact_id=f"policy-fixture:{request.workflow_run_id}",
            uri=(
                f"supabase://quantos-artifacts/tenant/{translated.context.tenant_id}/"
                f"trading-agents/{request.workflow_run_id}/policy-fixture.json"
            ),
            media_type="application/json",
            sha256=mapped.policy_artifact["artifact_hash"],
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )
        return engine_pb2.ExecuteResponse(
            metadata=request.metadata,
            execution_id=execution_id,
            engine_version=self.manifest.engine_version,
            input_hash=input_hash(request.input),
            artifact_refs=[committee_artifact, policy_artifact],
            evidence_refs=list(mapped.proposal.evidence_refs),
            output=json_document_from_mapping(mapped.proposal_payload),
            completed_at=timestamp_now(),
        )

    def stream_execute(
        self,
        request: engine_pb2.StreamExecuteRequest,
        context: grpc.ServicerContext,
    ):
        translated, mapped = self._prepare_execution(request.request, context)
        execution_id = self._execution_id(request.request)
        stream_delay_ms = self._stream_delay_ms(translated.payload)

        committee_artifact = common_pb2.ArtifactRef(
            artifact_id=f"committee-debate:{request.request.workflow_run_id}",
            uri=(
                f"supabase://quantos-artifacts/tenant/{translated.context.tenant_id}/"
                f"trading-agents/{request.request.workflow_run_id}/committee-debate.json"
            ),
            media_type="application/json",
            sha256=mapped.committee_artifact["artifact_hash"],
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )
        policy_artifact = common_pb2.ArtifactRef(
            artifact_id=f"policy-fixture:{request.request.workflow_run_id}",
            uri=(
                f"supabase://quantos-artifacts/tenant/{translated.context.tenant_id}/"
                f"trading-agents/{request.request.workflow_run_id}/policy-fixture.json"
            ),
            media_type="application/json",
            sha256=mapped.policy_artifact["artifact_hash"],
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )

        for index, event in enumerate(mapped.stream_events, start=1):
            if index > 1 and stream_delay_ms > 0:
                self._sleep_with_cancel(execution_id, stream_delay_ms, context)
            self._abort_if_cancelled(execution_id, context)

            is_last = index == len(mapped.stream_events)
            yield engine_pb2.StreamExecuteResponse(
                metadata=request.request.metadata,
                execution_id=execution_id,
                sequence_id=f"seq-{index}",
                delta=json_document_from_mapping(event),
                artifact_refs=[committee_artifact, policy_artifact] if is_last else [],
                done=is_last,
                emitted_at=timestamp_now(),
            )

    def cancel(
        self,
        request: engine_pb2.CancelRequest,
        context: grpc.ServicerContext,
    ) -> engine_pb2.CancelResponse:
        del context
        self._cancelled.add(request.execution_id)
        return engine_pb2.CancelResponse(
            metadata=request.metadata,
            execution_id=request.execution_id,
            cancelled=True,
            cancelled_at=timestamp_now(),
        )

    def _prepare_execution(self, request: engine_pb2.ExecuteRequest, context: grpc.ServicerContext):
        try:
            translated = self.request_adapter.translate(request)
            fixture = load_fixture(translated.context.fixture_name)
            mapped = map_proposal(request.metadata, translated.context, fixture)
            return translated, mapped
        except FileNotFoundError as error:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(error))
        except RequestBoundaryError as error:
            context.abort(error.code, str(error))
        raise AssertionError("gRPC abort should have terminated request handling")

    @staticmethod
    def _execution_id(request: engine_pb2.ExecuteRequest) -> str:
        return f"{request.workflow_run_id}:{request.idempotency_key}"

    @staticmethod
    def _execution_sleep_ms(payload: dict) -> int:
        return int(payload.get("sleep_ms", 0) or 0)

    @staticmethod
    def _stream_delay_ms(payload: dict) -> int:
        return int(payload.get("stream_delay_ms", payload.get("sleep_ms", 0)) or 0)

    def _sleep_with_cancel(
        self,
        execution_id: str,
        sleep_ms: int,
        context: grpc.ServicerContext,
    ) -> None:
        if sleep_ms <= 0:
            self._abort_if_cancelled(execution_id, context)
            return

        remaining = sleep_ms / 1000
        while remaining > 0:
            self._abort_if_cancelled(execution_id, context)
            slice_seconds = min(0.05, remaining)
            time.sleep(slice_seconds)
            remaining -= slice_seconds

    def _abort_if_cancelled(self, execution_id: str, context: grpc.ServicerContext) -> None:
        if execution_id in self._cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "execution was cancelled")
