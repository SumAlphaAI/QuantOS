"""Executable reference-only mapping and pre-snapshot denial; no provider credentials."""

from __future__ import annotations

from copy import deepcopy
import importlib.util
import json
from pathlib import Path

from google.protobuf.json_format import ParseDict
from quantos.research.v1 import research_pb2
import pytest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "tp11_experiments", ROOT / "third_party/openstock/experiments.py"
)
assert SPEC and SPEC.loader
experiment = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(experiment)


@pytest.mark.parametrize("index", [0, 1])
def test_actual_typed_snapshot_lineage_bytes_and_replay(index):
    fixture = experiment.load_fixtures()[index]
    mapped = experiment.map_fixture(fixture)
    assert mapped == experiment.map_fixture(deepcopy(fixture))
    wire = ParseDict(mapped["snapshot"], research_pb2.DataSnapshot())
    assert wire.sources[0].license_label == experiment.LICENSE
    assert wire.license_label == experiment.LICENSE
    assert len(wire.artifact_refs) == 2
    assert wire.content_hash == experiment.digest(mapped["normalized"])
    assert wire.artifact_refs[0].sha256 == wire.content_hash
    assert wire.artifact_refs[1].sha256 == experiment.digest(mapped["lineage"])
    schemas = json.loads((experiment.BASE / "fixtures/record-schemas.json").read_text())
    assert mapped["lineage"]["schema_hash"] == experiment.digest(schemas[fixture["kind"]])
    assert mapped["normalized"]["records"][0]["symbol"] == "SYNTH-A"
    assert mapped["normalized"]["sources"][0]["provider"] == "quantos-offline-fixture"
    assert not mapped["normalized"]["approved_for_production"]


@pytest.mark.parametrize("usage", ["strategy", "trading", "evaluation", "unknown"])
@pytest.mark.parametrize("index", [0, 1, 2])
def test_nonresearch_intake_cannot_create_snapshot(index, usage):
    with pytest.raises(ValueError, match="TP11_USE_DENIED"):
        experiment.map_fixture(experiment.load_fixtures()[index], usage=usage)


@pytest.mark.parametrize("environment", ["production", "staging", "development", "unknown"])
def test_nontest_environment_cannot_create_snapshot(environment):
    with pytest.raises(ValueError, match="TP11_USE_DENIED"):
        experiment.map_fixture(experiment.load_fixtures()[0], environment=environment)


@pytest.mark.parametrize("index", [0, 1])
@pytest.mark.parametrize(
    "mutate,reason",
    [
        (lambda f: f.update(data_license=None), "TP11_DATA_RIGHTS_DENIED"),
        (
            lambda f: f.update(data_license="finnhub-free-attribution-research-only"),
            "TP11_DATA_RIGHTS_DENIED",
        ),
        (lambda f: f.update(origin="real_provider_data"), "TP11_DATA_RIGHTS_DENIED"),
        (lambda f: f.update(provider="adanos"), "TP11_PROVIDER_DENIED"),
        (lambda f: f.update(fixture_hash="sha256:" + "0" * 64), "TP11_FIXTURE_HASH"),
        (lambda f: f["records"][0].update(extra="unknown"), "TP11_RECORD_SCHEMA"),
        (lambda f: f["quality"].update(status="failed"), "TP11_QUALITY_MAPPING"),
        (lambda f: f.update(records=[]), "TP11_RECORDS"),
    ],
)
def test_unauthorized_or_corrupted_input_denied_before_artifacts(index, mutate, reason):
    fixture = experiment.load_fixtures()[index]
    mutate(fixture)
    if reason != "TP11_FIXTURE_HASH":
        fixture["fixture_hash"] = experiment.digest(
            {k: v for k, v in fixture.items() if k != "fixture_hash"}
        )
    with pytest.raises(ValueError, match=reason):
        experiment.map_fixture(fixture)


@pytest.mark.parametrize(
    "field",
    [
        "api_key",
        "credentials",
        "trading_approved",
        "approved_for_production",
        "order",
        "venue",
    ],
)
def test_recursive_authority_denied(field):
    fixture = experiment.load_fixtures()[0]
    fixture["records"][0]["nested"] = [{field: "forbidden"}]
    with pytest.raises(ValueError, match="TP11_AUTHORITY_DENIED"):
        experiment.map_fixture(fixture)


def test_widget_never_constructs_snapshot_or_artifacts():
    with pytest.raises(ValueError, match="TP11_PROVIDER_DENIED"):
        experiment.map_fixture(experiment.load_fixtures()[2])


def test_no_volume_or_price_fabrication_and_nonfinite_denial():
    fixture = experiment.load_fixtures()[0]
    result = experiment.map_fixture(fixture)
    assert "volume" not in result["normalized"]["records"][0]
    assert result["normalized"]["records"][0]["close"] == "101.25"
    fixture["records"][0]["c"] = "NaN"
    fixture["fixture_hash"] = experiment.digest(
        {k: v for k, v in fixture.items() if k != "fixture_hash"}
    )
    with pytest.raises(ValueError, match="TP11_NUMERIC"):
        experiment.map_fixture(fixture)


def test_output_denial_and_deterministic_bytes(tmp_path):
    result = experiment.run(tmp_path)
    assert result["syntheticMappings"] == 2 and result["displayOnlyDenied"] == 1
    widget = json.loads((tmp_path / "tp11-widget.json").read_text())
    assert widget["snapshot"] is None and widget["artifacts"] == []
    first = {f["file"]: (tmp_path / f["file"]).read_bytes() for f in result["files"]}
    assert result == experiment.run(tmp_path)
    assert all((tmp_path / name).read_bytes() == raw for name, raw in first.items())


@pytest.mark.parametrize("index", [0, 1])
def test_relabelled_self_hashed_arbitrary_data_is_not_registered(index):
    fixture = experiment.load_fixtures()[index]
    if index == 0:
        fixture["records"][0]["c"] = "101.30"
    else:
        fixture["records"][0]["headline"] = "Unregistered provider data disguised as synthetic"
    fixture["fixture_hash"] = experiment.digest(
        {k: v for k, v in fixture.items() if k != "fixture_hash"}
    )
    with pytest.raises(ValueError, match="TP11_FIXTURE_NOT_REGISTERED"):
        experiment.map_fixture(fixture)
