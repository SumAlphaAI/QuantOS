"""Manifest helpers for the TP06 strategy-lab engine."""

from __future__ import annotations

from quantos_engine_sdk import EngineCapability, EngineManifest


GENERATE_CAPABILITY = "strategy.generate.v1"


def build_manifest() -> EngineManifest:
    return EngineManifest(
        engine_name="strategy-lab",
        engine_version="0.1.0",
        capabilities=(
            EngineCapability(
                name=GENERATE_CAPABILITY,
                version="1.0.0",
                description=(
                    "Generate deterministic strategy drafts with static checks from bounded prompts."
                ),
            ),
        ),
        supported_schema_versions=("v1",),
    )
