from __future__ import annotations

from typing import Any

from google.api import field_behavior_pb2
from google.protobuf.descriptor import FieldDescriptor

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos.events.v1 import events_pb2
from quantos.research.v1 import research_pb2
from quantos.strategy.v1 import strategy_pb2
from quantos.trading.v1 import trading_pb2


REQUIRED = field_behavior_pb2.FieldBehavior.Value("REQUIRED")
METADATA_TYPE = common_pb2.CommandMetadata.DESCRIPTOR.full_name
DOMAIN_MESSAGES = (
    research_pb2.DataSnapshot,
    research_pb2.ResearchArtifact,
    strategy_pb2.StrategyRelease,
    strategy_pb2.Signal,
    trading_pb2.TradeProposal,
    trading_pb2.RiskDecision,
    trading_pb2.TradeCommand,
    trading_pb2.Order,
    trading_pb2.Fill,
    trading_pb2.Position,
    events_pb2.EventEnvelope,
)
PROTOCOL_FILES = (
    engine_pb2.DESCRIPTOR,
    events_pb2.DESCRIPTOR,
)


def is_required(field: Any) -> bool:
    return REQUIRED in field.GetOptions().Extensions[field_behavior_pb2.field_behavior]


def assert_direct_required_metadata(descriptor: Any) -> None:
    metadata = descriptor.fields_by_name.get("metadata")
    assert metadata is not None, f"{descriptor.full_name} has no metadata field"
    assert metadata.message_type is not None
    assert metadata.message_type.full_name == METADATA_TYPE
    assert is_required(metadata), f"{descriptor.full_name}.metadata is not REQUIRED"


def has_required_metadata_path(
    descriptor: Any, visited: frozenset[str] = frozenset()
) -> bool:
    if descriptor.full_name in visited:
        return False
    metadata = descriptor.fields_by_name.get("metadata")
    if (
        metadata is not None
        and metadata.message_type is not None
        and metadata.message_type.full_name == METADATA_TYPE
        and is_required(metadata)
    ):
        return True
    next_visited = visited | {descriptor.full_name}
    return any(
        field.message_type is not None
        and field.label != FieldDescriptor.LABEL_REPEATED
        and is_required(field)
        and has_required_metadata_path(field.message_type, next_visited)
        for field in descriptor.fields
    )


def test_every_planned_domain_message_requires_command_metadata() -> None:
    assert len(DOMAIN_MESSAGES) == 11
    for message_type in DOMAIN_MESSAGES:
        assert_direct_required_metadata(message_type.DESCRIPTOR)


def test_command_metadata_requires_tenant_actor_and_correlation_identity() -> None:
    descriptor = common_pb2.CommandMetadata.DESCRIPTOR
    for field_name in (
        "request_id",
        "tenant_id",
        "workspace_id",
        "actor",
        "correlation_id",
        "mode",
        "environment",
        "issued_at",
    ):
        field = descriptor.fields_by_name[field_name]
        assert is_required(field), f"CommandMetadata.{field_name} is not REQUIRED"

    actor = descriptor.fields_by_name["actor"].message_type
    assert actor is not None
    for field_name in ("actor_id", "actor_kind"):
        assert is_required(actor.fields_by_name[field_name])


def test_every_rpc_request_and_response_requires_metadata() -> None:
    checked: set[str] = set()
    for file_descriptor in PROTOCOL_FILES:
        for service in file_descriptor.services_by_name.values():
            for method in service.methods:
                for descriptor in (method.input_type, method.output_type):
                    if descriptor.full_name in checked:
                        continue
                    assert has_required_metadata_path(descriptor), (
                        f"{descriptor.full_name} has no REQUIRED metadata path"
                    )
                    checked.add(descriptor.full_name)

    assert checked == {
        "quantos.engine.v1.GetMetadataRequest",
        "quantos.engine.v1.GetMetadataResponse",
        "quantos.engine.v1.HealthRequest",
        "quantos.engine.v1.HealthResponse",
        "quantos.engine.v1.ExecuteRequest",
        "quantos.engine.v1.ExecuteResponse",
        "quantos.engine.v1.StreamExecuteRequest",
        "quantos.engine.v1.StreamExecuteResponse",
        "quantos.engine.v1.CancelRequest",
        "quantos.engine.v1.CancelResponse",
        "quantos.events.v1.GetEventRequest",
        "quantos.events.v1.GetEventResponse",
        "quantos.events.v1.ListEventsRequest",
        "quantos.events.v1.ListEventsResponse",
    }
