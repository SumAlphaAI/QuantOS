//! Owned protocol fixture subprocess. No network, credentials or venue SDK.
#[path = "../tests/support/l01_fixture.rs"]
mod fixture;
use quantos_execution::venue_protocol::Request;
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    io::{self, BufRead, Write},
};
fn main() {
    if std::env::args().skip(1).collect::<Vec<_>>() != ["--owned-fixture-stdio"] {
        std::process::exit(2);
    }
    let cases = fixture::cases();
    let mut clients = BTreeMap::new();
    for line in io::stdin().lock().lines() {
        let line = line.expect("owned input");
        if line.len() > 32768 {
            std::process::exit(2);
        }
        let envelope: Value = serde_json::from_str(&line).expect("owned JSON");
        let i = envelope["case"].as_u64().unwrap() as usize;
        let req: Request = serde_json::from_value(envelope["request"].clone()).unwrap();
        if i >= cases.len()
            || req.path != "/api/v3/order"
            || !matches!(req.method.as_str(), "POST" | "DELETE")
        {
            std::process::exit(2);
        }
        if req.method == "POST" {
            assert_eq!(
                req.params["quantity"],
                cases[i]["quantity"].as_str().unwrap()
            );
            assert_eq!(req.params["price"], cases[i]["price"].as_str().unwrap());
            assert_eq!(req.params["symbol"], "BTCUSDT");
            clients.insert(i, req.params["newClientOrderId"].clone());
        }
        let response = fixture::reply(&cases[i], &req, &clients[&i]);
        println!("L01_REPLY={}", json!({"case":i,"response":response}));
        io::stdout().flush().unwrap();
    }
}
