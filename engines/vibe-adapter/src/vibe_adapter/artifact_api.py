"""Deterministic QuantOS Artifact API facade for TP01."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from threading import Lock
from urllib.parse import quote

from quantos.common.v1 import common_pb2


@dataclass(frozen=True)
class ArtifactBundle:
    """Artifact and evidence refs emitted by the adapter."""

    artifact_ref: common_pb2.ArtifactRef
    evidence_ref: common_pb2.EvidenceRef


class VibeArtifactApi:
    """Tenant-scoped in-memory mock; no Supabase upload is implied by its refs."""

    def __init__(self, bucket_name: str = "quantos-artifacts") -> None:
        self.bucket_name = bucket_name
        self._objects: dict[tuple[str, str], bytes] = {}
        self._lock = Lock()

    def read_json_artifact(self, *, tenant_id: str, artifact_id: str) -> dict:
        with self._lock:
            encoded = self._objects.get((tenant_id, artifact_id))
        if encoded is None:
            raise PermissionError("ENGINE_ARTIFACT_UNAVAILABLE")
        return json.loads(encoded)

    def record_json_artifact(
        self,
        *,
        workflow_run_id: str,
        tenant_id: str,
        artifact_kind: str,
        payload: dict,
    ) -> ArtifactBundle:
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        digest = hashlib.sha256(encoded).hexdigest()
        identity = hashlib.sha256(
            json.dumps(
                [tenant_id, workflow_run_id, artifact_kind, digest], separators=(",", ":")
            ).encode()
        ).hexdigest()
        artifact_id = f"artifact:{identity}:{artifact_kind}"
        evidence_id = f"evidence:{identity}:{artifact_kind}"
        uri = (
            f"mock-artifact://{quote(self.bucket_name, safe='')}/tenant/"
            f"{quote(tenant_id, safe='')}/vibe-adapter/{identity}.json"
        )
        with self._lock:
            self._objects[(tenant_id, artifact_id)] = encoded
        artifact_ref = common_pb2.ArtifactRef(
            artifact_id=artifact_id,
            uri=uri,
            media_type="application/json",
            sha256=f"sha256:{digest}",
            classification=common_pb2.DataClassification.DATA_CLASSIFICATION_INTERNAL,
        )
        evidence_ref = common_pb2.EvidenceRef(
            evidence_id=evidence_id,
            artifact_id=artifact_id,
            summary="TP01 vibe-adapter replay fixture output",
        )
        return ArtifactBundle(artifact_ref=artifact_ref, evidence_ref=evidence_ref)
