"""Tenant, workspace and actor scoped immutable development Artifact facade."""

from __future__ import annotations

import hashlib
import json
from threading import Lock

from quantos.common.v1 import common_pb2


class ResearchArtifactStore:
    """In-memory fixture store; mock URIs never imply a Supabase upload."""

    def __init__(self) -> None:
        self._objects: dict[tuple[str, str, str, str], bytes] = {}
        self._lock = Lock()

    @property
    def count(self) -> int:
        with self._lock:
            return len(self._objects)

    def record(self, owner: tuple[str, str, str, str], payload: dict) -> common_pb2.ArtifactRef:
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        digest = hashlib.sha256(encoded).hexdigest()
        identity = hashlib.sha256(json.dumps([*owner, digest]).encode()).hexdigest()
        artifact_id = f"research-artifact:{identity}"
        with self._lock:
            self._objects[(*owner[:3], artifact_id)] = encoded
        return common_pb2.ArtifactRef(
            artifact_id=artifact_id,
            uri=f"mock-artifact://rd-agent/{identity}.json",
            media_type="application/json",
            sha256=f"sha256:{digest}",
            classification=common_pb2.DATA_CLASSIFICATION_INTERNAL,
        )

    def read(self, tenant: str, workspace: str, actor: str, artifact_id: str) -> bytes:
        with self._lock:
            encoded = self._objects.get((tenant, workspace, actor, artifact_id))
        if encoded is None:
            raise PermissionError("ENGINE_ARTIFACT_UNAVAILABLE")
        return encoded
