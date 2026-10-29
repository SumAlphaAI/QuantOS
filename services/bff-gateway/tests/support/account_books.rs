//! Independent account statement producer is a test fixture only. It never
//! reads X01 balances, native facts, fills or protocol observer response bodies.
use super::*;
use openssl::{hash::MessageDigest, pkey::PKey, sign::Signer, x509::X509};
use quantos_reconcile::account_books::{Balance, Books, COVERAGE};
pub(super) fn statement(lab: &Lab) -> Books {
    let owner: Value =
        serde_json::from_slice(&fs::read(lab.directory.join("bff-owner.json")).unwrap()).unwrap();
    let cert = X509::from_pem(&fs::read(lab.directory.join("server.pem")).unwrap()).unwrap();
    let at = chrono::DateTime::<Utc>::from_timestamp_millis(Utc::now().timestamp_millis()).unwrap();
    let row = |asset: &str, amount: &str| Balance {
        asset: asset.into(),
        amount: amount.into(),
        source_ref: format!("fixture:independent-account-export:{asset}"),
    };
    Books {
        schema_version: "quantos-independent-account-books.v1".into(),
        scope: quantos_portfolio::native_ledger::Scope {
            tenant_id: serde_json::from_value(json!("22222222-2222-4222-8222-222222222222"))
                .unwrap(),
            workspace_id: serde_json::from_value(json!("33333333-3333-4333-8333-333333333333"))
                .unwrap(),
            account_id: serde_json::from_value(json!("44444444-4444-4444-8444-444444444444"))
                .unwrap(),
        },
        source_id: fingerprint(&cert).unwrap(),
        version: 1,
        previous_hash: None,
        source_ref: "fixture:independent-account-export:1".into(),
        coverage: COVERAGE.into(),
        position_universe: vec!["BTCUSDT".into(), "ETHUSDT".into()],
        cash_universe: vec!["USDT".into()],
        fee_universe: vec!["USDT".into()],
        positions_complete: true,
        cash_complete: true,
        fees_complete: true,
        external_flows_absent: true,
        liabilities_absent: true,
        open_orders_absent: true,
        period_start: serde_json::from_value(owner["createdAt"].clone()).unwrap(),
        coverage_through: at,
        captured_at: at,
        valid_until: at + Duration::seconds(30),
        positions: vec![row("BTCUSDT", "1"), row("ETHUSDT", "0")],
        cash: vec![row("USDT", "8999.99")],
        fees: vec![row("USDT", "0.01")],
    }
}
fn write(lab: &Lab, b: &Books, domain: &str) {
    let key = PKey::private_key_from_pem(&fs::read(lab.directory.join("server-key.pem")).unwrap())
        .unwrap();
    let mut signer = Signer::new(MessageDigest::sha256(), &key).unwrap();
    signer
        .update(&quantos_core::canonical_json_bytes(&json!([domain, b])).unwrap())
        .unwrap();
    let signature = signer
        .sign_to_vec()
        .unwrap()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    private_write(
        lab.directory.join("account-books.json"),
        serde_json::to_vec(&json!({"payload":b,"signature":signature})).unwrap(),
    );
}
pub(super) fn publish(lab: &Lab, b: &Books) {
    write(lab, b, "quantos-x05-independent-account-books-signature/v1");
}
pub(super) fn advance(b: &mut Books) {
    b.previous_hash = Some(b.content_hash().unwrap());
    b.version += 1;
    let at = chrono::DateTime::<Utc>::from_timestamp_millis(Utc::now().timestamp_millis()).unwrap();
    b.coverage_through = at;
    b.captured_at = at;
    b.valid_until = at + Duration::seconds(30);
}
fn reconcile(url: &str) -> Value {
    get(url, "/v1/assisted-testnet/reconciliation")
}
fn command(lab: &Lab, url: &str) -> String {
    let rows = get(url, "/v1/assisted-testnet/subjects");
    let id = open(url, &rows["items"][0]);
    approve(url, &id, 0);
    approve(url, &id, 1);
    let (s, c) = call(
        url,
        "session-current",
        "POST",
        &format!("/v1/assisted-testnet/requests/{id}/commands"),
        json!({"expectedRevision":2}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{c}");
    assert_eq!(c["state"], "accepted");
    assert_eq!(lab.trace()["protocolCalls"], 1);
    id
}
#[test]
fn account_books_independent_signed_financial_comparison_open_alert_c10_and_cold_recovery() {
    let lab = Lab::new();
    let (_p, url) = lab.bff(true);
    let id = command(&lab, &url);
    let before = get(&url, &format!("/v1/assisted-testnet/requests/{id}"));
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    let native = owner_store(&lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    let controls = get(&url, "/v1/risk/kill-switch");
    assert_eq!(
        call(
            &url,
            "session-viewer",
            "GET",
            "/v1/assisted-testnet/reconciliation",
            json!({}),
            "wrong-role"
        )
        .0,
        403
    );
    assert_eq!(
        call(
            &url,
            "session-current",
            "GET",
            "/v1/assisted-testnet/reconciliation?books=forged",
            json!({}),
            "upload"
        )
        .0,
        422
    );
    let absent = reconcile(&url);
    assert_eq!(absent["accountBooks"]["status"], "SOURCE_UNAVAILABLE");
    let mut b = statement(&lab);
    publish(&lab, &b);
    let no_basis = reconcile(&url);
    assert_eq!(
        no_basis["accountBooks"]["status"],
        "LOCAL_OPENING_BASIS_UNAVAILABLE"
    );
    let i = super::valuation::input(&lab, &ledger, 1);
    super::valuation::write(&lab, &i);
    assert_eq!(
        get(&url, "/v1/assisted-testnet/valuation")["riskInputReady"],
        true
    );
    let matched = reconcile(&url);
    assert_eq!(
        matched["accountBooks"]["status"], "MATCHED_DECLARED_ACCOUNT_BOOKS",
        "{matched}"
    );
    assert_eq!(matched["accountBooks"]["comparisonReady"], true);
    let first_alerts = get(&url, "/v1/alerts");
    assert_eq!(first_alerts["items"].as_array().unwrap().len(), 1);
    advance(&mut b);
    b.positions[0].amount = "2".into();
    b.cash[0].amount = "9000".into();
    b.fees[0].amount = "0".into();
    publish(&lab, &b);
    let differences = reconcile(&url);
    assert_eq!(
        differences["accountBooks"]["findings"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
    let alerts = get(&url, "/v1/alerts");
    assert_eq!(alerts["items"].as_array().unwrap().len(), 4);
    let mut audits = vec![];
    for alert in alerts["items"].as_array().unwrap() {
        assert_eq!(alert["status"], "unacked");
        assert_eq!(alert["sourceEvidence"]["status"], "OPEN");
        let a = get(
            &url,
            &format!(
                "/v1/audit/events?correlationId={}",
                alert["correlationId"].as_str().unwrap()
            ),
        );
        assert!(
            a["items"]
                .as_array()
                .unwrap()
                .iter()
                .any(|e| e["kind"] == "assisted.x05_alert_consumed")
        );
        audits.push(a);
    }
    advance(&mut b);
    b.positions[0].amount = "1".into();
    b.cash[0].amount = "8999.99".into();
    b.fees[0].amount = "0.01".into();
    publish(&lab, &b);
    let restored = reconcile(&url);
    assert_eq!(
        restored["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    assert_eq!(get(&url, "/v1/alerts"), alerts);
    let (_r, cold) = lab.bff(true);
    let recovered = reconcile(&cold);
    assert_eq!(recovered, restored);
    assert_eq!(get(&cold, "/v1/alerts"), alerts);
    let good = fs::read(lab.directory.join("account-books.json")).unwrap();
    write(&lab, &b, "quantos-x05-independent-observer-signature/v1");
    let wrong_domain = reconcile(&cold);
    assert_eq!(wrong_domain["accountBooks"]["status"], "SOURCE_UNAVAILABLE");
    assert_eq!(wrong_domain["accountBooks"]["comparisonReady"], false);
    private_write(lab.directory.join("account-books.json"), &good);
    assert_eq!(
        reconcile(&cold)["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    let mut fork = b.clone();
    fork.cash[0].amount = "1".into();
    publish(&lab, &fork);
    assert_eq!(
        call(
            &cold,
            "session-current",
            "GET",
            "/v1/assisted-testnet/reconciliation",
            json!({}),
            "fork"
        )
        .0,
        503
    );
    private_write(lab.directory.join("account-books.json"), &good);
    let mut wrong_scope = b.clone();
    wrong_scope.scope.account_id = quantos_core::AccountId::new();
    publish(&lab, &wrong_scope);
    assert_eq!(
        call(
            &cold,
            "session-current",
            "GET",
            "/v1/assisted-testnet/reconciliation",
            json!({}),
            "scope"
        )
        .0,
        503
    );
    private_write(lab.directory.join("account-books.json"), &good);
    #[cfg(unix)]
    {
        use std::os::unix::fs::symlink;
        fs::rename(
            lab.directory.join("account-books.json"),
            lab.directory.join("account-books-saved.json"),
        )
        .unwrap();
        symlink(
            lab.directory.join("account-books-saved.json"),
            lab.directory.join("account-books.json"),
        )
        .unwrap();
        assert_eq!(
            reconcile(&cold)["accountBooks"]["status"],
            "SOURCE_UNAVAILABLE"
        );
        fs::remove_file(lab.directory.join("account-books.json")).unwrap();
        fs::rename(
            lab.directory.join("account-books-saved.json"),
            lab.directory.join("account-books.json"),
        )
        .unwrap();
    }
    advance(&mut b);
    b.valid_until = b.captured_at + Duration::seconds(3);
    publish(&lab, &b);
    assert_eq!(
        reconcile(&cold)["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    std::thread::sleep(Wait::from_millis(3100));
    let stale = reconcile(&cold);
    assert_eq!(stale["accountBooks"]["status"], "STALE_SOURCE");
    assert_eq!(stale["accountBooks"]["comparisonReady"], false);
    let final_alerts = get(&cold, "/v1/alerts");
    assert_eq!(final_alerts["items"].as_array().unwrap().len(), 6);
    assert_eq!(
        get(&cold, &format!("/v1/assisted-testnet/requests/{id}")),
        before
    );
    assert_eq!(get(&cold, "/v1/assisted-testnet/ledger"), ledger);
    assert_eq!(
        owner_store(&lab, "commands")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap(),
        native
    );
    let mut after_controls = get(&cold, "/v1/risk/kill-switch");
    let mut before_controls = controls.clone();
    for value in [&mut after_controls, &mut before_controls] {
        value.as_object_mut().unwrap().remove("checkedAt");
        value.as_object_mut().unwrap().remove("expiresAt");
    }
    assert_eq!(after_controls, before_controls);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    super::valuation::evidence(
        "QUANTOS_X05_ACCOUNT_BOOKS_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"statement":b,"certificate":fs::read_to_string(lab.directory.join("server.pem")).unwrap(),"signedStatement":serde_json::from_slice::<Value>(&fs::read(lab.directory.join("account-books.json")).unwrap()).unwrap(),"absent":absent,"noBasis":no_basis,"matched":matched,"differences":differences,"restored":restored,"recovered":recovered,"wrongDomain":wrong_domain,"stale":stale,"alerts":final_alerts,"audits":audits,"ledger":ledger,"original":before,"nativeReservationsUnchanged":true,"generationUnchanged":true,"forkDenied":true,"scopeDenied":true,"symlinkDenied":true,"protocolCalls":1,"noResend":true,"automaticClosure":false}),
    );
}

#[test]
fn account_books_cannot_clear_actual_current_unknown_or_original_generation() {
    let lab = Lab::pause_at(2);
    super::current_execution::enabled(&lab);
    let (mut process, url) = lab.bff(true);
    let (_, review, id) = super::current_execution::prepare(&lab, &url);
    let base = url.clone();
    let request = id.clone();
    let caller = std::thread::spawn(move || {
        reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Wait::from_secs(5))
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
            .header("x-request-id", Uuid::new_v4().to_string())
            .header("idempotency-key", Uuid::new_v4().to_string())
            .json(&json!({"expectedRevision":2}))
            .send()
    });
    let line = lab.trace.recv_timeout(Wait::from_secs(10)).unwrap();
    let pending: Value = serde_json::from_str(line.strip_prefix("L02_PENDING=").unwrap()).unwrap();
    assert_eq!(pending["protocolCalls"], 2);
    process.0.kill().unwrap();
    process.0.wait().unwrap();
    assert!(caller.join().unwrap().is_err());
    let (_r, cold) = lab.bff(true);
    let original = get(&cold, &format!("/v1/assisted-testnet/requests/{id}"));
    assert_eq!(original["command"]["state"], "unknown");
    let ledger = get(&cold, "/v1/assisted-testnet/ledger");

    let before = owner_store(&lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    let mut book = statement(&lab);
    // Authored independent account export claims both known scenario fills. It
    // still cannot resolve the local command whose actual reply was lost.
    book.positions[1].amount = "1".into();
    book.cash[0].amount = "7999.98".into();
    book.fees[0].amount = "0.02".into();
    publish(&lab, &book);
    let view = reconcile(&cold);
    assert_eq!(
        view["accountBooks"]["status"],
        "UNKNOWN_OR_QUARANTINED_OBLIGATIONS"
    );
    assert_eq!(view["accountBooks"]["comparisonReady"], false);
    assert_eq!(view["unknownObligationsOpen"], 1);
    assert_eq!(ledger["appliedFillCount"], 1);
    assert_eq!(ledger["quarantinedCommandCount"], 1);
    let alerts = get(&cold, "/v1/alerts");
    assert_eq!(alerts["items"].as_array().unwrap().len(), 3);
    let (_again, latest) = lab.bff(true);
    assert_eq!(reconcile(&latest), view);
    assert_eq!(get(&latest, "/v1/alerts"), alerts);
    assert_eq!(get(&latest, "/v1/assisted-testnet/ledger"), ledger);
    assert_eq!(
        get(&latest, &format!("/v1/assisted-testnet/requests/{id}")),
        original
    );
    assert_eq!(
        owner_store(&lab, "commands")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap(),
        before
    );
    assert_eq!(original["command"]["currentRisk"]["killGeneration"], "0");
    assert_eq!(get(&latest, "/v1/risk/kill-switch")["generation"], "0");
    assert_eq!(lab.trace()["protocolCalls"], 2);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    super::valuation::evidence(
        "QUANTOS_X05_ACCOUNT_BOOKS_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"statement":book,"view":view,"alerts":alerts,"ledger":ledger,"original":original,"review":review,"nativeReservationsUnchanged":true,"generationUnchanged":true,"protocolCalls":2,"noResend":true,"automaticClosure":false}),
    );
}
#[cfg(unix)]
#[test]
fn account_books_failed_durable_write_cannot_publish_a_new_ready_source() {
    use std::os::unix::fs::PermissionsExt;
    let lab = Lab::new();
    let (_p, url) = lab.bff(true);
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    let i = super::valuation::input(&lab, &ledger, 1);
    super::valuation::write(&lab, &i);
    get(&url, "/v1/assisted-testnet/valuation");
    let mut book = statement(&lab);
    book.positions[0].amount = "0".into();
    book.cash[0].amount = "10000".into();
    book.fees[0].amount = "0".into();
    publish(&lab, &book);
    let matched = reconcile(&url);
    assert_eq!(
        matched["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    let old_book = book.clone();
    let before = owner_store(&lab, "reconciliation")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    advance(&mut book);
    publish(&lab, &book);
    fs::set_permissions(&lab.directory, fs::Permissions::from_mode(0o500)).unwrap();
    assert!(fs::write(lab.directory.join("write-denial-probe"), b"must refuse").is_err());
    let failed = call(
        &url,
        "session-current",
        "GET",
        "/v1/assisted-testnet/reconciliation",
        json!({}),
        "write-denied",
    );
    fs::set_permissions(&lab.directory, fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(failed.0, 503);
    assert_eq!(
        owner_store(&lab, "reconciliation")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap(),
        before
    );
    publish(&lab, &old_book);
    let (_r, cold) = lab.bff(true);
    let recovered = reconcile(&cold);
    assert_eq!(recovered, matched);
    publish(&lab, &book);
    let explicit = reconcile(&cold);
    assert_eq!(explicit["accountBooks"]["sourceVersion"], "2");
    assert_eq!(
        explicit["accountBooks"]["status"],
        "MATCHED_DECLARED_ACCOUNT_BOOKS"
    );
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    super::valuation::evidence(
        "QUANTOS_X05_ACCOUNT_BOOKS_WRITE_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"actualOsWriteDenied":true,"failedStatus":failed.0,"matched":matched,"recovered":recovered,"explicit":explicit,"newSourceNotPublishedOnFailure":true,"protocolCalls":0,"noResend":true,"automaticClosure":false}),
    );
}
