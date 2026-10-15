"""Deterministic QuantOS strategy-lab generation service."""

from __future__ import annotations

import time
import json
from threading import RLock
from urllib.parse import quote
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

from strategy_lab.adapter import RequestBoundaryError, StrategyLabRequestAdapter
from strategy_lab.generator import (
    FixtureStrategyGenerator,
    StrategyGenerator,
    build_evidence_refs,
    map_prompt_to_strategy,
)
from strategy_lab.manifest import GENERATE_CAPABILITY, build_manifest


@dataclass
class StrategyLabService:
    """Contract-complete TP06 engine for deterministic strategy drafts."""

    manifest: EngineManifest = field(default_factory=build_manifest)
    request_adapter: StrategyLabRequestAdapter = field(default_factory=StrategyLabRequestAdapter)
    generator: StrategyGenerator = field(default_factory=FixtureStrategyGenerator)
    _cancelled: set[tuple[str, ...]] = field(default_factory=set)
    _artifacts: dict[tuple[str, ...], dict] = field(default_factory=dict)
    _lock: RLock = field(default_factory=RLock)

    def read_artifact(self, tenant: str, workspace: str, artifact_id: str) -> dict:
        """Trusted host-only readback. Not an unauthenticated RPC or durable Storage."""
        with self._lock:
            return json.loads(json.dumps(self._artifacts[(tenant, workspace, artifact_id)]))

    @staticmethod
    def _owner(metadata, execution_id: str) -> tuple[str, ...]:
        return (metadata.tenant_id, metadata.workspace_id, metadata.actor.actor_id, execution_id)

    def _commit_artifacts(self, request, generated, context) -> None:
        with self._lock:
            self._abort_if_cancelled(
                self._owner(request.metadata, self._execution_id(request)), context
            )
            pair = [
                ("strategy-draft:", generated.draft_artifact),
                ("static-check:", generated.check_artifact),
            ]
            pending = {
                (
                    request.metadata.tenant_id,
                    request.metadata.workspace_id,
                    prefix + request.workflow_run_id,
                ): document
                for prefix, document in pair
            }
            for key, document in pending.items():
                if key in self._artifacts and self._artifacts[key] != document:
                    context.abort(grpc.StatusCode.ALREADY_EXISTS, "immutable Artifact conflict")
            self._artifacts.update(
                {key: json.loads(json.dumps(doc)) for key, doc in pending.items()}
            )

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
        translated, generated, fixture = self._prepare_execution(request, context)
        execution_id = self._execution_id(request)
        self._sleep_with_cancel(
            self._owner(request.metadata, execution_id),
            self._execution_sleep_ms(translated.payload),
            context,
        )

        self._commit_artifacts(request, generated, context)
        return engine_pb2.ExecuteResponse(
            metadata=request.metadata,
            execution_id=execution_id,
            engine_version=self.manifest.engine_version,
            input_hash=input_hash(request.input),
            artifact_refs=list(
                self._artifact_refs(request, translated.context.tenant_id, generated)
            ),
            evidence_refs=list(
                build_evidence_refs(
                    translated.context,
                    fixture,
                    generated.draft_payload["release_eligible"],
                )
            ),
            output=json_document_from_mapping(generated.draft_payload),
            completed_at=timestamp_now(),
        )

    def stream_execute(
        self,
        request: engine_pb2.StreamExecuteRequest,
        context: grpc.ServicerContext,
    ):
        translated, generated, fixture = self._prepare_execution(request.request, context)
        execution_id = self._execution_id(request.request)
        stream_delay_ms = self._stream_delay_ms(translated.payload)
        artifact_refs = self._artifact_refs(
            request.request, translated.context.tenant_id, generated
        )

        for index, event in enumerate(generated.stream_events, start=1):
            if index > 1 and stream_delay_ms > 0:
                self._sleep_with_cancel(
                    self._owner(request.request.metadata, execution_id), stream_delay_ms, context
                )
            self._abort_if_cancelled(self._owner(request.request.metadata, execution_id), context)

            is_last = index == len(generated.stream_events)
            if is_last:
                self._commit_artifacts(request.request, generated, context)
            yield engine_pb2.StreamExecuteResponse(
                metadata=request.request.metadata,
                execution_id=execution_id,
                sequence_id=f"seq-{index}",
                delta=json_document_from_mapping(event),
                artifact_refs=list(artifact_refs) if is_last else [],
                done=is_last,
                emitted_at=timestamp_now(),
            )

    def cancel(
        self,
        request: engine_pb2.CancelRequest,
        context: grpc.ServicerContext,
    ) -> engine_pb2.CancelResponse:
        if GENERATE_CAPABILITY not in request.metadata.actor.capabilities:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "generation capability required")
        with self._lock:
            self._cancelled.add(self._owner(request.metadata, request.execution_id))
        return engine_pb2.CancelResponse(
            metadata=request.metadata,
            execution_id=request.execution_id,
            cancelled=True,
            cancelled_at=timestamp_now(),
        )

    def _prepare_execution(self, request: engine_pb2.ExecuteRequest, context: grpc.ServicerContext):
        try:
            translated = self.request_adapter.translate(request)
            fixture = self.generator.generate(
                translated.context.prompt, translated.context.fixture_name
            )
            generated = map_prompt_to_strategy(request.metadata, translated.context, fixture)
            return translated, generated, fixture
        except FileNotFoundError as error:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(error))
        except RequestBoundaryError as error:
            context.abort(error.code, str(error))
        except (ValueError, TypeError, AttributeError):
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "invalid generator specification")
        raise AssertionError("gRPC abort should have terminated request handling")

    @staticmethod
    def _artifact_refs(
        request: engine_pb2.ExecuteRequest,
        tenant_id: str,
        generated,
    ) -> tuple[common_pb2.ArtifactRef, ...]:
        base_uri = (
            f"artifact://strategy-lab/{quote(tenant_id, safe='')}/"
            f"{quote(request.metadata.workspace_id, safe='')}/"
            f"{quote(request.workflow_run_id, safe='')}"
        )
        draft_ref = common_pb2.ArtifactRef(
            artifact_id=f"strategy-draft:{request.workflow_run_id}",
            uri=f"{base_uri}/strategy-draft.json",
            media_type="application/json",
            sha256=generated.draft_artifact["artifact_hash"],
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )
        check_ref = common_pb2.ArtifactRef(
            artifact_id=f"static-check:{request.workflow_run_id}",
            uri=f"{base_uri}/static-check.json",
            media_type="application/json",
            sha256=generated.check_artifact["artifact_hash"],
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )
        return (draft_ref, check_ref)

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
        execution_id: tuple[str, ...],
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

    def _abort_if_cancelled(
        self, execution_id: tuple[str, ...], context: grpc.ServicerContext
    ) -> None:
        if not context.is_active() or execution_id in self._cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "execution was cancelled")
