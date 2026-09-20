"""Decode and deterministically re-encode cross-language protocol fixtures."""

from __future__ import annotations

import sys

from quantos.events.v1 import events_pb2
from quantos.research.v1 import research_pb2
from quantos.strategy.v1 import strategy_pb2
from quantos.trading.v1 import trading_pb2
from quantos_engine_sdk.validation import validate_message_metadata


MESSAGE_TYPES = {
    "DataSnapshot": research_pb2.DataSnapshot,
    "ResearchArtifact": research_pb2.ResearchArtifact,
    "StrategyRelease": strategy_pb2.StrategyRelease,
    "Signal": strategy_pb2.Signal,
    "TradeProposal": trading_pb2.TradeProposal,
    "RiskDecision": trading_pb2.RiskDecision,
    "TradeCommand": trading_pb2.TradeCommand,
    "Order": trading_pb2.Order,
    "Fill": trading_pb2.Fill,
    "Position": trading_pb2.Position,
    "EventEnvelope": events_pb2.EventEnvelope,
}

for source_line in sys.stdin:
    type_name, encoded = source_line.strip().split("\t", 1)
    message = MESSAGE_TYPES[type_name].FromString(bytes.fromhex(encoded))
    validate_message_metadata(message)
    print(f"{type_name}\t{message.SerializeToString(deterministic=True).hex()}")
