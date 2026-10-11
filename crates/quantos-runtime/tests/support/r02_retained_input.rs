use anyhow::Result;
use serde_json::{Value, json};

pub fn retained_research_input(fixture: &str, rows: &[Value]) -> Result<Value> {
    anyhow::ensure!(
        rows.len() == 32,
        "R02 retained input must contain exactly 32 facts"
    );
    // v1 carries research facts through prompt. Keep the original facts in the
    // snapshot; send the authorized research projection through its prompt.
    let facts: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "event_id":r["event_id"], "sequence":r["sequence"],
                "symbol":r["payload"]["normalized_symbol"], "event_time":r["payload"]["event_time"],
                "price":r["payload"]["price"], "volume":r["payload"]["volume"],
            })
        })
        .collect();
    let prompt = format!(
        "Evaluate retained historical market facts: {}",
        serde_json::to_string(&facts)?
    );
    anyhow::ensure!(
        prompt.chars().count() <= 8192,
        "R02 retained prompt exceeds v1 limit"
    );
    Ok(json!({"fixture":fixture,"prompt":prompt}))
}
