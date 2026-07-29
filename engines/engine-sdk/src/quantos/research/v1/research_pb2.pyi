from google.api import field_behavior_pb2 as _field_behavior_pb2
from google.protobuf import duration_pb2 as _duration_pb2
from google.protobuf import timestamp_pb2 as _timestamp_pb2
from quantos.common.v1 import common_pb2 as _common_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class DataSnapshot(_message.Message):
    __slots__ = ("metadata", "snapshot_id", "schema_version", "window", "sources", "quality", "content_hash", "license_label", "captured_at", "max_age", "symbols", "artifact_refs")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    SNAPSHOT_ID_FIELD_NUMBER: _ClassVar[int]
    SCHEMA_VERSION_FIELD_NUMBER: _ClassVar[int]
    WINDOW_FIELD_NUMBER: _ClassVar[int]
    SOURCES_FIELD_NUMBER: _ClassVar[int]
    QUALITY_FIELD_NUMBER: _ClassVar[int]
    CONTENT_HASH_FIELD_NUMBER: _ClassVar[int]
    LICENSE_LABEL_FIELD_NUMBER: _ClassVar[int]
    CAPTURED_AT_FIELD_NUMBER: _ClassVar[int]
    MAX_AGE_FIELD_NUMBER: _ClassVar[int]
    SYMBOLS_FIELD_NUMBER: _ClassVar[int]
    ARTIFACT_REFS_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    snapshot_id: str
    schema_version: str
    window: _common_pb2.TimeWindow
    sources: _containers.RepeatedCompositeFieldContainer[_common_pb2.DataSourceRef]
    quality: _common_pb2.DataQuality
    content_hash: str
    license_label: str
    captured_at: _timestamp_pb2.Timestamp
    max_age: _duration_pb2.Duration
    symbols: _containers.RepeatedScalarFieldContainer[str]
    artifact_refs: _containers.RepeatedCompositeFieldContainer[_common_pb2.ArtifactRef]
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., snapshot_id: _Optional[str] = ..., schema_version: _Optional[str] = ..., window: _Optional[_Union[_common_pb2.TimeWindow, _Mapping]] = ..., sources: _Optional[_Iterable[_Union[_common_pb2.DataSourceRef, _Mapping]]] = ..., quality: _Optional[_Union[_common_pb2.DataQuality, str]] = ..., content_hash: _Optional[str] = ..., license_label: _Optional[str] = ..., captured_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., max_age: _Optional[_Union[_duration_pb2.Duration, _Mapping]] = ..., symbols: _Optional[_Iterable[str]] = ..., artifact_refs: _Optional[_Iterable[_Union[_common_pb2.ArtifactRef, _Mapping]]] = ...) -> None: ...

class ResearchArtifact(_message.Message):
    __slots__ = ("metadata", "artifact_id", "title", "hypothesis", "summary", "content_hash", "engine_version", "prompt_version", "code_version", "environment_hash", "data_snapshot_id", "evidence_refs", "attachments", "created_at", "expires_at", "audit_tags")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    ARTIFACT_ID_FIELD_NUMBER: _ClassVar[int]
    TITLE_FIELD_NUMBER: _ClassVar[int]
    HYPOTHESIS_FIELD_NUMBER: _ClassVar[int]
    SUMMARY_FIELD_NUMBER: _ClassVar[int]
    CONTENT_HASH_FIELD_NUMBER: _ClassVar[int]
    ENGINE_VERSION_FIELD_NUMBER: _ClassVar[int]
    PROMPT_VERSION_FIELD_NUMBER: _ClassVar[int]
    CODE_VERSION_FIELD_NUMBER: _ClassVar[int]
    ENVIRONMENT_HASH_FIELD_NUMBER: _ClassVar[int]
    DATA_SNAPSHOT_ID_FIELD_NUMBER: _ClassVar[int]
    EVIDENCE_REFS_FIELD_NUMBER: _ClassVar[int]
    ATTACHMENTS_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    EXPIRES_AT_FIELD_NUMBER: _ClassVar[int]
    AUDIT_TAGS_FIELD_NUMBER: _ClassVar[int]
    metadata: _common_pb2.CommandMetadata
    artifact_id: str
    title: str
    hypothesis: str
    summary: str
    content_hash: str
    engine_version: str
    prompt_version: str
    code_version: str
    environment_hash: str
    data_snapshot_id: str
    evidence_refs: _containers.RepeatedCompositeFieldContainer[_common_pb2.EvidenceRef]
    attachments: _containers.RepeatedCompositeFieldContainer[_common_pb2.ArtifactRef]
    created_at: _timestamp_pb2.Timestamp
    expires_at: _timestamp_pb2.Timestamp
    audit_tags: _common_pb2.AuditTags
    def __init__(self, metadata: _Optional[_Union[_common_pb2.CommandMetadata, _Mapping]] = ..., artifact_id: _Optional[str] = ..., title: _Optional[str] = ..., hypothesis: _Optional[str] = ..., summary: _Optional[str] = ..., content_hash: _Optional[str] = ..., engine_version: _Optional[str] = ..., prompt_version: _Optional[str] = ..., code_version: _Optional[str] = ..., environment_hash: _Optional[str] = ..., data_snapshot_id: _Optional[str] = ..., evidence_refs: _Optional[_Iterable[_Union[_common_pb2.EvidenceRef, _Mapping]]] = ..., attachments: _Optional[_Iterable[_Union[_common_pb2.ArtifactRef, _Mapping]]] = ..., created_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., expires_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., audit_tags: _Optional[_Union[_common_pb2.AuditTags, _Mapping]] = ...) -> None: ...
