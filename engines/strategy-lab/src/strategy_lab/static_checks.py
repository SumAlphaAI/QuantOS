"""Deterministic static analysis for generated strategy rule specs."""

from __future__ import annotations

from dataclasses import dataclass


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

    normalized_source = rule_source.lower()
    for construct in FORBIDDEN_CONSTRUCTS:
        if construct in normalized_source:
            findings.append(f"forbidden_construct:{construct}")

    return StaticCheckReport(passed=not findings, findings=tuple(sorted(findings)))
