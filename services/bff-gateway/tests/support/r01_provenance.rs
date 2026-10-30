//! Real R01 ingestion/F03 artifacts, pinned signatures and current public workflow.
use super::*;
use super::{
    account_books as books, books_risk as risk, current_execution as current, current_gate as gate,
    financial_review as fin, source_review as source, valuation,
};
use openssl::{hash::MessageDigest, pkey::PKey, sign::Signer, x509::X509};
use quantos_core::{AccountId, ContentHash};
use quantos_portfolio::{market_provenance::*, native_valuation::Inputs};
use quantos_storage::{SnapshotUsage, provenance::SourceApproval};
pub(super) fn configure(lab: &Lab, enabled: bool) {
    let p = lab.directory.join("bff-owner.json");
    let mut o: Value = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
    o["r01ValuationEnabled"] = json!(enabled);
    private_write(p, serde_json::to_vec(&o).unwrap());
}
pub(super) fn policy(lab: &Lab, input: &Inputs) -> Policy {
    let cert = X509::from_pem(&fs::read(lab.directory.join("server.pem")).unwrap()).unwrap();
    let mut provider = quantos_market::default_approved_providers()
        .approved_provider("approved.binance.spot")
        .unwrap()
        .clone();
    provider.freshness_sla_secs = 30;
    let owner: Value =
        serde_json::from_slice(&fs::read(lab.directory.join("bff-owner.json")).unwrap()).unwrap();
    Policy {
        scope: input.scope.clone(),
        revision: 1,
        previous_hash: None,
        issued_at: serde_json::from_value(owner["createdAt"].clone()).unwrap(),
        expires_at: serde_json::from_value(owner["expiresAt"].clone()).unwrap(),
        enabled: true,
        purpose: "assisted_testnet_valuation".into(),
        signer: fingerprint(&cert).unwrap(),
        price_scale: 8,
        approval: SourceApproval {
            provider: provider.provider.clone(),
            dataset: provider.dataset.clone(),
            license_label: provider.license_label.clone(),
            approval_reference: provider.approval_reference.clone(),
            approval_version: provider.approval_version.clone(),
            approval_document_hash: ContentHash::sha256_bytes(
                b"fixture:approved-r01-valuation-trading-purpose-not-live-license",
            ),
            scope_hash: Policy::scope_hash(&input.scope).unwrap(),
            tenant_id: input.scope.tenant_id,
            symbols: vec!["BTC/USDT".into(), "ETH/USDT".into()],
            allowed_usages: vec![SnapshotUsage::Trading],
            expires_at: serde_json::from_value(owner["expiresAt"].clone()).unwrap(),
            enabled: true,
        },
        provider,
    }
}
fn signed(lab: &Lab, a: Artifact) -> SignedArtifact {
    let key = PKey::private_key_from_pem(&fs::read(lab.directory.join("server-key.pem")).unwrap())
        .unwrap();
    let mut s = Signer::new(MessageDigest::sha256(), &key).unwrap();
    s.update(&quantos_core::canonical_json_bytes(&json!([DOMAIN, a])).unwrap())
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
pub(super) fn produce(
    lab: &Lab,
    p: &Policy,
    input: &Inputs,
    version: u64,
    previous: Option<ContentHash>,
    symbols: &[&str],
) -> SignedArtifact {
    let ticks = symbols
        .iter()
        .enumerate()
        .map(|(i, s)| quantos_market::RawMarketTick {
            provider: p.provider.provider.clone(),
            source_tick_id: format!("owned-r01:{version}:{i}"),
            provider_symbol: s.to_string(),
            event_time: input.as_of,
            received_at: input.as_of,
            price: "1100".into(),
            volume: "1".into(),
        })
        .collect();
    signed(
        lab,
        Artifact::produce(
            p,
            input.raw_market_hash().unwrap(),
            version,
            previous,
            ticks,
            input.as_of,
        )
        .unwrap(),
    )
}
pub(super) fn publish(lab: &Lab, p: &Policy, a: &SignedArtifact) {
    let fence = owner_store(lab, "account-books-fence");
    let _guard = fence.lock().unwrap();
    owner_store(lab, "market-valuation-policy")
        .lock()
        .unwrap()
        .write(&json!(p))
        .unwrap();
    private_write(
        lab.directory.join("r01-valuation-artifact.json"),
        serde_json::to_vec(a).unwrap(),
    );
}
pub(super) fn setup(
    lab: &Lab,
) -> (
    Process,
    String,
    Value,
    Value,
    quantos_reconcile::account_books::Books,
    Inputs,
    Policy,
    SignedArtifact,
) {
    current::enabled(lab);
    let (_boot, url) = lab.bff(true);
    let (_, c, l, b) = super::source_review_gate::setup(lab, &url);
    let mut input = valuation::input(lab, &l, 2);
    input.marks.clear();
    let p = policy(lab, &input);
    let a = produce(lab, &p, &input, 1, None, &["BTCUSDT"]);
    valuation::write(lab, &input);
    publish(lab, &p, &a);
    configure(lab, true);
    let (cold, url) = lab.bff(true);
    let v = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(
        v["reason"], "READY_OWNED_ACCOUNT_AUTHENTICATED_R01_MARKS",
        "{v}"
    );
    assert_eq!(v["riskInputReady"], true);
    source::authorize(&url);
    fin::authorize(&url);
    (cold, url, c, l, b, input, p, a)
}
pub(super) fn review(url: &str, c: &Value) -> Value {
    let v = get(url, "/v1/assisted-testnet/valuation");
    let (s, r) = risk::request(url, c, &v, &Uuid::new_v4().to_string());
    assert_eq!(s, 200, "{r}");
    assert_eq!(r["decision"]["verdict"], "approval_required", "{r}");
    r
}
pub(super) fn approved(url: &str, r: &Value) -> String {
    let id = open(url, &r["subject"]);
    approve(url, &id, 0);
    approve(url, &id, 1);
    id
}
pub(super) fn state(lab: &Lab) -> Value {
    owner_store(lab, "approvals")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap()["valuation"]
        .clone()
}
fn emit(name: &str, v: Value) {
    valuation::evidence(name, v);
}
#[test]
fn r01_provenance_authentic_artifact_new_risk_actual_io_cold_c10_open_and_original_generation() {
    let lab = Lab::new();
    let (_p, url, c, _, mut b, input, p, a) = setup(&lab);
    let valuation = get(&url, "/v1/assisted-testnet/valuation");
    let alerts = get(&url, "/v1/alerts");
    let r = review(&url, &c);
    assert_eq!(
        r["marketProvenance"],
        valuation["snapshot"]["marketProvenance"]
    );
    let id = approved(&url, &r);
    let (s, command) = current::submit(&url, &id, "r01-bound-current");
    assert_eq!(s, 200, "{command}");
    assert_eq!(
        command["currentRisk"]["marketProvenance"],
        r["marketProvenance"]
    );
    assert_eq!(lab.trace()["protocolCalls"], 2);
    books::advance(&mut b);
    b.positions[1].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    books::publish(&lab, &b);
    let original = gate::inspect(&url, &id);
    let claims = risk::immutable(&risk::native(&lab));
    super::native_control::mutate(&url, "session-current", "engage", "account", 0, None);
    gate::release(&url, "account", 1);
    let (_cold, cold) = lab.bff(true);
    assert_eq!(gate::inspect(&cold, &id), original);
    assert_eq!(risk::immutable(&risk::native(&lab)), claims);
    assert_eq!(get(&cold, "/v1/alerts"), alerts);
    let repeat_refusal = current::submit(&cold, &id, "no-resend");
    assert_ne!(repeat_refusal.0, 200);
    let audit = gate::audit(&cold, r["decision"]["decisionId"].as_str().unwrap());
    assert!(
        audit["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["redactedPayload"]["review"]["marketProvenance"] == r["marketProvenance"])
    );
    emit(
        "QUANTOS_R01_ACCEPTED_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"valuation":valuation,"risk":r,"command":command,"original":original,"input":input,"policy":p,"artifact":a,"certificate":fs::read_to_string(lab.directory.join("server.pem")).unwrap(),"valuationState":state(&lab),"alertsBefore":alerts,"alertsAfter":get(&cold,"/v1/alerts"),"audit":audit,"repeatRefusalStatus":repeat_refusal.0,"claimsBefore":claims,"claimsAfter":risk::immutable(&risk::native(&lab)),"protocolCalls":2,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn r01_provenance_current_revocation_blocks_io_and_cold_policy_replay() {
    let lab = Lab::new();
    let (_p, url, c, _, _, _, p, a) = setup(&lab);
    let r = review(&url, &c);
    let id = approved(&url, &r);
    let before = risk::immutable(&risk::native(&lab));
    let mut revoked = p.clone();
    revoked.revision = 2;
    revoked.previous_hash = Some(p.content_hash().unwrap());
    revoked.enabled = false;
    publish(&lab, &revoked, &a);
    let refused = current::submit(&url, &id, "revoked-before-io");
    assert_ne!(refused.0, 200);
    let observed = state(&lab);
    assert_eq!(
        observed["marketHistory"]["policies"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    publish(&lab, &p, &a);
    let (_cold, cold) = lab.bff(true);
    let replay = call(
        &cold,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "policy-replay",
    );
    assert_ne!(replay.0, 200);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_R01_REVOCATION_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"risk":r,"observed":observed,"ioStatus":refused.0,"replayStatus":replay.0,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab)),"protocolCalls":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn r01_provenance_signature_missing_artifact_precision_scope_and_cached_risk_reject() {
    let lab = Lab::new();
    let (_p, url, c, _, _, _, p, a) = setup(&lab);
    let v = get(&url, "/v1/assisted-testnet/valuation");
    let before = risk::immutable(&risk::native(&lab));
    let mut cases = vec![];
    for case in 0..4 {
        let mut bad = a.clone();
        match case {
            0 => bad.signature = "00".into(),
            1 => {
                bad.payload.events[0].raw_price = "999999".into();
                bad = signed(&lab, bad.payload);
            }
            2 => {
                bad.payload.scope.account_id = AccountId::new();
                bad = signed(&lab, bad.payload);
            }
            _ => {
                bad.payload.valuation_input_hash =
                    ContentHash::sha256_bytes(b"other ledger/source");
                bad = signed(&lab, bad.payload);
            }
        }
        publish(&lab, &p, &bad);
        let blocked = call(
            &url,
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation",
            json!({}),
            "invalid",
        );
        assert_ne!(blocked.0, 200);
        let stale = risk::request(&url, &c, &v, &Uuid::new_v4().to_string());
        assert_ne!(stale.0, 200);
        cases.push(json!({"case":case,"viewStatus":blocked.0,"cachedRiskStatus":stale.0}));
    }
    fs::remove_file(lab.directory.join("r01-valuation-artifact.json")).unwrap();
    let missing = call(
        &url,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "missing",
    );
    assert_ne!(missing.0, 200);
    configure(&lab, false);
    let (_cold, cold) = lab.bff(true);
    let fallback = call(
        &cold,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "no-fallback",
    );
    assert_ne!(fallback.0, 200);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_R01_REFUSALS_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"cases":cases,"missingStatus":missing.0,"fallbackStatus":fallback.0,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab)),"protocolCalls":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn r01_provenance_signed_unhealthy_head_is_persistent_and_old_healthy_cannot_return() {
    let lab = Lab::new();
    let (_p, url, _, _, _, input, p, a) = setup(&lab);
    let mut ticks = a.payload.ticks.clone();
    ticks[0].event_time = input.as_of - Duration::seconds(31);
    let bad = signed(
        &lab,
        Artifact::produce(
            &p,
            input.raw_market_hash().unwrap(),
            2,
            Some(a.payload.content_hash().unwrap()),
            ticks,
            input.as_of,
        )
        .unwrap(),
    );
    publish(&lab, &p, &bad);
    let r = call(
        &url,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "known-unhealthy",
    );
    assert_ne!(r.0, 200);
    let history = state(&lab);
    assert_eq!(
        history["marketHistory"]["artifacts"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    publish(&lab, &p, &a);
    let (_cold, cold) = lab.bff(true);
    let r = call(
        &cold,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "no-old-healthy",
    );
    assert_ne!(r.0, 200);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_R01_HEALTH_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"history":history,"oldHealthyStatus":r.0,"input":input,"protocolCalls":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}

#[test]
fn r01_provenance_unknown_remains_unreviewable_and_original_generation_is_query_only() {
    let lab = Lab::pause_at(2);
    let (mut p, url, c, _, _, _, _, _) = setup(&lab);
    let review = review(&url, &c);
    let id = approved(&url, &review);
    let path = format!("/v1/assisted-testnet/requests/{id}/commands");
    let caller = std::thread::spawn({
        let url = url.clone();
        move || {
            reqwest::blocking::Client::builder()
                .no_proxy()
                .timeout(Wait::from_secs(10))
                .build()
                .unwrap()
                .post(format!("{url}{path}"))
                .header(
                    "cookie",
                    "quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001",
                )
                .header("origin", "http://localhost:3190")
                .header("x-csrf-token", "csrf-token-0000000000000001")
                .header("idempotency-key", Uuid::new_v4().to_string())
                .header("x-request-id", Uuid::new_v4().to_string())
                .json(&json!({"expectedRevision":2}))
                .send()
        }
    });
    let line = lab.trace.recv_timeout(Wait::from_secs(10)).unwrap();
    let pending: Value = serde_json::from_str(line.strip_prefix("L02_PENDING=").unwrap()).unwrap();
    assert_eq!(pending["protocolCalls"], 2);
    p.0.kill().unwrap();
    p.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    let mut b = risk::read_book(&lab);
    books::advance(&mut b);
    b.positions[1].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    books::publish(&lab, &b);
    let (_cold, cold) = lab.bff(true);
    let original = get(&cold, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(original["command"]["state"], "unknown");
    assert_eq!(original["command"]["currentRisk"]["killGeneration"], "0");
    assert_eq!(
        original["command"]["currentRisk"]["books"],
        review["booksAdmission"]["input"]
    );
    super::native_control::mutate(&cold, "session-current", "engage", "account", 0, None);
    super::current_gate::release(&cold, "account", 1);
    assert_eq!(
        get(&cold, &format!("/v1/assisted-testnet/requests/{id}")),
        original
    );
    assert!(
        original["command"]["currentRisk"]
            .get("marketProvenance")
            .is_some()
    );
    let valuation = get(&cold, "/v1/assisted-testnet/valuation");
    assert_eq!(valuation["riskInputReady"], false);
    assert_eq!(valuation["reason"], "UNKNOWN_OR_QUARANTINED_OBLIGATIONS");
    let before = risk::immutable(&risk::native(&lab));
    let view = get(&cold, "/v1/assisted-testnet/source-reviews");
    assert_eq!(view["reviewable"], false);
    assert_eq!(view["currentBooks"]["unknownObligations"], 1);
    let b = source::body(&cold, "session-current", &view, "request");
    let refused = source::post(
        &cold,
        "session-current",
        "/v1/assisted-testnet/source-reviews",
        &b,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(refused.0, 409);
    let ledger = get(&cold, "/v1/assisted-testnet/ledger");
    assert_eq!(ledger["appliedFillCount"], 1);
    assert_eq!(ledger["quarantinedCommandCount"], 1);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert_eq!(
        get(&cold, &format!("/v1/assisted-testnet/requests/{id}")),
        original
    );
    let alerts = get(&cold, "/v1/alerts");
    assert!(
        alerts["items"]
            .as_array()
            .unwrap()
            .iter()
            .all(|a| a["sourceEvidence"]["status"] == "OPEN" && a["resolved"] == false)
    );
    assert_eq!(lab.trace()["protocolCalls"], 2);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_R01_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"view":view,"valuation":valuation,"refusalStatus":refused.0,"original":original,"ledger":ledger,"alerts":alerts,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab)),"protocolCalls":2,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn r01_provenance_publisher_fence_covers_current_authority_check_and_io() {
    let lab = Lab::new();
    let (_p, url, c, _, _, _, p, _) = setup(&lab);
    let r = review(&url, &c);
    let id = approved(&url, &r);
    let before = risk::immutable(&risk::native(&lab));
    let fence = owner_store(&lab, "account-books-fence");
    let guard = fence.lock().unwrap();
    let (tx, rx) = mpsc::channel();
    let base = url.clone();
    let request = id.clone();
    let caller = std::thread::spawn(move || {
        let result = current::submit(&base, &request, "fenced-r01");
        tx.send(result).unwrap();
    });
    assert!(rx.recv_timeout(Wait::from_millis(100)).is_err());
    let mut revoked = p.clone();
    revoked.revision = 2;
    revoked.previous_hash = Some(p.content_hash().unwrap());
    revoked.enabled = false;
    owner_store(&lab, "market-valuation-policy")
        .lock()
        .unwrap()
        .write(&json!(revoked))
        .unwrap();
    drop(guard);
    let refused = rx.recv_timeout(Wait::from_secs(15)).unwrap();
    caller.join().unwrap();
    assert_ne!(refused.0, 200);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_R01_FENCE_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"publisherFenceWaited":true,"ioStatus":refused.0,"observed":state(&lab),"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab)),"protocolCalls":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
#[test]
fn r01_provenance_cold_authenticated_checkpoint_tamper_refuses_without_repair() {
    let lab = Lab::new();
    let (_p, _, _, _, _, _, _, _) = setup(&lab);
    let before = risk::immutable(&risk::native(&lab));
    let store = owner_store(&lab, "approvals");
    {
        let tx = store.lock().unwrap();
        let mut value = tx.read().unwrap().unwrap();
        value["valuation"]["marketHistory"]["artifacts"][0]["payload"]["events"][0]["raw_price"] =
            json!("999999");
        tx.write(&value).unwrap();
    }
    let (_cold, cold) = lab.bff(true);
    let refused = call(
        &cold,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "tampered-checkpoint",
    );
    assert_eq!(refused.0, 503);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_R01_TAMPER_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"tamperStatus":refused.0,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab)),"protocolCalls":1,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
