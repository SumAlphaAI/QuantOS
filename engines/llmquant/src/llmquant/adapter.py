"""Boundary validation and request translation for TP03 LLMQuant."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib

import grpc

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import input_hash, json_document_to_mapping

from llmquant.fixtures import fixture_names
from llmquant.manifest import SIGNAL_CAPABILITY


SUPPORTED_CAPABILITIES = {SIGNAL_CAPABILITY}
ALLOWED_TOOLS = {"query_artifact", "query_snapshot"}
FORBIDDEN_FIELDS = {
    "venue",
    "secret_ref",
    "trade_command",
    "order",
    "network_access",
    "external_url",
    "tenant_id",
    "workspace_id",
    "actor_id",
    "capabilities",
    "api_key",
    "authorization",
    "shell",
    "file_write",
    "broker_connection",
    "session",
    "data_snapshot_ref",
    "oms_command",
    "policy_context_ref",
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
    workspace_id: str
    actor_id: str
    request_id: str
    correlation_id: str
    causation_id: str
    input_hash: str
    metadata_hash: str
    data_snapshot_ref: str
    policy_context_ref: str
    fixture_name: str
    strategy_release_id: str
    feature_snapshot_id: str
    data_query_context: dict | None
    requested_tools: tuple[str, ...]


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
        if request.metadata.mode != common_pb2.RUNTIME_MODE_RESEARCH:
            raise RequestBoundaryError(grpc.StatusCode.PERMISSION_DENIED, "ENGINE_RESEARCH_ONLY")

        payload = json_document_to_mapping(request.input)
        self._reject_forbidden_fields(
            {k: v for k, v in payload.items() if k != "policy_context_ref"}
        )
        if set(payload) - {
            "strategy_release_id",
            "feature_snapshot_id",
            "policy_context_ref",
            "fixture",
            "tools",
            "sleep_ms",
            "stream_delay_ms",
            "data_query",
        }:
            raise RequestBoundaryError(grpc.StatusCode.PERMISSION_DENIED, "ENGINE_INPUT_FORBIDDEN")
        for name in ("strategy_release_id", "feature_snapshot_id", "policy_context_ref", "fixture"):
            if name in payload and (
                not isinstance(payload[name], str)
                or not payload[name].strip()
                or not 0 < len(payload[name]) <= 512
                or "://" in payload[name]
            ):
                raise RequestBoundaryError(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_INPUT_INVALID")
        for name in ("sleep_ms", "stream_delay_ms"):
            value = payload.get(name, 0)
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not 0 <= value <= 5000
                or int(value) != value
            ):
                raise RequestBoundaryError(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_INPUT_INVALID")
        if not payload.get("strategy_release_id") or not payload.get("feature_snapshot_id"):
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_RELEASE_SNAPSHOT_REQUIRED"
            )
        if payload["feature_snapshot_id"] != request.data_snapshot_ref:
            raise RequestBoundaryError(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_SNAPSHOT_MISMATCH")
        if (
            payload.get("policy_context_ref", request.policy_context_ref)
            != request.policy_context_ref
        ):
            raise RequestBoundaryError(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_POLICY_MISMATCH")
        data_query = payload.get("data_query")
        if data_query is not None:
            if not isinstance(data_query, dict):
                raise RequestBoundaryError(
                    grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_DATA_QUERY_INVALID"
                )
            for name in ("license", "lineage", "usage"):
                if name in data_query and not isinstance(data_query[name], dict):
                    raise RequestBoundaryError(
                        grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_DATA_QUERY_INVALID"
                    )
            for section, names in (
                (data_query, ("provider", "dataset", "schema_ref", "query_id", "response_hash")),
                (data_query.get("license", {}), ("label",)),
                (data_query.get("lineage", {}), ("content_hash", "schema_hash")),
            ):
                if any(name in section and not isinstance(section[name], str) for name in names):
                    raise RequestBoundaryError(
                        grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_DATA_QUERY_INVALID"
                    )
            # Caller-supplied metadata never grants trading or production approval.
            for section, name in (
                ("license", "approved_for_production"),
                ("usage", "trading_approved"),
            ):
                if data_query.get(section, {}).get(name, False) is not False:
                    raise RequestBoundaryError(
                        grpc.StatusCode.PERMISSION_DENIED, "ENGINE_DATA_AUTHORITY_FORBIDDEN"
                    )
        tools = payload.get("tools", [])
        if (
            not isinstance(tools, list)
            or len(tools) > len(ALLOWED_TOOLS)
            or any(not isinstance(t, str) for t in tools)
        ):
            raise RequestBoundaryError(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_TOOLS_INVALID")
        requested_tools = tuple(tools)
        self._reject_forbidden_tools(requested_tools)

        default_fixture = fixture_names()[0]
        fixture_name = payload.get("fixture", default_fixture)
        context = SignalExecutionContext(
            capability=request.capability,
            workflow_run_id=request.workflow_run_id,
            tenant_id=request.metadata.tenant_id,
            workspace_id=request.metadata.workspace_id,
            actor_id=request.metadata.actor.actor_id,
            request_id=request.metadata.request_id,
            correlation_id=request.metadata.correlation_id,
            causation_id=request.metadata.causation_id,
            input_hash=input_hash(request.input),
            metadata_hash=hashlib.sha256(
                request.metadata.SerializeToString(deterministic=True)
            ).hexdigest(),
            data_snapshot_ref=request.data_snapshot_ref,
            policy_context_ref=request.policy_context_ref,
            fixture_name=fixture_name,
            strategy_release_id=payload["strategy_release_id"],
            feature_snapshot_id=payload["feature_snapshot_id"],
            data_query_context=data_query,
            requested_tools=requested_tools,
        )
        return TranslatedRequest(context=context, payload=payload)

    @staticmethod
    def _reject_forbidden_fields(payload: object) -> None:
        if isinstance(payload, dict):
            for key, value in payload.items():
                if key.lower().replace("-", "_") in FORBIDDEN_FIELDS:
                    raise RequestBoundaryError(
                        grpc.StatusCode.PERMISSION_DENIED,
                        "ENGINE_BOUNDARY_FORBIDDEN: field forbidden for llmquant",
                    )
                LlmQuantRequestAdapter._reject_forbidden_fields(value)
        elif isinstance(payload, list):
            for value in payload:
                LlmQuantRequestAdapter._reject_forbidden_fields(value)

    @staticmethod
    def _reject_forbidden_tools(requested_tools: tuple[str, ...]) -> None:
        for tool in requested_tools:
            if tool not in ALLOWED_TOOLS:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    "ENGINE_TOOL_FORBIDDEN: tool forbidden for llmquant",
                )
