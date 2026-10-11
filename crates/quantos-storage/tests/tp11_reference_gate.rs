//! Owned offline fixtures exercise the actual F05 gate, without database access.
use chrono::{DateTime, Duration, Utc};
use quantos_core::{ArtifactId, ContentHash, SchemaVersion, TenantId, canonical_json_bytes};
use quantos_storage::{
    DataSnapshotInput, DataSnapshotRecord, SnapshotArtifactRef, SnapshotLineageEntry,
    SnapshotQuality, SnapshotQualityGate, SnapshotQualityRuleset, SnapshotSourceRef, SnapshotUsage,
    SnapshotWindow, default_quality_rules,
};
use serde_json::{Value, json};

fn fixture(kind: &str) -> Value {
    serde_json::from_str(match kind {
        "quote" => include_str!(
            "../../../third_party/openstock/fixtures/01-finnhub-quote-to-data-contract.json"
        ),
        "news" => include_str!(
            "../../../third_party/openstock/fixtures/02-finnhub-news-and-widget-rejection.json"
        ),
        "widget" => {
            include_str!("../../../third_party/openstock/fixtures/03-tradingview-display-only.json")
        }
        _ => panic!("unknown fixture"),
    })
    .expect("owned fixture JSON")
}

fn observed() -> DateTime<Utc> {
    "2026-10-11T00:00:00Z".parse().expect("fixed time")
}

fn input(kind: &str) -> DataSnapshotInput {
    let doc = fixture(kind);
    let stamp = if kind == "widget" {
        observed()
    } else {
        let key = if kind == "quote" { "t" } else { "datetime" };
        DateTime::from_timestamp(
            doc["records"][0][key]
                .as_str()
                .expect("timestamp")
                .parse()
                .expect("seconds"),
            0,
        )
        .expect("valid timestamp")
    };
    let hash = ContentHash::sha256_bytes(
        &canonical_json_bytes(&doc["records"]).expect("canonical records"),
    );
    DataSnapshotInput {
        schema_name: "DataSnapshot".into(),
        schema_version: SchemaVersion::parse("v1").expect("schema"),
        schema_entry_id: None,
        window: SnapshotWindow {
            start_at: stamp,
            end_at: stamp,
        },
        sources: vec![SnapshotSourceRef {
            source_id: "quantos-synthetic".into(),
            provider: "quantos-offline-fixture".into(),
            dataset: format!("tp11.synthetic.{kind}"),
            license_label: doc["data_license"].as_str().unwrap_or("").into(),
        }],
        quality: SnapshotQuality::parse(doc["quality"]["status"].as_str().expect("quality"))
            .expect("known quality"),
        quality_findings: vec![],
        license_label: doc["data_license"].as_str().unwrap_or("").into(),
        captured_at: observed(),
        max_age_secs: 3600,
        symbols: vec!["SYNTH-A".into()],
        artifact_refs: vec![SnapshotArtifactRef {
            artifact_id: ArtifactId::new(),
            media_type: "application/json".into(),
            content_hash: hash,
            storage_bucket: "offline-fixture-only".into(),
            object_key: format!("synthetic/{kind}"),
        }],
        lineage: vec![SnapshotLineageEntry {
            lineage_kind: "owned-provider-fixture".into(),
            reference: doc["fixture_hash"].as_str().expect("hash").into(),
            details: json!({"providerReference": doc["provider"], "runtimeAdmission": "DENIED"}),
        }],
    }
}

#[test]
fn actual_f05_gate_matrix_preserves_license_quality_and_freshness_rules() {
    let tenant = TenantId::new();
    let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(tenant, observed()))
        .expect("default rules");
    let mut results = vec![];
    for kind in ["quote", "news", "widget"] {
        for mutation in [
            "baseline",
            "missing_license",
            "missing_source_license",
            "missing_sources",
            "missing_lineage",
            "failed_quality",
            "expired",
        ] {
            let mut candidate = input(kind);
            match mutation {
                "missing_license" => candidate.license_label.clear(),
                "missing_source_license" => candidate.sources[0].license_label.clear(),
                "missing_sources" => candidate.sources.clear(),
                "missing_lineage" => candidate.lineage.clear(),
                "failed_quality" => candidate.quality = SnapshotQuality::Failed,
                "expired" => candidate.max_age_secs = 0,
                _ => (),
            }
            let snapshot = DataSnapshotRecord::new(tenant, candidate, observed())
                .expect("structural snapshot");
            for usage in [
                SnapshotUsage::Research,
                SnapshotUsage::Strategy,
                SnapshotUsage::Trading,
            ] {
                let now = if mutation == "expired" {
                    observed() + Duration::seconds(3601)
                } else {
                    observed()
                };
                let decision = SnapshotQualityGate::evaluate(&snapshot, usage, now, &rules);
                let expected = kind != "widget"
                    && match mutation {
                        "baseline" => kind == "news" || usage == SnapshotUsage::Research,
                        "expired" => usage == SnapshotUsage::Research,
                        _ => false,
                    };
                assert_eq!(decision.allowed, expected, "{kind}/{mutation}/{usage:?}");
                // TP11's intake separately denies strategy/trading, including fresh, structurally valid news.
                let effective =
                    decision.allowed && kind != "widget" && usage == SnapshotUsage::Research;
                results.push(json!({"kind":kind,"mutation":mutation,"usage":usage.as_str(),"f05Allowed":decision.allowed,"referenceIntakeAllowed":usage == SnapshotUsage::Research && kind != "widget", "effectiveAllowed":effective,"violations":format!("{:?}",decision.violations)}));
            }
        }
    }
    assert_eq!(results.len(), 63);
    println!(
        "TP11_F05_GATE={}",
        json!({"schema":"quantos-tp11-f05-offline-matrix/v1","formalAccepted":false,"databaseExecuted":false,"cases":results})
    );
}

#[test]
fn f05_label_presence_is_not_a_data_rights_registry() {
    let tenant = TenantId::new();
    let rules = SnapshotQualityRuleset::from_rules(default_quality_rules(tenant, observed()))
        .expect("rules");
    let mut candidate = input("news");
    candidate.license_label = "unverified-provider-claim".into();
    candidate.sources[0].license_label = "unverified-provider-claim".into();
    let snapshot =
        DataSnapshotRecord::new(tenant, candidate, observed()).expect("structural input");
    assert!(
        SnapshotQualityGate::evaluate(&snapshot, SnapshotUsage::Research, observed(), &rules)
            .allowed
    );
    // The Python intake rejects this label before constructing a usable reference snapshot.
}
