"""Closed Research/evaluation request boundary; no caller-controlled authority."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import NoReturn
import grpc
from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos_engine_sdk import input_hash, json_document_to_mapping
from openbb_adapter.fixtures import fixture_names, load_fixture
from openbb_adapter.manifest import DATA_QUERY_CAPABILITY

ALLOWED_TOOLS = {"query_snapshot", "query_artifact"}
FORBIDDEN_FIELDS = {
    "venue",
    "order",
    "order_tool",
    "trade_command",
    "signal",
    "secret_ref",
    "api_key",
    "authorization",
    "network_access",
    "external_url",
    "shell",
    "file_write",
    "broker_connection",
    "executable",
    "trading_approved",
    "approved_for_production",
    "tenant_id",
    "workspace_id",
    "actor_id",
    "capabilities",
    "policy_context_ref",
    "data_snapshot_ref",
    "tools_executed",
}


class RequestBoundaryError(Exception):
    def __init__(self, code: grpc.StatusCode, detail: str):
        super().__init__(detail)
        self.code = code


def reject(detail="ENGINE_INPUT_INVALID", code=grpc.StatusCode.INVALID_ARGUMENT) -> NoReturn:
    raise RequestBoundaryError(code, detail)


def identifier(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 512 or "://" in value:
        reject()
    return value


@dataclass(frozen=True)
class DataQueryExecutionContext:
    capability: str
    workflow_run_id: str
    tenant_id: str
    workspace_id: str
    actor_id: str
    input_hash: str
    metadata_hash: str
    policy_context_ref: str
    data_snapshot_ref: str
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
    def translate(self, request: engine_pb2.ExecuteRequest) -> TranslatedRequest:
        if request.input_schema_version != "v1" or request.capability != DATA_QUERY_CAPABILITY:
            reject("ENGINE_CONTRACT_INVALID")
        if request.capability not in request.metadata.actor.capabilities:
            reject("ENGINE_CAPABILITY_REQUIRED", grpc.StatusCode.PERMISSION_DENIED)
        if request.metadata.mode != common_pb2.RUNTIME_MODE_RESEARCH:
            reject("ENGINE_RESEARCH_ONLY", grpc.StatusCode.PERMISSION_DENIED)
        if request.metadata.environment not in {
            common_pb2.ENVIRONMENT_LOCAL,
            common_pb2.ENVIRONMENT_TEST,
        }:
            reject(
                "OpenBB restricted to isolated evaluation: environment denied",
                grpc.StatusCode.FAILED_PRECONDITION,
            )
        for value in (
            request.metadata.tenant_id,
            request.metadata.workspace_id,
            request.metadata.actor.actor_id,
            request.workflow_run_id,
            request.idempotency_key,
        ):
            identifier(value)
        payload = json_document_to_mapping(request.input)
        self._reject_forbidden_fields(payload)
        if set(payload) - {
            "provider",
            "fixture",
            "dataset",
            "schema_ref",
            "query_text",
            "symbols",
            "intended_use",
            "deployment_target",
            "tools",
            "sleep_ms",
            "stream_delay_ms",
        }:
            reject("ENGINE_INPUT_FORBIDDEN", grpc.StatusCode.PERMISSION_DENIED)
        tools = payload.get("tools", [])
        if (
            not isinstance(tools, list)
            or len(tools) > len(ALLOWED_TOOLS)
            or any(not isinstance(t, str) for t in tools)
        ):
            reject("ENGINE_TOOLS_INVALID")
        if any(t not in ALLOWED_TOOLS for t in tools):
            reject("ENGINE_TOOL_FORBIDDEN: tool forbidden", grpc.StatusCode.PERMISSION_DENIED)
        provider = identifier(payload.get("provider", "mock"))
        if provider not in {"mock", "openbb"}:
            reject("ENGINE_PROVIDER_INVALID")
        fixture_name = identifier(payload.get("fixture", fixture_names()[0]))
        fixture = load_fixture(fixture_name)
        dataset = identifier(payload.get("dataset", fixture.dataset))
        schema = identifier(payload.get("schema_ref", fixture.schema_ref))
        symbols = payload.get("symbols", list(fixture.symbols))
        if not isinstance(symbols, list) or any(not isinstance(x, str) for x in symbols):
            reject("ENGINE_SYMBOLS_INVALID")
        if (
            dataset != fixture.dataset
            or schema != fixture.schema_ref
            or tuple(symbols) != fixture.symbols
        ):
            reject("ENGINE_FIXTURE_QUERY_MISMATCH")
        query = identifier(payload.get("query_text", f"query {dataset}"))
        intended = payload.get("intended_use", "research")
        if not isinstance(intended, str) or intended not in {"research", "evaluation"}:
            reject("ENGINE_USE_DENIED", grpc.StatusCode.PERMISSION_DENIED)
        target = payload.get("deployment_target", "test")
        if not isinstance(target, str) or target not in {"test", "evaluation", "production"}:
            reject("ENGINE_DEPLOYMENT_INVALID")
        if target == "production":
            reject(
                "OpenBB restricted to isolated evaluation: production denied",
                grpc.StatusCode.FAILED_PRECONDITION,
            )
        if provider == "openbb" and target != "evaluation":
            reject("OpenBB restricted to isolated evaluation", grpc.StatusCode.FAILED_PRECONDITION)
        for name in ("sleep_ms", "stream_delay_ms"):
            v = payload.get(name, 0)
            if (
                isinstance(v, bool)
                or not isinstance(v, (int, float))
                or not 0 <= v <= 5000
                or v != int(v)
            ):
                reject("ENGINE_DELAY_INVALID")
        return TranslatedRequest(
            DataQueryExecutionContext(
                request.capability,
                request.workflow_run_id,
                request.metadata.tenant_id,
                request.metadata.workspace_id,
                request.metadata.actor.actor_id,
                input_hash(request.input),
                hashlib.sha256(request.metadata.SerializeToString(deterministic=True)).hexdigest(),
                request.policy_context_ref,
                request.data_snapshot_ref,
                provider,
                dataset,
                schema,
                query,
                tuple(symbols),
                intended,
                target,
                tuple(tools),
                fixture_name,
            ),
            payload,
        )

    @staticmethod
    def _reject_forbidden_fields(value):
        if isinstance(value, dict):
            for key, nested in value.items():
                if key.lower().replace("_", "").replace("-", "") in {
                    k.replace("_", "") for k in FORBIDDEN_FIELDS
                }:
                    reject(
                        "ENGINE_BOUNDARY_FORBIDDEN: field forbidden",
                        grpc.StatusCode.PERMISSION_DENIED,
                    )
                OpenBBAdapterRequestAdapter._reject_forbidden_fields(nested)
        elif isinstance(value, list):
            for nested in value:
                OpenBBAdapterRequestAdapter._reject_forbidden_fields(nested)
