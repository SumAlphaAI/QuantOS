from google.api import annotations_pb2 as _annotations_pb2
from google.api import field_behavior_pb2 as _field_behavior_pb2
from google.protobuf import timestamp_pb2 as _timestamp_pb2
from quantos.common.v1 import common_pb2 as _common_pb2
from quantos.research.v1 import research_pb2 as _research_pb2
from quantos.strategy.v1 import strategy_pb2 as _strategy_pb2
from quantos.trading.v1 import trading_pb2 as _trading_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class EventKind(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    EVENT_KIND_UNSPECIFIED: _ClassVar[EventKind]
    EVENT_KIND_DATA_SNAPSHOT: _ClassVar[EventKind]
    EVENT_KIND_RESEARCH_ARTIFACT: _ClassVar[EventKind]
    EVENT_KIND_SIGNAL: _ClassVar[EventKind]
    EVENT_KIND_TRADE_PROPOSAL: _ClassVar[EventKind]
    EVENT_KIND_RISK_DECISION: _ClassVar[EventKind]
    EVENT_KIND_TRADE_COMMAND: _ClassVar[EventKind]
    EVENT_KIND_ORDER: _ClassVar[EventKind]
    EVENT_KIND_FILL: _ClassVar[EventKind]
    EVENT_KIND_POSITION: _ClassVar[EventKind]
EVENT_KIND_UNSPECIFIED: EventKind
EVENT_KIND_DATA_SNAPSHOT: EventKind
EVENT_KIND_RESEARCH_ARTIFACT: EventKind
EVENT_KIND_SIGNAL: EventKind
EVENT_KIND_TRADE_PROPOSAL: EventKind
EVENT_KIND_RISK_DECISION: EventKind
EVENT_KIND_TRADE_COMMAND: EventKind
EVENT_KIND_ORDER: EventKind
EVENT_KIND_FILL: EventKind
EVENT_KIND_POSITION: EventKind

class EventEnvelope(_message.Message):
    __slots__ = ("metadata", "event_id", "kind", "aggregate_id", "occurred_at", "data_snapshot", "research_artifact", "signal", "trade_proposal", "risk_decision", "trade_command", "order", "fill", "position")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    EVENT_ID_FIELD_NUMBER: _ClassVar[int]
    KIND_FIELD_NUMBER: _ClassVar[int]
    AGGREGATE_ID_FIELD_NUMBER: _ClassVar[int]
    OCCURRED_AT_FIELD_NUMBER: _ClassVar[int]
    DATA_SNAPSHOT_FIELD_NUMBER: _ClassVar[int]
    RESEARCH_ARTIFACT_FIELD_NUMBER: _ClassVar[int]
    SIGNAL_FIELD_NUMBER: _ClassVar[int]
    TRADE_PROPOSAL_FIELD_NUMBER: _ClassVar[int]
    RISK_DECISION_FIELD_NUMBER: _ClassVar[int]
    TRADE_COMMAND_FIELD_NUMBER: _ClassVar[int]
    ORDER_FIELD_NUMBER: _ClassVar[int]
    FILL_FIELD_NUMBER: _ClassVar[int]
    POSITION_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    event_id: str
    kind: EventKind
    aggregate_id: str
    occurred_at: _timestamp_pb2.Timestamp
    data_snapshot: _research_pb2.DataSnapshot
    research_artifact: _research_pb2.ResearchArtifact
    signal: _strategy_pb2.Signal
    trade_proposal: _trading_pb2.TradeProposal
    risk_decision: _trading_pb2.RiskDecision
    trade_command: _trading_pb2.TradeCommand
    order: _trading_pb2.Order
    fill: _trading_pb2.Fill
    position: _trading_pb2.Position
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., event_id: _Optional[str] = ..., kind: _Optional[_Union[EventKind, str]] = ..., aggregate_id: _Optional[str] = ..., occurred_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., data_snapshot: _Optional[_Union[_research_pb2.DataSnapshot, _Mapping]] = ..., research_artifact: _Optional[_Union[_research_pb2.ResearchArtifact, _Mapping]] = ..., signal: _Optional[_Union[_strategy_pb2.Signal, _Mapping]] = ..., trade_proposal: _Optional[_Union[_trading_pb2.TradeProposal, _Mapping]] = ..., risk_decision: _Optional[_Union[_trading_pb2.RiskDecision, _Mapping]] = ..., trade_command: _Optional[_Union[_trading_pb2.TradeCommand, _Mapping]] = ..., order: _Optional[_Union[_trading_pb2.Order, _Mapping]] = ..., fill: _Optional[_Union[_trading_pb2.Fill, _Mapping]] = ..., position: _Optional[_Union[_trading_pb2.Position, _Mapping]] = ...) -> None: ...

class GetEventRequest(_message.Message):
    __slots__ = ("metadata", "event_id")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    EVENT_ID_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    event_id: str
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., event_id: _Optional[str] = ...) -> None: ...

class GetEventResponse(_message.Message):
    __slots__ = ("event",)
    EVENT_FIELD_NUMBER: _ClassVar[int]
    event: EventEnvelope
    def __init__(self, event: _Optional[_Union[EventEnvelope, _Mapping]] = ...) -> None: ...

class ListEventsRequest(_message.Message):
    __slots__ = ("metadata", "aggregate_id", "correlation_id", "kind", "start_at", "end_at")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    AGGREGATE_ID_FIELD_NUMBER: _ClassVar[int]
    CORRELATION_ID_FIELD_NUMBER: _ClassVar[int]
    KIND_FIELD_NUMBER: _ClassVar[int]
    START_AT_FIELD_NUMBER: _ClassVar[int]
    END_AT_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    aggregate_id: str
    correlation_id: str
    kind: EventKind
    start_at: _timestamp_pb2.Timestamp
    end_at: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., aggregate_id: _Optional[str] = ..., correlation_id: _Optional[str] = ..., kind: _Optional[_Union[EventKind, str]] = ..., start_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., end_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class ListEventsResponse(_message.Message):
    __slots__ = ("events",)
    EVENTS_FIELD_NUMBER: _ClassVar[int]
    events: _containers.RepeatedCompositeFieldContainer[EventEnvelope]
    def __init__(self, events: _Optional[_Iterable[_Union[EventEnvelope, _Mapping]]] = ...) -> None: ...
