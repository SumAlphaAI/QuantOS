//! Owner-shaped historical JSON is model input only, not current process proof.
use chrono::{DateTime, Duration, Utc};
use quantos_core::{ActorId, ContentHash, ProposalId};
use quantos_policy::Role;
use quantos_reconcile::financial_review::*;
use serde_json::{Value, json};
use uuid::Uuid;
fn fixture() -> (Context, DateTime<Utc>) {
    let p: Value = serde_json::from_str(include_str!(
        "../../../docs/audit/evidence/core-x02-books-risk-local-20261030/attempt-01/open.json"
    ))
    .unwrap();
    let mut evidence: Vec<quantos_reconcile::current::AlertEvidence> = p["alerts"]["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| serde_json::from_value(v["sourceEvidence"].clone()).unwrap())
        .collect();
    evidence.sort_by_key(|e| e.evidence_id.clone());
    (
        Context {
            input: serde_json::from_value(p["correctedDeny"]["booksAdmission"]["input"].clone())
                .unwrap(),
            evidence,
            kill_generation: 0,
        },
        serde_json::from_value(p["correctedDeny"]["decision"]["decidedAt"].clone()).unwrap(),
    )
}
fn record(c: &Context, at: DateTime<Utc>, case: ProposalId, action: Action, who: u128) -> Record {
    Record {
        sequence: 0,
        event_id: ProposalId::new(),
        case_id: case,
        action,
        context: c.clone(),
        actor: ActorId::from_uuid(Uuid::from_u128(who)),
        user: Uuid::from_u128(who),
        role: match who {
            1 => Role::Operator,
            2 => Role::Approver,
            _ => Role::Owner,
        },
        session: format!("session-{who}"),
        authority_revision: 1,
        authority_expires_at: c.input.deadline().unwrap(),
        key_hash: ContentHash::sha256_bytes(Uuid::new_v4().as_bytes()),
        intent_hash: ContentHash::sha256_bytes(b"intent model"),
        proof_hash: ContentHash::sha256_bytes(Uuid::new_v4().as_bytes()),
        reason: "Explicit model current financial review".into(),
        at,
        expires_at: c.input.deadline().unwrap(),
        previous: None,
        hash: ContentHash::sha256_bytes(b"not committed"),
    }
}
fn authorized() -> (Journal, Context, DateTime<Utc>, ProposalId) {
    let (c, at) = fixture();
    let id = ProposalId::new();
    let mut j = Journal::default();
    for (i, (action, who)) in [
        (Action::Request, 1),
        (Action::Endorse, 2),
        (Action::Authorize, 3),
    ]
    .into_iter()
    .enumerate()
    {
        j.append(record(&c, at, id, action, who), i as u64).unwrap();
    }
    (j, c, at, id)
}
#[test]
fn append_only_independent_pair_covers_exact_complete_open_set_without_closure() {
    let (j, c, at, _) = authorized();
    let a = j.admission(&c, at).unwrap().unwrap();
    assert_eq!(a.covered_obligations, 3);
    assert_eq!(c.input.open_obligations, 3);
    assert!(c.evidence.iter().all(|e| e.status == "OPEN"));
    let mut risk = c.input.clone();
    risk.financial_review = Some(a);
    assert_eq!(risk.reason(at), "ELIGIBLE_REVIEWED_REFERENCE_BOOKS");
    let restored: Journal = serde_json::from_value(serde_json::to_value(&j).unwrap()).unwrap();
    restored.verify_extension(&j).unwrap();
    assert_eq!(j.records.len(), 3);
}
#[test]
fn incomplete_or_one_ack_never_grants_risk_authority() {
    let (c, at) = fixture();
    let mut j = Journal::default();
    let id = ProposalId::new();
    for (action, who) in [(Action::Request, 1), (Action::Endorse, 2)] {
        j.append(record(&c, at, id, action, who), j.revision())
            .unwrap();
        assert!(j.admission(&c, at).unwrap().is_none());
    }
}
#[test]
fn self_user_aliases_roles_and_duplicate_proofs_are_refused() {
    for case in 0..7 {
        let (c, at) = fixture();
        let mut j = Journal::default();
        let id = ProposalId::new();
        let first = j.append(record(&c, at, id, Action::Request, 1), 0).unwrap();
        let mut r = record(&c, at, id, Action::Endorse, 2);
        match case {
            0 => r.user = first.user,
            1 => r.actor = first.actor,
            2 => r.role = Role::Operator,
            3 => r.proof_hash = first.proof_hash,
            4 => {
                r.actor = first.actor;
                r.key_hash = first.key_hash;
            }
            5 => r.context.kill_generation = 1,
            _ => r.expires_at += Duration::seconds(1),
        }
        assert!(j.append(r, 1).is_err(), "case {case}");
        assert_eq!(j.revision(), 1);
    }
}
#[test]
fn owner_must_be_independent_from_both_request_and_endorsement() {
    for who in [1, 2] {
        let (c, at) = fixture();
        let mut j = Journal::default();
        let id = ProposalId::new();
        j.append(record(&c, at, id, Action::Request, 1), 0).unwrap();
        j.append(record(&c, at, id, Action::Endorse, 2), 1).unwrap();
        let mut r = record(&c, at, id, Action::Authorize, 3);
        r.user = Uuid::from_u128(who);
        assert!(j.append(r, 2).is_err());
    }
}
#[test]
fn retain_block_revokes_current_disposition_without_rewriting_open_or_history() {
    let (mut j, c, at, id) = authorized();
    let original = j.clone();
    j.append(record(&c, at, id, Action::RetainBlock, 3), 3)
        .unwrap();
    assert!(j.admission(&c, at).unwrap().is_none());
    j.verify_extension(&original).unwrap();
    assert_eq!(j.records.len(), 4);
    assert_eq!(c.input.open_obligations, 3);
    assert!(
        j.append(record(&c, at, id, Action::Authorize, 3), 4)
            .is_err()
    );
}
#[test]
fn version_scope_source_ledger_generation_or_obligation_change_invalidates_authorization() {
    for case in 0..8 {
        let (j, mut c, at, _) = authorized();
        match case {
            0 => c.input.source_version = Some(3),
            1 => c.input.source_hash = Some(ContentHash::sha256_bytes(b"new")),
            2 => c.input.ledger_hash = ContentHash::sha256_bytes(b"new"),
            3 => c.kill_generation = 1,
            4 => c.input.scope.account_id = quantos_core::AccountId::new(),
            5 => c.input.open_obligations = 2,
            6 => c.evidence.pop().map(|_| ()).unwrap(),
            _ => c.input.obligations_hash = ContentHash::sha256_bytes(b"new"),
        };
        assert!(j.admission(&c, at).unwrap().is_none(), "case {case}");
    }
}
#[test]
fn unknown_protocol_missing_source_and_current_difference_cannot_be_reviewed() {
    for case in 0..7 {
        let (mut c, at) = fixture();
        match case{0=>c.input.unknown_obligations=1,1=>c.input.account_state="DIFFERENCES".into(),2=>c.input.protocol_state="DIFFERENCES".into(),3=>c.evidence[0].finding.kind="ACCOUNT_BOOKS_UNKNOWN".into(),4=>c.input.source_hash=None,5=>c.input.coverage="PARTIAL".into(),_=>c.evidence[0].binding=Some(serde_json::from_value(json!({"requestId":ProposalId::new(),"commandId":quantos_core::CommandId::new(),"sourceHash":null,"ledgerEntryHash":ContentHash::sha256_bytes(b"ledger")})).unwrap())};
        assert!(c.validate(at).is_err());
    }
}
#[test]
fn half_open_original_deadline_is_not_refreshed_by_reads() {
    let (j, c, at, _) = authorized();
    let end = c.input.deadline().unwrap();
    assert!(
        j.admission(&c, end - Duration::milliseconds(1))
            .unwrap()
            .is_some()
    );
    assert!(j.admission(&c, end).unwrap().is_none());
    assert!(j.admission(&c, at).unwrap().is_some());
}
#[test]
fn hash_chain_tamper_reorder_missing_records_and_warm_rollback_refuse() {
    let (j, _, _, _) = authorized();
    for case in 0..5 {
        let mut bad = j.clone();
        match case {
            0 => bad.records[1].reason = "rewritten".into(),
            1 => bad.records.swap(0, 1),
            2 => {
                bad.records.remove(1);
            }
            3 => {
                bad.records[2].context.input.open_obligations = 0;
            }
            _ => {
                bad.records[2].previous = None;
            }
        }
        assert!(bad.verify().is_err());
    }
    let mut short = j.clone();
    short.records.pop();
    assert!(short.verify_extension(&j).is_err());
}
#[test]
fn revision_cas_failure_is_atomic() {
    let (c, at) = fixture();
    let mut j = Journal::default();
    assert!(
        j.append(record(&c, at, ProposalId::new(), Action::Request, 1), 1)
            .is_err()
    );
    assert_eq!(j.revision(), 0);
}
