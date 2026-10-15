"""Boundary validation and request translation for TP06 strategy-lab."""

from __future__ import annotations

from dataclasses import dataclass

import grpc

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import json_document_to_mapping

from strategy_lab.fixtures import fixture_names, is_malicious_prompt
from strategy_lab.manifest import GENERATE_CAPABILITY


SUPPORTED_CAPABILITIES = {GENERATE_CAPABILITY}
ALLOWED_TOOLS = {"query_snapshot", "query_artifact", "query_draft"}
FORBIDDEN_FIELDS = {
    "venue",
    "oms_command",
    "trade_command",
    "order",
    "order_tool",
    "secret_ref",
    "network_access",
    "external_url",
    "deploy",
    "release",
    "approval_signature",
}


class RequestBoundaryError(Exception):
    """Raised when a request crosses the TP06 boundary."""

    def __init__(self, code: grpc.StatusCode, detail: str) -> None:
        super().__init__(detail)
        self.code = code


@dataclass(frozen=True)
class StrategyLabExecutionContext:
    capability: str
    workflow_run_id: str
    tenant_id: str
    actor_id: str
    workspace_id: str
    prompt: str
    fixture_name: str
    data_snapshot_ref: str
    policy_context_ref: str
    requested_tools: tuple[str, ...]


@dataclass(frozen=True)
class TranslatedRequest:
    context: StrategyLabExecutionContext
    payload: dict


class StrategyLabRequestAdapter:
    """Translate and validate QuantOS ExecuteRequest payloads for TP06."""

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
                "actor is missing required strategy-lab capability",
            )

        metadata = request.metadata
        if metadata.mode != common_pb2.RUNTIME_MODE_RESEARCH or not all(
            (
                metadata.tenant_id,
                metadata.workspace_id,
                metadata.actor.actor_id,
                request.workflow_run_id,
                request.idempotency_key,
                request.data_snapshot_ref,
                request.policy_context_ref,
            )
        ):
            raise RequestBoundaryError(
                grpc.StatusCode.PERMISSION_DENIED,
                "research identity, workflow and pinned references required",
            )
        payload = json_document_to_mapping(request.input)
        self._reject_forbidden_fields(payload)

        allowed = {"prompt", "fixture", "tools", "sleep_ms", "stream_delay_ms"}
        if set(payload) - allowed:
            raise RequestBoundaryError(grpc.StatusCode.PERMISSION_DENIED, "unknown request field")
        tools = payload.get("tools", [])
        if not isinstance(tools, list) or any(not isinstance(tool, str) for tool in tools):
            raise RequestBoundaryError(grpc.StatusCode.INVALID_ARGUMENT, "tools must be strings")
        for key in ("sleep_ms", "stream_delay_ms"):
            value = payload.get(key, 0)
            if type(value) not in (int, float) or not 0 <= value <= 5000 or value != int(value):
                raise RequestBoundaryError(grpc.StatusCode.INVALID_ARGUMENT, "invalid delay")
            if key in payload:
                payload[key] = int(value)
        for key in ("prompt", "fixture"):
            if key in payload and not isinstance(payload[key], str):
                raise RequestBoundaryError(grpc.StatusCode.INVALID_ARGUMENT, "text required")
        requested_tools = tuple(tools)
        self._reject_forbidden_tools(requested_tools)

        prompt = str(payload.get("prompt", "")).strip()
        if not prompt or len(prompt) > 8192:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "`prompt` is required for strategy-lab",
            )
        if is_malicious_prompt(prompt):
            raise RequestBoundaryError(
                grpc.StatusCode.PERMISSION_DENIED,
                "prompt requests forbidden order, secret, network, or deployment capability",
            )

        fixture_name = str(payload.get("fixture", fixture_names()[0])).strip() or fixture_names()[0]
        context = StrategyLabExecutionContext(
            capability=request.capability,
            workflow_run_id=request.workflow_run_id,
            tenant_id=request.metadata.tenant_id,
            actor_id=request.metadata.actor.actor_id,
            workspace_id=request.metadata.workspace_id,
            prompt=prompt,
            fixture_name=fixture_name,
            data_snapshot_ref=request.data_snapshot_ref,
            policy_context_ref=request.policy_context_ref,
            requested_tools=requested_tools,
        )
        return TranslatedRequest(context=context, payload=payload)

    @staticmethod
    def _reject_forbidden_fields(payload: dict) -> None:
        for key in FORBIDDEN_FIELDS:
            if key in payload:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    f"`{key}` is forbidden for strategy-lab",
                )

    @staticmethod
    def _reject_forbidden_tools(requested_tools: tuple[str, ...]) -> None:
        for tool in requested_tools:
            if tool not in ALLOWED_TOOLS:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    f"tool `{tool}` is forbidden for strategy-lab",
                )
