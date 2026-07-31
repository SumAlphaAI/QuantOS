"""Boundary validation and request translation for TP05 OpenBB adapter."""

from __future__ import annotations

from dataclasses import dataclass

import grpc

from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import json_document_to_mapping

from openbb_adapter.fixtures import fixture_names, load_fixture
from openbb_adapter.manifest import DATA_QUERY_CAPABILITY


SUPPORTED_CAPABILITIES = {DATA_QUERY_CAPABILITY}
ALLOWED_TOOLS = {"query_snapshot", "query_artifact"}
FORBIDDEN_FIELDS = {
    "venue",
    "order",
    "trade_command",
    "signal",
    "secret_ref",
    "network_access",
    "external_url",
}


class RequestBoundaryError(Exception):
    """Raised when a request crosses the TP05 boundary."""

    def __init__(self, code: grpc.StatusCode, detail: str) -> None:
        super().__init__(detail)
        self.code = code


@dataclass(frozen=True)
class DataQueryExecutionContext:
    capability: str
    workflow_run_id: str
    tenant_id: str
    actor_id: str
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
class TranslatedRequest:
    context: DataQueryExecutionContext
    payload: dict


class OpenBBAdapterRequestAdapter:
    """Translate and validate QuantOS ExecuteRequest payloads for TP05."""

    def translate(self, request: engine_pb2.ExecuteRequest) -> TranslatedRequest:
        if request.input_schema_version != "v1":
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"unsupported schema version `{request.input_schema_version}`",
            )
        if request.capability not in SUPPORTED_CAPABILITIES:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"unsupported capability `{request.capability}`",
            )

        actor_capabilities = set(request.metadata.actor.capabilities)
        if request.capability not in actor_capabilities:
            raise RequestBoundaryError(
                grpc.StatusCode.PERMISSION_DENIED,
                "actor is missing required openbb-adapter capability",
            )

        payload = json_document_to_mapping(request.input)
        self._reject_forbidden_fields(payload)

        requested_tools = tuple(str(tool).strip() for tool in payload.get("tools", []))
        self._reject_forbidden_tools(requested_tools)

        provider_name = str(payload.get("provider", "mock")).strip() or "mock"
        if provider_name not in {"mock", "openbb"}:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"unsupported provider `{provider_name}`",
            )

        fixture_name = str(payload.get("fixture", fixture_names()[0])).strip() or fixture_names()[0]
        fixture = load_fixture(fixture_name)
        dataset = str(payload.get("dataset", fixture.dataset)).strip() or fixture.dataset
        schema_ref = str(payload.get("schema_ref", fixture.schema_ref)).strip() or fixture.schema_ref
        query_text = str(payload.get("query_text", "")).strip() or f"query {dataset}"
        symbols = tuple(str(symbol).strip() for symbol in payload.get("symbols", list(fixture.symbols)))
        if not symbols:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "`symbols` is required for openbb-adapter",
            )

        intended_use = str(payload.get("intended_use", "research")).strip().lower()
        if intended_use not in {"research", "evaluation"}:
            raise RequestBoundaryError(
                grpc.StatusCode.PERMISSION_DENIED,
                "openbb-adapter results are not approved for trading workflows",
            )

        deployment_target = str(payload.get("deployment_target", "test")).strip().lower()
        if deployment_target not in {"test", "evaluation", "production"}:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"unsupported deployment_target `{deployment_target}`",
            )

        context = DataQueryExecutionContext(
            capability=request.capability,
            workflow_run_id=request.workflow_run_id,
            tenant_id=request.metadata.tenant_id,
            actor_id=request.metadata.actor.actor_id,
            provider_name=provider_name,
            dataset=dataset,
            schema_ref=schema_ref,
            query_text=query_text,
            symbols=symbols,
            intended_use=intended_use,
            deployment_target=deployment_target,
            requested_tools=requested_tools,
            fixture_name=fixture_name,
        )
        return TranslatedRequest(context=context, payload=payload)

    @staticmethod
    def _reject_forbidden_fields(payload: dict) -> None:
        for key in FORBIDDEN_FIELDS:
            if key in payload:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    f"`{key}` is forbidden for openbb-adapter",
                )

    @staticmethod
    def _reject_forbidden_tools(requested_tools: tuple[str, ...]) -> None:
        for tool in requested_tools:
            if tool not in ALLOWED_TOOLS:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    f"tool `{tool}` is forbidden for openbb-adapter",
                )
