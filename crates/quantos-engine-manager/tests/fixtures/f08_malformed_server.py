"""Deliberately untrusted EngineService for Manager identity checks."""

from __future__ import annotations

import argparse
import functools
import time
from concurrent import futures

import grpc

from quantos.engine.v1 import engine_pb2


def metadata(request, context, *, handshake_fault=""):
    del context
    if request.metadata.request_id == "raw-metadata-stall":
        time.sleep(3)
    response = engine_pb2.GetMetadataResponse(
        metadata=request.metadata,
        engine_name="mock-engine",
        engine_version="0.1.0",
        supported_schema_versions=["v1"],
        capabilities=[engine_pb2.Capability(
            name="research.execute", version="1.0.0",
            description="Execute deterministic research fixtures.",
        )],
    )
    if request.metadata.request_id == "raw-metadata-mismatch":
        response.metadata.request_id = "forged-request"
    if request.metadata.request_id == "manager-handshake":
        if handshake_fault == "name":
            response.engine_name = "forged-engine"
        if handshake_fault == "version":
            response.engine_version = "forged-version"
        if handshake_fault == "schema":
            response.supported_schema_versions[:] = ["v2"]
        if handshake_fault == "capability":
            response.capabilities[0].name = "forged.capability"
        if handshake_fault == "metadata":
            response.metadata.request_id = "forged-request"
    return response


def health(request, context, *, handshake_fault=""):
    del context
    if request.metadata.request_id == "raw-health-stall":
        time.sleep(3)
    if request.metadata.request_id == "manager-readiness" and handshake_fault == "health-cross-second":
        time.sleep(1.1)
    response = engine_pb2.HealthResponse(metadata=request.metadata, ready=True, status="ready")
    if request.metadata.request_id == "raw-health-mismatch":
        response.metadata.request_id = "forged-request"
    if request.metadata.request_id == "manager-readiness":
        if handshake_fault == "readiness":
            response.ready = False
        if handshake_fault == "health-metadata":
            response.metadata.request_id = "forged-request"
    return response


def execute(request, context):
    del context
    response = engine_pb2.ExecuteResponse(
        metadata=request.metadata,
        execution_id=f"{request.workflow_run_id}:{request.idempotency_key}",
        engine_version="0.1.0",
        input_hash="sha256:fixture",
    )
    if request.metadata.request_id == "raw-execute-mismatch":
        response.engine_version = "forged-version"
    if request.metadata.request_id == "raw-execute-metadata":
        response.metadata.request_id = "forged-request"
    if request.metadata.request_id == "raw-execute-hash":
        response.input_hash = "unverified"
    if request.metadata.request_id == "raw-execute-empty-id":
        response.execution_id = ""
    return response


def stream(request, context):
    del context
    inner = request.request
    execution_id = f"{inner.workflow_run_id}:{inner.idempotency_key}"
    first = engine_pb2.StreamExecuteResponse(
        metadata=inner.metadata, execution_id=execution_id,
        sequence_id="seq-1", done=False,
    )
    fault = inner.metadata.request_id
    if fault == "raw-stream-mismatch":
        first.metadata.request_id = "forged-request"
    if fault == "raw-stream-empty-id":
        first.execution_id = ""
    if fault == "raw-stream-empty-sequence":
        first.sequence_id = ""
    yield first
    if fault == "raw-stream-stall":
        time.sleep(1)
        return
    if fault == "raw-stream-incomplete":
        return
    if fault == "raw-stream-duplicate":
        yield first
        return
    if fault == "raw-stream-after-terminal":
        yield engine_pb2.StreamExecuteResponse(
            metadata=inner.metadata, execution_id=execution_id,
            sequence_id="seq-2", done=True,
        )
        yield engine_pb2.StreamExecuteResponse(
            metadata=inner.metadata, execution_id=execution_id,
            sequence_id="seq-3", done=False,
        )
        return
    if fault == "raw-stream-switch-execution":
        yield engine_pb2.StreamExecuteResponse(
            metadata=inner.metadata, execution_id="other-execution",
            sequence_id="seq-2", done=True,
        )
        return
    yield engine_pb2.StreamExecuteResponse(
        metadata=inner.metadata, execution_id=execution_id,
        sequence_id="seq-2", done=True,
    )


def cancel(request, context):
    del context
    if request.metadata.request_id == "raw-cancel-stall":
        time.sleep(3)
    response = engine_pb2.CancelResponse(
        metadata=request.metadata, execution_id=request.execution_id, cancelled=True,
    )
    if request.metadata.request_id == "raw-cancel-mismatch":
        response.execution_id = "forged-execution"
    if request.metadata.request_id == "raw-cancel-metadata":
        response.metadata.request_id = "forged-request"
    return response


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--socket", required=True)
    parser.add_argument("--handshake-fault", default="")
    args = parser.parse_args()
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=4))
    handlers = {
        "GetMetadata": grpc.unary_unary_rpc_method_handler(
            functools.partial(metadata, handshake_fault=args.handshake_fault),
            request_deserializer=engine_pb2.GetMetadataRequest.FromString,
            response_serializer=engine_pb2.GetMetadataResponse.SerializeToString,
        ),
        "Health": grpc.unary_unary_rpc_method_handler(
            functools.partial(health, handshake_fault=args.handshake_fault),
            request_deserializer=engine_pb2.HealthRequest.FromString,
            response_serializer=engine_pb2.HealthResponse.SerializeToString,
        ),
        "Execute": grpc.unary_unary_rpc_method_handler(
            execute,
            request_deserializer=engine_pb2.ExecuteRequest.FromString,
            response_serializer=engine_pb2.ExecuteResponse.SerializeToString,
        ),
        "StreamExecute": grpc.unary_stream_rpc_method_handler(
            stream,
            request_deserializer=engine_pb2.StreamExecuteRequest.FromString,
            response_serializer=engine_pb2.StreamExecuteResponse.SerializeToString,
        ),
        "Cancel": grpc.unary_unary_rpc_method_handler(
            cancel,
            request_deserializer=engine_pb2.CancelRequest.FromString,
            response_serializer=engine_pb2.CancelResponse.SerializeToString,
        ),
    }
    server.add_generic_rpc_handlers((grpc.method_handlers_generic_handler(
        "quantos.engine.v1.EngineService", handlers,
    ),))
    if server.add_insecure_port(f"unix:{args.socket}") == 0:
        raise RuntimeError("could not bind test socket")
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    main()
