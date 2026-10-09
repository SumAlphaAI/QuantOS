"""TP03 real UDS boundary, replay, Artifact and lifecycle acceptance checks."""

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
from llmquant.fixtures import fixture_names, fixed_input_cases, load_fixture
from llmquant.manifest import SIGNAL_CAPABILITY
from llmquant.service import LlmQuantService
from test_llmquant_contract import build_request as contract_request, parse_signal_output
from quantos_engine_sdk import input_hash


def build_request(index, capability, payload):
    base = {
        "strategy_release_id": "strategy.tp03.release",
        "feature_snapshot_id": f"feature-tp03-{index}",
    }
    request = contract_request(
        index, {**base, **payload}, data_snapshot_ref=base["feature_snapshot_id"]
    )
    request.policy_context_ref = f"policy-{index}"
    return request


@pytest.fixture
def engine():
    path = Path("/tmp") / f"quantos-tp03-{uuid4().hex}.sock"
    service = LlmQuantService()
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


@pytest.mark.parametrize("case", fixed_input_cases(100), ids=lambda c: c.case_id)
def test_hundred_replay_schema_provenance_and_artifact(engine, case):
    service, client = engine
    index = 1000 + int(case.case_id.split("-")[1])
    request = contract_request(
        index,
        {
            "fixture": case.fixture_name,
            "strategy_release_id": case.strategy_release_id,
            "feature_snapshot_id": case.feature_snapshot_id,
            "tools": list(case.requested_tools),
        },
    )
    first = client.execute(request, timeout=3)
    second = client.execute(request, timeout=3)
    assert first.input_hash == second.input_hash == input_hash(request.input)
    assert first.output == second.output and first.artifact_refs == second.artifact_refs
    streams = [
        client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=3)
        for _ in range(2)
    ]
    assert [s.sequence_id for s in streams[0]] == ["seq-1", "seq-2", "seq-3"]
    assert [s.delta for s in streams[0]] == [s.delta for s in streams[1]]
    assert streams[0][-1].artifact_refs == first.artifact_refs
    output = json_document_to_mapping(first.output)
    signal = parse_signal_output(output)
    diagnostics = json_document_to_mapping(signal.diagnostics)
    assert signal.generated_at == request.metadata.issued_at
    assert signal.valid_until.ToDatetime(timezone.utc) - signal.generated_at.ToDatetime(
        timezone.utc
    ) == timedelta(minutes=load_fixture(case.fixture_name).validity_minutes)
    assert 0 <= float(signal.confidence.value) <= 1
    for name in ("strategy_version", "model_version", "data_version"):
        assert diagnostics[name]
    assert len(diagnostics["model_digest"]) == 71
    assert diagnostics["model_provenance"]["feature_snapshot_id"] == case.feature_snapshot_id
    assert diagnostics["trade_executable"] is False
    assert (
        diagnostics["snapshot_bytes_resolved"] is False and diagnostics["release_resolved"] is False
    )
    for field in ("tenant_id", "workspace_id", "request_id", "correlation_id", "causation_id"):
        assert diagnostics["audit"][field] == getattr(request.metadata, field)
    assert len(first.artifact_refs) == service.artifacts.count == 2
    for ref in first.artifact_refs:
        raw = service.artifacts.read(
            request.metadata.tenant_id,
            request.metadata.workspace_id,
            request.metadata.actor.actor_id,
            ref.artifact_id,
        )
        assert ref.sha256 == "sha256:" + hashlib.sha256(raw).hexdigest()
        assert ref.uri.startswith("mock-artifact://llmquant/")
        if ref.artifact_id.startswith("signal:"):
            assert json.loads(raw) == output
        else:
            model = json.loads(raw)
            assert model["model_digest"] == diagnostics["model_digest"]
            assert model["signal_hash"] == first.artifact_refs[0].sha256
    assert {e.artifact_id for e in first.evidence_refs} == {
        r.artifact_id for r in first.artifact_refs
    }


def test_five_rpc_shared_harness(engine):
    _, client = engine
    assert_five_rpc_contract(client, build_request(100, SIGNAL_CAPABILITY, {}), "llmquant")


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
    {"oms_command": {}},
    {"data_query": {"lineage": {"policy_context_ref": "other"}}},
    {"data_query": {"usage": {"trading_approved": True}}},
    {"data_query": {"license": {"approved_for_production": "false"}}},
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
    {"strategy_release_id": {}},
    {"strategy_release_id": ""},
    {"strategy_release_id": " "},
    {"strategy_release_id": "x" * 513},
    {"feature_snapshot_id": "other"},
    {"policy_context_ref": "other"},
    {"data_query": []},
    {"data_query": {"provider": {}}},
    {"data_query": {"license": {"label": []}}},
    {"data_query": {"lineage": {"content_hash": 1}}},
    {"data_query": {"license": "invalid"}},
    {"data_query": {"usage": []}},
    {"stream_delay_ms": -1},
    {"stream_delay_ms": 0.5},
    {"stream_delay_ms": True},
    {"fixture": []},
    {"fixture": "unknown"},
    {"fixture": "../../unknown"},
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
        invoke(client, build_request(200, SIGNAL_CAPABILITY, payload), rpc)
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
    request = build_request(300, SIGNAL_CAPABILITY, {})
    request.metadata.mode = mode
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, request, rpc)
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    assert service.artifacts.count == 0


@pytest.mark.parametrize(
    "field",
    [
        "strategy_release_id",
        "snapshot",
        "policy",
        "request_id",
        "correlation_id",
        "causation_id",
        "issued_at",
    ],
)
@pytest.mark.parametrize("rpc", ["execute", "stream"])
def test_execution_identity_conflict(engine, field, rpc):
    service, client = engine
    request = build_request(400, SIGNAL_CAPABILITY, {})
    original = client.execute(request, timeout=3)
    if field == "strategy_release_id":
        payload = json_document_to_mapping(request.input)
        payload[field] = "changed"
        request.input.CopyFrom(json_document_from_mapping(payload))
    elif field == "snapshot":
        request.data_snapshot_ref = "other-snapshot"
        payload = json_document_to_mapping(request.input)
        payload["feature_snapshot_id"] = request.data_snapshot_ref
        request.input.CopyFrom(json_document_from_mapping(payload))
    elif field == "policy":
        request.policy_context_ref = "other-policy"
    elif field == "issued_at":
        request.metadata.issued_at.seconds += 1
    else:
        setattr(request.metadata, field, "changed")
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, request, rpc)
    assert error.value.code() == grpc.StatusCode.ALREADY_EXISTS
    assert service.artifacts.count == 2
    raw = service.artifacts.read(
        "tenant-primary", "workspace-primary", "actor-400", original.artifact_refs[0].artifact_id
    )
    signal = parse_signal_output(json.loads(raw))
    assert signal.metadata.request_id == "req-400"


@pytest.mark.parametrize(
    "field", ["tenant_id", "workspace_id", "actor_id", "capabilities", "mode", "unknown"]
)
def test_cancel_authorization_is_scoped(engine, field):
    service, client = engine
    request = build_request(500, SIGNAL_CAPABILITY, {})
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
    assert service.artifacts.count == 2


@pytest.mark.parametrize("field", ["tenant_id", "workspace_id", "actor_id"])
def test_artifact_read_scope_and_collision_resistance(engine, field):
    service, client = engine
    request = build_request(600, SIGNAL_CAPABILITY, {})
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
    assert service.artifacts.count == 4


@pytest.mark.parametrize("rpc", ["execute", "stream"])
@pytest.mark.parametrize("stop", ["deadline", "cancel", "transport"])
def test_inflight_stop_prevents_artifact_write(engine, rpc, stop):
    service, client = engine
    request = build_request(700, SIGNAL_CAPABILITY, {"sleep_ms": 2000})
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


def test_llmquant_source_has_no_upstream_or_tool_runtime_imports():
    root = Path(__file__).parents[1] / "llmquant/src/llmquant"
    allowed = {
        "__future__",
        "argparse",
        "dataclasses",
        "datetime",
        "decimal",
        "typing",
        "google",
        "functools",
        "grpc",
        "hashlib",
        "json",
        "logging",
        "pathlib",
        "quantos",
        "quantos_engine_sdk",
        "llmquant",
        "threading",
        "time",
    }
    for path in root.glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Import):
                assert all(alias.name.split(".")[0] in allowed for alias in node.names)
            if isinstance(node, ast.ImportFrom):
                assert node.module and node.module.split(".")[0] in allowed
                if node.module.startswith("quantos."):
                    assert node.module.startswith(
                        ("quantos.common.", "quantos.engine.", "quantos.strategy.")
                    )
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                assert node.func.id not in {"eval", "exec", "__import__", "open"}


@pytest.mark.parametrize("stop", ["cancel", "deadline"])
def test_stream_stop_between_deltas_never_commits(engine, stop):
    service, client = engine
    request = build_request(800, SIGNAL_CAPABILITY, {})

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


def test_bundle_commit_is_atomic_and_immutable(engine):
    from dataclasses import replace
    from llmquant.signal_mapper import map_signal

    service, client = engine
    request = build_request(900, SIGNAL_CAPABILITY, {})
    first = client.execute(request, timeout=3)
    translated = service.request_adapter.translate(request)
    mapped = map_signal(request.metadata, translated.context, load_fixture(fixture_names()[0]))
    corrupt = replace(mapped, model_artifact={**mapped.model_artifact, "data_version": "tampered"})
    with pytest.raises(ValueError, match="IMMUTABLE"):
        service.artifacts.record_bundle(
            service._owner(request.metadata, first.execution_id), corrupt
        )
    assert service.artifacts.count == 2
    assert client.execute(request, timeout=3).artifact_refs == first.artifact_refs


def test_historical_replay_window_is_explicit_and_non_executable(engine):
    _, client = engine
    request = build_request(901, SIGNAL_CAPABILITY, {})
    request.metadata.issued_at.CopyFrom(
        timestamp_from_datetime(datetime(2026, 1, 1, tzinfo=timezone.utc))
    )
    signal = parse_signal_output(
        json_document_to_mapping(client.execute(request, timeout=3).output)
    )
    assert signal.generated_at == request.metadata.issued_at
    diagnostics = json_document_to_mapping(signal.diagnostics)
    assert diagnostics["time_basis"] == "command_issued_at_replay"
    assert diagnostics["trade_executable"] is False


@pytest.mark.parametrize("field", ["strategy_release_id", "feature_snapshot_id"])
@pytest.mark.parametrize("rpc", ["execute", "stream"])
def test_missing_release_snapshot_is_rejected(engine, field, rpc):
    service, client = engine
    request = build_request(950, SIGNAL_CAPABILITY, {})
    payload = json_document_to_mapping(request.input)
    del payload[field]
    request.input.CopyFrom(json_document_from_mapping(payload))
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, request, rpc)
    assert error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
    assert service.artifacts.count == 0


@pytest.mark.parametrize("corruption", ["digest", "confidence", "window"])
def test_fixture_definition_tampering_is_rejected(tmp_path, monkeypatch, corruption):
    import llmquant.fixtures as fixtures

    catalog = json.loads(fixtures._catalog_path().read_text())
    entry = catalog["fixtures"][0]
    if corruption == "digest":
        entry["model_digest"] = "sha256:" + "0" * 64
    else:
        entry["confidence" if corruption == "confidence" else "validity_minutes"] = (
            "2" if corruption == "confidence" else 0
        )
        definition = {k: v for k, v in entry.items() if k != "model_digest"}
        entry["model_digest"] = (
            "sha256:"
            + hashlib.sha256(
                json.dumps(definition, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest()
        )
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(catalog))
    fixtures.fixture_catalog.cache_clear()
    try:
        with monkeypatch.context() as patched:
            patched.setattr(fixtures, "_catalog_path", lambda: path)
            with pytest.raises(ValueError, match="ENGINE_FIXTURE"):
                fixtures.fixture_catalog()
    finally:
        fixtures.fixture_catalog.cache_clear()
