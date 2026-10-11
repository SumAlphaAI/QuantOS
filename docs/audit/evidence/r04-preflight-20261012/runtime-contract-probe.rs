// Pure public-validator probe; it creates no Engine, database or workflow run.
use quantos_runtime::signal_proposal::SignalProposalSchemaValidator as Validator;
use serde_json::{Value, json};

fn main() {
    let args: Vec<_> = std::env::args().collect();
    let signals: Value = serde_json::from_slice(&std::fs::read(&args[1]).unwrap()).unwrap();
    let proposals: Value = serde_json::from_slice(&std::fs::read(&args[2]).unwrap()).unwrap();
    let signal = &signals[0]["output"];
    let proposal = &proposals[0]["output"];
    Validator::validate_signal(signal).expect("fresh Signal baseline");
    Validator::validate_proposal(proposal).expect("fresh Proposal baseline");
    let mut results = vec![];
    for case in ["invalid-direction", "confidence-out-of-range", "missing-model-version", "missing-metadata"] {
        let mut value = signal.clone();
        match case {
            "invalid-direction" => value["direction"] = json!("BUY"),
            "confidence-out-of-range" => value["confidence"]["value"] = json!("2"),
            "missing-model-version" => { value["diagnostics"]["value"].as_object_mut().unwrap().remove("model_version"); },
            "missing-metadata" => { value.as_object_mut().unwrap().remove("metadata"); },
            _ => unreachable!(),
        }
        let accepted = Validator::validate_signal(&value).is_ok();
        results.push(json!({"type": "Signal", "case": case, "runtimeAccepted": accepted}));
    }
    for case in ["invalid-action", "missing-counter-views", "expiry-before-generation", "executable-true", "empty-evidence"] {
        let mut value = proposal.clone();
        match case {
            "invalid-action" => value["action"] = json!("EXECUTE"),
            "missing-counter-views" => { value.as_object_mut().unwrap().remove("counter_views"); },
            "expiry-before-generation" => value["expires_at"] = json!("2000-01-01T00:00:00Z"),
            "executable-true" => value["executable"] = json!(true),
            "empty-evidence" => value["evidence_refs"] = json!([]),
            _ => unreachable!(),
        }
        let accepted = Validator::validate_proposal(&value).is_ok();
        results.push(json!({"type": "TradeProposal", "case": case, "runtimeAccepted": accepted}));
    }
    println!("{}", json!({"schema": "quantos-r04-runtime-contract-probe/v1", "status": "GAPS_FOUND", "scope": "public schema validators only; does not claim downstream execution accepts these inputs", "formalAccepted": false, "databaseExecution": false, "baselineValid": true, "cases": results}));
}
