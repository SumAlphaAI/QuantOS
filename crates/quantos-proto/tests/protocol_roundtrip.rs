use prost::Message;
use quantos_proto::quantos::{
    common::v1::{ActorKind, ActorRef, CommandMetadata, Environment, RuntimeMode},
    trading::v1::{
        OrderIntentType, OrderSide, RiskVerdict, TradeCommand, TradeProposal, VenueKind,
    },
};
use serde_json::Value;

fn metadata_fixture(index: usize) -> CommandMetadata {
    CommandMetadata {
        request_id: format!("req-{index}"),
        tenant_id: "tenant-primary".to_string(),
        workspace_id: "workspace-primary".to_string(),
        actor: Some(ActorRef {
            actor_id: format!("actor-{index}"),
            actor_kind: ActorKind::User as i32,
            display_name: "QuantOS Tester".to_string(),
            capabilities: vec!["research.run".to_string(), "trading.review".to_string()],
        }),
        correlation_id: format!("corr-{index}"),
        causation_id: format!("cause-{index}"),
        mode: RuntimeMode::Paper as i32,
        environment: Environment::Test as i32,
        issued_at: Some(pbjson_types::Timestamp {
            seconds: 1_700_000_000 + index as i64,
            nanos: 0,
        }),
    }
}

#[test]
fn command_metadata_schema_requires_audit_fields() {
    let schema = include_str!("../../../proto/jsonschema/v1CommandMetadata.schema.json");
    let parsed: Value = serde_json::from_str(schema).expect("schema parses");
    let required = parsed["required"]
        .as_array()
        .expect("required array present")
        .iter()
        .filter_map(Value::as_str)
        .collect::<Vec<_>>();

    for field in [
        "request_id",
        "tenant_id",
        "workspace_id",
        "actor",
        "correlation_id",
        "mode",
        "environment",
        "issued_at",
    ] {
        assert!(required.contains(&field), "missing required field {field}");
    }
}

#[test]
fn trade_command_roundtrips_across_one_thousand_fixtures() {
    for index in 0..1000 {
        let original = TradeCommand {
            metadata: Some(metadata_fixture(index)),
            command_id: format!("cmd-{index}"),
            decision_id: format!("decision-{index}"),
            account_id: "paper-account".to_string(),
            venue: "binance".to_string(),
            venue_kind: VenueKind::Cex as i32,
            symbol: "BTCUSDT".to_string(),
            intent: OrderIntentType::Limit as i32,
            side: OrderSide::Buy as i32,
            quantity: Some(quantos_proto::quantos::common::v1::DecimalValue {
                value: format!("{}", 100 + index),
            }),
            limit_price: Some(quantos_proto::quantos::common::v1::DecimalValue {
                value: "65000.25".to_string(),
            }),
            stop_price: None,
            idempotency_key: format!("idem-{index}"),
            approval_signature: String::new(),
            expires_at: Some(pbjson_types::Timestamp {
                seconds: 1_700_010_000 + index as i64,
                nanos: 0,
            }),
        };

        let bytes = original.encode_to_vec();
        let decoded = TradeCommand::decode(bytes.as_slice()).expect("trade command decodes");

        assert_eq!(decoded, original, "fixture {index} should roundtrip");
    }
}

#[test]
fn trade_proposal_verdict_values_are_stable() {
    let proposal = TradeProposal {
        metadata: Some(metadata_fixture(7)),
        proposal_id: "proposal-7".to_string(),
        account_id: "paper-account".to_string(),
        symbol: "ETHUSDT".to_string(),
        action: quantos_proto::quantos::trading::v1::ProposalAction::Buy as i32,
        quantity: Some(quantos_proto::quantos::common::v1::DecimalValue {
            value: "2.5".to_string(),
        }),
        notional: Some(quantos_proto::quantos::common::v1::DecimalValue {
            value: "7500".to_string(),
        }),
        limit_price: None,
        stop_price: None,
        signal: None,
        evidence_refs: Vec::new(),
        rationale: "Momentum confirmation".to_string(),
        confidence: Some(quantos_proto::quantos::common::v1::DecimalValue {
            value: "0.87".to_string(),
        }),
        expires_at: Some(pbjson_types::Timestamp {
            seconds: 1_700_020_000,
            nanos: 0,
        }),
        executable: false,
    };

    assert_eq!(proposal.action, 1);
    assert_eq!(RiskVerdict::ApprovalRequired as i32, 3);
}
