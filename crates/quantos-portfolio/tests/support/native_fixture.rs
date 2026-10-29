//! Owner-shaped model fixtures. Current native/mTLS tests exercise the actual join.
use quantos_core::{AccountId, ContentHash, TenantId, WorkspaceId, canonical_json_bytes};
use quantos_portfolio::{native_ledger::*, native_source::NativeExecutionFacts};
use serde_json::{Value, json};
pub(crate) fn scope() -> Scope {
    Scope {
        tenant_id: TenantId::parse_str("22222222-2222-4222-8222-222222222222").unwrap(),
        workspace_id: WorkspaceId::parse_str("33333333-3333-4333-8333-333333333333").unwrap(),
        account_id: AccountId::parse_str("44444444-4444-4444-8444-444444444444").unwrap(),
    }
}
fn seal(v: &mut Value) {
    v.as_object_mut().unwrap().remove("sourceHash");
    v["sourceHash"] = json!(ContentHash::sha256_bytes(
        &canonical_json_bytes(&json!(["quantos-native-execution-source/v1", v])).unwrap()
    ));
}
pub(crate) fn source(n: u128, side: &str, q: &str, p: &str, fee: &str) -> NativeExecutionFacts {
    let mut v: Value = serde_json::from_str(include_str!(
        "../../../../docs/audit/evidence/core-x04-current-local-20261029/attempt-01/native-facts.json"
    ))
    .unwrap();
    let f = &mut v["view"]["facts"];
    let command = uuid::Uuid::from_u128(n + 1);
    f["requestId"] = json!(uuid::Uuid::from_u128(n + 100));
    f["commandId"] = json!(command);
    f["order"]["commandId"] = json!(command);
    f["order"]["side"] = json!(side);
    f["order"]["quantity"] = json!(q);
    f["order"]["filledQuantity"] = json!(q);
    f["order"]["averageFillPrice"] = json!(p);
    f["order"]["orderId"] = json!(format!("order:{n}"));
    f["fills"][0]["fillId"] = json!(format!("fill:{n}"));
    f["fills"][0]["orderId"] = f["order"]["orderId"].clone();
    f["fills"][0]["commandId"] = json!(command);
    f["fills"][0]["side"] = json!(side);
    f["fills"][0]["quantity"] = json!(q);
    f["fills"][0]["price"] = json!(p);
    f["fills"][0]["feeAmount"] = json!(fee);
    seal(f);
    serde_json::from_value(f.clone()).unwrap()
}
pub(crate) fn edit(s: &NativeExecutionFacts, f: impl FnOnce(&mut Value)) -> NativeExecutionFacts {
    let mut v = serde_json::to_value(s).unwrap();
    f(&mut v);
    seal(&mut v);
    serde_json::from_value(v).unwrap()
}
