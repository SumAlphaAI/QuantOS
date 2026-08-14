use prost::Message;
use quantos_proto::quantos::{
    common::v1::{
        ActorKind, ActorRef, CommandMetadata, DataQuality, DataSourceRef, DecimalValue,
        Environment, MoneyValue, RuntimeMode, TimeWindow,
    },
    events::v1::{EventEnvelope, EventKind, event_envelope},
    research::v1::{DataSnapshot, ResearchArtifact},
    strategy::v1::{DeploymentTarget, Signal, SignalDirection, StrategyRelease},
    trading::v1::{
        Fill, Order, OrderIntentType, OrderSide, OrderStatus, Position, PositionSide,
        ProposalAction, RiskDecision, RiskVerdict, TradeCommand, TradeProposal, VenueKind,
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

fn timestamp(index: usize, offset: i64) -> pbjson_types::Timestamp {
    pbjson_types::Timestamp {
        seconds: 1_700_000_000 + index as i64 + offset,
        nanos: (index % 1_000) as i32,
    }
}

fn decimal(value: impl ToString) -> DecimalValue {
    DecimalValue {
        value: value.to_string(),
    }
}

fn assert_roundtrip<M>(original: &M, type_name: &str, index: usize)
where
    M: Message + Default + PartialEq + std::fmt::Debug,
{
    let bytes = original.encode_to_vec();
    let decoded = M::decode(bytes.as_slice()).expect("fixture decodes");
    assert_eq!(&decoded, original, "{type_name} fixture {index} differs");
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
fn every_planned_domain_type_roundtrips_across_one_thousand_fixture_sets() {
    for index in 0..1000 {
        let metadata = metadata_fixture(index);
        let snapshot = DataSnapshot {
            metadata: Some(metadata.clone()),
            snapshot_id: format!("snapshot-{index}"),
            schema_version: "v1".to_owned(),
            window: Some(TimeWindow {
                start_at: Some(timestamp(index, 0)),
                end_at: Some(timestamp(index, 60)),
            }),
            sources: vec![DataSourceRef {
                source_id: format!("source-{index}"),
                provider: "fixture".to_owned(),
                dataset: "ohlcv".to_owned(),
                license_label: "internal".to_owned(),
            }],
            quality: DataQuality::Passed as i32,
            content_hash: format!("snapshot-hash-{index}"),
            license_label: "internal".to_owned(),
            captured_at: Some(timestamp(index, 61)),
            max_age: Some(pbjson_types::Duration {
                seconds: 300,
                nanos: 0,
            }),
            symbols: vec!["BTCUSDT".to_owned()],
            artifact_refs: vec![],
        };
        let research = ResearchArtifact {
            metadata: Some(metadata.clone()),
            artifact_id: format!("research-{index}"),
            title: format!("Research {index}"),
            hypothesis: "momentum persists".to_owned(),
            summary: "deterministic fixture".to_owned(),
            content_hash: format!("research-hash-{index}"),
            engine_version: "1.0.0".to_owned(),
            prompt_version: "prompt-v1".to_owned(),
            code_version: "code-v1".to_owned(),
            environment_hash: "environment-v1".to_owned(),
            data_snapshot_id: snapshot.snapshot_id.clone(),
            evidence_refs: vec![],
            attachments: vec![],
            created_at: Some(timestamp(index, 62)),
            expires_at: Some(timestamp(index, 3600)),
            audit_tags: None,
        };
        let release = StrategyRelease {
            metadata: Some(metadata.clone()),
            release_id: format!("release-{index}"),
            strategy_id: format!("strategy-{index}"),
            name: "fixture strategy".to_owned(),
            source_digest: format!("source-digest-{index}"),
            image_digest: format!("image-digest-{index}"),
            parameter_hash: format!("parameter-hash-{index}"),
            backtest_report_artifact_id: format!("backtest-{index}"),
            data_snapshot_id: snapshot.snapshot_id.clone(),
            evidence_refs: vec![],
            allowed_targets: vec![DeploymentTarget::Paper as i32],
            approved_at: Some(timestamp(index, 63)),
            created_at: Some(timestamp(index, 62)),
        };
        let signal = Signal {
            metadata: Some(metadata.clone()),
            signal_id: format!("signal-{index}"),
            strategy_release_id: release.release_id.clone(),
            symbol: "BTCUSDT".to_owned(),
            direction: SignalDirection::Long as i32,
            strength: Some(decimal(format!("0.{}", index % 10))),
            confidence: Some(decimal("0.9")),
            diagnostics: None,
            generated_at: Some(timestamp(index, 64)),
            valid_until: Some(timestamp(index, 364)),
            evidence_refs: vec![],
        };
        let proposal = TradeProposal {
            metadata: Some(metadata.clone()),
            proposal_id: format!("proposal-{index}"),
            account_id: "paper-account".to_owned(),
            symbol: "BTCUSDT".to_owned(),
            action: ProposalAction::Buy as i32,
            quantity: Some(decimal(index + 1)),
            notional: Some(decimal(65_000 + index)),
            limit_price: Some(decimal("65000.25")),
            stop_price: None,
            signal: Some(signal.clone()),
            evidence_refs: vec![],
            rationale: "fixture rationale".to_owned(),
            confidence: Some(decimal("0.9")),
            expires_at: Some(timestamp(index, 365)),
            executable: false,
            counter_views: vec!["fixture counter-view: momentum may be exhausted".to_owned()],
        };
        let decision = RiskDecision {
            metadata: Some(metadata.clone()),
            decision_id: format!("decision-{index}"),
            proposal_id: proposal.proposal_id.clone(),
            verdict: RiskVerdict::Allow as i32,
            hit_rules: vec!["position-limit".to_owned()],
            limit_ids: vec!["limit-1".to_owned()],
            signer: "risk-engine".to_owned(),
            reason: "within limits".to_owned(),
            decided_at: Some(timestamp(index, 66)),
        };
        let command = TradeCommand {
            metadata: Some(metadata.clone()),
            command_id: format!("command-{index}"),
            decision_id: decision.decision_id.clone(),
            account_id: "paper-account".to_owned(),
            venue: "binance".to_owned(),
            venue_kind: VenueKind::Cex as i32,
            symbol: "BTCUSDT".to_owned(),
            intent: OrderIntentType::Limit as i32,
            side: OrderSide::Buy as i32,
            quantity: Some(decimal(index + 1)),
            limit_price: Some(decimal("65000.25")),
            stop_price: None,
            idempotency_key: format!("idem-{index}"),
            approval_signature: format!("approval-{index}"),
            expires_at: Some(timestamp(index, 366)),
        };
        let order = Order {
            metadata: Some(metadata.clone()),
            order_id: format!("order-{index}"),
            command_id: command.command_id.clone(),
            venue_order_id: format!("venue-order-{index}"),
            account_id: "paper-account".to_owned(),
            symbol: "BTCUSDT".to_owned(),
            side: OrderSide::Buy as i32,
            intent: OrderIntentType::Limit as i32,
            quantity: Some(decimal(index + 1)),
            filled_quantity: Some(decimal(index)),
            average_fill_price: Some(decimal("65000.25")),
            status: OrderStatus::PartiallyFilled as i32,
            submitted_at: Some(timestamp(index, 67)),
            updated_at: Some(timestamp(index, 68)),
        };
        let fill = Fill {
            metadata: Some(metadata.clone()),
            fill_id: format!("fill-{index}"),
            order_id: order.order_id.clone(),
            venue_fill_id: format!("venue-fill-{index}"),
            symbol: "BTCUSDT".to_owned(),
            quantity: Some(decimal(index + 1)),
            price: Some(decimal("65000.25")),
            fee: Some(MoneyValue {
                currency_code: "USD".to_owned(),
                units: index as i64,
                nanos: 10,
            }),
            filled_at: Some(timestamp(index, 69)),
        };
        let position = Position {
            metadata: Some(metadata.clone()),
            position_id: format!("position-{index}"),
            account_id: "paper-account".to_owned(),
            symbol: "BTCUSDT".to_owned(),
            side: PositionSide::Long as i32,
            quantity: Some(decimal(index + 1)),
            average_entry_price: Some(decimal("65000.25")),
            mark_value: Some(MoneyValue {
                currency_code: "USD".to_owned(),
                units: 65_000 + index as i64,
                nanos: 0,
            }),
            unrealized_pnl: Some(MoneyValue {
                currency_code: "USD".to_owned(),
                units: index as i64,
                nanos: 0,
            }),
            as_of: Some(timestamp(index, 70)),
        };
        let envelope = EventEnvelope {
            metadata: Some(metadata),
            event_id: format!("event-{index}"),
            kind: EventKind::Position as i32,
            aggregate_id: position.position_id.clone(),
            occurred_at: Some(timestamp(index, 71)),
            payload: Some(event_envelope::Payload::Position(position.clone())),
        };

        assert_roundtrip(&snapshot, "DataSnapshot", index);
        assert_roundtrip(&research, "ResearchArtifact", index);
        assert_roundtrip(&release, "StrategyRelease", index);
        assert_roundtrip(&signal, "Signal", index);
        assert_roundtrip(&proposal, "TradeProposal", index);
        assert_roundtrip(&decision, "RiskDecision", index);
        assert_roundtrip(&command, "TradeCommand", index);
        assert_roundtrip(&order, "Order", index);
        assert_roundtrip(&fill, "Fill", index);
        assert_roundtrip(&position, "Position", index);
        assert_roundtrip(&envelope, "EventEnvelope", index);
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
        counter_views: vec!["Counter-view: thin liquidity invalidates the setup".to_string()],
    };

    assert_eq!(proposal.action, 1);
    assert_eq!(RiskVerdict::ApprovalRequired as i32, 3);
}
