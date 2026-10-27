#[path = "support/l03_fixture.rs"]
mod support;
use chrono::Duration;
use quantos_execution::{assisted::*, assisted_execution::*, gateway::*};
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
use support::*;
struct Kernel {
    calls: Arc<AtomicUsize>,
    unknown: bool,
    events: Vec<KernelEvent>,
}
impl ExecutionKernel for Kernel {
    fn submit(&mut self, c: &BoundaryCommand) -> Result<(), String> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        if self.unknown {
            return Err("owned committed response loss".into());
        }
        self.events.push(KernelEvent::OrderAccepted {
            command_id: c.command_id.clone(),
            venue_order_id: c.command_id.clone(),
            at: at(),
        });
        Ok(())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        std::mem::take(&mut self.events)
    }
}
fn native(f: &Fixture, unknown: bool) -> (AssistedExecution<Kernel>, Arc<AtomicUsize>) {
    let calls = Arc::new(AtomicUsize::new(0));
    let n = AssistedExecution::new(
        f.service.clone(),
        GatewayLimits {
            max_quantity: 1000.into(),
            max_notional: 50000.into(),
            allowed_venues: vec![f.subject.venue.clone()],
        },
        Kernel {
            calls: calls.clone(),
            unknown,
            events: vec![],
        },
        key(),
    )
    .unwrap();
    (n, calls)
}
#[test]
fn core_l03_two_approvals_and_same_subject_issue_one_native_command_under_concurrency() {
    let f = Fixture::new(true);
    let r = f.pair();
    let (n, calls) = native(&f, false);
    std::thread::scope(|s| {
        let joins = (0..32)
            .map(|_| {
                let n = n.clone();
                s.spawn(move || n.submit("operator", r.request, "same", at()).unwrap())
            })
            .collect::<Vec<_>>();
        let rows = joins
            .into_iter()
            .map(|j| j.join().unwrap())
            .collect::<Vec<_>>();
        assert!(rows.iter().all(|x| x == &rows[0]));
        assert_eq!(rows[0].subject_hash, r.subject_hash);
        assert_eq!(rows[0].state, "accepted");
        let o = rows[0].order.as_ref().unwrap();
        assert_eq!(o.account_id, f.scope.account.to_string());
        assert_eq!(o.side, "buy");
        assert_eq!(o.quantity, f.subject.quantity);
    });
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(n.submission_count().unwrap(), 1);
    assert!(n.submit("operator", r.request, "fresh-key", at()).is_err());
}
#[test]
fn core_l03_receipt_is_not_a_grant_and_requester_cannot_skip_second_approval() {
    let f = Fixture::new(true);
    let r = f.open();
    let (n, calls) = native(&f, false);
    assert!(n.submit("operator", r.request, "k", at()).is_err());
    let proof = f.proof("first", r.request);
    f.service
        .approve("first", r.request, 0, "first", proof, at())
        .unwrap();
    assert!(n.submit("operator", r.request, "k", at()).is_err());
    assert_eq!(calls.load(Ordering::SeqCst), 0);
}
#[test]
fn core_l03_rechecks_policy_subject_and_each_current_session_on_cache_hit() {
    for kind in [
        "policy",
        "requester",
        "approver",
        "subject",
        "generation",
        "requester-generation",
    ] {
        let f = Fixture::new(true);
        let r = f.pair();
        let (n, calls) = native(&f, false);
        n.submit("operator", r.request, "k", at()).unwrap();
        match kind {
            "policy" => {
                f.service.update_policy(1, Policy::default(), at()).unwrap();
            }
            "requester" => f.service.revoke_session("operator").unwrap(),
            "approver" => f.service.revoke_session("first").unwrap(),
            "subject" => f.service.revoke_subject(f.subject.id).unwrap(),
            k => {
                let name = if k == "requester-generation" {
                    "operator"
                } else {
                    "first"
                };
                let mut next = f.sessions[name].clone();
                next.revision += 1;
                f.service.update_session(name, 1, next).unwrap();
            }
        }
        assert!(
            n.submit("operator", r.request, "k", at()).is_err(),
            "{kind}"
        );
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }
}
#[test]
fn core_l03_original_command_deadline_is_half_open_but_read_facts_survive_approval_expiry() {
    let f = Fixture::new(true);
    let r = f.pair();
    let (n, calls) = native(&f, false);
    let c = n.submit("operator", r.request, "k", at()).unwrap();
    assert_eq!(c.expires_at, at() + Duration::seconds(30));
    assert!(n.submit("operator", r.request, "k", c.expires_at).is_err());
    assert_eq!(
        n.inspect("operator", r.request, at() + Duration::seconds(121))
            .unwrap(),
        Some(c)
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
#[test]
fn core_l03_unknown_kernel_result_never_resubmits_or_changes_identity() {
    let f = Fixture::new(true);
    let r = f.pair();
    let (n, calls) = native(&f, true);
    let c = n.submit("operator", r.request, "k", at()).unwrap();
    assert_eq!(c.state, "unknown");
    assert_eq!(n.submit("operator", r.request, "k", at()).unwrap(), c);
    assert!(
        n.submit("operator", r.request, "replacement", at())
            .is_err()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
#[test]
fn core_l03_approver_viewer_and_wrong_session_never_submit() {
    let f = Fixture::new(true);
    let r = f.pair();
    let (n, calls) = native(&f, false);
    for who in ["first", "second", "viewer", "missing", "owner"] {
        assert!(n.submit(who, r.request, "k", at()).is_err(), "{who}");
    }
    assert_eq!(calls.load(Ordering::SeqCst), 0);
}
#[test]
fn core_l03_subject_side_and_bytes_are_bound_by_approval_hash() {
    let f = Fixture::new(true);
    let r = f.pair();
    let mut changed = f.subject.clone();
    changed.side = quantos_execution::OrderSide::Sell;
    assert!(f.service.register_subject(changed).is_err());
    let (n, _) = native(&f, false);
    assert_eq!(
        n.submit("operator", r.request, "k", at())
            .unwrap()
            .subject_hash,
        r.subject_hash
    );
}
#[test]
fn core_l03_new_approval_request_cannot_trade_same_immutable_proposal_twice() {
    let f = Fixture::new(true);
    let r = f.pair();
    let (n, calls) = native(&f, false);
    n.submit("operator", r.request, "first-command", at())
        .unwrap();
    let next = f
        .service
        .open("operator", f.subject.id, "new-request", at())
        .unwrap()
        .receipt;
    for (slot, who) in ["first", "second"].iter().enumerate() {
        f.service
            .approve(
                who,
                next.request,
                slot as u64,
                &format!("new-{slot}"),
                f.proof(who, next.request),
                at(),
            )
            .unwrap();
    }
    assert!(
        n.submit("operator", next.request, "second-command", at())
            .is_err()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
#[test]
fn core_l03_original_f06_deadline_cannot_be_extended_by_native_challenge() {
    let f = Fixture::new(true);
    let r = f.open();
    let original = at() + Duration::seconds(12);
    let c = f
        .service
        .challenge_until("first", r.request, Some(original), at())
        .unwrap();
    assert_eq!(c.expires_at, original);
    let p = f.mfa.attest_provider_completed(c, at()).unwrap();
    assert!(
        f.service
            .approve("first", r.request, 0, "expired-native", p, original)
            .is_err()
    );
}
