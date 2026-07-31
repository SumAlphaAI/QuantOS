"""Manifest helpers for the TP04 TradingAgents engine."""

from __future__ import annotations

from quantos_engine_sdk import EngineCapability, EngineManifest


PROPOSAL_CAPABILITY = "decision.proposal.v1"


def build_manifest() -> EngineManifest:
    return EngineManifest(
        engine_name="trading-agents",
        engine_version="0.1.0",
        capabilities=(
            EngineCapability(
                name=PROPOSAL_CAPABILITY,
                version="1.0.0",
                description="Generate deterministic non-executable TradeProposals from versioned signals.",
            ),
        ),
        supported_schema_versions=("v1",),
    )
