"""TP05 actual UDS data/provenance/isolation and lifecycle development evidence."""

from __future__ import annotations

import ast
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import time
from uuid import uuid4
import grpc
import pytest
from openbb_adapter.adapter import FORBIDDEN_FIELDS
from openbb_adapter.fixtures import fixed_input_cases, load_fixture, validate_catalog
from openbb_adapter.license_gate import LicenseGateDecision, LicenseGateError
from openbb_adapter.providers import MockDataQueryProvider, OpenBBEvaluationProvider, content_hash
from openbb_adapter.service import OpenBBAdapterService
from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import (
    EngineClient,
    json_document_from_mapping as doc,
    json_document_to_mapping as mapping,
    serve_engine,
    timestamp_from_datetime as ts,
    uds_target,
)
from test_openbb_adapter_contract import build_request as original_request


def build_request(index=1, **payload):
    fixture = load_fixture("crypto_market_btc")
    return original_request(
        index,
        {
            "provider": "mock",
            "fixture": fixture.fixture_name,
            "dataset": fixture.dataset,
            "schema_ref": fixture.schema_ref,
            "symbols": list(fixture.symbols),
            "query_text": "btc fixture research",
            "intended_use": "research",
            "deployment_target": "test",
            **payload,
        },
    )


@pytest.fixture
def engine():
    path = Path("/tmp") / f"quantos-tp05-{uuid4().hex}.sock"
    service = OpenBBAdapterService()
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
    request = original_request(
        1000 + int(case.case_id.split("-")[1]),
        {
            "provider": case.provider,
            "fixture": case.fixture_name,
            "dataset": case.dataset,
            "schema_ref": case.schema_ref,
            "symbols": list(case.symbols),
            "query_text": case.query_text,
            "intended_use": case.intended_use,
            "deployment_target": case.deployment_target,
            "tools": list(case.requested_tools),
        },
    )
    a = client.execute(request, timeout=3)
    b = client.execute(request, timeout=3)
    assert (
        a.output == b.output and a.artifact_refs == b.artifact_refs and a.input_hash == b.input_hash
    )
    streams = [invoke(client, request, "stream") for _ in range(2)]
    assert [s.delta for s in streams[0]] == [s.delta for s in streams[1]]
    assert streams[0][-1].artifact_refs == a.artifact_refs and streams[0][-1].done
    assert {e.artifact_id for e in a.evidence_refs} == {r.artifact_id for r in a.artifact_refs}
    value = mapping(a.output)
    fixture = load_fixture(case.fixture_name)
    assert value["scope"]["workflow_run_id"] == request.workflow_run_id
    assert value["scope"]["tenant_id"] == request.metadata.tenant_id
    assert value["license"]["approved_for_production"] is False
    assert value["usage"]["trading_approved"] is False and value["sources"]
    assert value["records"] == list(fixture.records) and value["window"] == fixture.window
    assert value["lineage"]["fixture_digest"] == fixture.fixture_digest
    assert value["response_hash"] == content_hash(
        {k: v for k, v in value.items() if k != "response_hash"}
    )
    assert len({r.uri for r in a.artifact_refs}) == 2 and service.artifacts.count == 2
    for ref in a.artifact_refs:
        raw = service.artifacts.read(
            request.metadata.tenant_id,
            request.metadata.workspace_id,
            request.metadata.actor.actor_id,
            ref.artifact_id,
        )
        assert ref.sha256 == "sha256:" + hashlib.sha256(raw).hexdigest()
        assert ref.uri.startswith("mock-artifact://openbb-adapter/")
        artifact = json.loads(raw)
        assert artifact["artifact_id"] == ref.artifact_id
        assert artifact["input_hash"] == a.input_hash
        assert artifact["scope"] == value["scope"]
        assert artifact["upstream_runtime_loaded"] is False and artifact["tools_executed"] is False
        if artifact["artifact_type"] == "NormalizedDataQueryArtifact":
            assert value["lineage"]["content_hash"] == ref.sha256
        else:
            assert value["lineage"]["artifact_hash"] == ref.sha256
        for part in ("tenant", "workspace", "actor"):
            owner = [
                request.metadata.tenant_id,
                request.metadata.workspace_id,
                request.metadata.actor.actor_id,
            ]
            owner[("tenant", "workspace", "actor").index(part)] = "foreign"
            with pytest.raises(PermissionError):
                service.artifacts.read(*owner, ref.artifact_id)


@pytest.mark.parametrize("rpc", ["execute", "stream"])
@pytest.mark.parametrize("field", sorted(FORBIDDEN_FIELDS))
def test_recursive_authority_order_and_secret_denial(engine, rpc, field, caplog):
    service, client = engine
    request = build_request(tools=[{"wrapper": {field: "sensitive-canary"}}])
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, request, rpc)
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    assert service.artifacts.count == 0
    assert "sensitive-canary" not in caplog.text
    assert "decision=denied" in caplog.text


@pytest.mark.parametrize("rpc", ["execute", "stream"])
@pytest.mark.parametrize(
    "payload,code",
    [
        ({"tools": ["order"]}, "PERMISSION_DENIED"),
        ({"tools": ["read_secret"]}, "PERMISSION_DENIED"),
        ({"tools": "query_snapshot"}, "INVALID_ARGUMENT"),
        ({"tools": [None]}, "INVALID_ARGUMENT"),
        ({"provider": None}, "INVALID_ARGUMENT"),
        ({"provider": "unknown"}, "INVALID_ARGUMENT"),
        ({"fixture": "missing"}, "INVALID_ARGUMENT"),
        ({"dataset": "fake"}, "INVALID_ARGUMENT"),
        ({"schema_ref": "fake"}, "INVALID_ARGUMENT"),
        ({"symbols": ["ETH"]}, "INVALID_ARGUMENT"),
        ({"symbols": "BTCUSDT"}, "INVALID_ARGUMENT"),
        ({"symbols": []}, "INVALID_ARGUMENT"),
        ({"symbols": [None]}, "INVALID_ARGUMENT"),
        ({"query_text": False}, "INVALID_ARGUMENT"),
        ({"query_text": "https://external.test"}, "INVALID_ARGUMENT"),
        ({"query_text": " "}, "INVALID_ARGUMENT"),
        ({"intended_use": "trading"}, "PERMISSION_DENIED"),
        ({"intended_use": None}, "PERMISSION_DENIED"),
        ({"intended_use": []}, "PERMISSION_DENIED"),
        ({"deployment_target": []}, "INVALID_ARGUMENT"),
        ({"deployment_target": "production"}, "FAILED_PRECONDITION"),
        ({"provider": "openbb"}, "FAILED_PRECONDITION"),
        ({"deployment_target": "staging"}, "INVALID_ARGUMENT"),
        ({"query_text": "x" * 513}, "INVALID_ARGUMENT"),
        ({"sleep_ms": True}, "INVALID_ARGUMENT"),
        ({"sleep_ms": -1}, "INVALID_ARGUMENT"),
        ({"stream_delay_ms": 5001}, "INVALID_ARGUMENT"),
        ({"stream_delay_ms": "1"}, "INVALID_ARGUMENT"),
        ({"sleep_ms": 0.1}, "INVALID_ARGUMENT"),
        ({"unknown": True}, "PERMISSION_DENIED"),
        ({"tools": [{"apiKey": "sensitive-canary"}]}, "PERMISSION_DENIED"),
    ],
)
def test_typed_boundary(engine, rpc, payload, code):
    service, client = engine
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, build_request(**payload), rpc)
    assert error.value.code().name == code and service.artifacts.count == 0


@pytest.mark.parametrize("rpc", ["execute", "stream"])
@pytest.mark.parametrize(
    "kind",
    [
        "mode",
        "capability",
        "schema",
        "missing_capability",
        "production",
        "staging",
        "tenant",
        "workspace",
        "actor",
    ],
)
def test_engine_envelope(engine, rpc, kind):
    service, client = engine
    request = build_request()
    code = grpc.StatusCode.PERMISSION_DENIED
    if kind == "mode":
        request.metadata.mode = common_pb2.RUNTIME_MODE_PAPER
    elif kind == "capability":
        request.capability = "order.execute.v1"
        code = grpc.StatusCode.INVALID_ARGUMENT
    elif kind == "schema":
        request.input_schema_version = "v2"
        code = grpc.StatusCode.INVALID_ARGUMENT
    elif kind == "missing_capability":
        request.metadata.actor.ClearField("capabilities")
    elif kind in {"production", "staging"}:
        request.metadata.environment = (
            common_pb2.ENVIRONMENT_PRODUCTION
            if kind == "production"
            else common_pb2.ENVIRONMENT_STAGING
        )
        code = grpc.StatusCode.FAILED_PRECONDITION
    else:
        if kind == "actor":
            request.metadata.actor.actor_id = ""
        else:
            setattr(request.metadata, kind + "_id", "")
        code = grpc.StatusCode.INVALID_ARGUMENT
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, request, rpc)
    assert error.value.code() == code and service.artifacts.count == 0


def test_cache_scope_ttl_eviction_and_copy_isolation(engine):
    service, _ = engine
    clock = [0.0]
    provider = MockDataQueryProvider(max_entries=2, clock=lambda: clock[0])
    ctx = service.request_adapter.translate(build_request()).context
    a = provider.resolve(ctx)
    a.payload["records"][0]["close"] = "tampered"
    b = provider.resolve(ctx)
    assert b.payload["records"][0]["close"] != "tampered"
    assert len(provider._cache) == 1
    for field, value in [
        ("tenant_id", "tenant-other"),
        ("workspace_id", "workspace-other"),
        ("actor_id", "actor-other"),
        ("workflow_run_id", "workflow-other"),
        ("intended_use", "evaluation"),
        ("deployment_target", "evaluation"),
        ("metadata_hash", "changed"),
        ("input_hash", "changed"),
    ]:
        changed = provider.resolve(replace(ctx, **{field: value}))
        assert changed.payload["cache"]["cache_key"] != b.payload["cache"]["cache_key"]
        assert changed.payload["scope"]["workflow_run_id"] == (
            "workflow-other" if field == "workflow_run_id" else ctx.workflow_run_id
        )
        assert len(provider._cache) <= 2
    provider.resolve(ctx)
    old = provider._cache[b.payload["cache"]["cache_key"]][1]
    clock[0] = 46.0
    provider.resolve(ctx)
    assert provider._cache[b.payload["cache"]["cache_key"]][1] is not old


def test_license_gate_runs_before_cached_read(engine):
    service, _ = engine
    context = service.request_adapter.translate(
        build_request(provider="openbb", deployment_target="evaluation")
    ).context
    provider = OpenBBEvaluationProvider()
    provider.resolve(context)
    assert provider.decision is not None
    provider.decision = replace(provider.decision, allow_evaluation=False)
    with pytest.raises(LicenseGateError):
        provider.resolve(context)
    provider.decision = LicenseGateDecision.load_default()
    with pytest.raises(LicenseGateError):
        provider.resolve(replace(context, deployment_target="production"))


@pytest.mark.parametrize("rpc", ["execute", "stream"])
def test_identity_conflict(engine, rpc):
    service, client = engine
    request = build_request()
    invoke(client, request, rpc)
    request.input.CopyFrom(doc({**mapping(request.input), "query_text": "different"}))
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, request, rpc)
    assert error.value.code() == grpc.StatusCode.ALREADY_EXISTS


@pytest.mark.parametrize("part", ["tenant", "workspace", "actor", "capability", "mode"])
def test_cancel_scope(engine, part):
    service, client = engine
    request = build_request(stream_delay_ms=1200)
    stream = client._stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=3)
    first = next(stream)
    cancel = engine_pb2.CancelRequest(metadata=request.metadata, execution_id=first.execution_id)
    if part == "actor":
        cancel.metadata.actor.actor_id = "foreign"
    elif part == "capability":
        cancel.metadata.actor.ClearField("capabilities")
    elif part == "mode":
        cancel.metadata.mode = common_pb2.RUNTIME_MODE_PAPER
    else:
        setattr(cancel.metadata, part + "_id", "foreign")
    with pytest.raises(grpc.RpcError) as error:
        client.cancel(cancel, timeout=3)
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    cancel.metadata.CopyFrom(request.metadata)
    assert client.cancel(cancel, timeout=3).cancelled
    with pytest.raises(grpc.RpcError) as error:
        next(stream)
    assert error.value.code() == grpc.StatusCode.CANCELLED and service.artifacts.count == 0


@pytest.mark.parametrize("rpc", ["execute", "stream"])
def test_deadline_stops_before_commit(engine, rpc):
    service, client = engine
    request = build_request(sleep_ms=200)
    request.deadline.CopyFrom(ts(datetime.now(timezone.utc) + timedelta(milliseconds=30)))
    with pytest.raises(grpc.RpcError) as error:
        invoke(client, request, rpc)
    assert error.value.code() == grpc.StatusCode.DEADLINE_EXCEEDED and service.artifacts.count == 0


def test_transport_cancel_no_artifacts(engine):
    service, client = engine
    request = build_request(stream_delay_ms=1200)
    stream = client._stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=3)
    next(stream)
    assert stream.cancel()
    time.sleep(0.04)
    assert service.artifacts.count == 0


def test_atomic_bundle_and_cancel_ack(engine):
    service, client = engine
    request = build_request(sleep_ms=200)
    with ThreadPoolExecutor() as pool:
        future = pool.submit(client.execute, request, timeout=3)
        for _ in range(100):
            if service._inputs:
                break
            time.sleep(0.005)
        assert client.cancel(
            engine_pb2.CancelRequest(metadata=request.metadata, execution_id="run-1:idem-1"),
            timeout=3,
        ).cancelled
        with pytest.raises(grpc.RpcError) as error:
            future.result()
        assert error.value.code() == grpc.StatusCode.CANCELLED
    assert service.artifacts.count == 0


def test_fixture_integrity_and_copy_boundary():
    fixture = load_fixture("crypto_market_btc")
    fixture.records[0]["close"] = "changed"
    assert load_fixture("crypto_market_btc").records[0]["close"] != "changed"
    path = Path(__file__).parents[1] / "openbb-adapter/src/openbb_adapter/fixtures/catalog.json"
    for mutate in [
        lambda d: d["fixtures"][0].update(cache_ttl_secs=0),
        lambda d: d["fixtures"][0]["sources"].clear(),
        lambda d: d["fixtures"][0]["records"][0].update(close="NaN"),
    ]:
        d = json.loads(path.read_text())
        mutate(d)
        with pytest.raises(ValueError):
            validate_catalog(d)


def test_no_upstream_or_core_domain_imports():
    root = Path(__file__).parents[1] / "openbb-adapter/src/openbb_adapter"
    for path in root.glob("*.py"):
        tree = ast.parse(path.read_text())
        imports = [n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)]
        imports += [a.name for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names]
        assert all(
            not n
            or n.split(".")[0]
            not in {
                "openbb",
                "quantos_core",
                "quantos_risk",
                "quantos_execution",
                "requests",
                "httpx",
                "socket",
                "subprocess",
            }
            for n in imports
        )


def test_artifact_bundle_collision_is_atomic(engine):
    service, client = engine
    request = build_request()
    client.execute(request, timeout=3)
    translated = service.request_adapter.translate(request)
    mapped = service.provider_registry["mock"].resolve(translated.context)
    mapped.normalized_artifact["artifact_id"] = "normalized-data:new-entry"
    mapped.lineage_artifact["sources"][0]["source_id"] = "tampered"
    owner = (
        request.metadata.tenant_id,
        request.metadata.workspace_id,
        request.metadata.actor.actor_id,
        "run-1:idem-1",
    )
    with pytest.raises(ValueError, match="IMMUTABLE"):
        service.artifacts.record_bundle(owner, mapped)
    assert service.artifacts.count == 2
    with pytest.raises(PermissionError):
        service.artifacts.read(*owner[:3], "normalized-data:new-entry")


def test_concurrent_cache_hits_cannot_mutate_shared_payload(engine):
    service, _ = engine
    provider = MockDataQueryProvider()
    context = service.request_adapter.translate(build_request()).context
    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(lambda _: provider.resolve(context), range(32)))
    responses[0].payload["records"].clear()
    assert all(r.payload["records"] for r in responses[1:])
    assert len(provider._cache) == 1 and provider.resolve(context).payload["records"]


@pytest.mark.parametrize("case", ["ttl", "source", "record", "window"])
def test_fixture_validation_rejects_invalid_content_even_with_updated_digest(case):
    path = Path(__file__).parents[1] / "openbb-adapter/src/openbb_adapter/fixtures/catalog.json"
    catalog = json.loads(path.read_text())
    entry = catalog["fixtures"][0]
    if case == "ttl":
        entry["cache_ttl_secs"] = 0
    elif case == "source":
        entry["sources"][0]["dataset"] = "foreign.dataset"
    elif case == "record":
        entry["records"][0]["close"] = "NaN"
    else:
        entry["window"]["end_at"] = "2020-01-01T00:00:00Z"
    entry["fixture_digest"] = content_hash(
        {k: v for k, v in entry.items() if k != "fixture_digest"}
    )
    with pytest.raises(ValueError):
        validate_catalog(catalog)
