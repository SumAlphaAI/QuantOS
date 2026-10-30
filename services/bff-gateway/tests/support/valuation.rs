use super::*;
use quantos_portfolio::{
    native_ledger::{NativeLedger, Scope},
    native_valuation::{BASIS, Inputs, Mark, SOURCE},
};
pub(super) fn input(lab: &Lab, ledger: &Value, version: u64) -> Inputs {
    let owner: Value =
        serde_json::from_slice(&fs::read(lab.directory.join("bff-owner.json")).unwrap()).unwrap();
    let scope = Scope {
        tenant_id: serde_json::from_value(ledger["tenantId"].clone()).unwrap(),
        workspace_id: serde_json::from_value(ledger["workspaceId"].clone()).unwrap(),
        account_id: serde_json::from_value(ledger["accountId"].clone()).unwrap(),
    };
    let at = chrono::DateTime::<Utc>::from_timestamp_millis(Utc::now().timestamp_millis()).unwrap();
    Inputs {
        market_provenance: None,
        schema_version: "quantos-native-valuation-input.v1".into(),
        source_id: SOURCE.into(),
        version,
        scope: scope.clone(),
        basis: BASIS.into(),
        origin_ledger_hash: serde_json::from_value(
            NativeLedger::new(scope).unwrap().view().unwrap()["ledgerHash"].clone(),
        )
        .unwrap(),
        opening_at: serde_json::from_value(owner["createdAt"].clone()).unwrap(),
        cash_source_ref: "fixture:authenticated-opening-cash:1".into(),
        quote_cash_at_opening: "10000".into(),
        realized_pnl_before_origin_today: "-5".into(),
        quote_currency: "USDT".into(),
        ledger_hash: serde_json::from_value(ledger["ledgerHash"].clone()).unwrap(),
        ledger_anchor: serde_json::from_value(ledger["anchor"].clone()).unwrap(),
        as_of: at,
        valid_until: at + Duration::seconds(30),
        cash_coverage_through: at,
        account_status: "active".into(),
        account_status_at: at,
        status_source_ref: "fixture:authenticated-status:1".into(),
        marks: ledger["positions"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|p| p["quantity"] != "0")
            .map(|p| Mark {
                symbol: p["symbol"].as_str().unwrap().into(),
                price: "1100".into(),
                source_ref: "fixture:approved-independent-mark:1".into(),
                observed_at: at,
                quality: "normal".into(),
            })
            .collect(),
    }
}
pub(super) fn write(lab: &Lab, i: &Inputs) {
    owner_store(lab, "valuation-input")
        .lock()
        .unwrap()
        .write(&json!(i))
        .unwrap();
}
pub(super) fn evidence(name: &str, v: Value) {
    if let Ok(p) = std::env::var(name) {
        private_write(p, serde_json::to_vec_pretty(&v).unwrap());
    }
}
#[test]
fn current_native_valuation_sources_expiry_replay_and_recovery_do_not_authorize_new_io() {
    let lab = Lab::new();
    let (_p, url) = lab.bff(true);
    let absent = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(absent["riskInputReady"], false);
    assert_eq!(absent["reason"], "SOURCE_UNAVAILABLE");
    assert!(absent.get("snapshot").is_none());
    let rows = get(&url, "/v1/assisted-testnet/subjects");
    let id = open(&url, &rows["items"][0]);
    approve(&url, &id, 0);
    approve(&url, &id, 1);
    let (s, command) = call(
        &url,
        "session-current",
        "POST",
        &format!("/v1/assisted-testnet/requests/{id}/commands"),
        json!({"expectedRevision":2}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(s, 200, "{command}");
    assert_eq!(command["state"], "accepted");
    assert_eq!(lab.trace()["protocolCalls"], 1);
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    let native = get(&url, &format!("/v1/assisted-testnet/requests/{id}"));
    let issued = owner_store(&lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap()["issued"]
        .clone();
    let no_mark = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(no_mark["riskInputReady"], false);
    assert_eq!(no_mark["reason"], "SOURCE_UNAVAILABLE");
    let i = input(&lab, &ledger, 1);
    write(&lab, &i);
    let ready = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(ready["riskInputReady"], true, "{ready}");
    let snapshot = &ready["snapshot"];
    for (k, v) in [
        ("quoteCash", "8999.99"),
        ("equity", "10099.99"),
        ("exposureGross", "1100"),
        ("exposureNet", "1100"),
        ("unrealizedPnl", "100"),
        ("realizedPnlToday", "-5.01"),
        ("totalPnlToday", "94.99"),
    ] {
        assert_eq!(snapshot[k], v, "{k}");
    }
    assert_eq!(snapshot["ledgerHash"], ledger["ledgerHash"]);
    assert_eq!(snapshot["killGeneration"], "0");
    assert_eq!(snapshot["executionAuthority"], false);
    assert_eq!(
        get(&url, "/v1/assisted-testnet/valuation")["snapshot"],
        *snapshot
    );
    let (_r, restarted) = lab.bff(true);
    assert_eq!(
        get(&restarted, "/v1/assisted-testnet/valuation")["snapshot"],
        *snapshot
    );
    for (who, method, path, status) in [
        (
            "session-viewer",
            "GET",
            "/v1/assisted-testnet/valuation",
            403,
        ),
        (
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation?mark=999999",
            422,
        ),
    ] {
        assert_eq!(
            call(
                &restarted,
                who,
                method,
                path,
                json!({}),
                &Uuid::new_v4().to_string()
            )
            .0,
            status
        );
    }
    // An unsupported method has an empty Axum 405 response, not a JSON error.
    assert_eq!(
        reqwest::blocking::Client::builder()
            .no_proxy()
            .build()
            .unwrap()
            .post(format!("{restarted}/v1/assisted-testnet/valuation"))
            .header(
                "cookie",
                "quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001"
            )
            .header("origin", "http://localhost:3190")
            .json(&json!({"mark":"999999"}))
            .send()
            .unwrap()
            .status()
            .as_u16(),
        405
    );
    let source_bytes = fs::read(lab.directory.join("valuation-input.json")).unwrap();
    private_write(lab.directory.join("valuation-input.json"), b"{bad");
    let corrupt = get(&restarted, "/v1/assisted-testnet/valuation");
    assert_eq!(corrupt["riskInputReady"], false);
    assert!(corrupt.get("snapshot").is_none());
    private_write(lab.directory.join("valuation-input.json"), &source_bytes);
    let mut changed = i.clone();
    changed.marks[0].price = "1200".into();
    write(&lab, &changed);
    assert_eq!(
        call(
            &restarted,
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation",
            json!({}),
            "conflict"
        )
        .0,
        503
    );
    write(&lab, &i);
    let old = owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    let mut missing = input(&lab, &ledger, 2);
    missing.marks.clear();
    write(&lab, &missing);
    let blocked = get(&restarted, "/v1/assisted-testnet/valuation");
    assert_eq!(blocked["reason"], "MISSING_MARK");
    assert_eq!(blocked["riskInputReady"], false);
    assert_eq!(blocked["snapshotCount"], 1);
    assert!(blocked.get("snapshot").is_none());
    write(&lab, &i);
    let (_cold, cold) = lab.bff(true);
    assert_eq!(
        call(
            &cold,
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation",
            json!({}),
            "rollback"
        )
        .0,
        503
    );
    write(&lab, &missing);
    let good = owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .write(&old)
        .unwrap();
    assert_ne!(
        call(
            &restarted,
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation",
            json!({}),
            "old-journal"
        )
        .0,
        200
    );
    owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .write(&good)
        .unwrap();
    let (_fresh, fresh) = lab.bff(true);
    assert_eq!(
        get(&fresh, "/v1/assisted-testnet/valuation")["reason"],
        "MISSING_MARK"
    );
    // Publish a fresh short lease after recovery, rather than spending its
    // original deadline bootstrapping a new process.
    let mut short = input(&lab, &ledger, 3);
    short.valid_until = short.as_of + Duration::seconds(3);
    write(&lab, &short);
    let short_ready = get(&fresh, "/v1/assisted-testnet/valuation");
    assert_eq!(short_ready["riskInputReady"], true, "{short_ready}");
    std::thread::sleep(Wait::from_millis(3100));
    let expired = get(&fresh, "/v1/assisted-testnet/valuation");
    assert_eq!(expired["riskInputReady"], false);
    assert_eq!(expired["reason"], "STALE_SOURCE");
    assert!(expired.get("snapshot").is_none());
    assert_eq!(expired["snapshotCount"], 2);
    let mut reset = input(&lab, &ledger, 4);
    reset.quote_cash_at_opening = "20000".into();
    write(&lab, &reset);
    assert_eq!(
        call(
            &fresh,
            "session-current",
            "GET",
            "/v1/assisted-testnet/valuation",
            json!({}),
            "cash-reset"
        )
        .0,
        503
    );
    write(&lab, &short);
    let next = open(&fresh, &rows["items"][1]);
    approve(&fresh, &next, 0);
    approve(&fresh, &next, 1);
    assert_eq!(
        call(
            &fresh,
            "session-current",
            "POST",
            &format!("/v1/assisted-testnet/requests/{next}/commands"),
            json!({"expectedRevision":2}),
            &Uuid::new_v4().to_string()
        )
        .0,
        409
    );
    assert_eq!(get(&fresh, "/v1/assisted-testnet/ledger"), ledger);
    assert_eq!(
        get(&fresh, &format!("/v1/assisted-testnet/requests/{id}")),
        native
    );
    assert_eq!(
        owner_store(&lab, "commands")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap()["issued"],
        issued
    );
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_X01_VALUATION_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"initial":absent,"withoutMarkSource":no_mark,"ready":ready,"input":i,"ledger":ledger,"native":native,"missing":blocked,"corrupt":corrupt,"shortReady":short_ready,"expired":expired,"versionConflictDenied":true,"coldSourceRollbackDenied":true,"hotJournalRollbackDenied":true,"cashResetDenied":true,"clientUploadAndWrongRoleDenied":true,"newCommandStillDenied":true,"sameNativeFactsAndLedger":true,"originalNativeReservationsUnchanged":true,"protocolCalls":1,"noResend":true,"automaticClosure":false}),
    );
}
pub(super) fn unknown(lab: &Lab, url: &str, command: &Value) {
    super::risk_refresh::unknown_refusal(lab, url, command);
    let before = get(url, "/v1/assisted-testnet/ledger");
    let issued = owner_store(lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap()["issued"]
        .clone();
    let alerts = get(url, "/v1/alerts");
    let input = input(lab, &before, 1);
    write(lab, &input);
    let view = get(url, "/v1/assisted-testnet/valuation");
    assert_eq!(view["reason"], "UNKNOWN_OR_QUARANTINED_OBLIGATIONS");
    assert_eq!(view["killGeneration"], "1");
    assert_eq!(view["riskInputReady"], false);
    assert!(view.get("snapshot").is_none());
    assert_eq!(view["snapshotCount"], 0);
    assert_eq!(view["quarantinedCommandCount"], 1);
    let (_r, restarted) = lab.bff(true);
    let recovered = get(&restarted, "/v1/assisted-testnet/valuation");
    assert_eq!(recovered["reason"], view["reason"]);
    assert_eq!(recovered["killGeneration"], "1");
    assert_eq!(get(&restarted, "/v1/alerts"), alerts);
    assert_eq!(get(&restarted, "/v1/assisted-testnet/ledger"), before);
    assert_eq!(
        get(
            &restarted,
            &format!(
                "/v1/assisted-testnet/requests/{}",
                command["requestId"].as_str().unwrap()
            )
        )["command"],
        *command
    );
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    assert_eq!(
        owner_store(lab, "commands")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap()["issued"],
        issued
    );
    evidence(
        "QUANTOS_X01_VALUATION_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"view":view,"recovered":recovered,"command":command,"ledger":before,"alerts":alerts,"input":input,"originalCommandUnchanged":true,"originalNativeReservationsUnchanged":true,"protocolCalls":1,"noResend":true,"automaticClosure":false}),
    );
}

#[cfg(unix)]
#[test]
fn failed_checkpoint_does_not_publish_new_source_or_snapshot_and_cold_recovery_uses_committed_version()
 {
    use std::os::unix::fs::PermissionsExt;
    let lab = Lab::new();
    let (_p, url) = lab.bff(true);
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    let first = input(&lab, &ledger, 1);
    write(&lab, &first);
    let ready = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(ready["riskInputReady"], true);
    let before = owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    let mut second = input(&lab, &ledger, 2);
    second.account_status = "suspended".into();
    write(&lab, &second);
    fs::set_permissions(&lab.directory, fs::Permissions::from_mode(0o500)).unwrap();
    assert!(
        fs::write(
            lab.directory.join("valuation-write-denial-probe"),
            b"must refuse"
        )
        .is_err()
    );
    let failed = call(
        &url,
        "session-current",
        "GET",
        "/v1/assisted-testnet/valuation",
        json!({}),
        "fail-save",
    );
    fs::set_permissions(&lab.directory, fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(failed.0, 503, "{:?}", failed.1);
    assert_eq!(
        owner_store(&lab, "approvals")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap(),
        before
    );
    write(&lab, &first);
    let (_cold, cold) = lab.bff(true);
    let recovered = get(&cold, "/v1/assisted-testnet/valuation");
    assert_eq!(recovered["snapshot"], ready["snapshot"]);
    assert_eq!(recovered["sourceVersion"], "1");
    assert_eq!(recovered["snapshotCount"], 1);
    write(&lab, &second);
    let explicit = get(&cold, "/v1/assisted-testnet/valuation");
    assert_eq!(explicit["riskInputReady"], false);
    assert_eq!(explicit["reason"], "INACTIVE_ACCOUNT");
    assert_eq!(explicit["sourceVersion"], "2");
    assert_eq!(explicit["snapshotCount"], 1);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_X01_VALUATION_WRITE_FAILURE_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"actualOsWriteDenied":true,"failedStatus":failed.0,"committedCheckpointUnchanged":true,"ready":ready,"recovered":recovered,"explicit":explicit,"newSourceNotPublishedOnFailure":true,"protocolCalls":0,"noResend":true}),
    );
}
