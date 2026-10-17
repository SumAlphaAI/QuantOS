#[path = "support/tp07_fixture.rs"]
#[allow(dead_code)]
mod fixture;

use chrono::{DateTime, Utc};
use fixture::Fixture;
use quantos_execution::{authority::SignedCommand, dispatch::SignedExecutionGateway, gateway::*};
use quantos_risk::guard::Phase;
use rust_decimal::Decimal;
use serde_json::Value;
use std::{
    collections::BTreeSet,
    sync::{Arc, Mutex},
};

struct ObservedPaper {
    paper: PaperKernel,
    wires: Arc<Mutex<Vec<Value>>>,
}
impl ExecutionKernel for ObservedPaper {
    fn submit(&mut self, c: &BoundaryCommand) -> Result<(), String> {
        self.submit_at(c, c.expires_at - chrono::Duration::seconds(1))
    }
    fn submit_at(&mut self, c: &BoundaryCommand, now: DateTime<Utc>) -> Result<(), String> {
        self.wires
            .lock()
            .unwrap()
            .push(serde_json::to_value(c).unwrap());
        self.paper.submit_at(c, now)
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        self.paper.drain_events()
    }
}

#[test]
fn tp12_signed_dispatch_sanitizes_current_authority_and_agent_trace_cannot_submit() {
    let f = Fixture::new();
    let guard = f.guard();
    let issuer = f.issuer(&guard);
    let proposal = f.register(&issuer);
    let decision = f.eval(&guard, Phase::Pre);
    let command = issuer
        .issue(&f.auth, &proposal, &decision, None, f.sources(), f.now)
        .unwrap();
    let wires = Arc::new(Mutex::new(vec![]));
    let gateway = SignedExecutionGateway::new(
        issuer,
        GatewayLimits {
            max_quantity: Decimal::new(100, 0),
            max_notional: Decimal::new(50_000, 0),
            allowed_venues: vec!["OWNED_PAPER".into()],
        },
        ObservedPaper {
            paper: PaperKernel::new("100"),
            wires: wires.clone(),
        },
    )
    .unwrap();
    let agent_trace = serde_json::json!({"executable": false, "advisory": "allow", "trace": "synthetic", "proposal_id": proposal});
    assert!(serde_json::from_value::<SignedCommand>(agent_trace).is_err());
    let mut forged = command.clone();
    forged.signature = "agent-trace-is-not-a-signature".into();
    assert!(
        gateway
            .submit(&f.auth, &forged, f.sources(), f.now)
            .is_err()
    );
    assert!(wires.lock().unwrap().is_empty());
    let first = gateway
        .submit(&f.auth, &command, f.sources(), f.now)
        .unwrap();
    let replay = gateway
        .submit(&f.auth, &command, f.sources(), f.now)
        .unwrap();
    assert!(replay.submission.replayed);
    assert_eq!(first.order, replay.order);
    let observed = wires.lock().unwrap();
    assert_eq!(observed.len(), 1);
    let wire = observed[0].as_object().unwrap();
    let expected: BTreeSet<_> = [
        "command_id",
        "account_id",
        "venue",
        "venue_kind",
        "symbol",
        "intent",
        "side",
        "quantity",
        "limit_price",
        "stop_price",
        "idempotency_key",
        "expires_at",
    ]
    .into_iter()
    .collect();
    assert_eq!(
        wire.keys().map(String::as_str).collect::<BTreeSet<_>>(),
        expected
    );
    assert_eq!(wire["account_id"], command.intent.account_id.to_string());
    assert_eq!(wire["venue"], "OWNED_PAPER");
    let serialized = serde_json::to_string(wire).unwrap();
    for private in [
        f.auth.tenant_id.to_string(),
        f.auth.workspace_id.to_string(),
        f.auth.actor_id.to_string(),
        command.source_decision_id.to_string(),
        command.signature.clone(),
        command.intent.command_key.clone(),
    ] {
        assert!(
            !serialized.contains(&private),
            "authority leaked to owned kernel"
        );
    }
    let first_key = wire["idempotency_key"].clone();
    drop(observed);
    let mut other = f.clone();
    other.intent.command_key = "x03-private:second-key".into();
    let guard = other.guard();
    let issuer = other.issuer(&guard);
    let proposal = other.register(&issuer);
    let decision = other.eval(&guard, Phase::Pre);
    let command = issuer
        .issue(
            &other.auth,
            &proposal,
            &decision,
            None,
            other.sources(),
            other.now,
        )
        .unwrap();
    let second_gateway = SignedExecutionGateway::new(
        issuer,
        GatewayLimits {
            max_quantity: Decimal::new(100, 0),
            max_notional: Decimal::new(50_000, 0),
            allowed_venues: vec!["OWNED_PAPER".into()],
        },
        ObservedPaper {
            paper: PaperKernel::new("100"),
            wires: wires.clone(),
        },
    )
    .unwrap();
    second_gateway
        .submit(&other.auth, &command, other.sources(), other.now)
        .unwrap();
    let observed = wires.lock().unwrap();
    assert_eq!(observed.len(), 2);
    assert_ne!(first_key, observed[1]["idempotency_key"]);
    assert!(
        !observed[1]["idempotency_key"]
            .as_str()
            .unwrap()
            .contains(&other.intent.command_key)
    );
    println!(
        "TP12_SIGNED_KERNEL_FIELDS=12 AUTHORITY_MATERIAL=ABSENT AGENT_TRACE=REFUSED DOWNSTREAM_CALLS=2 DISTINCT_KEYS=2 REPLAY_DUPLICATES=0"
    );
}
