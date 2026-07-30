"""Generic gRPC helpers for QuantOS engine services."""

from __future__ import annotations

import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Protocol

import grpc
from google.protobuf import json_format
from google.protobuf import struct_pb2
from google.protobuf.timestamp_pb2 import Timestamp

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk.manifest import EngineManifest


def workspace_name() -> str:
    return "sumalpha-quantos"


def generated_package() -> str:
    return "quantos"


def uds_target(socket_path: str | Path) -> str:
    return f"unix:{Path(socket_path)}"


def timestamp_now() -> Timestamp:
    timestamp = Timestamp()
    timestamp.FromDatetime(datetime.now(tz=timezone.utc))
    return timestamp


def timestamp_from_datetime(value: datetime) -> Timestamp:
    timestamp = Timestamp()
    timestamp.FromDatetime(value.astimezone(timezone.utc))
    return timestamp


def json_document_from_mapping(payload: dict) -> common_pb2.JsonDocument:
    document = common_pb2.JsonDocument()
    struct_value = struct_pb2.Struct()
    struct_value.update(payload)
    document.value.CopyFrom(struct_value)
    return document


def json_document_to_mapping(document: common_pb2.JsonDocument | None) -> dict:
    if document is None or not document.HasField("value"):
        return {}
    return json_format.MessageToDict(document.value)


def input_hash(document: common_pb2.JsonDocument | None) -> str:
    encoded = json.dumps(
        json_document_to_mapping(document),
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"


class EngineServiceProtocol(Protocol):
    """Protocol every Python engine service must implement."""

    manifest: EngineManifest

    def get_metadata(
        self,
        request: engine_pb2.GetMetadataRequest,
        context: grpc.ServicerContext,
    ) -> engine_pb2.GetMetadataResponse:
        ...

    def health(
        self,
        request: engine_pb2.HealthRequest,
        context: grpc.ServicerContext,
    ) -> engine_pb2.HealthResponse:
        ...

    def execute(
        self,
        request: engine_pb2.ExecuteRequest,
        context: grpc.ServicerContext,
    ) -> engine_pb2.ExecuteResponse:
        ...

    def stream_execute(
        self,
        request: engine_pb2.StreamExecuteRequest,
        context: grpc.ServicerContext,
    ) -> Iterable[engine_pb2.StreamExecuteResponse]:
        ...

    def cancel(
        self,
        request: engine_pb2.CancelRequest,
        context: grpc.ServicerContext,
    ) -> engine_pb2.CancelResponse:
        ...


def add_engine_service(server: grpc.Server, service: EngineServiceProtocol) -> None:
    """Register a generic QuantOS EngineService implementation."""

    handlers = {
        "GetMetadata": grpc.unary_unary_rpc_method_handler(
            service.get_metadata,
            request_deserializer=engine_pb2.GetMetadataRequest.FromString,
            response_serializer=engine_pb2.GetMetadataResponse.SerializeToString,
        ),
        "Health": grpc.unary_unary_rpc_method_handler(
            service.health,
            request_deserializer=engine_pb2.HealthRequest.FromString,
            response_serializer=engine_pb2.HealthResponse.SerializeToString,
        ),
        "Execute": grpc.unary_unary_rpc_method_handler(
            service.execute,
            request_deserializer=engine_pb2.ExecuteRequest.FromString,
            response_serializer=engine_pb2.ExecuteResponse.SerializeToString,
        ),
        "StreamExecute": grpc.unary_stream_rpc_method_handler(
            service.stream_execute,
            request_deserializer=engine_pb2.StreamExecuteRequest.FromString,
            response_serializer=engine_pb2.StreamExecuteResponse.SerializeToString,
        ),
        "Cancel": grpc.unary_unary_rpc_method_handler(
            service.cancel,
            request_deserializer=engine_pb2.CancelRequest.FromString,
            response_serializer=engine_pb2.CancelResponse.SerializeToString,
        ),
    }
    generic_handler = grpc.method_handlers_generic_handler(
        "quantos.engine.v1.EngineService",
        handlers,
    )
    server.add_generic_rpc_handlers((generic_handler,))


def serve_engine(
    socket_path: str | Path,
    service: EngineServiceProtocol,
    *,
    max_workers: int = 4,
) -> grpc.Server:
    """Start a QuantOS engine server on a Unix domain socket."""

    server = grpc.server(ThreadPoolExecutor(max_workers=max_workers))
    add_engine_service(server, service)
    bound = server.add_insecure_port(uds_target(socket_path))
    if bound == 0:
        raise RuntimeError(f"failed to bind engine UDS socket: {socket_path}")
    server.start()
    return server


@dataclass
class EngineClient:
    """Tiny generic client for contract tests and local harnesses."""

    target: str

    def __post_init__(self) -> None:
        self._channel = grpc.insecure_channel(self.target)
        self._get_metadata = self._channel.unary_unary(
            "/quantos.engine.v1.EngineService/GetMetadata",
            request_serializer=engine_pb2.GetMetadataRequest.SerializeToString,
            response_deserializer=engine_pb2.GetMetadataResponse.FromString,
        )
        self._health = self._channel.unary_unary(
            "/quantos.engine.v1.EngineService/Health",
            request_serializer=engine_pb2.HealthRequest.SerializeToString,
            response_deserializer=engine_pb2.HealthResponse.FromString,
        )
        self._execute = self._channel.unary_unary(
            "/quantos.engine.v1.EngineService/Execute",
            request_serializer=engine_pb2.ExecuteRequest.SerializeToString,
            response_deserializer=engine_pb2.ExecuteResponse.FromString,
        )
        self._stream_execute = self._channel.unary_stream(
            "/quantos.engine.v1.EngineService/StreamExecute",
            request_serializer=engine_pb2.StreamExecuteRequest.SerializeToString,
            response_deserializer=engine_pb2.StreamExecuteResponse.FromString,
        )
        self._cancel = self._channel.unary_unary(
            "/quantos.engine.v1.EngineService/Cancel",
            request_serializer=engine_pb2.CancelRequest.SerializeToString,
            response_deserializer=engine_pb2.CancelResponse.FromString,
        )

    def close(self) -> None:
        self._channel.close()

    def get_metadata(
        self,
        request: engine_pb2.GetMetadataRequest,
        *,
        timeout: float | None = None,
    ) -> engine_pb2.GetMetadataResponse:
        return self._get_metadata(request, timeout=timeout)

    def health(
        self,
        request: engine_pb2.HealthRequest,
        *,
        timeout: float | None = None,
    ) -> engine_pb2.HealthResponse:
        return self._health(request, timeout=timeout)

    def execute(
        self,
        request: engine_pb2.ExecuteRequest,
        *,
        timeout: float | None = None,
    ) -> engine_pb2.ExecuteResponse:
        return self._execute(request, timeout=timeout)

    def stream_execute(
        self,
        request: engine_pb2.StreamExecuteRequest,
        *,
        timeout: float | None = None,
    ) -> list[engine_pb2.StreamExecuteResponse]:
        return list(self._stream_execute(request, timeout=timeout))

    def cancel(
        self,
        request: engine_pb2.CancelRequest,
        *,
        timeout: float | None = None,
    ) -> engine_pb2.CancelResponse:
        return self._cancel(request, timeout=timeout)
