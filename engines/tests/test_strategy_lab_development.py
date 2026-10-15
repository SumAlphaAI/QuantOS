"""TP06 owned adversarial corpus and replaceable Artifact-only producer contract."""

from __future__ import annotations

import json
from dataclasses import replace
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from pathlib import Path
from uuid import uuid4

import grpc
import pytest

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import EngineClient, input_hash, json_document_from_mapping, uds_target
from quantos_engine_sdk.grpc import serve_engine
from strategy_lab.fixtures import load_fixture
from strategy_lab.service import StrategyLabService
from test_strategy_lab_contract import build_input, build_request

ATTACKS = json.loads((Path(__file__).parent / "fixtures/tp06-attacks.json").read_text())


@pytest.fixture
def lab():
    service = StrategyLabService()
    socket = Path("/tmp") / f"quantos-tp06-{uuid4().hex}.sock"
    server = serve_engine(socket, service)
    client = EngineClient(uds_target(socket))
    try:
        yield service, client
    finally:
        client.close()
        server.stop(grace=0).wait()
        socket.unlink(missing_ok=True)


@pytest.mark.parametrize("case", ATTACKS, ids=[case["id"] for case in ATTACKS])
def test_owned_attack_corpus_cannot_write_or_escape(lab, case):
    service, client = lab
    with pytest.raises(grpc.RpcError) as error:
        client.execute(
            build_request(1, build_input("trend_momentum_btc", prompt=case["prompt"])), timeout=5
        )
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    assert service._artifacts == {}


def test_replacement_artifacts_readback_hash_conflict_and_recovery(lab):
    service, client = lab

    class Replacement:
        def generate(self, prompt, fixture_name):
            assert isinstance(prompt, str)
            return replace(
                load_fixture(fixture_name), lookback=6, rule_source="momentum(close, lookback=6)"
            )

    service.generator = Replacement()
    request = build_request(7, build_input("trend_momentum_btc"))
    response = client.execute(request, timeout=5)
    for ref in response.artifact_refs:
        assert ref.uri.startswith("artifact://strategy-lab/")
        document = service.read_artifact("tenant-primary", "workspace-primary", ref.artifact_id)
        assert document.pop("artifact_hash") == ref.sha256
        assert input_hash(json_document_from_mapping(document)) == ref.sha256
        document["tamper"] = True
        assert "tamper" not in service.read_artifact(
            "tenant-primary", "workspace-primary", ref.artifact_id
        )
        with pytest.raises(KeyError):
            service.read_artifact("other-tenant", "workspace-primary", ref.artifact_id)
        with pytest.raises(KeyError):
            service.read_artifact("tenant-primary", "other-workspace", ref.artifact_id)
    assert len(service._artifacts) == 2
    replay = client.execute(request, timeout=5)
    assert replay.output == response.output
    assert replay.artifact_refs == response.artifact_refs
    assert len(service._artifacts) == 2
    before = dict(service._artifacts)
    request.input.CopyFrom(json_document_from_mapping(build_input("range_reversion_eth")))
    with pytest.raises(grpc.RpcError) as error:
        client.execute(request, timeout=5)
    assert error.value.code() == grpc.StatusCode.ALREADY_EXISTS
    assert service._artifacts == before
    client.execute(build_request(8, build_input("range_reversion_eth")), timeout=5)
    assert len(service._artifacts) == 4


@pytest.mark.parametrize(
    "mutation",
    ["capability", "mode", "workspace", "snapshot", "tools", "prompt", "delay", "unknown"],
)
def test_request_shapes_fail_closed_without_artifacts(lab, mutation):
    service, client = lab
    request = build_request(1, build_input("trend_momentum_btc"))
    payload = build_input("trend_momentum_btc")
    if mutation == "capability":
        del request.metadata.actor.capabilities[:]
    elif mutation == "mode":
        request.metadata.mode = common_pb2.RUNTIME_MODE_ASSISTED_LIVE
    elif mutation == "workspace":
        request.metadata.workspace_id = ""
    elif mutation == "snapshot":
        request.data_snapshot_ref = ""
    else:
        payload.update(
            {"tools": {"order": True}}
            if mutation == "tools"
            else {"prompt": ["secret"]}
            if mutation == "prompt"
            else {"sleep_ms": -1}
            if mutation == "delay"
            else {"extension": {"order": True}}
        )
        request.input.CopyFrom(json_document_from_mapping(payload))
    with pytest.raises(grpc.RpcError) as error:
        client.execute(request, timeout=5)
    assert error.value.code() in (
        grpc.StatusCode.PERMISSION_DENIED,
        grpc.StatusCode.INVALID_ARGUMENT,
    )
    assert service._artifacts == {}


def test_owner_cancel_blocks_stream_commit_and_other_actor_cannot_cancel(lab):
    service, client = lab
    request = build_request(20, build_input("trend_momentum_btc"))
    cancel = engine_pb2.CancelRequest(metadata=request.metadata, execution_id="run-20:idem-20")
    cancel.metadata.actor.actor_id = "foreign"
    client.cancel(cancel, timeout=5)
    client.execute(request, timeout=5)
    request = build_request(21, build_input("trend_momentum_btc"))
    cancel.metadata.CopyFrom(request.metadata)
    cancel.execution_id = "run-21:idem-21"
    client.cancel(cancel, timeout=5)
    with pytest.raises(grpc.RpcError) as error:
        client.stream_execute(engine_pb2.StreamExecuteRequest(request=request), timeout=5)
    assert error.value.code() == grpc.StatusCode.CANCELLED
    assert len(service._artifacts) == 2

    started = Event()

    class WaitingProvider:
        def generate(self, prompt, fixture_name):
            started.set()
            return load_fixture(fixture_name)

    service.generator = WaitingProvider()
    request = build_request(22, build_input("trend_momentum_btc", sleep_ms=5000))
    with ThreadPoolExecutor(max_workers=1) as executor:
        running = executor.submit(client.execute, request, timeout=6)
        assert started.wait(3)
        cancel.metadata.CopyFrom(request.metadata)
        cancel.execution_id = "run-22:idem-22"
        client.cancel(cancel, timeout=5)
        with pytest.raises(grpc.RpcError) as error:
            running.result(timeout=3)
        assert error.value.code() == grpc.StatusCode.CANCELLED
    assert len(service._artifacts) == 2


@pytest.mark.parametrize("index", range(100))
def test_replacement_static_failures_always_block(lab, index):
    service, client = lab

    class InvalidProvider:
        def generate(self, prompt, fixture_name):
            variants = [
                {"rule_source": f"momentum(close, lookback=24) + future_close({index})"},
                {"lookback": index + 501},
                {"entry_threshold_bps": index + 5001},
                {"max_position_notional": "NaN"},
                {"universe": ["https://invalid.example"]},
            ]
            return replace(load_fixture(fixture_name), **variants[index % len(variants)])

    service.generator = InvalidProvider()
    request = build_request(index, build_input("trend_momentum_btc"))
    response = client.execute(request, timeout=5)
    check = service.read_artifact(
        "tenant-primary", "workspace-primary", response.artifact_refs[1].artifact_id
    )
    assert check["passed"] is False and check["blocked_release"] is True
    draft = service.read_artifact(
        "tenant-primary", "workspace-primary", response.artifact_refs[0].artifact_id
    )
    assert draft["release_eligible"] is False
    assert draft["static_check"]["findings"]
