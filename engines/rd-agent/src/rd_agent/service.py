"""Deterministic research-only Engine with scoped cancellation and Artifact writes."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock

import grpc

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import EngineManifest, input_hash, json_document_from_mapping, timestamp_now

from rd_agent.adapter import RdAgentRequestAdapter, RequestBoundaryError
from rd_agent.artifacts import ResearchArtifactStore
from rd_agent.fixtures import load_fixture
from rd_agent.manifest import HYPOTHESIS_CAPABILITY, build_manifest
from rd_agent.research_artifact import build_research_artifact, build_stream_events


@dataclass
class RdAgentService:
    """Fixture provider; no upstream runtime, network tool or real snapshot reader."""

    manifest: EngineManifest = field(default_factory=build_manifest)
    request_adapter: RdAgentRequestAdapter = field(default_factory=RdAgentRequestAdapter)
    artifacts: ResearchArtifactStore = field(default_factory=ResearchArtifactStore)
    _cancelled: set[tuple[str, str, str, str]] = field(default_factory=set)
    _inputs: dict[tuple[str, str, str, str], tuple[str, str]] = field(default_factory=dict)
    _lock: Lock = field(default_factory=Lock)

    def get_metadata(self, request, context) -> engine_pb2.GetMetadataResponse:
        return self.manifest.to_proto(request.metadata)

    def health(self, request, context) -> engine_pb2.HealthResponse:
        return engine_pb2.HealthResponse(
            metadata=request.metadata, ready=True, status="ready", observed_at=timestamp_now()
        )

    def execute(self, request, context) -> engine_pb2.ExecuteResponse:
        translated, artifact = self._prepare_execution(request, context)
        self._wait(request, translated.payload, context)
        ref = self._record(request, artifact, context)
        return engine_pb2.ExecuteResponse(
            metadata=request.metadata,
            execution_id=self._execution_id(request),
            engine_version=self.manifest.engine_version,
            input_hash=input_hash(request.input),
            artifact_refs=[ref],
            evidence_refs=[
                common_pb2.EvidenceRef(
                    evidence_id=f"evidence:{ref.artifact_id}",
                    artifact_id=ref.artifact_id,
                    summary="Deterministic QuantOS fixture research evidence",
                )
            ],
            output=json_document_from_mapping(artifact),
            completed_at=timestamp_now(),
        )

    def stream_execute(self, request, context):
        execution = request.request
        translated, artifact = self._prepare_execution(execution, context)
        self._wait(execution, translated.payload, context)
        events = build_stream_events(artifact)
        for index, event in enumerate(events, start=1):
            self._check_active(execution, context)
            done = index == len(events)
            ref = self._record(execution, artifact, context) if done else None
            yield engine_pb2.StreamExecuteResponse(
                metadata=execution.metadata,
                execution_id=self._execution_id(execution),
                sequence_id=f"seq-{index}",
                delta=json_document_from_mapping(event),
                artifact_refs=[ref] if ref is not None else [],
                done=done,
                emitted_at=timestamp_now(),
            )

    def cancel(self, request, context) -> engine_pb2.CancelResponse:
        owner = self._owner(request.metadata, request.execution_id)
        with self._lock:
            registered = self._inputs.get(owner)
            allowed = (
                registered is not None
                and registered[1] in request.metadata.actor.capabilities
                and request.metadata.mode == common_pb2.RUNTIME_MODE_RESEARCH
            )
            if allowed:
                self._cancelled.add(owner)
        if not allowed:
            context.abort(grpc.StatusCode.PERMISSION_DENIED, "ENGINE_EXECUTION_UNAVAILABLE")
        return engine_pb2.CancelResponse(
            metadata=request.metadata,
            execution_id=request.execution_id,
            cancelled=True,
            cancelled_at=timestamp_now(),
        )

    def _prepare_execution(self, request, context):
        try:
            translated = self.request_adapter.translate(request)
            fixture = load_fixture(translated.context.fixture_name)
            expected_kind = (
                "hypothesis" if request.capability == HYPOTHESIS_CAPABILITY else "experiment"
            )
            if fixture.artifact_kind != expected_kind:
                raise RequestBoundaryError(
                    grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_FIXTURE_CAPABILITY_MISMATCH"
                )
            artifact = build_research_artifact(translated.context, fixture)
            owner = self._owner(request.metadata, self._execution_id(request))
            digest = json.dumps(
                [
                    input_hash(request.input),
                    request.capability,
                    request.workflow_run_id,
                    request.idempotency_key,
                    request.data_snapshot_ref,
                    request.policy_context_ref,
                    request.metadata.request_id,
                    request.metadata.correlation_id,
                    request.metadata.causation_id,
                ]
            )
            with self._lock:
                self._assert_active(request, context, owner in self._cancelled)
                previous = self._inputs.get(owner)
                if previous is not None and previous != (digest, request.capability):
                    raise RequestBoundaryError(
                        grpc.StatusCode.ALREADY_EXISTS, "ENGINE_IDEMPOTENCY_CONFLICT"
                    )
                self._inputs[owner] = (digest, request.capability)
            return translated, artifact
        except FileNotFoundError:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_FIXTURE_UNAVAILABLE")
        except RequestBoundaryError as error:
            logging.getLogger(__name__).warning(
                "rd_agent.policy decision=denied code=%s", error.code.name
            )
            context.abort(error.code, str(error))
        raise AssertionError("gRPC abort should terminate the request")

    @staticmethod
    def _execution_id(request) -> str:
        return f"{request.workflow_run_id}:{request.idempotency_key}"

    @staticmethod
    def _owner(metadata, execution_id) -> tuple[str, str, str, str]:
        return (metadata.tenant_id, metadata.workspace_id, metadata.actor.actor_id, execution_id)

    @staticmethod
    def _assert_active(request, context, cancelled: bool) -> None:
        if cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "ENGINE_EXECUTION_CANCELLED")
        if request.deadline.ToDatetime(tzinfo=timezone.utc) <= datetime.now(tz=timezone.utc):
            context.abort(grpc.StatusCode.DEADLINE_EXCEEDED, "ENGINE_DEADLINE_EXCEEDED")
        if not context.is_active():
            context.abort(grpc.StatusCode.CANCELLED, "ENGINE_TRANSPORT_CANCELLED")

    def _check_active(self, request, context) -> None:
        with self._lock:
            cancelled = (
                self._owner(request.metadata, self._execution_id(request)) in self._cancelled
            )
        self._assert_active(request, context, cancelled)

    def _record(self, request, artifact, context) -> common_pb2.ArtifactRef:
        owner = self._owner(request.metadata, self._execution_id(request))
        with self._lock:
            self._assert_active(request, context, owner in self._cancelled)
            return self.artifacts.record(owner, artifact)

    def _wait(self, request, payload, context) -> None:
        until = time.monotonic() + payload.get("sleep_ms", 0) / 1000
        while True:
            self._check_active(request, context)
            remaining = until - time.monotonic()
            if remaining <= 0:
                return
            time.sleep(min(remaining, 0.01))
