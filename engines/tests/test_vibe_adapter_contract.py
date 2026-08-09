from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
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
from vibe_adapter.fixtures import fixture_names
from vibe_adapter.manifest import CAPABILITY_NAME
from vibe_adapter.protocols import ResearchContractProvenance, ResearchExecutionContract
from vibe_adapter.providers import InMemoryResearchContractProvider
from vibe_adapter.service import VibeAdapterService


def build_metadata(index: int) -> common_pb2.CommandMetadata:
    return common_pb2.CommandMetadata(
        request_id=f"req-{index}",
        tenant_id="tenant-primary",
        workspace_id="workspace-primary",
        actor=common_pb2.ActorRef(
            actor_id=f"actor-{index}",
            actor_kind=common_pb2.ActorKind.ACTOR_KIND_USER,
            display_name="QuantOS Tester",
            capabilities=["research.execute"],
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
        capability=CAPABILITY_NAME,
        input_schema_version="v1",
        data_snapshot_ref="snapshot-1",
        policy_context_ref="policy-1",
        input=json_document_from_mapping(payload),
        deadline=timestamp_from_datetime(
            datetime.now(tz=timezone.utc) + timedelta(seconds=5)
        ),
    )


def test_vibe_adapter_contract_all_rpcs() -> None:
    socket_path = Path("/tmp") / f"quantos-vibe-adapter-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, VibeAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        metadata = build_metadata(1)
        metadata_response = client.get_metadata(
            engine_pb2.GetMetadataRequest(metadata=metadata),
            timeout=5,
        )
        assert metadata_response.engine_name == "vibe-adapter"
        assert metadata_response.supported_schema_versions == ["v1"]
        assert metadata_response.capabilities[0].name == CAPABILITY_NAME

        health_response = client.health(
            engine_pb2.HealthRequest(metadata=metadata),
            timeout=5,
        )
        assert health_response.ready is True
        assert health_response.status == "ready"

        execute_request = build_request(
            1,
            {
                "prompt": "Replay the locked research fixture",
                "fixture": fixture_names()[0],
                "tools": ["read_url", "web_search"],
            },
        )
        execute_response = client.execute(execute_request, timeout=5)
        assert execute_response.execution_id == "run-1:idem-1"
        assert execute_response.engine_version == "0.1.0"
        assert len(execute_response.artifact_refs) == 1
        assert len(execute_response.evidence_refs) == 1
        output = json_document_to_mapping(execute_response.output)
        assert output["artifact_api"] == "quantos-artifact-api"
        assert output["workflow_contract"] == "quantos.research.execution_contract"
        assert output["protocol_version"] == "quantos.research.v1"
        assert output["tool_allowlist"] == ["read_url", "web_search"]
        assert output["fixture"] == fixture_names()[0]
        assert output["design_capabilities"]
        assert output["provenance"]["source_adapter"] == "vibe-catalog"

        stream_response = client.stream_execute(
            engine_pb2.StreamExecuteRequest(request=execute_request),
            timeout=5,
        )
        assert len(stream_response) == 3
        assert stream_response[0].done is False
        assert stream_response[1].done is False
        assert stream_response[2].done is True
        assert (
            json_document_to_mapping(stream_response[0].delta)["phase"]
            == "context_translated"
        )
        assert (
            json_document_to_mapping(stream_response[1].delta)["phase"]
            == "workflow_planned"
        )
        assert (
            json_document_to_mapping(stream_response[1].delta)["design_capabilities"]
        )
        assert (
            json_document_to_mapping(stream_response[2].delta)["phase"]
            == "artifact_recorded"
        )
        assert stream_response[2].artifact_refs[0].artifact_id.endswith("stream-output")
        assert output["audit"]["audit_adapter"] == "quantos.observability.audit_record"

        cancel_response = client.cancel(
            engine_pb2.CancelRequest(
                metadata=metadata,
                execution_id=execute_response.execution_id,
                reason="operator-request",
            ),
            timeout=5,
        )
        assert cancel_response.cancelled is True
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_vibe_adapter_rejects_forbidden_tool_requests() -> None:
    socket_path = Path("/tmp") / f"quantos-vibe-adapter-deny-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, VibeAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        request = build_request(2, {"tools": ["bash"]})
        try:
            client.execute(request, timeout=5)
        except grpc.RpcError as error:
            assert error.code() == grpc.StatusCode.PERMISSION_DENIED
            assert "forbidden" in (error.details() or "")
        else:
            raise AssertionError("forbidden tool request should be denied")
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_vibe_adapter_rejects_forbidden_boundary_fields() -> None:
    socket_path = Path("/tmp") / f"quantos-vibe-adapter-boundary-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, VibeAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        for payload in (
            {"venue": "binance"},
            {"secret_ref": "vault://prod/venue"},
            {"network_access": True},
        ):
            request = build_request(3, payload)
            try:
                client.execute(request, timeout=5)
            except grpc.RpcError as error:
                assert error.code() == grpc.StatusCode.PERMISSION_DENIED
            else:
                raise AssertionError("forbidden boundary field should be denied")
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_vibe_adapter_replays_twenty_representative_fixtures() -> None:
    socket_path = Path("/tmp") / f"quantos-vibe-adapter-replay-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, VibeAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        names = fixture_names()
        assert len(names) == 20
        for index, fixture_name in enumerate(names, start=10):
            request = build_request(
                index,
                {
                    "prompt": f"Replay {fixture_name}",
                    "fixture": fixture_name,
                    "tools": ["read_document", "web_search"],
                },
            )
            execute_response = client.execute(request, timeout=5)
            output = json_document_to_mapping(execute_response.output)
            assert output["fixture"] == fixture_name
            assert output["workflow_family"]
            assert output["workflow_contract"] == "quantos.research.execution_contract"
            assert output["protocol_version"] == "quantos.research.v1"
            assert len(output["design_capabilities"]) >= 2
            assert output["upstream_surface"]
            assert len(output["absorbed_designs"]) >= 2
            assert output["audit"]["policy_decision"] == "allowed"

            stream_response = client.stream_execute(
                engine_pb2.StreamExecuteRequest(request=request),
                timeout=5,
            )
            assert len(stream_response) == 3
            assert json_document_to_mapping(stream_response[2].delta)["summary"]
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_vibe_adapter_provider_replacement_preserves_business_protocol() -> None:
    socket_path = Path("/tmp") / f"quantos-vibe-adapter-provider-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()

    replacement_provider = InMemoryResearchContractProvider(
        contracts=(
            ResearchExecutionContract(
                fixture_name="replacement_fixture",
                workflow_family="replacement_research",
                summary="Replacement provider emits the same QuantOS business protocol.",
                stream_profile=(
                    "context_translated",
                    "workflow_planned",
                    "artifact_recorded",
                ),
                protocol_version="quantos.research.v1",
                design_capabilities=("replacement_projection", "replacement_audit"),
                provenance=ResearchContractProvenance(
                    source_adapter="in-memory-replacement",
                    source_surface="replacement_surface",
                    absorbed_designs=("replacement_projection", "replacement_audit"),
                ),
            ),
        )
    )
    server = serve_engine(
        socket_path,
        VibeAdapterService(contract_provider=replacement_provider),
    )
    client = EngineClient(uds_target(socket_path))

    try:
        request = build_request(
            8,
            {
                "prompt": "Run replacement provider",
                "fixture": "replacement_fixture",
                "tools": ["read_document"],
            },
        )
        execute_response = client.execute(request, timeout=5)
        output = json_document_to_mapping(execute_response.output)
        assert output["workflow_contract"] == "quantos.research.execution_contract"
        assert output["protocol_version"] == "quantos.research.v1"
        assert output["artifact_api"] == "quantos-artifact-api"
        assert output["fixture"] == "replacement_fixture"
        assert output["workflow_family"] == "replacement_research"
        assert output["design_capabilities"] == [
            "replacement_projection",
            "replacement_audit",
        ]
        assert output["provenance"]["source_adapter"] == "in-memory-replacement"

        stream_response = client.stream_execute(
            engine_pb2.StreamExecuteRequest(request=request),
            timeout=5,
        )
        assert len(stream_response) == 3
        assert json_document_to_mapping(stream_response[0].delta)[
            "workflow_contract"
        ] == "quantos.research.execution_contract"
        assert json_document_to_mapping(stream_response[1].delta)[
            "design_capabilities"
        ] == ["replacement_projection", "replacement_audit"]
        assert json_document_to_mapping(stream_response[2].delta)["audit"][
            "protocol_version"
        ] == "quantos.research.v1"
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()


def test_vibe_adapter_rejects_unsupported_capability() -> None:
    socket_path = Path("/tmp") / f"quantos-vibe-adapter-cap-{uuid4().hex}.sock"
    if socket_path.exists():
        socket_path.unlink()
    server = serve_engine(socket_path, VibeAdapterService())
    client = EngineClient(uds_target(socket_path))

    try:
        request = build_request(4, {"fixture": fixture_names()[0]})
        request.capability = "research.unsupported"
        try:
            client.execute(request, timeout=5)
        except grpc.RpcError as error:
            assert error.code() == grpc.StatusCode.INVALID_ARGUMENT
            assert "unsupported capability" in (error.details() or "")
        else:
            raise AssertionError("unsupported capability should be rejected")
    finally:
        client.close()
        server.stop(grace=0)
        if socket_path.exists():
            socket_path.unlink()
