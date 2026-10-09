"""Boundary validation and request translation for TP02 RD-Agent."""

from __future__ import annotations

from dataclasses import dataclass

import grpc

from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import input_hash, json_document_to_mapping

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
    "policy_context_ref",
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
    workspace_id: str
    actor_id: str
    request_id: str
    correlation_id: str
    causation_id: str
    input_hash: str
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
        if request.metadata.mode != common_pb2.RUNTIME_MODE_RESEARCH:
            raise RequestBoundaryError(grpc.StatusCode.PERMISSION_DENIED, "ENGINE_RESEARCH_ONLY")

        payload = json_document_to_mapping(request.input)
        self._reject_forbidden_fields(payload)
        if set(payload) - {"prompt", "fixture", "tools", "sleep_ms"}:
            raise RequestBoundaryError(grpc.StatusCode.PERMISSION_DENIED, "ENGINE_INPUT_FORBIDDEN")
        for name in ("prompt", "fixture"):
            if name in payload and (
                not isinstance(payload[name], str) or not 0 < len(payload[name]) <= 8192
            ):
                raise RequestBoundaryError(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_INPUT_INVALID")
        sleep_ms = payload.get("sleep_ms", 0)
        if (
            isinstance(sleep_ms, bool)
            or not isinstance(sleep_ms, (int, float))
            or not 0 <= sleep_ms <= 5000
            or int(sleep_ms) != sleep_ms
        ):
            raise RequestBoundaryError(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_INPUT_INVALID")
        tools = payload.get("tools", [])
        if (
            not isinstance(tools, list)
            or len(tools) > len(ALLOWED_TOOLS)
            or any(not isinstance(t, str) for t in tools)
        ):
            raise RequestBoundaryError(grpc.StatusCode.INVALID_ARGUMENT, "ENGINE_TOOLS_INVALID")
        requested_tools = tuple(tools)
        self._reject_forbidden_tools(requested_tools)

        default_fixture = fixture_names()[0 if request.capability == HYPOTHESIS_CAPABILITY else 1]
        fixture_name = payload.get("fixture", default_fixture)
        context = ResearchExecutionContext(
            capability=request.capability,
            workflow_run_id=request.workflow_run_id,
            tenant_id=request.metadata.tenant_id,
            workspace_id=request.metadata.workspace_id,
            actor_id=request.metadata.actor.actor_id,
            request_id=request.metadata.request_id,
            correlation_id=request.metadata.correlation_id,
            causation_id=request.metadata.causation_id,
            input_hash=input_hash(request.input),
            data_snapshot_ref=request.data_snapshot_ref,
            policy_context_ref=request.policy_context_ref,
            fixture_name=fixture_name,
            prompt=str(payload.get("prompt", "Generate a deterministic research artifact")).strip()
            or "Generate a deterministic research artifact",
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
                        "ENGINE_BOUNDARY_FORBIDDEN: field forbidden for rd-agent",
                    )
                RdAgentRequestAdapter._reject_forbidden_fields(value)
        elif isinstance(payload, list):
            for value in payload:
                RdAgentRequestAdapter._reject_forbidden_fields(value)

    @staticmethod
    def _reject_forbidden_tools(requested_tools: tuple[str, ...]) -> None:
        for tool in requested_tools:
            if tool not in ALLOWED_TOOLS:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    "ENGINE_TOOL_FORBIDDEN: tool forbidden for rd-agent",
                )
