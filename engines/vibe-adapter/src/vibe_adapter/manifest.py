"""Manifest helpers for the TP01 vibe adapter."""

from __future__ import annotations

from quantos_engine_sdk import EngineCapability, EngineManifest

ENGINE_NAME = "vibe-adapter"
ENGINE_VERSION = "0.1.0"
CAPABILITY_NAME = "research.vibe_adapter.execute"


def build_manifest() -> EngineManifest:
    return EngineManifest(
        engine_name=ENGINE_NAME,
        engine_version=ENGINE_VERSION,
        capabilities=(
            EngineCapability(
                name=CAPABILITY_NAME,
                version="1.0.0",
                description=(
                    "Replay research-safe workflow fixtures adapted from locked "
                    "Vibe-Trading baselines without venue, secret, or shell capabilities."
                ),
            ),
        ),
        supported_schema_versions=("v1",),
    )
