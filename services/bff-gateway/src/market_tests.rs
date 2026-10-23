use super::*;
use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use tower::ServiceExt;
fn selected() -> MarketQuery {
    MarketQuery {
        symbol: Some("BTC/USDT".into()),
        venue: Some("binance".into()),
        product: Some("spot".into()),
        ..Default::default()
    }
}
async fn call(
    p: &crate::BffProvider,
    method: &str,
    path: &str,
    input: Option<Value>,
    key: Uuid,
    version: &str,
) -> (u16, Value) {
    let req = Request::builder()
        .method(method)
        .uri(path)
        .header(
            "cookie",
            format!(
                "quantos_session={}; quantos_csrf={}",
                crate::CURRENT_SESSION,
                crate::CSRF_TOKEN
            ),
        )
        .header("origin", crate::ALLOWED_ORIGIN)
        .header("x-csrf-token", crate::CSRF_TOKEN)
        .header("idempotency-key", key.to_string())
        .header("if-match", version)
        .header("x-request-id", Uuid::new_v4().to_string())
        .header("content-type", "application/json")
        .body(Body::from(input.map(|v| v.to_string()).unwrap_or_default()))
        .unwrap();
    let response = p.router().oneshot(req).await.unwrap();
    let code = response.status().as_u16();
    assert_eq!(response.headers()["cache-control"], "no-store");
    let bytes = to_bytes(response.into_body(), 1048576).await.unwrap();
    (
        code,
        serde_json::from_slice(&bytes)
            .unwrap_or_else(|_| json!({"sse":String::from_utf8(bytes.to_vec()).unwrap()})),
    )
}
#[tokio::test]
async fn seven_market_operations_and_r01_module_projections() {
    let p = crate::BffProvider::default();
    let q = "symbol=BTC%2FUSDT&venue=binance&product=spot";
    let mut probes = vec![];
    for (op, path) in [
        ("getMarketCatalog", "/v1/markets/catalog".into()),
        ("getWatchlist", "/v1/markets/watchlist".into()),
        ("getVenueQuotes", format!("/v1/markets/quotes?{q}")),
        ("getCandleSeries", format!("/v1/markets/candles?{q}")),
        ("subscribeQuotes", format!("/v1/markets/quotes/stream?{q}")),
        (
            "subscribeCandles",
            format!("/v1/markets/candles/stream?{q}"),
        ),
    ] {
        let (s, v) = call(&p, "GET", &path, None, Uuid::new_v4(), "watchlist-0").await;
        assert_eq!(s, 200, "{op}: {v}");
        probes.push(json!({"operation":op,"status":s,"body":v}));
    }
    let (s, v) = call(
        &p,
        "PUT",
        "/v1/markets/watchlist",
        Some(json!({"instrumentIds":["binance:spot:BTC/USDT"]})),
        Uuid::new_v4(),
        "watchlist-0",
    )
    .await;
    assert_eq!(s, 200, "{v}");
    probes.push(json!({"operation":"saveWatchlist","status":s,"body":v}));
    if let Ok(path) = std::env::var("QUANTOS_BFF005_PROBE_OUTPUT") {
        std::fs::write(path, serde_json::to_vec_pretty(&probes).unwrap()).unwrap();
    }
}
#[test]
fn exact_decimal_ohlcv_gaps_duplicates_and_out_of_order() {
    let f = Fixture::default();
    let i = &f.catalog[0];
    let mut e = f.events[&i.id()].clone();
    e.reverse();
    e.push(e[0].clone());
    let now = Utc::now();
    let s = candles(i, &e, &selected(), now).unwrap();
    assert_eq!(s["ohlcv"].as_array().unwrap().len(), 5);
    assert_eq!(s["gaps"].as_array().unwrap().len(), 1);
    assert_eq!(s["ohlcv"][0]["o"], "100");
    assert_eq!(s["ohlcv"][4]["c"], "104");
    let q = MarketQuery {
        interval: Some("5m".into()),
        ..selected()
    };
    let s = candles(i, &e, &q, now).unwrap();
    let volume = s["ohlcv"]
        .as_array()
        .unwrap()
        .iter()
        .fold(Decimal::ZERO, |v, b| {
            v + Decimal::from_str_exact(b["v"].as_str().unwrap()).unwrap()
        });
    assert_eq!(volume.to_string(), "0.5");
}
#[test]
fn wrong_venue_source_quality_and_forged_facts_rejected() {
    let f = Fixture::default();
    let i = &f.catalog[0];
    for mutation in [
        "source",
        "symbol",
        "future",
        "license",
        "failed",
        "price",
        "duplicate",
    ] {
        let mut e = f.events[&i.id()].clone();
        match mutation {
            "source" => e[0].provider = "unapproved".into(),
            "symbol" => e[0].normalized_symbol = "ETH/USDT".into(),
            "future" => e[0].event_time = Utc::now() + Duration::hours(1),
            "license" => e[0].license_label = String::new(),
            "failed" => e[0].quality = MarketDataQuality::Failed,
            "price" => e[0].price = None,
            _ => {
                let mut duplicate = e[0].clone();
                duplicate.raw_price = "forged".into();
                e.push(duplicate);
            }
        }
        assert!(quote(i, &e, Utc::now()).is_err(), "{mutation}");
    }
}
#[test]
fn reconnect_replaces_series_and_never_splices_dimensions() {
    let f = Fixture::default();
    let i = &f.catalog[0];
    let events = &f.events[&i.id()];
    let q = selected();
    let frame = replay("actor-a", "candle", i, events, &q, Utc::now())
        .unwrap()
        .remove(0);
    assert_eq!(frame["payload"]["replaceSeries"], true);
    let resumed = MarketQuery {
        after_sequence: frame["sequence"].as_u64(),
        stream_id: frame["streamId"].as_str().map(str::to_owned),
        ..q
    };
    assert!(
        replay("actor-a", "candle", i, events, &resumed, Utc::now())
            .unwrap()
            .is_empty()
    );
    for change in [
        "actor",
        "venue",
        "interval",
        "timezone",
        "kind",
        "future",
        "retention",
    ] {
        let mut q = resumed.clone();
        let mut scope = "actor-a";
        let mut kind = "candle";
        let mut rows = events.clone();
        let instrument = if change == "venue" { &f.catalog[2] } else { i };
        match change {
            "actor" => scope = "actor-b",
            "interval" => q.interval = Some("5m".into()),
            "timezone" => q.timezone = Some("Asia/Shanghai".into()),
            "kind" => kind = "quote",
            "future" => q.after_sequence = Some(100000),
            "retention" => {
                q.after_sequence = Some(1);
                rows = rows[3..].to_vec();
            }
            _ => {}
        }
        assert!(
            replay(scope, kind, instrument, &rows, &q, Utc::now()).is_err(),
            "{change}"
        );
    }
}
#[tokio::test]
async fn concurrent_watchlist_retry_conflict_and_cas() {
    let p = crate::BffProvider::default();
    let key = Uuid::new_v4();
    let input = json!({"instrumentIds":["binance:spot:BTC/USDT"]});
    let mut tasks = vec![];
    for _ in 0..8 {
        let p = p.clone();
        let input = input.clone();
        tasks.push(tokio::spawn(async move {
            call(
                &p,
                "PUT",
                "/v1/markets/watchlist",
                Some(input),
                key,
                "watchlist-0",
            )
            .await
        }));
    }
    let first = tasks.remove(0).await.unwrap();
    assert_eq!(first.0, 200);
    for task in tasks {
        assert_eq!(task.await.unwrap(), first);
    }
    let (s, _) = call(
        &p,
        "PUT",
        "/v1/markets/watchlist",
        Some(json!({"instrumentIds":[]})),
        key,
        "watchlist-0",
    )
    .await;
    assert_eq!(s, 409);
    let (s, _) = call(
        &p,
        "PUT",
        "/v1/markets/watchlist",
        Some(input),
        Uuid::new_v4(),
        "watchlist-0",
    )
    .await;
    assert_eq!(s, 409);
    assert_eq!(p.data.lock().await.market.watches.intents.len(), 1);
}
#[test]
fn actor_isolation_unauthorized_symbols_and_input_bounds() {
    let f = Fixture::default();
    let mut w = Watchlists::default();
    save_watchlist(
        &mut w,
        "a",
        Uuid::new_v4(),
        "watchlist-0",
        json!({"instrumentIds":[]}),
        &f.catalog,
    )
    .unwrap();
    assert!(!w.records.contains_key("b"));
    for v in [
        json!({"instrumentIds":["binance:perp:BTC/USDT"]}),
        json!({"instrumentIds":[],"tenantId":"forged"}),
        json!({"instrumentIds":["binance:spot:BTC/USDT","binance:spot:BTC/USDT"]}),
    ] {
        assert!(save_watchlist(&mut w, "b", Uuid::new_v4(), "watchlist-0", v, &f.catalog).is_err());
    }
    for q in [
        MarketQuery {
            interval: Some("custom".into()),
            ..selected()
        },
        MarketQuery {
            timezone: Some("Etc/Unknown".into()),
            ..selected()
        },
        MarketQuery {
            product: Some("perp".into()),
            ..selected()
        },
    ] {
        assert!(q.validate().is_err());
    }
}
#[test]
fn trade_quote_never_fabricates_book_and_staleness_is_visible() {
    let f = Fixture::default();
    let i = &f.catalog[0];
    let q = quote(i, &f.events[&i.id()], Utc::now() + Duration::minutes(1)).unwrap();
    assert_eq!(q["lastPrice"], "104");
    assert_eq!(q["bid"], Value::Null);
    assert_eq!(q["ask"], Value::Null);
    assert_eq!(q["executable"], false);
    assert_eq!(q["provenance"]["quality"], "degraded");
}
#[test]
fn r01_events_r02_source_authority_and_market_projection_are_composed() {
    use quantos_core::{ArtifactId, ContentHash, SchemaVersion, TenantId};
    use quantos_storage::{
        DataSnapshotInput, DataSnapshotRecord, SnapshotArtifactRef, SnapshotLineageEntry,
        SnapshotQuality, SnapshotSourceRef, SnapshotUsage, SnapshotWindow,
        provenance::{SnapshotSourcePolicy, SourceApproval},
    };
    let fixture = Fixture::default();
    let instrument = &fixture.catalog[0];
    let events = &fixture.events[&instrument.id()];
    let e = events.last().unwrap();
    let now = DateTime::from_timestamp_micros(Utc::now().timestamp_micros()).unwrap();
    let tenant = TenantId::new();
    let approval = SourceApproval {
        provider: e.provider.clone(),
        dataset: e.dataset.clone(),
        license_label: e.license_label.clone(),
        approval_reference: e.approval_reference.clone(),
        approval_version: e.approval_version.clone(),
        approval_document_hash: ContentHash::sha256_bytes(b"fixture-doc"),
        scope_hash: ContentHash::sha256_bytes(b"fixture-research"),
        tenant_id: tenant,
        symbols: vec![instrument.canonical_symbol.clone()],
        allowed_usages: vec![SnapshotUsage::Research],
        expires_at: now + Duration::hours(1),
        enabled: true,
    };
    let snapshot = DataSnapshotRecord::new(
        tenant,
        DataSnapshotInput {
            schema_name: "DataSnapshot".into(),
            schema_version: SchemaVersion::parse("v1").unwrap(),
            schema_entry_id: None,
            window: SnapshotWindow {
                start_at: now - Duration::minutes(10),
                end_at: now,
            },
            sources: vec![SnapshotSourceRef {
                source_id: format!("market:{}:{}", e.provider, e.normalized_symbol),
                provider: e.provider.clone(),
                dataset: e.dataset.clone(),
                license_label: e.license_label.clone(),
            }],
            quality: SnapshotQuality::Passed,
            quality_findings: vec![],
            license_label: e.license_label.clone(),
            captured_at: now,
            max_age_secs: 60,
            symbols: vec![e.normalized_symbol.clone()],
            artifact_refs: vec![SnapshotArtifactRef {
                artifact_id: ArtifactId::new(),
                media_type: "application/json".into(),
                content_hash: ContentHash::sha256_bytes(b"fixture"),
                storage_bucket: "fixture".into(),
                object_key: "fixture".into(),
            }],
            lineage: vec![SnapshotLineageEntry {
                lineage_kind: "market_event_range".into(),
                reference: format!("market:{}:{}", e.provider, e.normalized_symbol),
                details: json!({"from_sequence":1,"to_sequence":5}),
            }],
        },
        now,
    )
    .unwrap();
    let policy = SnapshotSourcePolicy::new(vec![approval.clone()]).unwrap();
    for event in events {
        policy
            .validate_event(
                &snapshot,
                &serde_json::to_value(event).unwrap(),
                SnapshotUsage::Research,
                now,
            )
            .unwrap();
    }
    let book = &fixture.books[&instrument.id()];
    policy
        .validate_event(
            &snapshot,
            &serde_json::to_value(book).unwrap(),
            SnapshotUsage::Research,
            now,
        )
        .unwrap();
    assert!(book_quote(instrument, book, events, now).is_ok());
    assert!(quote(instrument, events, now).is_ok());
    assert!(
        policy
            .validate_event(
                &snapshot,
                &serde_json::to_value(e).unwrap(),
                SnapshotUsage::Trading,
                now
            )
            .is_err()
    );
    for change in ["expired", "revoked", "tenant", "symbol", "license"] {
        let mut a = approval.clone();
        match change {
            "expired" => a.expires_at = now - Duration::seconds(1),
            "revoked" => a.enabled = false,
            "tenant" => a.tenant_id = TenantId::new(),
            "symbol" => a.symbols = vec!["ETH/USDT".into()],
            _ => a.license_label = "unauthorized".into(),
        };
        let p = SnapshotSourcePolicy::new(vec![a]).unwrap();
        assert!(
            p.validate_event(
                &snapshot,
                &serde_json::to_value(e).unwrap(),
                SnapshotUsage::Research,
                now
            )
            .is_err(),
            "{change}"
        );
    }
}
#[test]
fn degraded_inputs_are_not_promoted_and_empty_history_reports_requested_gap() {
    let f = Fixture::default();
    let i = &f.catalog[0];
    let mut e = f.events[&i.id()].clone();
    e[0].quality = MarketDataQuality::Degraded;
    let now = Utc::now();
    let s = candles(i, &e, &selected(), now).unwrap();
    assert_eq!(s["provenance"]["quality"], "degraded");
    let q = MarketQuery {
        start: Some(now - Duration::days(2)),
        end: Some(now - Duration::days(1)),
        ..selected()
    };
    let s = candles(i, &e, &q, now).unwrap();
    assert!(s["ohlcv"].as_array().unwrap().is_empty());
    assert_eq!(s["gaps"].as_array().unwrap().len(), 1);
}
#[test]
fn actual_licensed_book_bid_ask_mid_and_replay_are_not_trade_price_fabrications() {
    let f = Fixture::default();
    let i = &f.catalog[0];
    let book = &f.books[&i.id()];
    let now = Utc::now();
    let q = book_quote(i, book, &f.events[&i.id()], now).unwrap();
    assert_eq!(q["bid"], "103.90");
    assert_eq!(q["ask"], "104.10");
    assert_eq!(q["mid"], "104.00");
    assert_eq!(q["priceKind"], "top_of_book");
    assert_eq!(q["executable"], false);
    let mut degraded = f.events[&i.id()].clone();
    degraded.last_mut().unwrap().quality = MarketDataQuality::Degraded;
    assert_eq!(
        book_quote(i, book, &degraded, now).unwrap()["provenance"]["quality"],
        "degraded"
    );
    let frame = book_replay("a", i, book, &[], &selected(), now)
        .unwrap()
        .remove(0);
    assert_eq!(frame["payload"]["lastPrice"], Value::Null);
    let mut resume = selected();
    resume.stream_id = frame["streamId"].as_str().map(str::to_owned);
    resume.after_sequence = Some(6);
    assert!(
        book_replay("a", i, book, &[], &resume, now)
            .unwrap()
            .is_empty()
    );
    resume.timezone = Some("Asia/Shanghai".into());
    assert!(book_replay("a", i, book, &[], &resume, now).is_err());
    let mut crossed = book.clone();
    crossed.bid = quantos_core::Quantity::parse_str("1000").unwrap();
    assert!(book_quote(i, &crossed, &[], now).is_err());
}

#[test]
fn new_trade_advances_book_quote_recovery_without_inventing_book_values() {
    let f = Fixture::default();
    let i = &f.catalog[0];
    let book = &f.books[&i.id()];
    let now = Utc::now();
    let mut trades = f.events[&i.id()].clone();
    let mut update = trades.last().unwrap().clone();
    update.source_tick_id = "new-trade-after-book".into();
    update.sequence = book.sequence + 1;
    update.event_time = now;
    update.received_at = now;
    update.raw_price = "105".into();
    update.price = Some(quantos_core::Quantity::parse_str("105").unwrap());
    trades.push(update);
    let q = MarketQuery {
        after_sequence: Some(book.sequence),
        stream_id: Some(selected().binding("a", "book", i)),
        ..selected()
    };
    let frames = book_replay("a", i, book, &trades, &q, now).unwrap();
    assert_eq!(frames.len(), 1);
    assert_eq!(frames[0]["sequence"], book.sequence + 1);
    assert_eq!(frames[0]["payload"]["sequence"], book.sequence + 1);
    assert_eq!(frames[0]["payload"]["lastPrice"], "105");
    assert_eq!(frames[0]["payload"]["bid"], "103.90");
    assert_eq!(frames[0]["payload"]["ask"], "104.10");
    let resumed = MarketQuery {
        after_sequence: Some(book.sequence + 1),
        ..q
    };
    assert!(
        book_replay("a", i, book, &trades, &resumed, now)
            .unwrap()
            .is_empty()
    );
}

#[test]
fn book_history_deduplicates_exact_records_and_rejects_conflicting_identity_or_sequence() {
    let f = Fixture::default();
    let i = &f.catalog[0];
    let book = f.books[&i.id()].clone();
    let now = Utc::now();
    assert_eq!(
        validate_books(i, &[book.clone(), book.clone()], now)
            .unwrap()
            .len(),
        1
    );
    let mut changed = book.clone();
    changed.ask = quantos_core::Quantity::parse_str("105").unwrap();
    assert!(validate_books(i, &[book.clone(), changed], now).is_err());
    let mut same_sequence = book.clone();
    same_sequence.source_tick_id = "different-source-identity".into();
    assert!(validate_books(i, &[book.clone(), same_sequence], now).is_err());
    let mut future = book.clone();
    future.received_at = now + Duration::hours(1);
    assert!(validate_books(i, &[future], now).is_err());
    let mut other = book.clone();
    other.source_tick_id = "next-book".into();
    other.sequence += 1;
    other.event_time = now;
    other.received_at = now;
    assert_eq!(
        validate_books(i, &[other, book], now).unwrap()[1].sequence,
        7
    );
}

#[test]
fn current_function_trade_integrity_rejects_invalid_receipt_identity_and_zero_price() {
    let f = Fixture::default();
    let i = &f.catalog[0];
    let now = Utc::now();
    for change in [
        "future_receipt",
        "receipt_before_event",
        "empty_identity",
        "zero_price",
        "zero_volume",
        "blank_license",
    ] {
        let mut events = f.events[&i.id()].clone();
        match change {
            "future_receipt" => events[0].received_at = now + Duration::seconds(1),
            "receipt_before_event" => {
                events[0].received_at = events[0].event_time - Duration::nanoseconds(1)
            }
            "empty_identity" => events[0].source_tick_id = " ".into(),
            "zero_price" => {
                events[0].raw_price = "0".into();
                events[0].price = Some(quantos_core::Quantity::parse_str("0").unwrap());
            }
            "zero_volume" => {
                events[0].raw_volume = "0".into();
                events[0].volume = Some(quantos_core::Quantity::parse_str("0").unwrap());
            }
            _ => events[0].license_label = " ".into(),
        }
        assert!(quote(i, &events, now).is_err(), "{change}");
        assert!(candles(i, &events, &selected(), now).is_err(), "{change}");
    }
}
#[test]
fn current_function_book_rejects_blank_authority_and_unsafe_sequence() {
    let f = Fixture::default();
    let i = &f.catalog[0];
    let now = Utc::now();
    let mut book = f.books[&i.id()].clone();
    book.approval_reference = " ".into();
    assert!(book_quote(i, &book, &[], now).is_err());
    book = f.books[&i.id()].clone();
    book.sequence = 9_007_199_254_740_992;
    assert!(book_quote(i, &book, &[], now).is_err());
    let mut rows = f.events[&i.id()].clone();
    rows[0].sequence = 9_007_199_254_740_992;
    assert!(replay("a", "candle", i, &rows, &selected(), now).is_err());
}
#[tokio::test]
async fn current_function_watchlist_audit_resolves_and_retries_append_once() {
    let p = crate::BffProvider::default();
    let key = Uuid::new_v4();
    let input = json!({"instrumentIds":["binance:spot:BTC/USDT"]});
    let (code, saved) = call(
        &p,
        "PUT",
        "/v1/markets/watchlist",
        Some(input.clone()),
        key,
        "watchlist-0",
    )
    .await;
    assert_eq!(code, 200);
    assert_eq!(
        call(
            &p,
            "PUT",
            "/v1/markets/watchlist",
            Some(input),
            key,
            "watchlist-0"
        )
        .await
        .1,
        saved
    );
    let data = p.data.lock().await;
    let facts = data
        .audits
        .iter()
        .filter(|a| a["eventId"] == saved["auditRef"])
        .collect::<Vec<_>>();
    assert_eq!(facts.len(), 1);
    assert_eq!(facts[0]["kind"], "market.watchlist.save");
    assert_eq!(facts[0]["correlationId"], saved["correlationId"]);
    assert_eq!(
        facts[0]["payloadHash"],
        crate::audit_core::payload_hash(&facts[0]["redactedPayload"])
    );
}

#[tokio::test]
async fn ui401_reference_c01_market_capabilities_and_viewer_isolation() {
    let p = crate::BffProvider::default();
    let (code, saved) = call(
        &p,
        "PUT",
        "/v1/markets/watchlist",
        Some(json!({"instrumentIds":["binance:spot:BTC/USDT"]})),
        Uuid::new_v4(),
        "watchlist-0",
    )
    .await;
    assert_eq!(code, 200);
    for session in [crate::CURRENT_SESSION, crate::VIEWER_SESSION] {
        for path in [
            "/v1/session",
            "/v1/context",
            "/v1/markets/catalog",
            "/v1/markets/watchlist",
            "/v1/markets/quotes?symbol=BTC%2FUSDT&venue=binance&product=spot",
        ] {
            let response = p
                .router()
                .oneshot(
                    Request::builder()
                        .uri(path)
                        .header("cookie", format!("quantos_session={session}"))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            let value: Value =
                serde_json::from_slice(&to_bytes(response.into_body(), 1048576).await.unwrap())
                    .unwrap();
            if path == "/v1/session" || path == "/v1/context" {
                let capabilities = value["capabilities"].as_array().unwrap();
                assert!(capabilities.contains(&json!("market.read")));
                assert_eq!(
                    capabilities.contains(&json!("market.watchlist.write")),
                    session == crate::CURRENT_SESSION
                );
            }
            if path == "/v1/markets/watchlist" {
                assert_eq!(
                    value["instrumentIds"],
                    if session == crate::CURRENT_SESSION {
                        saved["instrumentIds"].clone()
                    } else {
                        json!([])
                    }
                );
            }
        }
    }
    let response = p
        .router()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/v1/markets/watchlist")
                .header(
                    "cookie",
                    format!(
                        "quantos_session={}; quantos_csrf={}",
                        crate::VIEWER_SESSION,
                        crate::CSRF_TOKEN
                    ),
                )
                .header("origin", crate::ALLOWED_ORIGIN)
                .header("x-csrf-token", crate::CSRF_TOKEN)
                .header("content-type", "application/json")
                .body(Body::from(json!({"instrumentIds":[]}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
