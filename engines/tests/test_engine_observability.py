"""End-to-end SDK observability test: gRPC -> JSONL exporter -> HTTP query."""

from __future__ import annotations

import json
import urllib.request
import uuid
from pathlib import Path

from mock_engine.service import MockEngineService
from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import (
    EngineClient,
    EngineObservability,
    JsonlTraceExporter,
    serve_engine,
    timestamp_now,
    uds_target,
)


def test_engine_rpc_exports_queryable_trace_and_operational_metrics(tmp_path: Path) -> None:
    trace_path = tmp_path / "engine-traces.jsonl"
    observer = EngineObservability("mock-engine", JsonlTraceExporter(trace_path))
    http_server = observer.start_http(("127.0.0.1", 0))
    socket_path = Path("/tmp") / f"quantos-engine-observability-{uuid.uuid4()}.sock"
    grpc_server = serve_engine(socket_path, MockEngineService(), observability=observer)
    correlation_id = str(uuid.uuid4())
    client = EngineClient(uds_target(socket_path))

    try:
        response = client.health(
            engine_pb2.HealthRequest(
                metadata=common_pb2.CommandMetadata(
                    request_id="observability-health",
                    tenant_id=str(uuid.uuid4()),
                    workspace_id=str(uuid.uuid4()),
                    actor=common_pb2.ActorRef(
                        actor_id=str(uuid.uuid4()),
                        actor_kind=common_pb2.ACTOR_KIND_SERVICE,
                    ),
                    correlation_id=correlation_id,
                    causation_id=str(uuid.uuid4()),
                    mode=common_pb2.RUNTIME_MODE_PAPER,
                    environment=common_pb2.ENVIRONMENT_TEST,
                    issued_at=timestamp_now(),
                )
            ),
            timeout=2,
        )
        assert response.ready is True

        host = str(http_server.server_address[0])
        port = int(http_server.server_address[1])
        with urllib.request.urlopen(f"http://{host}:{port}/trace/{correlation_id}") as result:
            trace_query = json.load(result)
        assert [record["status"] for record in trace_query["records"]] == [
            "started",
            "succeeded",
        ]
        assert {record["operation"] for record in trace_query["records"]} == {"engine.health"}

        with urllib.request.urlopen(f"http://{host}:{port}/metrics") as result:
            metrics = result.read().decode()
        assert 'quantos_service_ready{service="mock-engine"} 1' in metrics
        with urllib.request.urlopen(f"http://{host}:{port}/readyz") as result:
            readiness = json.load(result)
        assert readiness["ready"] is True
        assert "DATABASE_URL" not in trace_path.read_text()
    finally:
        client.close()
        grpc_server.stop(grace=0)
        http_server.shutdown()
        http_server.server_close()
        socket_path.unlink(missing_ok=True)
