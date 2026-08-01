"""Boundary validation and request translation for TP06 strategy-lab."""

from __future__ import annotations

from dataclasses import dataclass

import grpc

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

        payload = json_document_to_mapping(request.input)
        self._reject_forbidden_fields(payload)

        requested_tools = tuple(str(tool).strip() for tool in payload.get("tools", []))
        self._reject_forbidden_tools(requested_tools)

        prompt = str(payload.get("prompt", "")).strip()
        if not prompt:
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
