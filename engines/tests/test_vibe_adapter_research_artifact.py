"""CORE:TP01 data-only envelope consumed by the R03 worker."""

from __future__ import annotations

import pytest

from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import input_hash, json_document_to_mapping
from test_vibe_adapter_contract import build_request
from vibe_adapter.fixtures import fixture_names

pytest_plugins = ["test_vibe_adapter_skeleton"]


@pytest.mark.parametrize("fixture_name", fixture_names())
def test_r03_projection_binds_context_without_tool_or_memory_authority(adapter, fixture_name):
    service, client = adapter
    request = build_request(
        1701, {"fixture": fixture_name, "prompt": "验证研究工作流", "tools": []}
    )
    response = client.execute(request, timeout=5)
    output = json_document_to_mapping(response.output)
    assert output["artifact_type"] == "ResearchArtifact"
    assert output["artifact_kind"] == "workflow_reference"
    assert output["capability"] == request.capability
    assert output["workflow_run_id"] == request.workflow_run_id
    assert output["data_snapshot_ref"] == request.data_snapshot_ref
    assert output["policy_context_ref"] == request.policy_context_ref
    assert output["fixture"] == fixture_name
    assert output["trade_executable"] is False
    assert output["tool_allowlist"] == []
    assert output["environment"]["tools_executed"] is False
    assert output["environment"]["snapshot_bytes_resolved"] is False
    assert output["summary"] and output["hypothesis"]
    assert response.artifact_refs[0].sha256 == input_hash(response.output)
    stored = service.artifact_api.read_json_artifact(
        tenant_id=request.metadata.tenant_id, artifact_id=response.artifact_refs[0].artifact_id
    )
    assert stored == output
    stream = client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=5)
    assert [event.sequence_id for event in stream] == ["seq-1", "seq-2", "seq-3"]
    assert stream[-1].done
    assert stream[-1].artifact_refs[0].sha256 == response.artifact_refs[0].sha256
    assert not {"memory_path", "session_id", "auth_ticket", "venue", "secret_ref"} & output.keys()
