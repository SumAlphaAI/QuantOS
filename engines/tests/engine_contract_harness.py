"""One EngineService contract suite shared by every Python engine fixture."""

from __future__ import annotations

import grpc
import pytest

from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import EngineClient


def assert_five_rpc_contract(
    client: EngineClient,
    valid_request: engine_pb2.ExecuteRequest,
    expected_engine_name: str,
) -> None:
    request = engine_pb2.ExecuteRequest()
    request.CopyFrom(valid_request)
    request.workflow_run_id = f"harness-{valid_request.workflow_run_id}"
    request.idempotency_key = f"harness-{valid_request.idempotency_key}"
    metadata = request.metadata

    engine = client.get_metadata(engine_pb2.GetMetadataRequest(metadata=metadata), timeout=5)
    assert engine.engine_name == expected_engine_name
    assert request.capability in {item.name for item in engine.capabilities}
    assert request.input_schema_version in engine.supported_schema_versions
    health = client.health(engine_pb2.HealthRequest(metadata=metadata), timeout=5)
    assert health.ready is True

    executed = client.execute(request, timeout=5)
    assert executed.execution_id
    assert executed.metadata == metadata
    assert executed.engine_version == engine.engine_version
    assert executed.input_hash.startswith("sha256:")
    streamed = client.stream_execute(
        engine_pb2.StreamExecuteRequest(request=request), timeout=5
    )
    assert streamed and streamed[-1].done
    assert all(item.metadata == metadata for item in streamed)
    cancelled = client.cancel(
        engine_pb2.CancelRequest(
            metadata=metadata,
            execution_id=executed.execution_id,
            reason="harness-cancel",
        ),
        timeout=5,
    )
    assert cancelled.cancelled and cancelled.execution_id == executed.execution_id

    negative_cases = (
        ("capability", "unknown.capability", "ENGINE_CAPABILITY_UNSUPPORTED"),
        ("input_schema_version", "unknown", "ENGINE_SCHEMA_UNSUPPORTED"),
    )
    for field, value, code in negative_cases:
        invalid = engine_pb2.ExecuteRequest()
        invalid.CopyFrom(request)
        setattr(invalid, field, value)
        with pytest.raises(grpc.RpcError) as error:
            client.execute(invalid, timeout=5)
        assert error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
        assert error.value.details() == code

    invalid_input = engine_pb2.ExecuteRequest()
    invalid_input.CopyFrom(request)
    invalid_input.ClearField("input")
    with pytest.raises(grpc.RpcError) as error:
        client.stream_execute(
            engine_pb2.StreamExecuteRequest(request=invalid_input), timeout=5
        )
    assert error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
    assert error.value.details() == "ENGINE_INPUT_INVALID"

    with pytest.raises(grpc.RpcError) as error:
        client.cancel(engine_pb2.CancelRequest(execution_id=executed.execution_id), timeout=5)
    assert error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
