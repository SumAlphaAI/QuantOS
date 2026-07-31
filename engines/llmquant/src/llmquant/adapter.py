"""Boundary validation and request translation for TP03 LLMQuant."""

from __future__ import annotations

from dataclasses import dataclass

import grpc

from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import json_document_to_mapping

from llmquant.fixtures import fixture_names
from llmquant.manifest import SIGNAL_CAPABILITY


SUPPORTED_CAPABILITIES = {SIGNAL_CAPABILITY}
ALLOWED_TOOLS = {"query_snapshot", "query_artifact"}
FORBIDDEN_FIELDS = {
    "venue",
    "oms_command",
    "trade_command",
    "order",
    "secret_ref",
    "network_access",
    "external_url",
}


class RequestBoundaryError(Exception):
    """Raised when a request crosses the TP03 boundary."""

    def __init__(self, code: grpc.StatusCode, detail: str) -> None:
        super().__init__(detail)
        self.code = code


@dataclass(frozen=True)
class SignalExecutionContext:
    capability: str
    workflow_run_id: str
    tenant_id: str
    actor_id: str
    strategy_release_id: str
    feature_snapshot_id: str
    data_snapshot_ref: str
    policy_context_ref: str
    fixture_name: str
    requested_tools: tuple[str, ...]
    data_query_context: dict | None


@dataclass(frozen=True)
class TranslatedRequest:
    context: SignalExecutionContext
    payload: dict


class LlmQuantRequestAdapter:
    """Translate and validate QuantOS ExecuteRequest payloads for LLMQuant."""

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
                "actor is missing required llmquant capability",
            )
        if not request.data_snapshot_ref.strip():
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "data_snapshot_ref is required for llmquant",
            )

        payload = json_document_to_mapping(request.input)
        self._reject_forbidden_fields(payload)

        requested_tools = tuple(str(tool).strip() for tool in payload.get("tools", []))
        self._reject_forbidden_tools(requested_tools)

        strategy_release_id = str(payload.get("strategy_release_id", "")).strip()
        if not strategy_release_id:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "`strategy_release_id` is required for llmquant",
            )

        feature_snapshot_id = str(
            payload.get("feature_snapshot_id", request.data_snapshot_ref)
        ).strip()
        if not feature_snapshot_id:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "`feature_snapshot_id` is required for llmquant",
            )
        if feature_snapshot_id != request.data_snapshot_ref:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "feature snapshot must match request data_snapshot_ref",
            )

        data_query_context = payload.get("data_query")
        if data_query_context is not None and not isinstance(data_query_context, dict):
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "`data_query` must be a JSON object when provided",
            )

        fixture_name = str(payload.get("fixture", fixture_names()[0])).strip() or fixture_names()[0]
        context = SignalExecutionContext(
            capability=request.capability,
            workflow_run_id=request.workflow_run_id,
            tenant_id=request.metadata.tenant_id,
            actor_id=request.metadata.actor.actor_id,
            strategy_release_id=strategy_release_id,
            feature_snapshot_id=feature_snapshot_id,
            data_snapshot_ref=request.data_snapshot_ref,
            policy_context_ref=request.policy_context_ref,
            fixture_name=fixture_name,
            requested_tools=requested_tools,
            data_query_context=data_query_context,
        )
        return TranslatedRequest(context=context, payload=payload)

    @staticmethod
    def _reject_forbidden_fields(payload: dict) -> None:
        for key in FORBIDDEN_FIELDS:
            if key in payload:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    f"`{key}` is forbidden for llmquant",
                )

    @staticmethod
    def _reject_forbidden_tools(requested_tools: tuple[str, ...]) -> None:
        for tool in requested_tools:
            if tool not in ALLOWED_TOOLS:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    f"tool `{tool}` is forbidden for llmquant",
                )
