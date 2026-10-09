"""UDS gRPC service for the TP01 vibe adapter selective absorption layer."""

from __future__ import annotations

import time
import logging
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock

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
    """TP01-C mock skeleton with replaceable research contract and Artifact facades."""

    manifest: EngineManifest = field(default_factory=build_manifest)
    artifact_api: VibeArtifactApi = field(default_factory=VibeArtifactApi)
    context_translator: VibeContextTranslator = field(default_factory=VibeContextTranslator)
    contract_provider: ResearchContractProvider = field(default_factory=default_contract_provider)
    _cancelled: set[tuple[str, str, str, str]] = field(default_factory=set)
    _owners: set[tuple[str, str, str, str]] = field(default_factory=set)
    _inputs: dict[tuple[str, str, str, str], str] = field(default_factory=dict)
    _lock: Lock = field(default_factory=Lock)

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
        self._wait(request, translated.payload, context)

        bundle = self._record_artifact(request, output, "research-output", context)

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
        self._wait(request.request, translated.payload, context)

        bundle = self._record_artifact(request.request, output, "stream-output", context)
        deltas = build_stream_deltas(translated.context, contract, plan)
        for index, delta in enumerate(deltas, start=1):
            self._check_active(request.request, context)
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
        owner = self._owner(request.metadata, request.execution_id)
        with self._lock:
            known = owner in self._owners
            if known:
                self._cancelled.add(owner)
        if not known:
            logging.getLogger(__name__).warning("vibe_adapter.cancel decision=denied")
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "ENGINE_EXECUTION_UNAVAILABLE")
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
            with self._lock:
                owner = self._owner(request.metadata, self._execution_id(request))
                request_digest = json.dumps(
                    [
                        input_hash(request.input),
                        request.data_snapshot_ref,
                        request.policy_context_ref,
                        request.workflow_run_id,
                        request.idempotency_key,
                    ]
                )
                previous = self._inputs.get(owner)
                if previous is not None and previous != request_digest:
                    raise ContextTranslationError(
                        grpc.StatusCode.ALREADY_EXISTS, "ENGINE_IDEMPOTENCY_CONFLICT"
                    )
                self._inputs[owner] = request_digest
                self._owners.add(owner)
            return translated, contract, plan, output
        except FileNotFoundError:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_FIXTURE_UNAVAILABLE")
        except ContextTranslationError as error:
            logging.getLogger(__name__).warning(
                "vibe_adapter.policy decision=denied code=%s", error.code.name
            )
            context.abort(error.code, str(error))
        except Exception:
            logging.getLogger(__name__).error("vibe_adapter.provider decision=failed")
            context.abort(grpc.StatusCode.INTERNAL, "ENGINE_PROVIDER_FAILED")
        raise AssertionError("gRPC abort should have terminated request handling")

    @staticmethod
    def _execution_id(request: engine_pb2.ExecuteRequest) -> str:
        return f"{request.workflow_run_id}:{request.idempotency_key}"

    @staticmethod
    def _owner(metadata, execution_id: str) -> tuple[str, str, str, str]:
        return (metadata.tenant_id, metadata.workspace_id, metadata.actor.actor_id, execution_id)

    def _check_active(self, request, context: grpc.ServicerContext) -> None:
        owner = self._owner(request.metadata, self._execution_id(request))
        with self._lock:
            cancelled = owner in self._cancelled
        self._assert_active(request, context, cancelled)

    @staticmethod
    def _assert_active(request, context: grpc.ServicerContext, cancelled: bool) -> None:
        if cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "ENGINE_EXECUTION_CANCELLED")
        if request.deadline.ToDatetime(tzinfo=timezone.utc) <= datetime.now(tz=timezone.utc):
            context.abort(grpc.StatusCode.DEADLINE_EXCEEDED, "ENGINE_DEADLINE_EXCEEDED")
        if not context.is_active():
            context.abort(grpc.StatusCode.CANCELLED, "ENGINE_TRANSPORT_CANCELLED")

    def _record_artifact(self, request, output: dict, kind: str, context):
        # Commit and Cancel share a lock: an acknowledged cancellation cannot race a write.
        owner = self._owner(request.metadata, self._execution_id(request))
        with self._lock:
            self._assert_active(request, context, owner in self._cancelled)
            return self.artifact_api.record_json_artifact(
                workflow_run_id=request.workflow_run_id,
                tenant_id=request.metadata.tenant_id,
                artifact_kind=kind,
                payload=output,
            )

    def _wait(self, request, payload: dict, context: grpc.ServicerContext) -> None:
        until = time.monotonic() + payload.get("sleep_ms", 0) / 1000
        while True:
            self._check_active(request, context)
            remaining = until - time.monotonic()
            if remaining <= 0:
                return
            time.sleep(min(remaining, 0.01))
