//! Owner-shaped model evidence only; signature/source authenticity is exercised
//! by the independent signed-file BFF/mTLS process tests.
use super::native_refresh_cases::context;
use super::*;
#[test]
fn new_native_review_denies_missing_unmatched_stale_or_open_books_without_subject() {
    for case in 0..10 {
        let f = F::new();
        let mut c = context(&f, true, 0);
        match case {
            0 => c.books = None,
            1 => c.books.as_mut().unwrap().open_obligations = 1,
            2 => c.books.as_mut().unwrap().account_state = "DIFFERENCES".into(),
            3 => c.books.as_mut().unwrap().protocol_state = "UNAVAILABLE".into(),
            4 => c.books.as_mut().unwrap().unknown_obligations = 1,
            5 => c.books.as_mut().unwrap().source_hash = None,
            6 => c.books.as_mut().unwrap().coverage = "PARTIAL".into(),
            7 => c.books.as_mut().unwrap().valid_until = Some(f.f.now),
            8 => c.books.as_mut().unwrap().captured_at = Some(f.f.now + Duration::seconds(1)),
            _ => c.books.as_mut().unwrap().basis_hash = None,
        }
        let r = f.source.refresh_native(f.subject.id, c, f.f.now).unwrap();
        assert_eq!(r.decision.verdict, RiskVerdict::Deny);
        assert!(r.subject.is_none());
        assert!(
            r.decision
                .checks
                .iter()
                .any(|c| c.rule == quantos_risk::rules::Rule::AccountBooks && c.breached)
        );
        f.guard.verify_decision(&r.decision).unwrap();
    }
}
#[test]
fn books_wrong_scope_or_ledger_cannot_even_form_a_current_review() {
    for scope in [false, true] {
        let f = F::new();
        let mut c = context(&f, true, 0);
        let b = c.books.as_mut().unwrap();
        if scope {
            b.scope.account_id = quantos_core::AccountId::new();
        } else {
            b.ledger_hash = ContentHash::sha256_bytes(b"fork");
        }
        assert!(f.source.refresh_native(f.subject.id, c, f.f.now).is_err());
    }
}
#[test]
fn books_deadline_caps_new_signed_review_subject_and_half_open_authority() {
    let f = F::new();
    let mut c = context(&f, true, 0);
    c.books.as_mut().unwrap().valid_until = Some(f.f.now + Duration::seconds(2));
    let r = f
        .source
        .refresh_native(f.subject.id, c.clone(), f.f.now)
        .unwrap();
    let s = r.subject.as_ref().unwrap();
    assert_eq!(r.decision.expires_at, f.f.now + Duration::seconds(2));
    assert_eq!(s.expires_at, r.decision.expires_at);
    f.source
        .with_current(s, f.f.now + Duration::seconds(1), || ())
        .unwrap();
    assert!(
        f.source
            .with_current(s, f.f.now + Duration::seconds(2), || ())
            .is_err()
    );
    let p = r.public_view().unwrap();
    assert_eq!(p["subject"]["nativeRiskBinding"]["books"], json!(c.books));
    assert_eq!(
        p["booksAdmission"]["inputHash"],
        json!(c.books.as_ref().unwrap().content_hash().unwrap())
    );
}
#[test]
fn every_books_provenance_field_is_in_the_signed_native_facts_and_checkpoint() {
    for case in 0..6 {
        let f = F::new();
        let c = context(&f, true, 0);
        let r = f
            .source
            .refresh_native(f.subject.id, c.clone(), f.f.now)
            .unwrap();
        let mut changed = c;
        let b = changed.books.as_mut().unwrap();
        match case {
            0 => b.source_version = Some(2),
            1 => b.source_hash = Some(ContentHash::sha256_bytes(b"replacement")),
            2 => b.reconciliation_hash = ContentHash::sha256_bytes(b"different report"),
            3 => b.obligations_hash = ContentHash::sha256_bytes(b"omitted OPEN"),
            4 => b.valid_until = Some(f.f.now + Duration::seconds(29)),
            _ => b.open_obligations = 1,
        };
        assert!(
            f.guard
                .verify_native_binding(
                    &r.decision,
                    &changed,
                    &F::current(&f.f).venue,
                    &F::current(&f.f).release
                )
                .is_err()
        );
    }
}
#[test]
fn reviewed_open_is_a_new_signed_context_not_a_rewrite_or_limit_override() {
    let f = F::new();
    let mut c = context(&f, true, 0);
    let b = c.books.as_mut().unwrap();
    b.open_obligations = 3;
    let raw = b.clone();
    b.financial_review = Some(quantos_portfolio::books_risk::FinancialReviewAdmission {
        case_id: ProposalId::new(),
        record_hash: ContentHash::sha256_bytes(b"owner verified review journal model"),
        raw_input_hash: raw.content_hash().unwrap(),
        obligations_hash: raw.obligations_hash.clone(),
        covered_obligations: 3,
        kill_generation: "0".into(),
        decided_at: f.f.now,
        valid_until: f.f.now + Duration::seconds(2),
    });
    let r = f
        .source
        .refresh_native(f.subject.id, c.clone(), f.f.now)
        .unwrap();
    assert_eq!(r.decision.verdict, RiskVerdict::ApprovalRequired);
    assert_eq!(r.decision.expires_at, f.f.now + Duration::seconds(2));
    assert_eq!(
        r.public_view().unwrap()["booksAdmission"]["reason"],
        "ELIGIBLE_REVIEWED_REFERENCE_BOOKS"
    );
    assert_eq!(c.books.as_ref().unwrap().open_obligations, 3);
    let mut changed = c.clone();
    changed
        .books
        .as_mut()
        .unwrap()
        .financial_review
        .as_mut()
        .unwrap()
        .record_hash = ContentHash::sha256_bytes(b"another review");
    assert!(
        f.guard
            .verify_native_binding(
                &r.decision,
                &changed,
                &F::current(&f.f).venue,
                &F::current(&f.f).release
            )
            .is_err()
    );
}
#[test]
fn stale_review_or_wrong_generation_cannot_authorize_new_risk() {
    for case in 0..4 {
        let f = F::new();
        let mut c = context(&f, true, 0);
        let b = c.books.as_mut().unwrap();
        b.open_obligations = 3;
        let raw = b.clone();
        b.financial_review = Some(quantos_portfolio::books_risk::FinancialReviewAdmission {
            case_id: ProposalId::new(),
            record_hash: ContentHash::sha256_bytes(b"review"),
            raw_input_hash: raw.content_hash().unwrap(),
            obligations_hash: raw.obligations_hash.clone(),
            covered_obligations: 3,
            kill_generation: if case == 0 { "1" } else { "0" }.into(),
            decided_at: f.f.now,
            valid_until: f.f.now + Duration::seconds(2),
        });
        match case {
            1 => b.source_version = Some(2),
            2 => b.financial_review.as_mut().unwrap().covered_obligations = 2,
            3 => b.financial_review.as_mut().unwrap().valid_until = f.f.now,
            _ => {}
        }
        let r = f.source.refresh_native(f.subject.id, c, f.f.now);
        if case == 0 {
            assert!(r.is_err());
        } else {
            assert_eq!(r.unwrap().decision.verdict, RiskVerdict::Deny);
        }
    }
}
