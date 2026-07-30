"""UDS gRPC service for the TP01 vibe adapter selective absorption layer."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import grpc

from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import (
    EngineManifest,
    input_hash,
    json_document_from_mapping,
    timestamp_now,
)

from vibe_adapter.audit import build_audit_envelope
from vibe_adapter.artifact_api import VibeArtifactApi
from vibe_adapter.context import ContextTranslationError, VibeContextTranslator
from vibe_adapter.fixtures import default_contract_provider
from vibe_adapter.manifest import build_manifest
from vibe_adapter.protocols import ResearchContractProvider
from vibe_adapter.streaming import build_stream_deltas
from vibe_adapter.workflow import build_workflow_plan


@dataclass
class VibeAdapterService:
    """Contract-complete selective absorption adapter for TP01-D / TP01-G."""

    manifest: EngineManifest = field(default_factory=build_manifest)
    artifact_api: VibeArtifactApi = field(default_factory=VibeArtifactApi)
    context_translator: VibeContextTranslator = field(default_factory=VibeContextTranslator)
    contract_provider: ResearchContractProvider = field(
        default_factory=default_contract_provider
    )
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
        translated, _contract, plan, output = self._prepare_execution(request, context)
        execution_id = self._execution_id(request)
        self._maybe_sleep(translated.payload)
        if execution_id in self._cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "execution was cancelled")

        bundle = self.artifact_api.record_json_artifact(
            workflow_run_id=translated.context.workflow_run_id,
            tenant_id=translated.context.tenant_id,
            artifact_kind="research-output",
            payload=output,
        )

        return engine_pb2.ExecuteResponse(
            metadata=request.metadata,
            execution_id=execution_id,
            engine_version=self.manifest.engine_version,
            input_hash=input_hash(request.input),
            artifact_refs=[bundle.artifact_ref],
            evidence_refs=[bundle.evidence_ref],
            output=json_document_from_mapping(output),
            completed_at=timestamp_now(),
        )

    def stream_execute(
        self,
        request: engine_pb2.StreamExecuteRequest,
        context: grpc.ServicerContext,
    ):
        translated, contract, plan, output = self._prepare_execution(request.request, context)
        execution_id = self._execution_id(request.request)
        self._maybe_sleep(translated.payload)
        if execution_id in self._cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "execution was cancelled")

        bundle = self.artifact_api.record_json_artifact(
            workflow_run_id=translated.context.workflow_run_id,
            tenant_id=translated.context.tenant_id,
            artifact_kind="stream-output",
            payload=output,
        )
        deltas = build_stream_deltas(translated.context, contract, plan)
        for index, delta in enumerate(deltas, start=1):
            is_last = index == len(deltas)
            yield engine_pb2.StreamExecuteResponse(
                metadata=request.request.metadata,
                execution_id=execution_id,
                sequence_id=f"seq-{index}",
                delta=json_document_from_mapping(delta),
                artifact_refs=[bundle.artifact_ref] if is_last else [],
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

    def _prepare_execution(
        self,
        request: engine_pb2.ExecuteRequest,
        context: grpc.ServicerContext,
    ) -> tuple:
        try:
            translated = self.context_translator.translate(request)
            contract = self.contract_provider.load_contract(translated.context.fixture_name)
            plan = build_workflow_plan(translated.context, contract)
            output = plan.to_output(
                engine_name=self.manifest.engine_name,
                capability=translated.context.capability,
                workflow_run_id=translated.context.workflow_run_id,
            )
            output["audit"] = build_audit_envelope(
                translated.context,
                contract,
                policy_decision="allowed",
            )
            return translated, contract, plan, output
        except FileNotFoundError as error:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(error))
        except ContextTranslationError as error:
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
