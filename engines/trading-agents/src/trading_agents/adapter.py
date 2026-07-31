"""Boundary validation and request translation for TP04 TradingAgents."""

from __future__ import annotations

from dataclasses import dataclass

import grpc
from google.protobuf import json_format

from quantos.engine.v1 import engine_pb2
from quantos.strategy.v1 import strategy_pb2
from quantos_engine_sdk import json_document_to_mapping

from trading_agents.fixtures import fixture_names
from trading_agents.manifest import PROPOSAL_CAPABILITY


SUPPORTED_CAPABILITIES = {PROPOSAL_CAPABILITY}
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
}


class RequestBoundaryError(Exception):
    """Raised when a request crosses the TP04 boundary."""

    def __init__(self, code: grpc.StatusCode, detail: str) -> None:
        super().__init__(detail)
        self.code = code


@dataclass(frozen=True)
class ProposalExecutionContext:
    capability: str
    workflow_run_id: str
    tenant_id: str
    actor_id: str
    account_id: str
    policy_snapshot_id: str
    portfolio_snapshot_id: str
    fixture_name: str
    signal: strategy_pb2.Signal
    requested_tools: tuple[str, ...]


@dataclass(frozen=True)
class TranslatedRequest:
    context: ProposalExecutionContext
    payload: dict


class TradingAgentsRequestAdapter:
    """Translate and validate QuantOS ExecuteRequest payloads for TP04."""

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
                "actor is missing required trading-agents capability",
            )

        payload = json_document_to_mapping(request.input)
        self._reject_forbidden_fields(payload)

        requested_tools = tuple(str(tool).strip() for tool in payload.get("tools", []))
        self._reject_forbidden_tools(requested_tools)

        account_id = str(payload.get("account_id", "")).strip()
        if not account_id:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "`account_id` is required for trading-agents",
            )

        policy_snapshot_id = str(payload.get("policy_snapshot_id", "")).strip()
        if not policy_snapshot_id:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "`policy_snapshot_id` is required for trading-agents",
            )

        portfolio_snapshot_id = str(payload.get("portfolio_snapshot_id", "")).strip()
        if not portfolio_snapshot_id:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "`portfolio_snapshot_id` is required for trading-agents",
            )

        fixture_name = str(payload.get("fixture", fixture_names()[0])).strip() or fixture_names()[0]
        signal_payload = payload.get("signal")
        if not isinstance(signal_payload, dict):
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "`signal` is required and must be a JSON object",
            )

        try:
            signal = json_format.ParseDict(signal_payload, strategy_pb2.Signal())
        except json_format.ParseError as error:
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"invalid `signal` payload: {error}",
            ) from error

        if not signal.strategy_release_id.strip():
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "signal.strategy_release_id is required",
            )
        if not signal.symbol.strip():
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "signal.symbol is required",
            )
        if signal.symbol != payload.get("symbol", signal.symbol):
            raise RequestBoundaryError(
                grpc.StatusCode.INVALID_ARGUMENT,
                "top-level symbol must match signal.symbol when provided",
            )

        context = ProposalExecutionContext(
            capability=request.capability,
            workflow_run_id=request.workflow_run_id,
            tenant_id=request.metadata.tenant_id,
            actor_id=request.metadata.actor.actor_id,
            account_id=account_id,
            policy_snapshot_id=policy_snapshot_id,
            portfolio_snapshot_id=portfolio_snapshot_id,
            fixture_name=fixture_name,
            signal=signal,
            requested_tools=requested_tools,
        )
        return TranslatedRequest(context=context, payload=payload)

    @staticmethod
    def _reject_forbidden_fields(payload: dict) -> None:
        for key in FORBIDDEN_FIELDS:
            if key in payload:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    f"`{key}` is forbidden for trading-agents",
                )

    @staticmethod
    def _reject_forbidden_tools(requested_tools: tuple[str, ...]) -> None:
        for tool in requested_tools:
            if tool not in ALLOWED_TOOLS:
                raise RequestBoundaryError(
                    grpc.StatusCode.PERMISSION_DENIED,
                    f"tool `{tool}` is forbidden for trading-agents",
                )
