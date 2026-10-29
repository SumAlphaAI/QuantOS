use super::*;
#[test]
fn known_books_and_cold_anchor_cannot_fall_back_to_an_empty_ledger_reference_seed() {
    let lab = Lab::new();
    let (_p, url) = lab.bff(true);
    let book = super::account_books::statement(&lab);
    super::account_books::publish(&lab, &book);
    let rows = get(&url, "/v1/assisted-testnet/subjects");
    let id = open(&url, &rows["items"][0]);
    approve(&url, &id, 0);
    approve(&url, &id, 1);
    let denied = super::current_execution::submit(&url, &id, "known-financial-state");
    assert_eq!(denied.0, 409);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    fs::remove_file(lab.directory.join("account-books.json")).unwrap();
    let (_r, cold) = lab.bff(true);
    let again = super::current_execution::submit(&cold, &id, "deleted-source");
    assert_eq!(again.0, 409);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    assert_eq!(
        get(&cold, "/v1/assisted-testnet/ledger")["appliedFillCount"],
        0
    );
    super::valuation::evidence(
        "QUANTOS_BOOKS_RISK_LEGACY_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"knownSourceRefusal":denied.0,"coldMissingSourceRefusal":again.0,"protocolCalls":0,"existingFinancialAnchorRetained":true,"noResend":true,"automaticClosure":false,"limitsRelaxed":false}),
    );
}
