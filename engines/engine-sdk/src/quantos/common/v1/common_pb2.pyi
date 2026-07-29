from google.api import field_behavior_pb2 as _field_behavior_pb2
from google.protobuf import duration_pb2 as _duration_pb2
from google.protobuf import struct_pb2 as _struct_pb2
from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ActorKind(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    ACTOR_KIND_UNSPECIFIED: _ClassVar[ActorKind]
    ACTOR_KIND_USER: _ClassVar[ActorKind]
    ACTOR_KIND_SERVICE: _ClassVar[ActorKind]
    ACTOR_KIND_AUTOMATION: _ClassVar[ActorKind]

class RuntimeMode(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    RUNTIME_MODE_UNSPECIFIED: _ClassVar[RuntimeMode]
    RUNTIME_MODE_RESEARCH: _ClassVar[RuntimeMode]
    RUNTIME_MODE_PAPER: _ClassVar[RuntimeMode]
    RUNTIME_MODE_SHADOW: _ClassVar[RuntimeMode]
    RUNTIME_MODE_ASSISTED_LIVE: _ClassVar[RuntimeMode]
    RUNTIME_MODE_GUARDED_LIVE: _ClassVar[RuntimeMode]

class Environment(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    ENVIRONMENT_UNSPECIFIED: _ClassVar[Environment]
    ENVIRONMENT_LOCAL: _ClassVar[Environment]
    ENVIRONMENT_TEST: _ClassVar[Environment]
    ENVIRONMENT_STAGING: _ClassVar[Environment]
    ENVIRONMENT_PRODUCTION: _ClassVar[Environment]

class DataClassification(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    DATA_CLASSIFICATION_UNSPECIFIED: _ClassVar[DataClassification]
    DATA_CLASSIFICATION_PUBLIC: _ClassVar[DataClassification]
    DATA_CLASSIFICATION_INTERNAL: _ClassVar[DataClassification]
    DATA_CLASSIFICATION_CONFIDENTIAL: _ClassVar[DataClassification]
    DATA_CLASSIFICATION_RESTRICTED: _ClassVar[DataClassification]

class DataQuality(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    DATA_QUALITY_UNSPECIFIED: _ClassVar[DataQuality]
    DATA_QUALITY_PENDING: _ClassVar[DataQuality]
    DATA_QUALITY_PASSED: _ClassVar[DataQuality]
    DATA_QUALITY_DEGRADED: _ClassVar[DataQuality]
    DATA_QUALITY_FAILED: _ClassVar[DataQuality]
ACTOR_KIND_UNSPECIFIED: ActorKind
ACTOR_KIND_USER: ActorKind
ACTOR_KIND_SERVICE: ActorKind
ACTOR_KIND_AUTOMATION: ActorKind
RUNTIME_MODE_UNSPECIFIED: RuntimeMode
RUNTIME_MODE_RESEARCH: RuntimeMode
RUNTIME_MODE_PAPER: RuntimeMode
RUNTIME_MODE_SHADOW: RuntimeMode
RUNTIME_MODE_ASSISTED_LIVE: RuntimeMode
RUNTIME_MODE_GUARDED_LIVE: RuntimeMode
ENVIRONMENT_UNSPECIFIED: Environment
ENVIRONMENT_LOCAL: Environment
ENVIRONMENT_TEST: Environment
ENVIRONMENT_STAGING: Environment
ENVIRONMENT_PRODUCTION: Environment
DATA_CLASSIFICATION_UNSPECIFIED: DataClassification
DATA_CLASSIFICATION_PUBLIC: DataClassification
DATA_CLASSIFICATION_INTERNAL: DataClassification
DATA_CLASSIFICATION_CONFIDENTIAL: DataClassification
DATA_CLASSIFICATION_RESTRICTED: DataClassification
DATA_QUALITY_UNSPECIFIED: DataQuality
DATA_QUALITY_PENDING: DataQuality
DATA_QUALITY_PASSED: DataQuality
DATA_QUALITY_DEGRADED: DataQuality
DATA_QUALITY_FAILED: DataQuality

class ActorRef(_message.Message):
    __slots__ = ("actor_id", "actor_kind", "display_name", "capabilities")
    ACTOR_ID_FIELD_NUMBER: _ClassVar[int]
    ACTOR_KIND_FIELD_NUMBER: _ClassVar[int]
    DISPLAY_NAME_FIELD_NUMBER: _ClassVar[int]
    CAPABILITIES_FIELD_NUMBER: _ClassVar[int]
    actor_id: str
    actor_kind: ActorKind
    display_name: str
    capabilities: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, actor_id: _Optional[str] = ..., actor_kind: _Optional[_Union[ActorKind, str]] = ..., display_name: _Optional[str] = ..., capabilities: _Optional[_Iterable[str]] = ...) -> None: ...

class CommandMetadata(_message.Message):
    __slots__ = ("request_id", "tenant_id", "workspace_id", "actor", "correlation_id", "causation_id", "mode", "environment", "issued_at")
    REQUEST_ID_FIELD_NUMBER: _ClassVar[int]
    TENANT_ID_FIELD_NUMBER: _ClassVar[int]
    WORKSPACE_ID_FIELD_NUMBER: _ClassVar[int]
    ACTOR_FIELD_NUMBER: _ClassVar[int]
    CORRELATION_ID_FIELD_NUMBER: _ClassVar[int]
    CAUSATION_ID_FIELD_NUMBER: _ClassVar[int]
    MODE_FIELD_NUMBER: _ClassVar[int]
    ENVIRONMENT_FIELD_NUMBER: _ClassVar[int]
    ISSUED_AT_FIELD_NUMBER: _ClassVar[int]
    request_id: str
    tenant_id: str
    workspace_id: str
    actor: ActorRef
    correlation_id: str
    causation_id: str
    mode: RuntimeMode
    environment: Environment
    issued_at: _timestamp_pb2.Timestamp
    def __init__(self, request_id: _Optional[str] = ..., tenant_id: _Optional[str] = ..., workspace_id: _Optional[str] = ..., actor: _Optional[_Union[ActorRef, _Mapping]] = ..., correlation_id: _Optional[str] = ..., causation_id: _Optional[str] = ..., mode: _Optional[_Union[RuntimeMode, str]] = ..., environment: _Optional[_Union[Environment, str]] = ..., issued_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class TimeWindow(_message.Message):
    __slots__ = ("start_at", "end_at")
    START_AT_FIELD_NUMBER: _ClassVar[int]
    END_AT_FIELD_NUMBER: _ClassVar[int]
    start_at: _timestamp_pb2.Timestamp
    end_at: _timestamp_pb2.Timestamp
    def __init__(self, start_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., end_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class DecimalValue(_message.Message):
    __slots__ = ("value",)
    VALUE_FIELD_NUMBER: _ClassVar[int]
    value: str
    def __init__(self, value: _Optional[str] = ...) -> None: ...

class MoneyValue(_message.Message):
    __slots__ = ("currency_code", "units", "nanos")
    CURRENCY_CODE_FIELD_NUMBER: _ClassVar[int]
    UNITS_FIELD_NUMBER: _ClassVar[int]
    NANOS_FIELD_NUMBER: _ClassVar[int]
    currency_code: str
    units: int
    nanos: int
    def __init__(self, currency_code: _Optional[str] = ..., units: _Optional[int] = ..., nanos: _Optional[int] = ...) -> None: ...

class DataSourceRef(_message.Message):
    __slots__ = ("source_id", "provider", "dataset", "license_label")
    SOURCE_ID_FIELD_NUMBER: _ClassVar[int]
    PROVIDER_FIELD_NUMBER: _ClassVar[int]
    DATASET_FIELD_NUMBER: _ClassVar[int]
    LICENSE_LABEL_FIELD_NUMBER: _ClassVar[int]
    source_id: str
    provider: str
    dataset: str
    license_label: str
    def __init__(self, source_id: _Optional[str] = ..., provider: _Optional[str] = ..., dataset: _Optional[str] = ..., license_label: _Optional[str] = ...) -> None: ...

class ArtifactRef(_message.Message):
    __slots__ = ("artifact_id", "uri", "media_type", "sha256", "classification")
    ARTIFACT_ID_FIELD_NUMBER: _ClassVar[int]
    URI_FIELD_NUMBER: _ClassVar[int]
    MEDIA_TYPE_FIELD_NUMBER: _ClassVar[int]
    SHA256_FIELD_NUMBER: _ClassVar[int]
    CLASSIFICATION_FIELD_NUMBER: _ClassVar[int]
    artifact_id: str
    uri: str
    media_type: str
    sha256: str
    classification: DataClassification
    def __init__(self, artifact_id: _Optional[str] = ..., uri: _Optional[str] = ..., media_type: _Optional[str] = ..., sha256: _Optional[str] = ..., classification: _Optional[_Union[DataClassification, str]] = ...) -> None: ...

class EvidenceRef(_message.Message):
    __slots__ = ("evidence_id", "artifact_id", "summary")
    EVIDENCE_ID_FIELD_NUMBER: _ClassVar[int]
    ARTIFACT_ID_FIELD_NUMBER: _ClassVar[int]
    SUMMARY_FIELD_NUMBER: _ClassVar[int]
    evidence_id: str
    artifact_id: str
    summary: str
    def __init__(self, evidence_id: _Optional[str] = ..., artifact_id: _Optional[str] = ..., summary: _Optional[str] = ...) -> None: ...

class VersionRef(_message.Message):
    __slots__ = ("version", "digest")
    VERSION_FIELD_NUMBER: _ClassVar[int]
    DIGEST_FIELD_NUMBER: _ClassVar[int]
    version: str
    digest: str
    def __init__(self, version: _Optional[str] = ..., digest: _Optional[str] = ...) -> None: ...

class FeatureWindow(_message.Message):
    __slots__ = ("symbol", "window", "freshness_sla")
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    WINDOW_FIELD_NUMBER: _ClassVar[int]
    FRESHNESS_SLA_FIELD_NUMBER: _ClassVar[int]
    symbol: str
    window: TimeWindow
    freshness_sla: _duration_pb2.Duration
    def __init__(self, symbol: _Optional[str] = ..., window: _Optional[_Union[TimeWindow, _Mapping]] = ..., freshness_sla: _Optional[_Union[_duration_pb2.Duration, _Mapping]] = ...) -> None: ...

class AuditTags(_message.Message):
    __slots__ = ("values",)
    VALUES_FIELD_NUMBER: _ClassVar[int]
    values: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, values: _Optional[_Iterable[str]] = ...) -> None: ...

class JsonDocument(_message.Message):
    __slots__ = ("value",)
    VALUE_FIELD_NUMBER: _ClassVar[int]
    value: _struct_pb2.Struct
    def __init__(self, value: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...
