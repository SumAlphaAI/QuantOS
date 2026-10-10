"""Research proposal boundary; caller data never grants execution authority."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import NoReturn
from decimal import Decimal, InvalidOperation

import grpc
from google.protobuf import json_format
from quantos.common.v1 import common_pb2
from quantos.engine.v1 import engine_pb2
from quantos.strategy.v1 import strategy_pb2
from quantos_engine_sdk import input_hash, json_document_to_mapping
from trading_agents.fixtures import fixture_names
from trading_agents.manifest import PROPOSAL_CAPABILITY

ALLOWED_TOOLS = {"query_signal", "query_snapshot", "query_artifact"}
FORBIDDEN_FIELDS = {
    "venue",
    "order",
    "order_tool",
    "trade_command",
    "approval_signature",
    "secret_ref",
    "network_access",
    "external_url",
    "api_key",
    "authorization",
    "shell",
    "file_write",
    "broker_connection",
    "session",
    "oms_command",
    "executable",
    "tools_executed",
}
AUTHORITY_FIELDS = {
    "tenant_id",
    "workspace_id",
    "actor_id",
    "capabilities",
    "data_snapshot_ref",
    "policy_context_ref",
}


class RequestBoundaryError(Exception):
    def __init__(self, code: grpc.StatusCode, detail: str):
        super().__init__(detail)
        self.code = code


@dataclass(frozen=True)
class ProposalExecutionContext:
    capability: str
    workflow_run_id: str
    tenant_id: str
    workspace_id: str
    actor_id: str
    input_hash: str
    metadata_hash: str
    policy_context_ref: str
    account_id: str
    policy_snapshot_id: str
    portfolio_snapshot_id: str
    fixture_name: str
    signal: strategy_pb2.Signal
    requested_tools: tuple[str, ...]
    data_query_context: dict | None


@dataclass(frozen=True)
class TranslatedRequest:
    context: ProposalExecutionContext
    payload: dict


def reject(detail="ENGINE_INPUT_INVALID", code=grpc.StatusCode.INVALID_ARGUMENT) -> NoReturn:
    raise RequestBoundaryError(code, detail)


def identifier(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 512 or "://" in value:
        reject()
    return value


class TradingAgentsRequestAdapter:
    def translate(self, request: engine_pb2.ExecuteRequest) -> TranslatedRequest:
        if request.input_schema_version != "v1" or request.capability != PROPOSAL_CAPABILITY:
            reject("ENGINE_CONTRACT_INVALID")
        if request.capability not in request.metadata.actor.capabilities:
            reject("ENGINE_CAPABILITY_REQUIRED", grpc.StatusCode.PERMISSION_DENIED)
        if request.metadata.mode != common_pb2.RUNTIME_MODE_RESEARCH:
            reject("ENGINE_RESEARCH_ONLY", grpc.StatusCode.PERMISSION_DENIED)
        payload = json_document_to_mapping(request.input)
        # Signal metadata is a separately validated evidence envelope, never an authority override.
        self._reject_forbidden_fields(
            {k: v for k, v in payload.items() if k != "signal"}, authority=True
        )
        if set(payload) - {
            "fixture",
            "account_id",
            "symbol",
            "policy_snapshot_id",
            "portfolio_snapshot_id",
            "signal",
            "tools",
            "sleep_ms",
            "stream_delay_ms",
            "data_query",
        }:
            reject("ENGINE_INPUT_FORBIDDEN", grpc.StatusCode.PERMISSION_DENIED)
        for name in ("account_id", "policy_snapshot_id", "portfolio_snapshot_id"):
            identifier(payload.get(name))
        fixture_name = identifier(payload.get("fixture", fixture_names()[0]))
        if payload["policy_snapshot_id"] != request.policy_context_ref:
            reject("ENGINE_POLICY_MISMATCH")
        if payload["portfolio_snapshot_id"] != request.data_snapshot_ref:
            reject("ENGINE_SNAPSHOT_MISMATCH")
        for name in ("sleep_ms", "stream_delay_ms"):
            value = payload.get(name, 0)
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not 0 <= value <= 5000
                or value != int(value)
            ):
                reject("ENGINE_DELAY_INVALID")
        tools = payload.get("tools", [])
        if (
            not isinstance(tools, list)
            or len(tools) > len(ALLOWED_TOOLS)
            or any(not isinstance(t, str) for t in tools)
        ):
            reject("ENGINE_TOOLS_INVALID")
        if any(t not in ALLOWED_TOOLS for t in tools):
            reject("ENGINE_TOOL_FORBIDDEN: tool forbidden", grpc.StatusCode.PERMISSION_DENIED)
        raw_signal = payload.get("signal")
        if not isinstance(raw_signal, dict) or not raw_signal:
            reject("ENGINE_SIGNAL_REQUIRED")
        # Explicit false diagnostics flags from TP03 are evidence, not commands.
        self._reject_forbidden_fields(raw_signal, authority=False, allow_false=True)
        try:
            signal = json_format.ParseDict(raw_signal, strategy_pb2.Signal())
        except (json_format.ParseError, ValueError, TypeError):
            reject("ENGINE_SIGNAL_INVALID")
        assert signal is not None
        if (
            signal.metadata.tenant_id != request.metadata.tenant_id
            or signal.metadata.workspace_id != request.metadata.workspace_id
            or signal.metadata.mode != common_pb2.RUNTIME_MODE_RESEARCH
        ):
            reject("ENGINE_SIGNAL_SCOPE", grpc.StatusCode.PERMISSION_DENIED)
        for value in (signal.signal_id, signal.strategy_release_id, signal.symbol):
            identifier(value)
        if payload.get("symbol", signal.symbol) != signal.symbol:
            reject("ENGINE_SYMBOL_MISMATCH")
        if signal.direction not in {
            strategy_pb2.SIGNAL_DIRECTION_LONG,
            strategy_pb2.SIGNAL_DIRECTION_SHORT,
            strategy_pb2.SIGNAL_DIRECTION_FLAT,
        }:
            reject("ENGINE_SIGNAL_DIRECTION")
        try:
            for value in (signal.strength.value, signal.confidence.value):
                decimal = Decimal(value)
                if not decimal.is_finite() or not 0 <= decimal <= 1:
                    reject("ENGINE_SIGNAL_DECIMAL")
            if (
                not signal.HasField("generated_at")
                or not signal.HasField("valid_until")
                or signal.valid_until.ToDatetime() <= signal.generated_at.ToDatetime()
            ):
                reject("ENGINE_SIGNAL_TIME")
        except (InvalidOperation, ValueError, OverflowError):
            reject("ENGINE_SIGNAL_INVALID")
        diagnostics = json_document_to_mapping(signal.diagnostics)
        for field in ("strategy_version", "model_version", "data_version", "model_digest"):
            identifier(diagnostics.get(field))
        digest = diagnostics["model_digest"]
        if (
            not digest.startswith("sha256:")
            or len(digest) != 71
            or any(c not in "0123456789abcdef" for c in digest[7:])
        ):
            reject("ENGINE_SIGNAL_DIGEST")
        for field in (
            "trade_executable",
            "release_resolved",
            "snapshot_bytes_resolved",
            "upstream_runtime_loaded",
            "tools_executed",
        ):
            if diagnostics.get(field, False) is not False:
                reject("ENGINE_SIGNAL_AUTHORITY", grpc.StatusCode.PERMISSION_DENIED)
        if not signal.evidence_refs or any(
            not e.evidence_id or not e.artifact_id or not e.summary for e in signal.evidence_refs
        ):
            reject("ENGINE_SIGNAL_EVIDENCE")
        data_query = payload.get("data_query")
        if data_query is not None:
            if not isinstance(data_query, dict):
                reject("ENGINE_DATA_QUERY_INVALID")
            for section in ("license", "lineage", "usage"):
                if section in data_query and not isinstance(data_query[section], dict):
                    reject("ENGINE_DATA_QUERY_INVALID")
            for section, names in (
                (data_query, ("provider", "dataset", "schema_ref", "query_id", "response_hash")),
                (data_query.get("license", {}), ("label",)),
                (data_query.get("lineage", {}), ("content_hash", "schema_hash")),
            ):
                if any(name in section and not isinstance(section[name], str) for name in names):
                    reject("ENGINE_DATA_QUERY_INVALID")
            for section, flag in (
                ("license", "approved_for_production"),
                ("usage", "trading_approved"),
            ):
                if data_query.get(section, {}).get(flag, False) is not False:
                    reject("ENGINE_DATA_AUTHORITY_FORBIDDEN", grpc.StatusCode.PERMISSION_DENIED)
        return TranslatedRequest(
            ProposalExecutionContext(
                capability=request.capability,
                workflow_run_id=request.workflow_run_id,
                tenant_id=request.metadata.tenant_id,
                workspace_id=request.metadata.workspace_id,
                actor_id=request.metadata.actor.actor_id,
                input_hash=input_hash(request.input),
                metadata_hash=hashlib.sha256(
                    request.metadata.SerializeToString(deterministic=True)
                ).hexdigest(),
                policy_context_ref=request.policy_context_ref,
                account_id=payload["account_id"],
                policy_snapshot_id=payload["policy_snapshot_id"],
                portfolio_snapshot_id=payload["portfolio_snapshot_id"],
                fixture_name=fixture_name,
                signal=signal,
                requested_tools=tuple(tools),
                data_query_context=data_query,
            ),
            payload,
        )

    @staticmethod
    def _reject_forbidden_fields(value, *, authority=False, allow_false=False):
        if isinstance(value, dict):
            for key, nested in value.items():
                normalized = key.lower().replace("-", "").replace("_", "")
                if normalized in {k.replace("_", "") for k in FORBIDDEN_FIELDS} or (
                    authority and normalized in {k.replace("_", "") for k in AUTHORITY_FIELDS}
                ):
                    if not (allow_false and normalized == "toolsexecuted" and nested is False):
                        reject(
                            "ENGINE_BOUNDARY_FORBIDDEN: field forbidden",
                            grpc.StatusCode.PERMISSION_DENIED,
                        )
                TradingAgentsRequestAdapter._reject_forbidden_fields(
                    nested, authority=authority, allow_false=allow_false
                )
        elif isinstance(value, list):
            for nested in value:
                TradingAgentsRequestAdapter._reject_forbidden_fields(
                    nested, authority=authority, allow_false=allow_false
                )
