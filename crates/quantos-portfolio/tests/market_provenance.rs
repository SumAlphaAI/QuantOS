//! Own R01/F03 artifacts and ephemeral signer. No provider network or database.
use chrono::{Duration, Utc};
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
use quantos_market::{RawMarketTick, default_approved_providers};
use quantos_portfolio::{market_provenance::*, native_ledger::Scope};
use quantos_storage::{SnapshotUsage, provenance::SourceApproval};
use serde_json::json;
fn fixture() -> (Policy, Binding, PKey<Private>) {
    let at = Utc::now();
    let at = chrono::DateTime::from_timestamp_millis(at.timestamp_millis()).unwrap();
    let scope:Scope=serde_json::from_value(json!({"tenantId":"22222222-2222-4222-8222-222222222222","workspaceId":"33333333-3333-4333-8333-333333333333","accountId":"44444444-4444-4444-8444-444444444444"})).unwrap();
    let key = PKey::from_ec_key(
        EcKey::generate(&EcGroup::from_curve_name(Nid::X9_62_PRIME256V1).unwrap()).unwrap(),
    )
    .unwrap();
    let mut name = X509NameBuilder::new().unwrap();
    name.append_entry_by_text("CN", "owned-r01.invalid")
        .unwrap();
    let name = name.build();
    let mut cert = X509::builder().unwrap();
    cert.set_version(2).unwrap();
    cert.set_subject_name(&name).unwrap();
    cert.set_issuer_name(&name).unwrap();
    cert.set_pubkey(&key).unwrap();
    cert.set_not_before(&Asn1Time::days_from_now(0).unwrap())
        .unwrap();
    cert.set_not_after(&Asn1Time::days_from_now(1).unwrap())
        .unwrap();
    cert.sign(&key, MessageDigest::sha256()).unwrap();
    let cert = cert.build();
    let mut provider = default_approved_providers()
        .approved_provider("approved.binance.spot")
        .unwrap()
        .clone();
    provider.freshness_sla_secs = 30;
    let p = Policy {
        scope: scope.clone(),
        revision: 1,
        previous_hash: None,
        issued_at: at - Duration::seconds(1),
        expires_at: at + Duration::seconds(30),
        enabled: true,
        purpose: "assisted_testnet_valuation".into(),
        signer: format!(
            "sha256:{}",
            cert.digest(MessageDigest::sha256())
                .unwrap()
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>()
        ),
        price_scale: 8,
        approval: SourceApproval {
            provider: provider.provider.clone(),
            dataset: provider.dataset.clone(),
            license_label: provider.license_label.clone(),
            approval_reference: provider.approval_reference.clone(),
            approval_version: provider.approval_version.clone(),
            approval_document_hash: ContentHash::sha256_bytes(
                b"owned fixture approval not live license",
            ),
            scope_hash: Policy::scope_hash(&scope).unwrap(),
            tenant_id: scope.tenant_id,
            symbols: vec!["BTC/USDT".into()],
            allowed_usages: vec![SnapshotUsage::Trading],
            expires_at: at + Duration::seconds(30),
            enabled: true,
        },
        provider,
    };
    let a = Artifact::produce(
        &p,
        ContentHash::sha256_bytes(b"raw owner input"),
        1,
        None,
        vec![RawMarketTick {
            provider: p.provider.provider.clone(),
            source_tick_id: "owned-event-1".into(),
            provider_symbol: "BTCUSDT".into(),
            event_time: at,
            received_at: at,
            price: "1100".into(),
            volume: "1".into(),
        }],
        at,
    )
    .unwrap();
    let b = Binding {
        policy: p.clone(),
        artifact: seal(a, &key),
        certificate: String::from_utf8(cert.to_pem().unwrap()).unwrap(),
    };
    (p, b, key)
}
fn seal(a: Artifact, key: &PKey<Private>) -> SignedArtifact {
    let mut s = Signer::new(MessageDigest::sha256(), key).unwrap();
    s.update(&canonical_json_bytes(&json!([DOMAIN, a])).unwrap())
        .unwrap();
    SignedArtifact {
        payload: a,
        signature: s
            .sign_to_vec()
            .unwrap()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect(),
    }
}
#[test]
fn authentic_r01_and_f03_artifact_binds_exact_mark_and_shortest_deadline() {
    let (p, b, _) = fixture();
    let a = &b.artifact.payload;
    let (m, s) = b
        .marks(&p.scope, &a.valuation_input_hash, a.produced_at)
        .unwrap();
    assert_eq!(m[0].price, "1100");
    assert_eq!(m[0].symbol, "BTCUSDT");
    assert!(
        m[0].source_ref
            .contains(&a.content_hash().unwrap().to_string())
    );
    assert_eq!(s.trust, TRUST);
    assert_eq!(s.policy_hash, p.content_hash().unwrap());
    assert_eq!(s.approval_document_hash, p.approval.approval_document_hash);
    assert_eq!(s.valid_until, p.deadline());
}
#[test]
fn untrusted_signatures_scope_current_grants_and_text_promotions_refuse() {
    for case in 0..13 {
        let (p, mut b, _) = fixture();
        let at = b.artifact.payload.produced_at;
        let hash = b.artifact.payload.valuation_input_hash.clone();
        match case {
            0 => b.artifact.signature = "00".into(),
            1 => b.policy.enabled = false,
            2 => b.policy.approval.allowed_usages = vec![SnapshotUsage::Research],
            3 => b.policy.approval.enabled = false,
            4 => b.policy.approval.expires_at = at,
            5 => b.policy.provider.enabled = false,
            6 => b.policy.approval.license_label = "fake".into(),
            7 => b.policy.approval.symbols = vec!["ETH/USDT".into()],
            8 => b.policy.approval.scope_hash = ContentHash::sha256_bytes(b"wrong scope"),
            9 => b.artifact.payload.events[0].raw_price = "900000".into(),
            10 => b.policy.signer = ContentHash::sha256_bytes(b"other").to_string(),
            11 => b.policy.purpose = "research".into(),
            _ => b.policy.price_scale = 19,
        };
        assert!(b.marks(&p.scope, &hash, at).is_err(), "case {case}");
    }
}
#[test]
fn signed_but_unhealthy_future_precision_or_artifact_hash_conflict_is_not_a_mark() {
    for case in 0..8 {
        let (p, mut b, key) = fixture();
        let at = b.artifact.payload.produced_at;
        let h = b.artifact.payload.valuation_input_hash.clone();
        match case {
            0 => b.artifact.payload.events[0].quality = quantos_market::MarketDataQuality::Degraded,
            1 => b.artifact.payload.ticks[0].event_time = at + Duration::seconds(1),
            2 => b.artifact.payload.ticks[0].price = "1.000000001".into(),
            3 => {
                let mut input = b.artifact.payload.snapshot.input();
                input.artifact_refs[0].content_hash = ContentHash::sha256_bytes(b"other");
                b.artifact.payload.snapshot =
                    quantos_storage::DataSnapshotRecord::new(p.scope.tenant_id, input, at).unwrap();
            }
            4 => b.artifact.payload.events[0].sequence = 2,
            5 => b.artifact.payload.events[0].provider = "other".into(),
            6 => {
                b.artifact.payload.valuation_input_hash =
                    ContentHash::sha256_bytes(b"different ledger")
            }
            _ => b.artifact.payload.policy_hash = ContentHash::sha256_bytes(b"old approval"),
        };
        b.artifact = seal(b.artifact.payload, &key);
        assert!(b.marks(&p.scope, &h, at).is_err(), "case {case}");
    }
}
#[test]
fn original_half_open_lease_and_source_age_never_renew() {
    let (p, b, _) = fixture();
    let at = b.artifact.payload.produced_at;
    let h = &b.artifact.payload.valuation_input_hash;
    assert!(b.marks(&p.scope, h, at + Duration::seconds(29)).is_ok());
    assert!(b.marks(&p.scope, h, at + Duration::seconds(30)).is_err());
}
#[test]
fn revoked_authority_and_unhealthy_head_cannot_rollback_after_cold_restore() {
    let (p, b, key) = fixture();
    let mut history = History::default();
    history.policy(&p, &p.scope).unwrap();
    history.artifact(&b.artifact, &p, &b.certificate).unwrap();
    let original = history.clone();
    let mut p2 = p.clone();
    p2.revision = 2;
    p2.previous_hash = Some(p.content_hash().unwrap());
    p2.enabled = false;
    history.policy(&p2, &p.scope).unwrap();
    let mut h: History = serde_json::from_value(serde_json::to_value(&history).unwrap()).unwrap();
    h.verify(&p.scope).unwrap();
    assert!(h.policy(&p, &p.scope).is_err());
    assert!(original.extension(&h).is_err());
    let mut a = b.artifact.payload.clone();
    a.previous_hash = Some(a.content_hash().unwrap());
    a.version = 2;
    a.events[0].quality = quantos_market::MarketDataQuality::Failed;
    let a = seal(a, &key);
    history.artifact(&a, &p, &b.certificate).unwrap();
    assert!(history.artifact(&b.artifact, &p, &b.certificate).is_err());
    history.verify(&p.scope).unwrap();
}
#[test]
fn producer_uses_original_r01_quality_and_rejects_unapproved_provider() {
    let (p, b, _) = fixture();
    let at = b.artifact.payload.produced_at;
    let mut ticks = b.artifact.payload.ticks.clone();
    ticks[0].provider = "unapproved".into();
    assert!(Artifact::produce(&p, ContentHash::sha256_bytes(b"raw"), 1, None, ticks, at).is_err());
    let mut ticks = b.artifact.payload.ticks.clone();
    ticks[0].event_time = at - Duration::seconds(31);
    let a = Artifact::produce(&p, ContentHash::sha256_bytes(b"raw"), 1, None, ticks, at).unwrap();
    assert!(
        a.events
            .iter()
            .any(|e| e.quality != quantos_market::MarketDataQuality::Passed)
    );
}
#[test]
fn account_or_observer_signature_namespace_cannot_authorize_market_marks() {
    let (p, mut b, key) = fixture();
    let a = &b.artifact.payload;
    let at = a.produced_at;
    let h = a.valuation_input_hash.clone();
    let mut signer = Signer::new(MessageDigest::sha256(), &key).unwrap();
    signer
        .update(
            &canonical_json_bytes(&json!([
                "quantos-x05-independent-account-books-signature/v1",
                a
            ]))
            .unwrap(),
        )
        .unwrap();
    b.artifact.signature = signer
        .sign_to_vec()
        .unwrap()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    assert!(b.marks(&p.scope, &h, at).is_err());
}
