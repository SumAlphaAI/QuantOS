"""Atomic immutable in-memory Signal/model bundle; mock URIs imply no upload."""

from __future__ import annotations

import hashlib
import json
from threading import Lock
from typing import TYPE_CHECKING

from quantos.common.v1 import common_pb2

if TYPE_CHECKING:
    from llmquant.signal_mapper import MappedSignal


class SignalArtifactStore:
    def __init__(self) -> None:
        self._objects: dict[tuple[str, str, str, str], bytes] = {}
        self._lock = Lock()

    @property
    def count(self) -> int:
        with self._lock:
            return len(self._objects)

    def record_bundle(
        self, owner: tuple[str, str, str, str], mapped: MappedSignal
    ) -> list[common_pb2.ArtifactRef]:
        entries = [
            (mapped.signal.signal_id, mapped.signal_payload),
            (mapped.model_artifact["artifact_id"], mapped.model_artifact),
        ]
        encoded = [
            (artifact_id, json.dumps(payload, sort_keys=True, separators=(",", ":")).encode())
            for artifact_id, payload in entries
        ]
        with self._lock:
            for artifact_id, raw in encoded:
                previous = self._objects.get((*owner[:3], artifact_id))
                if previous is not None and previous != raw:
                    raise ValueError("ENGINE_ARTIFACT_IMMUTABLE")
            for artifact_id, raw in encoded:
                self._objects[(*owner[:3], artifact_id)] = raw
        return [
            common_pb2.ArtifactRef(
                artifact_id=artifact_id,
                uri=f"mock-artifact://llmquant/{artifact_id.split(':')[1]}.json",
                media_type="application/json",
                sha256="sha256:" + hashlib.sha256(raw).hexdigest(),
                classification=common_pb2.DATA_CLASSIFICATION_INTERNAL,
            )
            for artifact_id, raw in encoded
        ]

    def read(self, tenant: str, workspace: str, actor: str, artifact_id: str) -> bytes:
        with self._lock:
            raw = self._objects.get((tenant, workspace, actor, artifact_id))
        if raw is None:
            raise PermissionError("ENGINE_ARTIFACT_UNAVAILABLE")
        return raw
