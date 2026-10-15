"""Deterministic static analysis for generated strategy rule specs."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import re


SUPPORTED_RULES: frozenset[str] = frozenset({"momentum"})
FORBIDDEN_CONSTRUCTS: tuple[str, ...] = (
    "future",
    "lookahead",
    "look_ahead",
    "place_order",
    "submit_order",
    "cancel_order",
    "order",
    "secret",
    "credential",
    "requests",
    "urllib",
    "socket",
    "http",
    "deploy",
    "release",
    "venue",
    "exchange",
    "oms",
)

MAX_LOOKBACK = 500
MAX_THRESHOLD_BPS = 5_000


@dataclass(frozen=True)
class StaticCheckReport:
    """Outcome of static analysis over a generated rule spec."""

    passed: bool
    findings: tuple[str, ...]


def run_static_checks(rule: str, parameters: dict, rule_source: str) -> StaticCheckReport:
    """Run deterministic static checks; any finding blocks Release eligibility."""

    findings: list[str] = []

    if rule not in SUPPORTED_RULES:
        findings.append(f"unsupported_rule:{rule}")

    lookback = parameters.get("lookback")
    if not isinstance(lookback, int) or isinstance(lookback, bool):
        findings.append("invalid_lookback_type")
    elif not 1 <= lookback <= MAX_LOOKBACK:
        findings.append(f"lookback_out_of_range:{lookback}")

    for key in ("entry_threshold_bps", "exit_threshold_bps"):
        value = parameters.get(key)
        if not isinstance(value, int) or isinstance(value, bool):
            findings.append(f"invalid_{key}_type")
        elif abs(value) > MAX_THRESHOLD_BPS:
            findings.append(f"{key}_out_of_range:{value}")

    try:
        notional = Decimal(parameters.get("max_position_notional", ""))
        if not notional.is_finite() or not 0 < notional <= 1_000_000:
            findings.append("invalid_max_position_notional")
    except (InvalidOperation, TypeError, ValueError):
        findings.append("invalid_max_position_notional")
    universe = parameters.get("universe")
    if (
        not isinstance(universe, list)
        or not 1 <= len(universe) <= 100
        or any(not isinstance(s, str) or not re.fullmatch(r"[A-Z0-9]{2,24}", s) for s in universe)
        or len(set(universe)) != len(universe)
    ):
        findings.append("invalid_universe")
    # Only this declarative grammar is accepted. No Python/eval/plugin source executes.
    if rule_source != f"momentum(close, lookback={lookback})":
        findings.append("invalid_rule_source")
    normalized_source = rule_source.lower()
    for construct in FORBIDDEN_CONSTRUCTS:
        if construct in normalized_source:
            findings.append(f"forbidden_construct:{construct}")

    return StaticCheckReport(passed=not findings, findings=tuple(sorted(findings)))
