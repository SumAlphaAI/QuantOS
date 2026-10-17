#[path = "support/tp07_fixture.rs"]
mod fixture;
use chrono::Duration;
use fixture::Fixture;
use quantos_core::ContentHash;
use quantos_execution::{authority::*, dispatch::*, gateway::*};
use quantos_risk::guard::{KillScope, Phase};
use rust_decimal::Decimal;
use std::{
    sync::{
        Arc, Barrier,
        atomic::{AtomicUsize, Ordering},
    },
    thread,
};
fn limits() -> GatewayLimits {
    GatewayLimits {
        max_quantity: Decimal::new(100, 0),
        max_notional: Decimal::new(50_000, 0),
        allowed_venues: vec!["OWNED_PAPER".into()],
    }
}
fn issued(
    f: &Fixture,
) -> (
    AtomicCommandIssuer,
    quantos_risk::guard::RiskGuard,
    SignedCommand,
) {
    let g = f.guard();
    let i = f.issuer(&g);
    let p = f.register(&i);
    let d = f.eval(&g, Phase::Pre);
    let c = i.issue(&f.auth, &p, &d, None, f.sources(), f.now).unwrap();
    (i, g, c)
}
#[test]
fn tp07_x03_paper_consumption_replay_and_owned_events() {
    let f = Fixture::new();
    let (i, _, c) = issued(&f);
    let service =
        SignedExecutionGateway::new(i.clone(), limits(), PaperKernel::new("100")).unwrap();
    let a = service.submit(&f.auth, &c, f.sources(), f.now).unwrap();
    assert!(!a.submission.replayed);
    assert_eq!(a.order.status, "filled");
    assert_eq!(a.order.command_id, c.command_id.to_string());
    assert_eq!(a.fills.len(), 1);
    assert_eq!(a.fills[0].order_id, a.order.order_id);
    assert_eq!(a.fills[0].filled_at, f.now);
    let b = service.submit(&f.auth, &c, f.sources(), f.now).unwrap();
    assert!(b.submission.replayed);
    assert_eq!(a.order, b.order);
    assert_eq!(a.fills, b.fills);
    assert_eq!(service.downstream_submission_count(), Some(1));
    i.verify_audit(&i.audit_log(&f.owner()).unwrap()).unwrap();
}
#[tokio::test(flavor = "multi_thread", worker_threads = 16)]
async fn tp07_one_thousand_concurrent_x03_consumers_submit_once() {
    let f = Arc::new(Fixture::new());
    let (i, _, c) = issued(&f);
    let c = Arc::new(c);
    let service = SignedExecutionGateway::new(i, limits(), PaperKernel::new("100")).unwrap();
    let barrier = Arc::new(tokio::sync::Barrier::new(1000));
    let mut tasks = vec![];
    for _ in 0..1000 {
        let (f, c, s, b) = (f.clone(), c.clone(), service.clone(), barrier.clone());
        tasks.push(tokio::spawn(async move {
            b.wait().await;
            s.submit(&f.auth, &c, f.sources(), f.now).unwrap()
        }));
    }
    let mut first = 0;
    let mut ids = std::collections::BTreeSet::new();
    for task in tasks {
        let r = task.await.unwrap();
        first += usize::from(!r.submission.replayed);
        ids.insert(r.submission.order_id);
        assert_eq!(r.fills.len(), 1);
    }
    assert_eq!(first, 1);
    assert_eq!(ids.len(), 1);
    assert_eq!(service.downstream_submission_count(), Some(1));
}
#[test]
fn tp07_replays_recheck_current_risk_identity_expiry_release_and_kill() {
    let f = Fixture::new();
    let (i, g, c) = issued(&f);
    let service = SignedExecutionGateway::new(i, limits(), PaperKernel::new("100")).unwrap();
    service.submit(&f.auth, &c, f.sources(), f.now).unwrap();
    let mut wrong = f.auth.clone();
    wrong.actor_id = quantos_core::ActorId::new();
    assert!(service.submit(&wrong, &c, f.sources(), f.now).is_err());
    wrong = f.auth.clone();
    wrong.capabilities.clear();
    assert!(service.submit(&wrong, &c, f.sources(), f.now).is_err());
    let mut tampered = c.clone();
    tampered.intent.quantity = "11".into();
    assert!(
        service
            .submit(&f.auth, &tampered, f.sources(), f.now)
            .is_err()
    );
    let mut stale = f.clone();
    stale.financials.as_of -= Duration::hours(1);
    assert!(service.submit(&f.auth, &c, stale.sources(), f.now).is_err());
    let mut bad = f.clone();
    bad.venue.venue = "unapproved".into();
    assert!(service.submit(&f.auth, &c, bad.sources(), f.now).is_err());
    bad = f.clone();
    bad.release.content_hash = ContentHash::sha256_bytes(b"invalid release");
    assert!(service.submit(&f.auth, &c, bad.sources(), f.now).is_err());
    assert!(
        service
            .submit(&f.auth, &c, f.sources(), c.expires_at)
            .is_err()
    );
    assert_eq!(
        service
            .submit(&f.auth, &c, f.sources(), f.now)
            .unwrap()
            .fills
            .len(),
        1
    );
    g.set_kill_switch(
        &f.owner(),
        KillScope::Global,
        true,
        0,
        "tp07 refusal",
        f.now,
    )
    .unwrap();
    assert!(service.submit(&f.auth, &c, f.sources(), f.now).is_err());
    assert_eq!(service.downstream_submission_count(), Some(1));
}
#[test]
fn tp07_consumed_approval_is_bound_to_the_same_command_and_never_reconsumed() {
    let mut f = Fixture::new();
    f.intent.quantity = "400".into();
    f.policy.limits.max_notional_per_order = 100_000.;
    f.policy.limits.approval_notional_threshold = 30_000.;
    let g = f.guard();
    let i = f.issuer(&g);
    let p = f.register(&i);
    let (a, d) = f.approved(&g, &i, &p);
    let c = i
        .issue(&f.auth, &p, &d, Some(a), f.sources(), f.now)
        .unwrap();
    let mut l = limits();
    l.max_quantity = Decimal::new(1000, 0);
    let service = SignedExecutionGateway::new(i.clone(), l, PaperKernel::new("100")).unwrap();
    for _ in 0..10 {
        service.submit(&f.auth, &c, f.sources(), f.now).unwrap();
    }
    let receipt = i.approval_status(&f.auth, a).unwrap();
    assert_eq!(receipt.state, ApprovalState::Consumed);
    assert_eq!(receipt.revision, 2);
    assert_eq!(receipt.command_id, Some(c.command_id));
    assert_eq!(service.downstream_submission_count(), Some(1));
    let mut changed = c.clone();
    changed.approval.as_mut().unwrap().command_id = None;
    assert!(
        service
            .submit(&f.auth, &changed, f.sources(), f.now)
            .is_err()
    );
}
struct FaultKernel {
    calls: Arc<AtomicUsize>,
    mode: u8,
    pending: Vec<KernelEvent>,
}
impl ExecutionKernel for FaultKernel {
    fn submit(&mut self, c: &BoundaryCommand) -> Result<(), String> {
        self.submit_at(c, c.expires_at - Duration::seconds(1))
    }
    fn submit_at(
        &mut self,
        c: &BoundaryCommand,
        now: chrono::DateTime<chrono::Utc>,
    ) -> Result<(), String> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        if self.mode == 0 {
            return Err("possibly accepted: sensitive backend detail must not leak".into());
        }
        self.pending.push(KernelEvent::OrderAccepted {
            command_id: if self.mode == 1 {
                "unknown".into()
            } else {
                c.command_id.clone()
            },
            venue_order_id: "owned-venue-order".into(),
            at: now,
        });
        Ok(())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        std::mem::take(&mut self.pending)
    }
}
#[test]
fn tp07_uncertain_submission_and_invalid_events_are_quarantined_without_retry() {
    for mode in [0, 1] {
        let f = Fixture::new();
        let (i, _, c) = issued(&f);
        let calls = Arc::new(AtomicUsize::new(0));
        let s = SignedExecutionGateway::new(
            i,
            limits(),
            FaultKernel {
                calls: calls.clone(),
                mode,
                pending: vec![],
            },
        )
        .unwrap();
        for _ in 0..3 {
            let e = s
                .submit(&f.auth, &c, f.sources(), f.now)
                .unwrap_err()
                .to_string();
            assert!(!e.contains("sensitive backend"));
        }
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(s.downstream_submission_count(), Some(1));
    }
}
struct BlockingKernel {
    entered: std::sync::mpsc::Sender<()>,
    barrier: Arc<Barrier>,
    committed: Arc<AtomicUsize>,
}
impl ExecutionKernel for BlockingKernel {
    fn submit(&mut self, _: &BoundaryCommand) -> Result<(), String> {
        self.entered.send(()).unwrap();
        self.barrier.wait();
        self.committed.store(1, Ordering::SeqCst);
        Ok(())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        vec![]
    }
}
#[test]
fn tp07_kill_cas_cannot_interleave_current_validation_and_kernel_submission() {
    let f = Arc::new(Fixture::new());
    let (i, g, c) = issued(&f);
    let (tx, rx) = std::sync::mpsc::channel();
    let b = Arc::new(Barrier::new(2));
    let committed = Arc::new(AtomicUsize::new(0));
    let service = SignedExecutionGateway::new(
        i,
        limits(),
        BlockingKernel {
            entered: tx,
            barrier: b.clone(),
            committed: committed.clone(),
        },
    )
    .unwrap();
    let ff = f.clone();
    let submit = thread::spawn(move || service.submit(&ff.auth, &c, ff.sources(), ff.now).unwrap());
    rx.recv().unwrap();
    let ff = f.clone();
    let flag = committed.clone();
    let kill = thread::spawn(move || {
        g.set_kill_switch(
            &ff.owner(),
            KillScope::Global,
            true,
            0,
            "after dispatch",
            ff.now,
        )
        .unwrap();
        assert_eq!(flag.load(Ordering::SeqCst), 1);
    });
    b.wait();
    submit.join().unwrap();
    kill.join().unwrap();
}
#[test]
fn tp07_boundary_rejection_has_no_side_effect_and_allows_corrected_retry() {
    let f = Fixture::new();
    let (i, _, c) = issued(&f);
    let mut l = limits();
    l.allowed_venues = vec!["other".into()];
    let s = SignedExecutionGateway::new(i.clone(), l, PaperKernel::new("100")).unwrap();
    assert!(s.submit(&f.auth, &c, f.sources(), f.now).is_err());
    assert_eq!(s.downstream_submission_count(), Some(0));
    let s = SignedExecutionGateway::new(i, limits(), PaperKernel::new("100")).unwrap();
    assert!(s.submit(&f.auth, &c, f.sources(), f.now).is_ok());
    let mut wrong = c;
    wrong.signature = ContentHash::sha256_bytes(b"public checksum is not authority")
        .as_str()
        .into();
    assert!(s.submit(&f.auth, &wrong, f.sources(), f.now).is_err());
}

#[test]
fn tp07_independent_gateway_cannot_reconsume_a_claimed_or_uncertain_x03_command() {
    for uncertain in [false, true] {
        let f = Fixture::new();
        let (i, _, c) = issued(&f);
        let calls = Arc::new(AtomicUsize::new(0));
        let first = SignedExecutionGateway::new(
            i.clone(),
            limits(),
            FaultKernel {
                calls: calls.clone(),
                mode: if uncertain { 0 } else { 2 },
                pending: vec![],
            },
        )
        .unwrap();
        let result = first.submit(&f.auth, &c, f.sources(), f.now);
        assert_eq!(result.is_err(), uncertain);
        let second = SignedExecutionGateway::new(i, limits(), PaperKernel::new("100")).unwrap();
        assert!(second.submit(&f.auth, &c, f.sources(), f.now).is_err());
        assert_eq!(second.downstream_submission_count(), Some(0));
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }
}
