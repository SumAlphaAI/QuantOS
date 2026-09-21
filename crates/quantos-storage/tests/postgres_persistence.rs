use std::{collections::BTreeMap, env, time::Instant};

use chrono::Utc;
use native_tls::TlsConnector;
use postgres::{Client, NoTls, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{ContentHash, SchemaVersion, TenantId};
use quantos_storage::{
    ArtifactManifest, DataSnapshotInput, DataSnapshotRecord, SnapshotArtifactRef,
    SnapshotLineageEntry, SnapshotQuality, SnapshotSourceRef, SnapshotWindow,
    default_quality_rules, pg::PgStorageStore,
};
use serde_json::json;
use url::Url;

struct TenantCleanup {
    database_url: String,
    tenant_id: TenantId,
}

impl Drop for TenantCleanup {
    fn drop(&mut self) {
        if let Ok(mut client) = connect_client(&self.database_url) {
            let _ = client.execute_typed(
                "delete from quantos.tenants where id = $1",
                &[(self.tenant_id.as_uuid(), Type::UUID)],
            );
        }
    }
}

#[test]
fn postgres_storage_store_persists_artifacts_and_schema_registry() {
    let explicitly_required = [
        "QUANTOS_RUN_R02_POSTGRES_TESTS",
        "QUANTOS_RUN_F05_POSTGRES_TESTS",
    ]
    .iter()
    .any(|name| env::var(name).ok().as_deref() == Some("1"));
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        assert!(
            !explicitly_required,
            "DATABASE_URL is required when a PostgreSQL acceptance Gate is enabled"
        );
        eprintln!("skipping live PostgreSQL test: DATABASE_URL is not set");
        return;
    };

    let tenant_id = TenantId::new();
    let _cleanup = seed_tenant(&database_url, tenant_id);
    let mut store = PgStorageStore::connect(&database_url).expect("connects to PostgreSQL");

    let hash = ContentHash::sha256_bytes(br#"{"artifact":"payload"}"#);
    let mut manifest = ArtifactManifest::new(
        tenant_id,
        "application/json",
        hash.clone(),
        "quantos-artifacts",
        22,
        Utc::now(),
    );
    manifest.metadata = BTreeMap::from([("source".to_owned(), "integration-test".to_owned())]);

    let persisted = store.upsert_artifact(&manifest).expect("artifact persists");
    let persisted_again = store
        .upsert_artifact(&manifest)
        .expect("artifact upsert deduplicates");
    assert_eq!(persisted.artifact_id, persisted_again.artifact_id);

    let fetched = store
        .find_artifact_by_hash(tenant_id, &hash)
        .expect("artifact query succeeds")
        .expect("artifact exists");
    assert_eq!(fetched.object_key, persisted.object_key);
    assert_eq!(fetched.metadata["source"], "integration-test");

    let schema_version = SchemaVersion::parse("v1").expect("schema version parses");
    let registered = store
        .register_schema(
            tenant_id,
            "events",
            "TradeCommand",
            &schema_version,
            &json!({
                "type": "object",
                "required": ["tenant_id", "correlation_id"]
            }),
            Utc::now(),
        )
        .expect("schema registers");
    let fetched_schema = store
        .get_schema(tenant_id, "events", "TradeCommand", &schema_version)
        .expect("schema query succeeds")
        .expect("schema exists");
    assert_eq!(registered.schema_entry_id, fetched_schema.schema_entry_id);
    assert_eq!(registered.content_hash, fetched_schema.content_hash);

    for rule in default_quality_rules(tenant_id, Utc::now()) {
        store
            .upsert_snapshot_quality_rule(&rule)
            .expect("quality rule persists");
    }
    let rules = store
        .list_snapshot_quality_rules(tenant_id)
        .expect("quality rule query succeeds");
    assert_eq!(rules.len(), 3);

    let snapshot = DataSnapshotRecord::new(
        tenant_id,
        DataSnapshotInput {
            schema_name: "DataSnapshot".to_owned(),
            schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
            schema_entry_id: Some(registered.schema_entry_id),
            window: SnapshotWindow {
                start_at: Utc::now() - chrono::Duration::minutes(5),
                end_at: Utc::now(),
            },
            sources: vec![SnapshotSourceRef {
                source_id: "approved.binance.spot:BTCUSDT".to_owned(),
                provider: "approved.binance.spot".to_owned(),
                dataset: "crypto.top_of_book.v1".to_owned(),
                license_label: "internal-approved".to_owned(),
            }],
            quality: SnapshotQuality::Passed,
            quality_findings: vec![],
            license_label: "internal-approved".to_owned(),
            captured_at: Utc::now(),
            max_age_secs: 120,
            symbols: vec!["BTCUSDT".to_owned(), "ETHUSDT".to_owned()],
            artifact_refs: vec![SnapshotArtifactRef {
                artifact_id: persisted.artifact_id,
                media_type: persisted.media_type.clone(),
                content_hash: persisted.content_hash.clone(),
                storage_bucket: persisted.storage_bucket.clone(),
                object_key: persisted.object_key.clone(),
            }],
            lineage: vec![SnapshotLineageEntry {
                lineage_kind: "market_event_range".to_owned(),
                reference: "market:BTCUSDT".to_owned(),
                details: json!({ "from_sequence": 1, "to_sequence": 100 }),
            }],
        },
        Utc::now(),
    )
    .expect("snapshot builds");
    let persisted_snapshot = store
        .upsert_data_snapshot(&snapshot)
        .expect("snapshot persists");
    let persisted_snapshot_again = store
        .upsert_data_snapshot(&snapshot)
        .expect("snapshot deduplicates by hash");
    assert_eq!(
        persisted_snapshot.snapshot_id,
        persisted_snapshot_again.snapshot_id
    );

    let fetched_snapshot = store
        .get_data_snapshot(tenant_id, persisted_snapshot.snapshot_id)
        .expect("snapshot query succeeds")
        .expect("snapshot exists");
    assert_eq!(
        fetched_snapshot.content_hash,
        persisted_snapshot.content_hash
    );

    let fetched_by_hash = store
        .find_data_snapshot_by_hash(tenant_id, &persisted_snapshot.content_hash)
        .expect("snapshot hash query succeeds")
        .expect("snapshot exists by hash");
    assert_eq!(fetched_by_hash.snapshot_id, persisted_snapshot.snapshot_id);

    let listed = store
        .list_data_snapshots_for_symbol(tenant_id, "BTCUSDT", 5)
        .expect("snapshot symbol query succeeds");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].snapshot_id, persisted_snapshot.snapshot_id);

    let mut samples = Vec::new();
    for _ in 0..25 {
        let started_at = Instant::now();
        let _ = store
            .get_data_snapshot(tenant_id, persisted_snapshot.snapshot_id)
            .expect("snapshot query succeeds");
        samples.push(started_at.elapsed());
    }
    samples.sort();
    let p95 = samples[(samples.len() * 95 / 100).min(samples.len() - 1)];
    assert!(
        p95.as_millis() < 300,
        "snapshot get_data_snapshot p95 must stay under 300ms, got {}ms",
        p95.as_millis()
    );
}

fn seed_tenant(database_url: &str, tenant_id: TenantId) -> TenantCleanup {
    let mut client = connect_client(database_url).expect("connects for setup");
    let slug = format!("f05-storage-{}", tenant_id);
    client
        .execute_typed(
            "insert into quantos.tenants (id, slug, name) values ($1, $2, $3)
             on conflict (id) do nothing",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&slug, Type::TEXT),
                (&slug, Type::TEXT),
            ],
        )
        .expect("tenant inserts");

    TenantCleanup {
        database_url: database_url.to_owned(),
        tenant_id,
    }
}

fn connect_client(database_url: &str) -> Result<Client, postgres::Error> {
    let url = Url::parse(database_url).expect("database URL parses");
    let disable_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "disable");
    let relaxed_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && (value == "require" || value == "prefer"));

    if disable_tls {
        Client::connect(database_url, NoTls)
    } else {
        let mut builder = TlsConnector::builder();
        if relaxed_tls {
            builder.danger_accept_invalid_certs(true);
        }
        let connector = builder.build().expect("TLS connector builds");
        Client::connect(database_url, MakeTlsConnector::new(connector))
    }
}
