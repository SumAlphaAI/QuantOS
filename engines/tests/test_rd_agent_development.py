"""TP02 real UDS boundary, replay, Artifact and lifecycle acceptance checks."""

from __future__ import annotations

import ast
import hashlib
import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import grpc
import pytest

from engine_contract_harness import assert_five_rpc_contract
from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import (
    EngineClient,
    json_document_from_mapping,
    json_document_to_mapping,
    serve_engine,
    timestamp_from_datetime,
    uds_target,
)
from rd_agent.fixtures import fixture_names
from rd_agent.manifest import EXPERIMENT_CAPABILITY, HYPOTHESIS_CAPABILITY
from rd_agent.service import RdAgentService
from test_rd_agent_contract import build_request


@pytest.fixture
def engine():
    path = Path("/tmp") / f"quantos-tp02-{uuid4().hex}.sock"
    service = RdAgentService()
    server = serve_engine(path, service)
    client = EngineClient(uds_target(path))
    try:
        yield service, client
    finally:
        client.close()
        server.stop(grace=0).wait(5)
        path.unlink(missing_ok=True)


def invoke(client, request, rpc):
    if rpc == "execute":
        return client.execute(request, timeout=3)
    return client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=3)


@pytest.mark.parametrize("index", [0, 1], ids=list(fixture_names()))
def test_replay_contract_and_readable_artifact(engine, index):
    service, client = engine
    capability = [HYPOTHESIS_CAPABILITY, EXPERIMENT_CAPABILITY][index]
    request = build_request(
        100 + index,
        capability,
        {
            "fixture": fixture_names()[index],
            "prompt": "controlled research",
            "tools": ["query_snapshot"],
        },
    )
    assert_five_rpc_contract(client, request, "rd-agent")
    first = client.execute(request, timeout=3)
    second = client.execute(request, timeout=3)
    assert first.input_hash == second.input_hash
    assert first.output == second.output
    assert first.artifact_refs == second.artifact_refs
    streams = [
        client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=3)
        for _ in range(2)
    ]
    assert [s.sequence_id for s in streams[0]] == ["seq-1", "seq-2", "seq-3"]
    assert [s.delta for s in streams[0]] == [s.delta for s in streams[1]]
    assert streams[0][-1].artifact_refs == first.artifact_refs
    ref = first.artifact_refs[0]
    raw = service.artifacts.read(
        request.metadata.tenant_id,
        request.metadata.workspace_id,
        request.metadata.actor.actor_id,
        ref.artifact_id,
    )
    output = json_document_to_mapping(first.output)
    assert json.loads(raw) == output
    assert ref.sha256 == "sha256:" + hashlib.sha256(raw).hexdigest()
    assert ref.uri.startswith("mock-artifact://")
    assert first.evidence_refs[0].artifact_id == ref.artifact_id
    assert output["input_hash"] == first.input_hash
    assert output["trade_executable"] is False
    assert output["environment"]["tools_executed"] is False
    assert output["environment"]["snapshot_bytes_resolved"] is False
    assert output["audit"]["tenant_id"] == request.metadata.tenant_id
    for field in ["request_id", "correlation_id", "causation_id", "workspace_id"]:
        assert output["audit"][field] == getattr(request.metadata, field)


DENIED = [
    {"trade_command": {}},
    {"order": {}},
    {"venue": "venue"},
    {"secret_ref": "redacted-fixture"},
    {"network_access": True},
    {"external_url": "https://example.invalid"},
    {"TOOLS": []},
    {"tools": ["web_search"]},
    {"tools": ["shell"]},
    {"tools": ["read_secret"]},
    {"tools": ["file_write"]},
    {"tools": ["place_order"]},
    {"nested": [{"Secret-Ref": "sentinel"}]},
    {"nested": {"tenant_id": "other"}},
    {"tenant_id": "other"},
    {"workspace_id": "other"},
    {"actor_id": "other"},
    {"capabilities": ["trade.execute"]},
    {"api_key": "sentinel"},
    {"authorization": "sentinel"},
    {"shell": "sentinel"},
    {"file_write": "sentinel"},
    {"session": {}},
    {"data_snapshot_ref": "other"},
    {"policy_context_ref": "other"},
]
INVALID = [
    {"tools": "query_snapshot"},
    {"tools": [None]},
    {"tools": [1]},
    {"tools": {}},
    {"tools": ["query_snapshot"] * 4},
    {"sleep_ms": -1},
    {"sleep_ms": 5001},
    {"sleep_ms": True},
    {"sleep_ms": "bad"},
    {"sleep_ms": 0.5},
    {"prompt": {}},
    {"prompt": ""},
    {"prompt": "x" * 8193},
    {"fixture": []},
    {"fixture": "unknown"},
    {"fixture": "../../unknown"},
    {"fixture": "experiment_factor_stability"},
]


@pytest.mark.parametrize("rpc", ["execute", "stream"])
@pytest.mark.parametrize(
    "payload,code",
    [(p, grpc.StatusCode.PERMISSION_DENIED) for p in DENIED]
    + [(p, grpc.StatusCode.INVALID_ARGUMENT) for p in INVALID],
    ids=[f"case-{i:02}" for i in range(len(DENIED) + len(INVALID))],
)
def test_boundary_rejection_has_no_side_effect(engine, rpc, payload, code):
    service, client = engine
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, build_request(200, HYPOTHESIS_CAPABILITY, payload), rpc)
    assert error.value.code() == code
    assert service.artifacts.count == 0
    assert service._inputs == {}
    assert "sentinel" not in (error.value.details() or "")
    assert "../../" not in (error.value.details() or "")


@pytest.mark.parametrize(
    "mode",
    [
        common_pb2.RUNTIME_MODE_PAPER,
        common_pb2.RUNTIME_MODE_SHADOW,
        common_pb2.RUNTIME_MODE_ASSISTED_LIVE,
        common_pb2.RUNTIME_MODE_GUARDED_LIVE,
    ],
)
@pytest.mark.parametrize("rpc", ["execute", "stream"])
def test_research_only(engine, mode, rpc):
    service, client = engine
    request = build_request(300, HYPOTHESIS_CAPABILITY, {})
    request.metadata.mode = mode
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, request, rpc)
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    assert service.artifacts.count == 0


@pytest.mark.parametrize(
    "field",
    ["prompt", "snapshot", "policy", "request_id", "correlation_id", "causation_id", "capability"],
)
@pytest.mark.parametrize("rpc", ["execute", "stream"])
def test_execution_identity_conflict(engine, field, rpc):
    service, client = engine
    request = build_request(400, HYPOTHESIS_CAPABILITY, {})
    original = client.execute(request, timeout=3)
    if field == "prompt":
        request.input.CopyFrom(json_document_from_mapping({"prompt": "changed"}))
    elif field == "snapshot":
        request.data_snapshot_ref = "other-snapshot"
    elif field == "policy":
        request.policy_context_ref = "other-policy"
    elif field == "capability":
        request.capability = EXPERIMENT_CAPABILITY
    else:
        setattr(request.metadata, field, "changed")
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, request, rpc)
    assert error.value.code() == grpc.StatusCode.ALREADY_EXISTS
    assert service.artifacts.count == 1
    raw = service.artifacts.read(
        "tenant-primary", "workspace-primary", "actor-400", original.artifact_refs[0].artifact_id
    )
    assert json.loads(raw)["audit"]["request_id"] == "req-400"


@pytest.mark.parametrize(
    "field", ["tenant_id", "workspace_id", "actor_id", "capabilities", "mode", "unknown"]
)
def test_cancel_authorization_is_scoped(engine, field):
    service, client = engine
    request = build_request(500, HYPOTHESIS_CAPABILITY, {})
    response = client.execute(request, timeout=3)
    cancel = engine_pb2.CancelRequest(metadata=request.metadata, execution_id=response.execution_id)
    if field in ["tenant_id", "workspace_id"]:
        setattr(cancel.metadata, field, "other")
    elif field == "actor_id":
        cancel.metadata.actor.actor_id = "other"
    elif field == "capabilities":
        cancel.metadata.actor.ClearField("capabilities")
    elif field == "mode":
        cancel.metadata.mode = common_pb2.RUNTIME_MODE_PAPER
    else:
        cancel.execution_id = "unknown"
    with pytest.raises(grpc.RpcError) as error:
        client.cancel(cancel, timeout=3)
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    assert client.execute(request, timeout=3).artifact_refs == response.artifact_refs
    assert service.artifacts.count == 1


@pytest.mark.parametrize("field", ["tenant_id", "workspace_id", "actor_id"])
def test_artifact_read_scope_and_collision_resistance(engine, field):
    service, client = engine
    request = build_request(600, HYPOTHESIS_CAPABILITY, {})
    first = client.execute(request, timeout=3)
    tenant, workspace, actor = (
        request.metadata.tenant_id,
        request.metadata.workspace_id,
        request.metadata.actor.actor_id,
    )
    scope = [tenant, workspace, actor]
    scope[["tenant_id", "workspace_id", "actor_id"].index(field)] = "other"
    with pytest.raises(PermissionError):
        service.artifacts.read(*scope, first.artifact_refs[0].artifact_id)
    if field == "actor_id":
        request.metadata.actor.actor_id = "other"
    else:
        setattr(request.metadata, field, "other")
    second = client.execute(request, timeout=3)
    assert second.artifact_refs[0].artifact_id != first.artifact_refs[0].artifact_id
    assert service.artifacts.count == 2


@pytest.mark.parametrize("rpc", ["execute", "stream"])
@pytest.mark.parametrize("stop", ["deadline", "cancel", "transport"])
def test_inflight_stop_prevents_artifact_write(engine, rpc, stop):
    service, client = engine
    request = build_request(700, HYPOTHESIS_CAPABILITY, {"sleep_ms": 2000})
    if stop == "deadline":
        request.deadline.CopyFrom(
            timestamp_from_datetime(datetime.now(timezone.utc) + timedelta(milliseconds=150))
        )
    started = time.monotonic()
    if stop == "transport":
        with pytest.raises(grpc.RpcError) as error:
            if rpc == "execute":
                client.execute(request, timeout=0.15)
            else:
                client.stream_execute(
                    engine_pb2.StreamExecuteRequest(request=request), timeout=0.15
                )
        assert error.value.code() == grpc.StatusCode.DEADLINE_EXCEEDED
        time.sleep(0.1)
    else:
        with ThreadPoolExecutor() as pool:
            pending = pool.submit(invoke, client, request, rpc)
            if stop == "cancel":
                known = False
                for _ in range(100):
                    with service._lock:
                        known = bool(service._inputs)
                    if known:
                        break
                    time.sleep(0.005)
                assert known
                assert client.cancel(
                    engine_pb2.CancelRequest(
                        metadata=request.metadata, execution_id="run-700:idem-700"
                    ),
                    timeout=3,
                ).cancelled
            with pytest.raises(grpc.RpcError) as error:
                pending.result(timeout=2)
            assert error.value.code() == (
                grpc.StatusCode.CANCELLED if stop == "cancel" else grpc.StatusCode.DEADLINE_EXCEEDED
            )
    assert time.monotonic() - started < 1.5
    assert service.artifacts.count == 0


def test_rd_agent_source_has_no_upstream_or_tool_runtime_imports():
    root = Path(__file__).parents[1] / "rd-agent/src/rd_agent"
    allowed = {
        "__future__",
        "argparse",
        "dataclasses",
        "datetime",
        "functools",
        "grpc",
        "hashlib",
        "json",
        "logging",
        "pathlib",
        "quantos",
        "quantos_engine_sdk",
        "rd_agent",
        "threading",
        "time",
    }
    for path in root.glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Import):
                assert all(alias.name.split(".")[0] in allowed for alias in node.names)
            if isinstance(node, ast.ImportFrom):
                assert node.module and node.module.split(".")[0] in allowed
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                assert node.func.id not in {"eval", "exec", "__import__", "open"}


@pytest.mark.parametrize("stop", ["cancel", "deadline"])
def test_stream_stop_between_deltas_never_commits(engine, stop):
    service, client = engine
    request = build_request(800, HYPOTHESIS_CAPABILITY, {})

    class Stopped(Exception):
        def __init__(self, code):
            self.code = code

    class Context:
        def is_active(self):
            return True

        def abort(self, code, detail):
            raise Stopped(code)

    stream_request = engine_pb2.StreamExecuteRequest(request=request)
    stream = service.stream_execute(stream_request, Context())
    assert next(stream).done is False
    assert service.artifacts.count == 0
    if stop == "cancel":
        assert client.cancel(
            engine_pb2.CancelRequest(metadata=request.metadata, execution_id="run-800:idem-800"),
            timeout=3,
        ).cancelled
    else:
        request_deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
        # Expire the command between observable stream emissions.
        stream_request.request.deadline.CopyFrom(timestamp_from_datetime(request_deadline))
    with pytest.raises(Stopped) as error:
        next(stream)
    assert error.value.code == (
        grpc.StatusCode.CANCELLED if stop == "cancel" else grpc.StatusCode.DEADLINE_EXCEEDED
    )
    assert service.artifacts.count == 0
