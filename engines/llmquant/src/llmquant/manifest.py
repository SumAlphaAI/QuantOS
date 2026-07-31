"""Manifest helpers for the TP03 LLMQuant engine."""

from __future__ import annotations

from quantos_engine_sdk import EngineCapability, EngineManifest


SIGNAL_CAPABILITY = "quant.signal.v1"


def build_manifest() -> EngineManifest:
    return EngineManifest(
        engine_name="llmquant",
        engine_version="0.1.0",
        capabilities=(
            EngineCapability(
                name=SIGNAL_CAPABILITY,
                version="1.0.0",
                description="Generate deterministic QuantOS signals from feature and release snapshots.",
            ),
        ),
        supported_schema_versions=("v1",),
    )
