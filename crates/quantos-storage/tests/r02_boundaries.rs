//! Real configured Supabase boundary checks. No local DB or reset.
use bytes::Bytes;
use chrono::{Duration, Utc};
use postgres::{
    Client,
    types::{Json, Type},
};
use quantos_core::{
    ActorId, ArtifactId, ContentHash, CorrelationId, EventId, SchemaVersion, TenantId,
};
use quantos_storage::{
    ArtifactManifest, DataSnapshotInput, DataSnapshotRecord, SnapshotArtifactRef,
    SnapshotLineageEntry, SnapshotQuality, SnapshotSourceRef, SnapshotUsage, SnapshotWindow,
    default_quality_rules,
    pg::{PgStorageStore, SnapshotWriteContext},
    supabase_storage::{SupabaseStorageAdapter, SupabaseStorageConfig, SupabaseStorageError},
};
use serde_json::{Value, json};

fn db(url: &str) -> Client {
    let u = url::Url::parse(url).unwrap();
    let mut tls = native_tls::TlsConnector::builder();
    tls.danger_accept_invalid_certs(
        u.query_pairs()
            .any(|(k, v)| k == "sslmode" && matches!(v.as_ref(), "require" | "prefer")),
    );
    let mut c = Client::connect(
        url,
        postgres_native_tls::MakeTlsConnector::new(tls.build().unwrap()),
    )
    .unwrap();
    c.batch_execute("set statement_timeout='15s'").unwrap();
    c
}
struct Fixture {
    url: String,
    tenant: TenantId,
    actor: ActorId,
    objects: Vec<ArtifactManifest>,
    fault: Option<String>,
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let mut c = db(&self.url);
        if let Some(name) = &self.fault {
            let _=c.batch_execute(&format!("drop trigger if exists {name} on quantos.object_artifacts; drop function if exists quantos.{name}();"));
        }
        if !self.objects.is_empty() {
            let a = adapter();
            for m in &self.objects {
                if let Err(e) = a.delete_artifact(m) {
                    eprintln!("R02_OWNED_OBJECT_CLEANUP_FAILED {e}");
                }
            }
        }
        c.execute_typed(
            "update quantos.actors set is_active=false where tenant_id=$1 and id=$2",
            &[
                (self.tenant.as_uuid(), Type::UUID),
                (self.actor.as_uuid(), Type::UUID),
            ],
        )
        .unwrap();
        eprintln!("R02_ACTOR_INACTIVE {}", self.actor);
    }
}
fn fixture(url: &str) -> Fixture {
    let t = TenantId::new();
    let actor = ActorId::new();
    let mut c = db(url);
    let run = std::env::var("QUANTOS_R02_RUN_ID").expect("target harness supplies a unique run id");
    let slug = format!("r02-{run}-{t}");
    c.execute_typed(
        "insert into quantos.tenants(id,slug,name) values($1,$2,$2)",
        &[(t.as_uuid(), Type::UUID), (&slug, Type::TEXT)],
    )
    .unwrap();
    c.execute_typed("insert into quantos.actors(id,tenant_id,actor_kind,service_name,display_name) values($1,$2,'service','r02-target','R02 scoped target fixture')",&[(actor.as_uuid(),Type::UUID),(t.as_uuid(),Type::UUID)]).unwrap();
    for cap in ["snapshot.write", "snapshot.rule.write", "artifact.write"] {
        c.execute_typed("insert into quantos.actor_capabilities(tenant_id,actor_id,capability) values($1,$2,$3)",&[(t.as_uuid(),Type::UUID),(actor.as_uuid(),Type::UUID),(&cap,Type::TEXT)]).unwrap();
    }
    eprintln!(
        "R02_FIXTURE {}",
        json!({"tenant":t,"actor":actor,"run":run})
    );
    Fixture {
        url: url.into(),
        tenant: t,
        actor,
        objects: vec![],
        fault: None,
    }
}
fn context(f: &Fixture) -> SnapshotWriteContext {
    SnapshotWriteContext {
        tenant_id: f.tenant,
        actor_id: f.actor,
        correlation_id: CorrelationId::new(),
        causation_id: EventId::new(),
        reason: "R02 scoped regression fixture".into(),
    }
}
fn adapter() -> SupabaseStorageAdapter {
    SupabaseStorageAdapter::connect(SupabaseStorageConfig {
        project_url: std::env::var("SUPABASE_URL").unwrap(),
        bucket_name: std::env::var("SUPABASE_STORAGE_BUCKET").unwrap(),
        api_key: std::env::var("SUPABASE_SERVICE_ROLE_KEY").unwrap(),
        authorization_token: std::env::var("SUPABASE_STORAGE_AUTH_TOKEN")
            .ok()
            .filter(|s| !s.is_empty()),
        upsert: true,
    })
    .unwrap()
}
fn required() -> Option<String> {
    if std::env::var("QUANTOS_RUN_R02_POSTGRES_TESTS")
        .ok()
        .as_deref()
        != Some("1")
    {
        eprintln!("NOT RUN: R02 target boundary opt-in absent");
        return None;
    }
    Some(std::env::var("DATABASE_URL").expect("DATABASE_URL required"))
}

#[test]
fn real_snapshot_permissions_invariants_and_atomic_audit() {
    let Some(url) = required() else { return };
    let f = fixture(&url);
    let foreign = fixture(&url);
    let ctx = context(&f);
    let mut store = PgStorageStore::connect(&url).unwrap();
    let mut c = db(&url);
    let v = SchemaVersion::parse("v1").unwrap();
    let schema = store
        .register_schema(
            f.tenant,
            "research",
            "DataSnapshot",
            &v,
            &json!({"type":"object"}),
            Utc::now(),
        )
        .unwrap();
    let other_schema = store
        .register_schema(
            foreign.tenant,
            "research",
            "DataSnapshot",
            &v,
            &json!({"type":"object"}),
            Utc::now(),
        )
        .unwrap();
    let m = ArtifactManifest::new(
        f.tenant,
        "application/json",
        ContentHash::sha256_bytes(b"metadata fixture"),
        "quantos-artifacts",
        16,
        Utc::now(),
    );
    let m = store.upsert_artifact(&m).unwrap();
    let captured = Utc::now();
    let input = DataSnapshotInput {
        schema_name: "DataSnapshot".into(),
        schema_version: v,
        schema_entry_id: Some(schema.schema_entry_id),
        window: SnapshotWindow {
            start_at: captured - Duration::seconds(30),
            end_at: captured,
        },
        sources: vec![SnapshotSourceRef {
            source_id: "fixture".into(),
            provider: "fixture-internal".into(),
            dataset: "fixture-v1".into(),
            license_label: "fixture-only".into(),
        }],
        quality: SnapshotQuality::Passed,
        quality_findings: vec![],
        license_label: "fixture-only".into(),
        captured_at: captured,
        max_age_secs: 120,
        symbols: vec!["BTCUSDT".into()],
        artifact_refs: vec![SnapshotArtifactRef {
            artifact_id: m.artifact_id,
            media_type: m.media_type.clone(),
            content_hash: m.content_hash.clone(),
            storage_bucket: m.storage_bucket.clone(),
            object_key: m.object_key.clone(),
        }],
        lineage: vec![SnapshotLineageEntry {
            lineage_kind: "artifact".into(),
            reference: m.artifact_id.to_string(),
            details: json!({"purpose":"fixture-only"}),
        }],
    };
    let snapshot = DataSnapshotRecord::new(f.tenant, input, captured).unwrap();
    for rule in default_quality_rules(f.tenant, captured) {
        store.upsert_snapshot_quality_rule(&rule, &ctx).unwrap();
    }
    let persisted = store.upsert_data_snapshot(&snapshot, &ctx).unwrap();
    let again = store.upsert_data_snapshot(&snapshot, &ctx).unwrap();
    assert_eq!(persisted.snapshot_id, again.snapshot_id);
    assert_eq!(
        store
            .get_data_snapshot_uncached(f.tenant, persisted.snapshot_id)
            .unwrap()
            .unwrap()
            .content_hash,
        persisted.content_hash
    );
    assert!(
        store
            .evaluate_snapshot(
                f.tenant,
                persisted.snapshot_id,
                SnapshotUsage::Trading,
                captured
            )
            .unwrap()
            .allowed
    );
    assert!(
        !store
            .evaluate_snapshot(
                f.tenant,
                persisted.snapshot_id,
                SnapshotUsage::Trading,
                captured + Duration::days(1)
            )
            .unwrap()
            .allowed
    );
    let audit=c.query_typed_one("select count(*)::bigint from quantos.audit_entries where tenant_id=$1 and action='snapshot.created' and actor_id=$2 and correlation_id=$3 and causation_id=$4",&[(f.tenant.as_uuid(),Type::UUID),(f.actor.as_uuid(),Type::UUID),(ctx.correlation_id.as_uuid(),Type::UUID),(ctx.causation_id.as_uuid(),Type::UUID)]).unwrap();
    assert_eq!(audit.get::<_, i64>(0), 1);
    // Check virtual invalid legacy records without rewriting immutable facts.
    let row = c
        .query_typed_one(
            "select to_jsonb(s) from quantos.data_snapshots s where id=$1",
            &[(snapshot.snapshot_id.as_uuid(), Type::UUID)],
        )
        .unwrap();
    let original: Value = row.get(0);
    for (field, value) in [
        ("schema_entry_id", json!(other_schema.schema_entry_id)),
        ("canonical_payload", Value::Null),
        ("quality", json!("failed")),
        ("expires_at", json!("2099-01-01T00:00:00Z")),
    ] {
        let mut virtual_legacy = original.clone();
        virtual_legacy[field] = value;
        let invalid = c.query_typed_one("select quantos.snapshot_read_valid(jsonb_populate_record(null::quantos.data_snapshots,$1))", &[(&Json(&virtual_legacy),Type::JSONB)]).unwrap();
        assert!(!invalid.get::<_, bool>(0), "legacy {field}");
    }
    let d = serde_json::to_value(&snapshot).unwrap();
    let canonical = String::from_utf8(snapshot.canonical_payload_bytes().unwrap()).unwrap();
    let cj = serde_json::to_value(&ctx).unwrap();
    for field in ["content_hash", "expires_at", "quality"] {
        let mut bad = d.clone();
        bad[field] = match field {
            "content_hash" => json!(ContentHash::sha256_bytes(b"forged")),
            "expires_at" => json!(captured + Duration::days(30)),
            _ => json!("failed"),
        };
        let err = c
            .query_typed_one(
                "select quantos.persist_data_snapshot($1,$2,$3)",
                &[
                    (&Json(&bad), Type::JSONB),
                    (&canonical, Type::TEXT),
                    (&Json(&cj), Type::JSONB),
                ],
            )
            .unwrap_err();
        assert_eq!(err.code().unwrap().code(), "22023");
    }
    for foreign_ref in [true, false] {
        let mut input = snapshot.input();
        if foreign_ref {
            input.schema_entry_id = Some(other_schema.schema_entry_id);
        } else {
            input.artifact_refs[0].artifact_id = ArtifactId::new();
        }
        let bad = DataSnapshotRecord::new(f.tenant, input, captured).unwrap();
        assert!(store.upsert_data_snapshot(&bad, &ctx).is_err());
    }
    let mut unlicensed = default_quality_rules(f.tenant, captured)[2].clone();
    unlicensed.require_license = false;
    assert!(
        store
            .upsert_snapshot_quality_rule(&unlicensed, &ctx)
            .is_err()
    );
    let mut badrule = serde_json::to_value(&unlicensed).unwrap();
    badrule["allow_failed"] = json!(true);
    badrule["require_freshness"] = json!(false);
    let err = c
        .query_typed_one(
            "select quantos.persist_snapshot_quality_rule($1,$2)",
            &[(&Json(&badrule), Type::JSONB), (&Json(&cj), Type::JSONB)],
        )
        .unwrap_err();
    assert_eq!(err.code().unwrap().code(), "23514");
    let mut badctx = cj.clone();
    badctx["actor_id"] = json!(foreign.actor);
    assert_eq!(
        c.query_typed_one(
            "select quantos.persist_data_snapshot($1,$2,$3)",
            &[
                (&Json(&d), Type::JSONB),
                (&canonical, Type::TEXT),
                (&Json(&badctx), Type::JSONB)
            ]
        )
        .unwrap_err()
        .code()
        .unwrap()
        .code(),
        "42501"
    );
    let audit_count=c.query_typed_one("select count(*)::bigint from quantos.audit_entries where tenant_id=$1 and action like 'snapshot.%'",&[(f.tenant.as_uuid(),Type::UUID)]).unwrap();
    assert_eq!(
        audit_count.get::<_, i64>(0),
        4,
        "rejected writes produce no successful mutation audits"
    );
    // Auth/member fixtures roll back. Existing quantos table privileges remain denied.
    let user = uuid::Uuid::new_v4();
    let outsider = uuid::Uuid::new_v4();
    let mut tx = c.transaction().unwrap();
    tx.execute_typed(
        "insert into auth.users(id) values($1),($2)",
        &[(&user, Type::UUID), (&outsider, Type::UUID)],
    )
    .unwrap();
    tx.execute_typed(
        "insert into quantos.tenant_memberships(tenant_id,user_id,role) values($1,$2,'viewer')",
        &[(f.tenant.as_uuid(), Type::UUID), (&user, Type::UUID)],
    )
    .unwrap();
    tx.batch_execute("savepoint roles;set local role authenticated")
        .unwrap();
    tx.query_typed_one(
        "select set_config('request.jwt.claim.sub',$1,true)",
        &[(&user.to_string(), Type::TEXT)],
    )
    .unwrap();
    let read = tx
        .query_typed_one(
            "select quantos_snapshot_api.read_snapshot($1,$2) as document",
            &[
                (f.tenant.as_uuid(), Type::UUID),
                (snapshot.snapshot_id.as_uuid(), Type::UUID),
            ],
        )
        .unwrap();
    let read: DataSnapshotRecord = serde_json::from_value(read.get("document")).unwrap();
    assert_eq!(read.content_hash, snapshot.content_hash);
    let rules = tx
        .query_typed_one(
            "select quantos_snapshot_api.read_quality_rules($1)",
            &[(f.tenant.as_uuid(), Type::UUID)],
        )
        .unwrap();
    assert_eq!(rules.get::<_, Value>(0).as_array().unwrap().len(), 3);
    tx.batch_execute("savepoint denied").unwrap();
    let denial = tx
        .query_typed_one(
            "select quantos_snapshot_api.read_snapshot($1,$2)",
            &[
                (foreign.tenant.as_uuid(), Type::UUID),
                (snapshot.snapshot_id.as_uuid(), Type::UUID),
            ],
        )
        .unwrap_err();
    assert_eq!(denial.code().unwrap().code(), "42501");
    tx.batch_execute("rollback to denied").unwrap();
    tx.query_typed_one(
        "select set_config('request.jwt.claim.sub',$1,true)",
        &[(&outsider.to_string(), Type::TEXT)],
    )
    .unwrap();
    assert_eq!(
        tx.query_typed_one(
            "select quantos_snapshot_api.read_snapshot($1,$2)",
            &[
                (f.tenant.as_uuid(), Type::UUID),
                (snapshot.snapshot_id.as_uuid(), Type::UUID)
            ]
        )
        .unwrap_err()
        .code()
        .unwrap()
        .code(),
        "42501"
    );
    tx.batch_execute("rollback to roles; set local role quantos_snapshot_writer")
        .unwrap();
    tx.query_typed_one(
        "select quantos.persist_data_snapshot($1,$2,$3)",
        &[
            (&Json(&d), Type::JSONB),
            (&canonical, Type::TEXT),
            (&Json(&cj), Type::JSONB),
        ],
    )
    .unwrap();
    tx.batch_execute("savepoint table_denied").unwrap();
    assert_eq!(
        tx.query_typed_one("select * from quantos.data_snapshots limit 1", &[])
            .unwrap_err()
            .code()
            .unwrap()
            .code(),
        "42501"
    );
    tx.batch_execute("rollback to table_denied").unwrap();
    tx.rollback().unwrap();
    eprintln!(
        "R02_TARGET_SNAPSHOT PASS member-read/cross-tenant-deny/hash-expiry/ref/rule-floor/atomic-audit; not HTTP JWT"
    );
}

#[test]
fn real_storage_registration_failure_preserves_existing_object_and_reconciles() {
    let Some(url) = required() else { return };
    let mut f = fixture(&url);
    let ctx = context(&f);
    let a = adapter();
    let mut store = PgStorageStore::connect(&url).unwrap();
    let mut c = db(&url);
    let payload = Bytes::from(format!("R02 owned payload {}", uuid::Uuid::new_v4()));
    let m = ArtifactManifest::new(
        f.tenant,
        "application/json",
        ContentHash::sha256_bytes(&payload),
        std::env::var("SUPABASE_STORAGE_BUCKET").unwrap(),
        payload.len() as u64,
        Utc::now(),
    );
    f.objects.push(m.clone());
    a.upload_and_register(&mut store, &m, payload.clone(), &ctx)
        .unwrap();
    assert_eq!(a.get_artifact(&m).unwrap(), payload);
    let name = format!("r02_fault_{}", uuid::Uuid::new_v4().simple());
    f.fault = Some(name.clone());
    c.batch_execute(&format!("create function quantos.{name}() returns trigger language plpgsql set search_path='' as $$ begin if new.tenant_id='{}'::uuid then raise exception 'R02_OWNED_REGISTRATION_FAULT' using errcode='40001';end if;return new;end $$;create trigger {name} before insert on quantos.object_artifacts for each row execute function quantos.{name}();",f.tenant)).unwrap();
    let error = a
        .upload_and_register(&mut store, &m, payload.clone(), &ctx)
        .unwrap_err();
    let attempt = match error {
        SupabaseStorageError::RecoveryPending { attempt } => attempt,
        other => panic!("expected recovery intent, got {other}"),
    };
    assert_eq!(
        a.get_artifact(&m).unwrap(),
        payload,
        "registration failure must not delete pre-existing object"
    );
    let row = c
        .query_typed_one(
            "select state from quantos.artifact_upload_attempts where id=$1",
            &[(&attempt, Type::UUID)],
        )
        .unwrap();
    assert_eq!(row.get::<_, String>(0), "reconcile");
    c.batch_execute(&format!(
        "drop trigger {name} on quantos.object_artifacts;drop function quantos.{name}();"
    ))
    .unwrap();
    f.fault = None;
    let recovered = a.reconcile_upload(&mut store, attempt, &ctx).unwrap();
    assert_eq!(recovered.content_hash, m.content_hash);
    let row = c
        .query_typed_one(
            "select state from quantos.artifact_upload_attempts where id=$1",
            &[(&attempt, Type::UUID)],
        )
        .unwrap();
    assert_eq!(row.get::<_, String>(0), "registered");
    let mut invalid = m.clone();
    invalid.tenant_id = TenantId::new();
    assert!(matches!(
        a.upload_and_register(&mut store, &invalid, payload.clone(), &ctx),
        Err(SupabaseStorageError::InvalidManifest)
    ));
    let mut bad = m.clone();
    bad.storage_bucket = "other-bucket".into();
    assert!(matches!(
        a.get_artifact(&bad),
        Err(SupabaseStorageError::InvalidManifest)
    ));
    eprintln!(
        "R02_TARGET_STORAGE PASS real-roundtrip/existing-object-preserved/durable-reconcile/retry/path-deny; attempt={attempt}"
    );
}
