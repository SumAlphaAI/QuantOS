"""TP01-G real UDS differential replay, module faults and recovery."""

from __future__ import annotations

import ast
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

import grpc
import pytest

from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import EngineClient, json_document_to_mapping, uds_target
from quantos_engine_sdk.grpc import serve_engine
from test_vibe_adapter_contract import build_request
from vibe_adapter.artifact_api import VibeArtifactApi
from vibe_adapter.audit import build_audit_envelope
from vibe_adapter.context import VibeContextTranslator
from vibe_adapter.fixtures import fixture_names, load_fixture
from vibe_adapter.providers import InMemoryResearchContractProvider
from vibe_adapter.service import VibeAdapterService
from vibe_adapter.streaming import build_stream_deltas
from vibe_adapter.workflow import WorkflowPlan


class Translator:
    def translate(self, request):
        return VibeContextTranslator().translate(request)


class Planner:
    def __call__(self, context, contract):
        # Independent implementation using only the QuantOS-owned data contract.
        return WorkflowPlan(
            fixture_name=contract.fixture_name,
            workflow_family=contract.workflow_family,
            protocol_version=contract.protocol_version,
            design_capabilities=contract.design_capabilities,
            tool_allowlist=context.allowed_tools,
            prompt=context.prompt,
            data_snapshot_ref=context.data_snapshot_ref,
            policy_context_ref=context.policy_context_ref,
            provenance={
                "source_adapter": contract.provenance.source_adapter,
                "source_surface": contract.provenance.source_surface,
                "absorbed_designs": list(contract.provenance.absorbed_designs),
            },
        )


class Auditor:
    def __call__(self, context, contract, *, policy_decision):
        return dict(build_audit_envelope(context, contract, policy_decision=policy_decision))


class Projector:
    def __call__(self, context, contract, plan, *, audit):
        return build_stream_deltas(context, contract, plan, audit=dict(audit))


class Store:
    """Independent host facade boundary; local backend, never Supabase."""

    def __init__(self):
        self.backend = VibeArtifactApi()
        self.writes = 0

    def record_json_artifact(self, **kwargs):
        self.writes += 1
        return self.backend.record_json_artifact(**kwargs)

    def read_json_artifact(self, **kwargs):
        return self.backend.read_json_artifact(**kwargs)


MODULES = {
    "provider": lambda: {
        "contract_provider": InMemoryResearchContractProvider(
            tuple(load_fixture(n) for n in fixture_names())
        )
    },
    "translator": lambda: {"context_translator": Translator()},
    "workflow": lambda: {"planner": Planner()},
    "audit": lambda: {"auditor": Auditor()},
    "stream": lambda: {"projector": Projector()},
    "artifact": lambda: {"artifact_api": Store()},
}


@pytest.fixture
def host():
    handles = []

    def start(**modules):
        path = Path("/tmp") / f"quantos-tp01-g-{uuid4().hex}.sock"
        service = VibeAdapterService(fixture_mode=True, **modules)
        server = serve_engine(path, service)
        client = EngineClient(uds_target(path))
        handles.append((path, server, client))
        return service, client

    yield start
    for path, server, client in handles:
        client.close()
        server.stop(grace=0).wait()
        path.unlink(missing_ok=True)


def observe(service, client, request):
    response = client.execute(request, timeout=5)
    output = json_document_to_mapping(response.output)
    stream = client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=5)
    assert [d.done for d in stream] == [False, False, True]
    assert [len(d.artifact_refs) for d in stream] == [0, 0, 1]
    assert (
        service.artifact_api.read_json_artifact(
            tenant_id=request.metadata.tenant_id, artifact_id=response.artifact_refs[0].artifact_id
        )
        == output
    )
    return (
        output,
        list(response.artifact_refs),
        list(response.evidence_refs),
        [
            (d.sequence_id, json_document_to_mapping(d.delta), list(d.artifact_refs), d.done)
            for d in stream
        ],
    )


@pytest.mark.parametrize("fixture", fixture_names())
@pytest.mark.parametrize("module", [*MODULES, "all"])
def test_each_module_and_complete_composition_preserve_twenty_replays(host, fixture, module):
    kwargs = (
        MODULES[module]()
        if module != "all"
        else {k: v for make in MODULES.values() for k, v in make().items()}
    )
    base, base_client = host()
    alternate, alternate_client = host(**kwargs)
    request = build_request(701, {"fixture": fixture, "tools": ["read_document"]})
    expected = observe(base, base_client, request)
    assert observe(alternate, alternate_client, request) == expected
    assert observe(alternate, alternate_client, request) == expected
    if module in ("artifact", "all"):
        assert alternate.artifact_api.writes == 4


@pytest.mark.parametrize("fixture", fixture_names())
def test_alias_free_mode_preserves_canonical_output(host, fixture):
    base, base_client = host()
    alternate, alternate_client = host(compatibility_aliases=False)
    request = build_request(702, {"fixture": fixture})
    original = observe(base, base_client, request)
    clean = observe(alternate, alternate_client, request)
    assert original[0]["upstream_surface"] == original[0]["provenance"]["source_surface"]
    assert original[0]["absorbed_designs"] == original[0]["provenance"]["absorbed_designs"]
    canonical = {
        k: v for k, v in original[0].items() if k not in ("upstream_surface", "absorbed_designs")
    }
    assert clean[0] == canonical
    assert clean[3][0][1] == original[3][0][1]
    assert clean[3][1][1] == original[3][1][1]
    assert clean[3][2][1] == original[3][2][1]
    assert clean[1][0].sha256 != original[1][0].sha256  # Hashes bind actual serialized bytes.


@pytest.mark.parametrize(
    "module,stream",
    [
        (m, s)
        for m in ["translator", "workflow", "audit", "stream", "provider"]
        for s in [False, True]
        if m != "stream" or s
    ],
)
@pytest.mark.parametrize("failure", ["invalid", "exception"])
def test_module_fault_rejected_before_artifact_then_host_reconstruction_recovers(
    host, module, failure, stream
):
    def broken(*args, **kwargs):
        if failure == "exception":
            raise RuntimeError("private-provider-detail")
        if module == "workflow":
            return replace(Planner()(*args), protocol_version="fork.internal.v1")
        if module == "audit":
            result = Auditor()(*args, **kwargs)
            result["tenant_id"] = "other-tenant"
            return result
        if module == "stream":
            result = Projector()(*args, **kwargs)
            result[0]["phase"] = "fork_event"
            return result
        return None

    class BadTranslator:
        translate = staticmethod(broken)

    class BadProvider:
        load_contract = staticmethod(broken)

        def list_fixture_names(self):
            return fixture_names()

    kwargs = (
        {"context_translator": BadTranslator()}
        if module == "translator"
        else {"contract_provider": BadProvider()}
        if module == "provider"
        else {{"workflow": "planner", "audit": "auditor", "stream": "projector"}[module]: broken}
    )
    service, client = host(**kwargs)
    request = build_request(703, {"fixture": fixture_names()[0]})
    with pytest.raises(grpc.RpcError) as error:
        if stream:
            client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=5)
        else:
            client.execute(request, timeout=5)
    assert error.value.code() == (
        grpc.StatusCode.INVALID_ARGUMENT if failure == "invalid" else grpc.StatusCode.INTERNAL
    )
    assert "private-provider-detail" not in (error.value.details() or "")
    assert not service.artifact_api._objects
    recovered, recovered_client = host(
        **{k: v for make in MODULES.values() for k, v in make().items()}
    )
    assert (
        observe(recovered, recovered_client, request)[0]["audit"]["tenant_id"]
        == request.metadata.tenant_id
    )


@pytest.mark.parametrize(
    "payload",
    [
        {"tools": ["bash"]},
        {"secret_ref": "private"},
        {"network_access": True},
        {"venue": "venue"},
        {"planner": "attacker"},
        {"compatibility_aliases": False},
    ],
)
def test_request_cannot_select_modules_or_widen_mandatory_policy(host, payload):
    class Bypass:
        def translate(self, request):
            raise AssertionError("replacement must never see forbidden input")

    service, client = host(context_translator=Bypass())
    with pytest.raises(grpc.RpcError) as error:
        client.execute(build_request(704, payload), timeout=5)
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    assert not service.artifact_api._objects


def test_store_failure_is_redacted_and_native_store_reconstruction_recovers(host):
    class FailedStore(Store):
        def record_json_artifact(self, **kwargs):
            raise RuntimeError("private-storage-detail")

    service, client = host(artifact_api=FailedStore())
    request = build_request(705, {})
    with pytest.raises(grpc.RpcError) as error:
        client.execute(request, timeout=5)
    assert error.value.details() == "ENGINE_ARTIFACT_FAILED"
    assert not service.artifact_api.backend._objects
    good, good_client = host(artifact_api=Store())
    assert observe(good, good_client, request)[0]["protocol_version"] == "quantos.research.v1"


def test_no_production_consumer_uses_deprecated_aliases_or_fork_types():
    root = Path(__file__).resolve().parents[2]
    # Runtime/UI sources only; fixture metadata and historical receipts are not consumers.
    for directory, suffix in [("apps", ".ts"), ("apps", ".tsx"), ("crates", ".rs")]:
        for path in (root / directory).rglob("*" + suffix):
            if any(p in path.parts for p in ("node_modules", ".next", "target", "dist")):
                continue
            text = path.read_text()
            assert "upstream_surface" not in text and "absorbed_designs" not in text, str(path)
    for path in (root / "engines/vibe-adapter/src/vibe_adapter").glob("*.py"):
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                names = (
                    [a.name for a in node.names]
                    if isinstance(node, ast.Import)
                    else [node.module or ""]
                )
                assert not any(n.startswith(("agent.", "forks.", "third_party.")) for n in names)
