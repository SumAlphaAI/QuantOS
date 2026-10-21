use std::{collections::BTreeMap, env, time::Instant};

use chrono::Utc;
use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use postgres::{Client, NoTls, types::Type};
use postgres_openssl::MakeTlsConnector;
use quantos_core::{ContentHash, SchemaVersion, TenantId};
use quantos_storage::{
    ArtifactManifest, DataSnapshotInput, DataSnapshotRecord, SnapshotArtifactRef,
    SnapshotLineageEntry, SnapshotQuality, SnapshotSourceRef, SnapshotWindow,
    default_quality_rules,
    pg::{PgStorageStore, SnapshotWriteContext},
};
use serde_json::json;
use url::Url;

struct TenantCleanup {
    database_url: String,
    tenant_id: TenantId,
    actor_id: quantos_core::ActorId,
}

impl Drop for TenantCleanup {
    fn drop(&mut self) {
        if let Ok(mut client) = connect_client(&self.database_url) {
            let _ = client.execute_typed(
                "update quantos.actors set is_active=false where tenant_id=$1 and id=$2",
                &[
                    (self.tenant_id.as_uuid(), Type::UUID),
                    (self.actor_id.as_uuid(), Type::UUID),
                ],
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
    let cleanup = seed_tenant(&database_url, tenant_id);
    let context = SnapshotWriteContext {
        tenant_id,
        actor_id: cleanup.actor_id,
        correlation_id: quantos_core::CorrelationId::new(),
        causation_id: quantos_core::EventId::new(),
        reason: "owned integration fixture".into(),
    };
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
            "DataSnapshot",
            &schema_version,
            &json!({
                "type": "object",
                "required": ["tenant_id", "correlation_id"]
            }),
            Utc::now(),
        )
        .expect("schema registers");
    let fetched_schema = store
        .get_schema(tenant_id, "events", "DataSnapshot", &schema_version)
        .expect("schema query succeeds")
        .expect("schema exists");
    assert_eq!(registered.schema_entry_id, fetched_schema.schema_entry_id);
    assert_eq!(registered.content_hash, fetched_schema.content_hash);

    for rule in default_quality_rules(tenant_id, Utc::now()) {
        store
            .upsert_snapshot_quality_rule(&rule, &context)
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
                lineage_kind: "artifact".to_owned(),
                reference: persisted.artifact_id.to_string(),
                details: json!({ "from_sequence": 1, "to_sequence": 100 }),
            }],
        },
        Utc::now(),
    )
    .expect("snapshot builds");
    let persisted_snapshot = store
        .upsert_data_snapshot(&snapshot, &context)
        .expect("snapshot persists");
    let persisted_snapshot_again = store
        .upsert_data_snapshot(&snapshot, &context)
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

    // Read through a fresh adapter so database mapping, absence and tenant
    // isolation are tested rather than only the write-through cache.
    let mut cold = PgStorageStore::connect(&database_url).unwrap();
    assert!(
        cold.get_data_snapshot(tenant_id, persisted_snapshot.snapshot_id)
            .unwrap()
            .is_some()
    );
    let other = TenantId::new();
    assert!(
        cold.get_data_snapshot(other, persisted_snapshot.snapshot_id)
            .unwrap()
            .is_none()
    );
    assert!(
        cold.find_data_snapshot_by_hash(other, &persisted_snapshot.content_hash)
            .unwrap()
            .is_none()
    );
    assert!(cold.find_artifact_by_hash(other, &hash).unwrap().is_none());
    assert!(
        cold.get_schema(other, "events", "DataSnapshot", &schema_version)
            .unwrap()
            .is_none()
    );
    assert!(PgStorageStore::connect("invalid URL").is_err());
    let parsed = Url::parse(&database_url).unwrap();
    // Only exercise plaintext/TLS rejection on an explicitly plaintext loopback fixture.
    if matches!(parsed.host_str(), Some("127.0.0.1" | "localhost"))
        && parsed
            .query_pairs()
            .any(|(k, v)| k == "sslmode" && v == "disable")
    {
        for mode in [
            None,
            Some("disable"),
            Some("prefer"),
            Some("require"),
            Some("verify-full"),
        ] {
            let mut candidate = parsed.clone();
            candidate
                .query_pairs_mut()
                .clear()
                .append_pair("application_name", "f05-coverage");
            if let Some(mode) = mode {
                candidate.query_pairs_mut().append_pair("sslmode", mode);
            }
            let result = PgStorageStore::connect(candidate.as_str());
            assert_eq!(
                result.is_ok(),
                matches!(mode, Some("disable")),
                "Storage requires TLS unless plaintext is explicitly selected; mode {mode:?} must not downgrade"
            );
        }
    }

    verify_consumer_lineage(&database_url, &mut store, &snapshot, &context);

    // Development has already exercised all three functional queries above.
    // Repeated timing and the numerical threshold belong to RELEASE only.
    if env::var("QUANTOS_R02_RELEASE_PERFORMANCE").ok().as_deref() != Some("1") {
        eprintln!("R02_RELEASE_PERFORMANCE_NOT_RUN: development verifies functional reads only");
        return;
    }
    for path in ["id", "content_hash", "symbol_list"] {
        let mut samples = Vec::new();
        for _ in 0..25 {
            let started_at = Instant::now();
            match path {
                "id" => assert!(
                    store
                        .get_data_snapshot_uncached(tenant_id, persisted_snapshot.snapshot_id)
                        .unwrap()
                        .is_some()
                ),
                "content_hash" => assert!(
                    store
                        .find_data_snapshot_by_hash(tenant_id, &persisted_snapshot.content_hash)
                        .unwrap()
                        .is_some()
                ),
                _ => assert!(
                    !store
                        .list_data_snapshots_for_symbol(tenant_id, "BTCUSDT", 5)
                        .unwrap()
                        .is_empty()
                ),
            }
            samples.push(started_at.elapsed());
        }
        samples.sort();
        let p95 = samples[(samples.len() * 95).div_ceil(100) - 1];
        eprintln!(
            "R02_SQL_P95_BASELINE_MS={:.3} samples=25 path=uncached_sql operation={path} result_scope=one_snapshot list_limit=5",
            p95.as_secs_f64() * 1000.0
        );
        if env::var("QUANTOS_R02_RELEASE_PERFORMANCE").ok().as_deref() == Some("1") {
            assert!(
                p95.as_millis() < 300,
                "snapshot {path} p95 must stay under 300ms, got {}ms",
                p95.as_millis()
            );
        }
    }
}

fn seed_tenant(database_url: &str, tenant_id: TenantId) -> TenantCleanup {
    let mut client = connect_client(database_url).expect("connects for setup");
    let slug = format!(
        "r02-{}-{}",
        std::env::var("QUANTOS_R02_RUN_ID").unwrap_or_else(|_| uuid::Uuid::new_v4().to_string()),
        tenant_id
    );
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

    let actor_id = quantos_core::ActorId::new();
    client.execute_typed("insert into quantos.actors(id,tenant_id,actor_kind,service_name,display_name) values($1,$2,'service','r02-fixture','R02 integration fixture')", &[(actor_id.as_uuid(),Type::UUID),(tenant_id.as_uuid(),Type::UUID)]).unwrap();
    for capability in ["snapshot.write", "snapshot.rule.write", "artifact.write"] {
        client.execute_typed("insert into quantos.actor_capabilities(tenant_id,actor_id,capability) values($1,$2,$3)", &[(tenant_id.as_uuid(),Type::UUID),(actor_id.as_uuid(),Type::UUID),(&capability,Type::TEXT)]).unwrap();
    }
    TenantCleanup {
        actor_id,
        database_url: database_url.to_owned(),
        tenant_id,
    }
}

fn connect_client(database_url: &str) -> Result<Client, postgres::Error> {
    let url = Url::parse(database_url).expect("database URL parses");
    let root = url
        .query_pairs()
        .find(|(key, _)| key == "sslrootcert")
        .map(|(_, value)| value.into_owned());
    let options = url
        .query_pairs()
        .filter(|(key, _)| key != "sslrootcert" && key != "sslmode")
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect::<Vec<_>>();
    let mut native_url = url.clone();
    native_url.set_query(None);
    native_url.query_pairs_mut().extend_pairs(options);
    native_url.query_pairs_mut().append_pair(
        "sslmode",
        if url
            .query_pairs()
            .any(|(k, v)| k == "sslmode" && v == "disable")
        {
            "disable"
        } else {
            "require"
        },
    );
    let database_url = native_url.as_str();

    let disable_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "disable");
    let relaxed_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && (value == "require" || value == "prefer"));

    if disable_tls {
        Client::connect(database_url, NoTls)
    } else {
        let mut builder = SslConnector::builder(SslMethod::tls()).expect("TLS builder");
        builder.set_verify(SslVerifyMode::PEER);
        if let Some(root) = &root {
            builder.set_ca_file(root).expect("CA readable and valid");
        }

        if relaxed_tls {
            builder.set_verify(SslVerifyMode::NONE);
        }
        let connector = builder.build();
        Client::connect(database_url, MakeTlsConnector::new(connector))
    }
}

fn verify_consumer_lineage(
    url: &str,
    store: &mut PgStorageStore,
    base: &DataSnapshotRecord,
    ctx: &SnapshotWriteContext,
) {
    use quantos_proto::quantos::common::v1::{ActorRef, CommandMetadata};
    use quantos_storage::{
        SnapshotUsage,
        provenance::{SnapshotSourcePolicy, SourceApproval},
        wire::snapshot_to_wire,
    };
    let now = Utc::now();
    let tenant = ctx.tenant_id;
    let mut db = connect_client(url).unwrap();
    db.execute("insert into quantos.actor_capabilities(tenant_id,actor_id,capability) values($1,$2,'snapshot.read')", &[tenant.as_uuid(), ctx.actor_id.as_uuid()]).unwrap();
    store
        .authorize_snapshot_reader(tenant, ctx.actor_id)
        .unwrap();
    assert!(
        store
            .authorize_snapshot_reader(tenant, quantos_core::ActorId::new())
            .is_err()
    );
    let policy = SnapshotSourcePolicy::new(vec![SourceApproval {
        tenant_id: tenant,
        provider: "fixture".into(),
        dataset: "ticks".into(),
        license_label: "fixture-only".into(),
        approval_reference: "nightly".into(),
        approval_version: "v1".into(),
        approval_document_hash: ContentHash::sha256_bytes(b"approval"),
        scope_hash: ContentHash::sha256_bytes(b"scope"),
        symbols: vec!["BTCUSDT".into()],
        allowed_usages: vec![SnapshotUsage::Research],
        expires_at: now + chrono::Duration::hours(1),
        enabled: true,
    }])
    .unwrap();
    let payload = json!({"provider":"fixture","dataset":"ticks","license_label":"fixture-only","approval_reference":"nightly","approval_version":"v1","normalized_symbol":"BTCUSDT","source_tick_id":"tick","event_time":now,"quality":"passed"});
    let event = json!({"tenant_id":tenant,"actor_id":ctx.actor_id,"event_id":ctx.causation_id,"correlation_id":ctx.correlation_id,"causation_id":ctx.causation_id,"aggregate_type":"market","aggregate_id":"fixture:BTCUSDT","sequence":1,"event_kind":"MarketTick","schema_version":"v2","occurred_at":now,"payload":payload,"payload_hash":ContentHash::sha256_bytes(b"event")});
    db.query_one(
        "select * from quantos.append_market_source($1,$2,'fixture','tick',$3,$4)",
        &[
            tenant.as_uuid(),
            ctx.actor_id.as_uuid(),
            &ContentHash::sha256_bytes(b"source").as_str(),
            &json!([event]),
        ],
    )
    .unwrap();
    let mut input = base.input();
    input.sources = vec![SnapshotSourceRef {
        source_id: "market:fixture:BTCUSDT".into(),
        provider: "fixture".into(),
        dataset: "ticks".into(),
        license_label: "fixture-only".into(),
    }];
    input.license_label = "fixture-only".into();
    input.symbols = vec!["BTCUSDT".into()];
    input.captured_at = now;
    input.window = SnapshotWindow {
        start_at: now,
        end_at: now,
    };
    input.lineage = vec![SnapshotLineageEntry {
        lineage_kind: "market_event_range".into(),
        reference: "market:fixture:BTCUSDT".into(),
        details: json!({"from_sequence":1,"to_sequence":1}),
    }];
    let canonical = DataSnapshotRecord::new(tenant, input.clone(), now).unwrap();
    store.upsert_data_snapshot(&canonical, ctx).unwrap();
    assert!(
        store
            .evaluate_snapshot(tenant, canonical.snapshot_id, SnapshotUsage::Research, now)
            .unwrap()
            .allowed
    );
    assert!(
        store
            .evaluate_snapshot(
                tenant,
                quantos_core::SnapshotId::new(),
                SnapshotUsage::Research,
                now
            )
            .is_err()
    );
    let loaded = store
        .load_authorized_snapshot(
            tenant,
            canonical.snapshot_id,
            SnapshotUsage::Research,
            now,
            &policy,
        )
        .unwrap()
        .0;
    assert_eq!(loaded.content_hash, canonical.content_hash);
    assert!(
        store
            .load_authorized_snapshot(
                tenant,
                canonical.snapshot_id,
                SnapshotUsage::Research,
                now + chrono::Duration::days(1),
                &policy
            )
            .is_err()
    );
    assert!(
        store
            .load_authorized_snapshot(
                tenant,
                quantos_core::SnapshotId::new(),
                SnapshotUsage::Research,
                now,
                &policy
            )
            .is_err()
    );
    assert!(
        store
            .load_authorized_snapshot(
                tenant,
                base.snapshot_id,
                SnapshotUsage::Research,
                now,
                &policy
            )
            .is_err()
    );
    // Persist real, distinct canonical records; all rejection paths cold-read PG.
    for case in 0..14 {
        let mut bad = input.clone();
        match case {
            0 => bad.lineage[0].details = json!({"to_sequence":1}),
            1 => bad.lineage[0].details = json!({"from_sequence":1}),
            2 => bad.lineage[0].details = json!({"from_sequence":0,"to_sequence":1}),
            3 => bad.lineage[0].details = json!({"from_sequence":2,"to_sequence":1}),
            4 => bad.lineage[0].details = json!({"from_sequence":1,"to_sequence":10001}),
            5 => bad.lineage[0].reference = "malformed".into(),
            6 => bad.lineage[0].details = json!({"from_sequence":1,"to_sequence":2}),
            7 => bad.lineage[0].lineage_kind = "artifact".into(),
            8 => bad.sources.push(SnapshotSourceRef {
                source_id: "unbound".into(),
                ..bad.sources[0].clone()
            }),
            9 => bad.symbols.push("ETHUSDT".into()),
            10 => bad.lineage[0].details = json!({"first_sequence":1,"last_sequence":1}),
            11 => bad.sources[0].source_id = "tick".into(),
            12 => bad.sources[0].provider = "unapproved".into(),
            _ => bad.quality = SnapshotQuality::Failed,
        }
        let record = DataSnapshotRecord::new(tenant, bad, now).unwrap();
        if case < 8 {
            assert!(
                store.upsert_data_snapshot(&record, ctx).is_err(),
                "database rejects malformed lineage case {case}"
            );
            continue;
        }
        store.upsert_data_snapshot(&record, ctx).unwrap();
        assert_eq!(
            store
                .load_authorized_snapshot(
                    tenant,
                    record.snapshot_id,
                    SnapshotUsage::Research,
                    now,
                    &policy
                )
                .is_ok(),
            matches!(case, 10 | 11),
            "lineage case {case}"
        );
    }
    let meta = CommandMetadata {
        request_id: ctx.causation_id.to_string(),
        tenant_id: tenant.to_string(),
        workspace_id: uuid::Uuid::new_v4().to_string(),
        actor: Some(ActorRef {
            actor_id: ctx.actor_id.to_string(),
            actor_kind: 2,
            display_name: "nightly".into(),
            capabilities: vec!["snapshot.read".into()],
        }),
        correlation_id: ctx.correlation_id.to_string(),
        causation_id: ctx.causation_id.to_string(),
        mode: 1,
        environment: 2,
        issued_at: Some(quantos_proto::generated::google::protobuf::Timestamp {
            seconds: now.timestamp(),
            nanos: 0,
        }),
    };
    let wire = snapshot_to_wire(&canonical, meta).unwrap();
    assert_eq!(
        store
            .resolve_snapshot_reference(&wire, ctx, SnapshotUsage::Research, now, &policy)
            .unwrap()
            .snapshot_id,
        canonical.snapshot_id
    );
    for case in 0..7 {
        let mut bad = wire.clone();
        match case {
            0 => bad.metadata = None,
            1 => bad.metadata.as_mut().unwrap().tenant_id = TenantId::new().to_string(),
            2 => {
                bad.metadata
                    .as_mut()
                    .unwrap()
                    .actor
                    .as_mut()
                    .unwrap()
                    .actor_id = quantos_core::ActorId::new().to_string()
            }
            3 => {
                bad.metadata.as_mut().unwrap().correlation_id =
                    quantos_core::CorrelationId::new().to_string()
            }
            4 => {
                bad.metadata.as_mut().unwrap().causation_id =
                    quantos_core::EventId::new().to_string()
            }
            5 => bad.snapshot_id = "invalid".into(),
            _ => bad.symbols.push("forged".into()),
        }
        assert!(
            store
                .resolve_snapshot_reference(&bad, ctx, SnapshotUsage::Research, now, &policy)
                .is_err(),
            "wire case {case}"
        );
    }
}
