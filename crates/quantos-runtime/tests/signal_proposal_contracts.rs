//! Synthetic preflight matrices are immutable regression inputs, not target acceptance.
use quantos_runtime::signal_proposal::SignalProposalSchemaValidator as Validator;
use serde_json::{Value, json};
fn signal() -> Value {
    serde_json::from_str::<Value>(include_str!(
        "../../../docs/audit/evidence/r04-preflight-20261012/attempt-02/signal-matrix.json"
    ))
    .unwrap()[0]["output"]
        .clone()
}
fn proposal() -> Value {
    serde_json::from_str::<Value>(include_str!(
        "../../../docs/audit/evidence/r04-preflight-20261012/attempt-02/proposal-matrix.json"
    ))
    .unwrap()[0]["output"]
        .clone()
}
#[test]
fn synthetic_baselines_remain_valid() {
    Validator::validate_signal(&signal()).unwrap();
    Validator::validate_proposal(&proposal()).unwrap();
}
#[test]
fn signal_direction_is_closed_enum() {
    for direction in [
        "BUY",
        "SIGNAL_DIRECTION_UNSPECIFIED",
        " SIGNAL_DIRECTION_LONG",
    ] {
        let mut s = signal();
        s["direction"] = json!(direction);
        assert!(Validator::validate_signal(&s).is_err(), "{direction}");
    }
}
#[test]
fn signal_decimals_are_finite_unit_interval() {
    for field in ["strength", "confidence"] {
        for number in [
            "2",
            "-0.01",
            "NaN",
            "Infinity",
            "",
            " 0.5",
            "1.000000000000000000000001",
        ] {
            let mut s = signal();
            s[field]["value"] = json!(number);
            assert!(Validator::validate_signal(&s).is_err(), "{field}:{number}");
        }
    }
}
#[test]
fn signal_model_provenance_is_required() {
    for field in [
        "model_version",
        "strategy_version",
        "data_version",
        "model_digest",
    ] {
        let mut s = signal();
        s["diagnostics"]["value"]
            .as_object_mut()
            .unwrap()
            .remove(field);
        assert!(Validator::validate_signal(&s).is_err(), "{field}");
    }
}
#[test]
fn signal_metadata_is_required_and_scoped() {
    let mut s = signal();
    s.as_object_mut().unwrap().remove("metadata");
    assert!(Validator::validate_signal(&s).is_err());
    for pointer in [
        "/metadata/tenant_id",
        "/metadata/workspace_id",
        "/metadata/actor/actor_id",
    ] {
        let mut s = signal();
        *s.pointer_mut(pointer).unwrap() = json!("");
        assert!(Validator::validate_signal(&s).is_err(), "{pointer}");
    }
}
#[test]
fn proposal_action_is_closed_enum() {
    for action in ["EXECUTE", "PROPOSAL_ACTION_UNSPECIFIED"] {
        let mut p = proposal();
        p["action"] = json!(action);
        assert!(Validator::validate_proposal(&p).is_err());
    }
}
#[test]
fn proposal_requires_explicit_counter_views() {
    let mut p = proposal();
    p.as_object_mut().unwrap().remove("counter_views");
    assert!(Validator::validate_proposal(&p).is_err());
    for views in [json!([]), json!([""])] {
        let mut p = proposal();
        p["counter_views"] = views;
        assert!(Validator::validate_proposal(&p).is_err());
    }
}
#[test]
fn proposal_expiry_must_follow_generation() {
    for expiry in [
        json!("2000-01-01T00:00:00Z"),
        proposal()["signal"]["generated_at"].clone(),
    ] {
        let mut p = proposal();
        p["expires_at"] = expiry;
        assert!(Validator::validate_proposal(&p).is_err());
    }
}
#[test]
fn proposal_cannot_execute_or_hide_evidence() {
    for (field, value) in [("executable", json!(true)), ("evidence_refs", json!([]))] {
        let mut p = proposal();
        p[field] = value;
        assert!(Validator::validate_proposal(&p).is_err());
    }
}
#[test]
fn proposal_nested_signal_and_metadata_are_checked() {
    let mut p = proposal();
    p["signal"]["direction"] = json!("BUY");
    assert!(Validator::validate_proposal(&p).is_err());
    let mut p = proposal();
    p["metadata"]["tenant_id"] = json!("other");
    assert!(Validator::validate_proposal(&p).is_err());
}
#[test]
fn malformed_evidence_and_numeric_proposal_are_rejected() {
    let mut s = signal();
    s["evidence_refs"][0]["artifact_id"] = json!("");
    assert!(Validator::validate_signal(&s).is_err());
    for field in ["quantity", "notional", "confidence"] {
        let mut p = proposal();
        p[field]["value"] = json!("NaN");
        assert!(Validator::validate_proposal(&p).is_err());
    }
}
