//! Verified live identity + cold R02 authorization + immutable R01 lineage; never fixture fallback.
use super::{
    LiveState,
    settings::{self, TrustedIdentity},
};
use crate::{
    market::{self, Instrument, MarketQuery, Watchlists},
    research::{Fault, Output, Result},
};
use axum::{
    Router,
    body::Bytes,
    extract::{OriginalUri, Query, State},
    http::{HeaderMap, Method, StatusCode},
    response::{
        Response,
        sse::{Event, KeepAlive, Sse},
    },
    routing::get,
};
use chrono::Utc;
use quantos_auth::BffSessionContext;
use quantos_core::{SnapshotId, TenantId};
use quantos_market::MarketEvent;
use quantos_policy::Role;
use quantos_storage::{SnapshotUsage, pg::PgStorageStore};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{
    convert::Infallible,
    sync::{Arc, Mutex, OnceLock},
    time::Duration,
};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Entry {
    tenant_id: TenantId,
    instrument: Instrument,
}
fn scope(c: &BffSessionContext) -> String {
    format!(
        "{}:{}:{}:{:?}:{}",
        c.auth.tenant_id,
        c.auth.actor_id,
        c.auth.workspace_id,
        c.auth.account_id,
        c.auth.mode.as_str()
    )
}
fn authorize(c: &BffSessionContext, write: bool) -> Result<()> {
    if !c
        .auth
        .capabilities
        .iter()
        .any(|v| v.as_str() == "market.read")
        || write
            && (c.auth.role == Role::Viewer
                || !c
                    .auth
                    .capabilities
                    .iter()
                    .any(|v| v.as_str() == "market.watchlist.write"))
    {
        return Err(Fault(StatusCode::FORBIDDEN, "FORBIDDEN"));
    }
    Ok(())
}
fn catalog(c: &BffSessionContext) -> Result<Vec<Instrument>> {
    let path = std::env::var("QUANTOS_BFF_MARKET_CATALOG").map_err(|_| Fault::unavailable())?;
    if std::fs::metadata(&path)
        .map_err(|_| Fault::unavailable())?
        .len()
        > 1048576
    {
        return Err(Fault::unavailable());
    }
    let entries: Vec<Entry> =
        serde_json::from_slice(&std::fs::read(path).map_err(|_| Fault::unavailable())?)
            .map_err(|_| Fault::unavailable())?;
    if entries.len() > 256 {
        return Err(Fault::unavailable());
    }
    let mut result = vec![];
    for e in entries {
        e.instrument.validate()?;
        if e.tenant_id == c.auth.tenant_id {
            if result
                .iter()
                .any(|i: &Instrument| i.id() == e.instrument.id())
            {
                return Err(Fault::unavailable());
            }
            result.push(e.instrument);
        }
    }
    Ok(result)
}
fn database() -> Result<String> {
    std::env::var("QUANTOS_BFF_SNAPSHOT_DATABASE_URL").map_err(|_| Fault::unavailable())
}
struct Loaded {
    trades: Vec<MarketEvent>,
    books: Vec<quantos_market::book::MarketBookEvent>,
}
fn load(c: &BffSessionContext, i: &Instrument) -> Result<Loaded> {
    let now = Utc::now();
    let policy = super::research::source_policy()?;
    let (snapshot, _) = PgStorageStore::connect(&database()?)
        .map_err(|_| Fault::unavailable())?
        .load_authorized_snapshot(
            c.auth.tenant_id,
            SnapshotId::from_uuid(i.snapshot_id),
            SnapshotUsage::Research,
            now,
            &policy,
        )
        .map_err(|_| Fault(StatusCode::UNPROCESSABLE_ENTITY, "DATA_BLOCKED"))?;
    if !snapshot.symbols.contains(&i.canonical_symbol) {
        return Err(Fault::hidden());
    }
    let mut client =
        quantos_auth::connect_bff_database(&database()?).map_err(|_| Fault::unavailable())?;
    client
        .batch_execute("set statement_timeout='15s'")
        .map_err(|_| Fault::unavailable())?;
    let mut events = vec![];
    let mut books = vec![];
    for l in snapshot
        .lineage
        .iter()
        .filter(|l| l.lineage_kind == "market_event_range")
    {
        let aggregate = l
            .reference
            .strip_prefix("market:")
            .ok_or_else(Fault::invalid)?;
        if aggregate != format!("{}:{}", i.provider, i.canonical_symbol) {
            continue;
        }
        let lo = l.details["from_sequence"]
            .as_i64()
            .or_else(|| l.details["first_sequence"].as_i64())
            .ok_or_else(Fault::invalid)?;
        let hi = l.details["to_sequence"]
            .as_i64()
            .or_else(|| l.details["last_sequence"].as_i64())
            .ok_or_else(Fault::invalid)?;
        if lo < 1
            || hi < lo
            || hi - lo >= 10000
            || events.len() + books.len() + (hi - lo + 1) as usize > 10000
        {
            return Err(Fault::invalid());
        }
        let rows=client.query("select sequence,payload from quantos.event_log where tenant_id=$1 and aggregate_type='market' and aggregate_id=$2 and sequence between $3 and $4 order by sequence",&[c.auth.tenant_id.as_uuid(),&aggregate,&lo,&hi]).map_err(|_|Fault::unavailable())?;
        if rows.len() != (hi - lo + 1) as usize {
            return Err(Fault(StatusCode::UNPROCESSABLE_ENTITY, "DATA_BLOCKED"));
        }
        for row in rows {
            let mut v: Value = row.get(1);
            policy
                .validate_event(&snapshot, &v, SnapshotUsage::Research, now)
                .map_err(|_| Fault(StatusCode::UNPROCESSABLE_ENTITY, "DATA_BLOCKED"))?;
            v["sequence"] = json!(row.get::<_, i64>(0));
            if v["event_kind"] == "book_recorded" {
                let mut book: quantos_market::book::MarketBookEvent =
                    serde_json::from_value(v).map_err(|_| Fault::unavailable())?;
                book.validate().map_err(|_| Fault::invalid())?;
                if snapshot.quality == quantos_storage::SnapshotQuality::Degraded {
                    book.quality = quantos_market::MarketDataQuality::Degraded;
                }
                if book.provider != i.provider || book.normalized_symbol != i.canonical_symbol {
                    return Err(Fault::hidden());
                }
                books.push(book);
            } else {
                let mut event: MarketEvent =
                    serde_json::from_value(v).map_err(|_| Fault::unavailable())?;
                if snapshot.quality == quantos_storage::SnapshotQuality::Degraded {
                    event.quality = quantos_market::MarketDataQuality::Degraded;
                }
                events.push(event);
            }
        }
    }
    if events.is_empty() && books.is_empty() {
        return Err(Fault(StatusCode::UNPROCESSABLE_ENTITY, "DATA_BLOCKED"));
    }
    let trades = if events.is_empty() {
        vec![]
    } else {
        market::validate_events(i, &events, now)?
    };
    books.sort_by_key(|b| (b.event_time, b.sequence));
    Ok(Loaded { trades, books })
}
fn watch(
    c: &BffSessionContext,
    db: &str,
    method: &Method,
    headers: &HeaderMap,
    input: &[u8],
    catalog: &[Instrument],
) -> Result<Output> {
    let mut client = quantos_auth::connect_bff_database(db).map_err(|_| Fault::unavailable())?;
    let mut tx = client.transaction().map_err(|_| Fault::unavailable())?;
    let scope = scope(c);
    tx.query_one(
        "select pg_advisory_xact_lock(hashtextextended($1,45))",
        &[&scope],
    )
    .map_err(|_| Fault::unavailable())?;
    tx.query_one("select set_config('quantos.page_tenant',$1,true),set_config('quantos.page_actor',$2,true),set_config('quantos.page_workspace',$3,true),set_config('quantos.page_account',$4,true),set_config('quantos.page_mode',$5,true)",&[&c.auth.tenant_id.to_string(),&c.auth.actor_id.to_string(),&c.auth.workspace_id.to_string(),&c.auth.account_id.map(|a|a.to_string()).unwrap_or_default(),&c.auth.mode.as_str()]).map_err(|_|Fault::unavailable())?;
    let current = tx
        .query_opt(
            "select response from quantos.bff_market_watchlists where scope_key=$1",
            &[&scope],
        )
        .map_err(|_| Fault::unavailable())?
        .map(|r| r.get::<_, Value>(0))
        .unwrap_or_else(market::empty_watchlist);
    if *method == Method::GET {
        return Ok(Output::Json(StatusCode::OK, current));
    }
    let key = crate::research::uuid(
        headers
            .get("idempotency-key")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(Fault::invalid)?,
    )?;
    let version = headers
        .get("if-match")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(Fault::invalid)?;
    let input: Value = serde_json::from_slice(input).map_err(|_| Fault::invalid())?;
    let mut store = Watchlists::default();
    store.records.insert(scope.clone(), current.clone());
    if let Some(row)=tx.query_opt("select intent,response from quantos.bff_market_watchlist_commands where scope_key=$1 and idempotency_key=$2",&[&scope,&key]).map_err(|_|Fault::unavailable())?{store.intents.insert(format!("{scope}:{key}"),(row.get(0),row.get(1)));}
    let replay = store.intents.contains_key(&format!("{scope}:{key}"));
    let result = match market::save_watchlist(&mut store, &scope, key, version, input, catalog) {
        Ok(v) => v,
        Err(e) => return market::watch_output(Err(e), &current),
    };
    if !replay {
        tx.execute("insert into quantos.bff_market_watchlists(scope_key,tenant_id,actor_id,workspace_id,account_id,mode,response) values($1,$2,$3,$4,$5,$6,$7) on conflict(scope_key) do update set response=excluded.response",&[&scope,c.auth.tenant_id.as_uuid(),c.auth.actor_id.as_uuid(),c.auth.workspace_id.as_uuid(),&c.auth.account_id.map(|a|*a.as_uuid()),&c.auth.mode.as_str(),&result]).map_err(|_|Fault::unavailable())?;
        tx.execute("insert into quantos.bff_market_watchlist_commands(scope_key,tenant_id,actor_id,workspace_id,account_id,mode,idempotency_key,intent,response) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",&[&scope,c.auth.tenant_id.as_uuid(),c.auth.actor_id.as_uuid(),c.auth.workspace_id.as_uuid(),&c.auth.account_id.map(|a|*a.as_uuid()),&c.auth.mode.as_str(),&key,&store.intents[&format!("{scope}:{key}")].0,&result]).map_err(|_|Fault::unavailable())?;
        let audit = Uuid::parse_str(result["auditRef"].as_str().unwrap()).unwrap();
        let correlation = Uuid::parse_str(result["correlationId"].as_str().unwrap()).unwrap();
        tx.execute("insert into quantos.bff_settings_audits(audit_ref,user_id,tenant_id,actor_id,action,object_ref,correlation_id) values($1,$2,$3,$4,'market.watchlist.save',$5,$6)",&[&audit,&c.user_id,c.auth.tenant_id.as_uuid(),c.auth.actor_id.as_uuid(),&scope,&correlation]).map_err(|_|Fault::unavailable())?;
    }
    tx.commit().map_err(|_| Fault::unavailable())?;
    Ok(Output::Json(StatusCode::OK, result))
}
fn dispatch(
    c: &BffSessionContext,
    db: &str,
    path: &str,
    method: &Method,
    q: &MarketQuery,
    headers: &HeaderMap,
    body: &[u8],
) -> Result<Output> {
    authorize(c, *method == Method::PUT)?;
    q.validate()?;
    if let Some(last) = headers.get("last-event-id")
        && last.to_str().ok().and_then(|s| s.parse::<u64>().ok()) != q.after_sequence
    {
        return Err(Fault::invalid());
    }
    let catalog = catalog(c)?;
    if path.ends_with("watchlist") {
        if *method == Method::PUT {
            let input: Value = serde_json::from_slice(body).map_err(|_| Fault::invalid())?;
            for i in &catalog {
                if input["instrumentIds"]
                    .as_array()
                    .is_some_and(|ids| ids.contains(&json!(i.id())))
                {
                    load(c, i)?;
                }
            }
        }
        return watch(c, db, method, headers, body, &catalog);
    }
    let selected = catalog.iter().filter(|i| q.selected(i)).collect::<Vec<_>>();
    if path.ends_with("catalog") {
        let mut items = vec![];
        for i in selected {
            load(c, i)?;
            items.push(i.view());
        }
        return Ok(Output::Json(
            StatusCode::OK,
            json!({"items":items,"asOf":Utc::now()}),
        ));
    }
    if selected.is_empty() {
        return Err(Fault::hidden());
    }
    if path.ends_with("candles") || path.ends_with("/stream") {
        if selected.len() != 1 {
            return Err(Fault::invalid());
        }
        let i = selected[0];
        let events = load(c, i)?;
        let now = Utc::now();
        if path.ends_with("/stream") {
            if path.contains("quotes")
                && let Some(book) = events.books.last()
            {
                return Ok(Output::Events(market::book_replay(
                    &scope(c),
                    i,
                    book,
                    &events.trades,
                    q,
                    now,
                )?));
            }

            return Ok(Output::Events(market::replay(
                &scope(c),
                if path.contains("quotes") {
                    "quote"
                } else {
                    "candle"
                },
                i,
                &events.trades,
                q,
                now,
            )?));
        }
        return Ok(Output::Json(
            StatusCode::OK,
            market::candles(i, &events.trades, q, now)?,
        ));
    }
    Ok(Output::Json(
        StatusCode::OK,
        json!({"items":selected.iter().map(|i|load(c,i).and_then(|e|if let Some(book)=e.books.last(){market::book_quote(i,book,&e.trades,Utc::now())}else{market::quote(i,&e.trades,Utc::now())})).collect::<Result<Vec<_>>>()?}),
    ))
}
pub(super) fn routes() -> Router<Arc<LiveState>> {
    Router::new()
        .route("/v1/markets/catalog", get(handle))
        .route("/v1/markets/watchlist", get(handle).put(handle))
        .route("/v1/markets/quotes", get(handle))
        .route("/v1/markets/candles", get(handle))
        .route("/v1/markets/quotes/stream", get(handle))
        .route("/v1/markets/candles/stream", get(handle))
}
fn reset_event(permission: bool) -> Value {
    json!({"streamId":Uuid::new_v4(),"sequence":1,"eventId":Uuid::new_v4(),"occurredAt":Utc::now(),"correlationId":Uuid::new_v4(),"payloadVersion":"v1","payload":{"type":if permission {"permission_revoked"}else{"market_reset"}}})
}
async fn handle(
    axum::Extension(identity): axum::Extension<TrustedIdentity>,
    State(state): State<Arc<LiveState>>,
    OriginalUri(uri): OriginalUri,
    method: Method,
    query: std::result::Result<Query<MarketQuery>, axum::extract::rejection::QueryRejection>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let q = match query {
        Ok(Query(q)) => q,
        Err(_) => return Fault::invalid().response(),
    };
    let c = identity.0;
    static QUOTA: OnceLock<Mutex<crate::research::Quota>> = OnceLock::new();
    let quota = QUOTA
        .get_or_init(|| Mutex::new(crate::research::Quota::default()))
        .lock()
        .map_err(|_| Fault::unavailable())
        .and_then(|mut v| v.take(&scope(&c), uri.path(), Utc::now()));
    if let Err(e) = quota {
        return e.response();
    }
    let db = state.database_url.clone();
    let path = uri.path().to_owned();
    let first = {
        let c = c.clone();
        let path = path.clone();
        let q = q.clone();
        let h = headers.clone();
        tokio::task::spawn_blocking(move || dispatch(&c, &db, &path, &method, &q, &h, &body)).await
    };
    let initial = match first {
        Ok(Ok(v)) => v,
        Ok(Err(e)) => return e.response(),
        Err(_) => return Fault::unavailable().response(),
    };
    if !path.ends_with("/stream") {
        return initial.response();
    }
    static LIMIT: OnceLock<Arc<tokio::sync::Semaphore>> = OnceLock::new();
    let permit = match LIMIT
        .get_or_init(|| Arc::new(tokio::sync::Semaphore::new(64)))
        .clone()
        .try_acquire_owned()
    {
        Ok(v) => v,
        Err(_) => return Fault(StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED").response(),
    };
    let Output::Events(events) = initial else {
        return Fault::unavailable().response();
    };
    let stream = futures_util::stream::unfold(
        (events, state, headers, path, q, c, Some(permit), false),
        |(mut events, state, headers, path, mut q, c, permit, done)| async move {
            if done {
                return None;
            }
            if events.is_empty() {
                tokio::time::sleep(Duration::from_secs(1)).await;
                let current =
                    match settings::authorized(state.clone(), headers.clone(), false).await {
                        Ok((c, _)) => c,
                        Err(_) => {
                            return Some((
                                Ok::<Event, Infallible>(
                                    Event::default()
                                        .event("reset")
                                        .json_data(reset_event(true))
                                        .unwrap(),
                                ),
                                (events, state, headers, path, q, c, permit, true),
                            ));
                        }
                    };
                if scope(&current) != scope(&c) || authorize(&current, false).is_err() {
                    return Some((
                        Ok(Event::default()
                            .event("reset")
                            .json_data(reset_event(true))
                            .unwrap()),
                        (events, state, headers, path, q, c, permit, true),
                    ));
                }
                let db = state.database_url.clone();
                let identity = current.clone();
                let p = path.clone();
                let query = q.clone();
                let h = headers.clone();
                match tokio::task::spawn_blocking(move || {
                    dispatch(&identity, &db, &p, &Method::GET, &query, &h, &[])
                })
                .await
                {
                    Ok(Ok(Output::Events(e))) => events = e,
                    _ => {
                        return Some((
                            Ok(Event::default()
                                .event("reset")
                                .json_data(reset_event(false))
                                .unwrap()),
                            (events, state, headers, path, q, c, permit, true),
                        ));
                    }
                }
            }
            let frame = if events.is_empty() {
                Event::default().comment("heartbeat")
            } else {
                let e = events.remove(0);
                q.after_sequence = e["sequence"].as_u64();
                q.stream_id = e["streamId"].as_str().map(str::to_owned);
                Event::default()
                    .id(e["sequence"].to_string())
                    .json_data(e)
                    .unwrap()
            };
            Some((
                Ok(frame),
                (events, state, headers, path, q, c, permit, false),
            ))
        },
    );
    let mut response = Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response();
    response
        .headers_mut()
        .insert("cache-control", "no-store".parse().unwrap());
    response.headers_mut().insert(
        "x-correlation-id",
        Uuid::new_v4().to_string().parse().unwrap(),
    );
    response
}
use axum::response::IntoResponse;
#[cfg(test)]
mod tests {
    use super::*;
    use quantos_auth::AuthContext;
    use quantos_core::{ActorId, WorkspaceId};
    use quantos_policy::{Capability, RunMode};
    #[test]
    fn live_capabilities_and_viewer_writes_fail_closed() {
        let mut c = BffSessionContext {
            user_id: Uuid::new_v4(),
            mfa_verified: true,
            expires_at: Utc::now() + chrono::Duration::minutes(5),
            auth: AuthContext {
                tenant_id: TenantId::new(),
                actor_id: ActorId::new(),
                user_id: Uuid::new_v4(),
                workspace_id: WorkspaceId::new(),
                workspace_slug: "fixture".into(),
                workspace_name: "Fixture".into(),
                role: Role::Owner,
                mode: RunMode::Paper,
                account_id: None,
                capabilities: ["market.read", "market.watchlist.write"]
                    .into_iter()
                    .map(|v| Capability::parse(v).unwrap())
                    .collect(),
            },
        };
        assert!(authorize(&c, true).is_ok());
        c.auth.role = Role::Viewer;
        assert!(authorize(&c, false).is_ok());
        assert!(authorize(&c, true).is_err());
        c.auth.capabilities.clear();
        assert!(authorize(&c, false).is_err());
    }
}
