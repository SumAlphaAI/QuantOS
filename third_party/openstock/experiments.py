"""QuantOS-owned, offline contract experiment; no upstream imports or data requests."""

from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path

from google.protobuf.json_format import MessageToDict, ParseDict
from quantos.research.v1 import research_pb2

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "third_party/openstock"
STAMP = "2026-10-11T00:00:00Z"
LICENSE = "quantos-owned-synthetic-test-only"
FILES = [
    "01-finnhub-quote-to-data-contract.json",
    "02-finnhub-news-and-widget-rejection.json",
    "03-tradingview-display-only.json",
]

TRUSTED_FIXTURES = {
    "tp11-quote": "sha256:ca85bb365b30bc9045240d21a08413858dfa40910a1e8c3524d62bf933ec6021",
    "tp11-news": "sha256:1fc6063881e5045712c0a16e1d611b672ff3de165df607ce6f99251411fea06d",
}


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
    return [json.loads((BASE / "fixtures" / name).read_text()) for name in FILES]


def deny_authority(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower().replace("-", "_") in {
                "api_key",
                "access_token",
                "secret",
                "authorization",
                "trading_approved",
                "approved_for_production",
                "order",
                "venue",
                "credentials",
            }:
                raise ValueError("TP11_AUTHORITY_DENIED")
            deny_authority(child)
    elif isinstance(value, list):
        for child in value:
            deny_authority(child)


def map_fixture(
    fixture: dict, *, usage: str = "research", environment: str = "test"
) -> dict:
    """License/use intake precedes every Artifact and DataSnapshot construction."""
    deny_authority(fixture)
    if usage != "research" or environment != "test":
        raise ValueError("TP11_USE_DENIED")
    if fixture.get("provider") != "finnhub" or fixture.get("kind") not in {
        "quote",
        "company_news",
    }:
        raise ValueError("TP11_PROVIDER_DENIED")
    if (
        fixture.get("origin") != "quantos_owned_synthetic"
        or fixture.get("data_license") != LICENSE
    ):
        raise ValueError("TP11_DATA_RIGHTS_DENIED")
    if fixture.get("fixture_hash") != digest(
        {k: v for k, v in fixture.items() if k != "fixture_hash"}
    ):
        raise ValueError("TP11_FIXTURE_HASH")
    records = fixture["records"]
    if not isinstance(records, list) or not records:
        raise ValueError("TP11_RECORDS")
    mapped = []
    required = (
        {"symbol", "c", "h", "l", "o", "pc", "t"}
        if fixture["kind"] == "quote"
        else {"symbol", "datetime", "headline", "source", "url"}
    )
    for record in records:
        if set(record) != required or any(
            not isinstance(v, str) or not v.strip() for v in record.values()
        ):
            raise ValueError("TP11_RECORD_SCHEMA")
        if fixture["kind"] == "quote":
            try:
                if any(
                    not Decimal(record[k]).is_finite()
                    for k in ["c", "h", "l", "o", "pc"]
                ):
                    raise ValueError("TP11_NUMERIC")
                if Decimal(record["l"]) > min(
                    Decimal(record[k]) for k in ["o", "c"]
                ) or Decimal(record["h"]) < max(Decimal(record[k]) for k in ["o", "c"]):
                    raise ValueError("TP11_OHLC")
                stamp = (
                    datetime.fromtimestamp(int(record["t"]), timezone.utc)
                    .isoformat()
                    .replace("+00:00", "Z")
                )
            except (InvalidOperation, OverflowError, OSError) as error:
                raise ValueError("TP11_NUMERIC") from error
            mapped.append(
                {
                    "symbol": record["symbol"],
                    "close": record["c"],
                    "high": record["h"],
                    "low": record["l"],
                    "open": record["o"],
                    "previous_close": record["pc"],
                    "ts": stamp,
                }
            )
        else:
            if not record["url"].startswith("https://example.invalid/"):
                raise ValueError("TP11_SYNTHETIC_URL")
            stamp = (
                datetime.fromtimestamp(int(record["datetime"]), timezone.utc)
                .isoformat()
                .replace("+00:00", "Z")
            )
            mapped.append(
                {
                    "symbol": record["symbol"],
                    "ts": stamp,
                    "headline": record["headline"],
                    "source": record["source"],
                    "url": record["url"],
                }
            )
    if any(r["symbol"] != "SYNTH-A" or r["ts"] > STAMP for r in mapped):
        raise ValueError("TP11_SCOPE_OR_TIME")
    age = int(
        (
            datetime.fromisoformat(STAMP.replace("Z", "+00:00"))
            - min(
                datetime.fromisoformat(r["ts"].replace("Z", "+00:00")) for r in mapped
            )
        ).total_seconds()
    )
    expected_quality = "degraded" if age > 900 else "passed"
    if (
        fixture["quality"]["status"] != expected_quality
        or fixture["quality"]["delay_seconds"] != age
    ):
        raise ValueError("TP11_QUALITY_MAPPING")
    fixture_id = fixture.get("fixture_id")
    if (
        not isinstance(fixture_id, str)
        or TRUSTED_FIXTURES.get(fixture_id) != fixture["fixture_hash"]
    ):
        raise ValueError("TP11_FIXTURE_NOT_REGISTERED")
    source = {
        "source_id": "quantos-synthetic-" + fixture["kind"],
        "provider": "quantos-offline-fixture",
        "dataset": "tp11.synthetic." + fixture["kind"],
        "license_label": LICENSE,
    }
    schema = json.loads((BASE / "fixtures/record-schemas.json").read_text())[
        fixture["kind"]
    ]
    normalized = {
        "fixture_hash": fixture["fixture_hash"],
        "records": mapped,
        "sources": [source],
        "data_license": LICENSE,
        "external_provider_reference": fixture["provider"],
        "upstream_runtime_loaded": False,
        "trading_approved": False,
        "approved_for_production": False,
    }
    lineage = {
        "fixture_hash": fixture["fixture_hash"],
        "schema_hash": digest(schema),
        "content_hash": digest(normalized),
        "sources": [source],
        "mapping": fixture["mapping"],
        "quality": fixture["quality"],
        "tp05_compatibility": "REQUIRES_PROVIDER_AND_RECORD_SCHEMA_EXTENSION",
    }
    artifact_refs = [
        {
            "artifact_id": "tp11-" + kind + ":" + digest(payload)[7:],
            "uri": "mock-artifact://tp11/" + kind + "/" + digest(payload)[7:] + ".json",
            "media_type": "application/json",
            "sha256": digest(payload),
            "classification": "DATA_CLASSIFICATION_INTERNAL",
        }
        for kind, payload in [("normalized", normalized), ("lineage", lineage)]
    ]
    snapshot = {
        "metadata": {
            "request_id": "tp11-offline-" + fixture["kind"],
            "tenant_id": "tp11-synthetic-tenant",
            "workspace_id": "tp11-synthetic-workspace",
            "actor": {
                "actor_id": "tp11-synthetic-user",
                "actor_kind": "ACTOR_KIND_USER",
                "capabilities": ["data.query.v1"],
            },
            "correlation_id": "tp11-offline",
            "causation_id": fixture["fixture_id"],
            "mode": "RUNTIME_MODE_RESEARCH",
            "environment": "ENVIRONMENT_TEST",
            "issued_at": STAMP,
        },
        "snapshot_id": "tp11:" + fixture["fixture_hash"][7:],
        "schema_version": "v1",
        "window": {
            "start_at": min(r["ts"] for r in mapped),
            "end_at": max(r["ts"] for r in mapped),
        },
        "sources": [source],
        "quality": "DATA_QUALITY_" + fixture["quality"]["status"].upper(),
        "content_hash": digest(normalized),
        "license_label": LICENSE,
        "captured_at": STAMP,
        "max_age": "3600s",
        "symbols": ["SYNTH-A"],
        "artifact_refs": artifact_refs,
    }
    wire = ParseDict(snapshot, research_pb2.DataSnapshot(), ignore_unknown_fields=False)
    raw = wire.SerializeToString(deterministic=True)
    replay = research_pb2.DataSnapshot.FromString(raw)
    assert replay.SerializeToString(deterministic=True) == raw
    return {
        "snapshot": MessageToDict(replay, preserving_proto_field_name=True),
        "normalized": normalized,
        "lineage": lineage,
        "wire_sha256": "sha256:" + hashlib.sha256(raw).hexdigest(),
    }


def run(output: Path) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    files = []
    mapped_count = 0
    denied_count = 0
    for fixture in load_fixtures():
        try:
            result = map_fixture(fixture)
        except ValueError as error:
            assert (
                fixture["provider"] == "tradingview-widget"
                and str(error) == "TP11_PROVIDER_DENIED"
            )
            result = {
                "snapshot": None,
                "artifacts": [],
                "reason": str(error),
                "provider": fixture["provider"],
                "quality": fixture["quality"],
                "source_hash": fixture["fixture_hash"],
            }
            denied_count += 1
        else:
            assert result == map_fixture(deepcopy(fixture))
            mapped_count += 1
        name = fixture["fixture_id"] + ".json"
        raw = canonical(result)
        (output / name).write_bytes(raw)
        files.append(
            {"file": name, "sha256": "sha256:" + hashlib.sha256(raw).hexdigest()}
        )
        if result["snapshot"] is not None:
            for key in ["normalized", "lineage"]:
                object_bytes = canonical(result[key])
                checksum = "sha256:" + hashlib.sha256(object_bytes).hexdigest()
                object_file = "objects/" + checksum[7:] + ".json"
                (output / "objects").mkdir(exist_ok=True)
                (output / object_file).write_bytes(object_bytes)
                files.append({"file": object_file, "sha256": checksum})
    receipt = {
        "schema": "quantos-tp11-offline-experiment/v1",
        "status": "PASS",
        "formalAccepted": False,
        "syntheticMappings": mapped_count,
        "displayOnlyDenied": denied_count,
        "replayIdentical": True,
        "upstreamExecuted": False,
        "files": files,
    }
    (output / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return receipt


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    print(json.dumps(run(parser.parse_args().output)))
