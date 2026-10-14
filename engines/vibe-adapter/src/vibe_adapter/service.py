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
from quantos.common.v1 import common_pb2
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
from vibe_adapter.protocols import (
    ResearchContractError,
    ResearchContractProvider,
    validate_research_contract,
)
from vibe_adapter.streaming import build_stream_deltas
from vibe_adapter.workflow import WorkflowPlan, build_workflow_plan
from vibe_adapter.modules import (
    ResearchContextTranslator,
    ResearchWorkflowPlanner,
    ResearchAuditBuilder,
    ResearchStreamProjector,
    ResearchArtifactStore,
    validate_plan,
    validate_audit,
    validate_deltas,
)
from vibe_adapter.rollout import RolloutController, RolloutError, RolloutLease


@dataclass
class VibeAdapterService:
    """TP01-C mock skeleton with replaceable research contract and Artifact facades."""

    manifest: EngineManifest = field(default_factory=build_manifest)
    artifact_api: ResearchArtifactStore = field(default_factory=VibeArtifactApi)
    context_translator: ResearchContextTranslator = field(default_factory=VibeContextTranslator)
    contract_provider: ResearchContractProvider = field(default_factory=default_contract_provider)
    planner: ResearchWorkflowPlanner = build_workflow_plan
    auditor: ResearchAuditBuilder = build_audit_envelope
    projector: ResearchStreamProjector = build_stream_deltas
    compatibility_aliases: bool = True
    _boundary_translator: VibeContextTranslator = field(
        default_factory=VibeContextTranslator, init=False
    )
    rollout: RolloutController | None = None
    fixture_mode: bool = False
    shadow_mode: bool = False
    _cancelled: set[tuple[str, str, str, str]] = field(default_factory=set)
    _owners: set[tuple[str, str, str, str]] = field(default_factory=set)
    _inputs: dict[tuple[str, str, str, str], str] = field(default_factory=dict)
    _lock: Lock = field(default_factory=Lock)

    def __post_init__(self) -> None:
        if self.fixture_mode and self.rollout is not None:
            raise ValueError("ENGINE_ROLLOUT_FIXTURE_CONFLICT")
        if self.shadow_mode:
            # A host-owned shadow service never writes into the primary facade.
            self.artifact_api = VibeArtifactApi(bucket_name="quantos-shadow-artifacts")

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
        translated, _contract, plan, output, lease = self._prepare_execution(request, context)
        execution_id = self._execution_id(request)
        if lease is None:
            self._wait(request, translated.payload, context)
        else:
            self._wait(request, translated.payload, context, lease)

        bundle = self._record_artifact(request, output, "research-output", context, lease)

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
        translated, contract, plan, output, lease = self._prepare_execution(
            request.request, context
        )
        execution_id = self._execution_id(request.request)
        if lease is None:
            self._wait(request.request, translated.payload, context)
        else:
            self._wait(request.request, translated.payload, context, lease)

        # Validate the complete projection before any artifact side effect.
        try:
            deltas = self.projector(
                translated.context, contract, plan, audit=json.loads(json.dumps(output["audit"]))
            )
            validate_plan(plan, translated.context, contract)
            validate_audit(output["audit"], translated.context, contract)
            validate_deltas(deltas, translated.context, contract, plan, output["audit"])
        except ResearchContractError:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_CONTRACT_INVALID")
        except Exception:
            context.abort(grpc.StatusCode.INTERNAL, "ENGINE_PROVIDER_FAILED")
        bundle = self._record_artifact(request.request, output, "stream-output", context, lease)
        for index, delta in enumerate(deltas, start=1):
            self._check_active(request.request, context, lease)
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
            # Mandatory native policy cannot be widened by a replacement translator.
            baseline = self._boundary_translator.translate(request)
            translated = self.context_translator.translate(request)
            if translated != baseline:
                raise ResearchContractError("ENGINE_CONTRACT_INVALID")
            if request.metadata.environment != common_pb2.ENVIRONMENT_TEST:
                raise ContextTranslationError(
                    grpc.StatusCode.PERMISSION_DENIED, "ENGINE_LOCAL_TEST_ONLY"
                )
            owner = self._owner(request.metadata, self._execution_id(request))
            lease = None
            provider = self.contract_provider
            if self.rollout is not None:
                identity = json.dumps([*owner, request.metadata.request_id])
                lease = self.rollout.admit(identity, shadow=self.shadow_mode)
                provider = lease.release.provider
            elif not self.fixture_mode:
                raise RolloutError("ENGINE_ROLLOUT_DISABLED")
            contract = provider.load_contract(translated.context.fixture_name)
            validate_research_contract(contract, fixture_name=translated.context.fixture_name)
            plan = self.planner(translated.context, contract)
            validate_plan(plan, translated.context, contract)
            output = WorkflowPlan.to_output(
                plan,
                engine_name=self.manifest.engine_name,
                capability=translated.context.capability,
                workflow_run_id=translated.context.workflow_run_id,
                compatibility_aliases=self.compatibility_aliases,
            )
            output["audit"] = self.auditor(
                translated.context,
                contract,
                policy_decision="allowed",
            )
            validate_audit(output["audit"], translated.context, contract)
            if lease is not None:
                output["rollout"] = {
                    "release_id": lease.release.release_id,
                    "artifact_sha256": lease.release.artifact_sha256,
                    "shadow": lease.shadow,
                }
            with self._lock:
                owner = self._owner(request.metadata, self._execution_id(request))
                request_digest = json.dumps(
                    [
                        input_hash(request.input),
                        request.data_snapshot_ref,
                        request.policy_context_ref,
                        request.workflow_run_id,
                        request.idempotency_key,
                        request.metadata.request_id,
                        request.metadata.correlation_id,
                        request.metadata.causation_id,
                        lease.release.artifact_sha256 if lease else "fixture",
                    ]
                )
                previous = self._inputs.get(owner)
                if previous is not None and previous != request_digest:
                    raise ContextTranslationError(
                        grpc.StatusCode.ALREADY_EXISTS, "ENGINE_IDEMPOTENCY_CONFLICT"
                    )
                self._inputs[owner] = request_digest
                self._owners.add(owner)
            return translated, contract, plan, output, lease
        except RolloutError as error:
            context.abort(grpc.StatusCode.UNAVAILABLE, str(error))
        except ResearchContractError:
            logging.getLogger(__name__).warning("vibe_adapter.contract decision=denied")
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_CONTRACT_INVALID")
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
        return (
            metadata.tenant_id,
            metadata.workspace_id,
            metadata.actor.actor_id,
            execution_id,
        )

    def _check_active(
        self, request, context: grpc.ServicerContext, lease: RolloutLease | None = None
    ) -> None:
        owner = self._owner(request.metadata, self._execution_id(request))
        with self._lock:
            cancelled = owner in self._cancelled
        if self.rollout is not None and lease is not None:
            try:
                self.rollout.check(lease)
            except RolloutError as error:
                context.abort(grpc.StatusCode.CANCELLED, str(error))
        self._assert_active(request, context, cancelled)

    @staticmethod
    def _assert_active(request, context: grpc.ServicerContext, cancelled: bool) -> None:
        if cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "ENGINE_EXECUTION_CANCELLED")
        if request.deadline.ToDatetime(tzinfo=timezone.utc) <= datetime.now(tz=timezone.utc):
            context.abort(grpc.StatusCode.DEADLINE_EXCEEDED, "ENGINE_DEADLINE_EXCEEDED")
        if not context.is_active():
            context.abort(grpc.StatusCode.CANCELLED, "ENGINE_TRANSPORT_CANCELLED")

    def _record_artifact(
        self, request, output: dict, kind: str, context, lease: RolloutLease | None = None
    ):
        # Commit and Cancel share a lock: an acknowledged cancellation cannot race a write.
        owner = self._owner(request.metadata, self._execution_id(request))
        with self._lock:
            self._assert_active(request, context, owner in self._cancelled)

            def write():
                try:
                    return self.artifact_api.record_json_artifact(
                        workflow_run_id=request.workflow_run_id,
                        tenant_id=request.metadata.tenant_id,
                        artifact_kind="shadow-" + kind if self.shadow_mode else kind,
                        payload=output,
                    )
                except Exception:
                    context.abort(grpc.StatusCode.INTERNAL, "ENGINE_ARTIFACT_FAILED")
                    raise AssertionError("gRPC abort returned")

            if self.rollout is not None and lease is not None:
                try:
                    return self.rollout.commit(lease, write)
                except RolloutError as error:
                    context.abort(grpc.StatusCode.CANCELLED, str(error))
            return write()

    def _wait(
        self,
        request,
        payload: dict,
        context: grpc.ServicerContext,
        lease: RolloutLease | None = None,
    ) -> None:
        until = time.monotonic() + payload.get("sleep_ms", 0) / 1000
        while True:
            self._check_active(request, context, lease)
            remaining = until - time.monotonic()
            if remaining <= 0:
                return
            time.sleep(min(remaining, 0.01))
