from __future__ import annotations

from engine_contract_harness import assert_five_rpc_contract

from datetime import datetime, timedelta, timezone
from uuid import uuid4
from pathlib import Path

import grpc
import pytest

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import (
    EngineClient,
    json_document_from_mapping,
    json_document_to_mapping,
    timestamp_from_datetime,
    uds_target,
)

from mock_engine import MockEngineService
from quantos_engine_sdk.grpc import serve_engine


def build_metadata(index: int) -> common_pb2.CommandMetadata:
    return common_pb2.CommandMetadata(
        request_id=f"req-{index}",
        tenant_id="tenant-primary",
        workspace_id="workspace-primary",
        actor=common_pb2.ActorRef(
            actor_id=f"actor-{index}",
            actor_kind=common_pb2.ActorKind.ACTOR_KIND_USER,
            display_name="QuantOS Tester",
            capabilities=["research.execute"],
        ),
        correlation_id=f"corr-{index}",
        causation_id=f"cause-{index}",
        mode=common_pb2.RuntimeMode.RUNTIME_MODE_PAPER,
        environment=common_pb2.Environment.ENVIRONMENT_TEST,
        issued_at=timestamp_from_datetime(datetime.now(tz=timezone.utc)),
    )


def valid_execute_request(index: int) -> engine_pb2.ExecuteRequest:
    return engine_pb2.ExecuteRequest(
        metadata=build_metadata(index),
        workflow_run_id=f"run-{index}",
        idempotency_key=f"idem-{index}",
        capability="research.execute",
        input_schema_version="v1",
        data_snapshot_ref="snapshot-1",
        policy_context_ref="policy-1",
        input=json_document_from_mapping({"ticker": "BTCUSDT"}),
        deadline=timestamp_from_datetime(
            datetime.now(tz=timezone.utc) + timedelta(seconds=5)
        ),
    )


def test_mock_engine_contract_all_rpcs(tmp_path: Path) -> None:
    socket_path = Path("/tmp") / f"quantos-mock-engine-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, MockEngineService())
    client = EngineClient(uds_target(socket_path))

    try:
        metadata = build_metadata(1)
        metadata_response = client.get_metadata(
            engine_pb2.GetMetadataRequest(metadata=metadata),
            timeout=5,
        )
        assert metadata_response.engine_name == "mock-engine"
        assert metadata_response.engine_version == "0.1.0"
        assert metadata_response.supported_schema_versions == ["v1"]
        assert metadata_response.capabilities[0].name == "research.execute"

        health_response = client.health(
            engine_pb2.HealthRequest(metadata=metadata),
            timeout=5,
        )
        assert health_response.ready is True
        assert health_response.status == "ready"

        execute_request = engine_pb2.ExecuteRequest(
            metadata=metadata,
            workflow_run_id="run-contract",
            idempotency_key="idem-contract",
            capability="research.execute",
            input_schema_version="v1",
            data_snapshot_ref="snapshot-1",
            policy_context_ref="policy-1",
            input=json_document_from_mapping({"ticker": "BTCUSDT", "sleep_ms": 0}),
            deadline=timestamp_from_datetime(
                datetime.now(tz=timezone.utc) + timedelta(seconds=5)
            ),
        )
        assert_five_rpc_contract(client, execute_request, "mock-engine")
        execute_response = client.execute(execute_request, timeout=5)
        assert execute_response.execution_id == "run-contract:idem-contract"
        assert execute_response.engine_version == "0.1.0"
        assert execute_response.input_hash.startswith("sha256:")
        assert len(execute_response.artifact_refs) == 1
        assert len(execute_response.evidence_refs) == 1
        assert json_document_to_mapping(execute_response.output)["echo"]["ticker"] == "BTCUSDT"

        stream_response = client.stream_execute(
            engine_pb2.StreamExecuteRequest(request=execute_request),
            timeout=5,
        )
        assert len(stream_response) == 2
        assert stream_response[0].done is False
        assert stream_response[1].done is True
        assert stream_response[1].artifact_refs[0].artifact_id == "artifact:run-contract"

        cancel_response = client.cancel(
            engine_pb2.CancelRequest(
                metadata=metadata,
                execution_id=execute_response.execution_id,
                reason="operator-request",
            ),
            timeout=5,
        )
        assert cancel_response.cancelled is True
        assert cancel_response.execution_id == execute_response.execution_id

        with pytest.raises(grpc.RpcError) as invalid:
            client.health(engine_pb2.HealthRequest(), timeout=5)
        assert invalid.value.code() == grpc.StatusCode.INVALID_ARGUMENT
        assert "metadata" in (invalid.value.details() or "")
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


@pytest.mark.parametrize("streaming", [False, True])
@pytest.mark.parametrize("field", ["request_id", "tenant_id", "workspace_id", "actor", "correlation_id", "mode", "environment", "issued_at"])
def test_engine_rejects_invalid_response_metadata(streaming: bool, field: str) -> None:
    metadata = build_metadata(1)
    metadata.ClearField(field)

    class InvalidResponseEngine(MockEngineService):
        def health(self, request, context):
            return engine_pb2.HealthResponse(metadata=metadata, ready=True)

        def stream_execute(self, request, context):
            yield engine_pb2.StreamExecuteResponse(metadata=metadata, done=True)

    socket_path = Path("/tmp") / f"quantos-invalid-response-{uuid4().hex}.sock"
    server = serve_engine(socket_path, InvalidResponseEngine())
    client = EngineClient(uds_target(socket_path))
    try:
        with pytest.raises(grpc.RpcError) as invalid:
            if streaming:
                client.stream_execute(engine_pb2.StreamExecuteRequest(
                    request=valid_execute_request(1),
                ), timeout=5)
            else:
                client.health(engine_pb2.HealthRequest(metadata=build_metadata(1)), timeout=5)
        assert invalid.value.code() == grpc.StatusCode.INTERNAL
        assert "invalid engine response" in (invalid.value.details() or "")
    finally:
        client.close()
        server.stop(grace=0).wait()
        socket_path.unlink(missing_ok=True)


@pytest.mark.parametrize("streaming", [False, True])
@pytest.mark.parametrize("field", ["request_id", "tenant_id", "workspace_id", "actor", "correlation_id", "mode", "environment", "issued_at"])
def test_engine_rejects_request_before_business_handler(streaming: bool, field: str) -> None:
    called = []
    class ObservedEngine(MockEngineService):
        def health(self, request, context):
            called.append(True)
            return super().health(request, context)
        def stream_execute(self, request, context):
            called.append(True)
            yield from super().stream_execute(request, context)
    socket_path = Path("/tmp") / f"quantos-invalid-request-{uuid4().hex}.sock"
    server = serve_engine(socket_path, ObservedEngine())
    client = EngineClient(uds_target(socket_path))
    metadata = build_metadata(1)
    metadata.ClearField(field)
    try:
        with pytest.raises(grpc.RpcError) as invalid:
            if streaming:
                client.stream_execute(engine_pb2.StreamExecuteRequest(request=engine_pb2.ExecuteRequest(metadata=metadata)), timeout=5)
            else:
                client.health(engine_pb2.HealthRequest(metadata=metadata), timeout=5)
        assert invalid.value.code() == grpc.StatusCode.INVALID_ARGUMENT
        assert called == []
    finally:
        client.close()
        server.stop(grace=0).wait()
        socket_path.unlink(missing_ok=True)
