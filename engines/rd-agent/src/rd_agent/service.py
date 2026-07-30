"""Deterministic QuantOS RD-Agent service."""

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

from rd_agent.adapter import RdAgentRequestAdapter, RequestBoundaryError
from rd_agent.fixtures import load_fixture
from rd_agent.manifest import build_manifest
from rd_agent.research_artifact import build_research_artifact, build_stream_events


@dataclass
class RdAgentService:
    """Contract-complete TP02 engine for deterministic research artifacts."""

    manifest: EngineManifest = field(default_factory=build_manifest)
    request_adapter: RdAgentRequestAdapter = field(default_factory=RdAgentRequestAdapter)
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
        translated, artifact = self._prepare_execution(request, context)
        execution_id = self._execution_id(request)
        self._maybe_sleep(translated.payload)
        if execution_id in self._cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "execution was cancelled")

        artifact_hash = artifact["artifact_hash"]
        artifact_ref = common_pb2.ArtifactRef(
            artifact_id=f"research-artifact:{request.workflow_run_id}",
            uri=(
                f"supabase://quantos-artifacts/tenant/{translated.context.tenant_id}/"
                f"rd-agent/{request.workflow_run_id}.json"
            ),
            media_type="application/json",
            sha256=artifact_hash,
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )
        evidence_ref = common_pb2.EvidenceRef(
            evidence_id=f"evidence:{request.workflow_run_id}",
            artifact_id=artifact_ref.artifact_id,
            summary="Deterministic rd-agent research evidence",
        )
        return engine_pb2.ExecuteResponse(
            metadata=request.metadata,
            execution_id=execution_id,
            engine_version=self.manifest.engine_version,
            input_hash=input_hash(request.input),
            artifact_refs=[artifact_ref],
            evidence_refs=[evidence_ref],
            output=json_document_from_mapping(artifact),
            completed_at=timestamp_now(),
        )

    def stream_execute(
        self,
        request: engine_pb2.StreamExecuteRequest,
        context: grpc.ServicerContext,
    ):
        translated, artifact = self._prepare_execution(request.request, context)
        execution_id = self._execution_id(request.request)
        self._maybe_sleep(translated.payload)
        if execution_id in self._cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "execution was cancelled")

        artifact_ref = common_pb2.ArtifactRef(
            artifact_id=f"research-artifact:{request.request.workflow_run_id}",
            uri=(
                f"supabase://quantos-artifacts/tenant/{translated.context.tenant_id}/"
                f"rd-agent/{request.request.workflow_run_id}.json"
            ),
            media_type="application/json",
            sha256=artifact["artifact_hash"],
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )
        for index, event in enumerate(build_stream_events(artifact), start=1):
            is_last = index == 3
            yield engine_pb2.StreamExecuteResponse(
                metadata=request.request.metadata,
                execution_id=execution_id,
                sequence_id=f"seq-{index}",
                delta=json_document_from_mapping(event),
                artifact_refs=[artifact_ref] if is_last else [],
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
            artifact = build_research_artifact(translated.context, fixture)
            return translated, artifact
        except FileNotFoundError as error:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(error))
        except RequestBoundaryError as error:
            context.abort(error.code, str(error))
        raise AssertionError("gRPC abort should have terminated request handling")

    @staticmethod
    def _execution_id(request: engine_pb2.ExecuteRequest) -> str:
        return f"{request.workflow_run_id}:{request.idempotency_key}"

    @staticmethod
    def _maybe_sleep(payload: dict) -> None:
        sleep_ms = int(payload.get("sleep_ms", 0) or 0)
        if sleep_ms > 0:
            time.sleep(sleep_ms / 1000)
