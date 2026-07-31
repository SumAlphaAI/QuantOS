"""Manifest helpers for the TP05 OpenBB adapter engine."""

from __future__ import annotations

from quantos_engine_sdk import EngineCapability, EngineManifest


DATA_QUERY_CAPABILITY = "data.query.v1"


def build_manifest() -> EngineManifest:
    return EngineManifest(
        engine_name="openbb-adapter",
        engine_version="0.1.0",
        capabilities=(
            EngineCapability(
                name=DATA_QUERY_CAPABILITY,
                version="1.0.0",
                description="Generate deterministic lineage-rich data query responses through isolated providers.",
            ),
        ),
        supported_schema_versions=("v1",),
    )
