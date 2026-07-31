"""Deterministic QuantOS OpenBB adapter service."""

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

from openbb_adapter.adapter import OpenBBAdapterRequestAdapter, RequestBoundaryError
from openbb_adapter.license_gate import LicenseGateError
from openbb_adapter.manifest import build_manifest
from openbb_adapter.providers import (
    DataQueryContext,
    DataQueryProvider,
    default_provider_registry,
)


@dataclass
class OpenBBAdapterService:
    """Contract-complete TP05 engine for deterministic data query responses."""

    manifest: EngineManifest = field(default_factory=build_manifest)
    request_adapter: OpenBBAdapterRequestAdapter = field(default_factory=OpenBBAdapterRequestAdapter)
    provider_registry: dict[str, DataQueryProvider] = field(default_factory=default_provider_registry)
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
        translated, result = self._prepare_execution(request, context)
        execution_id = self._execution_id(request)
        self._sleep_with_cancel(execution_id, self._execution_sleep_ms(translated.payload), context)

        normalized_artifact = common_pb2.ArtifactRef(
            artifact_id=f"normalized-data:{request.workflow_run_id}",
            uri=(
                f"supabase://quantos-artifacts/tenant/{translated.context.tenant_id}/"
                f"openbb-adapter/{request.workflow_run_id}/normalized-data.json"
            ),
            media_type="application/json",
            sha256=result.normalized_artifact["artifact_hash"],
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )
        lineage_artifact = common_pb2.ArtifactRef(
            artifact_id=f"data-lineage:{request.workflow_run_id}",
            uri=(
                f"supabase://quantos-artifacts/tenant/{translated.context.tenant_id}/"
                f"openbb-adapter/{request.workflow_run_id}/data-lineage.json"
            ),
            media_type="application/json",
            sha256=result.lineage_artifact["artifact_hash"],
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )
        evidence_refs = [
            common_pb2.EvidenceRef(
                evidence_id=f"data-query-evidence:{request.workflow_run_id}:1",
                artifact_id=lineage_artifact.artifact_id,
                summary=f"license: {result.payload['license']['label']}",
            ),
            common_pb2.EvidenceRef(
                evidence_id=f"data-query-evidence:{request.workflow_run_id}:2",
                artifact_id=lineage_artifact.artifact_id,
                summary=f"source: {result.payload['sources'][0]['source_id']}",
            ),
        ]
        return engine_pb2.ExecuteResponse(
            metadata=request.metadata,
            execution_id=execution_id,
            engine_version=self.manifest.engine_version,
            input_hash=input_hash(request.input),
            artifact_refs=[normalized_artifact, lineage_artifact],
            evidence_refs=evidence_refs,
            output=json_document_from_mapping(result.payload),
            completed_at=timestamp_now(),
        )

    def stream_execute(
        self,
        request: engine_pb2.StreamExecuteRequest,
        context: grpc.ServicerContext,
    ):
        translated, result = self._prepare_execution(request.request, context)
        execution_id = self._execution_id(request.request)
        stream_delay_ms = self._stream_delay_ms(translated.payload)

        normalized_artifact = common_pb2.ArtifactRef(
            artifact_id=f"normalized-data:{request.request.workflow_run_id}",
            uri=(
                f"supabase://quantos-artifacts/tenant/{translated.context.tenant_id}/"
                f"openbb-adapter/{request.request.workflow_run_id}/normalized-data.json"
            ),
            media_type="application/json",
            sha256=result.normalized_artifact["artifact_hash"],
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )
        lineage_artifact = common_pb2.ArtifactRef(
            artifact_id=f"data-lineage:{request.request.workflow_run_id}",
            uri=(
                f"supabase://quantos-artifacts/tenant/{translated.context.tenant_id}/"
                f"openbb-adapter/{request.request.workflow_run_id}/data-lineage.json"
            ),
            media_type="application/json",
            sha256=result.lineage_artifact["artifact_hash"],
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )

        for index, event in enumerate(result.stream_events, start=1):
            if index > 1 and stream_delay_ms > 0:
                self._sleep_with_cancel(execution_id, stream_delay_ms, context)
            self._abort_if_cancelled(execution_id, context)

            is_last = index == len(result.stream_events)
            yield engine_pb2.StreamExecuteResponse(
                metadata=request.request.metadata,
                execution_id=execution_id,
                sequence_id=f"seq-{index}",
                delta=json_document_from_mapping(event),
                artifact_refs=[normalized_artifact, lineage_artifact] if is_last else [],
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
            provider = self.provider_registry[translated.context.provider_name]
            provider_context = DataQueryContext(
                workflow_run_id=translated.context.workflow_run_id,
                tenant_id=translated.context.tenant_id,
                provider_name=translated.context.provider_name,
                dataset=translated.context.dataset,
                schema_ref=translated.context.schema_ref,
                query_text=translated.context.query_text,
                symbols=translated.context.symbols,
                intended_use=translated.context.intended_use,
                deployment_target=translated.context.deployment_target,
                requested_tools=translated.context.requested_tools,
                fixture_name=translated.context.fixture_name,
            )
            result = provider.resolve(provider_context)
            return translated, result
        except FileNotFoundError as error:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(error))
        except KeyError as error:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, f"unsupported provider `{error.args[0]}`")
        except RequestBoundaryError as error:
            context.abort(error.code, str(error))
        except LicenseGateError as error:
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
