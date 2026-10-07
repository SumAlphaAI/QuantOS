use chrono::{Duration as ChronoDuration, TimeZone, Utc};
use serde_json::json;

use super::{
    DataSnapshotInput, DataSnapshotRecord, InMemoryDataSnapshotCatalog, SnapshotArtifactRef,
    SnapshotError, SnapshotGateViolation, SnapshotLineageEntry, SnapshotQuality,
    SnapshotQualityFinding, SnapshotQualityGate, SnapshotQualityRuleset, SnapshotSourceRef,
    SnapshotUsage, SnapshotWindow, default_quality_rules,
};
use quantos_core::{ArtifactId, ContentHash, SchemaVersion, TenantId};

fn baseline_input() -> DataSnapshotInput {
    DataSnapshotInput {
        schema_name: "DataSnapshot".to_owned(),
        schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
        schema_entry_id: None,
        window: SnapshotWindow {
            start_at: Utc
                .with_ymd_and_hms(2026, 7, 31, 0, 0, 0)
                .single()
                .expect("valid timestamp"),
            end_at: Utc
                .with_ymd_and_hms(2026, 7, 31, 1, 0, 0)
                .single()
                .expect("valid timestamp"),
        },
        sources: vec![
            SnapshotSourceRef {
                source_id: "coinbase-btc".to_owned(),
                provider: "approved.coinbase.spot".to_owned(),
                dataset: "crypto.top_of_book.v1".to_owned(),
                license_label: "internal-approved".to_owned(),
            },
            SnapshotSourceRef {
                source_id: "binance-btc".to_owned(),
                provider: "approved.binance.spot".to_owned(),
                dataset: "crypto.top_of_book.v1".to_owned(),
                license_label: "internal-approved".to_owned(),
            },
        ],
        quality: SnapshotQuality::Passed,
        quality_findings: vec![SnapshotQualityFinding {
            code: "spread_within_expected_range".to_owned(),
            detail: "spread remains below threshold".to_owned(),
        }],
        license_label: "internal-approved".to_owned(),
        captured_at: Utc
            .with_ymd_and_hms(2026, 7, 31, 1, 0, 5)
            .single()
            .expect("valid timestamp"),
        max_age_secs: 30,
        symbols: vec!["ETHUSDT".to_owned(), "BTCUSDT".to_owned()],
        artifact_refs: vec![
            SnapshotArtifactRef {
                artifact_id: ArtifactId::new(),
                media_type: "application/json".to_owned(),
                content_hash: ContentHash::sha256_bytes(br#"{"kind":"a"}"#),
                storage_bucket: "quantos-artifacts".to_owned(),
                object_key: "tenant/example/artifacts/a".to_owned(),
            },
            SnapshotArtifactRef {
                artifact_id: ArtifactId::new(),
                media_type: "application/json".to_owned(),
                content_hash: ContentHash::sha256_bytes(br#"{"kind":"b"}"#),
                storage_bucket: "quantos-artifacts".to_owned(),
                object_key: "tenant/example/artifacts/b".to_owned(),
            },
        ],
        lineage: vec![
            SnapshotLineageEntry {
                lineage_kind: "market_event_range".to_owned(),
                reference: "market:BTCUSDT".to_owned(),
                details: json!({ "first_sequence": 1, "last_sequence": 100 }),
            },
            SnapshotLineageEntry {
                lineage_kind: "schema_registry".to_owned(),
                reference: "research/DataSnapshot/v1".to_owned(),
                details: json!({ "domain": "research" }),
            },
        ],
    }
}

#[test]
fn quality_and_usage_wire_values_round_trip_and_reject_unknown_values() {
    for (quality, wire) in [
        (SnapshotQuality::Pending, "pending"),
        (SnapshotQuality::Passed, "passed"),
        (SnapshotQuality::Degraded, "degraded"),
        (SnapshotQuality::Failed, "failed"),
    ] {
        assert_eq!(quality.as_str(), wire);
        assert_eq!(
            SnapshotQuality::parse(wire).expect("quality parses"),
            quality
        );
    }
    let quality_error = SnapshotQuality::parse("unknown").expect_err("unknown quality fails");
    assert_eq!(quality_error.machine_code(), "SNAPSHOT_INVALID_QUALITY");

    for (usage, wire) in [
        (SnapshotUsage::Research, "research"),
        (SnapshotUsage::Strategy, "strategy"),
        (SnapshotUsage::Trading, "trading"),
    ] {
        assert_eq!(usage.as_str(), wire);
        assert_eq!(SnapshotUsage::parse(wire).expect("usage parses"), usage);
    }
    let usage_error = SnapshotUsage::parse("unknown").expect_err("unknown usage fails");
    assert_eq!(usage_error.machine_code(), "SNAPSHOT_INVALID_USAGE");
}

#[test]
fn data_snapshot_hash_is_stable_for_equivalent_inputs() {
    let tenant_id = TenantId::new();
    let created_at = Utc
        .with_ymd_and_hms(2026, 7, 31, 1, 0, 10)
        .single()
        .expect("valid timestamp");
    let original = baseline_input();
    let first =
        DataSnapshotRecord::new(tenant_id, original.clone(), created_at).expect("snapshot builds");

    let mut reordered = original;
    reordered.sources.reverse();
    reordered.symbols.reverse();
    reordered.artifact_refs.reverse();
    reordered.lineage.reverse();
    let second =
        DataSnapshotRecord::new(tenant_id, reordered, created_at).expect("snapshot builds");

    assert_eq!(first.content_hash, second.content_hash);

    let mut catalog = InMemoryDataSnapshotCatalog::new();
    let stored_first = catalog.upsert(first).unwrap().clone();
    let stored_second = catalog.upsert(second).unwrap().clone();
    assert_eq!(stored_first.snapshot_id, stored_second.snapshot_id);
}

#[test]
fn data_snapshot_rejects_invalid_window_age_and_schema() {
    let tenant_id = TenantId::new();
    let created_at = Utc
        .with_ymd_and_hms(2026, 7, 31, 1, 0, 10)
        .single()
        .expect("valid timestamp");

    let mut invalid_window = baseline_input();
    invalid_window.window.end_at = invalid_window.window.start_at - ChronoDuration::seconds(1);
    assert!(matches!(
        DataSnapshotRecord::new(tenant_id, invalid_window, created_at),
        Err(SnapshotError::InvalidWindow)
    ));

    let mut invalid_age = baseline_input();
    invalid_age.max_age_secs = -1;
    assert!(matches!(
        DataSnapshotRecord::new(tenant_id, invalid_age, created_at),
        Err(SnapshotError::InvalidMaxAge { max_age_secs: -1 })
    ));

    let mut invalid_schema = baseline_input();
    invalid_schema.schema_name = "  ".to_owned();
    assert!(matches!(
        DataSnapshotRecord::new(tenant_id, invalid_schema, created_at),
        Err(SnapshotError::InvalidSchemaName)
    ));
}

#[test]
fn strategy_and_trading_gates_reject_three_hundred_invalid_fixtures() {
    let tenant_id = TenantId::new();
    let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(
        tenant_id,
        Utc.with_ymd_and_hms(2026, 7, 31, 1, 0, 0)
            .single()
            .expect("valid timestamp"),
    ))
    .expect("valid snapshot rules");

    for index in 0..300 {
        let mut input = baseline_input();
        if index < 100 {
            input.captured_at = input.window.end_at;
            input.max_age_secs = 1;
        } else if index < 200 {
            input.quality = SnapshotQuality::Failed;
        } else {
            input.license_label.clear();
        }

        let snapshot = DataSnapshotRecord::new(
            tenant_id,
            input,
            Utc.with_ymd_and_hms(2026, 7, 31, 1, 0, 30)
                .single()
                .expect("valid timestamp"),
        )
        .expect("snapshot builds");
        let observed_at = if index < 100 {
            snapshot.expires_at + ChronoDuration::seconds(1)
        } else {
            snapshot.captured_at
        };

        for usage in [SnapshotUsage::Strategy, SnapshotUsage::Trading] {
            let decision = SnapshotQualityGate::evaluate(&snapshot, usage, observed_at, &rules);
            assert!(
                !decision.allowed,
                "fixture {index} should be rejected for {usage:?}"
            );
            if index < 100 {
                assert!(
                    decision
                        .violations
                        .contains(&SnapshotGateViolation::Expired)
                );
            } else if index < 200 {
                assert!(decision.violations.contains(
                    &SnapshotGateViolation::QualityInsufficient {
                        quality: SnapshotQuality::Failed,
                    },
                ));
            } else {
                assert!(
                    decision
                        .violations
                        .contains(&SnapshotGateViolation::LicenseMissing)
                );
            }
        }
    }
}

#[test]
fn optional_license_rule_is_research_only() {
    let tenant = TenantId::new();
    let mut input = baseline_input();
    input.license_label.clear();
    for source in &mut input.sources {
        source.license_label.clear();
    }
    let observed = input.captured_at;
    let snapshot = DataSnapshotRecord::new(tenant, input, observed).unwrap();
    let mut rules = default_quality_rules(tenant, observed);
    rules[0].require_license = false;
    let research = SnapshotQualityRuleset::from_rules(rules.clone()).unwrap();
    assert!(
        SnapshotQualityGate::evaluate(&snapshot, SnapshotUsage::Research, observed, &research)
            .allowed
    );
    for rule in &mut rules {
        rule.require_license = false;
    }
    assert!(SnapshotQualityRuleset::from_rules(rules).is_err());
}

#[test]
fn research_gate_allows_degraded_non_expired_snapshots() {
    let tenant_id = TenantId::new();
    let mut input = baseline_input();
    input.quality = SnapshotQuality::Degraded;
    let snapshot = DataSnapshotRecord::new(
        tenant_id,
        input,
        Utc.with_ymd_and_hms(2026, 7, 31, 1, 0, 10)
            .single()
            .expect("valid timestamp"),
    )
    .expect("snapshot builds");
    let rules =
        SnapshotQualityRuleset::from_rules(default_quality_rules(tenant_id, snapshot.created_at))
            .expect("valid snapshot rules");

    let decision = SnapshotQualityGate::evaluate(
        &snapshot,
        SnapshotUsage::Research,
        snapshot.captured_at,
        &rules,
    );
    assert!(decision.allowed);
}

#[test]
fn snapshot_gate_fails_closed_for_cross_tenant_rules_and_incomplete_lineage() {
    let tenant_id = TenantId::new();
    let other_tenant_id = TenantId::new();
    let now = Utc
        .with_ymd_and_hms(2026, 7, 31, 1, 0, 10)
        .single()
        .expect("valid timestamp");
    let snapshot =
        DataSnapshotRecord::new(tenant_id, baseline_input(), now).expect("snapshot builds");
    let cross_tenant_rules =
        SnapshotQualityRuleset::from_rules(default_quality_rules(other_tenant_id, now))
            .expect("valid snapshot rules");
    let cross_tenant = SnapshotQualityGate::evaluate(
        &snapshot,
        SnapshotUsage::Trading,
        snapshot.captured_at,
        &cross_tenant_rules,
    );
    assert_eq!(
        cross_tenant.violations,
        vec![SnapshotGateViolation::RuleMissing {
            usage: SnapshotUsage::Trading,
        }]
    );

    let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(tenant_id, now))
        .expect("valid snapshot rules");
    for (field, mutate) in [
        (
            "sources",
            (|input: &mut DataSnapshotInput| input.sources.clear()) as fn(&mut DataSnapshotInput),
        ),
        (
            "source_license",
            (|input: &mut DataSnapshotInput| input.sources[0].license_label.clear())
                as fn(&mut DataSnapshotInput),
        ),
        (
            "lineage",
            (|input: &mut DataSnapshotInput| input.lineage.clear()) as fn(&mut DataSnapshotInput),
        ),
    ] {
        let mut input = baseline_input();
        mutate(&mut input);
        let incomplete = DataSnapshotRecord::new(tenant_id, input, now)
            .expect("incomplete snapshot remains inspectable");
        let decision = SnapshotQualityGate::evaluate(
            &incomplete,
            SnapshotUsage::Trading,
            incomplete.captured_at,
            &rules,
        );
        assert!(
            decision
                .violations
                .contains(&SnapshotGateViolation::MetadataIncomplete { field })
        );
    }
}

#[test]
fn regression_forged_wire_hash_quality_and_expiry_are_rejected() {
    let input = baseline_input();
    let now = input.captured_at;
    let snapshot = DataSnapshotRecord::new(TenantId::new(), input, now).unwrap();
    for field in [
        "quality",
        "content_hash",
        "expires_at",
        "max_age_secs",
        "captured_at",
        "window",
    ] {
        let mut forged = serde_json::to_value(&snapshot).unwrap();
        forged[field] = match field {
            "quality" => json!("failed"),
            "content_hash" => json!(ContentHash::sha256_bytes(b"forged")),
            "expires_at" => json!(now + ChronoDuration::days(30)),
            "max_age_secs" => json!(123),
            "captured_at" => json!(now + ChronoDuration::days(1)),
            _ => json!({"start_at":now,"end_at":now+ChronoDuration::days(1)}),
        };
        assert!(
            serde_json::from_value::<DataSnapshotRecord>(forged).is_err(),
            "forgery {field}"
        );
    }
    let roundtrip: DataSnapshotRecord =
        serde_json::from_value(serde_json::to_value(&snapshot).unwrap()).unwrap();
    assert_eq!(roundtrip, snapshot);
}

#[test]
fn regression_future_capture_window_and_overflow_are_errors() {
    let input = baseline_input();
    let now = input.captured_at;
    for age in [
        -1,
        i64::MAX,
        9_000_000_000_000,
        super::MAX_SNAPSHOT_AGE_SECS + 1,
    ] {
        let mut bad = input.clone();
        bad.max_age_secs = age;
        assert!(DataSnapshotRecord::new(TenantId::new(), bad, now).is_err());
    }
    let mut future = input.clone();
    future.captured_at = now + ChronoDuration::days(365);
    assert!(DataSnapshotRecord::new(TenantId::new(), future, now).is_err());
    let mut window = input.clone();
    window.window.end_at = now + ChronoDuration::seconds(1);
    assert!(DataSnapshotRecord::new(TenantId::new(), window, now).is_err());
    let snapshot = DataSnapshotRecord::new(TenantId::new(), input, now).unwrap();
    let rules =
        SnapshotQualityRuleset::from_rules(default_quality_rules(snapshot.tenant_id, now)).unwrap();
    assert!(
        !SnapshotQualityGate::evaluate(
            &snapshot,
            SnapshotUsage::Trading,
            now - ChronoDuration::seconds(1),
            &rules
        )
        .allowed
    );
}

#[test]
fn regression_strict_floor_duplicate_and_mixed_tenant_rules_reject() {
    let t = TenantId::new();
    let now = baseline_input().captured_at;
    for usage in [SnapshotUsage::Strategy, SnapshotUsage::Trading] {
        for flag in 0..5 {
            let mut rule = super::SnapshotQualityRule::default_for_usage(t, usage, now);
            match flag {
                0 => rule.allow_pending = true,
                1 => rule.allow_degraded = true,
                2 => rule.allow_failed = true,
                3 => rule.require_license = false,
                _ => rule.require_freshness = false,
            };
            assert!(SnapshotQualityRuleset::from_rules([rule]).is_err());
        }
    }
    let rule = super::SnapshotQualityRule::default_for_usage(t, SnapshotUsage::Research, now);
    let mut relaxed = rule.clone();
    relaxed.require_freshness = true;
    for rules in [vec![rule.clone(), relaxed.clone()], vec![relaxed, rule]] {
        assert!(SnapshotQualityRuleset::from_rules(rules).is_err());
    }
    let mut mixed = default_quality_rules(t, now);
    mixed[1].tenant_id = TenantId::new();
    assert!(SnapshotQualityRuleset::from_rules(mixed).is_err());
    assert!(
        SnapshotQualityRuleset::from_rules([])
            .unwrap()
            .rule_for(SnapshotUsage::Trading)
            .is_none()
    );
}

#[test]
fn regression_metadata_source_age_and_input_budget_reject() {
    let baseline = baseline_input();
    let now = baseline.captured_at;
    let t = TenantId::new();
    let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(t, now)).unwrap();
    for mutate in [
        (|i: &mut DataSnapshotInput| i.sources[0].provider.clear()) as fn(&mut DataSnapshotInput),
        |i| i.sources[0].source_id.clear(),
        |i| i.sources[0].dataset.clear(),
        |i| i.lineage[0].reference.clear(),
        |i| i.lineage[0].details = json!(null),
        |i| i.symbols.clear(),
        |i| i.artifact_refs.clear(),
        |i| i.artifact_refs[0].object_key.clear(),
    ] {
        let mut input = baseline.clone();
        mutate(&mut input);
        let snapshot = DataSnapshotRecord::new(t, input, now).unwrap();
        assert!(
            !SnapshotQualityGate::evaluate(&snapshot, SnapshotUsage::Trading, now, &rules).allowed
        );
    }
    let mut stale = baseline.clone();
    stale.window.end_at = now - ChronoDuration::seconds(31);
    let snapshot = DataSnapshotRecord::new(t, stale, now).unwrap();
    assert!(!SnapshotQualityGate::evaluate(&snapshot, SnapshotUsage::Trading, now, &rules).allowed);
    let mut unknown = baseline.clone();
    unknown.schema_name = "Unknown".into();
    assert!(DataSnapshotRecord::new(t, unknown, now).is_err());
    let mut huge = baseline.clone();
    huge.symbols = vec!["BTCUSDT".into(); super::MAX_SNAPSHOT_ITEMS + 1];
    assert!(DataSnapshotRecord::new(t, huge, now).is_err());
    let mut bytes = baseline.clone();
    bytes.lineage[0].details = json!({"huge":"x".repeat(super::MAX_SNAPSHOT_BYTES)});
    assert!(DataSnapshotRecord::new(t, bytes, now).is_err());
    let mut boundary = baseline;
    boundary.captured_at = boundary.window.end_at;
    let s = DataSnapshotRecord::new(t, boundary, now).unwrap();
    assert!(
        SnapshotQualityGate::evaluate(&s, SnapshotUsage::Trading, s.expires_at, &rules).allowed
    );
    assert!(
        !SnapshotQualityGate::evaluate(
            &s,
            SnapshotUsage::Trading,
            s.expires_at + ChronoDuration::nanoseconds(1),
            &rules
        )
        .allowed
    );
}
