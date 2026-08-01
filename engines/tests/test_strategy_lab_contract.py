from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

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
from quantos_engine_sdk.grpc import serve_engine
from strategy_lab.fixtures import malicious_prompt_cases
from strategy_lab.manifest import GENERATE_CAPABILITY
from strategy_lab.service import StrategyLabService


def build_metadata(index: int) -> common_pb2.CommandMetadata:
    return common_pb2.CommandMetadata(
        request_id=f"req-{index}",
        tenant_id="tenant-primary",
        workspace_id="workspace-primary",
        actor=common_pb2.ActorRef(
            actor_id=f"actor-{index}",
            actor_kind=common_pb2.ActorKind.ACTOR_KIND_USER,
            display_name="QuantOS Tester",
            capabilities=[GENERATE_CAPABILITY],
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
        capability=GENERATE_CAPABILITY,
        input_schema_version="v1",
        data_snapshot_ref=f"feature-snapshot-{index}",
        policy_context_ref=f"policy-{index}",
        input=json_document_from_mapping(payload),
        deadline=timestamp_from_datetime(
            datetime.now(tz=timezone.utc) + timedelta(seconds=5)
        ),
    )


def build_input(fixture: str, **overrides) -> dict:
    payload = {
        "fixture": fixture,
        "prompt": "Draft a momentum strategy for the approved universe.",
        "tools": ["query_snapshot", "query_draft"],
    }
    payload.update(overrides)
    return payload


def start_engine(label: str):
    socket_path = Path("/tmp") / f"quantos-strategy-lab-{label}-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, StrategyLabService())
    client = EngineClient(uds_target(socket_path))
    return server, client, socket_path


def stop_engine(server, client, socket_path: Path) -> None:
    client.close()
    server.stop(grace=0)
    if socket_path.exists():
        socket_path.unlink()


def test_strategy_lab_contract_all_rpcs() -> None:
    server, client, socket_path = start_engine("contract")
    try:
        metadata = build_metadata(1)
        metadata_response = client.get_metadata(
            engine_pb2.GetMetadataRequest(metadata=metadata),
            timeout=5,
        )
        assert metadata_response.engine_name == "strategy-lab"
        assert metadata_response.supported_schema_versions == ["v1"]
        assert len(metadata_response.capabilities) == 1

        health_response = client.health(
            engine_pb2.HealthRequest(metadata=metadata),
            timeout=5,
        )
        assert health_response.ready is True

        execute_response = client.execute(
            build_request(1, build_input("trend_momentum_btc")),
            timeout=5,
        )
        assert execute_response.execution_id == "run-1:idem-1"
        assert len(execute_response.artifact_refs) == 2
        assert execute_response.artifact_refs[0].artifact_id == "strategy-draft:run-1"
        assert execute_response.artifact_refs[1].artifact_id == "static-check:run-1"
        assert len(execute_response.evidence_refs) == 3

        output = json_document_to_mapping(execute_response.output)
        assert output["artifact_type"] == "StrategyDraftArtifact"
        assert output["release_eligible"] is True
        assert output["strategy"]["rule"] == "momentum"
        assert output["strategy"]["parameters"]["lookback"] == 24
        forbidden_keys = {"order", "venue", "trade_command", "secret_ref", "deploy", "release"}
        assert forbidden_keys.isdisjoint(output.keys())

        stream = client.stream_execute(
            engine_pb2.StreamExecuteRequest(
                request=build_request(2, build_input("range_reversion_eth"))
            ),
            timeout=5,
        )
        assert len(stream) == 3
        assert json_document_to_mapping(stream[0].delta)["phase"] == "validated"
        assert json_document_to_mapping(stream[1].delta)["phase"] == "draft_ready"
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
        stop_engine(server, client, socket_path)


def test_strategy_lab_is_deterministic_for_fixed_prompt() -> None:
    server, client, socket_path = start_engine("deterministic")
    try:
        first = client.execute(build_request(3, build_input("trend_momentum_btc")), timeout=5)
        second = client.execute(build_request(3, build_input("trend_momentum_btc")), timeout=5)
        assert first.input_hash == second.input_hash
        assert json_document_to_mapping(first.output) == json_document_to_mapping(second.output)
        assert [ref.sha256 for ref in first.artifact_refs] == [
            ref.sha256 for ref in second.artifact_refs
        ]
    finally:
        stop_engine(server, client, socket_path)


def test_strategy_lab_rejects_hundred_malicious_prompts() -> None:
    server, client, socket_path = start_engine("malicious")
    try:
        rejected = 0
        for index, prompt in enumerate(malicious_prompt_cases(100)):
            with pytest.raises(grpc.RpcError) as excinfo:
                client.execute(
                    build_request(10_000 + index, build_input("trend_momentum_btc", prompt=prompt)),
                    timeout=5,
                )
            assert excinfo.value.code() == grpc.StatusCode.PERMISSION_DENIED
            rejected += 1
        assert rejected == 100
    finally:
        stop_engine(server, client, socket_path)


def test_strategy_lab_rejects_forbidden_boundary_fields() -> None:
    server, client, socket_path = start_engine("boundary")
    try:
        with pytest.raises(grpc.RpcError) as excinfo:
            client.execute(
                build_request(20_000, build_input("trend_momentum_btc", network_access="true")),
                timeout=5,
            )
        assert excinfo.value.code() == grpc.StatusCode.PERMISSION_DENIED
    finally:
        stop_engine(server, client, socket_path)


def test_strategy_lab_static_check_failure_blocks_release() -> None:
    server, client, socket_path = start_engine("blocked")
    try:
        execute_response = client.execute(
            build_request(30_000, build_input("peek_ahead_alpha")),
            timeout=5,
        )
        output = json_document_to_mapping(execute_response.output)
        assert output["release_eligible"] is False
        assert output["static_check"]["passed"] is False
        assert any(
            finding.startswith("forbidden_construct:")
            for finding in output["static_check"]["findings"]
        )
        assert any(
            evidence.summary == "static check passed=False"
            for evidence in execute_response.evidence_refs
        )
    finally:
        stop_engine(server, client, socket_path)
