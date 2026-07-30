"""Boundary validation and request translation for TP02 RD-Agent."""

from __future__ import annotations

from dataclasses import dataclass

import grpc

from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import json_document_to_mapping

from rd_agent.fixtures import fixture_names
from rd_agent.manifest import EXPERIMENT_CAPABILITY, HYPOTHESIS_CAPABILITY


SUPPORTED_CAPABILITIES = {HYPOTHESIS_CAPABILITY, EXPERIMENT_CAPABILITY}
ALLOWED_TOOLS = {"read_document", "query_artifact", "query_snapshot"}
FORBIDDEN_FIELDS = {
    "venue",
    "secret_ref",
    "trade_command",
    "order",
    "network_access",
    "external_url",
}


class RequestBoundaryError(Exception):
    """Raised when a request crosses the TP02 boundary."""

    def __init__(self, code: grpc.StatusCode, detail: str) -> None:
        super().__init__(detail)
        self.code = code


@dataclass(frozen=True)
class ResearchExecutionContext:
    capability: str
    workflow_run_id: str
    tenant_id: str
    actor_id: str
    data_snapshot_ref: str
    policy_context_ref: str
    fixture_name: str
    prompt: str
    requested_tools: tuple[str, ...]


@dataclass(frozen=True)
class TranslatedRequest:
    context: ResearchExecutionContext
    payload: dict


class RdAgentRequestAdapter:
    """Translate and validate QuantOS ExecuteRequest payloads for RD-Agent."""

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
                "actor is missing required rd-agent capability",
            )

        payload = json_document_to_mapping(request.input)
        self._reject_forbidden_fields(payload)
        requested_tools = tuple(str(tool).strip() for tool in payload.get("tools", []))
        self._reject_forbidden_tools(requested_tools)

        fixture_name = str(payload.get("fixture", fixture_names()[0])).strip() or fixture_names()[0]
        context = ResearchExecutionContext(
            capability=request.capability,
            workflow_run_id=request.workflow_run_id,
            tenant_id=request.metadata.tenant_id,
            actor_id=request.metadata.actor.actor_id,
            data_snapshot_ref=request.data_snapshot_ref,
            policy_context_ref=request.policy_context_ref,
            fixture_name=fixture_name,
            prompt=str(payload.get("prompt", "Generate a deterministic research artifact")).strip()
            or "Generate a deterministic research artifact",
            requested_tools=requested_tools,
        )
        return TranslatedRequest(context=context, payload=payload)

    @staticmethod
    def _reject_forbidden_fields(payload: dict) -> None:
        for key in FORBIDDEN_FIELDS:
            if key in payload:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    f"`{key}` is forbidden for rd-agent",
                )

    @staticmethod
    def _reject_forbidden_tools(requested_tools: tuple[str, ...]) -> None:
        for tool in requested_tools:
            if tool not in ALLOWED_TOOLS:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    f"tool `{tool}` is forbidden for rd-agent",
                )
