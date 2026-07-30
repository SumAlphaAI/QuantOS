"""Translate QuantOS engine requests into adapter-local execution context."""

from __future__ import annotations

from dataclasses import dataclass

import grpc

from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import json_document_to_mapping

from vibe_adapter.allowlist import ToolAllowlistPolicy, ToolPolicyError
from vibe_adapter.fixtures import fixture_names


class ContextTranslationError(ValueError):
    """Raised when a request violates the TP01 adapter boundary."""

    def __init__(self, code: grpc.StatusCode, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class VibeExecutionContext:
    request_id: str
    tenant_id: str
    workspace_id: str
    actor_id: str
    actor_capabilities: tuple[str, ...]
    workflow_run_id: str
    capability: str
    input_schema_version: str
    data_snapshot_ref: str
    policy_context_ref: str
    mode: int
    environment: int
    prompt: str
    fixture_name: str
    allowed_tools: tuple[str, ...]


@dataclass(frozen=True)
class TranslationResult:
    context: VibeExecutionContext
    payload: dict


class VibeContextTranslator:
    """Adapter-side contract translator with boundary enforcement."""

    def __init__(self, tool_policy: ToolAllowlistPolicy | None = None) -> None:
        self.tool_policy = tool_policy or ToolAllowlistPolicy()

    def translate(self, request: engine_pb2.ExecuteRequest) -> TranslationResult:
        if not request.HasField("metadata"):
            raise ContextTranslationError(
                grpc.StatusCode.INVALID_ARGUMENT, "metadata is required"
            )
        if not request.metadata.HasField("actor"):
            raise ContextTranslationError(
                grpc.StatusCode.INVALID_ARGUMENT, "metadata.actor is required"
            )
        if request.input_schema_version != "v1":
            raise ContextTranslationError(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"unsupported schema version `{request.input_schema_version}`",
            )
        if request.capability != "research.vibe_adapter.execute":
            raise ContextTranslationError(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"unsupported capability `{request.capability}`",
            )
        actor_capabilities = set(request.metadata.actor.capabilities)
        if not actor_capabilities.intersection(
            {"research.execute", "research.vibe_adapter.execute"}
        ):
            raise ContextTranslationError(
                grpc.StatusCode.PERMISSION_DENIED,
                "actor is missing required research capability",
            )

        payload = json_document_to_mapping(request.input)
        self._reject_forbidden_fields(payload)

        try:
            allowed_tools = self.tool_policy.normalize(payload.get("tools"))
        except ToolPolicyError as error:
            raise ContextTranslationError(grpc.StatusCode.PERMISSION_DENIED, str(error)) from error

        context = VibeExecutionContext(
            request_id=request.metadata.request_id,
            tenant_id=request.metadata.tenant_id,
            workspace_id=request.metadata.workspace_id,
            actor_id=request.metadata.actor.actor_id,
            actor_capabilities=tuple(request.metadata.actor.capabilities),
            workflow_run_id=request.workflow_run_id,
            capability=request.capability,
            input_schema_version=request.input_schema_version,
            data_snapshot_ref=request.data_snapshot_ref,
            policy_context_ref=request.policy_context_ref,
            mode=request.metadata.mode,
            environment=request.metadata.environment,
            prompt=str(payload.get("prompt", "replay locked fixture")).strip()
            or "replay locked fixture",
            fixture_name=str(payload.get("fixture", fixture_names()[0])).strip()
            or fixture_names()[0],
            allowed_tools=allowed_tools,
        )
        return TranslationResult(context=context, payload=payload)

    @staticmethod
    def _reject_forbidden_fields(payload: dict) -> None:
        if payload.get("network_access") is True:
            raise ContextTranslationError(
                grpc.StatusCode.PERMISSION_DENIED,
                "network_access is forbidden for vibe-adapter",
            )
        for forbidden_key in ("venue", "secret_ref", "broker_connection", "shell", "file_write"):
            value = payload.get(forbidden_key)
            if value not in (None, "", False, []):
                raise ContextTranslationError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    f"`{forbidden_key}` is forbidden for vibe-adapter",
                )
