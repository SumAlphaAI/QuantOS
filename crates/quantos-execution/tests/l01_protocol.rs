#[path = "support/l01_fixture.rs"]
mod fixture;
use fixture::*;
use quantos_execution::{gateway::*, oms::BoundaryCancel, venue::*, venue_protocol::*};
use serde_json::{Value, json};
use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
};
#[derive(Clone)]
struct Port {
    case: Value,
    client: String,
    calls: Arc<Mutex<Vec<Request>>>,
    override_reply: Arc<Mutex<VecDeque<Result<Value, TransportFault>>>>,
}
impl Port {
    fn new(case: Value) -> Self {
        Self {
            case,
            client: String::new(),
            calls: Arc::default(),
            override_reply: Arc::default(),
        }
    }
}
impl ProtocolPort for Port {
    fn exchange(&mut self, r: &Request) -> Result<Response, TransportFault> {
        self.calls.lock().unwrap().push(r.clone());
        if r.method == "POST" {
            self.client = r.params["newClientOrderId"].clone();
        }
        if let Some(value) = self.override_reply.lock().unwrap().pop_front() {
            return value.map(response);
        }
        if r.path == "/api/v3/myTrades" {
            let body = reply(&self.case, r, &self.client)["body"].clone();
            let rows=body["fills"].as_array().unwrap().iter().map(|f|json!({"id":f["tradeId"],"orderId":body["orderId"],"symbol":"BTCUSDT","isBuyer":self.case["side"]=="buy","qty":f["qty"],"price":f["price"],"commission":f["commission"],"commissionAsset":f["commissionAsset"],"time":now().timestamp_millis()})).collect::<Vec<_>>();
            return Ok(response(json!({"status":200,"body":rows})));
        }
        Ok(response(reply(&self.case, r, &self.client)))
    }
}
fn kernel(p: Port) -> ProtocolKernel<Port> {
    ProtocolKernel::new(VenueConfig::approved_testnet(), rules(), p).unwrap()
}
fn limits() -> GatewayLimits {
    GatewayLimits {
        max_quantity: 1000.into(),
        max_notional: 1_000_000.into(),
        allowed_venues: vec![EXECUTION_VENUE.into()],
    }
}
#[test]
fn l01_two_hundred_owned_protocol_cases_reach_x04_order_and_fill_schema() {
    let mut rows = vec![];
    for (i, case) in cases().iter().enumerate() {
        let port = Port::new(case.clone());
        let calls = port.calls.clone();
        let mut gateway = ExecutionGateway::new(limits(), kernel(port));
        let c = command(i, case);
        let receipt = gateway.submit(&c, now()).unwrap();
        gateway.try_collect_events().unwrap();
        if case["kind"] == "cancelled" || case["kind"] == "cancel_rejected" {
            let order = gateway.order(&receipt.order_id).unwrap();
            let venue = order.venue_order_id.clone().unwrap();
            gateway
                .cancel(&c.command_id.to_string(), &format!("cancel-{i}"), now())
                .unwrap();
            assert_eq!(
                gateway
                    .order(&receipt.order_id)
                    .unwrap()
                    .venue_order_id
                    .as_deref(),
                Some(venue.as_str())
            );
        }
        let order = gateway.order(&receipt.order_id).unwrap().clone();
        assert_eq!(order.status, case["expectedStatus"]);
        let fills = gateway.fills().to_vec();
        let expected = case["kind"] == "filled" || case["kind"] == "partial";
        assert_eq!(fills.len(), usize::from(expected));
        if expected {
            assert_eq!(fills[0].fee_currency, "USDT");
            assert_eq!(fills[0].fee_amount, "0.01");
        }
        assert_eq!(gateway.downstream_submission_count(), 1);
        let before = calls.lock().unwrap().len();
        assert!(gateway.submit(&c, now()).unwrap().replayed);
        assert_eq!(calls.lock().unwrap().len(), before);
        rows.push(json!({"id":case["id"],"kind":case["kind"],"status":order.status,"fills":fills.len(),"requests":before}));
    }
    assert_eq!(rows.len(), 200);
    if let Ok(path) = std::env::var("QUANTOS_L01_MATRIX") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-l01-mapping/v1","scope":"OWNED_PROTOCOL_NOT_EXCHANGE_TESTNET","actualTestnetConnected":false,"productionCredentialsUsed":false,"cases":rows})).unwrap()).unwrap();
    }
}
#[test]
fn l01_decimal_values_and_signed_intents_are_not_silently_rounded() {
    let c = cases()[0].clone();
    let p = Port::new(c.clone());
    let calls = p.calls.clone();
    let mut k = kernel(p);
    for value in [
        "0",
        "NaN",
        "inf",
        "-1",
        "1e3",
        "0.00001",
        "9007199254740993.123456789",
    ] {
        let mut b = boundary(1, &c);
        b.quantity = value.into();
        assert!(k.submit_at(&b, now()).is_err());
    }
    assert!(calls.lock().unwrap().is_empty());
    let mut b = boundary(1, &c);
    b.limit_price = Some("100.251".into());
    assert!(k.submit_at(&b, now()).is_err());
}
#[test]
fn l01_unknown_write_is_not_rejected_or_retried_and_response_is_atomic() {
    for fault in [
        json!({"status":504,"body":{}}),
        json!({"status":400,"body":{"code":-1007,"msg":"owned sensitive detail"}}),
        json!({"status":200,"body":{"status":"FILLED"}}),
        json!({"status":200,"body":{"code":-1013,"msg":"inconsistent success"}}),
    ] {
        let c = cases()[0].clone();
        let p = Port::new(c.clone());
        p.override_reply.lock().unwrap().push_back(Ok(fault));
        let calls = p.calls.clone();
        let mut k = kernel(p);
        let b = boundary(1, &c);
        assert!(k.submit_at(&b, now()).is_err());
        assert!(k.pending_unknown(&b.command_id));
        assert!(k.drain_events().is_empty());
        assert!(k.submit_at(&b, now()).is_err());
        assert_eq!(calls.lock().unwrap().len(), 1);
    }
}
#[test]
fn l01_authentication_rate_limit_and_rejection_are_safe_classes() {
    for (status, code, expected) in [
        (401, -2015, "Authentication"),
        (403, -1000, "AccessDenied"),
        (429, -1003, "RateLimited"),
        (400, -1013, "VenueRejected"),
    ] {
        let c = cases()[0].clone();
        let p = Port::new(c.clone());
        p.override_reply.lock().unwrap().push_back(Ok(json!({"status":status,"retryAfter":2,"body":{"code":code,"msg":"owned-canary-credential"}})));
        let mut k = kernel(p);
        k.submit_at(&boundary(1, &c), now()).unwrap();
        let output = format!("{:?}", k.drain_events());
        assert!(output.contains(expected));
        assert!(!output.contains("owned-canary"));
    }
}
#[test]
fn l01_transport_failure_retains_unknown_and_original_gateway_no_duplicate() {
    let c = cases()[0].clone();
    let p = Port::new(c.clone());
    p.override_reply
        .lock()
        .unwrap()
        .push_back(Err(TransportFault::Timeout));
    let calls = p.calls.clone();
    let mut g = ExecutionGateway::new(limits(), kernel(p));
    let c = command(1, &c);
    assert!(matches!(
        g.submit(&c, now()),
        Err(GatewayError::SubmissionUncertain)
    ));
    assert!(matches!(
        g.submit(&c, now()),
        Err(GatewayError::SubmissionUncertain)
    ));
    assert_eq!(calls.lock().unwrap().len(), 1);
    assert!(g.fills().is_empty());
}
#[test]
fn l01_request_excludes_authority_and_uses_only_fixed_testnet_protocol() {
    let c = cases()[0].clone();
    let p = Port::new(c.clone());
    let calls = p.calls.clone();
    let mut k = kernel(p);
    let mut b = boundary(1, &c);
    b.account_id = "owned-private-account".into();
    b.idempotency_key = "owned-private-idempotency".into();
    k.submit_at(&b, now()).unwrap();
    let calls = calls.lock().unwrap();
    let req = &calls[0];
    assert_eq!(req.origin(), APPROVED_TESTNET_ENDPOINT);
    assert_eq!(req.params["type"], "LIMIT");
    assert!(req.params["newClientOrderId"].len() <= 36);
    let raw = serde_json::to_string(req).unwrap();
    assert!(!raw.contains("owned-private"));
    assert!(!raw.contains("signature"));
    assert!(!raw.contains("apiKey"));
}
#[test]
fn l01_cancel_unknown_and_terminal_orders_do_not_reach_transport() {
    let c = cases()[0].clone();
    let p = Port::new(c.clone());
    let calls = p.calls.clone();
    let mut k = kernel(p);
    let b = boundary(1, &c);
    k.submit_at(&b, now()).unwrap();
    let req = BoundaryCancel {
        command_id: b.command_id,
        venue_order_id: "unbound".into(),
        cancel_id: "x".into(),
        requested_at: now(),
    };
    assert!(k.cancel(&req).is_err());
    assert_eq!(calls.lock().unwrap().len(), 1);
}
#[test]
fn l01_unknown_submit_recovers_only_by_reading_order_and_trades_without_resubmit() {
    let case = cases()[0].clone();
    let p = Port::new(case.clone());
    p.override_reply
        .lock()
        .unwrap()
        .push_back(Err(TransportFault::Disconnected));
    let calls = p.calls.clone();
    let mut k = kernel(p);
    let b = boundary(1, &case);
    assert!(k.submit_at(&b, now()).is_err());
    k.reconcile(&b.command_id, now()).unwrap();
    let events = k.drain_events();
    assert_eq!(events.len(), 2);
    assert!(!k.pending_unknown(&b.command_id));
    assert!(
        matches!(&events[1],KernelEvent::OrderFilled{quantity,fee_currency,..}if quantity=="2"&&fee_currency=="USDT")
    );
    k.reconcile(&b.command_id, now()).unwrap();
    assert!(k.drain_events().is_empty());
    assert_eq!(
        calls
            .lock()
            .unwrap()
            .iter()
            .filter(|r| r.method == "POST")
            .count(),
        1
    );
}
#[test]
fn l01_partial_trade_recovery_and_changed_trade_reject_atomically() {
    let case = cases()[50].clone();
    let p = Port::new(case.clone());
    let calls = p.calls.clone();
    let overrides = p.override_reply.clone();
    let mut k = kernel(p);
    let b = boundary(1, &case);
    k.submit_at(&b, now()).unwrap();
    assert_eq!(k.drain_events().len(), 2);
    k.reconcile(&b.command_id, now()).unwrap();
    assert!(k.drain_events().is_empty());
    let request = calls.lock().unwrap()[0].clone();
    let mut bad = reply(&case, &request, &request.params["newClientOrderId"]);
    bad["body"]["executedQty"] = json!("999");
    overrides.lock().unwrap().push_back(Ok(bad));
    assert!(k.reconcile(&b.command_id, now()).is_err());
    assert!(k.drain_events().is_empty());
}
#[test]
fn l01_retry_after_seconds_and_monotone_clock_cover_reads_and_cancels() {
    use chrono::Duration;
    let case = cases()[0].clone();
    let p = Port::new(case.clone());
    p.override_reply
        .lock()
        .unwrap()
        .push_back(Ok(json!({"status":429,"retryAfter":2,"body":{}})));
    let calls = p.calls.clone();
    let mut k = kernel(p);
    k.submit_at(&boundary(1, &case), now()).unwrap();
    k.drain_events();
    k.submit_at(&boundary(2, &case), now() + Duration::milliseconds(1999))
        .unwrap();
    assert_eq!(calls.lock().unwrap().len(), 1);
    k.drain_events();
    k.submit_at(&boundary(3, &case), now() + Duration::seconds(2))
        .unwrap();
    assert_eq!(calls.lock().unwrap().len(), 2);
    assert!(
        k.submit_at(&boundary(4, &case), now() - Duration::seconds(1))
            .is_err()
    );
    assert_eq!(calls.lock().unwrap().len(), 2);
}
#[allow(dead_code)]
#[path = "support/tp07_fixture.rs"]
mod signed_fixture;
#[test]
fn l01_signed_x03_command_crosses_only_sanitized_protocol_boundary() {
    use quantos_execution::dispatch::SignedExecutionGateway;
    use quantos_risk::guard::Phase;
    let mut f = signed_fixture::Fixture::new();
    f.venue.venue = EXECUTION_VENUE.into();
    let guard = f.guard();
    let issuer = f.issuer(&guard);
    let proposal = f.register(&issuer);
    let risk = f.eval(&guard, Phase::Pre);
    let command = issuer
        .issue(&f.auth, &proposal, &risk, None, f.sources(), f.now)
        .unwrap();
    let mut case = cases()[0].clone();
    case["quantity"] = json!("10");
    case["price"] = json!("100");
    let at = chrono::DateTime::from_timestamp_millis(f.now.timestamp_millis() + 1).unwrap();
    case["timestamp"] = json!(at.timestamp_millis());
    let port = Port::new(case);
    let calls = port.calls.clone();
    let mut r = rules();
    r.observed_at = f.now - chrono::Duration::seconds(1);
    r.expires_at = f.now + chrono::Duration::minutes(5);
    let k = ProtocolKernel::new(VenueConfig::approved_testnet(), r, port).unwrap();
    let gateway = SignedExecutionGateway::new(issuer, limits(), k).unwrap();
    gateway.submit(&f.auth, &command, f.sources(), at).unwrap();
    let evidence = gateway.inspect_order(&f.auth, &command, at).unwrap();
    assert_eq!(evidence.order.status, "filled");
    assert_eq!(evidence.fills.len(), 1);
    assert_eq!(evidence.fills[0].quantity, "10");
    gateway.submit(&f.auth, &command, f.sources(), at).unwrap();
    assert_eq!(calls.lock().unwrap().len(), 1);
}
#[test]
fn l01_cancel_response_loss_recovers_by_order_id_and_never_reissues_delete() {
    let case = cases()[150].clone();
    let p = Port::new(case.clone());
    let calls = p.calls.clone();
    let overrides = p.override_reply.clone();
    let mut k = kernel(p);
    let b = boundary(1, &case);
    k.submit_at(&b, now()).unwrap();
    k.drain_events();
    let req = BoundaryCancel {
        command_id: b.command_id.clone(),
        venue_order_id: case["orderId"].to_string(),
        cancel_id: "owned-cancel".into(),
        requested_at: now(),
    };
    overrides
        .lock()
        .unwrap()
        .push_back(Err(TransportFault::Timeout));
    assert!(k.cancel(&req).is_err());
    assert!(k.pending_unknown(&b.command_id));
    assert!(k.cancel(&req).is_err());
    assert_eq!(
        calls
            .lock()
            .unwrap()
            .iter()
            .filter(|r| r.method == "DELETE")
            .count(),
        1
    );
    let last = calls.lock().unwrap().last().unwrap().clone();
    let mut resolved = reply(
        &case,
        &last,
        &calls.lock().unwrap()[0].params["newClientOrderId"],
    );
    resolved["body"]["origClientOrderId"] = Value::Null;
    overrides.lock().unwrap().push_back(Ok(resolved));
    k.reconcile(&b.command_id, now()).unwrap();
    assert!(
        matches!(&k.drain_events()[0],KernelEvent::OrderCancelled{cancel_id,..}if cancel_id=="owned-cancel")
    );
    assert_eq!(
        calls.lock().unwrap().last().unwrap().params["orderId"],
        case["orderId"].to_string()
    );
    assert!(!k.pending_unknown(&b.command_id));
}
#[test]
fn l01_multi_fill_foreign_symbol_and_future_frames_never_publish_partial_facts() {
    for mutation in ["future", "foreign", "overfill", "bad-fill"] {
        let case = cases()[0].clone();
        let p = Port::new(case.clone());
        let overrides = p.override_reply.clone();
        let mut k = kernel(p);
        let b = boundary(1, &case);
        let mut request = Request {
            method: "POST".into(),
            path: "/api/v3/order".into(),
            params: Default::default(),
        };
        let cid = quantos_core::ContentHash::sha256_bytes(
            &quantos_core::canonical_json_bytes(&json!([
                "l01-client/v1",
                b.command_id,
                b.idempotency_key
            ]))
            .unwrap(),
        );
        let client = format!("q{}", &cid.as_str()[7..38]);
        request
            .params
            .insert("newClientOrderId".into(), client.clone());
        let mut raw = reply(&case, &request, &client);
        match mutation {
            "future" => raw["body"]["transactTime"] = json!(now().timestamp_millis() + 1),
            "foreign" => raw["body"]["symbol"] = json!("ETHUSDT"),
            "overfill" => raw["body"]["executedQty"] = json!("999"),
            _ => {
                let first = raw["body"]["fills"][0].clone();
                raw["body"]["fills"] = json!([first,{"tradeId":999,"qty":"bad"}]);
            }
        }
        overrides.lock().unwrap().push_back(Ok(raw));
        assert!(k.submit_at(&b, now()).is_err());
        assert!(k.drain_events().is_empty());
        assert!(k.pending_unknown(&b.command_id));
    }
}

#[test]
fn l01_expiry_filters_and_unsupported_intents_refuse_before_io() {
    let case = cases()[0].clone();
    for mutation in [
        "expired-command",
        "expired-rules",
        "future-rules",
        "notional",
        "market",
        "foreign-venue",
        "stop",
    ] {
        let p = Port::new(case.clone());
        let calls = p.calls.clone();
        let mut r = rules();
        let mut b = boundary(1, &case);
        match mutation {
            "expired-command" => b.expires_at = now(),
            "expired-rules" => r.expires_at = now(),
            "future-rules" => r.observed_at = now() + chrono::Duration::seconds(1),
            "notional" => b.quantity = "0.0001".into(),
            "market" => b.intent = "market".into(),
            "foreign-venue" => b.venue = "OTHER".into(),
            _ => b.stop_price = Some("100".into()),
        }
        let mut k = ProtocolKernel::new(VenueConfig::approved_testnet(), r, p).unwrap();
        assert!(k.submit_at(&b, now()).is_err(), "{mutation}");
        assert!(calls.lock().unwrap().is_empty());
        assert!(k.drain_events().is_empty());
    }
}

#[test]
fn l01_one_rate_budget_covers_submit_query_cancel_and_refused_cancel_can_retry() {
    let case = cases()[150].clone();
    let p = Port::new(case.clone());
    let calls = p.calls.clone();
    let mut config = VenueConfig::approved_testnet();
    config.rate_limit_per_second = 1;
    let mut k = ProtocolKernel::new(config, rules(), p).unwrap();
    let b = boundary(1, &case);
    k.submit_at(&b, now()).unwrap();
    k.drain_events();
    assert_eq!(k.reconcile(&b.command_id, now()), Err(Failure::RateLimited));
    let mut c = BoundaryCancel {
        command_id: b.command_id,
        venue_order_id: case["orderId"].to_string(),
        cancel_id: "limited-cancel".into(),
        requested_at: now(),
    };
    k.cancel(&c).unwrap();
    assert!(matches!(
        &k.drain_events()[0],
        KernelEvent::CancelRejected { .. }
    ));
    assert_eq!(calls.lock().unwrap().len(), 1);
    c.cancel_id = "new-authorized-cancel".into();
    c.requested_at += chrono::Duration::seconds(1);
    k.cancel(&c).unwrap();
    assert!(matches!(
        &k.drain_events()[0],
        KernelEvent::OrderCancelled { .. }
    ));
    assert_eq!(calls.lock().unwrap().len(), 2);
}
