use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use bff_gateway::BffProvider;
use chrono::{Duration, Utc};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

const COOKIE: &str = "quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001";
const VIEWER_COOKIE: &str =
    "quantos_session=session-viewer; quantos_csrf=csrf-token-0000000000000001";
const ORIGIN: &str = "http://localhost:3190";
const CSRF: &str = "csrf-token-0000000000000001";
const CORRELATION: &str = "aaaaaaaa-1111-4111-8111-111111111111";
const EXPIRED_EXPORT: &str = "eeeeeeee-1111-4111-8111-111111111111";

fn request(method: &str, path: &str, body: Option<Value>) -> Request<Body> {
    let mut builder = Request::builder().method(method).uri(path);
    if body.is_some() {
        builder = builder.header("content-type", "application/json");
    }
    builder
        .body(Body::from(
            body.map_or_else(String::new, |value| value.to_string()),
        ))
        .unwrap()
}

fn authenticated(method: &str, path: &str, body: Option<Value>) -> Request<Body> {
    let mut request = request(method, path, body);
    request
        .headers_mut()
        .insert("cookie", COOKIE.parse().unwrap());
    request
}

fn viewer(method: &str, path: &str) -> Request<Body> {
    let mut request = request(method, path, None);
    request
        .headers_mut()
        .insert("cookie", VIEWER_COOKIE.parse().unwrap());
    request
}

fn mutation(method: &str, path: &str, body: Option<Value>) -> Request<Body> {
    let mut request = authenticated(method, path, body);
    request.headers_mut().insert(
        "x-request-id",
        uuid::Uuid::now_v7().to_string().parse().unwrap(),
    );
    request
        .headers_mut()
        .insert("origin", ORIGIN.parse().unwrap());
    request
        .headers_mut()
        .insert("x-csrf-token", CSRF.parse().unwrap());
    request
}

async fn json_body(response: axum::response::Response) -> Value {
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

async fn recent_auth(router: &Router) -> String {
    let challenge_response = router
        .clone()
        .oneshot(mutation(
            "POST",
            "/v1/auth/mfa/challenges",
            Some(json!({"purpose":"security_change","code":"123456"})),
        ))
        .await
        .unwrap();
    let challenge = json_body(challenge_response).await;
    let response = router
        .clone()
        .oneshot(mutation(
            "POST",
            "/v1/auth/reauth",
            Some(json!({"challengeRef":challenge["challengeRef"]})),
        ))
        .await
        .unwrap();
    json_body(response).await["reauthTokenRef"]
        .as_str()
        .unwrap()
        .to_owned()
}

fn export_body() -> Value {
    json!({
        "scope":{"correlationIds":[CORRELATION]},
        "format":"jsonl","reason":"Regulatory evidence review",
        "watermark":"QuantOS audit copy","retentionDays":7
    })
}

fn export_mutation(path: &str, key: &str, reauth: &str, body: Option<Value>) -> Request<Body> {
    let mut request = mutation("POST", path, body);
    request
        .headers_mut()
        .insert("idempotency-key", uuid_key(key).parse().unwrap());
    request
        .headers_mut()
        .insert("x-reauth-token-ref", reauth.parse().unwrap());
    request
}

fn uuid_key(label: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    label.hash(&mut hash);
    format!(
        "11111111-1111-4111-8111-{:012x}",
        hash.finish() & 0xffffffffffff
    )
}


#[tokio::main]
async fn main() {
 let provider=BffProvider::default(); let router=provider.router(); let reauth=recent_auth(&router).await;
 let mut rows=Vec::new();
 let mut authorization=Vec::new();for (method,path,body) in [("GET","/v1/audit/events".to_owned(),None),("GET",format!("/v1/audit/evidence-chains/{CORRELATION}"),None),("POST","/v1/exports".to_owned(),Some(export_body())),("GET",format!("/v1/exports/{EXPIRED_EXPORT}"),None),("POST",format!("/v1/exports/{EXPIRED_EXPORT}/cancel"),None),("GET",format!("/v1/exports/{EXPIRED_EXPORT}/download"),None)]{
  let a=router.clone().oneshot(request(method,&path,body.clone())).await.unwrap();assert_eq!(a.status(),StatusCode::UNAUTHORIZED);
  let mut v=request(method,&path,body);v.headers_mut().insert("cookie",VIEWER_COOKIE.parse().unwrap());v.headers_mut().insert("origin",ORIGIN.parse().unwrap());v.headers_mut().insert("x-csrf-token",CSRF.parse().unwrap());v.headers_mut().insert("x-request-id",uuid::Uuid::now_v7().to_string().parse().unwrap());v.headers_mut().insert("idempotency-key",uuid_key("auth-matrix").parse().unwrap());v.headers_mut().insert("x-reauth-token-ref",reauth.parse().unwrap());let b=router.clone().oneshot(v).await.unwrap();assert_eq!(b.status(),StatusCode::FORBIDDEN);authorization.push(json!({"method":method,"path":path,"unauthenticated":401,"viewer":403}));}
 let missing_csrf=router.clone().oneshot(authenticated("POST","/v1/exports",Some(export_body()))).await.unwrap();assert_eq!(missing_csrf.status(),StatusCode::FORBIDDEN);let mut mr=mutation("POST","/v1/exports",Some(export_body()));mr.headers_mut().insert("idempotency-key",uuid_key("missing-reauth").parse().unwrap());let missing_reauth=router.clone().oneshot(mr).await.unwrap();assert_eq!(missing_reauth.status(),StatusCode::FORBIDDEN);
 rows.push(json!({"id":"reference_auth_matrix","healthy":true,"apis":authorization,"missingCsrf":403,"missingReauth":403}));
 let start=std::time::Instant::now();let mut cursor=None;let mut count=0;let mut pages=0;loop{let path=format!("/v1/audit/evidence-chains/{CORRELATION}?pageSize=3{}",cursor.as_ref().map(|x:&String|format!("&cursor={x}")).unwrap_or_default());let r=router.clone().oneshot(authenticated("GET",&path,None)).await.unwrap();assert_eq!(r.status(),StatusCode::OK);let body=json_body(r).await;pages+=1;count+=body["items"].as_array().unwrap().len();cursor=body["nextCursor"].as_str().map(str::to_owned);if cursor.is_none(){assert_eq!(body["complete"],true);break;}}
 assert_eq!(count,8);rows.push(json!({"id":"reference_restore_baseline","healthy":true,"events":count,"pages":pages,"elapsedMicroseconds":start.elapsed().as_micros(),"targetScaleAcceptance":false}));
 let read=router.clone().oneshot(authenticated("GET","/v1/audit/events",None)).await.unwrap();let read=json_body(read).await;assert_eq!(read["items"].as_array().unwrap().len(),8);rows.push(json!({"id":"restricted_reads_add_no_audit_events","initialAuditEvents":8,"afterRestrictedReads":8}));

 let first=router.clone().oneshot(authenticated("GET",&format!("/v1/audit/evidence-chains/{CORRELATION}"),None)).await.unwrap(); let first=json_body(first).await; assert_eq!(first["items"].as_array().unwrap().len(),8);
 let forged=router.clone().oneshot(authenticated("GET",&format!("/v1/audit/evidence-chains/{CORRELATION}?cursor=audit%3A999"),None)).await.unwrap(); let status=forged.status().as_u16();let forged=json_body(forged).await;assert_eq!(status,200); assert_eq!(forged["complete"],true);assert!(forged["items"].as_array().unwrap().is_empty()); rows.push(json!({"id":"forged_cursor_complete","status":status,"actual":forged,"baselineEvents":8}));
 let mut scoped=export_body();scoped["scope"]["eventKinds"]=json!(["fill.recorded"]);scoped["scope"]["startAt"]=json!("2026-09-16T10:00:00Z");scoped["scope"]["endAt"]=json!("2026-09-16T11:00:00Z");
 let a=router.clone().oneshot(export_mutation("/v1/exports","scope-probe",&reauth,Some(scoped.clone()))).await.unwrap();assert_eq!(a.status(),StatusCode::ACCEPTED);let a=json_body(a).await;let id=a["exportId"].as_str().unwrap().to_owned();scoped["scope"]["eventKinds"]=json!(["order.accepted"]);scoped["scope"]["startAt"]=json!("2026-09-15T10:00:00Z");
 let b=router.clone().oneshot(export_mutation("/v1/exports","scope-probe",&reauth,Some(scoped))).await.unwrap();let status=b.status().as_u16();let b=json_body(b).await;assert_eq!(status,202);assert_eq!(a["exportId"],b["exportId"]);rows.push(json!({"id":"changed_scope_replays","status":status,"sameExport":true}));
 let audit=router.clone().oneshot(authenticated("GET","/v1/audit/events?kind=export.created",None)).await.unwrap();let audit=json_body(audit).await;assert!(audit["items"][0]["redactedPayload"]["scope"].get("eventKinds").is_none());rows.push(json!({"id":"scope_fields_dropped","actual":audit["items"][0]["redactedPayload"]["scope"]}));
 let mut invalid=export_body();invalid["scope"]["startAt"]=json!("2026-10-07T00:00:00Z");invalid["scope"]["endAt"]=json!("2026-10-06T00:00:00Z");let r=router.clone().oneshot(export_mutation("/v1/exports","reversed-range",&reauth,Some(invalid))).await.unwrap();assert_eq!(r.status(),StatusCode::ACCEPTED);rows.push(json!({"id":"reversed_export_range","status":202}));
 let mut unknown=export_body();unknown["scope"]["correlationIds"]=json!(["bbbbbbbb-1111-4111-8111-111111111111"]);let r=router.clone().oneshot(export_mutation("/v1/exports","unknown-scope",&reauth,Some(unknown))).await.unwrap();assert_eq!(r.status(),StatusCode::ACCEPTED);rows.push(json!({"id":"unknown_scope_accepted","status":202}));
 let mut duplicate=export_body();duplicate["scope"]["correlationIds"]=json!([CORRELATION,CORRELATION]);let r=router.clone().oneshot(export_mutation("/v1/exports","duplicate-scope",&reauth,Some(duplicate))).await.unwrap();assert_eq!(r.status(),StatusCode::ACCEPTED);rows.push(json!({"id":"unique_items_unenforced","status":202}));
 let mut sensitive=export_body();sensitive["reason"]=json!("Review SYNTHETIC_PRIVATE_VALUE_007 account=acct-test-sensitive-full-007");let r=router.clone().oneshot(export_mutation("/v1/exports","redaction-probe",&reauth,Some(sensitive))).await.unwrap();assert_eq!(r.status(),StatusCode::ACCEPTED);let e=json_body(r).await;let audit=router.clone().oneshot(authenticated("GET","/v1/audit/events?kind=export.created",None)).await.unwrap();let audit=json_body(audit).await;let item=audit["items"].as_array().unwrap().iter().find(|x|x["objectRef"]==e["exportId"]).unwrap();assert_eq!(item["redactionApplied"],true);assert!(item["redactedPayload"]["reason"].as_str().unwrap().contains("SYNTHETIC_PRIVATE_VALUE_007"));rows.push(json!({"id":"unredacted_user_reason","actual":item["redactedPayload"],"redactionApplied":true}));
 let seq=item["sequence"].as_u64().unwrap();assert_eq!(item["payloadHash"],format!("sha256:{:064x}",seq));rows.push(json!({"id":"noncryptographic_payload_hash","hash":item["payloadHash"],"sequence":seq}));
 let status=router.clone().oneshot(authenticated("GET",&format!("/v1/exports/{id}"),None)).await.unwrap();let status=json_body(status).await;assert_eq!(status["status"],"ready");let download=router.clone().oneshot(authenticated("GET",&format!("/v1/exports/{id}/download"),None)).await.unwrap();let download=json_body(download).await;assert!(download["downloadUrl"].as_str().unwrap().contains("downloads.invalid"));assert_eq!(download["sha256"],format!("{:064x}",42));rows.push(json!({"id":"read_promotes_placeholder_ready","status":status["status"],"actual":download}));
 provider.advance_reference_time(Duration::days(31)).await;provider.renew_reference_session().await;let r=router.clone().oneshot(authenticated("GET",&format!("/v1/exports/{id}/download"),None)).await.unwrap();assert_eq!(r.status(),StatusCode::OK);rows.push(json!({"id":"reference_clock_does_not_expire_exports","status":200,"advancedDays":31,"note":"reference clock only; static source confirms no retentionUntil comparison"}));
 println!("{}",serde_json::to_string_pretty(&json!({"profile":"reference-only in-memory Axum requests","databaseExecuted":false,"observations":rows,"runAt":Utc::now().to_rfc3339(),"sourceCommit":"ce4907cd819cdca30cba2a59f66cc51dc30fffda"})).unwrap());
}
