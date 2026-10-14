"""Run a local UDS canary drill with an explicit public fixture authority."""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import time
from concurrent.futures import ThreadPoolExecutor
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
from vibe_adapter.rollout import RolloutController, RolloutError, canonical, release_descriptor
from vibe_adapter.service import VibeAdapterService

# Public test-only material. Never accepted as an external/production authority.
KEY = b"tp01-f-public-local-fixture-authority"


def request(index: int, *, sleep_ms: int = 0) -> engine_pb2.ExecuteRequest:
    now = datetime.now(timezone.utc)
    metadata = common_pb2.CommandMetadata(
        request_id=f"req-{index}",
        tenant_id="tenant-local",
        workspace_id="workspace-local",
        actor=common_pb2.ActorRef(
            actor_id=f"actor-{index}",
            actor_kind=common_pb2.ACTOR_KIND_USER,
            capabilities=["research.execute"],
        ),
        correlation_id=f"corr-{index}",
        causation_id=f"cause-{index}",
        mode=common_pb2.RUNTIME_MODE_RESEARCH,
        environment=common_pb2.ENVIRONMENT_TEST,
        issued_at=timestamp_from_datetime(now),
    )
    return engine_pb2.ExecuteRequest(
        metadata=metadata,
        workflow_run_id=f"run-{index}",
        idempotency_key=f"idem-{index}",
        capability="research.vibe_adapter.execute",
        input_schema_version="v1",
        data_snapshot_ref="snapshot-local",
        policy_context_ref="policy-local",
        input=json_document_from_mapping({"sleep_ms": sleep_ms}),
        deadline=timestamp_from_datetime(now + timedelta(seconds=5)),
    )


def identity(req) -> str:
    return json.dumps(
        [
            req.metadata.tenant_id,
            req.metadata.workspace_id,
            req.metadata.actor.actor_id,
            f"{req.workflow_run_id}:{req.idempotency_key}",
            req.metadata.request_id,
        ]
    )


def run(output: Path, policy_path: Path, catalog_path: Path) -> dict:
    output.mkdir(parents=True, exist_ok=False)
    policy = json.loads(policy_path.read_bytes())
    previous_bytes = catalog_path.read_bytes()
    catalog = json.loads(previous_bytes)
    catalog["fixtures"][0]["summary"] += " local candidate-v2"
    candidate_bytes = canonical(catalog)

    def bundle(name, artifact):
        descriptor = release_descriptor(name, artifact, policy)
        signature = hmac.new(KEY, canonical(descriptor), hashlib.sha256).hexdigest()
        return artifact, descriptor, signature

    candidate = bundle("candidate-v2", candidate_bytes)
    previous = bundle("previous-v1", previous_bytes)
    for name, value in (("candidate", candidate), ("previous", previous)):
        (output / (name + ".artifact.json")).write_bytes(value[0])
        (output / (name + ".signed-descriptor.json")).write_bytes(
            canonical({"descriptor": value[1], "signature": value[2]})
        )
    controller = RolloutController(policy, KEY)
    service = VibeAdapterService(rollout=controller)
    shadow_service = VibeAdapterService(rollout=controller, shadow_mode=True)
    sockets = [Path("/tmp") / f"tp01-f-drill-{uuid4().hex}.sock" for _ in range(2)]
    servers, clients = [], []
    probes = []

    def check(name, observed, expected):
        probes.append(
            {"id": name, "observed": observed, "expected": expected, "passed": observed == expected}
        )
        assert observed == expected, name

    def rejected(call):
        try:
            call()
        except (RolloutError, grpc.RpcError) as error:
            return str(error) if isinstance(error, RolloutError) else error.details()
        return "UNEXPECTED_SUCCESS"

    def activate():
        controller.activate_canary(candidate=candidate, previous=previous)

    def selected(start, sleep_ms=0):
        for i in range(start, start + 10000):
            req = request(i, sleep_ms=sleep_ms)
            if int(hashlib.sha256(identity(req).encode()).hexdigest()[:8], 16) % 10000 < 500:
                return req
        raise AssertionError("selected request missing")

    try:
        for socket, adapter in zip(sockets, (service, shadow_service), strict=True):
            server = serve_engine(socket, adapter)
            servers.append(server)
            clients.append(EngineClient(uds_target(socket)))
        client, shadow = clients
        check(
            "default-disabled",
            rejected(lambda: client.execute(request(1), timeout=2)),
            "ENGINE_ROLLOUT_DISABLED",
        )
        for name, bad in (
            ("signature-rejected", (candidate[0], candidate[1], "0" * 64)),
            ("artifact-tamper-rejected", (candidate[0] + b" ", candidate[1], candidate[2])),
        ):
            check(
                name,
                rejected(lambda: controller.activate_canary(candidate=bad, previous=previous)),
                "ENGINE_ROLLOUT_SIGNATURE_INVALID",
            )
        check(
            "previous-signature-rejected",
            rejected(
                lambda: controller.activate_canary(
                    candidate=candidate, previous=(previous[0], previous[1], "0" * 64)
                )
            ),
            "ENGINE_ROLLOUT_SIGNATURE_INVALID",
        )
        activate()
        req = selected(10)
        first = client.execute(req, timeout=3)
        first_output = json_document_to_mapping(first.output)
        check("signed-candidate-dispatch", first_output["rollout"]["release_id"], "candidate-v2")
        check(
            "replay-artifact-stable",
            client.execute(req, timeout=3).artifact_refs == first.artifact_refs,
            True,
        )
        excluded = next(
            request(i)
            for i in range(20000, 30000)
            if int(hashlib.sha256(identity(request(i)).encode()).hexdigest()[:8], 16) % 10000 >= 500
        )
        check(
            "canary-excluded",
            rejected(lambda: client.execute(excluded, timeout=2)),
            "ENGINE_ROLLOUT_NOT_SELECTED",
        )
        shadow_output = json_document_to_mapping(shadow.execute(req, timeout=3).output)
        check(
            "shadow-isolated",
            shadow_service.artifact_api is not service.artifact_api
            and shadow_service.artifact_api.bucket_name == "quantos-shadow-artifacts",
            True,
        )
        controller.observe_shadow(
            {k: v for k, v in first_output.items() if k != "rollout"},
            {k: v for k, v in shadow_output.items() if k != "rollout"},
        )
        controller.observe_shadow({"result": 1}, {"result": 2})
        check(
            "shadow-comparison",
            [controller.snapshot()["shadowCompleted"], controller.snapshot()["shadowMismatches"]],
            [1, 1],
        )

        for n, (action, stream) in enumerate(
            (a, s) for a in ("disable", "rollback") for s in (False, True)
        ):
            activate()
            req = selected(40000 + n * 10000, sleep_ms=3000)
            count = len(service.artifact_api._objects)
            with ThreadPoolExecutor(max_workers=1) as pool:
                call = (
                    (
                        lambda: client.stream_execute(
                            engine_pb2.StreamExecuteRequest(request=req), timeout=5
                        )
                    )
                    if stream
                    else (lambda: client.execute(req, timeout=5))
                )
                future = pool.submit(call)
                owner = service._owner(req.metadata, service._execution_id(req))
                until = time.monotonic() + 2
                while owner not in service._owners and time.monotonic() < until:
                    time.sleep(0.005)
                assert owner in service._owners, "inflight admission missing"
                getattr(controller, action)("local in-flight drill")
                check(
                    action + ("-stream" if stream else "-unary"),
                    rejected(lambda: future.result(timeout=2)),
                    "ENGINE_ROLLOUT_REVOKED",
                )
                assert len(service.artifact_api._objects) == count, "late artifact write"
        output_prev = json_document_to_mapping(client.execute(request(90000), timeout=3).output)
        check("rollback-restored-provider", output_prev["rollout"]["release_id"], "previous-v1")
        check(
            "rollback-restored-digest",
            controller.snapshot()["activeArtifactSha256"],
            hashlib.sha256(previous_bytes).hexdigest(),
        )
        activate()
        healthy = dict(
            unexplainedP1=0,
            executeP95Ms=400,
            cancelConfirmSecs=1,
            errorRate=0,
            shadowMismatchRate=0,
            unauthorizedEgress=0,
            secretOrVenueViolations=0,
        )
        check("healthy-thresholds", controller.observe(healthy), [])
        healthy["unexplainedP1"] = 1
        alerts = controller.observe(healthy)
        check(
            "critical-alert-disabled",
            [alerts[0]["severity"], controller.snapshot()["state"]],
            ["critical", "disabled"],
        )
        check(
            "disabled-new-request",
            rejected(lambda: client.execute(request(90001), timeout=2)),
            "ENGINE_ROLLOUT_DISABLED",
        )
        snapshot = controller.snapshot()
        check(
            "audit-sequence",
            [event["sequence"] for event in snapshot["events"]]
            == list(range(1, len(snapshot["events"]) + 1)),
            True,
        )
        (output / "runtime-events.json").write_bytes(canonical(snapshot))
        result = {
            "schema": "quantos-tp01-f-local-drill/v1",
            "status": "PASS",
            "probes": probes,
            "evidenceMode": "LOCAL_UDS_SIGNED_SYNTHETIC_RESEARCH",
            "formalAccepted": False,
            "targetCanaryAccepted": False,
            "targetRollbackAccepted": False,
            "databaseExecution": False,
            "externalExecution": False,
            "performanceAccepted": False,
            "signingAuthority": "PUBLIC_LOCAL_FIXTURE_ONLY",
        }
        (output / "drill.json").write_bytes(canonical(result))
        return result
    finally:
        for client in clients:
            client.close()
        for server in servers:
            server.stop(grace=0).wait(timeout=5)
        for socket in sockets:
            socket.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--policy", required=True, type=Path)
    parser.add_argument("--catalog", required=True, type=Path)
    args = parser.parse_args()
    result = run(args.output_dir, args.policy, args.catalog)
    print(f"TP01-F_LOCAL_DRILL PASS probes={len(result['probes'])}")


if __name__ == "__main__":
    main()
