//! Current A3 reference composition only; no DB, external venue or worker acceptance.
use super::*;
use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use tower::ServiceExt;
async fn call(
    p: &BffProvider,
    method: &str,
    path: &str,
    body: Option<Value>,
    key: Uuid,
    version: &str,
) -> (u16, Value) {
    let request = Request::builder()
        .method(method)
        .uri(path)
        .header(
            "cookie",
            format!("quantos_session={CURRENT_SESSION}; quantos_csrf={CSRF_TOKEN}"),
        )
        .header("origin", ALLOWED_ORIGIN)
        .header("x-csrf-token", CSRF_TOKEN)
        .header("idempotency-key", key.to_string())
        .header("if-match", version)
        .header("x-request-id", Uuid::new_v4().to_string())
        .header("content-type", "application/json")
        .body(Body::from(body.map(|v| v.to_string()).unwrap_or_default()))
        .unwrap();
    let r = p.router().oneshot(request).await.unwrap();
    let status = r.status().as_u16();
    let bytes = to_bytes(r.into_body(), 1048576).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}
#[tokio::test]
async fn current_aggregate_market_snapshot_resolves_and_drives_research_with_stale_refusal() {
    let p = BffProvider::default();
    let (s, q) = call(
        &p,
        "GET",
        "/v1/markets/quotes?symbol=BTC%2FUSDT&venue=binance&product=spot",
        None,
        Uuid::new_v4(),
        "",
    )
    .await;
    assert_eq!(s, 200);
    let id = q["items"][0]["provenance"]["dataSnapshotId"]
        .as_str()
        .unwrap();
    let path = format!("/v1/data-snapshots/{id}");
    let (s, snapshot) = call(&p, "GET", &path, None, Uuid::new_v4(), "").await;
    assert_eq!(s, 200, "quote snapshot cannot resolve: {snapshot}");
    assert_eq!(snapshot["qualityBlocked"], false);
    assert_eq!(
        snapshot["licenseLabel"],
        q["items"][0]["provenance"]["license"]
    );
    let input = json!({"capability":"research.hypothesis.v1","dataSnapshotId":id,"question":"Synthetic market snapshot composition","budget":"10","deadlineAt":(Utc::now()+Duration::hours(1)).to_rfc3339(),"attachments":[]});
    let key = Uuid::new_v4();
    let accepted = call(
        &p,
        "POST",
        "/v1/research-runs",
        Some(input.clone()),
        key,
        "",
    )
    .await;
    assert_eq!(accepted.0, 202);
    p.advance_reference_time(Duration::seconds(3)).await;
    let (_, expired) = call(&p, "GET", &path, None, Uuid::new_v4(), "").await;
    assert_eq!(expired["qualityBlocked"], true);
    assert_eq!(
        call(
            &p,
            "POST",
            "/v1/research-runs",
            Some(input.clone()),
            key,
            ""
        )
        .await,
        accepted
    );
    assert_eq!(
        call(
            &p,
            "POST",
            "/v1/research-runs",
            Some(input),
            Uuid::new_v4(),
            ""
        )
        .await
        .0,
        422
    );
}
#[tokio::test]
async fn current_aggregate_research_watchlist_retries_share_unique_audit_facts() {
    let p = BffProvider::default();
    let key = Uuid::new_v4();
    let research = json!({"capability":"research.hypothesis.v1","dataSnapshotId":"11111111-1111-4111-8111-000000000001","question":"Synthetic secret question must not enter audit","budget":"10","deadlineAt":(Utc::now()+Duration::hours(1)).to_rfc3339(),"attachments":[]});
    let watch = json!({"instrumentIds":["binance:spot:BTC/USDT"]});
    let mut tasks = vec![];
    for n in 0..12 {
        let p = p.clone();
        let input = if n % 2 == 0 {
            research.clone()
        } else {
            watch.clone()
        };
        tasks.push(tokio::spawn(async move {
            if n % 2 == 0 {
                call(&p, "POST", "/v1/research-runs", Some(input), key, "").await
            } else {
                call(
                    &p,
                    "PUT",
                    "/v1/markets/watchlist",
                    Some(input),
                    key,
                    "watchlist-0",
                )
                .await
            }
        }));
    }
    for (n, t) in tasks.into_iter().enumerate() {
        assert_eq!(t.await.unwrap().0, if n % 2 == 0 { 202 } else { 200 });
    }
    let data = p.data.lock().await;
    let facts = data
        .audits
        .iter()
        .filter(|e| e["kind"] == "research.create" || e["kind"] == "market.watchlist.save")
        .collect::<Vec<_>>();
    assert_eq!(facts.len(), 2);
    assert_ne!(facts[0]["eventId"], facts[1]["eventId"]);
    assert_ne!(facts[0]["sequence"], facts[1]["sequence"]);
    assert!(
        !serde_json::to_string(&facts)
            .unwrap()
            .contains("Synthetic secret question")
    );
}

#[test]
fn current_aggregate_snapshot_registration_never_promotes_bad_or_degraded_facts() {
    for change in ["failed", "degraded", "license", "raw_price"] {
        let mut market = market::Fixture::default();
        let i = market.catalog[0].clone();
        let event = &mut market.events.get_mut(&i.id()).unwrap()[0];
        match change {
            "failed" => event.quality = quantos_market::MarketDataQuality::Failed,
            "degraded" => event.quality = quantos_market::MarketDataQuality::Degraded,
            "license" => event.license_label = String::new(),
            _ => event.raw_price = "forged".into(),
        }
        let snapshots = market.snapshot_fixtures();
        assert_eq!(
            snapshots[&i.snapshot_id]["qualityBlocked"], true,
            "{change}"
        );
        assert_ne!(snapshots[&i.snapshot_id]["quality"], "verified", "{change}");
    }
}
