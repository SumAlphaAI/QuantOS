"""Runtime validation for required QuantOS command metadata."""

from __future__ import annotations

from typing import Any

from quantos.common.v1 import common_pb2


class MetadataValidationError(ValueError):
    """Raised when a protocol message lacks its security and audit identity."""


def _require_text(value: str, field: str) -> None:
    if not value.strip():
        raise MetadataValidationError(
            f"required command metadata field is missing or invalid: {field}"
        )


def validate_command_metadata(metadata: common_pb2.CommandMetadata) -> None:
    _require_text(metadata.request_id, "metadata.request_id")
    _require_text(metadata.tenant_id, "metadata.tenant_id")
    _require_text(metadata.workspace_id, "metadata.workspace_id")
    _require_text(metadata.correlation_id, "metadata.correlation_id")
    if not metadata.HasField("actor"):
        raise MetadataValidationError(
            "required command metadata field is missing or invalid: metadata.actor"
        )
    _require_text(metadata.actor.actor_id, "metadata.actor.actor_id")
    if metadata.actor.actor_kind == common_pb2.ACTOR_KIND_UNSPECIFIED:
        raise MetadataValidationError(
            "required command metadata field is missing or invalid: metadata.actor.actor_kind"
        )
    if metadata.mode == common_pb2.RUNTIME_MODE_UNSPECIFIED:
        raise MetadataValidationError(
            "required command metadata field is missing or invalid: metadata.mode"
        )
    if metadata.environment == common_pb2.ENVIRONMENT_UNSPECIFIED:
        raise MetadataValidationError(
            "required command metadata field is missing or invalid: metadata.environment"
        )
    if not metadata.HasField("issued_at"):
        raise MetadataValidationError(
            "required command metadata field is missing or invalid: metadata.issued_at"
        )


def validate_message_metadata(message: Any) -> None:
    """Validate identity at every domain-message boundary, including oneofs and lists."""
    fields = message.DESCRIPTOR.fields_by_name
    if "metadata" in fields:
        if not message.HasField("metadata"):
            raise MetadataValidationError("required command metadata field: metadata")
        validate_command_metadata(message.metadata)
    elif message.DESCRIPTOR.full_name != "quantos.engine.v1.StreamExecuteRequest":
        raise MetadataValidationError("message does not carry command metadata")
    required_children = {
        "quantos.engine.v1.StreamExecuteRequest": "request",
        "quantos.trading.v1.TradeProposal": "signal",
        "quantos.events.v1.GetEventResponse": "event",
    }
    required = required_children.get(message.DESCRIPTOR.full_name)
    if required and not message.HasField(required):
        raise MetadataValidationError(f"required domain message: {required}")
    for field, value in message.ListFields():
        if field.message_type and "metadata" in field.message_type.fields_by_name:
            for child in value if field.label == field.LABEL_REPEATED else [value]:
                validate_message_metadata(child)
