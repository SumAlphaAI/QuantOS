//! Pure owner-shaped fixtures only. Actual HTTP/native ingestion is tested by BFF.
#[allow(dead_code)]
#[path = "support/native_fixture.rs"]
mod fixture;
use chrono::Duration;
use fixture::{scope, source};
use openssl::{
    asn1::Asn1Time,
    ec::{EcGroup, EcKey},
    hash::MessageDigest,
    nid::Nid,
    pkey::{PKey, Private},
    sign::Signer,
    x509::{X509, X509NameBuilder},
};
use quantos_core::{ContentHash, canonical_json_bytes};
use quantos_portfolio::account_provenance as account;
use quantos_portfolio::{native_ledger::NativeLedger, native_valuation::*};
use serde_json::json;
fn ledger() -> NativeLedger {
    let mut l = NativeLedger::new(scope()).unwrap();
    l.observe(&source(1, "buy", "1", "1000", "0.01")).unwrap();
    l
}
fn inputs(l: &NativeLedger) -> Inputs {
    let f = source(1, "buy", "1", "1000", "0.01");
    let at = f.recorded_at + Duration::seconds(2);
    let v = l.view().unwrap();
    Inputs {
        market_provenance: None,
        account_provenance: None,
        schema_version: "quantos-native-valuation-input.v1".into(),
        source_id: SOURCE.into(),
        version: 1,
        scope: scope(),
        basis: BASIS.into(),
        origin_ledger_hash: serde_json::from_value(
            NativeLedger::new(scope()).unwrap().view().unwrap()["ledgerHash"].clone(),
        )
        .unwrap(),
        opening_at: f.fills[0].filled_at - Duration::seconds(1),
        cash_source_ref: "fixture:opening-cash:1".into(),
        quote_cash_at_opening: "10000".into(),
        realized_pnl_before_origin_today: "-5".into(),
        quote_currency: "USDT".into(),
        ledger_hash: serde_json::from_value(v["ledgerHash"].clone()).unwrap(),
        ledger_anchor: l.anchor(),
        as_of: at,
        valid_until: at + Duration::seconds(30),
        cash_coverage_through: at,
        account_status: "active".into(),
        account_status_at: at,
        status_source_ref: "fixture:account-status:1".into(),
        marks: v["positions"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|p| p["quantity"] != "0")
            .map(|p| Mark {
                symbol: p["symbol"].as_str().unwrap().into(),
                price: "1100".into(),
                source_ref: "fixture:approved-mark:1".into(),
                observed_at: at,
                quality: "normal".into(),
            })
            .collect(),
    }
}
fn identity(cn: &str) -> (String, String, PKey<Private>) {
    let k = PKey::from_ec_key(
        EcKey::generate(&EcGroup::from_curve_name(Nid::X9_62_PRIME256V1).unwrap()).unwrap(),
    )
    .unwrap();
    let mut n = X509NameBuilder::new().unwrap();
    n.append_entry_by_text("CN", cn).unwrap();
    let n = n.build();
    let mut c = X509::builder().unwrap();
    c.set_version(2).unwrap();
    c.set_subject_name(&n).unwrap();
    c.set_issuer_name(&n).unwrap();
    c.set_pubkey(&k).unwrap();
    c.set_not_before(&Asn1Time::from_unix(0).unwrap()).unwrap();
    c.set_not_after(&Asn1Time::from_unix(4070908800).unwrap())
        .unwrap();
    c.sign(&k, MessageDigest::sha256()).unwrap();
    let c = c.build();
    let pin = format!(
        "sha256:{}",
        c.digest(MessageDigest::sha256())
            .unwrap()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    );
    (String::from_utf8(c.to_pem().unwrap()).unwrap(), pin, k)
}
fn seal<T: serde::Serialize>(domain: &str, a: &T, key: &PKey<Private>) -> String {
    let mut s = Signer::new(MessageDigest::sha256(), key).unwrap();
    s.update(&canonical_json_bytes(&json!([domain, a])).unwrap())
        .unwrap();
    s.sign_to_vec()
        .unwrap()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}
fn fixture() -> (
    NativeLedger,
    Inputs,
    account::Policy,
    account::SignedArtifact,
    PKey<Private>,
) {
    let l = ledger();
    let mut i = inputs(&l);
    i.marks.clear();
    let at = i.as_of;
    let (pem, pin, mk) = identity("owned-market.invalid");
    let mut provider = quantos_market::default_approved_providers()
        .approved_provider("approved.binance.spot")
        .unwrap()
        .clone();
    provider.freshness_sla_secs = 30;
    let p = quantos_portfolio::market_provenance::Policy {
        scope: i.scope.clone(),
        revision: 1,
        previous_hash: None,
        issued_at: at - Duration::seconds(1),
        expires_at: at + Duration::seconds(30),
        enabled: true,
        purpose: "assisted_testnet_valuation".into(),
        signer: pin,
        price_scale: 8,
        approval: quantos_storage::provenance::SourceApproval {
            provider: provider.provider.clone(),
            dataset: provider.dataset.clone(),
            license_label: provider.license_label.clone(),
            approval_reference: provider.approval_reference.clone(),
            approval_version: provider.approval_version.clone(),
            approval_document_hash: ContentHash::sha256_bytes(b"owned mark approval"),
            scope_hash: quantos_portfolio::market_provenance::Policy::scope_hash(&i.scope).unwrap(),
            tenant_id: i.scope.tenant_id,
            symbols: vec!["BTC/USDT".into()],
            allowed_usages: vec![quantos_storage::SnapshotUsage::Trading],
            expires_at: at + Duration::seconds(30),
            enabled: true,
        },
        provider,
    };
    let a = quantos_portfolio::market_provenance::Artifact::produce(
        &p,
        i.raw_market_hash().unwrap(),
        1,
        None,
        vec![quantos_market::RawMarketTick {
            provider: p.provider.provider.clone(),
            source_tick_id: "mark1".into(),
            provider_symbol: "BTCUSDT".into(),
            event_time: at,
            received_at: at,
            price: "1100".into(),
            volume: "1".into(),
        }],
        at,
    )
    .unwrap();
    let signature = seal(quantos_portfolio::market_provenance::DOMAIN, &a, &mk);
    let binding = quantos_portfolio::market_provenance::Binding {
        policy: p,
        artifact: quantos_portfolio::market_provenance::SignedArtifact {
            payload: a,
            signature,
        },
        certificate: pem,
    };
    i.marks = binding
        .marks(&i.scope, &i.raw_market_hash().unwrap(), at)
        .unwrap()
        .0;
    i.market_provenance = Some(binding);
    let (certificate, signer, key) = identity("independent-account.invalid");
    let p = account::Policy {
        scope: i.scope.clone(),
        revision: 1,
        previous_hash: None,
        issued_at: at - Duration::seconds(1),
        expires_at: at + Duration::seconds(30),
        enabled: true,
        purpose: account::PURPOSE.into(),
        provider: "owned-independent-account".into(),
        dataset: "opening-basis-status-v1".into(),
        approval_reference: "fixture:independent-account-purpose-approval".into(),
        approval_version: "v1".into(),
        approval_document_hash: ContentHash::sha256_bytes(
            b"owned account scope not actual funding",
        ),
        scope_hash: account::Policy::scope_hash(&i.scope).unwrap(),
        signer,
        certificate,
        opening: account::Opening::from_input(&i),
        max_age_secs: 20,
    };
    let a = account::Artifact::from_observation(
        &p,
        i.raw_market_hash().unwrap(),
        1,
        None,
        observed(&i),
    )
    .unwrap();
    let signature = seal(account::DOMAIN, &a, &key);
    let a = account::SignedArtifact {
        payload: a,
        signature,
    };
    i.account_provenance = Some(account::Binding {
        policy: p.clone(),
        artifact: a.clone(),
    });
    (l, i, p, a, key)
}
fn state(l: &NativeLedger, i: &Inputs) -> State {
    let mut s = State::default();
    let m = i.market_provenance.as_ref().unwrap();
    s.observe_market_policy(&m.policy, l.scope()).unwrap();
    s.observe_market_artifact(&m.artifact, &m.policy, &m.certificate)
        .unwrap();
    let a = i.account_provenance.as_ref().unwrap();
    s.observe_account_policy(&a.policy, l.scope()).unwrap();
    s.observe_account_artifact(&a.artifact, &a.policy).unwrap();
    s
}
#[test]
fn independently_approved_opening_and_status_bind_current_r01_risk_and_exact_deadline() {
    let (l, i, p, _, _) = fixture();
    let mut s = state(&l, &i);
    let v = s.observe(&l, &i, 0, i.as_of).unwrap();
    assert_eq!(v.reason, "READY_OWNED_AUTHENTICATED_ACCOUNT_AND_R01");
    let v = v.snapshot.unwrap();
    let a = v.account_provenance.unwrap();
    assert_eq!(a.opening_hash, p.opening.content_hash().unwrap());
    assert_eq!(a.trust, account::TRUST);
    assert_eq!(a.valid_until, i.as_of + Duration::seconds(20));
    assert_eq!(v.expires_at, a.valid_until);
    assert_eq!(v.quote_cash, "8999.99");
    assert_eq!(v.equity, "10099.99");
    s.validate(&l).unwrap();
    let cold: State = serde_json::from_value(serde_json::to_value(&s).unwrap()).unwrap();
    cold.validate(&l).unwrap();
    assert!(cold.account_required());
}
#[test]
fn current_approval_signature_scope_purpose_source_clock_and_raw_cash_cannot_be_relabelled() {
    for n in 0..16 {
        let (_, mut i, _, _, _) = fixture();
        let at = i.as_of;
        let mut b = i.account_provenance.take().unwrap();
        match n {
            0 => b.policy.enabled = false,
            1 => b.policy.purpose = "research".into(),
            2 => b.policy.scope_hash = ContentHash::sha256_bytes(b"wrong"),
            3 => b.artifact.signature = "00".into(),
            4 => b.policy.signer = ContentHash::sha256_bytes(b"other").to_string(),
            5 => b.artifact.payload.quality = "suspect".into(),
            6 => b.artifact.payload.observed_at = at + Duration::seconds(1),
            7 => b.artifact.payload.valuation_input_hash = ContentHash::sha256_bytes(b"otherinput"),
            8 => i.quote_cash_at_opening = "1000000".into(),
            9 => i.cash_source_ref = "claimed venue funds".into(),
            10 => i.account_status = "closed".into(),
            11 => i.cash_coverage_through = at - Duration::seconds(1),
            12 => b.policy.expires_at = at,
            13 => b.policy.max_age_secs = 31,
            15 => {
                b.policy.expires_at = chrono::DateTime::from_timestamp(4070908800, 1000000).unwrap()
            }
            _ => b.policy.approval_document_hash = ContentHash::sha256_bytes(b"fakeapproval"),
        };
        assert!(b.summary(&i, at).is_err(), "case{n}");
    }
}
#[test]
fn authentic_bad_quality_and_current_revocation_advance_heads_without_rollback_or_cash_rebase() {
    let (l, i, p, a, key) = fixture();
    let mut s = state(&l, &i);
    s.observe(&l, &i, 0, i.as_of).unwrap();
    let old = s.clone();
    let mut revoked = p.clone();
    revoked.revision = 2;
    revoked.previous_hash = Some(p.content_hash().unwrap());
    revoked.enabled = false;
    s.observe_account_policy(&revoked, l.scope()).unwrap();
    assert!(s.observe_account_policy(&p, l.scope()).is_err());
    assert!(s.observe(&l, &i, 0, i.as_of).is_err());
    s.verify_extension(&old).unwrap();
    s.validate(&l).unwrap();
    let mut reset = revoked.clone();
    reset.revision = 3;
    reset.previous_hash = Some(revoked.content_hash().unwrap());
    reset.opening.quote_cash_at_opening = "20000".into();
    assert!(s.observe_account_policy(&reset, l.scope()).is_err());
    let mut h = account::History::default();
    h.policy(&p, l.scope()).unwrap();
    h.artifact(&a, &p).unwrap();
    let mut bad = a.payload.clone();
    bad.version = 2;
    bad.previous_hash = Some(a.payload.content_hash().unwrap());
    bad.quality = "stale".into();
    let bad = account::SignedArtifact {
        signature: seal(account::DOMAIN, &bad, &key),
        payload: bad,
    };
    h.artifact(&bad, &p).unwrap();
    assert!(h.artifact(&a, &p).is_err());
    let cold: account::History = serde_json::from_value(serde_json::to_value(&h).unwrap()).unwrap();
    cold.verify(l.scope()).unwrap();
    assert_eq!(cold.artifacts.len(), 2);
}
#[test]
fn original_half_open_expiry_inactive_account_and_market_signature_domain_remain_denials() {
    let (l, mut i, p, mut a, key) = fixture();
    let at = i.as_of;
    assert!(
        i.account_provenance
            .as_ref()
            .unwrap()
            .summary(&i, at + Duration::seconds(20))
            .is_err()
    );
    a.signature = seal(
        quantos_portfolio::market_provenance::DOMAIN,
        &a.payload,
        &key,
    );
    assert!(a.verify(&p).is_err());
    i.account_provenance = None;
    let market = i.market_provenance.clone();
    i.market_provenance = None;
    i.account_status = "suspended".into();
    let a = account::Artifact::from_observation(
        &p,
        i.raw_market_hash().unwrap(),
        1,
        None,
        observed(&i),
    )
    .unwrap();
    let a = account::SignedArtifact {
        signature: seal(account::DOMAIN, &a, &key),
        payload: a,
    };
    i.account_provenance = Some(account::Binding {
        policy: p,
        artifact: a,
    });
    assert!(evaluate(&l, &i, 0, at).is_err());
    i.market_provenance = market;
    assert!(
        evaluate(&l, &i, 0, at).is_err(),
        "old mark artifact cannot authorize changed account status"
    );
}
#[test]
fn cold_tamper_and_extension_cannot_drop_provenance_history_or_reference_fallback() {
    let (l, i, _, _, _) = fixture();
    let mut s = state(&l, &i);
    s.observe(&l, &i, 0, i.as_of).unwrap();
    let mut j = serde_json::to_value(&s).unwrap();
    j["accountHistory"]["artifacts"][0]["payload"]["accountStatus"] = json!("closed");
    let bad: State = serde_json::from_value(j).unwrap();
    assert!(bad.validate(&l).is_err());
    let mut legacy = i.clone();
    legacy.version = 2;
    legacy.account_provenance = None;
    assert!(s.observe(&l, &legacy, 0, i.as_of).is_err());
    assert!(State::default().verify_extension(&s).is_err());
}
#[test]
fn separate_account_key_and_bounded_continuous_history_cannot_be_bypassed() {
    let (l, mut i, p, a, key) = fixture();
    let b = i.account_provenance.clone().unwrap();
    i.market_provenance.as_mut().unwrap().certificate = p.certificate.clone();
    assert!(
        b.summary(&i, i.as_of).is_err(),
        "a second namespace cannot delegate the same signing key"
    );
    let mut h = account::History::default();
    let mut policy = p.clone();
    for n in 1..=64 {
        policy.revision = n;
        h.policy(&policy, l.scope()).unwrap();
        policy.previous_hash = Some(policy.content_hash().unwrap());
    }
    policy.revision = 65;
    assert!(h.policy(&policy, l.scope()).is_err());
    let mut h = account::History::default();
    h.policy(&p, l.scope()).unwrap();
    let mut data = a.payload.clone();
    for n in 1..=64 {
        data.version = n;
        let a = account::SignedArtifact {
            signature: seal(account::DOMAIN, &data, &key),
            payload: data.clone(),
        };
        h.artifact(&a, &p).unwrap();
        data.previous_hash = Some(data.content_hash().unwrap());
    }
    data.version = 65;
    let too_many = account::SignedArtifact {
        signature: seal(account::DOMAIN, &data, &key),
        payload: data,
    };
    assert!(h.artifact(&too_many, &p).is_err());
    let mut short = h.clone();
    short.artifacts.pop();
    assert!(short.extension(&h).is_err());
}

fn observed(i: &Inputs) -> account::Observation {
    account::Observation {
        opening: account::Opening::from_input(i),
        observed_at: i.as_of,
        account_status: i.account_status.clone(),
        account_status_at: i.account_status_at,
        cash_coverage_through: i.cash_coverage_through,
        status_source_ref: i.status_source_ref.clone(),
        quality: "normal".into(),
    }
}

fn account_input(
    i: &mut Inputs,
    p: &account::Policy,
    key: &PKey<Private>,
    version: u64,
    previous: Option<ContentHash>,
) {
    let a = account::Artifact::from_observation(
        p,
        i.raw_market_hash().unwrap(),
        version,
        previous,
        observed(i),
    )
    .unwrap();
    i.account_provenance = Some(account::Binding {
        policy: p.clone(),
        artifact: account::SignedArtifact {
            signature: seal(account::DOMAIN, &a, key),
            payload: a,
        },
    });
}
#[test]
fn cash_only_exact_ledger_empty_marks_account_deadline_and_cold_reconstruction() {
    let (_, original, p, _, key) = fixture();
    let l = NativeLedger::new(scope()).unwrap();
    let mut i = inputs(&l);
    i.marks.clear();
    account_input(&mut i, &p, &key, 1, None);
    let mut s = State::default();
    let b = i.account_provenance.as_ref().unwrap();
    s.observe_account_policy(&p, l.scope()).unwrap();
    s.observe_account_artifact(&b.artifact, &p).unwrap();
    let v = s.observe(&l, &i, 7, i.as_of).unwrap();
    assert_eq!(v.reason, "READY_OWNED_AUTHENTICATED_ACCOUNT_CASH_ONLY");
    let v = v.snapshot.unwrap();
    assert_eq!(v.quote_cash, "10000");
    assert_eq!(v.equity, "10000");
    assert_eq!(v.exposure_gross, "0");
    assert_eq!(v.exposure_net, "0");
    assert!(v.positions.is_empty());
    assert!(v.market_provenance.is_none());
    assert_eq!(v.kill_generation, "7");
    assert_eq!(v.expires_at, i.as_of + Duration::seconds(20));
    let cold = State::restore(&s.checkpoint().unwrap(), &l).unwrap();
    cold.verify_extension(&s).unwrap();
    assert_eq!(
        cold.verified_opening(&l)
            .unwrap()
            .unwrap()
            .quote_cash_at_opening,
        "10000"
    );
    assert!(evaluate(&l, &i, 7, v.expires_at).is_err());
    let mut forged = i.clone();
    forged.ledger_hash = original.ledger_hash;
    assert!(evaluate(&l, &forged, 7, i.as_of).is_err());
    let mut mark = i.clone();
    mark.marks = original.marks;
    assert!(evaluate(&l, &mark, 7, i.as_of).is_err());
    assert!(
        evaluate(&ledger(), &i, 7, i.as_of).is_err(),
        "empty declaration cannot hide held positions"
    );
    let mut input = i.clone();
    input.account_provenance = None;
    assert!(
        s.observe(&l, &input, 7, i.as_of).is_err(),
        "authenticated account cannot downgrade"
    );
}
#[test]
fn cash_only_to_held_to_flat_preserves_original_cash_market_heads_and_requires_fresh_r01() {
    let (mut l, mut held, p, _, key) = fixture();
    let empty = NativeLedger::new(scope()).unwrap();
    let mut cash = inputs(&empty);
    account_input(&mut cash, &p, &key, 1, None);
    let mut s = State::default();
    let a = cash.account_provenance.as_ref().unwrap().artifact.clone();
    s.observe_account_policy(&p, empty.scope()).unwrap();
    s.observe_account_artifact(&a, &p).unwrap();
    s.observe(&empty, &cash, 0, cash.as_of).unwrap();
    held.version = 2;
    held.market_provenance = None;
    held.marks.clear();
    account_input(
        &mut held,
        &p,
        &key,
        2,
        Some(a.payload.content_hash().unwrap()),
    );
    let a2 = held.account_provenance.as_ref().unwrap().artifact.clone();
    s.observe_account_artifact(&a2, &p).unwrap();
    assert!(s.observe(&l, &held, 0, held.as_of).is_err());
    // A new independently pinned R01 producer signs this exact held-ledger raw input.
    let (_, template, _, _, _) = fixture();
    let mut m = template.market_provenance.unwrap();
    let (pem, pin, mk) = identity("fresh-market.invalid");
    m.certificate = pem;
    m.policy.signer = pin;
    let a = quantos_portfolio::market_provenance::Artifact::produce(
        &m.policy,
        held.raw_market_hash().unwrap(),
        1,
        None,
        m.artifact
            .payload
            .events
            .iter()
            .map(|_| quantos_market::RawMarketTick {
                provider: m.policy.provider.provider.clone(),
                source_tick_id: "held-mark".into(),
                provider_symbol: "BTCUSDT".into(),
                event_time: held.as_of,
                received_at: held.as_of,
                price: "1100".into(),
                volume: "1".into(),
            })
            .collect(),
        held.as_of,
    )
    .unwrap();
    m.artifact = quantos_portfolio::market_provenance::SignedArtifact {
        signature: seal(quantos_portfolio::market_provenance::DOMAIN, &a, &mk),
        payload: a,
    };
    held.marks = m
        .marks(&held.scope, &held.raw_market_hash().unwrap(), held.as_of)
        .unwrap()
        .0;
    held.market_provenance = Some(m.clone());
    s.observe_market_policy(&m.policy, l.scope()).unwrap();
    s.observe_market_artifact(&m.artifact, &m.policy, &m.certificate)
        .unwrap();
    assert!(
        s.observe(&l, &held, 0, held.as_of)
            .unwrap()
            .snapshot
            .is_some()
    );
    let before = s.clone();
    l.observe(&source(2, "sell", "1", "1200", "0.01")).unwrap();
    let mut flat = inputs(&l);
    flat.version = 3;
    flat.marks.clear();
    account_input(
        &mut flat,
        &p,
        &key,
        3,
        Some(a2.payload.content_hash().unwrap()),
    );
    let a3 = flat.account_provenance.as_ref().unwrap().artifact.clone();
    s.observe_account_artifact(&a3, &p).unwrap();
    let v = s
        .observe(&l, &flat, 4, flat.as_of)
        .unwrap()
        .snapshot
        .unwrap();
    assert_eq!(v.quote_cash, "10199.98");
    assert_eq!(v.equity, "10199.98");
    assert_eq!(v.realized_pnl_today, "194.98");
    assert!(v.positions.is_empty());
    assert!(v.market_provenance.is_none());
    assert_eq!(
        s.checkpoint().unwrap()["marketHistory"],
        before.checkpoint().unwrap()["marketHistory"]
    );
    s.verify_extension(&before).unwrap();
    State::restore(&s.checkpoint().unwrap(), &l).unwrap();
    // Market revocation high-water remains sticky even while no mark is consumed.
    let mut revoked = m.policy.clone();
    revoked.revision = 2;
    revoked.previous_hash = Some(m.policy.content_hash().unwrap());
    revoked.enabled = false;
    s.observe_market_policy(&revoked, l.scope()).unwrap();
    assert!(s.observe_market_policy(&m.policy, l.scope()).is_err());
    s.observe(&l, &flat, 4, flat.as_of).unwrap();
    l.observe(&source(3, "buy", "1", "1000", "0.01")).unwrap();
    let mut reopened = inputs(&l);
    reopened.version = 4;
    reopened.marks.clear();
    account_input(
        &mut reopened,
        &p,
        &key,
        4,
        Some(a3.payload.content_hash().unwrap()),
    );
    let a4 = reopened
        .account_provenance
        .as_ref()
        .unwrap()
        .artifact
        .clone();
    s.observe_account_artifact(&a4, &p).unwrap();
    assert!(s.observe(&l, &reopened, 4, reopened.as_of).is_err());
    reopened.market_provenance = Some(m);
    assert!(
        s.observe(&l, &reopened, 4, reopened.as_of).is_err(),
        "old R01 proof/head cannot authorize reopened holdings"
    );
}

#[test]
fn cash_only_unknown_zero_positions_is_not_cash_capacity_or_new_source() {
    let (_, _, p, _, key) = fixture();
    let mut l = NativeLedger::new(scope()).unwrap();
    let f = fixture::edit(&source(1, "buy", "1", "1000", "0.01"), |v| {
        v["outcome"] = json!("unknown");
        v["consumerReady"] = json!(false);
        v["reason"] = json!("OUTCOME_UNRESOLVED");
    });
    l.observe(&f).unwrap();
    let before = l.checkpoint().unwrap();
    let mut i = inputs(&l);
    i.marks.clear();
    account_input(&mut i, &p, &key, 1, None);
    let v = evaluate(&l, &i, 0, i.as_of).unwrap();
    assert_eq!(v.reason, "UNKNOWN_OR_QUARANTINED_OBLIGATIONS");
    assert!(v.snapshot.is_none());
    assert!(!i.authenticated_cash_only(&l).unwrap());
    let mut s = State::default();
    let a = i.account_provenance.as_ref().unwrap();
    s.observe_account_policy(&p, l.scope()).unwrap();
    s.observe_account_artifact(&a.artifact, &p).unwrap();
    let old = s.checkpoint().unwrap();
    assert!(s.observe(&l, &i, 0, i.as_of).is_err());
    assert_eq!(s.checkpoint().unwrap(), old);
    assert_eq!(l.checkpoint().unwrap(), before);
}
