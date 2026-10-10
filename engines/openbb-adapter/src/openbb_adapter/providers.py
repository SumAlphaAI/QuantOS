"""QuantOS-owned fixture providers; no OpenBB runtime or tools are loaded."""

from __future__ import annotations

from collections import OrderedDict
from copy import deepcopy
from dataclasses import asdict, dataclass, field
import hashlib
import json
from threading import Lock
from pathlib import Path
import time
from typing import Callable, Protocol
from openbb_adapter.adapter import DataQueryExecutionContext as DataQueryContext
from openbb_adapter.fixtures import QueryFixture, load_fixture
from openbb_adapter.license_gate import LicenseGateDecision


def canonical_bytes(value: dict) -> bytes:
    def wire_numbers(item):
        # Protobuf Struct reads JSON numbers as doubles. Canonicalize integral values
        # so the response hash survives its actual JSON-document wire round trip.
        if isinstance(item, dict):
            return {k: wire_numbers(v) for k, v in item.items()}
        if isinstance(item, (tuple, list)):
            return [wire_numbers(v) for v in item]
        if isinstance(item, float) and item.is_integer():
            return int(item)
        return item

    return json.dumps(
        wire_numbers(value), sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode()


def content_hash(value: dict) -> str:
    return "sha256:" + hashlib.sha256(canonical_bytes(value)).hexdigest()


def record_schema(schema_ref: str) -> dict:
    schemas = json.loads(
        (Path(__file__).with_name("contracts") / "record-schemas.v1.json").read_text()
    )
    return schemas[schema_ref]


@dataclass(frozen=True)
class ProviderResult:
    payload: dict
    normalized_artifact: dict
    lineage_artifact: dict
    stream_events: tuple[dict, ...]


class DataQueryProvider(Protocol):
    provider_name: str

    def resolve(self, context: DataQueryContext) -> ProviderResult: ...


@dataclass
class MockDataQueryProvider:
    provider_name: str = "mock"
    decision: LicenseGateDecision | None = None
    max_entries: int = 128
    clock: Callable[[], float] = time.monotonic
    _cache: OrderedDict[str, tuple[float, ProviderResult]] = field(default_factory=OrderedDict)
    _lock: Lock = field(default_factory=Lock)

    def _cache_key(self, context: DataQueryContext, fixture: QueryFixture) -> str:
        return content_hash(
            {
                "context": asdict(context),
                "fixture_digest": fixture.fixture_digest,
                "license_policy": asdict(self.decision) if self.decision else None,
            }
        )

    def resolve(self, context: DataQueryContext) -> ProviderResult:
        # Gate precedes every lookup, including hits; no cached permission bypass.
        if context.provider_name != self.provider_name:
            raise ValueError("ENGINE_PROVIDER_MISMATCH")
        if self.decision:
            self.decision.ensure_runtime_allowed(
                provider_name=self.provider_name,
                deployment_target=context.deployment_target,
                dataset=context.dataset,
            )
        if context.intended_use not in {
            "research",
            "evaluation",
        } or context.deployment_target not in {"test", "evaluation"}:
            raise ValueError("ENGINE_USE_DENIED")
        fixture = load_fixture(context.fixture_name)
        key = self._cache_key(context, fixture)
        with self._lock:
            now = self.clock()
            for expired in [k for k, (until, _) in self._cache.items() if until <= now]:
                del self._cache[expired]
            if key in self._cache:
                self._cache.move_to_end(key)
                return deepcopy(self._cache[key][1])
            result = _build_result(context, fixture, key=key, decision=self.decision)
            self._cache[key] = (now + fixture.cache_ttl_secs, deepcopy(result))
            while len(self._cache) > self.max_entries:
                self._cache.popitem(last=False)
            return result


@dataclass
class OpenBBEvaluationProvider(MockDataQueryProvider):
    provider_name: str = "openbb"
    decision: LicenseGateDecision | None = field(default_factory=LicenseGateDecision.load_default)


def default_provider_registry() -> dict[str, DataQueryProvider]:
    return {"mock": MockDataQueryProvider(), "openbb": OpenBBEvaluationProvider()}


def _build_result(
    context: DataQueryContext,
    fixture: QueryFixture,
    *,
    key: str,
    decision: LicenseGateDecision | None,
) -> ProviderResult:
    label = "internal-test-only" if decision is None else decision.license_label
    # Software license and dataset rights are separate. No external data rights are granted.
    sources = [
        {
            "source_id": "fixture:" + s.source_id,
            "provider": context.provider_name,
            "dataset": s.dataset,
            "license_label": label,
            "data_license": "synthetic-fixture-only",
        }
        for s in fixture.sources
    ]
    scope = {
        "tenant_id": context.tenant_id,
        "workspace_id": context.workspace_id,
        "actor_id": context.actor_id,
        "workflow_run_id": context.workflow_run_id,
    }
    common = {
        "provider": context.provider_name,
        "dataset": context.dataset,
        "schema_ref": context.schema_ref,
        "scope": scope,
        "fixture_digest": fixture.fixture_digest,
        "input_hash": context.input_hash,
        "metadata_hash": context.metadata_hash,
        "upstream_runtime_loaded": False,
        "tools_executed": False,
        "trading_approved": False,
        "approved_for_production": False,
    }
    normalized = {
        **common,
        "artifact_type": "NormalizedDataQueryArtifact",
        "artifact_id": "normalized-data:" + key[7:],
        "window": deepcopy(fixture.window),
        "records": deepcopy(list(fixture.records)),
    }
    normalized_hash = content_hash(normalized)
    lineage = {
        **common,
        "artifact_type": "DataLineageArtifact",
        "artifact_id": "data-lineage:" + key[7:],
        "sources": sources,
        "license_label": label,
        "data_license": "synthetic-fixture-only",
        "content_hash": normalized_hash,
        "schema_hash": content_hash(record_schema(context.schema_ref)),
        "lineage_tags": list(fixture.lineage_tags),
        "upstream_repo": None if decision is None else decision.upstream_repo,
        "upstream_ref": None if decision is None else decision.upstream_ref,
    }
    response = {
        "response_type": "DataQueryResponse",
        "contract_version": "v1",
        "provider": context.provider_name,
        "query_id": "query:" + key[7:],
        "dataset": context.dataset,
        "schema_ref": context.schema_ref,
        "scope": scope,
        "query_text": context.query_text,
        "symbols": list(context.symbols),
        "window": deepcopy(fixture.window),
        "records": deepcopy(list(fixture.records)),
        "sources": deepcopy(sources),
        "license": {
            "label": label,
            "data_license": "synthetic-fixture-only",
            "status": "mock_only" if decision is None else decision.status,
            "approved_for_production": False,
            "decision_ref": None if decision is None else decision.decision_ref,
        },
        "cache": {
            "strategy": "bounded_monotonic_ttl_lru",
            "ttl_secs": fixture.cache_ttl_secs,
            "cache_key": key,
        },
        "lineage": {
            "snapshot_id": "data-query-snapshot:" + key[7:],
            "schema_hash": content_hash(record_schema(context.schema_ref)),
            "content_hash": normalized_hash,
            "artifact_hash": content_hash(lineage),
            "lineage_tags": list(fixture.lineage_tags),
            "fixture_digest": fixture.fixture_digest,
        },
        "usage": {
            "intended_use": context.intended_use,
            "trading_approved": False,
            "allowed_workflows": list(fixture.allowed_workflows),
        },
        "upstream": {
            "repo": "mock://quantos/openbb-adapter" if decision is None else decision.upstream_repo,
            "ref": "mock-fixture-v1" if decision is None else decision.upstream_ref,
            "notice_required": False if decision is None else decision.notice_required,
        },
        "diagnostics": {
            "provider_implementation": "quantos_deterministic_fixture",
            "upstream_runtime_loaded": False,
            "tools_executed": False,
            "snapshot_bytes_resolved": False,
            "live_freshness_assessed": False,
        },
    }
    response["response_hash"] = content_hash(response)  # Hash of the response excluding this field.
    events = (
        {"phase": "validated", "provider": context.provider_name, "dataset": context.dataset},
        {"phase": "lineage_ready", "schema_ref": context.schema_ref, "license_label": label},
        {
            "phase": "completed",
            "response_hash": response["response_hash"],
            "trading_approved": False,
        },
    )
    return ProviderResult(response, normalized, lineage, events)
