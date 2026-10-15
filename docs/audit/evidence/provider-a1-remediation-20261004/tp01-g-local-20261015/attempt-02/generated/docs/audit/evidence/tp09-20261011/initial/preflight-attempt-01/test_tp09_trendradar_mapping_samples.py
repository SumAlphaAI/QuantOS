"""Executable owned Signal mapping and denial tests; no external data or runtime."""

from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path

from google.protobuf.json_format import ParseDict
import pytest
from quantos.strategy.v1 import strategy_pb2

BASE = Path(__file__).resolve().parents[2] / "third_party/trendradar"
spec = importlib.util.spec_from_file_location(
    "tp09_experiments", BASE / "experiments.py"
)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@pytest.mark.parametrize("index", range(3))
def test_actual_signal_wire_round_trip(index):
    fixture = module.load_fixtures()[index]
    result = module.map_fixture(fixture)
    signal = ParseDict(result["signal"], strategy_pb2.Signal())
    raw = signal.SerializeToString(deterministic=True)
    assert result["wire_sha256"] == "sha256:" + hashlib.sha256(raw).hexdigest()
    replay = strategy_pb2.Signal.FromString(raw)
    assert replay.SerializeToString(deterministic=True) == raw
    assert result == module.map_fixture(deepcopy(fixture))
    diagnostics = result["signal"]["diagnostics"]["value"]
    assert diagnostics["trading_approved"] is False
    assert diagnostics["trade_executable"] is False
    assert diagnostics["strategy_release_resolved"] is False
    assert result["lineage"]["content_hash"] == module.digest(result["normalized"])
    assert result["lineage"]["schema_hash"] == module.digest(
        json.loads((BASE / "mappings/input-schema.json").read_text())
    )
    assert signal.valid_until.seconds - signal.generated_at.seconds == 900
    if index == 2:
        assert diagnostics["quality"]["reasons"] == [
            "missing_license",
            "missing_source",
        ]
        assert result["normalized"]["items"][0]["license_label"] is None
        assert result["normalized"]["items"][1]["source_id"] is None


@pytest.mark.parametrize("license_present", [False, True])
@pytest.mark.parametrize("source_present", [False, True])
def test_missing_metadata_matrix_is_computed_non_tradable(
    license_present, source_present
):
    items = deepcopy(module.load_fixtures()[0]["items"])
    if not license_present:
        items[0]["license_label"] = None
    if not source_present:
        items[0]["source_id"] = None
    expected = sorted(
        (["missing_license"] if not license_present else [])
        + (["missing_source"] if not source_present else [])
    )
    result = module.quality(items)
    assert result["reasons"] == expected
    assert result["status"] == ("degraded" if expected else "passed")
    assert result["trading_approved"] is result["trade_executable"] is False


@pytest.mark.parametrize(
    "usage,environment",
    [
        ("trading", "test"),
        ("strategy", "test"),
        ("research", "production"),
        ("research", "staging"),
    ],
)
def test_scope_denied_before_mapping(usage, environment):
    with pytest.raises(ValueError, match="TP09_USE_DENIED"):
        module.map_fixture(
            module.load_fixtures()[0], usage=usage, environment=environment
        )


@pytest.mark.parametrize(
    "key",
    [
        "order",
        "venue",
        "api_key",
        "access_token",
        "authorization",
        "credentials",
        "trading-approved",
        "trade_executable",
        "approved_for_production",
    ],
)
def test_recursive_authority_denied(key):
    fixture = deepcopy(module.load_fixtures()[0])
    fixture["items"][0]["nested"] = [{key: True}]
    with pytest.raises(ValueError, match="TP09_AUTHORITY_DENIED"):
        module.map_fixture(fixture)


def test_real_data_origin_denied():
    fixture = deepcopy(module.load_fixtures()[0])
    fixture["origin"] = "real_feed"
    with pytest.raises(ValueError, match="TP09_REAL_DATA_DENIED"):
        module.map_fixture(fixture)


@pytest.mark.parametrize(
    "mutation", ["source", "license", "title", "rank", "id", "class", "origin"]
)
def test_rehashed_self_assertions_cannot_register_new_fixture(mutation):
    fixture = deepcopy(module.load_fixtures()[0])
    if mutation in {"source", "license", "title", "rank"}:
        key = {"source": "source_id", "license": "license_label"}.get(
            mutation, mutation
        )
        fixture["items"][0][key] = "injected"
    else:
        fixture[
            {"id": "fixture_id", "class": "input_class", "origin": "origin"}[mutation]
        ] = "injected"
    fixture["fixture_hash"] = module.digest(
        {k: v for k, v in fixture.items() if k != "fixture_hash"}
    )
    with pytest.raises(
        ValueError, match="TP09_FIXTURE_NOT_REGISTERED|TP09_REAL_DATA_DENIED"
    ):
        module.map_fixture(fixture)


def test_changed_fixture_without_rehash_denied():
    fixture = deepcopy(module.load_fixtures()[0])
    fixture["items"][0]["rank"] = 99
    with pytest.raises(ValueError, match="TP09_FIXTURE_HASH"):
        module.map_fixture(fixture)


def test_stale_quality_is_diagnostic_and_non_tradable():
    items = deepcopy(module.load_fixtures()[0]["items"])
    items[0]["published_at"] = "2026-10-10T00:00:00Z"
    result = module.quality(items)
    assert result["reasons"] == ["stale_input"]
    assert result["max_age_seconds"] == "86400"
    assert result["trading_approved"] is False


@pytest.mark.parametrize(
    "stamp", ["2026-10-12T00:00:00Z", "2026-10-11T00:00:00", "malformed"]
)
def test_future_or_ambiguous_time_denied(stamp):
    items = deepcopy(module.load_fixtures()[0]["items"])
    items[0]["published_at"] = stamp
    with pytest.raises(ValueError):
        module.quality(items)


def test_empty_input_denied():
    with pytest.raises(ValueError, match="TP09_EMPTY"):
        module.quality([])


def test_execution_writes_every_referenced_object(tmp_path):
    receipt = module.run(tmp_path)
    assert receipt["syntheticMappings"] == receipt["nonTradable"] == 3
    assert len(receipt["files"]) == 9
    for item in receipt["files"]:
        value = json.loads((tmp_path / item["file"]).read_text())
        assert module.digest(value) == item["sha256"]
