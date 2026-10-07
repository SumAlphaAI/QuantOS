//! Audit-only probes: passing assertions reproduce defects, not acceptance.
use chrono::{Duration, TimeZone, Utc};
use quantos_core::{ArtifactId, ContentHash, SchemaVersion, TenantId};
use quantos_storage::*;
use serde_json::json;
fn input() -> DataSnapshotInput {
    let now = Utc.with_ymd_and_hms(2026, 10, 7, 0, 0, 0).unwrap();
    DataSnapshotInput {
        schema_name: "DataSnapshot".into(), schema_version: SchemaVersion::parse("v1").unwrap(), schema_entry_id: None,
        window: SnapshotWindow { start_at: now - Duration::minutes(1), end_at: now },
        sources: vec![SnapshotSourceRef { source_id:"fixture:1".into(), provider:"fixture:provider".into(), dataset:"fixture:dataset".into(), license_label:"fixture-only".into() }],
        quality:SnapshotQuality::Passed, quality_findings:vec![], license_label:"fixture-only".into(), captured_at:now,max_age_secs:120,
        symbols:vec!["BTC/USDT".into()], artifact_refs:vec![SnapshotArtifactRef {artifact_id:ArtifactId::new(),media_type:"application/json".into(), content_hash:ContentHash::sha256_bytes(b"fixture"), storage_bucket:"fixture".into(),object_key:"fixture/object".into()}],
        lineage:vec![SnapshotLineageEntry{lineage_kind:"market_event_range".into(),reference:"fixture:range".into(),details:json!({"from":1,"to":1})}]
    }
}
fn allowed(s:&DataSnapshotRecord, observed:chrono::DateTime<Utc>) -> bool {
    let r=SnapshotQualityRuleset::from_rules(default_quality_rules(s.tenant_id,observed));
    [SnapshotUsage::Strategy,SnapshotUsage::Trading].into_iter().all(|u|SnapshotQualityGate::evaluate(s,u,observed,&r).allowed)
}
#[test]
fn mutable_record_keeps_hash_and_passes_gate_after_quality_and_expiry_rewrite() {
    let mut i=input();let now=i.captured_at;i.quality=SnapshotQuality::Failed;i.max_age_secs=0;
    let mut s=DataSnapshotRecord::new(TenantId::new(),i,now).unwrap();let hash=s.content_hash.clone();
    assert!(!allowed(&s,now+Duration::minutes(5)));
    s.quality=SnapshotQuality::Passed;s.expires_at=now+Duration::days(365);
    assert_eq!(s.content_hash,hash);assert!(allowed(&s,now+Duration::minutes(5)));
    let decoded:DataSnapshotRecord=serde_json::from_value(serde_json::to_value(s).unwrap()).unwrap();
    assert!(allowed(&decoded,now+Duration::minutes(5)));
    println!("AUDIT_DEFECT forged quality/expiry with unchanged hash accepted through public and serde boundary");
}
#[test]
fn future_capture_and_future_window_are_accepted() {
    let mut i=input();let now=i.captured_at;i.captured_at=now+Duration::days(365);i.window.end_at=i.captured_at;
    let s=DataSnapshotRecord::new(TenantId::new(),i,now).unwrap();assert!(allowed(&s,now));
    println!("AUDIT_DEFECT future capture/window accepted as fresh");
}
#[test]
fn window_after_capture_is_accepted() {
    let mut i=input();let now=i.captured_at;i.window.end_at=now+Duration::days(2);
    let s=DataSnapshotRecord::new(TenantId::new(),i,now).unwrap();assert!(allowed(&s,now));
    println!("AUDIT_DEFECT window end after capture accepted");
}
#[test]
fn blank_source_and_lineage_fields_are_accepted() {
    let mut i=input();let now=i.captured_at;i.sources[0].source_id.clear();i.sources[0].provider.clear();i.sources[0].dataset.clear();
    i.lineage=vec![SnapshotLineageEntry{lineage_kind:String::new(),reference:String::new(),details:json!(null)}];
    let s=DataSnapshotRecord::new(TenantId::new(),i,now).unwrap();assert!(allowed(&s,now));
    println!("AUDIT_DEFECT blank source identifiers and empty lineage element accepted");
}
#[test]
fn absent_artifacts_symbols_and_unknown_schema_are_accepted() {
    let mut i=input();let now=i.captured_at;i.artifact_refs.clear();i.symbols.clear();i.schema_name="not-a-registered-contract".into();
    let s=DataSnapshotRecord::new(TenantId::new(),i,now).unwrap();assert!(allowed(&s,now));
    println!("AUDIT_DEFECT no payload reference/symbols and unknown schema accepted");
}
#[test]
fn permissive_strategy_trading_rules_disable_three_required_rejections() {
    let mut i=input();let now=i.captured_at;i.quality=SnapshotQuality::Failed;i.max_age_secs=0;i.license_label.clear();i.sources[0].license_label.clear();
    let s=DataSnapshotRecord::new(TenantId::new(),i,now).unwrap();let observed=now+Duration::minutes(10);
    assert!(!allowed(&s,observed));
    let r=SnapshotQualityRuleset::from_rules(default_quality_rules(s.tenant_id,now).into_iter().map(|mut r|{r.allow_failed=true;r.require_license=false;r.require_freshness=false;r}));
    for u in [SnapshotUsage::Strategy,SnapshotUsage::Trading]{assert!(SnapshotQualityGate::evaluate(&s,u,observed,&r).allowed);}
    println!("AUDIT_DEFECT failed/expired/unlicensed snapshot allowed by permissive strategy/trading rules");
}
#[test]
fn duplicate_rules_silently_replace_strict_policy() {
    let i=input();let now=i.captured_at;let s=DataSnapshotRecord::new(TenantId::new(),i,now).unwrap();
    let strict=SnapshotQualityRule::default_for_usage(s.tenant_id,SnapshotUsage::Trading,now);let mut relaxed=strict.clone();relaxed.require_freshness=false;
    let r=SnapshotQualityRuleset::from_rules([strict.clone(),relaxed.clone()]);
    assert!(SnapshotQualityGate::evaluate(&s,SnapshotUsage::Trading,now+Duration::days(1),&r).allowed);
    let r=SnapshotQualityRuleset::from_rules([relaxed,strict]);assert!(!SnapshotQualityGate::evaluate(&s,SnapshotUsage::Trading,now+Duration::days(1),&r).allowed);
    println!("AUDIT_DEFECT duplicate rules depend on input order and silently relax freshness");
}
#[test]
fn extreme_max_age_panics_in_result_returning_constructor() {
    for age in [i64::MAX, 9_000_000_000_000] {
        let mut i=input();let now=i.captured_at;i.max_age_secs=age;
        assert!(std::panic::catch_unwind(||DataSnapshotRecord::new(TenantId::new(),i,now)).is_err());
    }
    println!("AUDIT_DEFECT positive max_age can panic instead of returning SnapshotError");
}
#[test]
fn expiry_boundary_is_inclusive() {
    let i=input();let now=i.captured_at;let s=DataSnapshotRecord::new(TenantId::new(),i,now).unwrap();
    assert!(allowed(&s,s.expires_at));assert!(!allowed(&s,s.expires_at+Duration::nanoseconds(1)));
    println!("AUDIT_OBSERVATION expiry remains valid at exact expires_at; boundary semantics require specification");
}
