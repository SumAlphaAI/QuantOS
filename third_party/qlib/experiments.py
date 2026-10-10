"""QuantOS-owned offline reference experiments. Never imports or executes Qlib."""

from __future__ import annotations

import argparse
from copy import deepcopy
from decimal import Decimal, ROUND_HALF_EVEN
import hashlib
import json
from pathlib import Path

from google.protobuf.json_format import MessageToDict, ParseDict
from quantos.research.v1 import research_pb2

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "third_party/qlib"
PIN = "d5379c520f66a39953bad76234a7019a72796fd0"
STAMP = "2026-10-10T00:00:00Z"
SCOPE = {
    "tenant_id": "tp08-tenant",
    "workspace_id": "tp08-workspace",
    "actor_id": "tp08-actor",
}


def canonical(value) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def digest(raw: bytes) -> str:
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def decimal(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.00000001"), rounding=ROUND_HALF_EVEN))


class ReferenceStore:
    """Local immutable bytes, scoped reads and content dedup; no F05 storage claim."""

    def __init__(self):
        self.objects: dict[tuple[str, str, str, str], bytes] = {}

    def put(self, scope: dict, kind: str, payload: dict) -> dict:
        raw = canonical(payload)
        checksum = digest(raw)
        artifact_id = "tp08:" + kind + ":" + checksum[7:]
        owner = tuple(scope[k] for k in SCOPE)
        key = (*owner, artifact_id)
        if key in self.objects and self.objects[key] != raw:
            raise ValueError("TP08_IMMUTABLE")
        self.objects[key] = raw
        return {
            "artifact_id": artifact_id,
            "uri": "mock-artifact://tp08/" + kind + "/" + checksum[7:] + ".json",
            "media_type": "application/json",
            "sha256": checksum,
            "classification": "DATA_CLASSIFICATION_INTERNAL",
        }

    def read(self, scope: dict, artifact_id: str) -> bytes:
        key = (*(scope[k] for k in SCOPE), artifact_id)
        if key not in self.objects:
            raise PermissionError("TP08_ARTIFACT_UNAVAILABLE")
        return self.objects[key]


def metadata(scope: dict) -> dict:
    return {
        "request_id": "tp08-offline-request",
        "tenant_id": scope["tenant_id"],
        "workspace_id": scope["workspace_id"],
        "actor": {
            "actor_id": scope["actor_id"],
            "actor_kind": "ACTOR_KIND_USER",
            "capabilities": ["research.experiment.v1"],
        },
        "correlation_id": "tp08-reference-correlation",
        "causation_id": "tp08-offline-fixture",
        "mode": "RUNTIME_MODE_RESEARCH",
        "environment": "ENVIRONMENT_TEST",
        "issued_at": STAMP,
    }


def typed(payload: dict, message) -> dict:
    return MessageToDict(
        ParseDict(payload, message, ignore_unknown_fields=False),
        preserving_proto_field_name=True,
    )


def validate_input(fixture: dict, scope: dict, mode: str, environment: str):
    if mode != "research" or environment != "test":
        raise PermissionError("TP08_REFERENCE_ONLY")
    if set(scope) != set(SCOPE) or any(
        not isinstance(v, str) or not v.strip() or len(v) > 128 for v in scope.values()
    ):
        raise ValueError("TP08_SCOPE_INVALID")
    if set(fixture) != {"dataset", "license", "symbols", "rows"}:
        raise ValueError("TP08_INPUT_CLOSED")
    if (
        fixture["dataset"] != "quantos-synthetic-tp08/v1"
        or fixture["license"] != "synthetic-test-only"
    ):
        raise PermissionError("TP08_DATA_LICENSE_DENIED")
    symbols = fixture["symbols"]
    if (
        symbols != ["SYN_A", "SYN_B", "SYN_C"]
        or not isinstance(fixture["rows"], list)
        or len(fixture["rows"]) != 36
        or any(not isinstance(r, dict) for r in fixture["rows"])
    ):
        raise ValueError("TP08_DATASET_INVALID")
    for symbol in symbols:
        rows = [r for r in fixture["rows"] if r.get("symbol") == symbol]
        if len(rows) != 12 or [r.get("day") for r in rows] != list(range(1, 13)):
            raise ValueError("TP08_CALENDAR_INVALID")
        for row in rows:
            if set(row) != {"symbol", "day", "close", "volume"}:
                raise ValueError("TP08_ROW_CLOSED")
            if any(
                type(row[k]) is not int or not 0 < row[k] <= 1_000_000
                for k in ["close", "volume"]
            ):
                raise ValueError("TP08_VALUE_INVALID")


def evaluate(
    fixture: dict,
    *,
    scope: dict | None = None,
    store: ReferenceStore | None = None,
    mode: str = "research",
    environment: str = "test",
) -> tuple[list[dict], ReferenceStore]:
    scope = deepcopy(SCOPE if scope is None else scope)
    fixture = deepcopy(fixture)
    validate_input(fixture, scope, mode, environment)
    store = ReferenceStore() if store is None else store
    input_hash = digest(
        canonical(
            {
                "fixture": fixture,
                "scope": scope,
                "mode": mode,
                "environment": environment,
                "reference_pin": PIN,
            }
        )
    )
    features: list[dict] = []
    labels: list[Decimal] = []
    for symbol in fixture["symbols"]:
        rows = [r for r in fixture["rows"] if r["symbol"] == symbol]
        for i in range(4, 12):
            mean = sum(
                (Decimal(r["close"]) for r in rows[i - 4 : i + 1]), Decimal(0)
            ) / Decimal(5)
            features.append(
                {
                    "symbol": symbol,
                    "day": i + 1,
                    "mean5": decimal(mean),
                    "return1": decimal(
                        Decimal(rows[i]["close"]) / rows[i - 1]["close"] - 1
                    ),
                }
            )
            if i < 11:
                labels.append(Decimal(rows[i + 1]["close"]) / rows[i]["close"] - 1)
    common = {
        "scope": scope,
        "input_hash": input_hash,
        "software_reference": PIN,
        "data_license": fixture["license"],
        "trading_approved": False,
        "upstream_runtime_loaded": False,
    }
    data_ref = store.put(scope, "features", {**common, "records": features})
    snapshot = typed(
        {
            "metadata": metadata(scope),
            "snapshot_id": "tp08-snapshot:" + input_hash[7:],
            "schema_version": "v1",
            "window": {
                "start_at": "2020-01-05T00:00:00Z",
                "end_at": "2020-01-12T00:00:00Z",
            },
            "sources": [
                {
                    "source_id": "quantos-synthetic-tp08",
                    "provider": "quantos-offline-fixture",
                    "dataset": fixture["dataset"],
                    "license_label": fixture["license"],
                }
            ],
            "quality": "DATA_QUALITY_PASSED",
            "content_hash": data_ref["sha256"],
            "license_label": fixture["license"],
            "captured_at": STAMP,
            "max_age": "0s",
            "symbols": fixture["symbols"],
            "artifact_refs": [data_ref],
        },
        research_pb2.DataSnapshot(),
    )
    config = {
        **common,
        "inspiration": "Qlib Alpha158 handler and qrun config",
        "implementation": "QuantOS mean5/return1 subset and zero-return baseline",
        "feature_count": 2,
        "full_alpha158_executed": False,
        "lightgbm_executed": False,
        "mlflow_executed": False,
        "training_executed": False,
    }
    config_ref = store.put(scope, "config", config)
    metrics_ref = store.put(
        scope,
        "metrics",
        {
            **common,
            "samples": len(labels),
            "baseline": "zero-return",
            "mean_absolute_error": decimal(
                sum((abs(v) for v in labels), Decimal(0)) / Decimal(len(labels))
            ),
            "claim": "synthetic baseline diagnostic; no trained model or investment result",
        },
    )
    refs = [config_ref, metrics_ref]
    result_hash = digest(canonical(refs))
    artifact = typed(
        {
            "metadata": metadata(scope),
            "artifact_id": "tp08-research:" + result_hash[7:],
            "title": "Qlib-inspired offline reference mapping",
            "hypothesis": "Closed experiment config and evidence can map to owned contracts",
            "summary": "Synthetic mean5/return1 and zero-return baseline; no Qlib, Alpha158 training, LightGBM or MLflow executed",
            "content_hash": result_hash,
            "engine_version": "tp08-reference/v1",
            "prompt_version": "not-applicable",
            "code_version": digest(Path(__file__).read_bytes()),
            "environment_hash": digest(
                canonical(
                    {
                        "contract": "v1",
                        "python": "3.12",
                        "workspace_lock": digest(
                            (ROOT / "engines/uv.lock").read_bytes()
                        ),
                    }
                )
            ),
            "data_snapshot_id": snapshot["snapshot_id"],
            "evidence_refs": [
                {
                    "evidence_id": "tp08-evidence:" + r["artifact_id"],
                    "artifact_id": r["artifact_id"],
                    "summary": "Actual local synthetic experiment bytes",
                }
                for r in refs
            ],
            "attachments": refs,
            "created_at": STAMP,
            "audit_tags": {"values": ["reference_only", "synthetic", "research_only"]},
        },
        research_pb2.ResearchArtifact(),
    )
    replay = {
        "schema": "quantos-tp08-offline-replay/v1",
        **common,
        "idempotency_key": "tp08-replay:" + input_hash[7:],
        "artifact_refs": [data_ref, *refs],
        "runtime_executed": False,
        "storage_uploaded": False,
        "physical_object_count": sum(
            k[:3] == tuple(scope[x] for x in SCOPE) for k in store.objects
        ),
    }
    docs = []
    for name, payload in [
        ("01-alpha158-to-datasnapshot", {"quantos_data_snapshot": snapshot}),
        (
            "02-lightgbm-experiment-to-research-artifact",
            {"quantos_research_artifact": artifact},
        ),
        ("03-workflow-replay-to-runtime-run", {"offline_replay": replay}),
    ]:
        doc = {
            "mapping_id": name,
            "source_commit": PIN,
            "disposition": "reference_only",
            **common,
            **payload,
        }
        doc["content_hash"] = digest(canonical(doc))
        docs.append(doc)
    return docs, store


def run(output: Path) -> dict:
    fixture = json.loads((BASE / "fixture.json").read_text())
    docs, store = evaluate(fixture)
    again, _ = evaluate(fixture, store=store)
    assert docs == again and len(store.objects) == 3
    output.mkdir(parents=True, exist_ok=True)
    files = []
    for doc in docs:
        name = doc["mapping_id"] + ".json"
        raw = canonical(doc)
        (output / name).write_bytes(raw)
        files.append({"file": name, "sha256": digest(raw)})
    for (_, _, _, artifact_id), raw in store.objects.items():
        name = "objects/" + artifact_id.replace(":", "-") + ".json"
        (output / name).parent.mkdir(exist_ok=True)
        (output / name).write_bytes(raw)
        files.append({"file": name, "sha256": digest(raw)})
    receipt = {
        "schema": "quantos-tp08-experiments/v1",
        "status": "PASS",
        "formalAccepted": False,
        "disposition": "reference_only",
        "source_commit": PIN,
        "mappingCount": 3,
        "featureRows": 24,
        "metricSamples": 21,
        "replayIdentical": True,
        "physicalObjects": 3,
        "upstreamRuntime": False,
        "databaseExecuted": False,
        "files": files,
    }
    (output / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return receipt


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    print(json.dumps(run(parser.parse_args().output)))
