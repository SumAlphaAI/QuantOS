import json
from pathlib import Path

from google.protobuf.timestamp_pb2 import Timestamp

from quantos.common.v1 import common_pb2
from quantos.trading.v1 import trading_pb2


def build_metadata(index: int) -> common_pb2.CommandMetadata:
    issued_at = Timestamp(seconds=1_700_000_000 + index, nanos=0)

    return common_pb2.CommandMetadata(
        request_id=f"req-{index}",
        tenant_id="tenant-primary",
        workspace_id="workspace-primary",
        actor=common_pb2.ActorRef(
            actor_id=f"actor-{index}",
            actor_kind=common_pb2.ActorKind.ACTOR_KIND_USER,
            display_name="QuantOS Tester",
            capabilities=["research.run", "trading.review"],
        ),
        correlation_id=f"corr-{index}",
        causation_id=f"cause-{index}",
        mode=common_pb2.RuntimeMode.RUNTIME_MODE_PAPER,
        environment=common_pb2.Environment.ENVIRONMENT_TEST,
        issued_at=issued_at,
    )


def test_python_trade_command_roundtrip() -> None:
    for index in range(1000):
        command = trading_pb2.TradeCommand(
            metadata=build_metadata(index),
            command_id=f"cmd-{index}",
            decision_id=f"decision-{index}",
            account_id="paper-account",
            venue="binance",
            venue_kind=trading_pb2.VenueKind.VENUE_KIND_CEX,
            symbol="BTCUSDT",
            intent=trading_pb2.OrderIntentType.ORDER_INTENT_TYPE_LIMIT,
            side=trading_pb2.OrderSide.ORDER_SIDE_BUY,
            quantity=common_pb2.DecimalValue(value=str(index + 1)),
            limit_price=common_pb2.DecimalValue(value="65000.25"),
            idempotency_key=f"idem-{index}",
            expires_at=Timestamp(seconds=1_700_010_000 + index, nanos=0),
        )

        decoded = trading_pb2.TradeCommand()
        decoded.ParseFromString(command.SerializeToString())

        assert decoded == command


def test_command_metadata_schema_marks_required_fields() -> None:
    schema_path = (
        Path(__file__).resolve().parents[2]
        / "proto"
        / "jsonschema"
        / "v1CommandMetadata.schema.json"
    )
    parsed = json.loads(schema_path.read_text())
    required = set(parsed["required"])

    assert {
        "request_id",
        "tenant_id",
        "workspace_id",
        "actor",
        "correlation_id",
        "mode",
        "environment",
        "issued_at",
    }.issubset(required)
