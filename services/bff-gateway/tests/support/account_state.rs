//! Independent account grant/certificate and immutable origin, separate R01 mark.
use super::*;
use super::{
    account_books as books, books_risk as risk, c11_activation as c11,
    current_execution as current, current_gate as gate, financial_review as fin,
    native_control as kill, r01_provenance as market, source_review as source, valuation,
};
use openssl::{
    hash::MessageDigest,
    pkey::{PKey, Private},
    sign::Signer,
};
use quantos_portfolio::{account_provenance::*, native_valuation::Inputs};
pub(super) fn enabled(lab: &Lab, value: bool) {
    let path = lab.directory.join("bff-owner.json");
    let mut c: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    c["accountValuationEnabled"] = json!(value);
    private_write(path, serde_json::to_vec(&c).unwrap());
}
pub(super) fn signed(lab: &Lab, a: Artifact) -> SignedArtifact {
    let key = PKey::private_key_from_pem(&fs::read(lab.directory.join("account-key.pem")).unwrap())
        .unwrap();
    seal(a, &key, DOMAIN)
}
fn seal(a: Artifact, key: &PKey<Private>, domain: &str) -> SignedArtifact {
    let mut s = Signer::new(MessageDigest::sha256(), key).unwrap();
    s.update(&quantos_core::canonical_json_bytes(&json!([domain, a])).unwrap())
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
pub(super) fn policy(lab: &Lab, i: &Inputs) -> Policy {
    let (c, k) = tls::certificate("independent-account.invalid", None, false, false);
    private_write(
        lab.directory.join("account-key.pem"),
        k.private_key_to_pem_pkcs8().unwrap(),
    );
    let owner: Value =
        serde_json::from_slice(&fs::read(lab.directory.join("bff-owner.json")).unwrap()).unwrap();
    Policy {
        scope: i.scope.clone(),
        revision: 1,
        previous_hash: None,
        issued_at: serde_json::from_value(owner["createdAt"].clone()).unwrap(),
        expires_at: serde_json::from_value(owner["expiresAt"].clone()).unwrap(),
        enabled: true,
        purpose: PURPOSE.into(),
        provider: "owned-independent-account".into(),
        dataset: "opening-basis-and-status-v1".into(),
        approval_reference: "fixture:separate-account-purpose-approval".into(),
        approval_version: "v1".into(),
        approval_document_hash: quantos_core::ContentHash::sha256_bytes(
            b"owner approves independent account purpose, not actual venue funding",
        ),
        scope_hash: Policy::scope_hash(&i.scope).unwrap(),
        signer: fingerprint(&c).unwrap(),
        certificate: String::from_utf8(c.to_pem().unwrap()).unwrap(),
        opening: authored_opening(lab, i),
        max_age_secs: 30,
    }
}
fn publish(
    lab: &Lab,
    p: &Policy,
    a: &SignedArtifact,
    m: &quantos_portfolio::market_provenance::SignedArtifact,
) {
    let fence = owner_store(lab, "account-books-fence");
    let _guard = fence.lock().unwrap();
    owner_store(lab, "account-valuation-policy")
        .lock()
        .unwrap()
        .write(&json!(p))
        .unwrap();
    private_write(
        lab.directory.join("account-valuation-artifact.json"),
        serde_json::to_vec(a).unwrap(),
    );
    private_write(
        lab.directory.join("r01-valuation-artifact.json"),
        serde_json::to_vec(m).unwrap(),
    );
}
fn setup(
    lab: &Lab,
) -> (
    Process,
    String,
    Value,
    Value,
    Inputs,
    Policy,
    SignedArtifact,
    quantos_portfolio::market_provenance::SignedArtifact,
) {
    let (_market, _, c, l, _, _, mp, ma) = market::setup(lab);
    let mut i = valuation::input(lab, &l, 3);
    i.marks.clear();
    let p = policy(lab, &i);
    let a = signed(lab, produce(&p, &i, 1, None, "active").unwrap());
    let m = market::produce(
        lab,
        &mp,
        &i,
        2,
        Some(ma.payload.content_hash().unwrap()),
        &["BTCUSDT"],
    );
    valuation::write(lab, &i);
    publish(lab, &p, &a, &m);
    enabled(lab, true);
    let (process, url) = lab.bff(true);
    let v = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(
        v["reason"], "READY_OWNED_AUTHENTICATED_ACCOUNT_AND_R01",
        "{v}"
    );
    assert_eq!(v["riskInputReady"], true);
    assert_ne!(p.signer, mp.signer);
    (process, url, c, l, i, p, a, m)
}
fn emit(name: &str, lab: &Lab, mut v: Value, calls: u64) {
    v["sourceCommit"] = json!(std::env::var("GITHUB_SHA").unwrap());
    v["actualTestnet"] = json!(false);
    v["noResend"] = json!(true);
    v["automaticClosure"] = json!(false);
    v["limitsRelaxed"] = json!(false);
    v["protocolCalls"] = json!(calls);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    valuation::evidence(name, v);
}
#[test]
fn account_state_independent_opening_status_new_risk_subject_actual_io_controls_cold_and_c10() {
    let lab = Lab::new();
    let (_p, url, c, _, i, p, a, m) = setup(&lab);
    let v = get(&url, "/v1/assisted-testnet/valuation");
    let alerts = get(&url, "/v1/alerts");
    let r = market::review(&url, &c);
    assert_eq!(r["accountProvenance"], v["accountProvenance"]);
    let id = market::approved(&url, &r);
    let initial = c11::current(&url);
    c11::change(&url, &initial, false);
    let before_off = risk::immutable(&risk::native(&lab));
    let off = current::submit(&url, &id, "account-off");
    assert_ne!(off.0, 200);
    assert_eq!(before_off, risk::immutable(&risk::native(&lab)));
    let disabled = c11::current(&url);
    c11::change(&url, &disabled, true);
    let (s, command) = current::submit(&url, &id, "account-current");
    assert_eq!(s, 200, "{command}");
    assert_eq!(lab.trace()["protocolCalls"], 2);
    assert_eq!(
        command["currentRisk"]["accountProvenance"],
        v["accountProvenance"]
    );
    let original = gate::inspect(&url, &id);
    let claims = risk::immutable(&risk::native(&lab));
    let mut b = risk::read_book(&lab);
    books::advance(&mut b);
    b.positions[1].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    books::publish(&lab, &b);
    let matched = get(&url, "/v1/assisted-testnet/reconciliation");
    assert_eq!(
        matched["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    kill::mutate(&url, "session-owner", "engage", "global", 0, None);
    kill::mutate(&url, "session-current", "engage", "account", 1, None);
    gate::roundtrip(&url);
    let (_cold, cold) = lab.bff(true);
    gate::release(&cold, "account", 2);
    gate::release(&cold, "global", 3);
    assert_eq!(gate::inspect(&cold, &id), original);
    assert_eq!(risk::immutable(&risk::native(&lab)), claims);
    assert_eq!(get(&cold, "/v1/alerts"), alerts);
    let repeat = current::submit(&cold, &id, "no-account-resend");
    assert_ne!(repeat.0, 200);
    let audit = gate::audit(&cold, r["decision"]["decisionId"].as_str().unwrap());
    assert!(
        audit["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["redactedPayload"]["review"]["accountProvenance"] == v["accountProvenance"])
    );
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_ACCOUNT_ACCEPTED_RESULT",
        &lab,
        json!({"input":i,"policy":p,"artifact":a,"marketArtifact":m,"marketPolicy":market::state(&lab)["marketHistory"]["policies"][0],"valuation":v,"risk":r,"command":command,"original":original,"matched":matched,"ledger":get(&cold,"/v1/assisted-testnet/ledger"),"audit":audit,"alertsBefore":alerts,"alertsAfter":get(&cold,"/v1/alerts"),"claimsBefore":claims,"claimsAfter":risk::immutable(&risk::native(&lab)),"currentControls":get(&cold,"/v1/risk/kill-switch"),"c11":c11::current(&cold),"valuationState":market::state(&lab),"repeatRefusalStatus":repeat.0}),
        2,
    );
}
#[test]
fn account_state_current_revocation_prevents_io_and_cold_flag_missing_or_policy_replay_fallback() {
    let lab = Lab::new();
    let (_p, url, c, _, _, p, a, m) = setup(&lab);
    let r = market::review(&url, &c);
    let id = market::approved(&url, &r);
    let before = risk::immutable(&risk::native(&lab));
    let mut revoked = p.clone();
    revoked.revision = 2;
    revoked.previous_hash = Some(p.content_hash().unwrap());
    revoked.enabled = false;
    publish(&lab, &revoked, &a, &m);
    let refused = current::submit(&url, &id, "revoked-account");
    assert_ne!(refused.0, 200);
    let observed = market::state(&lab);
    assert_eq!(observed["accountHistory"]["policies"][1]["enabled"], false);
    publish(&lab, &p, &a, &m);
    enabled(&lab, false);
    let (_cold, cold) = lab.bff(true);
    let replay = call(
        &cold,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "account-replay",
    );
    assert_ne!(replay.0, 200);
    fs::remove_file(lab.directory.join("account-valuation-artifact.json")).unwrap();
    let missing = call(
        &cold,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "account-missing",
    );
    assert_ne!(missing.0, 200);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_ACCOUNT_REVOCATION_RESULT",
        &lab,
        json!({"risk":r,"observed":observed,"ioStatus":refused.0,"replayStatus":replay.0,"missingStatus":missing.0,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab))}),
        1,
    );
}
#[test]
fn account_state_bad_signature_market_signer_raw_cash_and_public_metadata_cannot_replace_account_authority()
 {
    let lab = Lab::new();
    let (_p, url, c, _, i, p, a, m) = setup(&lab);
    let v = get(&url, "/v1/assisted-testnet/valuation");
    let before = risk::immutable(&risk::native(&lab));
    let mut cases = vec![];
    for n in 0..4 {
        let mut bad = a.clone();
        let mut bp = p.clone();
        let mut raw = i.clone();
        match n {
            0 => bad.signature = "00".into(),
            1 => {
                let cert = fs::read_to_string(lab.directory.join("server.pem")).unwrap();
                bp.certificate = cert;
                bp.signer = market::state(&lab)["marketHistory"]["policies"][0]["signer"]
                    .as_str()
                    .unwrap()
                    .into();
            }
            2 => raw.quote_cash_at_opening = "999999".into(),
            _ => {
                raw.account_provenance = Some(Binding {
                    policy: p.clone(),
                    artifact: a.clone(),
                })
            }
        };
        valuation::write(&lab, &raw);
        publish(&lab, &bp, &bad, &m);
        let view = call(
            &url,
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation",
            json!({}),
            "bad-account",
        );
        assert_ne!(view.0, 200);
        let cached = risk::request(&url, &c, &v, &Uuid::new_v4().to_string());
        assert_ne!(cached.0, 200);
        assert!(cached.1.get("subject").is_none());
        cases.push(json!({"case":n,"viewStatus":view.0,"cachedRiskStatus":cached.0}));
    }
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_ACCOUNT_REFUSALS_RESULT",
        &lab,
        json!({"cases":cases,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab))}),
        1,
    );
}
#[test]
fn account_state_authenticated_unhealthy_head_cannot_be_rolled_back_after_cold_recovery() {
    let lab = Lab::new();
    let (_p, url, _, l, _, p, a, m) = setup(&lab);
    let before = risk::immutable(&risk::native(&lab));
    let mut i = valuation::input(&lab, &l, 4);
    i.marks.clear();
    let mut bad = produce(&p, &i, 2, Some(a.payload.content_hash().unwrap()), "active").unwrap();
    bad.quality = "stale".into();
    let bad = signed(&lab, bad);
    valuation::write(&lab, &i);
    publish(&lab, &p, &bad, &m);
    let r = call(
        &url,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "unhealthy-account",
    );
    assert_ne!(r.0, 200);
    let observed = market::state(&lab);
    assert_eq!(
        observed["accountHistory"]["artifacts"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    publish(&lab, &p, &a, &m);
    let (_cold, cold) = lab.bff(true);
    let replay = call(
        &cold,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "old-healthy-account",
    );
    assert_ne!(replay.0, 200);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_ACCOUNT_HEALTH_RESULT",
        &lab,
        json!({"history":observed,"unhealthyStatus":r.0,"replayStatus":replay.0,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab))}),
        1,
    );
}
#[test]
fn account_state_signed_suspension_blocks_new_risk_and_cold_active_replay_without_rebasing_cash() {
    let lab = Lab::new();
    let (_p, url, c, l, _, p, a, m) = setup(&lab);
    let ready = get(&url, "/v1/assisted-testnet/valuation");
    let before = risk::immutable(&risk::native(&lab));
    let mut i = valuation::input(&lab, &l, 4);
    i.marks.clear();
    i.account_status = "suspended".into();
    let a2 = signed(
        &lab,
        produce(
            &p,
            &i,
            2,
            Some(a.payload.content_hash().unwrap()),
            "suspended",
        )
        .unwrap(),
    );
    let mp = market::policy(&lab, &i);
    let m2 = market::produce(
        &lab,
        &mp,
        &i,
        3,
        Some(m.payload.content_hash().unwrap()),
        &["BTCUSDT"],
    );
    valuation::write(&lab, &i);
    publish(&lab, &p, &a2, &m2);
    let view = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(view["riskInputReady"], false);
    assert_eq!(view["reason"], "INACTIVE_ACCOUNT");
    assert!(view.get("snapshot").is_none());
    let denied = risk::request(&url, &c, &ready, &Uuid::new_v4().to_string());
    assert_ne!(denied.0, 200);
    let observed = market::state(&lab);
    publish(&lab, &p, &a, &m);
    let (_cold, cold) = lab.bff(true);
    let replay = call(
        &cold,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "old-active-account",
    );
    assert_ne!(replay.0, 200);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    emit(
        "QUANTOS_ACCOUNT_STATUS_RESULT",
        &lab,
        json!({"view":view,"observed":observed,"riskStatus":denied.0,"replayStatus":replay.0,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab))}),
        1,
    );
}
#[test]
fn account_state_unknown_preserves_original_account_r01_generation_claims_and_all_open() {
    let lab = Lab::pause_at(2);
    let (mut process, url, c, _, _, _, _, _) = setup(&lab);
    let r = market::review(&url, &c);
    let id = market::approved(&url, &r);
    let base = url.clone();
    let request = id.clone();
    let caller = std::thread::spawn(move || {
        reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Wait::from_secs(10))
            .build()
            .unwrap()
            .post(format!(
                "{base}/v1/assisted-testnet/requests/{request}/commands"
            ))
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
    });
    let line = lab.trace.recv_timeout(Wait::from_secs(10)).unwrap();
    assert!(line.starts_with("L02_PENDING="));
    process.0.kill().unwrap();
    process.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    let mut b = risk::read_book(&lab);
    books::advance(&mut b);
    b.positions[1].amount = "1".into();
    b.cash[0].amount = "7999.98".into();
    b.fees[0].amount = "0.02".into();
    books::publish(&lab, &b);
    let (_cold, cold) = lab.bff(true);
    let original = gate::inspect(&cold, &id);
    let before = risk::immutable(&risk::native(&lab));
    assert_eq!(original["command"]["state"], "unknown");
    assert_eq!(
        original["command"]["currentRisk"]["accountProvenance"],
        r["accountProvenance"]
    );
    kill::mutate(&cold, "session-current", "engage", "account", 0, None);
    gate::roundtrip(&cold);
    gate::release(&cold, "account", 1);
    let (_again, again) = lab.bff(true);
    assert_eq!(gate::inspect(&again, &id), original);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    let v = get(&again, "/v1/assisted-testnet/valuation");
    assert_eq!(v["reason"], "UNKNOWN_OR_QUARANTINED_OBLIGATIONS");
    assert!(v.get("snapshot").is_none());
    let ledger = get(&again, "/v1/assisted-testnet/ledger");
    assert_eq!(ledger["appliedFillCount"], 1);
    assert_eq!(ledger["quarantinedCommandCount"], 1);
    let view = get(&again, "/v1/assisted-testnet/source-reviews");
    assert_eq!(view["reviewable"], false);
    let body = source::body(&again, "session-current", &view, "request");
    let sr = source::post(
        &again,
        "session-current",
        "/v1/assisted-testnet/source-reviews",
        &body,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(sr.0, 409);
    let fv = get(&again, "/v1/assisted-testnet/financial-reviews");
    let fb = fin::body(&again, "session-current", &fv, "request");
    let fr = fin::post(
        &again,
        "session-current",
        "/v1/assisted-testnet/financial-reviews",
        &fb,
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(fr.0, 409);
    let alerts = get(&again, "/v1/alerts");
    assert_eq!(alerts["items"].as_array().unwrap().len(), 7);
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
        "QUANTOS_ACCOUNT_UNKNOWN_RESULT",
        &lab,
        json!({"risk":r,"original":original,"valuation":v,"ledger":ledger,"alerts":alerts,"sourceReviewStatus":sr.0,"financialReviewStatus":fr.0,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab)),"controls":get(&again,"/v1/risk/kill-switch"),"c11":c11::current(&again)}),
        2,
    );
}
#[test]
fn account_state_publisher_fence_holds_current_approval_through_io_reservation() {
    let lab = Lab::new();
    let (_p, url, c, _, _, p, _, _) = setup(&lab);
    let r = market::review(&url, &c);
    let id = market::approved(&url, &r);
    let before = risk::immutable(&risk::native(&lab));
    let fence = owner_store(&lab, "account-books-fence");
    let guard = fence.lock().unwrap();
    let (tx, rx) = mpsc::channel();
    let caller = std::thread::spawn(move || {
        tx.send(current::submit(&url, &id, "fenced-account"))
            .unwrap()
    });
    assert!(rx.recv_timeout(Wait::from_millis(100)).is_err());
    let mut revoked = p.clone();
    revoked.revision = 2;
    revoked.previous_hash = Some(p.content_hash().unwrap());
    revoked.enabled = false;
    owner_store(&lab, "account-valuation-policy")
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
        "QUANTOS_ACCOUNT_FENCE_RESULT",
        &lab,
        json!({"publisherFenceWaited":true,"ioStatus":refused.0,"observed":market::state(&lab),"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab))}),
        1,
    );
}
#[test]
fn account_state_authenticated_cold_checkpoint_signature_tamper_refuses_without_repair() {
    let lab = Lab::new();
    let (_p, _, _, _, _, _, _, _) = setup(&lab);
    let before = risk::immutable(&risk::native(&lab));
    {
        let store = owner_store(&lab, "approvals");
        let tx = store.lock().unwrap();
        let mut v = tx.read().unwrap().unwrap();
        v["valuation"]["accountHistory"]["artifacts"][0]["payload"]["accountStatus"] =
            json!("closed");
        tx.write(&v).unwrap();
    }
    let (_cold, cold) = lab.bff(true);
    let r = call(
        &cold,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "tamper-account",
    );
    assert_eq!(r.0, 503);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    emit(
        "QUANTOS_ACCOUNT_TAMPER_RESULT",
        &lab,
        json!({"tamperStatus":r.0,"claimsBefore":before,"claimsAfter":risk::immutable(&risk::native(&lab))}),
        1,
    );
}

fn authored_opening(lab: &Lab, i: &Inputs) -> Opening {
    let owner: Value =
        serde_json::from_slice(&fs::read(lab.directory.join("bff-owner.json")).unwrap()).unwrap();
    Opening {
        source_id: quantos_portfolio::native_valuation::SOURCE.into(),
        basis: quantos_portfolio::native_valuation::BASIS.into(),
        origin_ledger_hash: serde_json::from_value(
            quantos_portfolio::native_ledger::NativeLedger::new(i.scope.clone())
                .unwrap()
                .view()
                .unwrap()["ledgerHash"]
                .clone(),
        )
        .unwrap(),
        opening_at: serde_json::from_value(owner["createdAt"].clone()).unwrap(),
        cash_source_ref: "fixture:authenticated-opening-cash:1".into(),
        quote_cash_at_opening: "10000".into(),
        realized_pnl_before_origin_today: "-5".into(),
        quote_currency: "USDT".into(),
    }
}
pub(super) fn produce(
    p: &Policy,
    i: &Inputs,
    version: u64,
    previous: Option<quantos_core::ContentHash>,
    status: &str,
) -> Result<Artifact, quantos_portfolio::account_provenance::Error> {
    Artifact::from_observation(
        p,
        i.raw_market_hash().unwrap(),
        version,
        previous,
        Observation {
            opening: p.opening.clone(),
            observed_at: i.as_of,
            account_status: status.into(),
            account_status_at: i.as_of,
            cash_coverage_through: i.as_of,
            status_source_ref: "fixture:authenticated-status:1".into(),
            quality: "normal".into(),
        },
    )
}
#[test]
fn account_state_reissued_market_key_certificate_cannot_bootstrap_account_authority() {
    let lab = Lab::new();
    let (_boot, _, candidate, ledger, _, _, mp, ma) = market::setup(&lab);
    let mut i = valuation::input(&lab, &ledger, 3);
    i.marks.clear();
    let mut p = policy(&lab, &i);
    let key = PKey::private_key_from_pem(&fs::read(lab.directory.join("server-key.pem")).unwrap())
        .unwrap();
    let mut name = openssl::x509::X509NameBuilder::new().unwrap();
    name.append_entry_by_text("CN", "reissued-account.invalid")
        .unwrap();
    let name = name.build();
    let mut cert = openssl::x509::X509::builder().unwrap();
    cert.set_version(2).unwrap();
    cert.set_subject_name(&name).unwrap();
    cert.set_issuer_name(&name).unwrap();
    cert.set_pubkey(&key).unwrap();
    cert.set_not_before(
        &openssl::asn1::Asn1Time::from_unix(Utc::now().timestamp() - 3600).unwrap(),
    )
    .unwrap();
    cert.set_not_after(&openssl::asn1::Asn1Time::days_from_now(1).unwrap())
        .unwrap();
    cert.sign(&key, MessageDigest::sha256()).unwrap();
    let cert = cert.build();
    p.certificate = String::from_utf8(cert.to_pem().unwrap()).unwrap();
    p.signer = fingerprint(&cert).unwrap();
    assert_ne!(p.signer, mp.signer);
    let a = seal(produce(&p, &i, 1, None, "active").unwrap(), &key, DOMAIN);
    a.verify(&p).unwrap();
    let m = market::produce(
        &lab,
        &mp,
        &i,
        2,
        Some(ma.payload.content_hash().unwrap()),
        &["BTCUSDT"],
    );
    valuation::write(&lab, &i);
    publish(&lab, &p, &a, &m);
    enabled(&lab, true);
    let (_cold, url) = lab.bff(true);
    let before = risk::immutable(&risk::native(&lab));
    let v = call(
        &url,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "same-key-new-cert",
    );
    assert_ne!(v.0, 200);
    let old: Value =
        serde_json::from_slice(&fs::read(lab.directory.join("bff-owner.json")).unwrap()).unwrap();
    assert!(old["accountValuationEnabled"] == true);
    assert_eq!(risk::immutable(&risk::native(&lab)), before);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    assert!(candidate["subjectId"].is_string());
}
