"""Provider abstraction, mock provider, and isolated OpenBB evaluation provider for TP05."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from quantos_engine_sdk import input_hash, json_document_from_mapping

from openbb_adapter.fixtures import QueryFixture, load_fixture
from openbb_adapter.license_gate import LicenseGateDecision


@dataclass(frozen=True)
class DataQueryContext:
    workflow_run_id: str
    tenant_id: str
    provider_name: str
    dataset: str
    schema_ref: str
    query_text: str
    symbols: tuple[str, ...]
    intended_use: str
    deployment_target: str
    requested_tools: tuple[str, ...]
    fixture_name: str


@dataclass(frozen=True)
class ProviderResult:
    payload: dict
    normalized_artifact: dict
    lineage_artifact: dict
    stream_events: tuple[dict, ...]


class DataQueryProvider(Protocol):
    provider_name: str

    def resolve(self, context: DataQueryContext) -> ProviderResult:
        ...


@dataclass
class MockDataQueryProvider:
    """Deterministic replacement provider that never depends on OpenBB."""

    provider_name: str = "mock"
    _cache: dict[str, ProviderResult] = field(default_factory=dict)

    def resolve(self, context: DataQueryContext) -> ProviderResult:
        cache_key = self._cache_key(context)
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        fixture = load_fixture(context.fixture_name)
        result = _build_result(context, fixture, provider_name=self.provider_name)
        self._cache[cache_key] = result
        return result

    @staticmethod
    def _cache_key(context: DataQueryContext) -> str:
        payload = {
            "provider_name": context.provider_name,
            "dataset": context.dataset,
            "schema_ref": context.schema_ref,
            "query_text": context.query_text,
            "symbols": list(context.symbols),
            "fixture_name": context.fixture_name,
        }
        return input_hash(json_document_from_mapping(payload))


@dataclass
class OpenBBEvaluationProvider:
    """Isolated OpenBB evaluation provider guarded by the TP05 license gate."""

    provider_name: str = "openbb"
    decision: LicenseGateDecision = field(default_factory=LicenseGateDecision.load_default)
    _cache: dict[str, ProviderResult] = field(default_factory=dict)

    def resolve(self, context: DataQueryContext) -> ProviderResult:
        self.decision.ensure_runtime_allowed(
            provider_name=self.provider_name,
            deployment_target=context.deployment_target,
            dataset=context.dataset,
        )

        cache_key = MockDataQueryProvider._cache_key(context)
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        fixture = load_fixture(context.fixture_name)
        result = _build_result(
            context,
            fixture,
            provider_name=self.provider_name,
            decision=self.decision,
        )
        self._cache[cache_key] = result
        return result


def default_provider_registry() -> dict[str, DataQueryProvider]:
    return {
        "mock": MockDataQueryProvider(),
        "openbb": OpenBBEvaluationProvider(),
    }


def _build_result(
    context: DataQueryContext,
    fixture: QueryFixture,
    *,
    provider_name: str,
    decision: LicenseGateDecision | None = None,
) -> ProviderResult:
    license_label = "internal-test-only" if decision is None else decision.license_label
    sources = [
        {
            "source_id": source.source_id,
            "provider": provider_name,
            "dataset": source.dataset,
            "license_label": license_label if provider_name == "mock" else source.license_label,
        }
        for source in fixture.sources
    ]

    normalized_artifact = {
        "artifact_type": "NormalizedDataQueryArtifact",
        "provider": provider_name,
        "dataset": context.dataset,
        "schema_ref": context.schema_ref,
        "records": list(fixture.records),
    }
    normalized_artifact["artifact_hash"] = input_hash(json_document_from_mapping(normalized_artifact))

    lineage_artifact = {
        "artifact_type": "DataLineageArtifact",
        "provider": provider_name,
        "dataset": context.dataset,
        "schema_ref": context.schema_ref,
        "sources": sources,
        "license_label": license_label,
        "upstream_repo": None if decision is None else decision.upstream_repo,
        "upstream_ref": None if decision is None else decision.upstream_ref,
        "approved_for_production": False if decision is None else decision.approved_for_production,
    }
    lineage_artifact["artifact_hash"] = input_hash(json_document_from_mapping(lineage_artifact))

    response = {
        "response_type": "DataQueryResponse",
        "provider": provider_name,
        "query_id": f"query:{context.workflow_run_id}",
        "dataset": context.dataset,
        "schema_ref": context.schema_ref,
        "query_text": context.query_text,
        "symbols": list(context.symbols),
        "window": dict(fixture.window),
        "records": list(fixture.records),
        "sources": sources,
        "license": {
            "label": license_label,
            "status": "mock_only" if decision is None else decision.status,
            "approved_for_production": False if decision is None else decision.approved_for_production,
            "decision_ref": None if decision is None else decision.decision_ref,
        },
        "cache": {
            "strategy": "short_lived_query_cache",
            "ttl_secs": fixture.cache_ttl_secs,
            "cache_key": MockDataQueryProvider._cache_key(context),
        },
        "lineage": {
            "snapshot_id": f"data-query-snapshot:{context.workflow_run_id}",
            "schema_hash": input_hash(
                json_document_from_mapping(
                    {"schema_ref": context.schema_ref, "records": list(fixture.records)}
                )
            ),
            "content_hash": normalized_artifact["artifact_hash"],
            "lineage_tags": list(fixture.lineage_tags),
            "artifact_hash": lineage_artifact["artifact_hash"],
        },
        "usage": {
            "intended_use": context.intended_use,
            "trading_approved": False,
            "allowed_workflows": list(fixture.allowed_workflows),
        },
        "upstream": (
            {
                "repo": decision.upstream_repo,
                "ref": decision.upstream_ref,
                "notice_required": decision.notice_required,
            }
            if decision is not None
            else {
                "repo": "mock://quantos/openbb-adapter",
                "ref": "mock-fixture-v1",
                "notice_required": False,
            }
        ),
    }
    response["response_hash"] = input_hash(json_document_from_mapping(response))

    stream_events = (
        {
            "phase": "validated",
            "provider": provider_name,
            "dataset": context.dataset,
        },
        {
            "phase": "lineage_ready",
            "schema_ref": context.schema_ref,
            "license_label": response["license"]["label"],
        },
        {
            "phase": "completed",
            "response_hash": response["response_hash"],
            "trading_approved": False,
        },
    )
    return ProviderResult(
        payload=response,
        normalized_artifact=normalized_artifact,
        lineage_artifact=lineage_artifact,
        stream_events=stream_events,
    )
