from __future__ import annotations

import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import cast

import grpc
import pytest

from mock_engine import server as mock_server
from mock_engine.service import MockEngineService
from quantos.engine.v1 import engine_pb2
from test_engine_contract import valid_execute_request


class Context:
    active = True

    def abort(self, code: grpc.StatusCode, details: str) -> None:
        raise RuntimeError(f"{code.name}:{details}")

    def is_active(self) -> bool:
        return self.active


def fake_context() -> grpc.ServicerContext:
    return cast(grpc.ServicerContext, Context())


def test_mock_server_cli_passes_crash_fixture_and_stops(tmp_path: Path, monkeypatch) -> None:
    socket = tmp_path / "engine.sock"
    crash_file = tmp_path / "crashes.txt"
    observed = {}

    class FakeServer:
        def wait_for_termination(self) -> None:
            observed["waited"] = True

        def stop(self, grace: int) -> None:
            observed["grace"] = grace

    def fake_serve(path: Path, service: MockEngineService):
        observed["socket"] = path
        observed["service"] = service
        return FakeServer()

    monkeypatch.setattr(mock_server, "serve_engine", fake_serve)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "mock-engine",
            "--socket",
            str(socket),
            "--crash-state-file",
            str(crash_file),
            "--failures-before-success",
            "2",
            "--default-sleep-ms",
            "10",
            "--exit-on-execute",
        ],
    )
    mock_server.main()
    service = observed["service"]
    assert observed["socket"] == socket
    assert observed["waited"] is True and observed["grace"] == 0
    assert service.crash_state_file == crash_file
    assert service.failures_before_success == 2
    assert service.default_sleep_ms == 10 and service.exit_on_execute is True


def test_mock_crash_counter_survives_restart(tmp_path: Path, monkeypatch) -> None:
    crash_file = tmp_path / "crashes.txt"
    crash_file.write_text("1", encoding="utf-8")

    def fake_exit(code: int) -> None:
        raise SystemExit(code)

    monkeypatch.setattr("mock_engine.service.os._exit", fake_exit)
    request = valid_execute_request(1)
    with pytest.raises(SystemExit, match="70"):
        MockEngineService(crash_state_file=crash_file).execute(request, fake_context())
    assert crash_file.read_text(encoding="utf-8") == "0"
    response = MockEngineService(crash_state_file=crash_file).execute(request, fake_context())
    assert response.execution_id == "run-1:idem-1"


def test_mock_failure_cancel_and_sleep_paths() -> None:
    request = valid_execute_request(2)
    service = MockEngineService(failures_before_success=1, default_sleep_ms=10)
    with pytest.raises(RuntimeError, match="UNAVAILABLE"):
        service.execute(request, fake_context())
    assert service.execute(request, fake_context()).execution_id == "run-2:idem-2"

    execution_id = "run-2:idem-2"
    service.cancel(
        engine_pb2.CancelRequest(metadata=request.metadata, execution_id=execution_id),
        fake_context(),
    )
    with pytest.raises(RuntimeError, match="CANCELLED"):
        service.execute(request, fake_context())
    with pytest.raises(RuntimeError, match="CANCELLED"):
        list(service.stream_execute(engine_pb2.StreamExecuteRequest(request=request), fake_context()))

    inactive = Context()
    inactive.active = False
    with pytest.raises(RuntimeError, match="CANCELLED"):
        MockEngineService(default_sleep_ms=10).execute(
            request, cast(grpc.ServicerContext, inactive)
        )


def test_running_mock_execution_cancels_within_two_seconds() -> None:
    request = valid_execute_request(3)
    service = MockEngineService(default_sleep_ms=3_000)
    with ThreadPoolExecutor(max_workers=2) as pool:
        started = time.monotonic()
        running = pool.submit(service.execute, request, fake_context())
        time.sleep(0.05)
        service.cancel(
            engine_pb2.CancelRequest(
                metadata=request.metadata,
                execution_id="run-3:idem-3",
            ),
            fake_context(),
        )
        with pytest.raises(RuntimeError, match="CANCELLED"):
            running.result(timeout=2)
        assert time.monotonic() - started < 2
