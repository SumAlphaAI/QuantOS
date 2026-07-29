from google.api import field_behavior_pb2 as _field_behavior_pb2
from google.protobuf import timestamp_pb2 as _timestamp_pb2
from quantos.common.v1 import common_pb2 as _common_pb2
from quantos.strategy.v1 import strategy_pb2 as _strategy_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class VenueKind(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    VENUE_KIND_UNSPECIFIED: _ClassVar[VenueKind]
    VENUE_KIND_CEX: _ClassVar[VenueKind]
    VENUE_KIND_DEX: _ClassVar[VenueKind]

class ProposalAction(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    PROPOSAL_ACTION_UNSPECIFIED: _ClassVar[ProposalAction]
    PROPOSAL_ACTION_BUY: _ClassVar[ProposalAction]
    PROPOSAL_ACTION_SELL: _ClassVar[ProposalAction]
    PROPOSAL_ACTION_HOLD: _ClassVar[ProposalAction]
    PROPOSAL_ACTION_REDUCE: _ClassVar[ProposalAction]

class RiskVerdict(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    RISK_VERDICT_UNSPECIFIED: _ClassVar[RiskVerdict]
    RISK_VERDICT_ALLOW: _ClassVar[RiskVerdict]
    RISK_VERDICT_DENY: _ClassVar[RiskVerdict]
    RISK_VERDICT_APPROVAL_REQUIRED: _ClassVar[RiskVerdict]

class OrderIntentType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    ORDER_INTENT_TYPE_UNSPECIFIED: _ClassVar[OrderIntentType]
    ORDER_INTENT_TYPE_MARKET: _ClassVar[OrderIntentType]
    ORDER_INTENT_TYPE_LIMIT: _ClassVar[OrderIntentType]
    ORDER_INTENT_TYPE_STOP: _ClassVar[OrderIntentType]
    ORDER_INTENT_TYPE_STOP_LIMIT: _ClassVar[OrderIntentType]

class OrderSide(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    ORDER_SIDE_UNSPECIFIED: _ClassVar[OrderSide]
    ORDER_SIDE_BUY: _ClassVar[OrderSide]
    ORDER_SIDE_SELL: _ClassVar[OrderSide]

class OrderStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    ORDER_STATUS_UNSPECIFIED: _ClassVar[OrderStatus]
    ORDER_STATUS_DRAFT: _ClassVar[OrderStatus]
    ORDER_STATUS_SUBMITTED: _ClassVar[OrderStatus]
    ORDER_STATUS_ACCEPTED: _ClassVar[OrderStatus]
    ORDER_STATUS_REJECTED: _ClassVar[OrderStatus]
    ORDER_STATUS_PARTIALLY_FILLED: _ClassVar[OrderStatus]
    ORDER_STATUS_FILLED: _ClassVar[OrderStatus]
    ORDER_STATUS_CANCELLED: _ClassVar[OrderStatus]
    ORDER_STATUS_EXPIRED: _ClassVar[OrderStatus]

class PositionSide(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    POSITION_SIDE_UNSPECIFIED: _ClassVar[PositionSide]
    POSITION_SIDE_NET: _ClassVar[PositionSide]
    POSITION_SIDE_LONG: _ClassVar[PositionSide]
    POSITION_SIDE_SHORT: _ClassVar[PositionSide]
VENUE_KIND_UNSPECIFIED: VenueKind
VENUE_KIND_CEX: VenueKind
VENUE_KIND_DEX: VenueKind
PROPOSAL_ACTION_UNSPECIFIED: ProposalAction
PROPOSAL_ACTION_BUY: ProposalAction
PROPOSAL_ACTION_SELL: ProposalAction
PROPOSAL_ACTION_HOLD: ProposalAction
PROPOSAL_ACTION_REDUCE: ProposalAction
RISK_VERDICT_UNSPECIFIED: RiskVerdict
RISK_VERDICT_ALLOW: RiskVerdict
RISK_VERDICT_DENY: RiskVerdict
RISK_VERDICT_APPROVAL_REQUIRED: RiskVerdict
ORDER_INTENT_TYPE_UNSPECIFIED: OrderIntentType
ORDER_INTENT_TYPE_MARKET: OrderIntentType
ORDER_INTENT_TYPE_LIMIT: OrderIntentType
ORDER_INTENT_TYPE_STOP: OrderIntentType
ORDER_INTENT_TYPE_STOP_LIMIT: OrderIntentType
ORDER_SIDE_UNSPECIFIED: OrderSide
ORDER_SIDE_BUY: OrderSide
ORDER_SIDE_SELL: OrderSide
ORDER_STATUS_UNSPECIFIED: OrderStatus
ORDER_STATUS_DRAFT: OrderStatus
ORDER_STATUS_SUBMITTED: OrderStatus
ORDER_STATUS_ACCEPTED: OrderStatus
ORDER_STATUS_REJECTED: OrderStatus
ORDER_STATUS_PARTIALLY_FILLED: OrderStatus
ORDER_STATUS_FILLED: OrderStatus
ORDER_STATUS_CANCELLED: OrderStatus
ORDER_STATUS_EXPIRED: OrderStatus
POSITION_SIDE_UNSPECIFIED: PositionSide
POSITION_SIDE_NET: PositionSide
POSITION_SIDE_LONG: PositionSide
POSITION_SIDE_SHORT: PositionSide

class TradeProposal(_message.Message):
    __slots__ = ("metadata", "proposal_id", "account_id", "symbol", "action", "quantity", "notional", "limit_price", "stop_price", "signal", "evidence_refs", "rationale", "confidence", "expires_at", "executable")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    PROPOSAL_ID_FIELD_NUMBER: _ClassVar[int]
    ACCOUNT_ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    ACTION_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    NOTIONAL_FIELD_NUMBER: _ClassVar[int]
    LIMIT_PRICE_FIELD_NUMBER: _ClassVar[int]
    STOP_PRICE_FIELD_NUMBER: _ClassVar[int]
    SIGNAL_FIELD_NUMBER: _ClassVar[int]
    EVIDENCE_REFS_FIELD_NUMBER: _ClassVar[int]
    RATIONALE_FIELD_NUMBER: _ClassVar[int]
    CONFIDENCE_FIELD_NUMBER: _ClassVar[int]
    EXPIRES_AT_FIELD_NUMBER: _ClassVar[int]
    EXECUTABLE_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    proposal_id: str
    account_id: str
    symbol: str
    action: ProposalAction
    quantity: _common_pb2.DecimalValue
    notional: _common_pb2.DecimalValue
    limit_price: _common_pb2.DecimalValue
    stop_price: _common_pb2.DecimalValue
    signal: _strategy_pb2.Signal
    evidence_refs: _containers.RepeatedCompositeFieldContainer[_common_pb2.EvidenceRef]
    rationale: str
    confidence: _common_pb2.DecimalValue
    expires_at: _timestamp_pb2.Timestamp
    executable: bool
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., proposal_id: _Optional[str] = ..., account_id: _Optional[str] = ..., symbol: _Optional[str] = ..., action: _Optional[_Union[ProposalAction, str]] = ..., quantity: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., notional: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., limit_price: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., stop_price: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., signal: _Optional[_Union[_strategy_pb2.Signal, _Mapping]] = ..., evidence_refs: _Optional[_Iterable[_Union[_common_pb2.EvidenceRef, _Mapping]]] = ..., rationale: _Optional[str] = ..., confidence: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., expires_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., executable: bool = ...) -> None: ...

class RiskDecision(_message.Message):
    __slots__ = ("metadata", "decision_id", "proposal_id", "verdict", "hit_rules", "limit_ids", "signer", "reason", "decided_at")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    DECISION_ID_FIELD_NUMBER: _ClassVar[int]
    PROPOSAL_ID_FIELD_NUMBER: _ClassVar[int]
    VERDICT_FIELD_NUMBER: _ClassVar[int]
    HIT_RULES_FIELD_NUMBER: _ClassVar[int]
    LIMIT_IDS_FIELD_NUMBER: _ClassVar[int]
    SIGNER_FIELD_NUMBER: _ClassVar[int]
    REASON_FIELD_NUMBER: _ClassVar[int]
    DECIDED_AT_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    decision_id: str
    proposal_id: str
    verdict: RiskVerdict
    hit_rules: _containers.RepeatedScalarFieldContainer[str]
    limit_ids: _containers.RepeatedScalarFieldContainer[str]
    signer: str
    reason: str
    decided_at: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., decision_id: _Optional[str] = ..., proposal_id: _Optional[str] = ..., verdict: _Optional[_Union[RiskVerdict, str]] = ..., hit_rules: _Optional[_Iterable[str]] = ..., limit_ids: _Optional[_Iterable[str]] = ..., signer: _Optional[str] = ..., reason: _Optional[str] = ..., decided_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class TradeCommand(_message.Message):
    __slots__ = ("metadata", "command_id", "decision_id", "account_id", "venue", "venue_kind", "symbol", "intent", "side", "quantity", "limit_price", "stop_price", "idempotency_key", "approval_signature", "expires_at")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    COMMAND_ID_FIELD_NUMBER: _ClassVar[int]
    DECISION_ID_FIELD_NUMBER: _ClassVar[int]
    ACCOUNT_ID_FIELD_NUMBER: _ClassVar[int]
    VENUE_FIELD_NUMBER: _ClassVar[int]
    VENUE_KIND_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    INTENT_FIELD_NUMBER: _ClassVar[int]
    SIDE_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    LIMIT_PRICE_FIELD_NUMBER: _ClassVar[int]
    STOP_PRICE_FIELD_NUMBER: _ClassVar[int]
    IDEMPOTENCY_KEY_FIELD_NUMBER: _ClassVar[int]
    APPROVAL_SIGNATURE_FIELD_NUMBER: _ClassVar[int]
    EXPIRES_AT_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    command_id: str
    decision_id: str
    account_id: str
    venue: str
    venue_kind: VenueKind
    symbol: str
    intent: OrderIntentType
    side: OrderSide
    quantity: _common_pb2.DecimalValue
    limit_price: _common_pb2.DecimalValue
    stop_price: _common_pb2.DecimalValue
    idempotency_key: str
    approval_signature: str
    expires_at: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., command_id: _Optional[str] = ..., decision_id: _Optional[str] = ..., account_id: _Optional[str] = ..., venue: _Optional[str] = ..., venue_kind: _Optional[_Union[VenueKind, str]] = ..., symbol: _Optional[str] = ..., intent: _Optional[_Union[OrderIntentType, str]] = ..., side: _Optional[_Union[OrderSide, str]] = ..., quantity: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., limit_price: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., stop_price: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., idempotency_key: _Optional[str] = ..., approval_signature: _Optional[str] = ..., expires_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class Order(_message.Message):
    __slots__ = ("metadata", "order_id", "command_id", "venue_order_id", "account_id", "symbol", "side", "intent", "quantity", "filled_quantity", "average_fill_price", "status", "submitted_at", "updated_at")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    COMMAND_ID_FIELD_NUMBER: _ClassVar[int]
    VENUE_ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    ACCOUNT_ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    SIDE_FIELD_NUMBER: _ClassVar[int]
    INTENT_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    FILLED_QUANTITY_FIELD_NUMBER: _ClassVar[int]
    AVERAGE_FILL_PRICE_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    SUBMITTED_AT_FIELD_NUMBER: _ClassVar[int]
    UPDATED_AT_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    order_id: str
    command_id: str
    venue_order_id: str
    account_id: str
    symbol: str
    side: OrderSide
    intent: OrderIntentType
    quantity: _common_pb2.DecimalValue
    filled_quantity: _common_pb2.DecimalValue
    average_fill_price: _common_pb2.DecimalValue
    status: OrderStatus
    submitted_at: _timestamp_pb2.Timestamp
    updated_at: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., order_id: _Optional[str] = ..., command_id: _Optional[str] = ..., venue_order_id: _Optional[str] = ..., account_id: _Optional[str] = ..., symbol: _Optional[str] = ..., side: _Optional[_Union[OrderSide, str]] = ..., intent: _Optional[_Union[OrderIntentType, str]] = ..., quantity: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., filled_quantity: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., average_fill_price: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., status: _Optional[_Union[OrderStatus, str]] = ..., submitted_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., updated_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class Fill(_message.Message):
    __slots__ = ("metadata", "fill_id", "order_id", "venue_fill_id", "symbol", "quantity", "price", "fee", "filled_at")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    FILL_ID_FIELD_NUMBER: _ClassVar[int]
    ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    VENUE_FILL_ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    FEE_FIELD_NUMBER: _ClassVar[int]
    FILLED_AT_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    fill_id: str
    order_id: str
    venue_fill_id: str
    symbol: str
    quantity: _common_pb2.DecimalValue
    price: _common_pb2.DecimalValue
    fee: _common_pb2.MoneyValue
    filled_at: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., fill_id: _Optional[str] = ..., order_id: _Optional[str] = ..., venue_fill_id: _Optional[str] = ..., symbol: _Optional[str] = ..., quantity: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., price: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., fee: _Optional[_Union[_common_pb2.MoneyValue, _Mapping]] = ..., filled_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class Position(_message.Message):
    __slots__ = ("metadata", "position_id", "account_id", "symbol", "side", "quantity", "average_entry_price", "mark_value", "unrealized_pnl", "as_of")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    POSITION_ID_FIELD_NUMBER: _ClassVar[int]
    ACCOUNT_ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    SIDE_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    AVERAGE_ENTRY_PRICE_FIELD_NUMBER: _ClassVar[int]
    MARK_VALUE_FIELD_NUMBER: _ClassVar[int]
    UNREALIZED_PNL_FIELD_NUMBER: _ClassVar[int]
    AS_OF_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    position_id: str
    account_id: str
    symbol: str
    side: PositionSide
    quantity: _common_pb2.DecimalValue
    average_entry_price: _common_pb2.DecimalValue
    mark_value: _common_pb2.MoneyValue
    unrealized_pnl: _common_pb2.MoneyValue
    as_of: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., position_id: _Optional[str] = ..., account_id: _Optional[str] = ..., symbol: _Optional[str] = ..., side: _Optional[_Union[PositionSide, str]] = ..., quantity: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., average_entry_price: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., mark_value: _Optional[_Union[_common_pb2.MoneyValue, _Mapping]] = ..., unrealized_pnl: _Optional[_Union[_common_pb2.MoneyValue, _Mapping]] = ..., as_of: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...
