"""Manifest helpers for the TP02 RD-Agent engine."""

from __future__ import annotations

from quantos_engine_sdk import EngineCapability, EngineManifest


HYPOTHESIS_CAPABILITY = "research.hypothesis.v1"
EXPERIMENT_CAPABILITY = "research.experiment.v1"


def build_manifest() -> EngineManifest:
    return EngineManifest(
        engine_name="rd-agent",
        engine_version="0.1.0",
        capabilities=(
            EngineCapability(
                name=HYPOTHESIS_CAPABILITY,
                version="1.0.0",
                description="Generate deterministic hypothesis ResearchArtifacts.",
            ),
            EngineCapability(
                name=EXPERIMENT_CAPABILITY,
                version="1.0.0",
                description="Generate deterministic experiment ResearchArtifacts.",
            ),
        ),
        supported_schema_versions=("v1",),
    )
