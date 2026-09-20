"""Public Python SDK surface for QuantOS engines."""

from quantos_engine_sdk.grpc import (
    EngineClient,
    add_engine_service,
    generated_package,
    input_hash,
    json_document_from_mapping,
    json_document_to_mapping,
    serve_engine,
    timestamp_from_datetime,
    timestamp_now,
    uds_target,
    workspace_name,
)
from quantos_engine_sdk.manifest import EngineCapability, EngineManifest
from quantos_engine_sdk.observability import EngineObservability, JsonlTraceExporter
from quantos_engine_sdk.validation import (
    MetadataValidationError,
    validate_command_metadata,
    validate_message_metadata,
)

__all__ = [
    "EngineCapability",
    "EngineClient",
    "EngineManifest",
    "EngineObservability",
    "JsonlTraceExporter",
    "MetadataValidationError",
    "add_engine_service",
    "generated_package",
    "input_hash",
    "json_document_from_mapping",
    "json_document_to_mapping",
    "serve_engine",
    "timestamp_from_datetime",
    "timestamp_now",
    "uds_target",
    "validate_command_metadata",
    "validate_message_metadata",
    "workspace_name",
]
