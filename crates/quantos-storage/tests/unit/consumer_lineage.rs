use super::consumer_lineage_range;
use crate::SnapshotLineageEntry;
use serde_json::json;

#[test]
fn legacy_lineage_bounds_and_cumulative_budget_fail_closed() {
    let mut lineage = SnapshotLineageEntry {
        lineage_kind: "market_event_range".into(),
        reference: "market:fixture".into(),
        details: json!({"from_sequence":1,"to_sequence":1}),
    };
    assert_eq!(
        consumer_lineage_range(&lineage, 0).unwrap(),
        ("fixture", 1, 1)
    );
    lineage.details = json!({"first_sequence":1,"last_sequence":10000});
    assert_eq!(
        consumer_lineage_range(&lineage, 0).unwrap(),
        ("fixture", 1, 10000)
    );
    assert!(consumer_lineage_range(&lineage, 1).is_err());
    for details in [
        json!({"to_sequence":1}),
        json!({"from_sequence":1}),
        json!({"from_sequence":0,"to_sequence":1}),
        json!({"from_sequence":2,"to_sequence":1}),
        json!({"from_sequence":1,"to_sequence":10001}),
    ] {
        lineage.details = details;
        assert!(consumer_lineage_range(&lineage, 0).is_err());
    }
    lineage.details = json!({"from_sequence":1,"to_sequence":1});
    lineage.reference = "invalid".into();
    assert!(consumer_lineage_range(&lineage, 0).is_err());
}
