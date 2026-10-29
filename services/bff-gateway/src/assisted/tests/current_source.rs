use super::*;
use quantos_risk::guard::KillScope;
async fn opened(p: &crate::BffProvider) -> (Router, Value, String) {
    let app = p.router();
    let (status, rows) = call(
        &app,
        "session-current",
        "GET",
        "/v1/assisted-testnet/subjects",
        json!({}),
        "list",
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let subject = rows["items"][0].clone();
    let (status, r) = call(
        &app,
        "session-current",
        "POST",
        "/v1/assisted-testnet/requests",
        json!({"subjectId":subject["subjectId"]}),
        "open-source",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{r}");
    let path = format!(
        "/v1/assisted-testnet/requests/{}",
        r["request"]["requestId"].as_str().unwrap()
    );
    (app, subject, path)
}
async fn approved(app: &Router, path: &str) {
    for (i, who) in ["session-approver", "session-owner"].iter().enumerate() {
        let mut b = proof(app, who).await;
        b["expectedRevision"] = json!(i);
        let (status, r) = call(
            app,
            who,
            "POST",
            &format!("{path}/approvals"),
            b,
            &format!("source-approve-{i}"),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{r}");
    }
}
async fn kill(p: &crate::BffProvider, scope: KillScope, engaged: bool, expected: u64) {
    let state = p.data.lock().await;
    let h = state.assisted.as_ref().unwrap();
    let auth = crate::strategy::reference_auth("session-owner");
    let mut auth = auth;
    auth.account_id = None;
    auth.mode = RunMode::AssistedLive;
    auth.capabilities
        .insert(Capability::parse(Capability::EXECUTION_OPERATE).unwrap());
    h.sources
        .set_kill_switch(
            &auth,
            scope,
            engaged,
            expected,
            "owned current source stop",
            now(state.now()),
        )
        .unwrap();
}
#[tokio::test]
async fn current_r04_x02_provenance_reaches_public_c10_same_subject_and_native_command() {
    let p = crate::BffProvider::assisted_reference(true);
    let (app, subject, path) = opened(&p).await;
    approved(&app, &path).await;
    let (status, c) = call(
        &app,
        "session-current",
        "POST",
        &format!("{path}/commands"),
        json!({"expectedRevision":2}),
        "source-command",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{c}");
    assert_eq!(c["subjectHash"], subject["subjectHash"]);
    let id = path.rsplit('/').next().unwrap();
    let (status, chain) = call(
        &app,
        "session-current",
        "GET",
        &format!("/v1/audit/evidence-chains/{id}"),
        json!({}),
        "c10",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{chain}");
    let (status, events) = call(
        &app,
        "session-current",
        "GET",
        &format!("/v1/audit/events?correlationId={id}"),
        json!({}),
        "event-source",
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let node = &events["items"][0]["redactedPayload"];
    let source = &node["source"];
    assert_eq!(source["decisionId"], subject["decisionId"]);
    assert_eq!(source["proposalRecordHash"], subject["proposalHash"]);
    assert_eq!(source["decisionPurpose"], "assisted_testnet_review");
    assert_eq!(source["killGeneration"], 0);
    assert_eq!(source["executionTarget"], "OWNED_TESTNET_ONLY");
    assert_eq!(source["sourceReleaseTarget"], "shadow");
    assert_eq!(source["decisionSignature"].as_str().unwrap().len(), 64);
    assert_eq!(source["executionAuthority"], false);
}
#[tokio::test]
async fn source_kill_after_two_approvals_denies_original_and_new_command_keys_without_io() {
    for scope in [
        KillScope::Global,
        KillScope::Account(AccountId::parse_str("44444444-4444-4444-8444-444444444444").unwrap()),
    ] {
        let p = crate::BffProvider::assisted_reference(true);
        let (app, _, path) = opened(&p).await;
        approved(&app, &path).await;
        kill(&p, scope, true, 0).await;
        for key in ["source-original", "source-new"] {
            let (status, _) = call(
                &app,
                "session-current",
                "POST",
                &format!("{path}/commands"),
                json!({"expectedRevision":2}),
                key,
            )
            .await;
            assert_ne!(status, StatusCode::OK);
        }
        kill(&p, scope, false, 1).await;
        let (status, _) = call(
            &app,
            "session-current",
            "POST",
            &format!("{path}/commands"),
            json!({"expectedRevision":2}),
            "source-original",
        )
        .await;
        assert_ne!(status, StatusCode::OK);
        let (_, a) = call(
            &app,
            "session-current",
            "GET",
            &format!("{path}/audit"),
            json!({}),
            "audit",
        )
        .await;
        assert_eq!(a["nativeSubmissions"], 0);
        let (_, rows) = call(
            &app,
            "session-current",
            "GET",
            "/v1/assisted-testnet/subjects",
            json!({}),
            "list",
        )
        .await;
        assert_eq!(rows["items"], json!([]));
    }
}
#[tokio::test]
async fn source_revocation_between_mfa_and_approval_preserves_no_approval_or_native_io() {
    let p = crate::BffProvider::assisted_reference(true);
    let (app, subject, path) = opened(&p).await;
    let mut b = proof(&app, "session-approver").await;
    b["expectedRevision"] = json!(0);
    {
        let state = p.data.lock().await;
        state
            .assisted
            .as_ref()
            .unwrap()
            .sources
            .revoke(ProposalId::parse_str(subject["subjectId"].as_str().unwrap()).unwrap())
            .unwrap();
    }
    let (status, _) = call(
        &app,
        "session-approver",
        "POST",
        &format!("{path}/approvals"),
        b,
        "revoked-approve",
    )
    .await;
    assert_ne!(status, StatusCode::OK);
    let (_, a) = call(
        &app,
        "session-current",
        "GET",
        &format!("{path}/audit"),
        json!({}),
        "read",
    )
    .await;
    assert_eq!(a["items"], json!([]));
    assert_eq!(a["nativeSubmissions"], 0);
}
#[tokio::test]
async fn original_result_is_read_only_after_source_expiry_and_no_source_renewal() {
    let p = crate::BffProvider::assisted_reference(true);
    let (app, subject, path) = opened(&p).await;
    approved(&app, &path).await;
    let (status, c) = call(
        &app,
        "session-current",
        "POST",
        &format!("{path}/commands"),
        json!({"expectedRevision":2}),
        "original-result",
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let until: DateTime<Utc> = serde_json::from_value(subject["expiresAt"].clone()).unwrap();
    {
        let mut s = p.data.lock().await;
        let elapsed = until - s.now();
        s.clock_offset += elapsed;
    }
    let (status, _) = call(
        &app,
        "session-current",
        "POST",
        &format!("{path}/commands"),
        json!({"expectedRevision":2}),
        "original-result",
    )
    .await;
    assert_ne!(status, StatusCode::OK);
    let (status, read) = call(&app, "session-current", "GET", &path, json!({}), "readonly").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(read["command"], c);
    let (_, rows) = call(
        &app,
        "session-current",
        "GET",
        "/v1/assisted-testnet/subjects",
        json!({}),
        "list",
    )
    .await;
    assert_eq!(rows["items"], json!([]));
}
