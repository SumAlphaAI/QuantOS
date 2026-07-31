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

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos.trading.v1 import trading_pb2
from quantos_engine_sdk import (
    EngineClient,
    json_document_from_mapping,
    json_document_to_mapping,
    timestamp_from_datetime,
    uds_target,
)
from quantos_engine_sdk.grpc import serve_engine
from trading_agents.fixtures import build_signal_payload, fixed_input_cases, load_fixture
from trading_agents.manifest import PROPOSAL_CAPABILITY
from trading_agents.service import TradingAgentsService


def build_metadata(index: int, *, capabilities: list[str] | None = None) -> common_pb2.CommandMetadata:
    return common_pb2.CommandMetadata(
        request_id=f"req-{index}",
        tenant_id="tenant-primary",
        workspace_id="workspace-primary",
        actor=common_pb2.ActorRef(
            actor_id=f"actor-{index}",
            actor_kind=common_pb2.ActorKind.ACTOR_KIND_USER,
            display_name="QuantOS Tester",
            capabilities=capabilities or [PROPOSAL_CAPABILITY],
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
        capability=PROPOSAL_CAPABILITY,
        input_schema_version="v1",
        data_snapshot_ref=data_snapshot_ref or str(payload["portfolio_snapshot_id"]),
        policy_context_ref=str(payload.get("policy_snapshot_id", f"policy-{index}")),
        input=json_document_from_mapping(payload),
        deadline=timestamp_from_datetime(
            datetime.now(tz=timezone.utc) + timedelta(seconds=5)
        ),
    )


def parse_proposal_output(payload: dict) -> trading_pb2.TradeProposal:
    proposal = trading_pb2.TradeProposal()
    json_format.ParseDict(payload, proposal)
    return proposal


def proposal_required_fields() -> set[str]:
    schema_path = (
        Path(__file__).resolve().parents[2]
        / "proto"
        / "jsonschema"
        / "v1TradeProposal.schema.json"
    )
    parsed = json.loads(schema_path.read_text(encoding="utf-8"))
    return set(parsed["required"])


def test_trading_agents_contract_all_rpcs() -> None:
    socket_path = Path("/tmp") / f"quantos-trading-agents-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, TradingAgentsService())
    client = EngineClient(uds_target(socket_path))

    try:
        metadata = build_metadata(1)
        metadata_response = client.get_metadata(
            engine_pb2.GetMetadataRequest(metadata=metadata),
            timeout=5,
        )
        assert metadata_response.engine_name == "trading-agents"
        assert metadata_response.supported_schema_versions == ["v1"]
        assert len(metadata_response.capabilities) == 1

        health_response = client.health(
            engine_pb2.HealthRequest(metadata=metadata),
            timeout=5,
        )
        assert health_response.ready is True

        fixture = load_fixture("committee_bull_breakout")
        execute_request = build_request(
            1,
            {
                "fixture": fixture.fixture_name,
                "account_id": "paper-account-primary",
                "policy_snapshot_id": fixture.policy_snapshot_id,
                "portfolio_snapshot_id": fixture.portfolio_snapshot_id,
                "signal": build_signal_payload(fixture, request_seed="contract-primary"),
                "tools": ["query_signal", "query_snapshot", "query_artifact"],
            },
        )
        execute_response = client.execute(execute_request, timeout=5)
        output = json_document_to_mapping(execute_response.output)
        proposal = parse_proposal_output(output)
        assert execute_response.execution_id == "run-1:idem-1"
        assert len(execute_response.artifact_refs) == 2
        assert proposal.account_id == "paper-account-primary"
        assert proposal.symbol == "BTCUSDT"
        assert proposal.executable is False
        assert proposal.evidence_refs[1].summary.startswith("Counterpoint:")

        stream = client.stream_execute(
            engine_pb2.StreamExecuteRequest(request=execute_request),
            timeout=5,
        )
        assert len(stream) == 3
        assert json_document_to_mapping(stream[0].delta)["phase"] == "validated"
        assert json_document_to_mapping(stream[1].delta)["phase"] == "committee_ready"
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


def test_trading_agents_is_deterministic_for_fixed_signal() -> None:
    socket_path = Path("/tmp") / f"quantos-trading-agents-deterministic-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, TradingAgentsService())
    client = EngineClient(uds_target(socket_path))

    try:
        fixture = load_fixture("committee_reduce_overheat")
        request = build_request(
            2,
            {
                "fixture": fixture.fixture_name,
                "account_id": "paper-account-primary",
                "policy_snapshot_id": fixture.policy_snapshot_id,
                "portfolio_snapshot_id": fixture.portfolio_snapshot_id,
                "signal": build_signal_payload(fixture, request_seed="deterministic-primary"),
                "tools": ["query_signal"],
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


def test_trading_agents_rejects_forbidden_boundary_requests() -> None:
    socket_path = Path("/tmp") / f"quantos-trading-agents-boundary-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, TradingAgentsService())
    client = EngineClient(uds_target(socket_path))

    try:
        fixture = load_fixture("committee_bull_breakout")
        base_payload = {
            "fixture": fixture.fixture_name,
            "account_id": "paper-account-primary",
            "policy_snapshot_id": fixture.policy_snapshot_id,
            "portfolio_snapshot_id": fixture.portfolio_snapshot_id,
            "signal": build_signal_payload(fixture, request_seed="boundary-primary"),
        }
        for payload in (
            {**base_payload, "trade_command": {"side": "buy"}},
            {**base_payload, "secret_ref": "vault://prod/api"},
            {**base_payload, "network_access": True},
            {**base_payload, "tools": ["web_search"]},
            {**base_payload, "order_tool": "submit_order"},
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


def test_trading_agents_requires_signal_and_snapshot_ids() -> None:
    socket_path = Path("/tmp") / f"quantos-trading-agents-required-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, TradingAgentsService())
    client = EngineClient(uds_target(socket_path))

    try:
        fixture = load_fixture("committee_bull_breakout")
        missing_signal = build_request(
            4,
            {
                "fixture": fixture.fixture_name,
                "account_id": "paper-account-primary",
                "policy_snapshot_id": fixture.policy_snapshot_id,
                "portfolio_snapshot_id": fixture.portfolio_snapshot_id,
                "signal": "not-an-object",
            },
        )
        with pytest.raises(grpc.RpcError) as missing_signal_error:
            client.execute(missing_signal, timeout=5)
        assert missing_signal_error.value.code() == grpc.StatusCode.INVALID_ARGUMENT

        missing_policy = build_request(
            5,
            {
                "fixture": fixture.fixture_name,
                "account_id": "paper-account-primary",
                "portfolio_snapshot_id": fixture.portfolio_snapshot_id,
                "signal": build_signal_payload(fixture, request_seed="missing-policy"),
            },
        )
        with pytest.raises(grpc.RpcError) as missing_policy_error:
            client.execute(missing_policy, timeout=5)
        assert missing_policy_error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_trading_agents_validates_100_fixed_inputs_against_trade_proposal_proto() -> None:
    socket_path = Path("/tmp") / f"quantos-trading-agents-schema-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, TradingAgentsService())
    client = EngineClient(uds_target(socket_path))
    required = proposal_required_fields()

    try:
        for index, case in enumerate(fixed_input_cases(100), start=1):
            request = build_request(
                index + 100,
                {
                    "fixture": case.fixture_name,
                    "account_id": case.account_id,
                    "policy_snapshot_id": case.policy_snapshot_id,
                    "portfolio_snapshot_id": case.portfolio_snapshot_id,
                    "signal": case.signal_payload,
                    "tools": list(case.requested_tools),
                },
            )
            response = client.execute(request, timeout=5)
            payload = json_document_to_mapping(response.output)
            proposal = parse_proposal_output(payload)

            assert required.issubset(payload.keys())
            assert proposal.executable is False
            assert proposal.expires_at.seconds > 0
            assert any(ref.summary.startswith("Counterpoint:") for ref in proposal.evidence_refs)
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_trading_agents_stream_cancel_takes_effect_within_two_seconds() -> None:
    socket_path = Path("/tmp") / f"quantos-trading-agents-cancel-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, TradingAgentsService())
    client = EngineClient(uds_target(socket_path))

    try:
        fixture = load_fixture("committee_bull_breakout")
        request = build_request(
            7,
            {
                "fixture": fixture.fixture_name,
                "account_id": "paper-account-primary",
                "policy_snapshot_id": fixture.policy_snapshot_id,
                "portfolio_snapshot_id": fixture.portfolio_snapshot_id,
                "signal": build_signal_payload(fixture, request_seed="cancel-primary"),
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


def test_trading_agents_p95_response_stays_under_one_second() -> None:
    socket_path = Path("/tmp") / f"quantos-trading-agents-latency-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, TradingAgentsService())
    client = EngineClient(uds_target(socket_path))

    try:
        durations = []
        fixture_names = [
            "committee_bull_breakout",
            "committee_reduce_overheat",
            "committee_hold_crosscurrents",
        ]
        for index in range(20):
            fixture = load_fixture(fixture_names[index % len(fixture_names)])
            request = build_request(
                200 + index,
                {
                    "fixture": fixture.fixture_name,
                    "account_id": f"paper-account-{index % 3}",
                    "policy_snapshot_id": f"{fixture.policy_snapshot_id}-{index:03d}",
                    "portfolio_snapshot_id": f"{fixture.portfolio_snapshot_id}-{index:03d}",
                    "signal": build_signal_payload(fixture, request_seed=f"latency-{index:03d}"),
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
