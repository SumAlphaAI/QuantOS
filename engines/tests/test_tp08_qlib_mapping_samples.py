"""Execute three offline reference mappings and probe rejected inputs/byte evidence."""

from copy import deepcopy
import importlib.util
import json
from pathlib import Path

from google.protobuf.json_format import ParseDict
import pytest
from quantos.research.v1 import research_pb2

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "tp08_reference", ROOT / "third_party/qlib/experiments.py"
)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)
FIXTURE = json.loads((ROOT / "third_party/qlib/fixture.json").read_text())


def test_three_experiments_are_executed_with_real_byte_hashes():
    docs, store = module.evaluate(FIXTURE)
    snapshot = docs[0]["quantos_data_snapshot"]
    research = docs[1]["quantos_research_artifact"]
    ParseDict(snapshot, research_pb2.DataSnapshot(), ignore_unknown_fields=False)
    ParseDict(research, research_pb2.ResearchArtifact(), ignore_unknown_fields=False)
    assert research["data_snapshot_id"] == snapshot["snapshot_id"]
    assert research["code_version"] == module.digest(
        (ROOT / "third_party/qlib/experiments.py").read_bytes()
    )
    for doc in docs:
        assert doc["content_hash"] == module.digest(
            module.canonical({k: v for k, v in doc.items() if k != "content_hash"})
        )
        assert doc["trading_approved"] is False and doc["upstream_runtime_loaded"] is False
    refs = docs[2]["offline_replay"]["artifact_refs"]
    assert len(refs) == 3 and len(store.objects) == 3
    for ref in refs:
        assert module.digest(store.read(module.SCOPE, ref["artifact_id"])) == ref["sha256"]
    assert {r["artifact_id"] for r in research["evidence_refs"]} == {
        r["artifact_id"] for r in research["attachments"]
    }
    features = json.loads(store.read(module.SCOPE, refs[0]["artifact_id"]))["records"]
    assert len(features) == 24 and features[0] == {
        "symbol": "SYN_A",
        "day": 5,
        "mean5": "102.60000000",
        "return1": "0.01923077",
    }
    metrics = json.loads(store.read(module.SCOPE, refs[2]["artifact_id"]))
    assert metrics["samples"] == 21 and metrics["baseline"] == "zero-return"
    assert metrics["mean_absolute_error"] == "0.02485689"


def test_replay_is_byte_identical_and_deduplicated():
    docs, store = module.evaluate(FIXTURE)
    again, _ = module.evaluate(FIXTURE, store=store)
    assert docs == again and len(store.objects) == 3


@pytest.mark.parametrize("field", list(module.SCOPE))
def test_cross_scope_reads_and_dedup_are_isolated(field):
    docs, store = module.evaluate(FIXTURE)
    foreign = {**module.SCOPE, field: "foreign-研究"}
    with pytest.raises(PermissionError):
        store.read(foreign, docs[2]["offline_replay"]["artifact_refs"][0]["artifact_id"])
    other, _ = module.evaluate(FIXTURE, scope=foreign, store=store)
    assert other[0]["input_hash"] != docs[0]["input_hash"] and len(store.objects) == 6
    assert other[2]["offline_replay"]["physical_object_count"] == 3


@pytest.mark.parametrize("mode", ["paper", "shadow", "assisted_live", "guarded_live", True, None])
def test_trading_modes_are_denied_before_writes(mode):
    store = module.ReferenceStore()
    with pytest.raises(PermissionError):
        module.evaluate(FIXTURE, mode=mode, store=store)
    assert not store.objects


@pytest.mark.parametrize("environment", ["production", "staging", "local", True, None])
def test_non_test_environments_are_denied(environment):
    with pytest.raises(PermissionError):
        module.evaluate(FIXTURE, environment=environment)


@pytest.mark.parametrize(
    "field",
    [
        "tools",
        "order",
        "secret_ref",
        "tenant_id",
        "network_access",
        "approved_for_production",
        "executable",
    ],
)
def test_input_is_closed_without_tools_or_authority(field):
    value = {**FIXTURE, field: "denied"}
    with pytest.raises(ValueError):
        module.evaluate(value)


@pytest.mark.parametrize(
    "mutation",
    [
        "license",
        "dataset",
        "calendar",
        "symbol",
        "missing",
        "negative",
        "bool",
        "nan",
        "infinity",
        "row-extra",
    ],
)
def test_unlicensed_or_malformed_rows_are_denied(mutation):
    value = deepcopy(FIXTURE)
    if mutation in ["license", "dataset"]:
        value[mutation] = "external-unlicensed"
    elif mutation == "calendar":
        value["rows"][0]["day"] = 12
    elif mutation == "symbol":
        value["symbols"][0] = "real-symbol"
    elif mutation == "missing":
        value["rows"].pop()
    elif mutation == "row-extra":
        value["rows"][0]["secret_ref"] = "denied"
    else:
        value["rows"][0]["close"] = {
            "negative": -1,
            "bool": True,
            "nan": float("nan"),
            "infinity": float("inf"),
        }[mutation]
    store = module.ReferenceStore()
    with pytest.raises((ValueError, PermissionError)):
        module.evaluate(value, store=store)
    assert not store.objects


@pytest.mark.parametrize("value", ["", " ", None, True, "x" * 129])
def test_scope_validation(value):
    with pytest.raises(ValueError):
        module.evaluate(FIXTURE, scope={**module.SCOPE, "tenant_id": value})


def test_future_rows_do_not_change_prior_features():
    docs, store = module.evaluate(FIXTURE)
    changed = deepcopy(FIXTURE)
    changed["rows"][11]["close"] += 100
    other, other_store = module.evaluate(changed)

    def rows(ds, s):
        return json.loads(
            s.read(module.SCOPE, ds[2]["offline_replay"]["artifact_refs"][0]["artifact_id"])
        )["records"]

    assert [r for r in rows(docs, store) if r["day"] < 12] == [
        r for r in rows(other, other_store) if r["day"] < 12
    ]


def test_cli_generated_samples_match_tracked_bytes(tmp_path):
    receipt = module.run(tmp_path)
    assert receipt["replayIdentical"] and receipt["mappingCount"] == 3
    for entry in receipt["files"]:
        raw = (tmp_path / entry["file"]).read_bytes()
        assert module.digest(raw) == entry["sha256"]
        assert raw == (ROOT / "third_party/qlib/mappings" / entry["file"]).read_bytes()
