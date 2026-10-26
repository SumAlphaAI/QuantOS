//! Native Paper/Shadow books consumed by the real C15 host. This is a trusted
//! constructor/handler seam, not production HTTP identity or durable admission.
#[allow(dead_code)]
#[path = "../../execution-gateway/tests/x3_service.rs"]
mod service_chain;
use crate::reconciliation::ReconciliationHost;
use axum::http::{HeaderMap, Method};
use quantos_core::AccountId;
use quantos_policy::RunMode;
use serde_json::json;
use std::collections::BTreeMap;
use uuid::Uuid;

#[test]
fn x3_actual_paper_shadow_books_project_into_c15_without_new_submit() {
    let (h, operations, command, input) = service_chain::clean_chain();
    let mut auth = h.f.auth.clone();
    auth.mode = RunMode::Shadow;
    let now = h.f.now;
    let mut host = ReconciliationHost::new(&auth, input.clone(), now).unwrap();
    let query = BTreeMap::from([("accountId".into(), input.scope.account_id.to_string())]);
    let rows = host
        .handle(
            &auth,
            "owned-x3-handler",
            &Method::GET,
            "/v1/reconciliation/runs",
            &query,
            &HeaderMap::new(),
            &json!({}),
            now,
        )
        .unwrap()
        .1;
    let run = &rows["items"][0];
    assert_eq!(run["result"], "clean");
    assert_eq!(run["provisional"], true);
    assert_eq!(run["breakCount"], 0);
    let run_id = run["runId"].as_str().unwrap().to_owned();
    let ledger_query = BTreeMap::from([
        ("accountId".into(), input.scope.account_id.to_string()),
        ("runId".into(), run_id.clone()),
    ]);
    let ledger = host
        .handle(
            &auth,
            "owned-x3-handler",
            &Method::GET,
            "/v1/ledger/entries",
            &ledger_query,
            &HeaderMap::new(),
            &json!({}),
            now,
        )
        .unwrap()
        .1;
    let entries = ledger["items"].as_array().unwrap();
    let actual = entries
        .iter()
        .find(|e| e["side"] == "actual" && e["kind"] == "snapshot")
        .unwrap();
    assert_eq!(actual["sourceHash"], json!(input.actual.content_hash()));
    assert_eq!(actual["amounts"]["cash"], "999000");
    assert!(entries.iter().any(|e| {
        e["kind"] == "fill"
            && e["evidenceRefs"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r["ref"] == input.actual.fills[0].fill_id)
    }));
    let mut headers = HeaderMap::new();
    headers.insert(
        "idempotency-key",
        Uuid::new_v4().to_string().parse().unwrap(),
    );
    headers.insert("if-match", "0".parse().unwrap());
    let path = format!("/v1/reconciliation/runs/{run_id}/reruns");
    let body = json!({"reason":"X3 actual native immutable book review"});
    let accepted = host
        .handle(
            &auth,
            "owned-x3-handler",
            &Method::POST,
            &path,
            &BTreeMap::new(),
            &headers,
            &body,
            now,
        )
        .unwrap();
    assert_eq!(accepted.0.as_u16(), 202);
    for _ in 0..32 {
        assert_eq!(
            host.handle(
                &auth,
                "owned-x3-handler",
                &Method::POST,
                &path,
                &BTreeMap::new(),
                &headers,
                &body,
                now
            )
            .unwrap(),
            accepted
        );
    }
    let mut foreign = auth.clone();
    foreign.account_id = Some(AccountId::new());
    assert!(
        host.handle(
            &foreign,
            "owned-x3-handler",
            &Method::GET,
            "/v1/reconciliation/runs",
            &query,
            &HeaderMap::new(),
            &json!({}),
            now
        )
        .is_err()
    );
    let mut no_capability = auth.clone();
    no_capability.capabilities.clear();
    assert!(
        host.handle(
            &no_capability,
            "owned-x3-handler",
            &Method::GET,
            "/v1/ledger/entries",
            &ledger_query,
            &HeaderMap::new(),
            &json!({}),
            now
        )
        .is_err()
    );
    let native_audit = operations.audit(&h.f.auth, 0, 100, None).unwrap();
    assert!(native_audit.total > 0);
    assert_eq!(h.gateway.downstream_submission_count(), Some(1));
    assert_eq!(h.gateway.downstream_cancel_count(), Some(0));
    println!(
        "X3_C15_EVIDENCE={}",
        json!({"schema":"quantos-x3-native-c15/v1","scope":"TRUSTED_CONSTRUCTOR_HANDLER_NOT_HTTP_OR_COMMON_PERSISTENT_LEDGER","command":command.command_id,"order":input.actual.orders[0].order_id,"fill":input.actual.fills[0].fill_id,"paperCash":"999000","expectedSource":input.expected.source_hash,"actualSource":input.actual.source_hash,"actualBookHash":input.actual.content_hash(),"c15SourceHash":actual["sourceHash"],"c15Run":run_id,"provisional":true,"accepted":accepted.1,"replays":32,"newSubmits":0,"nativeAuditHead":native_audit.head,"httpIdentity":"NOT_RUN","productionCredentialsUsed":false})
    );
}
