#![allow(dead_code)]
use chrono::{DateTime, Duration, TimeZone, Utc};
use quantos_core::{CommandId, ContentHash, DecisionId};
use quantos_execution::gateway::BoundaryCommand;
use quantos_execution::{venue_protocol::*, *};
use rust_decimal::Decimal;
use serde_json::{Value, json};
use std::str::FromStr;
pub fn now() -> DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 10, 26, 0, 0, 0).unwrap()
}
pub fn rules() -> SymbolRules {
    SymbolRules {
        symbol: "BTCUSDT".into(),
        price_tick: Decimal::from_str("0.01").unwrap(),
        quantity_step: Decimal::from_str("0.0001").unwrap(),
        min_quantity: Decimal::from_str("0.0001").unwrap(),
        max_quantity: Decimal::from(1000),
        min_price: Decimal::from(1),
        max_price: Decimal::from(1_000_000),
        min_notional: Decimal::from(5),
        observed_at: now() - Duration::seconds(1),
        expires_at: now() + Duration::hours(1),
        source_hash: ContentHash::sha256_bytes(b"owned instrument rules, not exchangeInfo"),
    }
}
pub fn cases() -> Vec<Value> {
    serde_json::from_str::<Value>(include_str!("../fixtures/l01-corpus.json")).unwrap()["cases"]
        .as_array()
        .unwrap()
        .clone()
}
pub fn command(index: usize, c: &Value) -> TradeCommand {
    TradeCommand {
        command_id: CommandId::from_uuid(uuid::Uuid::from_u128(index as u128 + 1)),
        decision_id: DecisionId::new(),
        account_id: "owned-l01-account".into(),
        venue: EXECUTION_VENUE.into(),
        venue_kind: VenueKind::Cex,
        symbol: "BTCUSDT".into(),
        intent: OrderIntent::Limit,
        side: if c["side"] == "buy" {
            OrderSide::Buy
        } else {
            OrderSide::Sell
        },
        quantity: c["quantity"].as_str().unwrap().into(),
        limit_price: Some(c["price"].as_str().unwrap().into()),
        stop_price: None,
        idempotency_key: format!("owned-l01-{index}"),
        approval_signature: None,
        expires_at: now() + Duration::minutes(1),
        signature: ContentHash::sha256_bytes(b"legacy fixture only; not execution authority"),
        issued_at: now(),
    }
}
pub fn boundary(index: usize, c: &Value) -> BoundaryCommand {
    let c = command(index, c);
    BoundaryCommand {
        command_id: c.command_id.to_string(),
        account_id: c.account_id,
        venue: c.venue,
        venue_kind: "cex".into(),
        symbol: c.symbol,
        intent: "limit".into(),
        side: c.side.as_str().into(),
        quantity: c.quantity,
        limit_price: c.limit_price,
        stop_price: None,
        idempotency_key: c.idempotency_key,
        expires_at: c.expires_at,
    }
}
/// Owned responses use provider field names, with no real account, key or exchange IO.
pub fn reply(case: &Value, request: &Request, client: &str) -> Value {
    let kind = case["kind"].as_str().unwrap();
    if request.method == "POST" && kind == "rejected" {
        return json!({"status":400,"body":{"code":-1013,"msg":"owned fixture filter refusal"}});
    }
    if request.method == "DELETE" && kind == "cancel_rejected" {
        return json!({"status":400,"body":{"code":-2011,"msg":"owned fixture cancel refusal"}});
    }
    let status = if request.method == "DELETE" {
        "CANCELED"
    } else {
        match kind {
            "filled" => "FILLED",
            "partial" => "PARTIALLY_FILLED",
            _ => "NEW",
        }
    };
    let quantity = Decimal::from_str(case["quantity"].as_str().unwrap()).unwrap();
    let executed = if status == "FILLED" {
        quantity
    } else if status == "PARTIALLY_FILLED" {
        quantity / Decimal::from(2)
    } else {
        Decimal::ZERO
    };
    let mut body = json!({"symbol":"BTCUSDT","orderId":case["orderId"],"clientOrderId":client,"transactTime":case.get("timestamp").and_then(Value::as_i64).unwrap_or_else(||request.params.get("timestamp").and_then(|s|s.parse().ok()).unwrap_or(now().timestamp_millis())),"origQty":case["quantity"],"executedQty":executed.to_string(),"price":case["price"],"type":"LIMIT","side":case["side"].as_str().unwrap().to_ascii_uppercase(),"status":status,"fills":[]});
    if executed > Decimal::ZERO {
        body["fills"] = json!([{"tradeId":case["tradeId"],"price":case["price"],"qty":executed.to_string(),"commission":"0.01","commissionAsset":"USDT"}]);
    }
    if request.method == "DELETE" {
        body["origClientOrderId"] = json!(client);
        body["clientOrderId"] = json!(request.params["newClientOrderId"]);
    }
    json!({"status":200,"body":body})
}
pub fn response(raw: Value) -> Response {
    Response {
        status: raw["status"].as_u64().unwrap() as u16,
        retry_after_seconds: raw["retryAfter"].as_u64(),
        body: serde_json::to_vec(&raw["body"]).unwrap(),
    }
}
