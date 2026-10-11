"""QuantOS-owned synthetic trend evaluation; no upstream code, tools or data requests."""

from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

from google.protobuf.json_format import MessageToDict, ParseDict
from quantos.strategy.v1 import strategy_pb2

BASE = Path(__file__).resolve().parent
STAMP = "2026-10-11T00:00:00Z"
LICENSE = "quantos-owned-synthetic-test-only"
FILES = [
    "01-hotlist-theme-to-signal.json",
    "02-rss-theme-to-signal.json",
    "03-missing-license-non-tradable.json",
]


def canonical(value) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode()


def digest(value) -> str:
    return "sha256:" + hashlib.sha256(canonical(value)).hexdigest()


def load_fixtures() -> list[dict]:
    return [json.loads((BASE / "mappings" / name).read_text()) for name in FILES]


def deny_authority(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower().replace("-", "_") in {
                "secret",
                "api_key",
                "token",
                "access_token",
                "authorization",
                "credentials",
                "order",
                "venue",
                "trading_approved",
                "approved_for_production",
                "trade_executable",
            }:
                raise ValueError("TP09_AUTHORITY_DENIED")
            deny_authority(child)
    elif isinstance(value, list):
        for child in value:
            deny_authority(child)


def quality(items: list[dict]) -> dict:
    """Missing attribution and rights stay missing; no fabricated provider claims."""
    if not items:
        raise ValueError("TP09_EMPTY")
    reasons = set()
    ages = []
    for item in items:
        if item.get("license_label") != LICENSE:
            reasons.add("missing_license")
        if not item.get("source_id") or not (item.get("url") or "").startswith(
            "https://example.invalid/"
        ):
            reasons.add("missing_source")
        stamp = datetime.fromisoformat(item["published_at"].replace("Z", "+00:00"))
        if stamp.tzinfo is None or stamp.utcoffset() != timezone.utc.utcoffset(stamp):
            raise ValueError("TP09_TIME")
        age = int(
            (
                datetime.fromisoformat(STAMP.replace("Z", "+00:00")) - stamp
            ).total_seconds()
        )
        if age < 0:
            raise ValueError("TP09_FUTURE")
        if age > 900:
            reasons.add("stale_input")
        ages.append(age)
    return {
        "status": "degraded" if reasons else "passed",
        "reasons": sorted(reasons),
        "max_age_seconds": str(max(ages)),
        "trading_approved": False,
        "trade_executable": False,
    }


def map_fixture(fixture: dict, *, usage="research", environment="test") -> dict:
    deny_authority(fixture)
    if usage != "research" or environment != "test":
        raise ValueError("TP09_USE_DENIED")
    if fixture.get("origin") != "quantos_owned_synthetic":
        raise ValueError("TP09_REAL_DATA_DENIED")
    body = {k: v for k, v in fixture.items() if k != "fixture_hash"}
    if fixture.get("fixture_hash") != digest(body):
        raise ValueError("TP09_FIXTURE_HASH")
    registry = json.loads((BASE / "mappings/registry.json").read_text())
    if registry.get(fixture.get("fixture_id")) != fixture["fixture_hash"]:
        raise ValueError("TP09_FIXTURE_NOT_REGISTERED")
    items = fixture["items"]
    if fixture["input_class"] not in {"hot_list_aggregation", "rss_feed"}:
        raise ValueError("TP09_CLASS")
    if any(
        not isinstance(item.get("rank"), int)
        or isinstance(item["rank"], bool)
        or not 1 <= item["rank"] <= 100
        for item in items
    ):
        raise ValueError("TP09_RANK")
    assessment = quality(items)
    normalized = {
        "fixture_hash": fixture["fixture_hash"],
        "input_class": fixture["input_class"],
        "theme": fixture["theme"],
        "items": deepcopy(items),
        "attention": {
            "item_count": str(len(items)),
            "best_rank": str(min(i["rank"] for i in items)),
        },
        "quality": assessment,
    }
    lineage = {
        "fixture_hash": fixture["fixture_hash"],
        "content_hash": digest(normalized),
        "schema_hash": digest(
            json.loads((BASE / "mappings/input-schema.json").read_text())
        ),
        "sources": [
            {k: i.get(k) for k in ["source_id", "url", "guid", "license_label"]}
            for i in items
        ],
        "algorithm": "quantos-owned-attention-count-and-min-rank/v1",
        "upstream_algorithm_reproduced": False,
    }
    refs = [
        {
            "evidence_id": "tp09-" + kind,
            "artifact_id": "tp09-" + kind + ":" + digest(payload)[7:],
            "summary": "Owned synthetic "
            + kind
            + "; physical bytes in experiment objects/",
        }
        for kind, payload in [("normalized", normalized), ("lineage", lineage)]
    ]
    diagnostics = {
        "trading_approved": False,
        "trade_executable": False,
        "approved_for_production": False,
        "upstream_runtime_loaded": False,
        "strategy_release_resolved": False,
        "feature_snapshot_resolved": False,
        "quality": assessment,
        "provenance": lineage,
        "diagnostics_tags": ["research_only", "not_tradable", *assessment["reasons"]],
        "model_version": "owned-attention-v1",
        "data_version": fixture["fixture_hash"],
        "strategy_version": "owned-reference-unresolved-v1",
        "model_digest_scope": "fixture_definition_not_weights",
    }
    signal = {
        "metadata": {
            "request_id": fixture["fixture_id"],
            "tenant_id": "tp09-synthetic-tenant",
            "workspace_id": "tp09-synthetic-workspace",
            "actor": {
                "actor_id": "tp09-synthetic-user",
                "actor_kind": "ACTOR_KIND_USER",
                "capabilities": ["quant.signal.v1"],
            },
            "correlation_id": "tp09-offline",
            "causation_id": fixture["fixture_hash"],
            "mode": "RUNTIME_MODE_RESEARCH",
            "environment": "ENVIRONMENT_TEST",
            "issued_at": STAMP,
        },
        "signal_id": "tp09:" + fixture["fixture_hash"][7:],
        "strategy_release_id": "tp09-unresolved-offline-reference",
        "symbol": "SYNTH-THEME",
        "direction": "SIGNAL_DIRECTION_FLAT",
        "strength": {"value": "0"},
        "confidence": {"value": "0" if assessment["reasons"] else "0.5"},
        "diagnostics": {"value": diagnostics},
        "generated_at": STAMP,
        "valid_until": "2026-10-11T00:15:00Z",
        "evidence_refs": refs,
    }
    wire = ParseDict(signal, strategy_pb2.Signal(), ignore_unknown_fields=False)
    raw = wire.SerializeToString(deterministic=True)
    replay = strategy_pb2.Signal.FromString(raw)
    assert raw == replay.SerializeToString(deterministic=True)
    return {
        "signal": MessageToDict(replay, preserving_proto_field_name=True),
        "normalized": normalized,
        "lineage": lineage,
        "wire_sha256": "sha256:" + hashlib.sha256(raw).hexdigest(),
    }


def run(output: Path) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    files = []
    for fixture in load_fixtures():
        result = map_fixture(fixture)
        assert result == map_fixture(deepcopy(fixture))
        for name, value in [
            (fixture["fixture_id"] + ".json", result),
            *[
                ("objects/" + digest(result[k])[7:] + ".json", result[k])
                for k in ["normalized", "lineage"]
            ],
        ]:
            raw = canonical(value)
            path = output / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
            files.append(
                {"file": name, "sha256": "sha256:" + hashlib.sha256(raw).hexdigest()}
            )
    receipt = {
        "schema": "quantos-tp09-offline-experiment/v1",
        "status": "PASS",
        "formalAccepted": False,
        "syntheticMappings": 3,
        "nonTradable": 3,
        "upstreamExecuted": False,
        "replayIdentical": True,
        "files": files,
    }
    (output / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return receipt


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    print(json.dumps(run(parser.parse_args().output)))
