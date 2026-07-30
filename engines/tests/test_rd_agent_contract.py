from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import quantiles
from uuid import uuid4

import grpc

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
from rd_agent.fixtures import fixture_names
from rd_agent.manifest import EXPERIMENT_CAPABILITY, HYPOTHESIS_CAPABILITY
from rd_agent.service import RdAgentService


def build_metadata(index: int, *, capabilities: list[str] | None = None) -> common_pb2.CommandMetadata:
    return common_pb2.CommandMetadata(
        request_id=f"req-{index}",
        tenant_id="tenant-primary",
        workspace_id="workspace-primary",
        actor=common_pb2.ActorRef(
            actor_id=f"actor-{index}",
            actor_kind=common_pb2.ActorKind.ACTOR_KIND_USER,
            display_name="QuantOS Tester",
            capabilities=capabilities or [HYPOTHESIS_CAPABILITY, EXPERIMENT_CAPABILITY],
        ),
        correlation_id=f"corr-{index}",
        causation_id=f"cause-{index}",
        mode=common_pb2.RuntimeMode.RUNTIME_MODE_RESEARCH,
        environment=common_pb2.Environment.ENVIRONMENT_TEST,
        issued_at=timestamp_from_datetime(datetime.now(tz=timezone.utc)),
    )


def build_request(index: int, capability: str, payload: dict) -> engine_pb2.ExecuteRequest:
    return engine_pb2.ExecuteRequest(
        metadata=build_metadata(index),
        workflow_run_id=f"run-{index}",
        idempotency_key=f"idem-{index}",
        capability=capability,
        input_schema_version="v1",
        data_snapshot_ref="snapshot-fixed-1",
        policy_context_ref="policy-1",
        input=json_document_from_mapping(payload),
        deadline=timestamp_from_datetime(
            datetime.now(tz=timezone.utc) + timedelta(seconds=5)
        ),
    )


def test_rd_agent_contract_all_rpcs() -> None:
    socket_path = Path("/tmp") / f"quantos-rd-agent-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, RdAgentService())
    client = EngineClient(uds_target(socket_path))

    try:
        metadata = build_metadata(1)
        metadata_response = client.get_metadata(
            engine_pb2.GetMetadataRequest(metadata=metadata),
            timeout=5,
        )
        assert metadata_response.engine_name == "rd-agent"
        assert metadata_response.supported_schema_versions == ["v1"]
        assert len(metadata_response.capabilities) == 2

        health_response = client.health(
            engine_pb2.HealthRequest(metadata=metadata),
            timeout=5,
        )
        assert health_response.ready is True

        execute_request = build_request(
            1,
            HYPOTHESIS_CAPABILITY,
            {
                "prompt": "Generate a hypothesis artifact",
                "fixture": fixture_names()[0],
                "tools": ["query_snapshot"],
            },
        )
        execute_response = client.execute(execute_request, timeout=5)
        output = json_document_to_mapping(execute_response.output)
        assert execute_response.execution_id == "run-1:idem-1"
        assert output["artifact_type"] == "ResearchArtifact"
        assert output["capability"] == HYPOTHESIS_CAPABILITY
        assert output["trade_executable"] is False
        assert output["data_snapshot_ref"] == "snapshot-fixed-1"
        assert output["artifact_hash"].startswith("sha256:")

        stream = client.stream_execute(
            engine_pb2.StreamExecuteRequest(request=execute_request),
            timeout=5,
        )
        assert len(stream) == 3
        assert json_document_to_mapping(stream[0].delta)["phase"] == "validated"
        assert json_document_to_mapping(stream[1].delta)["phase"] == "research_artifact_ready"
        assert json_document_to_mapping(stream[2].delta)["phase"] == "completed"
        assert stream[2].artifact_refs[0].artifact_id == "research-artifact:run-1"

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


def test_rd_agent_is_deterministic_for_fixed_snapshot() -> None:
    socket_path = Path("/tmp") / f"quantos-rd-agent-deterministic-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, RdAgentService())
    client = EngineClient(uds_target(socket_path))

    try:
        request = build_request(
            2,
            EXPERIMENT_CAPABILITY,
            {
                "prompt": "Run experiment",
                "fixture": fixture_names()[1],
                "tools": ["query_artifact", "query_snapshot"],
            },
        )
        first = client.execute(request, timeout=5)
        second = client.execute(request, timeout=5)
        first_output = json_document_to_mapping(first.output)
        second_output = json_document_to_mapping(second.output)
        assert first.input_hash == second.input_hash
        assert first_output == second_output
        assert first_output["artifact_hash"] == second_output["artifact_hash"]
        assert first.artifact_refs[0].sha256 == second.artifact_refs[0].sha256
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_rd_agent_rejects_forbidden_boundary_requests() -> None:
    socket_path = Path("/tmp") / f"quantos-rd-agent-boundary-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, RdAgentService())
    client = EngineClient(uds_target(socket_path))

    try:
        for payload in (
            {"trade_command": {"side": "buy"}},
            {"secret_ref": "vault://prod/api"},
            {"network_access": True},
            {"tools": ["web_search"]},
        ):
            request = build_request(3, HYPOTHESIS_CAPABILITY, payload)
            try:
                client.execute(request, timeout=5)
            except grpc.RpcError as error:
                assert error.code() == grpc.StatusCode.PERMISSION_DENIED
            else:
                raise AssertionError("forbidden rd-agent request should be denied")
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_rd_agent_requires_matching_actor_capability() -> None:
    socket_path = Path("/tmp") / f"quantos-rd-agent-auth-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, RdAgentService())
    client = EngineClient(uds_target(socket_path))

    try:
        request = build_request(
            4,
            EXPERIMENT_CAPABILITY,
            {"fixture": fixture_names()[1]},
        )
        request.metadata.CopyFrom(
            build_metadata(4, capabilities=[HYPOTHESIS_CAPABILITY])
        )
        try:
            client.execute(request, timeout=5)
        except grpc.RpcError as error:
            assert error.code() == grpc.StatusCode.PERMISSION_DENIED
        else:
            raise AssertionError("missing actor capability should be denied")
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_rd_agent_p95_response_stays_under_one_second() -> None:
    socket_path = Path("/tmp") / f"quantos-rd-agent-latency-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, RdAgentService())
    client = EngineClient(uds_target(socket_path))

    try:
        durations = []
        for index in range(20):
            request = build_request(
                100 + index,
                HYPOTHESIS_CAPABILITY,
                {
                    "fixture": fixture_names()[0],
                    "tools": ["query_snapshot"],
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
