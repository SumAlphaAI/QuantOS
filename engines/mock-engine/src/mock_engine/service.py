"""Deterministic QuantOS mock engine service."""

from __future__ import annotations

import time
import os
import hashlib
import json
import sqlite3
import threading
from pathlib import Path
from dataclasses import dataclass, field

import grpc

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import (
    EngineCapability,
    EngineManifest,
    input_hash,
    json_document_from_mapping,
    json_document_to_mapping,
    timestamp_now,
)


@dataclass
class MockEngineService:
    """Contract-complete deterministic engine used for F08."""

    manifest: EngineManifest = field(
        default_factory=lambda: EngineManifest(
            engine_name="mock-engine",
            engine_version="0.1.0",
            capabilities=(
                EngineCapability(
                    name="research.execute",
                    version="1.0.0",
                    description="Execute deterministic research fixtures.",
                ),
            ),
            supported_schema_versions=("v1",),
        )
    )
    failures_before_success: int = 0
    default_sleep_ms: int = 0
    exit_on_execute: bool = False
    crash_state_file: Path | None = None
    state_db: Path | None = None
    _cancelled: set[str] = field(default_factory=set)
    _remaining_failures: int = field(init=False)
    _results: dict[str, tuple[str, bytes]] = field(default_factory=dict)
    _results_lock: threading.Lock = field(default_factory=threading.Lock)

    def __post_init__(self) -> None:
        self._remaining_failures = max(self.failures_before_success, 0)
        if self.state_db is not None:
            self.state_db.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            if self.state_db.parent.stat().st_mode & 0o077:
                raise ValueError("Mock result cache requires a private directory")
            self.state_db.touch(mode=0o600, exist_ok=True)
            self.state_db.chmod(0o600)
            with sqlite3.connect(self.state_db) as db:
                db.execute("CREATE TABLE IF NOT EXISTS results (request_key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, response BLOB NOT NULL)")

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
        if self.crash_state_file is not None:
            remaining = int(self.crash_state_file.read_text(encoding="utf-8"))
            if remaining > 0:
                self.crash_state_file.write_text(str(remaining - 1), encoding="utf-8")
                os._exit(70)
        if self.exit_on_execute:
            os._exit(70)
        if self._remaining_failures > 0:
            self._remaining_failures -= 1
            context.abort(grpc.StatusCode.UNAVAILABLE, "engine crash")
        if self._execution_id(request) in self._cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "execution was cancelled")

        key = "\0".join((request.metadata.tenant_id, request.capability, request.idempotency_key))
        fingerprint = hashlib.sha256(json.dumps(
            [request.workflow_run_id, request.capability, request.input_schema_version,
             request.data_snapshot_ref, request.policy_context_ref,
             request.metadata.actor.actor_id, input_hash(request.input)],
            separators=(",", ":"), ensure_ascii=False,
        ).encode("utf-8")).hexdigest()
        if self.state_db is not None:
            with sqlite3.connect(self.state_db, timeout=5) as db:
                db.execute("BEGIN IMMEDIATE")
                row = db.execute("SELECT fingerprint, response FROM results WHERE request_key = ?", (key,)).fetchone()
                if row is not None:
                    if row[0] != fingerprint:
                        context.abort(grpc.StatusCode.ALREADY_EXISTS, "ENGINE_IDEMPOTENCY_CONFLICT")
                    cached = engine_pb2.ExecuteResponse.FromString(row[1])
                    cached.metadata.CopyFrom(request.metadata)
                    return cached
                response = self._compute_response(request, context)
                db.execute("INSERT INTO results (request_key, fingerprint, response) VALUES (?, ?, ?)",
                           (key, fingerprint, response.SerializeToString()))
                return response
        with self._results_lock:
            if key in self._results:
                recorded_fingerprint, payload = self._results[key]
                if recorded_fingerprint != fingerprint:
                    context.abort(grpc.StatusCode.ALREADY_EXISTS, "ENGINE_IDEMPOTENCY_CONFLICT")
                cached = engine_pb2.ExecuteResponse.FromString(payload)
                cached.metadata.CopyFrom(request.metadata)
                return cached
            response = self._compute_response(request, context)
            self._results[key] = (fingerprint, response.SerializeToString())
            return response

    def _compute_response(
        self,
        request: engine_pb2.ExecuteRequest,
        context: grpc.ServicerContext,
    ) -> engine_pb2.ExecuteResponse:
        execution_id = self._execution_id(request)
        self._maybe_sleep(request, execution_id, context)
        if execution_id in self._cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "execution was cancelled")
        payload = json_document_to_mapping(request.input)
        return engine_pb2.ExecuteResponse(
            metadata=request.metadata,
            execution_id=execution_id,
            engine_version=self.manifest.engine_version,
            input_hash=input_hash(request.input),
            artifact_refs=[
                common_pb2.ArtifactRef(
                    artifact_id=f"artifact:{request.workflow_run_id}",
                    uri=f"supabase://quantos-artifacts/{request.workflow_run_id}.json",
                    media_type="application/json",
                    sha256=input_hash(request.input),
                    classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
                )
            ],
            evidence_refs=[
                common_pb2.EvidenceRef(
                    evidence_id=f"evidence:{request.workflow_run_id}",
                    artifact_id=f"artifact:{request.workflow_run_id}",
                    summary="Deterministic mock evidence",
                )
            ],
            output=json_document_from_mapping(
                {
                    "engine": self.manifest.engine_name,
                    "capability": request.capability,
                    "schema": request.input_schema_version,
                    "echo": payload,
                }
            ),
            completed_at=timestamp_now(),
        )

    def stream_execute(
        self,
        request: engine_pb2.StreamExecuteRequest,
        context: grpc.ServicerContext,
    ):
        execution_id = self._execution_id(request.request)
        self._maybe_sleep(request.request, execution_id, context)
        if execution_id in self._cancelled:
            context.abort(grpc.StatusCode.CANCELLED, "execution was cancelled")

        payload = json_document_to_mapping(request.request.input)
        yield engine_pb2.StreamExecuteResponse(
            metadata=request.request.metadata,
            execution_id=execution_id,
            sequence_id="seq-1",
            delta=json_document_from_mapping(
                {
                    "phase": "started",
                    "echo_keys": sorted(payload.keys()),
                }
            ),
            done=False,
            emitted_at=timestamp_now(),
        )
        yield engine_pb2.StreamExecuteResponse(
            metadata=request.request.metadata,
            execution_id=execution_id,
            sequence_id="seq-2",
            delta=json_document_from_mapping(
                {
                    "phase": "completed",
                    "summary": f"processed:{request.request.workflow_run_id}",
                }
            ),
            artifact_refs=[
                common_pb2.ArtifactRef(
                    artifact_id=f"artifact:{request.request.workflow_run_id}",
                    uri=f"supabase://quantos-artifacts/{request.request.workflow_run_id}.json",
                    media_type="application/json",
                    sha256=input_hash(request.request.input),
                    classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
                )
            ],
            done=True,
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

    @staticmethod
    def _execution_id(request: engine_pb2.ExecuteRequest) -> str:
        return f"{request.workflow_run_id}:{request.idempotency_key}"

    def _maybe_sleep(
        self,
        request: engine_pb2.ExecuteRequest,
        execution_id: str,
        context: grpc.ServicerContext,
    ) -> None:
        payload = json_document_to_mapping(request.input)
        sleep_ms = int(payload.get("sleep_ms", self.default_sleep_ms) or 0)
        remaining = max(sleep_ms, 0) / 1000
        while remaining > 0:
            if execution_id in self._cancelled or not context.is_active():
                context.abort(grpc.StatusCode.CANCELLED, "execution was cancelled")
            slice_seconds = min(remaining, 0.01)
            time.sleep(slice_seconds)
            remaining -= slice_seconds
