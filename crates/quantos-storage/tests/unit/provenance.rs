use crate::{provenance::*, *};
use chrono::{Duration, Utc};
use quantos_core::{ArtifactId, ContentHash, SchemaVersion, TenantId};
use serde_json::json;
fn fixture() -> (SourceApproval, DataSnapshotRecord, serde_json::Value) {
    let now = chrono::DateTime::from_timestamp_micros(Utc::now().timestamp_micros()).unwrap();
    let tenant = TenantId::new();
    let approval = SourceApproval {
        provider: "provider".into(),
        dataset: "ticks.v1".into(),
        license_label: "internal-research".into(),
        approval_reference: "approved.md".into(),
        approval_version: "v1".into(),
        approval_document_hash: ContentHash::sha256_bytes(b"approved"),
        scope_hash: ContentHash::sha256_bytes(b"scope"),
        tenant_id: tenant,
        symbols: vec!["BTC/USDT".into()],
        allowed_usages: vec![SnapshotUsage::Research],
        expires_at: now + Duration::hours(1),
        enabled: true,
    };
    let snapshot = DataSnapshotRecord::new(
        tenant,
        DataSnapshotInput {
            schema_name: "DataSnapshot".into(),
            schema_version: SchemaVersion::parse("v1").unwrap(),
            schema_entry_id: None,
            window: SnapshotWindow {
                start_at: now - Duration::seconds(1),
                end_at: now,
            },
            sources: vec![SnapshotSourceRef {
                source_id: "market:provider:BTC/USDT".into(),
                provider: approval.provider.clone(),
                dataset: approval.dataset.clone(),
                license_label: approval.license_label.clone(),
            }],
            quality: SnapshotQuality::Passed,
            quality_findings: vec![],
            license_label: approval.license_label.clone(),
            captured_at: now,
            max_age_secs: 60,
            symbols: approval.symbols.clone(),
            artifact_refs: vec![SnapshotArtifactRef {
                artifact_id: ArtifactId::new(),
                media_type: "application/json".into(),
                content_hash: ContentHash::sha256_bytes(b"data"),
                storage_bucket: "fixture".into(),
                object_key: "fixture".into(),
            }],
            lineage: vec![SnapshotLineageEntry {
                lineage_kind: "market_event_range".into(),
                reference: "market:provider:BTC/USDT".into(),
                details: json!({"from_sequence":1,"to_sequence":1}),
            }],
        },
        now,
    )
    .unwrap();
    let event = json!({"provider":approval.provider,"dataset":approval.dataset,"license_label":approval.license_label,
        "approval_reference":approval.approval_reference,"approval_version":approval.approval_version,
        "normalized_symbol":"BTC/USDT","source_tick_id":"BTCUSDT:agg:1","event_time":now,"quality":"passed"});
    (approval, snapshot, event)
}
#[test]
fn actual_identity_time_quality_and_purpose_are_required() {
    let (a, s, e) = fixture();
    let p = SnapshotSourcePolicy::new(vec![a]).unwrap();
    assert!(
        p.validate_event(&s, &e, SnapshotUsage::Research, Utc::now())
            .is_ok()
    );
    for usage in [SnapshotUsage::Strategy, SnapshotUsage::Trading] {
        assert!(p.validate_event(&s, &e, usage, Utc::now()).is_err());
    }
    for (field, value) in [
        ("provider", json!("other")),
        ("dataset", json!("other")),
        ("license_label", json!("other")),
        ("approval_reference", json!("other")),
        ("approval_version", json!("other")),
        ("normalized_symbol", json!("ETH/USDT")),
        ("source_tick_id", json!("")),
        ("event_time", json!("invalid")),
        ("event_time", json!(Utc::now() + Duration::hours(1))),
        (
            "event_time",
            json!(s.window.start_at - Duration::seconds(1)),
        ),
        ("quality", json!("degraded")),
        ("quality", json!("failed")),
    ] {
        let mut bad = e.clone();
        bad[field] = value;
        assert!(
            p.validate_event(&s, &bad, SnapshotUsage::Research, Utc::now())
                .is_err(),
            "{field}"
        );
    }
    assert!(
        p.validate_event(
            &s,
            &e,
            SnapshotUsage::Research,
            s.window.start_at - Duration::seconds(1)
        )
        .is_err()
    );
    let mut input = s.input();
    input.sources[0].source_id = "invented".into();
    let bad = DataSnapshotRecord::new(s.tenant_id, input, s.created_at).unwrap();
    assert!(
        p.validate_event(&bad, &e, SnapshotUsage::Research, Utc::now())
            .is_err()
    );
    let mut input = s.input();
    input.license_label = "label-alone".into();
    let bad = DataSnapshotRecord::new(s.tenant_id, input, s.created_at).unwrap();
    assert!(
        p.validate_event(&bad, &e, SnapshotUsage::Research, Utc::now())
            .is_err()
    );
    let mut input = s.input();
    input.quality = SnapshotQuality::Degraded;
    let degraded = DataSnapshotRecord::new(s.tenant_id, input, s.created_at).unwrap();
    let mut event = e.clone();
    event["quality"] = json!("degraded");
    assert!(
        p.validate_event(&degraded, &event, SnapshotUsage::Research, Utc::now())
            .is_ok()
    );
    let mut input = s.input();
    input.sources[0].source_id = e["source_tick_id"].as_str().unwrap().into();
    let tick = DataSnapshotRecord::new(s.tenant_id, input, s.created_at).unwrap();
    assert!(
        p.validate_event(&tick, &e, SnapshotUsage::Research, Utc::now())
            .is_ok()
    );
}
#[test]
fn revoked_expired_ambiguous_or_empty_approvals_never_authorize() {
    let (a, s, e) = fixture();
    for change in 0..3 {
        let mut a = a.clone();
        match change {
            0 => a.enabled = false,
            1 => a.expires_at = Utc::now() - Duration::seconds(1),
            _ => a.tenant_id = TenantId::new(),
        };
        assert!(
            SnapshotSourcePolicy::new(vec![a])
                .unwrap()
                .validate_event(&s, &e, SnapshotUsage::Research, Utc::now())
                .is_err()
        );
    }
    assert!(SnapshotSourcePolicy::new(vec![]).is_err());
    assert!(SnapshotSourcePolicy::new(vec![a.clone(); 1025]).is_err());
    assert!(SnapshotSourcePolicy::new(vec![a.clone(), a.clone()]).is_err());
    for field in 0..7 {
        let mut a = a.clone();
        match field {
            0 => a.provider.clear(),
            1 => a.dataset.clear(),
            2 => a.license_label.clear(),
            3 => a.approval_reference.clear(),
            4 => a.approval_version.clear(),
            5 => a.symbols.clear(),
            _ => a.allowed_usages.clear(),
        };
        assert!(SnapshotSourcePolicy::new(vec![a]).is_err());
    }
}
