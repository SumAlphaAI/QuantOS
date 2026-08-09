"""Shared health, metrics, structured-error, and JSONL trace export for Engines."""

from __future__ import annotations

import json
import os
import threading
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Optional, Tuple


def _now() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class ExportedTraceRecord:
    service: str
    correlation_id: str
    operation: str
    status: str
    attributes: dict[str, Any]
    recorded_at: str


class JsonlTraceExporter:
    """Append-only exporter guarded against concurrent Engine RPC threads."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.touch(exist_ok=True)
        self._lock = threading.Lock()

    def export(self, record: ExportedTraceRecord) -> None:
        encoded = json.dumps(asdict(record), sort_keys=True, separators=(",", ":"))
        with self._lock, self.path.open("a", encoding="utf-8") as output:
            output.write(encoded)
            output.write("\n")
            output.flush()

    def query(self, service: str, correlation_id: str) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        with self._lock, self.path.open(encoding="utf-8") as source:
            for line in source:
                if not line.strip():
                    continue
                record = json.loads(line)
                if record.get("service") == service and record.get("correlation_id") == correlation_id:
                    records.append(record)
        return records

    def is_ready(self) -> bool:
        try:
            with self.path.open("a", encoding="utf-8"):
                return True
        except OSError:
            return False


class EngineObservability:
    """One observability contract for every Python Engine implementation."""

    def __init__(self, service: str, exporter: Optional[JsonlTraceExporter] = None) -> None:
        self.service = service
        self.exporter = exporter
        self._requests = 0
        self._errors = 0
        self._counter_lock = threading.Lock()

    @classmethod
    def from_env(cls, service: str) -> "EngineObservability":
        path = os.environ.get("QUANTOS_TRACE_EXPORT_PATH", "").strip()
        return cls(service, JsonlTraceExporter(path) if path else None)

    @staticmethod
    def correlation_id(request: Any) -> str:
        metadata = getattr(request, "metadata", None)
        if metadata is None:
            nested = getattr(request, "request", None)
            metadata = getattr(nested, "metadata", None)
        raw = str(getattr(metadata, "correlation_id", "") or "")
        try:
            return str(uuid.UUID(raw))
        except ValueError:
            return str(uuid.uuid4())

    def record(
        self,
        correlation_id: str,
        operation: str,
        status: str,
        attributes: Optional[dict[str, Any]] = None,
    ) -> None:
        with self._counter_lock:
            self._requests += 1
            if status == "failed":
                self._errors += 1
        if self.exporter is not None:
            self.exporter.export(
                ExportedTraceRecord(
                    service=self.service,
                    correlation_id=correlation_id,
                    operation=operation,
                    status=status,
                    attributes=attributes or {},
                    recorded_at=_now(),
                )
            )

    def start_http_from_env(self) -> Optional[ThreadingHTTPServer]:
        address = os.environ.get("QUANTOS_OBSERVABILITY_ADDR", "").strip()
        if not address:
            return None
        host, separator, raw_port = address.rpartition(":")
        if not separator or not host or not raw_port.isdigit():
            raise ValueError("QUANTOS_OBSERVABILITY_ADDR must use host:port")
        return self.start_http((host, int(raw_port)))

    def start_http(self, address: Tuple[str, int]) -> ThreadingHTTPServer:
        observer = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                observer._handle_get(self)

            def log_message(self, _format: str, *args: object) -> None:
                del args

        server = ThreadingHTTPServer(address, Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        return server

    def _handle_get(self, handler: BaseHTTPRequestHandler) -> None:
        with self._counter_lock:
            self._requests += 1
        if handler.path == "/healthz":
            self._write_json(
                handler,
                200,
                {
                    "service": self.service,
                    "status": "ready",
                    "ready": True,
                    "checked_at": _now(),
                },
            )
            return
        if handler.path == "/readyz":
            ready = self.exporter is not None and self.exporter.is_ready()
            self._write_json(
                handler,
                200 if ready else 503,
                {
                    "service": self.service,
                    "status": "ready" if ready else "trace_exporter_unavailable",
                    "ready": ready,
                    "checked_at": _now(),
                },
            )
            return
        if handler.path == "/metrics":
            with self._counter_lock:
                requests, errors = self._requests, self._errors
            service = self.service.replace('"', "_").replace("\\", "_")
            ready = self.exporter is not None and self.exporter.is_ready()
            payload = (
                "# TYPE quantos_service_ready gauge\n"
                f'quantos_service_ready{{service="{service}"}} {int(ready)}\n'
                "# TYPE quantos_observability_requests_total counter\n"
                f'quantos_observability_requests_total{{service="{service}"}} {requests}\n'
                "# TYPE quantos_service_errors_total counter\n"
                f'quantos_service_errors_total{{service="{service}"}} {errors}\n'
            ).encode()
            self._write(handler, 200, "text/plain; version=0.0.4", payload)
            return
        if handler.path.startswith("/trace/"):
            self._handle_trace(handler, handler.path.removeprefix("/trace/"))
            return
        self._error(handler, 404, "OBSERVABILITY_ROUTE_NOT_FOUND", "observability route not found")

    def _handle_trace(self, handler: BaseHTTPRequestHandler, raw: str) -> None:
        try:
            correlation_id = str(uuid.UUID(raw))
        except ValueError:
            self._error(
                handler,
                400,
                "OBSERVABILITY_INVALID_CORRELATION_ID",
                "trace correlation id must be a UUID",
            )
            return
        if self.exporter is None:
            self._error(
                handler,
                503,
                "OBSERVABILITY_TRACE_EXPORTER_NOT_CONFIGURED",
                "set QUANTOS_TRACE_EXPORT_PATH to enable trace export and query",
                correlation_id,
            )
            return
        self._write_json(
            handler,
            200,
            {
                "service": self.service,
                "correlation_id": correlation_id,
                "records": self.exporter.query(self.service, correlation_id),
            },
        )

    def _error(
        self,
        handler: BaseHTTPRequestHandler,
        status: int,
        code: str,
        message: str,
        correlation_id: Optional[str] = None,
    ) -> None:
        with self._counter_lock:
            self._errors += 1
        self._write_json(
            handler,
            status,
            {
                "code": code,
                "message": message,
                "service": self.service,
                "correlation_id": correlation_id or str(uuid.uuid4()),
                "occurred_at": _now(),
                "retryable": status >= 500,
            },
        )

    def _write_json(self, handler: BaseHTTPRequestHandler, status: int, payload: object) -> None:
        self._write(
            handler,
            status,
            "application/json",
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode(),
        )

    @staticmethod
    def _write(
        handler: BaseHTTPRequestHandler,
        status: int,
        content_type: str,
        payload: bytes,
    ) -> None:
        handler.send_response(status)
        handler.send_header("Content-Type", content_type)
        handler.send_header("Content-Length", str(len(payload)))
        handler.send_header("Cache-Control", "no-store")
        handler.end_headers()
        handler.wfile.write(payload)
