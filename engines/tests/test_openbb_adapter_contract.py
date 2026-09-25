from __future__ import annotations

from engine_contract_harness import assert_five_rpc_contract

from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import quantiles
from uuid import uuid4
import time

import grpc
import pytest

from openbb_adapter.fixtures import fixed_input_cases, load_fixture
from openbb_adapter.license_gate import main as license_gate_main
from openbb_adapter.manifest import DATA_QUERY_CAPABILITY
from openbb_adapter.service import OpenBBAdapterService
from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
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
            capabilities=capabilities or [DATA_QUERY_CAPABILITY],
        ),
        correlation_id=f"corr-{index}",
        causation_id=f"cause-{index}",
        mode=common_pb2.RuntimeMode.RUNTIME_MODE_RESEARCH,
        environment=common_pb2.Environment.ENVIRONMENT_TEST,
        issued_at=timestamp_from_datetime(datetime.now(tz=timezone.utc)),
    )


def build_request(index: int, payload: dict) -> engine_pb2.ExecuteRequest:
    return engine_pb2.ExecuteRequest(
        metadata=build_metadata(index),
        workflow_run_id=f"run-{index}",
        idempotency_key=f"idem-{index}",
        capability=DATA_QUERY_CAPABILITY,
        input_schema_version="v1",
        data_snapshot_ref=f"query-snapshot-{index}",
        policy_context_ref=f"policy-{index}",
        input=json_document_from_mapping(payload),
        deadline=timestamp_from_datetime(
            datetime.now(tz=timezone.utc) + timedelta(seconds=5)
        ),
    )


def test_openbb_adapter_contract_all_rpcs() -> None:
    socket_path = Path("/tmp") / f"quantos-openbb-adapter-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, OpenBBAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        metadata = build_metadata(1)
        metadata_response = client.get_metadata(
            engine_pb2.GetMetadataRequest(metadata=metadata),
            timeout=5,
        )
        assert metadata_response.engine_name == "openbb-adapter"
        assert metadata_response.supported_schema_versions == ["v1"]
        assert len(metadata_response.capabilities) == 1

        health_response = client.health(
            engine_pb2.HealthRequest(metadata=metadata),
            timeout=5,
        )
        assert health_response.ready is True

        fixture = load_fixture("crypto_market_btc")
        execute_request = build_request(
            1,
            {
                "provider": "mock",
                "fixture": fixture.fixture_name,
                "dataset": fixture.dataset,
                "schema_ref": fixture.schema_ref,
                "query_text": "btc market snapshot",
                "symbols": list(fixture.symbols),
                "intended_use": "research",
                "deployment_target": "test",
                "tools": ["query_snapshot", "query_artifact"],
            },
        )
        assert_five_rpc_contract(client, execute_request, "openbb-adapter")
        execute_response = client.execute(execute_request, timeout=5)
        output = json_document_to_mapping(execute_response.output)
        assert execute_response.execution_id == "run-1:idem-1"
        assert len(execute_response.artifact_refs) == 2
        assert output["response_type"] == "DataQueryResponse"
        assert output["provider"] == "mock"
        assert output["license"]["label"] == "internal-test-only"
        assert output["usage"]["trading_approved"] is False
        assert output["lineage"]["content_hash"].startswith("sha256:")

        stream = client.stream_execute(
            engine_pb2.StreamExecuteRequest(request=execute_request),
            timeout=5,
        )
        assert len(stream) == 3
        assert json_document_to_mapping(stream[0].delta)["phase"] == "validated"
        assert json_document_to_mapping(stream[1].delta)["phase"] == "lineage_ready"
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


def test_openbb_evaluation_provider_returns_lineage_and_agpl_tags() -> None:
    socket_path = Path("/tmp") / f"quantos-openbb-adapter-eval-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, OpenBBAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        fixture = load_fixture("equity_fundamentals_nvda")
        request = build_request(
            2,
            {
                "provider": "openbb",
                "fixture": fixture.fixture_name,
                "dataset": fixture.dataset,
                "schema_ref": fixture.schema_ref,
                "query_text": "nvda fundamentals",
                "symbols": list(fixture.symbols),
                "intended_use": "evaluation",
                "deployment_target": "evaluation",
            },
        )
        response = client.execute(request, timeout=5)
        payload = json_document_to_mapping(response.output)
        assert payload["provider"] == "openbb"
        assert payload["license"]["label"] == "AGPL-3.0-only"
        assert payload["license"]["approved_for_production"] is False
        assert payload["upstream"]["repo"].startswith("https://github.com/OpenBB-finance/OpenBB")
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_openbb_adapter_is_deterministic_for_fixed_query() -> None:
    socket_path = Path("/tmp") / f"quantos-openbb-adapter-deterministic-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, OpenBBAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        fixture = load_fixture("macro_research_rates")
        request = build_request(
            3,
            {
                "provider": "mock",
                "fixture": fixture.fixture_name,
                "dataset": fixture.dataset,
                "schema_ref": fixture.schema_ref,
                "query_text": "rates snapshot",
                "symbols": list(fixture.symbols),
                "intended_use": "research",
                "deployment_target": "test",
            },
        )
        first = client.execute(request, timeout=5)
        second = client.execute(request, timeout=5)
        assert json_document_to_mapping(first.output) == json_document_to_mapping(second.output)
        assert first.artifact_refs[0].sha256 == second.artifact_refs[0].sha256
        assert first.artifact_refs[1].sha256 == second.artifact_refs[1].sha256
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_openbb_adapter_rejects_forbidden_boundary_requests() -> None:
    socket_path = Path("/tmp") / f"quantos-openbb-adapter-boundary-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, OpenBBAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        fixture = load_fixture("crypto_market_btc")
        base_payload = {
            "provider": "mock",
            "fixture": fixture.fixture_name,
            "dataset": fixture.dataset,
            "schema_ref": fixture.schema_ref,
            "query_text": "btc market snapshot",
            "symbols": list(fixture.symbols),
            "intended_use": "research",
            "deployment_target": "test",
        }
        for payload in (
            {**base_payload, "trade_command": {"side": "buy"}},
            {**base_payload, "secret_ref": "vault://prod/api"},
            {**base_payload, "network_access": True},
            {**base_payload, "tools": ["web_search"]},
            {**base_payload, "venue": "binance"},
        ):
            request = build_request(4, payload)
            with pytest.raises(grpc.RpcError) as error:
                client.execute(request, timeout=5)
            assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_openbb_adapter_blocks_trading_use_and_production_gate() -> None:
    socket_path = Path("/tmp") / f"quantos-openbb-adapter-gate-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, OpenBBAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        fixture = load_fixture("crypto_market_btc")
        trading_request = build_request(
            5,
            {
                "provider": "mock",
                "fixture": fixture.fixture_name,
                "dataset": fixture.dataset,
                "schema_ref": fixture.schema_ref,
                "query_text": "btc market snapshot",
                "symbols": list(fixture.symbols),
                "intended_use": "trading",
                "deployment_target": "test",
            },
        )
        with pytest.raises(grpc.RpcError) as trading_error:
            client.execute(trading_request, timeout=5)
        assert trading_error.value.code() == grpc.StatusCode.PERMISSION_DENIED

        production_request = build_request(
            6,
            {
                "provider": "openbb",
                "fixture": fixture.fixture_name,
                "dataset": fixture.dataset,
                "schema_ref": fixture.schema_ref,
                "query_text": "btc market snapshot",
                "symbols": list(fixture.symbols),
                "intended_use": "evaluation",
                "deployment_target": "production",
            },
        )
        with pytest.raises(grpc.RpcError) as production_error:
            client.execute(production_request, timeout=5)
        assert production_error.value.code() == grpc.StatusCode.FAILED_PRECONDITION
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_openbb_adapter_validates_100_fixed_inputs() -> None:
    socket_path = Path("/tmp") / f"quantos-openbb-adapter-schema-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, OpenBBAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        for index, case in enumerate(fixed_input_cases(100), start=1):
            request = build_request(
                index + 100,
                {
                    "provider": case.provider,
                    "fixture": case.fixture_name,
                    "dataset": case.dataset,
                    "schema_ref": case.schema_ref,
                    "query_text": case.query_text,
                    "symbols": list(case.symbols),
                    "intended_use": case.intended_use,
                    "deployment_target": case.deployment_target,
                    "tools": list(case.requested_tools),
                },
            )
            response = client.execute(request, timeout=5)
            payload = json_document_to_mapping(response.output)
            assert payload["sources"]
            assert payload["license"]["label"]
            assert payload["schema_ref"] == case.schema_ref
            assert payload["lineage"]["content_hash"].startswith("sha256:")
            assert payload["usage"]["trading_approved"] is False
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_openbb_adapter_stream_cancel_takes_effect_within_two_seconds() -> None:
    socket_path = Path("/tmp") / f"quantos-openbb-adapter-cancel-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, OpenBBAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        fixture = load_fixture("crypto_market_btc")
        request = build_request(
            7,
            {
                "provider": "mock",
                "fixture": fixture.fixture_name,
                "dataset": fixture.dataset,
                "schema_ref": fixture.schema_ref,
                "query_text": "btc market snapshot",
                "symbols": list(fixture.symbols),
                "intended_use": "research",
                "deployment_target": "test",
                "stream_delay_ms": 1200,
            },
        )
        stream = client._stream_execute(  # noqa: SLF001
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


def test_openbb_adapter_license_gate_cli_blocks_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "sys.argv",
        [
            "license_gate.py",
            "--provider",
            "openbb",
            "--environment",
            "production",
            "--dataset",
            "crypto.market.snapshot",
        ],
    )
    assert license_gate_main() == 1


def test_openbb_adapter_p95_response_stays_under_one_second() -> None:
    socket_path = Path("/tmp") / f"quantos-openbb-adapter-latency-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, OpenBBAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        durations = []
        fixture_names = [
            "crypto_market_btc",
            "equity_fundamentals_nvda",
            "macro_research_rates",
        ]
        for index in range(20):
            fixture = load_fixture(fixture_names[index % len(fixture_names)])
            request = build_request(
                200 + index,
                {
                    "provider": "mock",
                    "fixture": fixture.fixture_name,
                    "dataset": fixture.dataset,
                    "schema_ref": fixture.schema_ref,
                    "query_text": f"query {index}",
                    "symbols": list(fixture.symbols),
                    "intended_use": "research",
                    "deployment_target": "test",
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
