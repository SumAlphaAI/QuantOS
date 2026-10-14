"""TP01-F real UDS dispatch, signature rejection and commit/action races."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import grpc
import pytest

from quantos.engine.v1 import engine_pb2
from quantos.common.v1 import common_pb2
from quantos_engine_sdk import EngineClient, json_document_to_mapping, uds_target
from quantos_engine_sdk.grpc import serve_engine
from test_vibe_adapter_contract import build_request
from vibe_adapter.rollout import RolloutController, RolloutError, canonical, release_descriptor
from vibe_adapter.artifact_api import VibeArtifactApi
from vibe_adapter.service import VibeAdapterService

ROOT = Path(__file__).resolve().parents[2]
POLICY = json.loads((ROOT / "third_party/vibe-trading/canary-policy.json").read_text())
KEY = b"tp01-f-public-local-fixture-authority"
CATALOG = (ROOT / "engines/vibe-adapter/src/vibe_adapter/fixtures/catalog.json").read_bytes()


def bundle(name: str, artifact: bytes = CATALOG, key: bytes = KEY) -> tuple[bytes, dict, str]:
    descriptor = release_descriptor(name, artifact, POLICY)
    signature = hmac.new(key, canonical(descriptor), hashlib.sha256).hexdigest()
    return artifact, descriptor, signature


def activated() -> RolloutController:
    controller = RolloutController(POLICY, KEY)
    changed = json.loads(CATALOG)
    changed["fixtures"][0]["summary"] += " candidate-v2"
    controller.activate_canary(
        candidate=bundle("candidate-v2", canonical(changed)), previous=bundle("previous-v1")
    )
    return controller


def selected_request(start: int = 1, payload: dict | None = None):
    for index in range(start, start + 10000):
        request = build_request(index, payload or {})
        identity = json.dumps(
            [
                request.metadata.tenant_id,
                request.metadata.workspace_id,
                request.metadata.actor.actor_id,
                f"run-{index}:idem-{index}",
                request.metadata.request_id,
            ]
        )
        if int(hashlib.sha256(identity.encode()).hexdigest()[:8], 16) % 10000 < 500:
            return request
    raise AssertionError("no canary fixture found")


@pytest.fixture
def local():
    controller = activated()
    service = VibeAdapterService(rollout=controller)
    path = Path("/tmp") / f"tp01-f-{uuid4().hex}.sock"
    server = serve_engine(path, service)
    client = EngineClient(uds_target(path))
    try:
        yield controller, service, client
    finally:
        client.close()
        server.stop(grace=0).wait(timeout=5)
        path.unlink(missing_ok=True)


def test_default_service_rejects_dispatch_and_still_answers_health():
    path = Path("/tmp") / f"tp01-f-default-{uuid4().hex}.sock"
    server = serve_engine(path, VibeAdapterService())
    client = EngineClient(uds_target(path))
    try:
        request = build_request(1, {})
        assert client.health(engine_pb2.HealthRequest(metadata=request.metadata), timeout=2).ready
        with pytest.raises(grpc.RpcError) as error:
            client.execute(request, timeout=2)
        assert error.value.details() == "ENGINE_ROLLOUT_DISABLED"
    finally:
        client.close()
        server.stop(grace=0).wait(timeout=5)
        path.unlink(missing_ok=True)


@pytest.mark.parametrize(
    "mutation",
    [
        "bytes",
        "signature",
        "authority",
        "descriptor",
        "policy",
        "scope",
        "schema",
        "invalid-contract",
        "duplicate-contract",
        "previous",
    ],
)
def test_activation_rejects_invalid_signature_or_artifact_without_state_change(mutation):
    controller = activated()
    before = controller.snapshot()
    artifact, descriptor, signature = bundle("new-v3")
    previous = bundle("previous-v1")
    if mutation == "bytes":
        artifact += b" "
    elif mutation == "signature":
        signature = "0" * 64
    elif mutation == "authority":
        artifact, descriptor, signature = bundle("new-v3", key=b"different-local-fixture-authority")
    elif mutation in {"descriptor", "policy", "scope", "schema"}:
        descriptor[
            {
                "descriptor": "releaseId",
                "policy": "policySha256",
                "scope": "scope",
                "schema": "schema",
            }[mutation]
        ] = "tampered"
    elif mutation == "previous":
        previous = (previous[0], previous[1], "0" * 64)
    else:
        catalog = json.loads(CATALOG)
        if mutation == "invalid-contract":
            catalog["fixtures"][0]["protocol_version"] = "invalid"
        else:
            catalog["fixtures"].append(catalog["fixtures"][0])
        artifact, descriptor, signature = bundle("new-v3", canonical(catalog))
    with pytest.raises(RolloutError, match="SIGNATURE_INVALID"):
        controller.activate_canary(candidate=(artifact, descriptor, signature), previous=previous)
    after = controller.snapshot()
    for key in ("state", "epoch", "activeRelease", "activeArtifactSha256"):
        assert after[key] == before[key]
    assert after["events"][-1]["action"] == "activation_rejected"


def test_signed_candidate_is_used_by_actual_uds_execution(local):
    controller, service, client = local
    result = client.execute(selected_request(), timeout=3)
    output = json_document_to_mapping(result.output)
    assert output["rollout"]["release_id"] == "candidate-v2"
    assert output["rollout"]["artifact_sha256"] == controller.snapshot()["activeArtifactSha256"]
    assert result.artifact_refs and service.artifact_api._objects


def test_canary_selection_is_stable_and_excludes_unselected_routes(local):
    controller, service, client = local
    controller.admit("stable-selected", shadow=True)
    rejected = [
        identity
        for identity in (f"identity-{i}" for i in range(100))
        if int(hashlib.sha256(identity.encode()).hexdigest()[:8], 16) % 10000 >= 500
    ]
    assert rejected
    for _ in range(2):
        with pytest.raises(RolloutError, match="NOT_SELECTED"):
            controller.admit(rejected[0])
    for i in range(1, 100):
        request = build_request(i, {})
        try:
            client.execute(request, timeout=2)
        except grpc.RpcError as error:
            assert error.code() == grpc.StatusCode.UNAVAILABLE
            assert error.details() == "ENGINE_ROLLOUT_NOT_SELECTED"
            break
    else:
        pytest.fail("all requests selected")
    assert not service.artifact_api._objects


@pytest.mark.parametrize("action", ["disable", "rollback", "critical-alert"])
@pytest.mark.parametrize("stream", [False, True])
def test_live_action_revokes_inflight_and_prevents_late_artifact(local, action, stream):
    controller, service, client = local
    request = selected_request(payload={"sleep_ms": 3000})
    with ThreadPoolExecutor(max_workers=1) as pool:
        if stream:
            future = pool.submit(
                client.stream_execute, engine_pb2.StreamExecuteRequest(request=request), timeout=5
            )
        else:
            future = pool.submit(client.execute, request, timeout=5)
        until = time.monotonic() + 2
        while not service._owners and time.monotonic() < until:
            time.sleep(0.005)
        assert service._owners
        if action == "critical-alert":
            metrics = healthy_metrics()
            metrics["unexplainedP1"] = 1
            controller.observe(metrics)
        else:
            getattr(controller, action)("host local drill")
        with pytest.raises(grpc.RpcError) as error:
            future.result(timeout=2)
        assert error.value.code() == grpc.StatusCode.CANCELLED
        assert error.value.details() == "ENGINE_ROLLOUT_REVOKED"
        assert not service.artifact_api._objects
    if action == "rollback":
        output = json_document_to_mapping(
            client.execute(build_request(99999, {}), timeout=3).output
        )
        assert output["rollout"]["release_id"] == "previous-v1"
    else:
        with pytest.raises(grpc.RpcError) as error:
            client.execute(build_request(99999, {}), timeout=2)
        assert error.value.details() == "ENGINE_ROLLOUT_DISABLED"


def test_disable_at_commit_boundary_rejects_write(local, monkeypatch):
    controller, service, client = local
    original = service._record_artifact

    def disable_then_commit(*args):
        controller.disable("before artifact commit")
        return original(*args)

    monkeypatch.setattr(service, "_record_artifact", disable_then_commit)
    with pytest.raises(grpc.RpcError) as error:
        client.execute(selected_request(), timeout=3)
    assert error.value.code() == grpc.StatusCode.CANCELLED
    assert not service.artifact_api._objects


def test_committed_work_has_deterministic_result_after_disable(local):
    controller, _, client = local
    result = client.execute(selected_request(), timeout=3)
    controller.disable("after successful commit")
    assert result.artifact_refs
    assert controller.snapshot()["events"][-2]["action"] == "artifact_committed"


def test_old_lease_stays_revoked_after_reactivation():
    controller = activated()
    old = controller.admit("request", shadow=True)
    controller.disable("hold")
    controller.activate_canary(candidate=bundle("new-v3"), previous=bundle("previous-v1"))
    with pytest.raises(RolloutError, match="REVOKED"):
        controller.commit(old, lambda: pytest.fail("late write"))


def test_rollback_restores_immutable_bytes_and_is_repeatable(local):
    controller, _, client = local
    controller.rollback("one click rollback")
    first = controller.snapshot()
    controller.rollback("repeat rollback")
    assert controller.snapshot()["activeArtifactSha256"] == hashlib.sha256(CATALOG).hexdigest()
    result = client.execute(build_request(98765, {}), timeout=2)
    assert (
        json_document_to_mapping(result.output)["rollout"]["release_id"]
        == first["activeRelease"]
        == "previous-v1"
    )


def test_shadow_tasks_write_into_separate_facade_and_compare_outputs(local):
    controller, primary, _ = local
    service = VibeAdapterService(rollout=controller, shadow_mode=True)
    path = Path("/tmp") / f"tp01-f-shadow-{uuid4().hex}.sock"
    server = serve_engine(path, service)
    client = EngineClient(uds_target(path))
    try:
        result = client.execute(build_request(5, {}), timeout=2)
        assert "quantos-shadow-artifacts" in result.artifact_refs[0].uri
        assert not primary.artifact_api._objects
        assert isinstance(service.artifact_api, VibeArtifactApi)
        assert service.artifact_api._objects
        controller.observe_shadow({"answer": 1}, {"answer": 1})
        controller.observe_shadow({"answer": 1}, {"answer": 2})
        assert controller.snapshot()["shadowCompleted"] == 1
        assert controller.snapshot()["shadowMismatches"] == 1
    finally:
        client.close()
        server.stop(grace=0).wait(timeout=5)
        path.unlink(missing_ok=True)


def healthy_metrics() -> dict[str, float]:
    return dict(
        unexplainedP1=0,
        executeP95Ms=400,
        cancelConfirmSecs=1,
        errorRate=0,
        shadowMismatchRate=0,
        unauthorizedEgress=0,
        secretOrVenueViolations=0,
    )


@pytest.mark.parametrize("metric", list(healthy_metrics()))
def test_threshold_boundaries_and_severity(metric):
    controller = activated()
    metrics = healthy_metrics()
    policy_key = {
        "unexplainedP1": "maxUnexplainedP1",
        "executeP95Ms": "maxExecuteP95Ms",
        "cancelConfirmSecs": "maxCancelConfirmSecs",
        "errorRate": "maxErrorRate",
        "shadowMismatchRate": "maxShadowMismatchRate",
        "unauthorizedEgress": "maxUnauthorizedEgress",
        "secretOrVenueViolations": "maxSecretOrVenueViolations",
    }[metric]
    metrics[metric] = POLICY["rolloutPolicy"][policy_key]
    assert controller.observe(metrics) == []
    metrics[metric] += 0.001
    alerts = controller.observe(metrics)
    assert alerts[0]["metric"] == metric
    assert controller.snapshot()["state"] == (
        "canary" if metric == "shadowMismatchRate" else "disabled"
    )


@pytest.mark.parametrize("invalid", [float("nan"), float("inf"), -1, True, "0", None])
def test_invalid_metrics_cannot_grant_enablement(invalid):
    controller = activated()
    metrics = healthy_metrics()
    metrics["unexplainedP1"] = invalid
    with pytest.raises(RolloutError, match="METRICS_INVALID"):
        controller.observe(metrics)
    assert controller.snapshot()["state"] == "canary"


def test_audit_snapshot_is_detached_and_never_claims_target_acceptance():
    controller = activated()
    data = controller.snapshot()
    data["events"].clear()
    assert len(controller.snapshot()["events"]) == 2
    assert not data["formalAccepted"] and not data["targetCanaryAccepted"]


def test_missing_previous_and_invalid_authority_cannot_rollback():
    with pytest.raises(RolloutError, match="AUTHORITY_INVALID"):
        RolloutController(POLICY, b"short")
    controller = RolloutController(POLICY, KEY)
    with pytest.raises(RolloutError, match="PREVIOUS_MISSING"):
        controller.rollback("no baseline")
    assert controller.snapshot()["state"] == "disabled"


@pytest.mark.parametrize(
    "environment",
    [
        common_pb2.ENVIRONMENT_LOCAL,
        common_pb2.ENVIRONMENT_STAGING,
        common_pb2.ENVIRONMENT_PRODUCTION,
    ],
)
def test_local_controller_cannot_dispatch_into_other_environments(local, environment):
    _, service, client = local
    request = selected_request()
    request.metadata.environment = environment
    with pytest.raises(grpc.RpcError) as error:
        client.execute(request, timeout=2)
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    assert error.value.details() == "ENGINE_LOCAL_TEST_ONLY"
    assert not service.artifact_api._objects


@pytest.mark.parametrize("field", ["shadow", "release_id", "disable"])
def test_request_payload_cannot_control_host_rollout(local, field):
    _, service, client = local
    with pytest.raises(grpc.RpcError) as error:
        client.execute(selected_request(payload={field: True}), timeout=2)
    assert error.value.code() == grpc.StatusCode.PERMISSION_DENIED
    assert not service.artifact_api._objects


def test_committed_stream_finishes_after_host_disable(local, monkeypatch):
    controller, service, client = local
    original = service._check_active

    def disable_after_commit(request, context, lease=None):
        if lease and lease.committed and controller.snapshot()["state"] == "canary":
            controller.disable("committed stream wins")
        original(request, context, lease)

    monkeypatch.setattr(service, "_check_active", disable_after_commit)
    events = client.stream_execute(
        engine_pb2.StreamExecuteRequest(request=selected_request()), timeout=3
    )
    assert len(events) == 3 and events[-1].done and events[-1].artifact_refs
    assert controller.snapshot()["state"] == "disabled"


def test_same_idempotency_key_cannot_silently_change_signed_release(local):
    controller, _, client = local
    request = selected_request()
    client.execute(request, timeout=3)
    controller.rollback("known good")
    with pytest.raises(grpc.RpcError) as error:
        client.execute(request, timeout=2)
    assert error.value.code() == grpc.StatusCode.ALREADY_EXISTS
