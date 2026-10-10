"""TP04 real UDS boundary, replay, Artifact and lifecycle acceptance checks."""

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
from trading_agents.fixtures import (
    build_signal_payload,
    fixture_names,
    fixed_input_cases,
    load_fixture,
)
from trading_agents.manifest import PROPOSAL_CAPABILITY
from trading_agents.service import TradingAgentsService
from test_trading_agents_contract import build_request as contract_request, parse_proposal_output
from quantos_engine_sdk import input_hash


def build_request(index, capability, payload):
    fixture = load_fixture(fixture_names()[0])
    base = {
        "fixture": fixture.fixture_name,
        "account_id": "paper-account",
        "policy_snapshot_id": f"policy-{index}",
        "portfolio_snapshot_id": f"portfolio-{index}",
        "signal": build_signal_payload(fixture, request_seed=str(index)),
    }
    request = contract_request(
        index, {**base, **payload}, data_snapshot_ref=base["portfolio_snapshot_id"]
    )
    request.policy_context_ref = base["policy_snapshot_id"]
    return request


@pytest.fixture
def engine():
    path = Path("/tmp") / f"quantos-tp04-{uuid4().hex}.sock"
    service = TradingAgentsService()
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
    request = contract_request(
        1000 + int(case.case_id.split("-")[1]),
        {
            "fixture": case.fixture_name,
            "account_id": case.account_id,
            "policy_snapshot_id": case.policy_snapshot_id,
            "portfolio_snapshot_id": case.portfolio_snapshot_id,
            "signal": case.signal_payload,
            "tools": list(case.requested_tools),
        },
    )
    first = client.execute(request, timeout=3)
    second = client.execute(request, timeout=3)
    assert first.output == second.output and first.artifact_refs == second.artifact_refs
    assert first.input_hash == second.input_hash == input_hash(request.input)
    streams = [
        client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=3)
        for _ in range(2)
    ]
    assert [s.delta for s in streams[0]] == [s.delta for s in streams[1]]
    assert [s.sequence_id for s in streams[0]] == ["seq-1", "seq-2", "seq-3"]
    assert streams[0][-1].artifact_refs == first.artifact_refs
    proposal = parse_proposal_output(json_document_to_mapping(first.output))
    fixture = load_fixture(case.fixture_name)
    assert proposal.counter_views == list(fixture.counter_views)
    assert proposal.executable is False and proposal.evidence_refs
    generated = proposal.signal.generated_at.ToDatetime(timezone.utc)
    assert (
        generated
        < proposal.expires_at.ToDatetime(timezone.utc)
        <= proposal.signal.valid_until.ToDatetime(timezone.utc)
    )
    assert proposal.expires_at.ToDatetime(timezone.utc) == min(
        generated + timedelta(minutes=fixture.validity_minutes),
        proposal.signal.valid_until.ToDatetime(timezone.utc),
    )
    assert len(first.artifact_refs) == service.artifacts.count == 2
    assert {r.artifact_id for r in first.artifact_refs} == {
        r.artifact_id for r in proposal.evidence_refs
    }
    for ref in first.artifact_refs:
        raw = service.artifacts.read(
            request.metadata.tenant_id,
            request.metadata.workspace_id,
            request.metadata.actor.actor_id,
            ref.artifact_id,
        )
        assert ref.sha256 == "sha256:" + hashlib.sha256(raw).hexdigest()
        assert ref.uri.startswith("mock-artifact://trading-agents/")
        artifact = json.loads(raw)
        assert artifact["fixture_digest"] == fixture.fixture_digest
        assert artifact["audit"]["input_hash"] == first.input_hash
        for flag in [
            "executable",
            "upstream_runtime_loaded",
            "tools_executed",
            "snapshots_resolved",
            "risk_evaluation_performed",
        ]:
            assert artifact[flag] is False
        if artifact["artifact_type"] == "CommitteeDebateArtifact":
            assert artifact["counter_views"] == list(proposal.counter_views)


def test_five_rpc_shared_harness(engine):
    _, client = engine
    assert_five_rpc_contract(client, build_request(100, PROPOSAL_CAPABILITY, {}), "trading-agents")


DENIED = [
    {"trade_command": {}},
    {"order": {}},
    {"venue": "venue"},
    {"secret_ref": "sentinel"},
    {"network_access": True},
    {"external_url": "https://example.invalid"},
    {"order_tool": "place_order"},
    {"tools": ["read_secret"]},
    {"tools": ["order.execute"]},
    {"tools": ["shell"]},
    {"tools": ["web_search"]},
    {"TOOLS": []},
    {"executable": True},
    {"approval_signature": "sentinel"},
    {"nested": [{"Secret-Ref": "sentinel"}]},
    {"tenant_id": "other"},
    {"workspace_id": "other"},
    {"actor_id": "other"},
    {"capabilities": ["trade.execute"]},
    {"api_key": "sentinel"},
    {"authorization": "sentinel"},
    {"data_snapshot_ref": "other"},
    {"policy_context_ref": "other"},
    {"data_query": {"lineage": {"order": {}}}},
    {"data_query": {"usage": {"trading_approved": True}}},
    {"data_query": {"license": {"approved_for_production": "false"}}},
]
INVALID = [
    {"data_query": {"provider": {}}},
    {"data_query": {"license": {"label": []}}},
    {"data_query": {"lineage": {"content_hash": 1}}},
    {"data_query": {"usage": []}},
    {"data_query": {"dataset": 1}},
    {"data_query": {"response_hash": []}},
    {"tools": "query_signal"},
    {"tools": [None]},
    {"tools": [1]},
    {"tools": {}},
    {"tools": ["query_signal"] * 4},
    {"sleep_ms": -1},
    {"sleep_ms": 5001},
    {"sleep_ms": True},
    {"sleep_ms": "bad"},
    {"sleep_ms": 0.5},
    {"stream_delay_ms": -1},
    {"stream_delay_ms": 0.5},
    {"stream_delay_ms": True},
    {"account_id": {}},
    {"account_id": ""},
    {"account_id": " "},
    {"account_id": "x" * 513},
    {"portfolio_snapshot_id": "other"},
    {"policy_snapshot_id": "other"},
    {"signal": {}},
    {"signal": []},
    {"signal": None},
    {"fixture": []},
    {"fixture": "unknown"},
    {"fixture": "../../unknown"},
    {"data_query": []},
    {"data_query": {"license": "bad"}},
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
        invoke(client, build_request(200, PROPOSAL_CAPABILITY, payload), rpc)
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
    request = build_request(300, PROPOSAL_CAPABILITY, {})
    request.metadata.mode = mode
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, request, rpc)
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    assert service.artifacts.count == 0


@pytest.mark.parametrize(
    "field",
    [
        "account_id",
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
    request = build_request(400, PROPOSAL_CAPABILITY, {})
    original = client.execute(request, timeout=3)
    if field == "account_id":
        payload = json_document_to_mapping(request.input)
        payload[field] = "changed"
        request.input.CopyFrom(json_document_from_mapping(payload))
    elif field == "snapshot":
        request.data_snapshot_ref = "other-snapshot"
        payload = json_document_to_mapping(request.input)
        payload["portfolio_snapshot_id"] = request.data_snapshot_ref
        request.input.CopyFrom(json_document_from_mapping(payload))
    elif field == "policy":
        request.policy_context_ref = "other-policy"
        payload = json_document_to_mapping(request.input)
        payload["policy_snapshot_id"] = request.policy_context_ref
        request.input.CopyFrom(json_document_from_mapping(payload))
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
    artifact = json.loads(raw)
    assert artifact["audit"]["actor_id"] == "actor-400"


@pytest.mark.parametrize(
    "field", ["tenant_id", "workspace_id", "actor_id", "capabilities", "mode", "unknown"]
)
def test_cancel_authorization_is_scoped(engine, field):
    service, client = engine
    request = build_request(500, PROPOSAL_CAPABILITY, {})
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
    request = build_request(600, PROPOSAL_CAPABILITY, {})
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
    payload = json_document_to_mapping(request.input)
    payload["signal"]["metadata"]["tenant_id"] = request.metadata.tenant_id
    payload["signal"]["metadata"]["workspace_id"] = request.metadata.workspace_id
    request.input.CopyFrom(json_document_from_mapping(payload))
    second = client.execute(request, timeout=3)
    assert second.artifact_refs[0].artifact_id != first.artifact_refs[0].artifact_id
    assert service.artifacts.count == 4


@pytest.mark.parametrize("rpc", ["execute", "stream"])
@pytest.mark.parametrize("stop", ["deadline", "cancel", "transport"])
def test_inflight_stop_prevents_artifact_write(engine, rpc, stop):
    service, client = engine
    request = build_request(700, PROPOSAL_CAPABILITY, {"sleep_ms": 2000})
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


def test_trading_agents_source_has_no_upstream_or_tool_runtime_imports():
    root = Path(__file__).parents[1] / "trading-agents/src/trading_agents"
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
        "trading_agents",
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
                        (
                            "quantos.common.",
                            "quantos.engine.",
                            "quantos.strategy.",
                            "quantos.trading.",
                        )
                    )
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                assert node.func.id not in {"eval", "exec", "__import__", "open"}


@pytest.mark.parametrize("stop", ["cancel", "deadline"])
def test_stream_stop_between_deltas_never_commits(engine, stop):
    service, client = engine
    request = build_request(800, PROPOSAL_CAPABILITY, {})

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
    from trading_agents.proposal_mapper import map_proposal

    service, client = engine
    request = build_request(900, PROPOSAL_CAPABILITY, {})
    first = client.execute(request, timeout=3)
    translated = service.request_adapter.translate(request)
    mapped = map_proposal(request.metadata, translated.context, load_fixture(fixture_names()[0]))
    corrupt = replace(
        mapped, policy_artifact={**mapped.policy_artifact, "policy_snapshot_id": "tampered"}
    )
    with pytest.raises(ValueError, match="IMMUTABLE"):
        service.artifacts.record_bundle(
            service._owner(request.metadata, first.execution_id), corrupt
        )
    assert service.artifacts.count == 2
    assert client.execute(request, timeout=3).artifact_refs == first.artifact_refs


SIGNAL_MUTATIONS = [
    (
        "digest",
        lambda s: s["diagnostics"]["value"].update(model_digest="sha256:label"),
        grpc.StatusCode.INVALID_ARGUMENT,
    ),
    (
        "tenant",
        lambda s: s["metadata"].update(tenant_id="other"),
        grpc.StatusCode.PERMISSION_DENIED,
    ),
    (
        "workspace",
        lambda s: s["metadata"].update(workspace_id="other"),
        grpc.StatusCode.PERMISSION_DENIED,
    ),
    (
        "mode",
        lambda s: s["metadata"].update(mode="RUNTIME_MODE_PAPER"),
        grpc.StatusCode.PERMISSION_DENIED,
    ),
    (
        "secret",
        lambda s: s["diagnostics"]["value"].update(nested={"secretRef": "sentinel"}),
        grpc.StatusCode.PERMISSION_DENIED,
    ),
    (
        "order",
        lambda s: s["diagnostics"]["value"].update(nested=[{"order_tool": "submit"}]),
        grpc.StatusCode.PERMISSION_DENIED,
    ),
    (
        "authority",
        lambda s: s["diagnostics"]["value"].update(trade_executable=True),
        grpc.StatusCode.PERMISSION_DENIED,
    ),
    (
        "tools",
        lambda s: s["diagnostics"]["value"].update(tools_executed=True),
        grpc.StatusCode.PERMISSION_DENIED,
    ),
    (
        "confidence",
        lambda s: s.update(confidence={"value": "NaN"}),
        grpc.StatusCode.INVALID_ARGUMENT,
    ),
    ("strength", lambda s: s.update(strength={"value": "1.01"}), grpc.StatusCode.INVALID_ARGUMENT),
    ("release", lambda s: s.update(strategy_release_id=""), grpc.StatusCode.INVALID_ARGUMENT),
    ("symbol", lambda s: s.update(symbol=""), grpc.StatusCode.INVALID_ARGUMENT),
    (
        "direction",
        lambda s: s.update(direction="SIGNAL_DIRECTION_UNSPECIFIED"),
        grpc.StatusCode.INVALID_ARGUMENT,
    ),
    ("time", lambda s: s.update(valid_until=s["generated_at"]), grpc.StatusCode.INVALID_ARGUMENT),
    ("missing-time", lambda s: s.pop("generated_at"), grpc.StatusCode.INVALID_ARGUMENT),
    ("evidence", lambda s: s.update(evidence_refs=[]), grpc.StatusCode.INVALID_ARGUMENT),
    (
        "model",
        lambda s: s["diagnostics"]["value"].pop("model_version"),
        grpc.StatusCode.INVALID_ARGUMENT,
    ),
    ("schema", lambda s: s.update(unexpected="sentinel"), grpc.StatusCode.INVALID_ARGUMENT),
]


@pytest.mark.parametrize("name,mutate,code", SIGNAL_MUTATIONS, ids=[x[0] for x in SIGNAL_MUTATIONS])
@pytest.mark.parametrize("rpc", ["execute", "stream"])
def test_signal_rejection_and_sanitized_audit(engine, name, mutate, code, rpc, caplog):
    service, client = engine
    request = build_request(910, PROPOSAL_CAPABILITY, {})
    payload = json_document_to_mapping(request.input)
    mutate(payload["signal"])
    request.input.CopyFrom(json_document_from_mapping(payload))
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, request, rpc)
    assert error.value.code() == code
    assert service.artifacts.count == 0
    assert "sentinel" not in (error.value.details() or "")
    assert "decision=denied" in caplog.text and "sentinel" not in caplog.text


@pytest.mark.parametrize("tool", ["order.execute", "read_secret"])
def test_denied_tool_is_audited_without_payload(engine, tool, caplog):
    _, client = engine
    request = build_request(911, PROPOSAL_CAPABILITY, {"tools": [tool]})
    with pytest.raises(grpc.RpcError):
        client.execute(request, timeout=3)
    assert "decision=denied code=PERMISSION_DENIED" in caplog.text
    assert tool not in caplog.text


def test_fixture_tamper_is_rejected(monkeypatch, tmp_path):
    import trading_agents.fixtures as fixtures

    original = fixtures._catalog_path()
    bad = json.loads(original.read_text())
    bad["fixtures"][0]["counter_views"] = []
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(bad))
    fixtures.fixture_catalog.cache_clear()
    monkeypatch.setattr(fixtures, "_catalog_path", lambda: path)
    try:
        with pytest.raises(ValueError, match="DIGEST"):
            fixtures.fixture_catalog()
    finally:
        fixtures.fixture_catalog.cache_clear()


@pytest.mark.parametrize("rpc", ["execute", "stream"])
@pytest.mark.parametrize("change", ["policy", "idempotency"])
def test_context_bound_content_identity(engine, rpc, change):
    _, client = engine
    request = build_request(912, PROPOSAL_CAPABILITY, {})
    first = client.execute(request, timeout=3)
    request.idempotency_key = "another-key"
    if change == "policy":
        request.policy_context_ref = "new-policy"
        payload = json_document_to_mapping(request.input)
        payload["policy_snapshot_id"] = request.policy_context_ref
        request.input.CopyFrom(json_document_from_mapping(payload))
    response = invoke(client, request, rpc)
    refs = response.artifact_refs if rpc == "execute" else response[-1].artifact_refs
    assert (refs == first.artifact_refs) == (change == "idempotency")
