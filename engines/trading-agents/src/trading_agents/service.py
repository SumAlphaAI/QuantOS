"""Deterministic research-only Engine with scoped cancellation and Artifact writes."""

from __future__ import annotations

import json
import hashlib
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock

import grpc

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import EngineManifest, input_hash, json_document_from_mapping, timestamp_now

from trading_agents.adapter import TradingAgentsRequestAdapter, RequestBoundaryError
from trading_agents.artifacts import ProposalArtifactStore
from trading_agents.fixtures import load_fixture
from trading_agents.manifest import build_manifest
from trading_agents.proposal_mapper import map_proposal


@dataclass
class TradingAgentsService:
    """Fixture provider; no upstream runtime, network tool or real snapshot reader."""

    manifest: EngineManifest = field(default_factory=build_manifest)
    request_adapter: TradingAgentsRequestAdapter = field(
        default_factory=TradingAgentsRequestAdapter
    )
    artifacts: ProposalArtifactStore = field(default_factory=ProposalArtifactStore)
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
        translated, mapped = self._prepare_execution(request, context)
        self._wait(request, translated.payload, context)
        refs = self._record(request, mapped, context)
        return engine_pb2.ExecuteResponse(
            metadata=request.metadata,
            execution_id=self._execution_id(request),
            engine_version=self.manifest.engine_version,
            input_hash=input_hash(request.input),
            artifact_refs=refs,
            evidence_refs=list(mapped.proposal.evidence_refs),
            output=json_document_from_mapping(mapped.proposal_payload),
            completed_at=timestamp_now(),
        )

    def stream_execute(self, request, context):
        execution = request.request
        translated, mapped = self._prepare_execution(execution, context)
        self._wait(execution, translated.payload, context)
        events = mapped.stream_events
        for index, event in enumerate(events, start=1):
            if index > 1:
                self._wait(
                    execution, {"sleep_ms": translated.payload.get("stream_delay_ms", 0)}, context
                )
            self._check_active(execution, context)
            done = index == len(events)
            refs = self._record(execution, mapped, context) if done else []
            yield engine_pb2.StreamExecuteResponse(
                metadata=execution.metadata,
                execution_id=self._execution_id(execution),
                sequence_id=f"seq-{index}",
                delta=json_document_from_mapping(event),
                artifact_refs=refs,
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
            mapped = map_proposal(request.metadata, translated.context, fixture)
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
                    request.metadata.SerializeToString(deterministic=True).hex(),
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
            return translated, mapped
        except ValueError:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_FIXTURE_INVALID")
        except FileNotFoundError:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_FIXTURE_UNAVAILABLE")
        except RequestBoundaryError as error:
            logging.getLogger(__name__).warning(
                "trading_agents.policy decision=denied code=%s tenant=%s workspace=%s actor=%s",
                error.code.name,
                hashlib.sha256(request.metadata.tenant_id.encode()).hexdigest(),
                hashlib.sha256(request.metadata.workspace_id.encode()).hexdigest(),
                hashlib.sha256(request.metadata.actor.actor_id.encode()).hexdigest(),
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

    def _record(self, request, mapped, context) -> list[common_pb2.ArtifactRef]:
        owner = self._owner(request.metadata, self._execution_id(request))
        with self._lock:
            self._assert_active(request, context, owner in self._cancelled)
            return self.artifacts.record_bundle(owner, mapped)

    def _wait(self, request, payload, context) -> None:
        until = time.monotonic() + payload.get("sleep_ms", 0) / 1000
        while True:
            self._check_active(request, context)
            remaining = until - time.monotonic()
            if remaining <= 0:
                return
            time.sleep(min(remaining, 0.01))
