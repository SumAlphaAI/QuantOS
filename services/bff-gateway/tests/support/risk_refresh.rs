use super::valuation::{evidence, input, write};
use super::*;
use quantos_core::ContentHash;
fn request(url: &str, subject: &Value, view: &Value, key: &str) -> (u16, Value) {
    call(
        url,
        "session-current",
        "POST",
        &format!(
            "/v1/assisted-testnet/subjects/{}/risk-reviews",
            subject["subjectId"].as_str().unwrap()
        ),
        json!({"snapshotHash":view["snapshot"]["snapshotHash"],"expectedGeneration":view["killGeneration"]}),
        key,
    )
}
#[test]
fn current_native_snapshot_explicit_new_signed_deny_same_proposal_idempotency_recovery_and_no_io() {
    let lab = Lab::new();
    let (_p, url) = lab.bff(true);
    let rows = get(&url, "/v1/assisted-testnet/subjects");
    let original = rows["items"][0].clone();
    let id = open(&url, &original);
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
    let native = get(&url, &format!("/v1/assisted-testnet/requests/{id}"));
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    let issued = owner_store(&lab, "commands")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap()["issued"]
        .clone();
    let mut i = input(&lab, &ledger, 1);
    i.valid_until = i.as_of + Duration::seconds(30);
    write(&lab, &i);
    let view = get(&url, "/v1/assisted-testnet/valuation");
    assert_eq!(view["riskInputReady"], true);
    let key = Uuid::new_v4().to_string();
    let (s, review) = request(&url, &original, &view, &key);
    assert_eq!(s, 200, "{review}");
    assert_eq!(review["proposalHash"], original["proposalHash"]);
    assert_ne!(review["decision"]["decisionId"], original["decisionId"]);
    assert_eq!(review["decision"]["verdict"], "deny");
    assert!(review.get("subject").is_none());
    assert_eq!(review["snapshotHash"], view["snapshot"]["snapshotHash"]);
    let events = get(
        &url,
        &format!(
            "/v1/audit/events?correlationId={}",
            review["decision"]["decisionId"].as_str().unwrap()
        ),
    );
    assert_eq!(events["items"][0]["kind"], "risk.native_review_created");
    assert_eq!(events["items"][0]["redactedPayload"]["review"], review);
    assert_eq!(request(&url, &original, &view, &key), (200, review.clone()));
    let (_r, cold) = lab.bff(true);
    assert_eq!(
        request(&cold, &original, &view, &key),
        (200, review.clone())
    );
    let path = format!(
        "/v1/assisted-testnet/subjects/{}/risk-reviews",
        original["subjectId"].as_str().unwrap()
    );
    let body = json!({"snapshotHash":view["snapshot"]["snapshotHash"],"expectedGeneration":"0"});
    for (who, body, status) in [
        ("session-viewer", body.clone(), 403),
        ("session-approver", body.clone(), 403),
        (
            "session-current",
            json!({"snapshotHash":ContentHash::sha256_bytes(b"foreign"),"expectedGeneration":"0"}),
            409,
        ),
        (
            "session-current",
            json!({"snapshotHash":view["snapshot"]["snapshotHash"],"expectedGeneration":"1"}),
            409,
        ),
        (
            "session-current",
            json!({"snapshotHash":view["snapshot"]["snapshotHash"],"expectedGeneration":"0","equity":"999999"}),
            422,
        ),
    ] {
        assert_eq!(
            call(&cold, who, "POST", &path, body, &Uuid::new_v4().to_string()).0,
            status
        );
    }
    let mut missing = input(&lab, &ledger, 2);
    missing.marks.clear();
    write(&lab, &missing);
    assert_eq!(request(&cold, &original, &view, &key).0, 409);
    let mut current = input(&lab, &ledger, 3);
    current.valid_until = current.as_of + Duration::seconds(2);
    write(&lab, &current);
    let short = get(&cold, "/v1/assisted-testnet/valuation");
    let (_, short_review) = request(&cold, &original, &short, &Uuid::new_v4().to_string());
    assert_eq!(short_review["decision"]["verdict"], "deny");
    std::thread::sleep(Wait::from_millis(2100));
    assert_eq!(
        request(&cold, &original, &short, &Uuid::new_v4().to_string()).0,
        409
    );
    assert_eq!(
        get(&cold, &format!("/v1/assisted-testnet/requests/{id}")),
        native
    );
    assert_eq!(get(&cold, "/v1/assisted-testnet/ledger"), ledger);
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
        "QUANTOS_X02_NATIVE_REVIEW_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualTestnet":false,"audit":events,"originalSubject":original,"native":native,"ledger":ledger,"valuation":view,"review":review,"shortReview":short_review,"sameProposal":true,"idempotentOriginalResponse":true,"coldRecovery":true,"missingMarkAndExpiryDenied":true,"injectedFinancialsWrongRoleHashGenerationDenied":true,"originalNativeReservationsUnchanged":true,"protocolCalls":1,"noResend":true,"automaticClosure":false}),
    );
}
pub(super) fn unknown_refusal(lab: &Lab, url: &str, command: &Value) {
    let subjects = get(url, "/v1/assisted-testnet/requests");
    let subject = subjects["items"][0]["subject"].clone();
    let denied = request(
        url,
        &subject,
        &json!({"snapshot":{"snapshotHash":ContentHash::sha256_bytes(b"cannot-substitute-unknown")},"killGeneration":"1"}),
        &Uuid::new_v4().to_string(),
    );
    assert_eq!(denied.0, 409);
    assert_eq!(
        get(
            url,
            &format!(
                "/v1/assisted-testnet/requests/{}",
                command["requestId"].as_str().unwrap()
            )
        )["command"],
        *command
    );
    evidence(
        "QUANTOS_X02_NATIVE_UNKNOWN_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"status":denied.0,"command":command,"noNewDecision":true,"originalGenerationPreserved":true,"unknownRetained":true,"noResend":true,"automaticClosure":false}),
    );
    let _ = lab;
}
#[cfg(unix)]
#[test]
fn native_review_real_write_failure_withholds_response_and_cold_recovery_creates_only_explicit_review()
 {
    use std::os::unix::fs::PermissionsExt;
    let lab = Lab::new();
    let (_p, url) = lab.bff(true);
    let rows = get(&url, "/v1/assisted-testnet/subjects");
    let original = rows["items"][0].clone();
    let ledger = get(&url, "/v1/assisted-testnet/ledger");
    let i = input(&lab, &ledger, 1);
    write(&lab, &i);
    let view = get(&url, "/v1/assisted-testnet/valuation");
    let before = owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    fs::set_permissions(&lab.directory, fs::Permissions::from_mode(0o500)).unwrap();
    assert!(fs::write(lab.directory.join("risk-write-denial"), b"denied").is_err());
    let key = Uuid::new_v4().to_string();
    let denied = request(&url, &original, &view, &key);
    fs::set_permissions(&lab.directory, fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(denied.0, 503);
    assert_eq!(
        owner_store(&lab, "approvals")
            .lock()
            .unwrap()
            .read()
            .unwrap()
            .unwrap(),
        before
    );
    let (_cold, cold) = lab.bff(true);
    let (s, review) = request(&cold, &original, &view, &key);
    assert_eq!(s, 200, "{review}");
    assert_eq!(review["decision"]["verdict"], "deny");
    let after = owner_store(&lab, "approvals")
        .lock()
        .unwrap()
        .read()
        .unwrap()
        .unwrap();
    assert_eq!(after["riskRefreshes"].as_array().unwrap().len(), 1);
    assert!(lab.trace.recv_timeout(Wait::from_millis(100)).is_err());
    evidence(
        "QUANTOS_X02_NATIVE_WRITE_RESULT",
        json!({"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"actualOsWriteDenied":true,"failedStatus":503,"checkpointUnchanged":true,"coldRecoveryExplicitReview":review,"persistedReviewCount":1,"protocolCalls":0,"noResend":true}),
    );
}
