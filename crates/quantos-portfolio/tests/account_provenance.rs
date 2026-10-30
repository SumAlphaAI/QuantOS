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
