from google.api import field_behavior_pb2 as _field_behavior_pb2
from google.protobuf import timestamp_pb2 as _timestamp_pb2
from quantos.common.v1 import common_pb2 as _common_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class SignalDirection(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    SIGNAL_DIRECTION_UNSPECIFIED: _ClassVar[SignalDirection]
    SIGNAL_DIRECTION_LONG: _ClassVar[SignalDirection]
    SIGNAL_DIRECTION_SHORT: _ClassVar[SignalDirection]
    SIGNAL_DIRECTION_FLAT: _ClassVar[SignalDirection]

class DeploymentTarget(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    DEPLOYMENT_TARGET_UNSPECIFIED: _ClassVar[DeploymentTarget]
    DEPLOYMENT_TARGET_RESEARCH: _ClassVar[DeploymentTarget]
    DEPLOYMENT_TARGET_PAPER: _ClassVar[DeploymentTarget]
    DEPLOYMENT_TARGET_SHADOW: _ClassVar[DeploymentTarget]
    DEPLOYMENT_TARGET_ASSISTED_LIVE: _ClassVar[DeploymentTarget]
SIGNAL_DIRECTION_UNSPECIFIED: SignalDirection
SIGNAL_DIRECTION_LONG: SignalDirection
SIGNAL_DIRECTION_SHORT: SignalDirection
SIGNAL_DIRECTION_FLAT: SignalDirection
DEPLOYMENT_TARGET_UNSPECIFIED: DeploymentTarget
DEPLOYMENT_TARGET_RESEARCH: DeploymentTarget
DEPLOYMENT_TARGET_PAPER: DeploymentTarget
DEPLOYMENT_TARGET_SHADOW: DeploymentTarget
DEPLOYMENT_TARGET_ASSISTED_LIVE: DeploymentTarget

class StrategyRelease(_message.Message):
    __slots__ = ("metadata", "release_id", "strategy_id", "name", "source_digest", "image_digest", "parameter_hash", "backtest_report_artifact_id", "data_snapshot_id", "evidence_refs", "allowed_targets", "approved_at", "created_at")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    RELEASE_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    SOURCE_DIGEST_FIELD_NUMBER: _ClassVar[int]
    IMAGE_DIGEST_FIELD_NUMBER: _ClassVar[int]
    PARAMETER_HASH_FIELD_NUMBER: _ClassVar[int]
    BACKTEST_REPORT_ARTIFACT_ID_FIELD_NUMBER: _ClassVar[int]
    DATA_SNAPSHOT_ID_FIELD_NUMBER: _ClassVar[int]
    EVIDENCE_REFS_FIELD_NUMBER: _ClassVar[int]
    ALLOWED_TARGETS_FIELD_NUMBER: _ClassVar[int]
    APPROVED_AT_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    release_id: str
    strategy_id: str
    name: str
    source_digest: str
    image_digest: str
    parameter_hash: str
    backtest_report_artifact_id: str
    data_snapshot_id: str
    evidence_refs: _containers.RepeatedCompositeFieldContainer[_common_pb2.EvidenceRef]
    allowed_targets: _containers.RepeatedScalarFieldContainer[DeploymentTarget]
    approved_at: _timestamp_pb2.Timestamp
    created_at: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., release_id: _Optional[str] = ..., strategy_id: _Optional[str] = ..., name: _Optional[str] = ..., source_digest: _Optional[str] = ..., image_digest: _Optional[str] = ..., parameter_hash: _Optional[str] = ..., backtest_report_artifact_id: _Optional[str] = ..., data_snapshot_id: _Optional[str] = ..., evidence_refs: _Optional[_Iterable[_Union[_common_pb2.EvidenceRef, _Mapping]]] = ..., allowed_targets: _Optional[_Iterable[_Union[DeploymentTarget, str]]] = ..., approved_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., created_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class Signal(_message.Message):
    __slots__ = ("metadata", "signal_id", "strategy_release_id", "symbol", "direction", "strength", "confidence", "diagnostics", "generated_at", "valid_until", "evidence_refs")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    SIGNAL_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_RELEASE_ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    DIRECTION_FIELD_NUMBER: _ClassVar[int]
    STRENGTH_FIELD_NUMBER: _ClassVar[int]
    CONFIDENCE_FIELD_NUMBER: _ClassVar[int]
    DIAGNOSTICS_FIELD_NUMBER: _ClassVar[int]
    GENERATED_AT_FIELD_NUMBER: _ClassVar[int]
    VALID_UNTIL_FIELD_NUMBER: _ClassVar[int]
    EVIDENCE_REFS_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    signal_id: str
    strategy_release_id: str
    symbol: str
    direction: SignalDirection
    strength: _common_pb2.DecimalValue
    confidence: _common_pb2.DecimalValue
    diagnostics: _common_pb2.JsonDocument
    generated_at: _timestamp_pb2.Timestamp
    valid_until: _timestamp_pb2.Timestamp
    evidence_refs: _containers.RepeatedCompositeFieldContainer[_common_pb2.EvidenceRef]
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., signal_id: _Optional[str] = ..., strategy_release_id: _Optional[str] = ..., symbol: _Optional[str] = ..., direction: _Optional[_Union[SignalDirection, str]] = ..., strength: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., confidence: _Optional[_Union[_common_pb2.DecimalValue, _Mapping]] = ..., diagnostics: _Optional[_Union[_common_pb2.JsonDocument, _Mapping]] = ..., generated_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., valid_until: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., evidence_refs: _Optional[_Iterable[_Union[_common_pb2.EvidenceRef, _Mapping]]] = ...) -> None: ...
