//! Authenticated fresh cash account: no seed order, synthetic position or tick.
use super::financial_review_gate::capture;
use super::*;
use super::{
    account_books as books, account_state as account, current_execution as current,
    r01_provenance as market, valuation,
};

fn publish(
    lab: &Lab,
    input: &quantos_portfolio::native_valuation::Inputs,
    p: &quantos_portfolio::account_provenance::Policy,
    a: &quantos_portfolio::account_provenance::SignedArtifact,
) {
    valuation::write(lab, input);
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
}
fn setup(
    lab: &Lab,
) -> (
    Process,
    String,
    Value,
    quantos_portfolio::native_valuation::Inputs,
    quantos_portfolio::account_provenance::Policy,
    quantos_portfolio::account_provenance::SignedArtifact,
) {
    current::enabled(lab);
    let (boot, url) = lab.bff(true);
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    assert_eq!(ledger["appliedFillCount"], 0);
    assert_eq!(ledger["quarantinedCommandCount"], 0);
    let mut i = valuation::input(lab, &ledger, 1);
    i.marks.clear();
    let p = account::policy(lab, &i);
    let a = account::signed(lab, account::produce(&p, &i, 1, None, "active").unwrap());
    (boot, url, ledger, i, p, a)
}
#[test]
fn cash_only_current_snapshot_signed_deny_preserves_original_blocked_open_and_cold_claims() {
    let lab = Lab::new();
    let (_boot, url, ledger, input, p, a) = setup(&lab);
    let mut b = books::statement(&lab);
    for row in &mut b.positions {
        row.amount = "0".into();
    }
    b.cash[0].amount = "10000".into();
    b.fees[0].amount = "0".into();
    books::publish(&lab, &b);
    let initial = get(&url, "/v1/assisted-testnet/reconciliation");
    let initial_alerts = get(&url, "/v1/alerts");
    assert_eq!(initial_alerts["items"].as_array().unwrap().len(), 1);
    assert_eq!(
        initial["accountBooks"]["status"],
        "LOCAL_OPENING_BASIS_UNAVAILABLE"
    );
    publish(&lab, &input, &p, &a);
    account::enabled(&lab, true);
    // Deliberately no R01 policy/artifact, no market opt-in and no native IO.
    let (_live, live) = lab.bff(true);
    let before = owner_store(&lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap();
    let v = get(&live, "/v1/assisted-testnet/valuation");
    assert_eq!(v["reason"], "READY_OWNED_AUTHENTICATED_ACCOUNT_CASH_ONLY");
    assert_eq!(v["riskInputReady"], true);
    let s = &v["snapshot"];
    assert_eq!(s["quoteCash"], "10000");
    assert_eq!(s["equity"], "10000");
    assert_eq!(s["positions"], json!([]));
    assert_eq!(s["exposureGross"], "0");
    assert_eq!(s["exposureNet"], "0");
    assert_eq!(s["unrealizedPnl"], "0");
    assert_eq!(s["realizedPnlToday"], "-5");
    assert!(v.get("marketProvenance").is_none());
    let matched = get(&live, "/v1/assisted-testnet/reconciliation");
    assert_eq!(
        matched["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    let candidates = get(&live, "/v1/assisted-testnet/risk-review-candidates");
    let candidate = candidates["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["symbol"] == "ETHUSDT")
        .unwrap();
    let key = Uuid::new_v4().to_string();
    let path = format!(
        "/v1/assisted-testnet/subjects/{}/risk-reviews",
        candidate["subjectId"].as_str().unwrap()
    );
    let body = json!({"snapshotHash":s["snapshotHash"],"expectedGeneration":"0"});
    let reply = call(&live, "session-current", "POST", &path, body.clone(), &key);
    assert_eq!(reply.0, 200, "{}", reply.1);
    let r = reply.1;
    assert_eq!(r["decision"]["verdict"], "deny");
    assert!(r.get("subject").is_none());
    assert_eq!(r["accountProvenance"], v["accountProvenance"]);
    assert_eq!(r["snapshotHash"], s["snapshotHash"]);
    assert_eq!(r["proposalHash"], candidate["proposalHash"]);
    assert_eq!(r["booksAdmission"]["input"]["openObligations"], 1);
    let state = market::state(&lab);
    assert!(state.get("marketHistory").is_none());
    assert_eq!(state["sources"].as_array().unwrap().len(), 1);
    let (_cold, cold) = lab.bff(true);
    let cv = get(&cold, "/v1/assisted-testnet/valuation");
    assert_eq!(cv["snapshot"], v["snapshot"]);
    let replay = call(&cold, "session-current", "POST", &path, body, &key);
    assert_eq!(replay.0, 200, "{}", replay.1);
    assert_eq!(replay.1, r);
    let after = owner_store(&lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap();
    assert_eq!(before, after);
    assert_eq!(get(&cold, "/v1/assisted-testnet/ledger"), ledger);
    let alerts = get(&cold, "/v1/alerts");
    assert_eq!(alerts, initial_alerts);
    let evidence: Vec<quantos_reconcile::current::AlertEvidence> =
        serde_json::from_value(initial["alertEvidence"].clone()).unwrap();
    let coverage = quantos_reconcile::financial_review::coverage(evidence.iter());
    assert_eq!(coverage.blocked, 1);
    assert_eq!(coverage.financial, 0);
    assert_eq!(coverage.source_health, 0);
    let sr = get(&cold, "/v1/assisted-testnet/source-reviews");
    let fr = get(&cold, "/v1/assisted-testnet/financial-reviews");
    assert_eq!(sr["reviewable"], false);
    assert_eq!(fr["reviewable"], false);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    let audit = get(&cold, "/v1/audit/events");
    let again = get(&cold, "/v1/audit/events");
    // The C10 reader appends its own audit.search_accessed event. Compare only
    // the stable risk projection, while retaining those new access facts.
    let risk_events = |page: &Value| {
        page["items"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|e| e["kind"] == "risk.native_review_created")
            .cloned()
            .collect::<Vec<_>>()
    };
    assert_eq!(risk_events(&audit).len(), 1);
    assert_eq!(risk_events(&audit), risk_events(&again));
    let audit = again;
    let ids: std::collections::BTreeSet<_> = audit["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["eventId"].clone().to_string())
        .collect();
    assert_eq!(ids.len(), audit["items"].as_array().unwrap().len());
    valuation::evidence(
        "QUANTOS_CASH_ONLY_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"protocolCalls":0,"ledger":ledger,"input":input,"accountProof":{"policy":p,"artifact":a},"valuation":v,"risk":r,"coldValuation":cv,"replay":replay.1,"initial":initial,"matched":matched,"initialAlerts":initial_alerts,"alerts":alerts,"coverage":coverage,"sourceReview":sr,"financialReview":fr,"nativeBefore":before,"nativeAfter":after,"state":state,"independentBooks":capture(&lab),"audit":audit}),
    );
}
#[test]
fn cash_only_missing_invalid_expired_and_revoked_account_never_uses_cached_snapshot() {
    let lab = Lab::new();
    let (_boot, _url, _ledger, input, p, a) = setup(&lab);
    publish(&lab, &input, &p, &a);
    account::enabled(&lab, true);
    let (_live, url) = lab.bff(true);
    let valid = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(valid["riskInputReady"], true);
    let mut statuses = vec![];
    // Bad signature, absent artifact, forged raw cash and current revocation.
    let mut bad = a.clone();
    bad.signature = "00".into();
    publish(&lab, &input, &p, &bad);
    statuses.push(
        call(
            &url,
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation",
            json!({}),
            "bad",
        )
        .0,
    );
    fs::rename(
        lab.directory.join("account-valuation-artifact.json"),
        lab.directory.join("retained-artifact.json"),
    )
    .unwrap();
    statuses.push(
        call(
            &url,
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation",
            json!({}),
            "missing",
        )
        .0,
    );
    let mut raw = input.clone();
    raw.quote_cash_at_opening = "1000000".into();
    publish(&lab, &raw, &p, &a);
    statuses.push(
        call(
            &url,
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation",
            json!({}),
            "cash",
        )
        .0,
    );
    publish(&lab, &input, &p, &a);
    let mut revoked = p.clone();
    revoked.revision = 2;
    revoked.previous_hash = Some(p.content_hash().unwrap());
    revoked.enabled = false;
    publish(&lab, &input, &revoked, &a);
    statuses.push(
        call(
            &url,
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation",
            json!({}),
            "revoke",
        )
        .0,
    );
    let history = market::state(&lab);
    publish(&lab, &input, &p, &a);
    let (_cold, cold) = lab.bff(true);
    statuses.push(
        call(
            &cold,
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation",
            json!({}),
            "rollback",
        )
        .0,
    );
    assert!(statuses.iter().all(|s| *s != 200));
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    valuation::evidence(
        "QUANTOS_CASH_REFUSAL_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"protocolCalls":0,"valid":valid,"statuses":statuses,"history":history}),
    );
}

#[test]
fn cash_only_original_account_deadline_never_renews_on_query_or_cold_restore() {
    let lab = Lab::new();
    let (_boot, _url, _ledger, input, mut p, _a) = setup(&lab);
    p.max_age_secs = 20;
    let a = account::signed(
        &lab,
        account::produce(&p, &input, 1, None, "active").unwrap(),
    );
    publish(&lab, &input, &p, &a);
    account::enabled(&lab, true);
    let (_live, url) = lab.bff(true);
    let valid = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(valid["riskInputReady"], true);
    let before = market::state(&lab);
    let deadline: chrono::DateTime<Utc> =
        serde_json::from_value(valid["snapshot"]["expiresAt"].clone()).unwrap();
    let remaining = (deadline - Utc::now()).num_milliseconds().max(0) as u64;
    std::thread::sleep(Wait::from_millis(remaining + 30));
    let warm = call(
        &url,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "expired",
    );
    assert_ne!(warm.0, 200);
    let (_cold, cold) = lab.bff(true);
    let after = call(
        &cold,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "expired-cold",
    );
    assert_ne!(after.0, 200);
    assert_eq!(market::state(&lab), before);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    valuation::evidence(
        "QUANTOS_CASH_EXPIRY_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"protocolCalls":0,"valid":valid,"warmStatus":warm.0,"coldStatus":after.0,"stateBefore":before,"stateAfter":market::state(&lab)}),
    );
}
