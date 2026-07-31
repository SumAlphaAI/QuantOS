from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import quantiles
from uuid import uuid4

import grpc
import pytest
from google.protobuf import json_format

from llmquant.fixtures import fixed_input_cases, fixture_names
from llmquant.manifest import SIGNAL_CAPABILITY
from llmquant.service import LlmQuantService
from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos.strategy.v1 import strategy_pb2
from quantos_engine_sdk import (
    EngineClient,
    json_document_from_mapping,
    json_document_to_mapping,
    timestamp_from_datetime,
    uds_target,
)
from quantos_engine_sdk.grpc import serve_engine


def build_metadata(index: int, *, capabilities: list[str] | None = None) -> common_pb2.CommandMetadata:
    return common_pb2.CommandMetadata(
        request_id=f"req-{index}",
        tenant_id="tenant-primary",
        workspace_id="workspace-primary",
        actor=common_pb2.ActorRef(
            actor_id=f"actor-{index}",
            actor_kind=common_pb2.ActorKind.ACTOR_KIND_USER,
            display_name="QuantOS Tester",
            capabilities=capabilities or [SIGNAL_CAPABILITY],
        ),
        correlation_id=f"corr-{index}",
        causation_id=f"cause-{index}",
        mode=common_pb2.RuntimeMode.RUNTIME_MODE_RESEARCH,
        environment=common_pb2.Environment.ENVIRONMENT_TEST,
        issued_at=timestamp_from_datetime(datetime.now(tz=timezone.utc)),
    )


def build_request(
    index: int,
    payload: dict,
    *,
    data_snapshot_ref: str | None = None,
) -> engine_pb2.ExecuteRequest:
    return engine_pb2.ExecuteRequest(
        metadata=build_metadata(index),
        workflow_run_id=f"run-{index}",
        idempotency_key=f"idem-{index}",
        capability=SIGNAL_CAPABILITY,
        input_schema_version="v1",
        data_snapshot_ref=data_snapshot_ref or str(payload["feature_snapshot_id"]),
        policy_context_ref=str(payload.get("policy_context_ref", f"policy-{index}")),
        input=json_document_from_mapping(payload),
        deadline=timestamp_from_datetime(
            datetime.now(tz=timezone.utc) + timedelta(seconds=5)
        ),
    )


def parse_signal_output(payload: dict) -> strategy_pb2.Signal:
    signal = strategy_pb2.Signal()
    json_format.ParseDict(payload, signal)
    return signal


def signal_required_fields() -> set[str]:
    schema_path = (
        Path(__file__).resolve().parents[2]
        / "proto"
        / "jsonschema"
        / "v1Signal.schema.json"
    )
    parsed = json.loads(schema_path.read_text(encoding="utf-8"))
    return set(parsed["required"])


def test_llmquant_contract_all_rpcs() -> None:
    socket_path = Path("/tmp") / f"quantos-llmquant-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, LlmQuantService())
    client = EngineClient(uds_target(socket_path))

    try:
        metadata = build_metadata(1)
        metadata_response = client.get_metadata(
            engine_pb2.GetMetadataRequest(metadata=metadata),
            timeout=5,
        )
        assert metadata_response.engine_name == "llmquant"
        assert metadata_response.supported_schema_versions == ["v1"]
        assert len(metadata_response.capabilities) == 1

        health_response = client.health(
            engine_pb2.HealthRequest(metadata=metadata),
            timeout=5,
        )
        assert health_response.ready is True

        execute_request = build_request(
            1,
            {
                "fixture": fixture_names()[0],
                "strategy_release_id": "strategy.trend.v3.release.primary",
                "feature_snapshot_id": "feature-snapshot-btc-primary",
                "policy_context_ref": "policy-signal-primary",
                "tools": ["query_snapshot", "query_artifact"],
            },
        )
        execute_response = client.execute(execute_request, timeout=5)
        output = json_document_to_mapping(execute_response.output)
        signal = parse_signal_output(output)
        diagnostics = json_document_to_mapping(signal.diagnostics)
        assert execute_response.execution_id == "run-1:idem-1"
        assert len(execute_response.artifact_refs) == 2
        assert signal.strategy_release_id == "strategy.trend.v3.release.primary"
        assert signal.symbol == "BTCUSDT"
        assert diagnostics["model_version"] == "llmquant-factor-2026.07.31"
        assert diagnostics["model_provenance"]["feature_snapshot_id"] == "feature-snapshot-btc-primary"

        stream = client.stream_execute(
            engine_pb2.StreamExecuteRequest(request=execute_request),
            timeout=5,
        )
        assert len(stream) == 3
        assert json_document_to_mapping(stream[0].delta)["phase"] == "validated"
        assert json_document_to_mapping(stream[1].delta)["phase"] == "signal_ready"
        assert json_document_to_mapping(stream[2].delta)["phase"] == "completed"
        assert len(stream[2].artifact_refs) == 2

        cancel = client.cancel(
            engine_pb2.CancelRequest(
                metadata=metadata,
                execution_id=execute_response.execution_id,
                reason="operator-request",
            ),
            timeout=5,
        )
        assert cancel.cancelled is True
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_llmquant_is_deterministic_for_fixed_snapshot() -> None:
    socket_path = Path("/tmp") / f"quantos-llmquant-deterministic-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, LlmQuantService())
    client = EngineClient(uds_target(socket_path))

    try:
        request = build_request(
            2,
            {
                "fixture": fixture_names()[1],
                "strategy_release_id": "strategy.reversion.v2.release.primary",
                "feature_snapshot_id": "feature-snapshot-eth-primary",
                "policy_context_ref": "policy-reversion-primary",
                "tools": ["query_snapshot"],
            },
        )
        first = client.execute(request, timeout=5)
        second = client.execute(request, timeout=5)
        first_output = json_document_to_mapping(first.output)
        second_output = json_document_to_mapping(second.output)
        assert first.input_hash == second.input_hash
        assert first_output == second_output
        assert first.artifact_refs[0].sha256 == second.artifact_refs[0].sha256
        assert first.artifact_refs[1].sha256 == second.artifact_refs[1].sha256
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_llmquant_rejects_forbidden_boundary_requests() -> None:
    socket_path = Path("/tmp") / f"quantos-llmquant-boundary-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, LlmQuantService())
    client = EngineClient(uds_target(socket_path))

    try:
        base_payload = {
            "fixture": fixture_names()[0],
            "strategy_release_id": "strategy.trend.v3.release.primary",
            "feature_snapshot_id": "feature-snapshot-btc-primary",
        }
        for payload in (
            {**base_payload, "trade_command": {"side": "buy"}},
            {**base_payload, "secret_ref": "vault://prod/api"},
            {**base_payload, "network_access": True},
            {**base_payload, "tools": ["web_search"]},
            {**base_payload, "venue": "binance"},
        ):
            request = build_request(3, payload)
            with pytest.raises(grpc.RpcError) as error:
                client.execute(request, timeout=5)
            assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_llmquant_requires_release_and_matching_feature_snapshot() -> None:
    socket_path = Path("/tmp") / f"quantos-llmquant-required-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, LlmQuantService())
    client = EngineClient(uds_target(socket_path))

    try:
        missing_release = build_request(
            4,
            {
                "fixture": fixture_names()[0],
                "feature_snapshot_id": "feature-snapshot-btc-primary",
            },
        )
        with pytest.raises(grpc.RpcError) as missing_release_error:
            client.execute(missing_release, timeout=5)
        assert missing_release_error.value.code() == grpc.StatusCode.INVALID_ARGUMENT

        mismatch = build_request(
            5,
            {
                "fixture": fixture_names()[0],
                "strategy_release_id": "strategy.trend.v3.release.primary",
                "feature_snapshot_id": "feature-snapshot-btc-primary",
            },
            data_snapshot_ref="feature-snapshot-btc-mismatch",
        )
        with pytest.raises(grpc.RpcError) as mismatch_error:
            client.execute(mismatch, timeout=5)
        assert mismatch_error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_llmquant_validates_100_fixed_inputs_against_signal_proto() -> None:
    socket_path = Path("/tmp") / f"quantos-llmquant-schema-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, LlmQuantService())
    client = EngineClient(uds_target(socket_path))
    required = signal_required_fields()

    try:
        for index, case in enumerate(fixed_input_cases(100), start=1):
            request = build_request(
                index + 100,
                {
                    "fixture": case.fixture_name,
                    "strategy_release_id": case.strategy_release_id,
                    "feature_snapshot_id": case.feature_snapshot_id,
                    "policy_context_ref": case.policy_context_ref,
                    "tools": list(case.requested_tools),
                },
            )
            response = client.execute(request, timeout=5)
            payload = json_document_to_mapping(response.output)
            signal = parse_signal_output(payload)

            assert required.issubset(payload.keys())
            assert signal.strategy_release_id == case.strategy_release_id
            assert signal.valid_until.seconds > signal.generated_at.seconds
            assert json_document_to_mapping(signal.diagnostics)["model_provenance"][
                "feature_snapshot_id"
            ] == case.feature_snapshot_id
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_llmquant_stream_cancel_takes_effect_within_two_seconds() -> None:
    socket_path = Path("/tmp") / f"quantos-llmquant-cancel-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, LlmQuantService())
    client = EngineClient(uds_target(socket_path))

    try:
        request = build_request(
            7,
            {
                "fixture": fixture_names()[0],
                "strategy_release_id": "strategy.trend.v3.release.primary",
                "feature_snapshot_id": "feature-snapshot-btc-primary",
                "stream_delay_ms": 1_200,
            },
        )
        stream = client._stream_execute(  # noqa: SLF001 - direct stream handle needed for cancel test
            engine_pb2.StreamExecuteRequest(request=request),
            timeout=5,
        )
        first = next(stream)
        assert json_document_to_mapping(first.delta)["phase"] == "validated"

        started_at = time.monotonic()
        cancel = client.cancel(
            engine_pb2.CancelRequest(
                metadata=request.metadata,
                execution_id="run-7:idem-7",
                reason="operator-request",
            ),
            timeout=5,
        )
        assert cancel.cancelled is True

        with pytest.raises(grpc.RpcError) as error:
            next(stream)
        assert error.value.code() == grpc.StatusCode.CANCELLED
        assert time.monotonic() - started_at < 2.0
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_llmquant_p95_response_stays_under_one_second() -> None:
    socket_path = Path("/tmp") / f"quantos-llmquant-latency-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, LlmQuantService())
    client = EngineClient(uds_target(socket_path))

    try:
        durations = []
        for index in range(20):
            request = build_request(
                200 + index,
                {
                    "fixture": fixture_names()[index % len(fixture_names())],
                    "strategy_release_id": f"strategy.signal.release.{index:03d}",
                    "feature_snapshot_id": f"feature-snapshot-latency-{index:03d}",
                },
            )
            started_at = time.monotonic()
            client.execute(request, timeout=5)
            durations.append(time.monotonic() - started_at)

        p95 = quantiles(durations, n=20)[18]
        assert p95 < 1.0
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()
