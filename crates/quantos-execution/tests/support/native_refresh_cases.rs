use super::*;
use quantos_portfolio::{
    native_ledger::{NativeLedger, Scope as LedgerScope},
    native_valuation::{self, BASIS, Inputs, Mark, SOURCE},
};
#[path = "../../../quantos-portfolio/tests/support/native_fixture.rs"]
#[allow(dead_code)]
mod facts;
fn context(f: &F, diverse: bool, generation: u64) -> NativeRiskContext {
    let scope = LedgerScope {
        tenant_id: f.f.auth.tenant_id,
        workspace_id: f.f.auth.workspace_id,
        account_id: f.f.intent.account_id,
    };
    let mut ledger = NativeLedger::new(scope.clone()).unwrap();
    let empty = ledger.view().unwrap()["ledgerHash"].clone();
    for (n, symbol, q) in [(1, "BTCUSDT", "1"), (2, "ETHUSDT", "4")]
        .into_iter()
        .take(if diverse { 2 } else { 1 })
    {
        let src = facts::edit(
            &facts::source(n, "buy", q, "1000", "0.0100000000000000000001"),
            |v| {
                v["tenantId"] = json!(scope.tenant_id);
                v["workspaceId"] = json!(scope.workspace_id);
                v["accountId"] = json!(scope.account_id);
                v["order"]["accountId"] = json!(scope.account_id);
                v["fills"][0]["accountId"] = json!(scope.account_id);
                v["order"]["symbol"] = json!(symbol);
                v["fills"][0]["symbol"] = json!(symbol);
                v["recordedAt"] = json!(f.f.now - Duration::seconds(1));
                for k in ["submittedAt", "updatedAt"] {
                    v["order"][k] = json!(f.f.now - Duration::seconds(2));
                }
                v["fills"][0]["filledAt"] = json!(f.f.now - Duration::seconds(2));
            },
        );
        ledger.observe(&src).unwrap();
    }
    let view = ledger.view().unwrap();
    let input = Inputs {
        schema_version: "quantos-native-valuation-input.v1".into(),
        source_id: SOURCE.into(),
        version: 1,
        scope,
        basis: BASIS.into(),
        origin_ledger_hash: serde_json::from_value(empty).unwrap(),
        opening_at: f.f.now - Duration::seconds(3),
        cash_source_ref: "owned:cash".into(),
        quote_cash_at_opening: "20000".into(),
        realized_pnl_before_origin_today: "-5".into(),
        quote_currency: "USDT".into(),
        ledger_hash: serde_json::from_value(view["ledgerHash"].clone()).unwrap(),
        ledger_anchor: ledger.anchor(),
        as_of: f.f.now,
        valid_until: f.f.now + Duration::seconds(30),
        cash_coverage_through: f.f.now,
        account_status: "active".into(),
        account_status_at: f.f.now,
        status_source_ref: "owned:status".into(),
        marks: view["positions"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| Mark {
                symbol: p["symbol"].as_str().unwrap().into(),
                price: "1100".into(),
                source_ref: "owned:mark".into(),
                observed_at: f.f.now,
                quality: "normal".into(),
            })
            .collect(),
    };
    NativeRiskContext {
        snapshot: native_valuation::evaluate(&ledger, &input, generation, f.f.now)
            .unwrap()
            .snapshot
            .unwrap(),
        input,
        ledger_checkpoint: ledger.checkpoint().unwrap(),
    }
}
#[test]
fn native_refresh_creates_new_review_and_subject_without_rebinding_original_proposal_or_approvals()
{
    let f = F::new();
    let old = f.subject.clone();
    let old_source = f.source.provenance(old.id).unwrap();
    let c = context(&f, true, 0);
    let r = f.source.refresh_native(old.id, c.clone(), f.f.now).unwrap();
    let subject = r.subject.as_ref().unwrap();
    assert_eq!(r.decision.verdict, RiskVerdict::ApprovalRequired);
    assert_ne!(r.decision.decision_id, old.decision);
    assert_ne!(subject.id, old.id);
    assert_eq!(subject.proposal_hash, old.proposal_hash);
    assert_eq!(r.proposal_hash, old.proposal_hash);
    assert_eq!(r.decision.snapshot_hash, c.snapshot.snapshot_hash);
    assert_ne!(r.decision.snapshot_hash, f.f.input.input_hash);
    assert!(r.decision.expires_at <= c.snapshot.expires_at);
    f.guard.verify_decision(&r.decision).unwrap();
    f.source.with_current(subject, f.f.now, || ()).unwrap();
    assert_eq!(f.source.provenance(old.id).unwrap(), old_source);
    f.service.register_subject(subject.clone()).unwrap();
    let opened = f
        .service
        .open("requester", subject.id, "new-current-review", f.f.now)
        .unwrap();
    assert_eq!(opened.receipt.revision, 0);
    assert!(opened.receipt.approvers.is_empty());
    let checkpoint = f.service.checkpoint().unwrap();
    let restored = F::service(&f.f, &f.source);
    restored.restore_checkpoint(&checkpoint).unwrap();
    assert_eq!(
        r.context.snapshot.quote_cash,
        "14999.9799999999999999999998"
    );
    if let Ok(path) = std::env::var("QUANTOS_X02_NATIVE_MODEL_RESULT") {
        let entries = checkpoint["value"]["currentSources"]["entries"]
            .as_array()
            .unwrap();
        let original = entries
            .iter()
            .find(|e| e["subject"]["id"] == json!(old.id))
            .unwrap();
        let refreshed = entries
            .iter()
            .find(|e| e["subject"]["id"] == json!(subject.id))
            .unwrap();
        assert_eq!(original["record"], refreshed["record"]);
        let mut signed = serde_json::to_value(&r.decision).unwrap();
        signed.as_object_mut().unwrap().remove("signature");
        let signed_payload=String::from_utf8(canonical_json_bytes(&json!({"schema":"quantos-risk-hmac/v2","domain":"decision","key_id":r.decision.signer,"value":signed})).unwrap()).unwrap();
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"scope":"REAL_DOMAIN_MODULE_MODEL_NOT_PUBLIC_APPROVAL_SUCCESS","signedPayload":signed_payload,"originalSubject":old,"review":r.public_view().unwrap(),"decision":r.decision,"context":c,"originalProposal":original["record"],"refreshedProposal":refreshed["record"],"originalProvenanceUnchanged":true,"newApprovalRevision":opened.receipt.revision,"newApprovers":opened.receipt.approvers,"signatureVerified":true,"restored":true,"executionAuthority":false})).unwrap()).unwrap();
    }
}
#[test]
fn current_single_symbol_concentration_yields_signed_deny_without_subject() {
    let f = F::new();
    let c = context(&f, false, 0);
    let r = f
        .source
        .refresh_native(f.subject.id, c.clone(), f.f.now)
        .unwrap();
    assert_eq!(r.decision.verdict, RiskVerdict::Deny);
    assert!(r.subject.is_none());
    assert_eq!(r.decision.checks.len(), 15);
    assert!(
        r.decision
            .checks
            .iter()
            .any(|c| c.rule == quantos_risk::rules::Rule::Concentration && c.breached)
    );
    f.guard
        .verify_native_binding(&r.decision, &c, &f.f.venue, &f.f.release)
        .unwrap();
}
#[test]
fn native_wrong_scope_fork_generation_expiry_or_unknown_cannot_issue_review() {
    let f = F::new();
    let c = context(&f, true, 0);
    let before = f.guard.assisted_checkpoint().unwrap();
    for k in ["equity", "snapshotHash", "killGeneration"] {
        let mut bad = c.clone();
        let mut v = json!(bad.snapshot);
        v[k] = json!(if k == "equity" { "99999" } else { "bad" });
        if let Ok(s) = serde_json::from_value(v) {
            bad.snapshot = s;
            assert!(f.source.refresh_native(f.subject.id, bad, f.f.now).is_err());
        }
    }
    assert!(
        f.source
            .refresh_native(f.subject.id, c.clone(), c.snapshot.expires_at)
            .is_err()
    );
    let mut bad = c.clone();
    bad.ledger_checkpoint["entries"][0]["body"] = json!({});
    assert!(f.source.refresh_native(f.subject.id, bad, f.f.now).is_err());
    assert_eq!(f.guard.assisted_checkpoint().unwrap(), before);
}
#[test]
fn original_generation_and_deadline_are_not_renewed_after_kill_release() {
    let f = F::new();
    let r = f
        .source
        .refresh_native(f.subject.id, context(&f, true, 0), f.f.now)
        .unwrap();
    let subject = r.subject.unwrap();
    let owner = f.f.owner();
    f.source
        .set_kill_switch(&owner, KillScope::Global, true, 0, "stop", f.f.now)
        .unwrap();
    assert!(f.source.with_current(&subject, f.f.now, || ()).is_err());
    f.source
        .set_kill_switch(
            &owner,
            KillScope::Global,
            false,
            1,
            "explicit release",
            f.f.now,
        )
        .unwrap();
    assert!(f.source.with_current(&subject, f.f.now, || ()).is_err());
    let new = f
        .source
        .refresh_native(f.subject.id, context(&f, true, 2), f.f.now)
        .unwrap();
    assert_eq!(new.decision.kill_revision, 2);
    assert_eq!(r.decision.kill_revision, 0);
    assert_eq!(
        f.source.provenance(f.subject.id).unwrap()["killGeneration"],
        0
    );
    assert!(
        f.source
            .with_current(
                new.subject.as_ref().unwrap(),
                new.decision.expires_at,
                || ()
            )
            .is_err()
    );
}
#[test]
fn native_context_and_decision_tampering_refuse_authenticated_restore() {
    let f = F::new();
    let review = f
        .source
        .refresh_native(f.subject.id, context(&f, true, 0), f.f.now)
        .unwrap();
    let mut d = review.decision.clone();
    d.snapshot_hash = ContentHash::sha256_bytes(b"foreign");
    assert!(f.guard.verify_decision(&d).is_err());
    let mut c = review.context.clone();
    c.input.marks[0].price = "999999".into();
    assert!(
        f.guard
            .verify_native_binding(&review.decision, &c, &f.f.venue, &f.f.release)
            .is_err()
    );
    let mut c = review.context.clone();
    c.snapshot.expires_at += Duration::seconds(1);
    assert!(
        f.guard
            .verify_native_binding(&review.decision, &c, &f.f.venue, &f.f.release)
            .is_err()
    );
}
#[test]
fn exact_native_rules_preserve_high_precision_daily_loss_and_deny_all_breaches() {
    let f = F::new();
    let original = context(&f, true, 0);
    for rule in [
        quantos_risk::rules::Rule::DailyLoss,
        quantos_risk::rules::Rule::OrderNotional,
        quantos_risk::rules::Rule::Venue,
        quantos_risk::rules::Rule::Precision,
    ] {
        let mut c = original.clone();
        let mut intent = f.f.intent.clone();
        let mut venue = f.f.venue.clone();
        match rule {
            quantos_risk::rules::Rule::DailyLoss => {
                c.input.realized_pnl_before_origin_today = "-50000.0000000000000000001".into();
                let ledger =
                    NativeLedger::restore(c.snapshot.scope.clone(), &c.ledger_checkpoint).unwrap();
                c.snapshot = native_valuation::evaluate(&ledger, &c.input, 0, f.f.now)
                    .unwrap()
                    .snapshot
                    .unwrap();
            }
            quantos_risk::rules::Rule::OrderNotional => intent.quantity = "1000".into(),
            quantos_risk::rules::Rule::Venue => venue.healthy = false,
            _ => intent.quantity = "1.00001".into(),
        }
        let d = f
            .guard
            .evaluate_native_review(
                &f.f.auth,
                &intent,
                &c,
                &venue,
                &f.f.release,
                &f.subject.proposal_hash,
                f.f.now,
            )
            .unwrap();
        assert_eq!(d.verdict, RiskVerdict::Deny);
        assert!(
            d.checks
                .iter()
                .any(|check| check.rule == rule && check.breached)
        );
    }
}
#[test]
fn cold_native_review_restore_retains_original_hashes_and_rejects_wrong_current_source() {
    let f = F::new();
    let r = f
        .source
        .refresh_native(f.subject.id, context(&f, true, 0), f.f.now)
        .unwrap();
    let subject = r.subject.clone().unwrap();
    f.service.register_subject(subject.clone()).unwrap();
    let checkpoint = f.service.checkpoint().unwrap();
    let restored_source = CurrentSubjectSource::new(f.f.guard(), [74; 32]).unwrap();
    let restored = F::service(&f.f, &restored_source);
    restored.restore_checkpoint(&checkpoint).unwrap();
    restored_source
        .with_current(&subject, f.f.now, || ())
        .unwrap();
    assert_eq!(
        restored_source.native_snapshot(subject.id).unwrap(),
        Some(r.decision.snapshot_hash.clone())
    );
    let mut projection = r.public_view().unwrap();
    projection["decision"]["verdict"] = json!("allow");
    assert!(restored_source.verify_native_response(&projection).is_err());
    let mut policy = f.f.policy.clone();
    policy.max_age_seconds = 1;
    let guard = RiskGuard::new(
        f.f.auth.tenant_id,
        f.f.auth.workspace_id,
        policy,
        "short-policy".into(),
        [75; 32],
    )
    .unwrap();
    let current = context(&f, true, 0);
    let d = guard
        .evaluate_native_review(
            &f.f.auth,
            &f.f.intent,
            &current,
            &f.f.venue,
            &f.f.release,
            &f.subject.proposal_hash,
            f.f.now,
        )
        .unwrap();
    assert_eq!(d.expires_at, f.f.now + Duration::seconds(1));
    let mut venue = f.f.venue.clone();
    venue.observed_at = f.f.now + Duration::seconds(1);
    assert!(
        guard
            .evaluate_native_review(
                &f.f.auth,
                &f.f.intent,
                &current,
                &venue,
                &f.f.release,
                &f.subject.proposal_hash,
                venue.observed_at
            )
            .is_err()
    );
}
