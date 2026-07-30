"""Deterministic QuantOS Artifact API facade for TP01."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

from quantos.common.v1 import common_pb2


@dataclass(frozen=True)
class ArtifactBundle:
    """Artifact and evidence refs emitted by the adapter."""

    artifact_ref: common_pb2.ArtifactRef
    evidence_ref: common_pb2.EvidenceRef


class VibeArtifactApi:
    """Research-only facade that returns QuantOS artifact references."""

    def __init__(self, bucket_name: str = "quantos-artifacts") -> None:
        self.bucket_name = bucket_name

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
        artifact_id = f"artifact:{workflow_run_id}:{artifact_kind}"
        evidence_id = f"evidence:{workflow_run_id}:{artifact_kind}"
        uri = (
            f"supabase://{self.bucket_name}/tenant/{tenant_id}/vibe-adapter/"
            f"{workflow_run_id}/{artifact_kind}.json"
        )
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
