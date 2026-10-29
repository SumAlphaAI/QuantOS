#[path = "support/l03_fixture.rs"]
mod support;
use chrono::Duration;
use quantos_execution::{assisted_execution::AssistedExecution, durable::DurableStore, gateway::*};
use serde_json::json;
use std::{
    fs,
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
};
use support::*;
struct Dir(PathBuf);
impl Dir {
    fn new() -> Self {
        let p = std::env::temp_dir()
            .canonicalize()
            .unwrap()
            .join(format!("quantos-x04-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&p).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&p, fs::Permissions::from_mode(0o700)).unwrap();
        }
        Self(p)
    }
}
impl Drop for Dir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
struct Kernel {
    calls: Arc<AtomicUsize>,
    kind: u8,
    events: Vec<KernelEvent>,
}
impl ExecutionKernel for Kernel {
    fn submit(&mut self, c: &BoundaryCommand) -> Result<(), String> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        if self.kind == 1 {
            return Err("owned uncertain reply".into());
        }
        self.events.push(KernelEvent::OrderAccepted {
            command_id: c.command_id.clone(),
            venue_order_id: c.command_id.clone(),
            at: at(),
        });
        for (id, q, fee) in [("a", "0.4", "0.08"), ("b", "0.6", "0.12")] {
            let fill = KernelEvent::OrderFilled {
                command_id: c.command_id.clone(),
                venue_order_id: c.command_id.clone(),
                venue_fill_id: id.into(),
                quantity: if self.kind == 2 { "2" } else { q }.into(),
                price: "1000".into(),
                fee_currency: if self.kind == 3 { "BNB" } else { "USDT" }.into(),
                fee_amount: fee.into(),
                at: at(),
            };
            self.events.push(fill.clone());
            self.events.push(fill); // exact venue duplicate must not double count
        }
        Ok(())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        std::mem::take(&mut self.events)
    }
}
fn native(
    f: &Fixture,
    d: &Dir,
    k: [u8; 32],
    calls: Arc<AtomicUsize>,
    kind: u8,
) -> AssistedExecution<Kernel> {
    AssistedExecution::new(
        f.service.clone(),
        GatewayLimits {
            max_quantity: 1000.into(),
            max_notional: 50000.into(),
            allowed_venues: vec![f.subject.venue.clone()],
        },
        Kernel {
            calls,
            kind,
            events: vec![],
        },
        key(),
    )
    .unwrap()
    .with_durable(DurableStore::new(&d.0, "commands", k).unwrap())
    .unwrap()
}
#[test]
fn x04_actual_fills_fees_chain_and_command_persist_across_replica_restart_and_expiry() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Dir::new();
    let storekey = key();
    let calls = Arc::new(AtomicUsize::new(0));
    let a = native(&f, &d, storekey, calls.clone(), 0);
    a.submit("operator", r.request, "original", at()).unwrap();
    let facts = a
        .execution_facts("operator", r.request, at())
        .unwrap()
        .unwrap();
    assert_eq!(facts.fills.len(), 2);
    assert_eq!(facts.fills[0].fee_amount, "0.08");
    assert_eq!(facts.fills[1].fee_amount, "0.12");
    assert_eq!(facts.order.as_ref().unwrap().filled_quantity, "1");
    assert!(facts.consumer_ready);
    assert_eq!(facts.fact_hashes.len(), 4);
    for fill in &facts.fills {
        assert_eq!(fill.command_id, facts.command_id);
        assert_eq!(fill.order_id, facts.order.as_ref().unwrap().order_id);
        assert!(facts.fact_hashes.contains(&fill.fact_hash));
    }
    let b = native(&f, &d, storekey, calls.clone(), 1);
    assert_eq!(
        b.execution_facts("operator", r.request, at() + Duration::minutes(3))
            .unwrap()
            .unwrap(),
        facts
    );
    assert!(
        b.submit(
            "operator",
            r.request,
            "original",
            at() + Duration::minutes(3)
        )
        .is_err()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    // Consume actual source rows in X01 without inventing marks or a venue ledger.
    use quantos_portfolio::*;
    let mut projection =
        InMemoryPortfolioProjection::new(f.scope.tenant, at() - Duration::seconds(1));
    for (i, fill) in facts.fills.iter().enumerate() {
        projection
            .apply(&PortfolioEvent {
                event_id: fill.fill_id.clone(),
                sequence: i as u64 + 1,
                occurred_at: fill.filled_at,
                kind: PortfolioEventKind::Fill(FillEvent {
                    account_id: f.scope.account,
                    symbol: fill.symbol.clone(),
                    side: FillSide::Buy,
                    quantity: fill.quantity.parse().unwrap(),
                    price: fill.price.parse().unwrap(),
                    fee: fill.fee_amount.parse().unwrap(),
                }),
            })
            .unwrap();
    }
    let p = projection.snapshot(f.scope.account).unwrap();
    assert_eq!(p.positions[0].quantity, 1.0);
    assert!((p.realized_pnl + 0.2).abs() < 1e-12);
}
#[test]
fn x04_unknown_is_read_only_no_fake_zero_fee_or_fill_and_never_resubmits() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Dir::new();
    let k = key();
    let calls = Arc::new(AtomicUsize::new(0));
    let a = native(&f, &d, k, calls.clone(), 1);
    let c = a.submit("operator", r.request, "original", at()).unwrap();
    assert_eq!(c.state, "unknown");
    let b = native(&f, &d, k, calls.clone(), 0);
    let facts = b
        .execution_facts("operator", r.request, at())
        .unwrap()
        .unwrap();
    assert!(!facts.consumer_ready);
    assert_eq!(facts.reason, "OUTCOME_UNRESOLVED");
    assert!(facts.fills.is_empty());
    assert_eq!(facts.outcome, "unknown");
    assert_eq!(
        b.submit("operator", r.request, "original", at()).unwrap(),
        c
    );
    assert!(b.submit("operator", r.request, "fresh", at()).is_err());
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
#[test]
fn x04_invalid_kernel_batch_remains_unknown_and_does_not_publish_partial_fills() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Dir::new();
    let calls = Arc::new(AtomicUsize::new(0));
    let a = native(&f, &d, key(), calls, 2);
    assert_eq!(
        a.submit("operator", r.request, "original", at())
            .unwrap()
            .state,
        "unknown"
    );
    let facts = a
        .execution_facts("operator", r.request, at())
        .unwrap()
        .unwrap();
    assert!(!facts.consumer_ready);
    assert!(facts.fills.is_empty());
}
#[test]
fn x04_non_quote_fees_preserved_and_conversion_remains_pending() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Dir::new();
    let a = native(&f, &d, key(), Arc::new(AtomicUsize::new(0)), 3);
    a.submit("operator", r.request, "original", at()).unwrap();
    let facts = a
        .execution_facts("operator", r.request, at())
        .unwrap()
        .unwrap();
    assert_eq!(facts.fills[0].fee_currency, "BNB");
    assert_eq!(facts.fills[0].fee_amount, "0.08");
    assert!(!facts.consumer_ready);
    assert_eq!(facts.reason, "FEE_CONVERSION_REQUIRED");
}
#[test]
fn x04_authenticated_reads_reject_revoked_foreign_sessions_and_current_corruption() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Dir::new();
    let a = native(&f, &d, key(), Arc::new(AtomicUsize::new(0)), 0);
    a.submit("operator", r.request, "original", at()).unwrap();
    assert!(a.execution_facts("foreign", r.request, at()).is_err());
    assert!(a.execution_facts("viewer", r.request, at()).is_err());
    f.service.revoke_session("operator").unwrap();
    assert!(a.execution_facts("operator", r.request, at()).is_err());
    fs::write(d.0.join("commands.json"), b"{broken").unwrap();
    assert!(a.execution_facts("first", r.request, at()).is_err());
}
#[test]
fn x04_signed_but_inconsistent_fact_snapshot_is_rejected_not_silently_rebuilt() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Dir::new();
    let k = key();
    let calls = Arc::new(AtomicUsize::new(0));
    let a = native(&f, &d, k, calls.clone(), 0);
    a.submit("operator", r.request, "original", at()).unwrap();
    let store = DurableStore::new(&d.0, "commands", k).unwrap();
    let mut v = store.lock().unwrap().read().unwrap().unwrap();
    v["issued"][r.request.to_string()]["evidence"]["fills"][0]["price"] = json!("9000");
    store.lock().unwrap().write(&v).unwrap();
    let b = native(&f, &d, k, calls.clone(), 0);
    assert!(b.execution_facts("operator", r.request, at()).is_err());
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
#[test]
fn x04_legacy_receipt_retains_original_view_without_invented_fill_evidence() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Dir::new();
    let k = key();
    let a = native(&f, &d, k, Arc::new(AtomicUsize::new(0)), 0);
    let receipt = a.submit("operator", r.request, "original", at()).unwrap();
    let store = DurableStore::new(&d.0, "commands", k).unwrap();
    let mut v = store.lock().unwrap().read().unwrap().unwrap();
    let i = v["issued"][r.request.to_string()].as_object_mut().unwrap();
    i.remove("subject");
    i.remove("evidence");
    store.lock().unwrap().write(&v).unwrap();
    let b = native(&f, &d, k, Arc::new(AtomicUsize::new(0)), 0);
    assert_eq!(
        b.inspect("operator", r.request, at()).unwrap().unwrap(),
        receipt
    );
    assert!(
        b.execution_facts("operator", r.request, at())
            .unwrap()
            .is_none()
    );
}
