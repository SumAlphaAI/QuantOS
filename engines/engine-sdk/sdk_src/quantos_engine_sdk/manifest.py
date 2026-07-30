"""Shared manifest types for QuantOS engines."""

from __future__ import annotations

from dataclasses import dataclass

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2


@dataclass(frozen=True)
class EngineCapability:
    """Declarative capability exposed by an engine."""

    name: str
    version: str
    description: str

    def to_proto(self) -> engine_pb2.Capability:
        return engine_pb2.Capability(
            name=self.name,
            version=self.version,
            description=self.description,
        )


@dataclass(frozen=True)
class EngineManifest:
    """Stable engine metadata served through GetMetadata."""

    engine_name: str
    engine_version: str
    capabilities: tuple[EngineCapability, ...]
    supported_schema_versions: tuple[str, ...]

    def to_proto(
        self,
        metadata: common_pb2.CommandMetadata,
    ) -> engine_pb2.GetMetadataResponse:
        if not isinstance(metadata, common_pb2.CommandMetadata):
            raise TypeError("metadata must be CommandMetadata")
        return engine_pb2.GetMetadataResponse(
            metadata=metadata,
            engine_name=self.engine_name,
            engine_version=self.engine_version,
            capabilities=[capability.to_proto() for capability in self.capabilities],
            supported_schema_versions=list(self.supported_schema_versions),
        )
