"""TP01-C contract, isolation, mock persistence and failure-boundary regression."""

from __future__ import annotations

import hashlib
import json
import socket
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import grpc
import pytest

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import (
    EngineClient,
    json_document_to_mapping,
    timestamp_from_datetime,
    uds_target,
)
from quantos_engine_sdk.grpc import serve_engine
from test_vibe_adapter_contract import build_metadata, build_request
from vibe_adapter.artifact_api import VibeArtifactApi
from vibe_adapter.service import VibeAdapterService
from vibe_adapter.server import main


@pytest.fixture
def adapter():
    path = Path("/tmp") / f"tp01-c-{uuid4().hex}.sock"
    service = VibeAdapterService()
    server = serve_engine(path, service)
    client = EngineClient(uds_target(path))
    try:
        yield service, client
    finally:
        client.close()
        server.stop(grace=0).wait(timeout=5)
        path.unlink(missing_ok=True)


DENIED_FIELDS = (
    "secret_ref",
    "venue",
    "broker_connection",
    "shell",
    "file_write",
    "network_access",
    "tenant_id",
    "workspace_id",
    "actor_id",
    "capabilities",
    "api_key",
    "authorization",
    "session",
    "memory",
    "trading_order",
    "egress_url",
    "path",
    "command",
    "credential",
    "token",
)


@pytest.mark.parametrize("field", DENIED_FIELDS)
@pytest.mark.parametrize("shape", range(5))
def test_100_boundary_fixtures_rejected_and_audited(adapter, caplog, field, shape):
    service, client = adapter
    leaf = {field: "sensitive-fixture-value"}
    payload = (
        leaf,
        {"config": leaf},
        {"steps": [leaf]},
        {"tools": [leaf]},
        {"context": {"nested": [leaf]}},
    )[shape]
    for stream in (False, True):
        request = build_request(1, payload)
        with pytest.raises(grpc.RpcError) as error:
            if stream:
                client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=5)
            else:
                client.execute(request, timeout=5)
        assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
        assert "sensitive-fixture-value" not in (error.value.details() or "")
    assert "decision=denied" in caplog.text
    assert "sensitive-fixture-value" not in caplog.text
    assert not service.artifact_api._objects


@pytest.mark.parametrize(
    "tools",
    [
        "web_search",
        False,
        1,
        {},
        [1],
        [None],
        [""],
        ["bash"],
        ["trading_order"],
        ["write_file"],
        ["remember"],
        ["session_search"],
        ["unknown/private/path"],
    ],
)
def test_tools_are_typed_and_deny_by_default(adapter, tools):
    _, client = adapter
    with pytest.raises(grpc.RpcError) as error:
        client.execute(build_request(1, {"tools": tools}), timeout=5)
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    assert "private/path" not in (error.value.details() or "")


def test_empty_allowlist_grants_no_tools(adapter):
    _, client = adapter
    response = client.execute(build_request(1, {"tools": []}), timeout=5)
    assert json_document_to_mapping(response.output)["tool_allowlist"] == []


@pytest.mark.parametrize(
    "payload",
    [
        {"sleep_ms": "bad"},
        {"sleep_ms": -1},
        {"sleep_ms": 5001},
        {"sleep_ms": 0.5},
        {"sleep_ms": True},
        {"prompt": {}},
        {"fixture": []},
    ],
)
def test_malformed_input_returns_controlled_error(adapter, payload):
    _, client = adapter
    with pytest.raises(grpc.RpcError) as error:
        client.execute(build_request(1, payload), timeout=5)
    assert error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
    assert error.value.details() == "ENGINE_INPUT_INVALID"


def test_mock_artifacts_have_integrity_tenant_scope_and_stable_replay(adapter):
    service, client = adapter
    request = build_request(1, {"prompt": "research"})
    first = client.execute(request, timeout=5)
    replay = client.execute(request, timeout=5)
    assert first.artifact_refs == replay.artifact_refs
    ref = first.artifact_refs[0]
    assert ref.uri.startswith("mock-artifact://")
    stored = service.artifact_api.read_json_artifact(
        tenant_id=request.metadata.tenant_id,
        artifact_id=ref.artifact_id,
    )
    encoded = json.dumps(stored, sort_keys=True, separators=(",", ":")).encode()
    assert ref.sha256 == "sha256:" + hashlib.sha256(encoded).hexdigest()
    stored["prompt"] = "mutated"
    assert (
        service.artifact_api.read_json_artifact(
            tenant_id=request.metadata.tenant_id,
            artifact_id=ref.artifact_id,
        )["prompt"]
        == "research"
    )
    with pytest.raises(PermissionError, match="ENGINE_ARTIFACT_UNAVAILABLE"):
        service.artifact_api.read_json_artifact(tenant_id="other", artifact_id=ref.artifact_id)
    request.metadata.tenant_id = "other"
    other = client.execute(request, timeout=5)
    assert other.artifact_refs[0].artifact_id != ref.artifact_id
    fresh_mock = VibeArtifactApi()
    rebuilt = fresh_mock.record_json_artifact(
        workflow_run_id="run-1",
        tenant_id="tenant-primary",
        artifact_kind="research-output",
        payload=json.loads(encoded),
    )
    assert rebuilt.artifact_ref == ref


def test_conflicting_idempotency_input_is_rejected(adapter):
    _, client = adapter
    client.execute(build_request(1, {"prompt": "first"}), timeout=5)
    with pytest.raises(grpc.RpcError) as error:
        client.execute(build_request(1, {"prompt": "second"}), timeout=5)
    assert error.value.code() == grpc.StatusCode.ALREADY_EXISTS


def test_execution_id_separator_cannot_alias_another_request(adapter):
    _, client = adapter
    first = build_request(1, {})
    first.workflow_run_id, first.idempotency_key = "run:first", "idem"
    client.execute(first, timeout=5)
    alias = build_request(1, {})
    alias.workflow_run_id, alias.idempotency_key = "run", "first:idem"
    with pytest.raises(grpc.RpcError) as error:
        client.execute(alias, timeout=5)
    assert error.value.code() == grpc.StatusCode.ALREADY_EXISTS


def test_unknown_fixture_returns_safe_error(adapter):
    _, client = adapter
    with pytest.raises(grpc.RpcError) as error:
        client.execute(build_request(1, {"fixture": "/private/sensitive-fixture-value"}), timeout=5)
    assert error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
    assert error.value.details() == "ENGINE_FIXTURE_UNAVAILABLE"


def test_cancel_between_wait_and_commit_cannot_emit_artifact(adapter, monkeypatch):
    service, client = adapter

    def cancel_before_commit(request, payload, context):
        client.cancel(
            engine_pb2.CancelRequest(metadata=request.metadata, execution_id="run-1:idem-1"),
            timeout=5,
        )

    monkeypatch.setattr(service, "_wait", cancel_before_commit)
    with pytest.raises(grpc.RpcError) as error:
        client.execute(build_request(1, {}), timeout=5)
    assert error.value.code() == grpc.StatusCode.CANCELLED
    assert not service.artifact_api._objects


def test_cancel_is_owner_scoped_and_interrupts_before_artifact(adapter):
    service, client = adapter
    request = build_request(1, {"sleep_ms": 3000})
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(client.execute, request, timeout=5)
        until = time.monotonic() + 2
        while not service._owners and time.monotonic() < until:
            time.sleep(0.01)
        assert service._owners
        for field in ("tenant_id", "workspace_id", "actor"):
            metadata = build_metadata(1)
            if field == "actor":
                metadata.actor.actor_id = "other"
            else:
                setattr(metadata, field, "other")
            with pytest.raises(grpc.RpcError) as error:
                client.cancel(
                    engine_pb2.CancelRequest(metadata=metadata, execution_id="run-1:idem-1"),
                    timeout=5,
                )
            assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
        start = time.monotonic()
        cancelled = client.cancel(
            engine_pb2.CancelRequest(metadata=request.metadata, execution_id="run-1:idem-1"),
            timeout=5,
        )
        assert cancelled.cancelled
        with pytest.raises(grpc.RpcError) as error:
            future.result(timeout=2)
        assert error.value.code() == grpc.StatusCode.CANCELLED
        assert time.monotonic() - start < 2
    assert not service.artifact_api._objects


@pytest.mark.parametrize("stream", [False, True])
def test_deadline_interrupts_work_without_artifact(adapter, stream):
    service, client = adapter
    request = build_request(1, {"sleep_ms": 3000})
    request.deadline.CopyFrom(
        timestamp_from_datetime(datetime.now(timezone.utc) + timedelta(milliseconds=100))
    )
    start = time.monotonic()
    with pytest.raises(grpc.RpcError) as error:
        if stream:
            client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=5)
        else:
            client.execute(request, timeout=5)
    assert error.value.code() == grpc.StatusCode.DEADLINE_EXCEEDED
    assert time.monotonic() - start < 2
    assert not service.artifact_api._objects


def test_authorization_and_live_modes_are_denied(adapter):
    _, client = adapter
    for mode in (common_pb2.RUNTIME_MODE_PAPER, common_pb2.RUNTIME_MODE_GUARDED_LIVE):
        request = build_request(1, {})
        request.metadata.mode = mode
        with pytest.raises(grpc.RpcError) as error:
            client.execute(request, timeout=5)
        assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    request = build_request(1, {})
    request.metadata.actor.ClearField("capabilities")
    with pytest.raises(grpc.RpcError) as error:
        client.execute(request, timeout=5)
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED


def test_provider_errors_do_not_expose_paths_or_secrets(adapter, monkeypatch):
    service, client = adapter

    def fail(_name):
        raise RuntimeError("/private/secret-provider token=sensitive-fixture-value")

    monkeypatch.setattr(service.contract_provider, "load_contract", fail)
    with pytest.raises(grpc.RpcError) as error:
        client.execute(build_request(1, {}), timeout=5)
    assert error.value.code() == grpc.StatusCode.INTERNAL
    assert error.value.details() == "ENGINE_PROVIDER_FAILED"
    assert not service.artifact_api._objects


def test_default_mock_dispatches_no_network_or_subprocess(adapter, monkeypatch):
    _, client = adapter

    def forbidden(*_args, **_kwargs):
        raise AssertionError("unauthorized side effect")

    monkeypatch.setattr(socket.socket, "connect", forbidden)
    monkeypatch.setattr(socket, "create_connection", forbidden)
    monkeypatch.setattr(subprocess, "Popen", forbidden)
    assert client.execute(
        build_request(1, {"tools": ["web_search", "read_url"]}), timeout=5
    ).artifact_refs


def test_server_rejects_relative_paths_and_preserves_existing_files(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "argv", ["vibe-adapter", "--socket", "relative.sock"])
    with pytest.raises(ValueError, match="ENGINE_SOCKET_MUST_BE_ABSOLUTE"):
        main()
    path = tmp_path / "owned-file"
    path.write_text("preserve")
    monkeypatch.setattr(sys, "argv", ["vibe-adapter", "--socket", str(path)])
    with pytest.raises(FileExistsError, match="ENGINE_SOCKET_ALREADY_EXISTS"):
        main()
    assert path.read_text() == "preserve"


def test_other_engine_boots_with_vibe_imports_blocked():
    # An independent interpreter cannot accidentally reuse this test's imported adapter.
    script = """
import sys, importlib.abc
from pathlib import Path
from uuid import uuid4
class NoVibe(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == "vibe_adapter" or fullname.startswith("vibe_adapter."):
            raise ImportError("adapter removed")
sys.meta_path.insert(0, NoVibe())
try:
    import vibe_adapter
except ImportError:
    pass
else:
    raise AssertionError("adapter import must be unavailable")
from mock_engine.service import MockEngineService
from quantos_engine_sdk import EngineClient, uds_target
from quantos_engine_sdk.grpc import serve_engine
from quantos.engine.v1 import engine_pb2
sys.path.insert(0, str(Path("engines/tests").resolve()))
from engine_contract_harness import assert_five_rpc_contract
request = engine_pb2.ExecuteRequest.FromString(bytes.fromhex(sys.argv[1]))
service = MockEngineService()
request.capability = service.manifest.capabilities[0].name
path = Path("/tmp") / ("tp01-c-other-" + uuid4().hex + ".sock")
server = serve_engine(path, service)
client = EngineClient(uds_target(path))
try:
    assert_five_rpc_contract(client, request, service.manifest.engine_name)
finally:
    client.close()
    server.stop(grace=0).wait(timeout=5)
    path.unlink(missing_ok=True)
print("other Engine five RPC PASS with vibe imports blocked")
"""
    result = subprocess.run(
        [sys.executable, "-c", script, build_request(1, {}).SerializeToString().hex()],
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "five RPC PASS" in result.stdout
