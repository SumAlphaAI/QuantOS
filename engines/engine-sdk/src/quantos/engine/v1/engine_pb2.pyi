from google.api import annotations_pb2 as _annotations_pb2
from google.api import field_behavior_pb2 as _field_behavior_pb2
from google.protobuf import timestamp_pb2 as _timestamp_pb2
from quantos.common.v1 import common_pb2 as _common_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class Capability(_message.Message):
    __slots__ = ("name", "version", "description")
    NAME_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    name: str
    version: str
    description: str
    def __init__(self, name: _Optional[str] = ..., version: _Optional[str] = ..., description: _Optional[str] = ...) -> None: ...

class GetMetadataRequest(_message.Message):
    __slots__ = ("metadata",)
    METADATA_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ...) -> None: ...

class GetMetadataResponse(_message.Message):
    __slots__ = ("metadata", "engine_name", "engine_version", "capabilities", "supported_schema_versions")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    ENGINE_NAME_FIELD_NUMBER: _ClassVar[int]
    ENGINE_VERSION_FIELD_NUMBER: _ClassVar[int]
    CAPABILITIES_FIELD_NUMBER: _ClassVar[int]
    SUPPORTED_SCHEMA_VERSIONS_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    engine_name: str
    engine_version: str
    capabilities: _containers.RepeatedCompositeFieldContainer[Capability]
    supported_schema_versions: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., engine_name: _Optional[str] = ..., engine_version: _Optional[str] = ..., capabilities: _Optional[_Iterable[_Union[Capability, _Mapping]]] = ..., supported_schema_versions: _Optional[_Iterable[str]] = ...) -> None: ...

class HealthRequest(_message.Message):
    __slots__ = ("metadata",)
    METADATA_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ...) -> None: ...

class HealthResponse(_message.Message):
    __slots__ = ("metadata", "ready", "status", "observed_at")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    READY_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    OBSERVED_AT_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    ready: bool
    status: str
    observed_at: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., ready: bool = ..., status: _Optional[str] = ..., observed_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class ExecuteRequest(_message.Message):
    __slots__ = ("metadata", "workflow_run_id", "idempotency_key", "capability", "input_schema_version", "data_snapshot_ref", "policy_context_ref", "input", "deadline")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    WORKFLOW_RUN_ID_FIELD_NUMBER: _ClassVar[int]
    IDEMPOTENCY_KEY_FIELD_NUMBER: _ClassVar[int]
    CAPABILITY_FIELD_NUMBER: _ClassVar[int]
    INPUT_SCHEMA_VERSION_FIELD_NUMBER: _ClassVar[int]
    DATA_SNAPSHOT_REF_FIELD_NUMBER: _ClassVar[int]
    POLICY_CONTEXT_REF_FIELD_NUMBER: _ClassVar[int]
    INPUT_FIELD_NUMBER: _ClassVar[int]
    DEADLINE_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    workflow_run_id: str
    idempotency_key: str
    capability: str
    input_schema_version: str
    data_snapshot_ref: str
    policy_context_ref: str
    input: _common_pb2.JsonDocument
    deadline: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., workflow_run_id: _Optional[str] = ..., idempotency_key: _Optional[str] = ..., capability: _Optional[str] = ..., input_schema_version: _Optional[str] = ..., data_snapshot_ref: _Optional[str] = ..., policy_context_ref: _Optional[str] = ..., input: _Optional[_Union[_common_pb2.JsonDocument, _Mapping]] = ..., deadline: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class ExecuteResponse(_message.Message):
    __slots__ = ("metadata", "execution_id", "engine_version", "input_hash", "artifact_refs", "evidence_refs", "output", "completed_at")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    EXECUTION_ID_FIELD_NUMBER: _ClassVar[int]
    ENGINE_VERSION_FIELD_NUMBER: _ClassVar[int]
    INPUT_HASH_FIELD_NUMBER: _ClassVar[int]
    ARTIFACT_REFS_FIELD_NUMBER: _ClassVar[int]
    EVIDENCE_REFS_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_FIELD_NUMBER: _ClassVar[int]
    COMPLETED_AT_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    execution_id: str
    engine_version: str
    input_hash: str
    artifact_refs: _containers.RepeatedCompositeFieldContainer[_common_pb2.ArtifactRef]
    evidence_refs: _containers.RepeatedCompositeFieldContainer[_common_pb2.EvidenceRef]
    output: _common_pb2.JsonDocument
    completed_at: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., execution_id: _Optional[str] = ..., engine_version: _Optional[str] = ..., input_hash: _Optional[str] = ..., artifact_refs: _Optional[_Iterable[_Union[_common_pb2.ArtifactRef, _Mapping]]] = ..., evidence_refs: _Optional[_Iterable[_Union[_common_pb2.EvidenceRef, _Mapping]]] = ..., output: _Optional[_Union[_common_pb2.JsonDocument, _Mapping]] = ..., completed_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class StreamExecuteRequest(_message.Message):
    __slots__ = ("request",)
    REQUEST_FIELD_NUMBER: _ClassVar[int]
    request: ExecuteRequest
    def __init__(self, request: _Optional[_Union[ExecuteRequest, _Mapping]] = ...) -> None: ...

class StreamExecuteResponse(_message.Message):
    __slots__ = ("metadata", "execution_id", "sequence_id", "delta", "artifact_refs", "done", "emitted_at")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    EXECUTION_ID_FIELD_NUMBER: _ClassVar[int]
    SEQUENCE_ID_FIELD_NUMBER: _ClassVar[int]
    DELTA_FIELD_NUMBER: _ClassVar[int]
    ARTIFACT_REFS_FIELD_NUMBER: _ClassVar[int]
    DONE_FIELD_NUMBER: _ClassVar[int]
    EMITTED_AT_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    execution_id: str
    sequence_id: str
    delta: _common_pb2.JsonDocument
    artifact_refs: _containers.RepeatedCompositeFieldContainer[_common_pb2.ArtifactRef]
    done: bool
    emitted_at: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., execution_id: _Optional[str] = ..., sequence_id: _Optional[str] = ..., delta: _Optional[_Union[_common_pb2.JsonDocument, _Mapping]] = ..., artifact_refs: _Optional[_Iterable[_Union[_common_pb2.ArtifactRef, _Mapping]]] = ..., done: bool = ..., emitted_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class CancelRequest(_message.Message):
    __slots__ = ("metadata", "execution_id", "reason")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    EXECUTION_ID_FIELD_NUMBER: _ClassVar[int]
    REASON_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    execution_id: str
    reason: str
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., execution_id: _Optional[str] = ..., reason: _Optional[str] = ...) -> None: ...

class CancelResponse(_message.Message):
    __slots__ = ("metadata", "execution_id", "cancelled", "cancelled_at")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    EXECUTION_ID_FIELD_NUMBER: _ClassVar[int]
    CANCELLED_FIELD_NUMBER: _ClassVar[int]
    CANCELLED_AT_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    execution_id: str
    cancelled: bool
    cancelled_at: _timestamp_pb2.Timestamp
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., execution_id: _Optional[str] = ..., cancelled: bool = ..., cancelled_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...
