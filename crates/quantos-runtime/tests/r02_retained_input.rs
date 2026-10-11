use anyhow::Result;
use serde_json::{Value, json};
use std::collections::BTreeSet;
#[path = "support/r02_retained_input.rs"]
mod input;
use input::retained_research_input;

#[test]
fn retained_prompt_preserves_research_facts_within_engine_v1_boundary() -> Result<()> {
    let rows: Vec<Value> = (0..32)
        .map(|i| {
            json!({
                "event_id":format!("00000000-0000-0000-0000-{i:012}"),"sequence":i%16+1,
                "payload":{"normalized_symbol":if i<16 {"BTC/USDT"} else {"ETH/USDT"},
                    "event_time":"2026-10-04T00:00:00Z","price":"12345.67890123456789",
                    "volume":"0.00000001","unused_raw_blob":"x".repeat(8192)},
            })
        })
        .collect();
    let input = retained_research_input("hypothesis_regime_shift", &rows)?;
    let keys: BTreeSet<_> = input
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(keys, BTreeSet::from(["fixture", "prompt"]));
    let prompt = input["prompt"].as_str().unwrap();
    assert!(prompt.chars().count() <= 8192);
    let facts: Vec<Value> = serde_json::from_str(
        prompt
            .strip_prefix("Evaluate retained historical market facts: ")
            .unwrap(),
    )?;
    assert_eq!(facts.len(), 32);
    for (fact, row) in facts.iter().zip(&rows) {
        assert_eq!(fact["event_id"], row["event_id"]);
        assert_eq!(fact["price"], row["payload"]["price"]);
        assert_eq!(fact["volume"], row["payload"]["volume"]);
        assert_eq!(fact["symbol"], row["payload"]["normalized_symbol"]);
    }
    assert!(!prompt.contains("unused_raw_blob"));
    assert!(retained_research_input("hypothesis_regime_shift", &rows[..31]).is_err());
    let mut oversized = rows;
    oversized[0]["payload"]["price"] = json!("9".repeat(8192));
    assert!(retained_research_input("hypothesis_regime_shift", &oversized).is_err());
    Ok(())
}
