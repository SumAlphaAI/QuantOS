"""TP08: validate the Qlib -> QuantOS contract mapping samples.

The three samples under `third_party/qlib/mappings/` prove that Qlib's
dataset, experiment, and reproducibility concepts fit inside QuantOS
DataSnapshot / ResearchArtifact / runtime-run contracts. These tests keep
the samples replayable and structurally aligned with the proto contracts.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

MAPPINGS_DIR = Path(__file__).resolve().parents[2] / "third_party" / "qlib" / "mappings"

REQUIRED_METADATA_KEYS = {
    "tenant_id",
    "workspace_id",
    "actor_id",
    "correlation_id",
    "causation_id",
    "mode",
    "environment",
    "issued_at",
}


def _load(name: str) -> dict:
    return json.loads((MAPPINGS_DIR / name).read_text(encoding="utf-8"))


def _canonical_hash(doc: dict) -> str:
    payload = {key: value for key, value in doc.items() if key != "content_hash"}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def test_alpha158_mapping_matches_datasnapshot_contract() -> None:
    doc = _load("01-alpha158-to-datasnapshot.json")
    snapshot = doc["quantos_data_snapshot"]

    assert REQUIRED_METADATA_KEYS.issubset(snapshot["metadata"].keys())
    for field in (
        "snapshot_id",
        "schema_version",
        "window",
        "quality",
        "license_label",
        "captured_at",
        "max_age",
    ):
        assert snapshot[field], f"missing DataSnapshot field `{field}`"

    assert {"start_at", "end_at"}.issubset(snapshot["window"].keys())
    assert snapshot["sources"], "DataSnapshot requires at least one source"
    for source in snapshot["sources"]:
        assert {"source_id", "provider", "dataset", "license_label"}.issubset(source.keys())
    assert snapshot["symbols"], "DataSnapshot should carry the mapped universe symbols"
    for ref in snapshot["artifact_refs"]:
        assert {"artifact_id", "media_type", "content_hash", "storage_bucket", "object_key"}.issubset(
            ref.keys()
        )
        assert ref["content_hash"].startswith("sha256:")


def test_lightgbm_mapping_matches_research_artifact_contract() -> None:
    doc = _load("02-lightgbm-experiment-to-research-artifact.json")
    artifact = doc["quantos_research_artifact"]

    assert REQUIRED_METADATA_KEYS.issubset(artifact["metadata"].keys())
    for field in (
        "artifact_id",
        "title",
        "hypothesis",
        "summary",
        "engine_version",
        "prompt_version",
        "code_version",
        "environment_hash",
        "data_snapshot_id",
        "created_at",
    ):
        assert artifact[field] is not None, f"missing ResearchArtifact field `{field}`"

    assert artifact["evidence_refs"], "ResearchArtifact must carry evidence refs"
    for ref in artifact["evidence_refs"]:
        assert {"evidence_id", "artifact_id", "summary"}.issubset(ref.keys())
    for attachment in artifact["attachments"]:
        assert attachment["content_hash"].startswith("sha256:")


def test_experiment_mapping_references_the_snapshot_mapping() -> None:
    snapshot_doc = _load("01-alpha158-to-datasnapshot.json")
    artifact_doc = _load("02-lightgbm-experiment-to-research-artifact.json")
    assert (
        artifact_doc["quantos_research_artifact"]["data_snapshot_id"]
        == snapshot_doc["quantos_data_snapshot"]["snapshot_id"]
    )


def test_workflow_replay_mapping_matches_runtime_run_semantics() -> None:
    doc = _load("03-workflow-replay-to-runtime-run.json")
    run = doc["quantos_run_record"]

    for field in ("tool_name", "capability", "idempotency_key", "correlation_id", "input_hash"):
        assert run[field], f"missing run field `{field}`"
    assert run["input_hash"].startswith("sha256:")
    assert run["artifact_manifests"], "replay mapping must record artifact manifests"

    semantics = doc["replay_semantics"]
    assert {"same_input_same_hash", "artifact_dedup", "evidence_locatable"}.issubset(semantics.keys())


def test_mapping_samples_are_replayable() -> None:
    for name in (
        "01-alpha158-to-datasnapshot.json",
        "02-lightgbm-experiment-to-research-artifact.json",
        "03-workflow-replay-to-runtime-run.json",
    ):
        doc = _load(name)
        assert doc["content_hash"] == _canonical_hash(doc), f"{name} content hash drifted"
