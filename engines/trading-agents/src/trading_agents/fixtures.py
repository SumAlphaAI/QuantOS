"""Deterministic proposal fixtures for TP04 TradingAgents."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class DecisionFixture:
    fixture_name: str
    symbol: str
    action: str
    quantity: Decimal
    notional: Decimal
    limit_price: Decimal | None
    stop_price: Decimal | None
    proposal_confidence: Decimal
    signal_direction: str
    signal_strength: Decimal
    signal_confidence: Decimal
    validity_minutes: int
    signal_validity_minutes: int
    strategy_release_id: str
    signal_id: str
    signal_strategy_version: str
    signal_model_version: str
    signal_model_digest: str
    signal_data_version: str
    signal_summary: str
    rationale: str
    supporting_views: tuple[str, ...]
    counter_views: tuple[str, ...]
    evidence: tuple[str, ...]
    policy_snapshot_id: str
    portfolio_snapshot_id: str
    policy_rules: tuple[str, ...]
    risk_flags: tuple[str, ...]


@dataclass(frozen=True)
class FixedProposalInput:
    """Deterministic fixed-input case used by the TP04 contract harness."""

    case_id: str
    fixture_name: str
    account_id: str
    policy_snapshot_id: str
    portfolio_snapshot_id: str
    signal_payload: dict
    requested_tools: tuple[str, ...]


def _catalog_path() -> Path:
    return Path(__file__).with_name("fixtures") / "catalog.json"


@lru_cache(maxsize=1)
def fixture_catalog() -> tuple[DecisionFixture, ...]:
    parsed = json.loads(_catalog_path().read_text(encoding="utf-8"))
    return tuple(
        DecisionFixture(
            fixture_name=entry["fixture_name"],
            symbol=entry["symbol"],
            action=entry["action"],
            quantity=Decimal(entry["quantity"]),
            notional=Decimal(entry["notional"]),
            limit_price=None if entry["limit_price"] is None else Decimal(entry["limit_price"]),
            stop_price=None if entry["stop_price"] is None else Decimal(entry["stop_price"]),
            proposal_confidence=Decimal(entry["proposal_confidence"]),
            signal_direction=entry["signal_direction"],
            signal_strength=Decimal(entry["signal_strength"]),
            signal_confidence=Decimal(entry["signal_confidence"]),
            validity_minutes=int(entry["validity_minutes"]),
            signal_validity_minutes=int(entry["signal_validity_minutes"]),
            strategy_release_id=entry["strategy_release_id"],
            signal_id=entry["signal_id"],
            signal_strategy_version=entry["signal_strategy_version"],
            signal_model_version=entry["signal_model_version"],
            signal_model_digest=entry["signal_model_digest"],
            signal_data_version=entry["signal_data_version"],
            signal_summary=entry["signal_summary"],
            rationale=entry["rationale"],
            supporting_views=tuple(entry["supporting_views"]),
            counter_views=tuple(entry["counter_views"]),
            evidence=tuple(entry["evidence"]),
            policy_snapshot_id=entry["policy_snapshot_id"],
            portfolio_snapshot_id=entry["portfolio_snapshot_id"],
            policy_rules=tuple(entry["policy_rules"]),
            risk_flags=tuple(entry["risk_flags"]),
        )
        for entry in parsed["fixtures"]
    )


def fixture_names() -> tuple[str, ...]:
    return tuple(fixture.fixture_name for fixture in fixture_catalog())


def load_fixture(fixture_name: str) -> DecisionFixture:
    for fixture in fixture_catalog():
        if fixture.fixture_name == fixture_name:
            return fixture
    raise FileNotFoundError(f"fixture `{fixture_name}` was not found")


def build_signal_payload(
    fixture: DecisionFixture,
    *,
    request_seed: str,
    tenant_id: str = "tenant-primary",
    workspace_id: str = "workspace-primary",
    actor_id: str = "actor-signal",
) -> dict:
    """Build a deterministic Signal JSON payload for proposal inputs."""

    generated_at = _generated_at(request_seed, fixture.fixture_name)
    valid_until = generated_at + timedelta(minutes=fixture.signal_validity_minutes)
    return {
        "metadata": {
            "request_id": f"signal-{request_seed}",
            "tenant_id": tenant_id,
            "workspace_id": workspace_id,
            "actor": {
                "actor_id": actor_id,
                "actor_kind": "ACTOR_KIND_USER",
                "display_name": "QuantOS Signal Engine",
                "capabilities": ["quant.signal.v1"],
            },
            "correlation_id": f"corr-signal-{request_seed}",
            "causation_id": f"cause-signal-{request_seed}",
            "mode": "RUNTIME_MODE_RESEARCH",
            "environment": "ENVIRONMENT_TEST",
            "issued_at": generated_at.isoformat().replace("+00:00", "Z"),
        },
        "signal_id": f"{fixture.signal_id}:{request_seed}",
        "strategy_release_id": fixture.strategy_release_id,
        "symbol": fixture.symbol,
        "direction": _signal_direction_name(fixture.signal_direction),
        "strength": {"value": str(fixture.signal_strength)},
        "confidence": {"value": str(fixture.signal_confidence)},
        "diagnostics": {
            "value": {
                "strategy_version": fixture.signal_strategy_version,
                "model_version": fixture.signal_model_version,
                "model_digest": fixture.signal_model_digest,
                "data_version": fixture.signal_data_version,
                "summary": fixture.signal_summary,
                "policy_snapshot_id": fixture.policy_snapshot_id,
            }
        },
        "generated_at": generated_at.isoformat().replace("+00:00", "Z"),
        "valid_until": valid_until.isoformat().replace("+00:00", "Z"),
        "evidence_refs": [
            {
                "evidence_id": f"signal-evidence:{request_seed}:1",
                "artifact_id": f"signal-artifact:{request_seed}",
                "summary": fixture.evidence[0],
            }
        ],
    }


def fixed_input_cases(total: int = 100) -> tuple[FixedProposalInput, ...]:
    """Build a stable fixed-input matrix for schema and replay validation."""

    catalog = fixture_catalog()
    if total <= 0:
        return ()

    cases: list[FixedProposalInput] = []
    for index in range(total):
        fixture = catalog[index % len(catalog)]
        case_id = f"case-{index:03d}"
        signal_payload = build_signal_payload(
            fixture,
            request_seed=case_id,
            tenant_id="tenant-primary",
            workspace_id="workspace-primary",
            actor_id=f"actor-signal-{index:03d}",
        )
        cases.append(
            FixedProposalInput(
                case_id=case_id,
                fixture_name=fixture.fixture_name,
                account_id=f"paper-account-{index % 5}",
                policy_snapshot_id=f"{fixture.policy_snapshot_id}-{index:03d}",
                portfolio_snapshot_id=f"{fixture.portfolio_snapshot_id}-{index:03d}",
                signal_payload={
                    **signal_payload,
                    "diagnostics": {
                        "value": {
                            **signal_payload["diagnostics"]["value"],
                            "policy_snapshot_id": f"{fixture.policy_snapshot_id}-{index:03d}",
                        }
                    },
                },
                requested_tools=("query_signal", "query_artifact", "query_snapshot"),
            )
        )
    return tuple(cases)


def _generated_at(request_seed: str, fixture_name: str) -> datetime:
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    digest = hashlib.sha256(f"{request_seed}|{fixture_name}".encode("utf-8")).digest()
    offset_minutes = int.from_bytes(digest[:4], "big") % (366 * 24 * 60)
    return base + timedelta(minutes=offset_minutes)


def _signal_direction_name(direction: str) -> str:
    mapping = {
        "long": "SIGNAL_DIRECTION_LONG",
        "short": "SIGNAL_DIRECTION_SHORT",
        "flat": "SIGNAL_DIRECTION_FLAT",
    }
    try:
        return mapping[direction]
    except KeyError as error:
        raise ValueError(f"unsupported signal direction `{direction}`") from error
