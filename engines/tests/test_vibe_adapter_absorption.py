"""TP01-D deterministic design replay and provider contract rejection."""

from __future__ import annotations

from dataclasses import replace

import grpc
import pytest

from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import json_document_to_mapping
from test_vibe_adapter_contract import build_request
from vibe_adapter.fixtures import fixture_names, load_fixture
from vibe_adapter.protocols import ResearchContractError
from vibe_adapter.providers import InMemoryResearchContractProvider
from vibe_adapter.streaming import build_stream_deltas
from vibe_adapter.workflow import build_workflow_plan


pytest_plugins = ["test_vibe_adapter_skeleton"]


@pytest.mark.parametrize("fixture_name", fixture_names())
def test_twenty_deterministic_design_replays(adapter, fixture_name):
    service, client = adapter
    request = build_request(501, {"fixture": fixture_name, "tools": []})
    executions = [client.execute(request, timeout=5) for _ in range(2)]
    outputs = [json_document_to_mapping(r.output) for r in executions]
    assert outputs[0] == outputs[1]
    assert executions[0].artifact_refs == executions[1].artifact_refs
    expected = {
        "request_id": request.metadata.request_id,
        "tenant_id": request.metadata.tenant_id,
        "workspace_id": request.metadata.workspace_id,
        "actor_id": request.metadata.actor.actor_id,
        "workflow_run_id": request.workflow_run_id,
        "correlation_id": request.metadata.correlation_id,
        "causation_id": request.metadata.causation_id,
        "data_snapshot_ref": request.data_snapshot_ref,
        "policy_context_ref": request.policy_context_ref,
    }
    assert expected.items() <= outputs[0]["audit"].items()
    assert outputs[0]["tool_allowlist"] == []
    forbidden = {
        "session_id",
        "event_id",
        "last_event_id",
        "memory_path",
        "auth_ticket",
    }
    assert forbidden.isdisjoint(outputs[0])
    streams = [
        client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=5)
        for _ in range(2)
    ]
    projected = []
    for stream in streams:
        assert [d.sequence_id for d in stream] == ["seq-1", "seq-2", "seq-3"]
        assert [d.done for d in stream] == [False, False, True]
        assert [len(d.artifact_refs) for d in stream] == [0, 0, 1]
        deltas = [json_document_to_mapping(d.delta) for d in stream]
        assert [d["phase"] for d in deltas] == [
            "context_translated",
            "workflow_planned",
            "artifact_recorded",
        ]
        assert expected.items() <= deltas[-1]["audit"].items()
        assert all(forbidden.isdisjoint(d) for d in deltas)
        assert (
            service.artifact_api.read_json_artifact(
                tenant_id=request.metadata.tenant_id,
                artifact_id=stream[-1].artifact_refs[0].artifact_id,
            )
            == outputs[0]
        )
        projected.append(deltas)
    assert projected[0] == projected[1]
    assert streams[0][-1].artifact_refs == streams[1][-1].artifact_refs


def invalid_contracts():
    c = load_fixture(fixture_names()[0])
    return [
        None,
        {"session_id": "upstream-only"},
        replace(c, stream_profile=()),
        replace(c, stream_profile=("session_created", "upstream_cursor")),
        replace(
            c,
            stream_profile=(
                "context_translated",
                "artifact_recorded",
                "workflow_planned",
            ),
        ),
        replace(c, stream_profile=c.stream_profile + ("extra",)),
        replace(c, stream_profile=("context_translated",) * 3),
        replace(c, protocol_version="upstream.sse.v1"),
        replace(c, fixture_name="different_fixture"),
        replace(c, summary=""),
        replace(c, workflow_family=""),
        replace(c, design_capabilities=()),
        replace(c, design_capabilities=("duplicate", "duplicate")),
        replace(c, design_capabilities=["mutable"]),
        replace(c, provenance=None),
        replace(c, provenance=replace(c.provenance, source_adapter="")),
        replace(c, provenance=replace(c.provenance, absorbed_designs=())),
        replace(
            c,
            provenance=replace(c.provenance, absorbed_designs=("duplicate", "duplicate")),
        ),
    ]


@pytest.mark.parametrize("contract", invalid_contracts(), ids=[f"contract-{i}" for i in range(18)])
def test_invalid_provider_contract_is_rejected_before_artifact(adapter, contract, caplog):
    service, client = adapter
    service.contract_provider = InMemoryResearchContractProvider((contract,))
    request = build_request(502, {"fixture": fixture_names()[0]})

    # Provider lookup is deliberately independent of the returned fixture identity.
    class Provider:
        def list_fixture_names(self):
            return fixture_names()

        def load_contract(self, _name):
            return contract

    service.contract_provider = Provider()
    for stream in (False, True):
        with pytest.raises(grpc.RpcError) as error:
            if stream:
                client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=5)
            else:
                client.execute(request, timeout=5)
        assert error.value.code() == grpc.StatusCode.INVALID_ARGUMENT
        assert error.value.details() == "ENGINE_CONTRACT_INVALID"
    assert not service.artifact_api._objects
    assert not service._owners
    assert not service._inputs
    assert "contract decision=denied" in caplog.text
    assert "upstream_cursor" not in caplog.text


@pytest.mark.parametrize("projection", ["workflow", "streaming"])
def test_projection_helpers_reject_invalid_contracts(projection):
    from vibe_adapter.context import VibeContextTranslator

    request = build_request(503, {})
    context = VibeContextTranslator().translate(request).context
    good = load_fixture(context.fixture_name)
    bad = replace(good, stream_profile=("session_created",))
    plan = build_workflow_plan(context, good)
    with pytest.raises(ResearchContractError, match="ENGINE_CONTRACT_INVALID"):
        if projection == "workflow":
            build_workflow_plan(context, bad)
        else:
            build_stream_deltas(context, bad, plan)


def test_adapter_imports_only_quantos_protocols_and_local_rewrites():
    import ast
    from pathlib import Path
    import vibe_adapter

    permitted = {
        "__future__",
        "dataclasses",
        "datetime",
        "functools",
        "hashlib",
        "json",
        "logging",
        "pathlib",
        "threading",
        "time",
        "typing",
        "urllib",
        "argparse",
        "grpc",
        "quantos",
        "quantos_engine_sdk",
        "vibe_adapter",
    }
    assert vibe_adapter.__file__ is not None
    for path in Path(vibe_adapter.__file__).parent.glob("*.py"):
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                assert all(alias.name.split(".")[0] in permitted for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                assert node.level == 0 and node.module is not None
                assert node.module.split(".")[0] in permitted
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                assert node.func.id not in {"__import__", "eval", "exec"}


@pytest.mark.parametrize("field", ["request_id", "correlation_id", "causation_id"])
def test_logical_command_audit_identity_is_bound_to_idempotency(adapter, field):
    service, client = adapter
    request = build_request(504, {})
    original = client.execute(request, timeout=5)
    setattr(request.metadata, field, "changed-trace-context")
    for stream in (False, True):
        with pytest.raises(grpc.RpcError) as error:
            if stream:
                client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=5)
            else:
                client.execute(request, timeout=5)
        assert error.value.code() == grpc.StatusCode.ALREADY_EXISTS
        assert error.value.details() == "ENGINE_IDEMPOTENCY_CONFLICT"
    assert len(service.artifact_api._objects) == 1
    output = service.artifact_api.read_json_artifact(
        tenant_id=request.metadata.tenant_id,
        artifact_id=original.artifact_refs[0].artifact_id,
    )
    assert output["audit"][field] != "changed-trace-context"
