"""Current TP12 boundary probes against the owned adapter and a native Agent process."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

import grpc
import pytest

from quantos.common.v1 import common_pb2
from quantos_engine_sdk import (
    EngineClient,
    json_document_from_mapping,
    json_document_to_mapping,
    uds_target,
)
from trading_agents.adapter import (
    AUTHORITY_FIELDS,
    FORBIDDEN_FIELDS,
    RequestBoundaryError,
    TradingAgentsRequestAdapter,
)
from trading_agents.manifest import PROPOSAL_CAPABILITY
from test_trading_agents_development import build_request

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("field", sorted(FORBIDDEN_FIELDS | AUTHORITY_FIELDS))
@pytest.mark.parametrize("spelling", ["canonical", "upper-hyphen"])
def test_all_forbidden_fields_and_authority_aliases_are_rejected(field, spelling):
    key = field if spelling == "canonical" else field.upper().replace("_", "-")
    request = build_request(
        13001,
        PROPOSAL_CAPABILITY,
        {"research_context": {"nested": [{key: "synthetic-advisory-claim"}]}},
    )
    with pytest.raises(RequestBoundaryError) as error:
        TradingAgentsRequestAdapter().translate(request)
    assert error.value.code == grpc.StatusCode.PERMISSION_DENIED


@pytest.mark.parametrize(
    "tool", ["venue_submit", "shell", "query_snapshot;venue_submit", "query_snapshot "]
)
def test_tool_names_cannot_extend_the_read_only_allowlist(tool):
    request = build_request(13002, PROPOSAL_CAPABILITY, {"tools": [tool]})
    with pytest.raises(RequestBoundaryError):
        TradingAgentsRequestAdapter().translate(request)


def test_native_agent_process_proposals_replay_and_rejections():
    # Explicit local fixture service, no credential/config inheritance and no upstream SDK.
    env = {k: v for k, v in os.environ.items() if k in {"PATH", "LANG", "LC_ALL", "TMPDIR"}}
    env["PYTHONPATH"] = os.pathsep.join(
        str(ROOT / p)
        for p in (
            "engines/engine-sdk/sdk_src",
            "engines/engine-sdk/src",
            "engines/trading-agents/src",
        )
    )
    with tempfile.TemporaryDirectory(prefix="tp12-", dir="/tmp") as directory:
        socket = Path(directory) / "agent.sock"
        process = subprocess.Popen(
            [sys.executable, "-m", "trading_agents.server", "--socket", str(socket)],
            cwd=ROOT / "engines",
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        client = None
        try:
            for _ in range(100):
                if socket.exists():
                    break
                if process.poll() is not None:
                    _, diagnostic = process.communicate(timeout=5)
                    pytest.fail("owned Agent exited before ready: " + diagnostic.decode())
                time.sleep(0.05)
            assert socket.exists()
            client = EngineClient(uds_target(socket))
            request = build_request(13003, PROPOSAL_CAPABILITY, {"tools": ["query_signal"]})
            first = client.execute(request, timeout=3)
            replay = client.execute(request, timeout=3)
            assert first.output == replay.output and first.artifact_refs == replay.artifact_refs
            proposal = json_document_to_mapping(first.output)
            assert proposal["executable"] is False
            assert len(first.artifact_refs) == 2
            assert all(ref.sha256.startswith("sha256:") for ref in first.artifact_refs)
            # These are Agent-side fixture artifacts, not authoritative risk/order/Fill receipts.
            for mode in (common_pb2.RUNTIME_MODE_PAPER, common_pb2.RUNTIME_MODE_SHADOW):
                refused = build_request(13004 + mode, PROPOSAL_CAPABILITY, {})
                refused.metadata.mode = mode
                with pytest.raises(grpc.RpcError) as error:
                    client.execute(refused, timeout=3)
                assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
            for attack in (
                {"trade_command": {"signed": True}},
                {"risk_decision": "allow", "approval_signature": "agent-claimed"},
                {"trace": {"venue": "synthetic"}},
            ):
                refused = build_request(13020, PROPOSAL_CAPABILITY, {"research_context": attack})
                with pytest.raises(grpc.RpcError) as error:
                    client.execute(refused, timeout=3)
                assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
            revoked = build_request(13021, PROPOSAL_CAPABILITY, {})
            revoked.metadata.actor.ClearField("capabilities")
            with pytest.raises(grpc.RpcError) as error:
                client.execute(revoked, timeout=3)
            assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
            # Rejections must not corrupt the original scoped idempotent execution.
            after = client.execute(request, timeout=3)
            assert after.output == first.output and after.artifact_refs == first.artifact_refs
            payload = json_document_to_mapping(request.input)
            payload["research_context"] = {"summary": "changed"}
            request.input.CopyFrom(json_document_from_mapping(payload))
            with pytest.raises(grpc.RpcError):
                client.execute(request, timeout=3)
            print(
                "TP12_NATIVE_AGENT=PASS EXECUTABLE=false REPLAY=STABLE AUTHORITY_SMUGGLING=REFUSED"
            )
            print(
                "TP12_FIXTURE_ARTIFACT_HASH="
                + hashlib.sha256(json.dumps(proposal, sort_keys=True).encode()).hexdigest()
            )
        finally:
            if client:
                client.close()
            process.terminate()
            try:
                process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate(timeout=5)
