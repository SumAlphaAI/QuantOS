"""Actual local UDS Signal matrix and cancellation transcript for development UI checks."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import time
from uuid import uuid4

import grpc

from trading_agents.fixtures import fixed_input_cases
from trading_agents.service import TradingAgentsService
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import (
    EngineClient,
    json_document_to_mapping,
    serve_engine,
    uds_target,
)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engines/tests"))
from test_trading_agents_contract import build_request  # noqa: E402

out = ROOT / "artifacts/tp04-development"
out.mkdir(parents=True, exist_ok=True)
socket = Path("/tmp") / f"quantos-tp04-probe-{uuid4().hex}.sock"
service = TradingAgentsService()
server = serve_engine(socket, service)
client = EngineClient(uds_target(socket))
try:
    records = []
    for index, case in enumerate(fixed_input_cases(100)):
        request = build_request(
            2000 + index,
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
        assert (
            first.output == second.output
            and first.artifact_refs == second.artifact_refs
            and first.input_hash == second.input_hash
        )
        streams = [
            client.stream_execute(
                engine_pb2.StreamExecuteRequest(request=request), timeout=3
            )
            for _ in range(2)
        ]
        assert [m.delta for m in streams[0]] == [m.delta for m in streams[1]]
        assert streams[0][-1].artifact_refs == first.artifact_refs
        output = json_document_to_mapping(first.output)
        refs = []
        for ref in first.artifact_refs:
            raw = service.artifacts.read(
                request.metadata.tenant_id,
                request.metadata.workspace_id,
                request.metadata.actor.actor_id,
                ref.artifact_id,
            )
            assert ref.sha256 == "sha256:" + hashlib.sha256(raw).hexdigest()
            refs.append(
                {
                    "artifactId": ref.artifact_id,
                    "uri": ref.uri,
                    "sha256": ref.sha256,
                    "payload": json.loads(raw),
                }
            )
        records.append(
            {
                "caseId": case.case_id,
                "fixture": case.fixture_name,
                "inputHash": first.input_hash,
                "output": output,
                "artifacts": refs,
                "replays": {"execute": 2, "stream": 2},
            }
        )
    (out / "proposal-matrix.json").write_text(json.dumps(records, indent=2) + "\n")
    before = service.artifacts.count
    request = build_request(
        9999,
        {
            "fixture": case.fixture_name,
            "account_id": case.account_id,
            "policy_snapshot_id": case.policy_snapshot_id,
            "portfolio_snapshot_id": case.portfolio_snapshot_id,
            "signal": case.signal_payload,
            "stream_delay_ms": 1200,
        },
    )
    stream = client._stream_execute(
        engine_pb2.StreamExecuteRequest(request=request), timeout=3
    )
    first = next(stream)
    started = time.monotonic()
    cancel = client.cancel(
        engine_pb2.CancelRequest(
            metadata=request.metadata, execution_id=first.execution_id
        ),
        timeout=3,
    )
    assert cancel.cancelled
    try:
        next(stream)
    except grpc.RpcError as error:
        assert error.code() == grpc.StatusCode.CANCELLED
    else:
        raise AssertionError("stream cancellation was not observed")
    elapsed = (time.monotonic() - started) * 1000
    assert elapsed < 2000
    assert service.artifacts.count == before
    receipt = {
        "schema": "quantos-tp04-ui-cancel-transcript/v1",
        "status": "PASS",
        "formalAccepted": False,
        "transport": "actual local UDS with development UI response bridge",
        "runId": first.execution_id,
        "cancelStatus": "cancelled",
        "grpcStatus": "CANCELLED",
        "elapsedMs": elapsed,
        "artifactDelta": service.artifacts.count - before,
        "firstEvent": {
            "sequence": 1,
            "runId": first.execution_id,
            "done": first.done,
            "phase": "validated",
            "payload": json_document_to_mapping(first.delta),
        },
    }
    (out / "ui-cancel.json").write_text(json.dumps(receipt, indent=2) + "\n")
finally:
    client.close()
    server.stop(grace=0).wait(5)
    socket.unlink(missing_ok=True)
print(
    "TP04_PROPOSAL_PROBE_PASS 100 Execute twice / Stream twice and scoped Artifact readbacks; actual cancellation <2s, no new Artifact"
)
