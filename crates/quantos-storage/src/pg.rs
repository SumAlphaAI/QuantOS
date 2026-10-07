use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use native_tls::TlsConnector;
use postgres::{
    Client, NoTls, Row,
    types::{Json, Type},
};
use postgres_native_tls::MakeTlsConnector;
use thiserror::Error;
use url::Url;
use uuid::Uuid;

use crate::{
    ArtifactManifest, DataSnapshotRecord, SchemaRegistryEntry, SnapshotError, SnapshotQualityRule,
};
use quantos_core::{
    ActorId, ArtifactId, ContentHash, CoreError, CorrelationId, EventId, SchemaEntryId,
    SchemaVersion, SnapshotId, TenantId, canonical_json_bytes,
};

#[derive(Debug, Error)]
pub enum PgStorageError {
    #[error(transparent)]
    Postgres(#[from] postgres::Error),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error(transparent)]
    Tls(#[from] native_tls::Error),
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Snapshot(#[from] SnapshotError),
    #[error("SNAPSHOT_PERSISTENCE_INVARIANT: conflict row is missing after immutable insert")]
    SnapshotPersistenceInvariant,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SnapshotWriteContext {
    pub tenant_id: TenantId,
    pub actor_id: ActorId,
    pub correlation_id: CorrelationId,
    pub causation_id: EventId,
    pub reason: String,
}

impl SnapshotWriteContext {
    pub fn validate(&self, tenant_id: TenantId) -> Result<(), SnapshotError> {
        if self.tenant_id != tenant_id
            || self.reason.trim().is_empty()
            || self.reason.len() > 512
            || self.actor_id.as_uuid().is_nil()
            || self.correlation_id.as_uuid().is_nil()
            || self.causation_id.as_uuid().is_nil()
        {
            return Err(SnapshotError::WriteContext);
        }
        Ok(())
    }
}

pub struct PgStorageStore {
    client: Client,
}

impl PgStorageStore {
    pub fn connect(database_url: &str) -> Result<Self, PgStorageError> {
        Ok(Self {
            client: {
                let mut client = connect_client(database_url)?;
                client.batch_execute("set statement_timeout = '15s'")?;
                client
            },
        })
    }

    /// Persist only the outcome of a Storage operation. Telemetry failure must
    /// not change the result of the object request or expose its key or body.
    pub fn record_storage_outcome(&mut self, tenant_id: TenantId, failed: bool) {
        if let Err(error) = self.client.query_typed_one(
            "select quantos.record_operational_metric(
                $1, 'storage_operation_error', $2, 'storage_operation_error',
                null, '{}'::jsonb, now())",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&(if failed { 1.0_f64 } else { 0.0_f64 }), Type::FLOAT8),
            ],
        ) {
            eprintln!("storage operation metric persist failed: {error}");
        }
    }

    pub fn upsert_artifact(
        &mut self,
        manifest: &ArtifactManifest,
    ) -> Result<ArtifactManifest, PgStorageError> {
        let metadata = serde_json::to_value(&manifest.metadata)?;
        let metadata = Json(&metadata);
        let row = self.client.query_typed_one(
            "insert into quantos.object_artifacts (
                tenant_id, artifact_id, content_hash, storage_bucket, object_key, media_type,
                size_bytes, metadata, created_at
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            on conflict (tenant_id, content_hash)
            do update set
                storage_bucket = quantos.object_artifacts.storage_bucket,
                object_key = quantos.object_artifacts.object_key,
                media_type = quantos.object_artifacts.media_type,
                size_bytes = quantos.object_artifacts.size_bytes,
                metadata = quantos.object_artifacts.metadata
            returning artifact_id, tenant_id, content_hash, storage_bucket, object_key,
                      media_type, size_bytes, metadata, created_at",
            &[
                (manifest.tenant_id.as_uuid(), Type::UUID),
                (manifest.artifact_id.as_uuid(), Type::UUID),
                (&manifest.content_hash.as_str(), Type::TEXT),
                (&manifest.storage_bucket, Type::TEXT),
                (&manifest.object_key, Type::TEXT),
                (&manifest.media_type, Type::TEXT),
                (&(manifest.size_bytes as i64), Type::INT8),
                (&metadata, Type::JSONB),
                (&manifest.created_at, Type::TIMESTAMPTZ),
            ],
        )?;

        row_to_artifact_manifest(&row)
    }

    pub fn find_artifact_by_hash(
        &mut self,
        tenant_id: TenantId,
        content_hash: &ContentHash,
    ) -> Result<Option<ArtifactManifest>, PgStorageError> {
        let row = self.client.query_typed_opt(
            "select artifact_id, tenant_id, content_hash, storage_bucket, object_key,
                    media_type, size_bytes, metadata, created_at
             from quantos.object_artifacts
             where tenant_id = $1 and content_hash = $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&content_hash.as_str(), Type::TEXT),
            ],
        )?;

        row.map(|row| row_to_artifact_manifest(&row)).transpose()
    }

    pub fn register_schema(
        &mut self,
        tenant_id: TenantId,
        domain: &str,
        schema_name: &str,
        schema_version: &SchemaVersion,
        schema_document: &serde_json::Value,
        created_at: DateTime<Utc>,
    ) -> Result<SchemaRegistryEntry, PgStorageError> {
        let schema_hash = ContentHash::sha256_bytes(&canonical_json_bytes(schema_document)?);
        let schema_document = Json(schema_document);
        let row = self.client.query_typed_one(
            "insert into quantos.schema_registry (
                tenant_id, domain, schema_name, schema_version, content_hash, schema_document, created_at
            ) values ($1,$2,$3,$4,$5,$6,$7)
            on conflict (tenant_id, domain, schema_name, schema_version)
            do update set
                content_hash = quantos.schema_registry.content_hash,
                schema_document = quantos.schema_registry.schema_document
            returning id, tenant_id, domain, schema_name, schema_version, content_hash,
                      schema_document, created_at",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&domain, Type::TEXT),
                (&schema_name, Type::TEXT),
                (&schema_version.as_str(), Type::TEXT),
                (&schema_hash.as_str(), Type::TEXT),
                (&schema_document, Type::JSONB),
                (&created_at, Type::TIMESTAMPTZ),
            ],
        )?;

        row_to_schema_registry_entry(&row)
    }

    pub fn get_schema(
        &mut self,
        tenant_id: TenantId,
        domain: &str,
        schema_name: &str,
        schema_version: &SchemaVersion,
    ) -> Result<Option<SchemaRegistryEntry>, PgStorageError> {
        let row = self.client.query_typed_opt(
            "select id, tenant_id, domain, schema_name, schema_version, content_hash,
                    schema_document, created_at
             from quantos.schema_registry
             where tenant_id = $1 and domain = $2 and schema_name = $3 and schema_version = $4",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&domain, Type::TEXT),
                (&schema_name, Type::TEXT),
                (&schema_version.as_str(), Type::TEXT),
            ],
        )?;

        row.map(|row| row_to_schema_registry_entry(&row))
            .transpose()
    }

    pub fn upsert_data_snapshot(
        &mut self,
        snapshot: &DataSnapshotRecord,
        context: &SnapshotWriteContext,
    ) -> Result<DataSnapshotRecord, PgStorageError> {
        snapshot.validate_integrity()?;
        context.validate(snapshot.tenant_id)?;
        let document = serde_json::to_value(snapshot)?;
        let context = serde_json::to_value(context)?;
        let canonical = String::from_utf8(snapshot.canonical_payload_bytes()?)
            .expect("canonical JSON is UTF-8");
        let row = self.client.query_typed_one(
            "select quantos.persist_data_snapshot($1,$2,$3) as document",
            &[
                (&Json(&document), Type::JSONB),
                (&canonical, Type::TEXT),
                (&Json(&context), Type::JSONB),
            ],
        )?;
        let persisted: DataSnapshotRecord = serde_json::from_value(row.get("document"))?;
        Ok(persisted)
    }

    pub fn get_data_snapshot(
        &mut self,
        tenant_id: TenantId,
        snapshot_id: SnapshotId,
    ) -> Result<Option<DataSnapshotRecord>, PgStorageError> {
        self.get_data_snapshot_uncached(tenant_id, snapshot_id)
    }

    pub fn get_data_snapshot_uncached(
        &mut self,
        tenant_id: TenantId,
        snapshot_id: SnapshotId,
    ) -> Result<Option<DataSnapshotRecord>, PgStorageError> {
        let row = self.client.query_typed_opt(
            "select id, tenant_id, schema_entry_id, schema_name, schema_version,
                    window_start_at, window_end_at, captured_at, max_age_secs, expires_at,
                    quality, license_label, content_hash, symbols, sources, artifact_refs,
                    lineage, quality_findings, created_at,
                    quantos.snapshot_read_valid(data_snapshots) as references_valid
             from quantos.data_snapshots
             where tenant_id = $1 and id = $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (snapshot_id.as_uuid(), Type::UUID),
            ],
        )?;

        let snapshot = row.map(|row| row_to_data_snapshot(&row)).transpose()?;
        Ok(snapshot)
    }

    pub fn find_data_snapshot_by_hash(
        &mut self,
        tenant_id: TenantId,
        content_hash: &ContentHash,
    ) -> Result<Option<DataSnapshotRecord>, PgStorageError> {
        let row = self.client.query_typed_opt(
            "select id, tenant_id, schema_entry_id, schema_name, schema_version,
                    window_start_at, window_end_at, captured_at, max_age_secs, expires_at,
                    quality, license_label, content_hash, symbols, sources, artifact_refs,
                    lineage, quality_findings, created_at,
                    quantos.snapshot_read_valid(data_snapshots) as references_valid
             from quantos.data_snapshots
             where tenant_id = $1 and content_hash = $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&content_hash.as_str(), Type::TEXT),
            ],
        )?;

        let snapshot = row.map(|row| row_to_data_snapshot(&row)).transpose()?;
        Ok(snapshot)
    }

    pub fn list_data_snapshots_for_symbol(
        &mut self,
        tenant_id: TenantId,
        symbol: &str,
        limit: i64,
    ) -> Result<Vec<DataSnapshotRecord>, PgStorageError> {
        let symbol_filter = Json(&serde_json::json!([symbol]));
        let rows = self.client.query_typed(
            "select id, tenant_id, schema_entry_id, schema_name, schema_version,
                    window_start_at, window_end_at, captured_at, max_age_secs, expires_at,
                    quality, license_label, content_hash, symbols, sources, artifact_refs,
                    lineage, quality_findings, created_at,
                    quantos.snapshot_read_valid(data_snapshots) as references_valid
             from quantos.data_snapshots
             where tenant_id = $1
               and symbols @> $2
             order by captured_at desc
             limit $3",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&symbol_filter, Type::JSONB),
                (&limit, Type::INT8),
            ],
        )?;

        rows.iter().map(row_to_data_snapshot).collect()
    }

    pub fn upsert_snapshot_quality_rule(
        &mut self,
        rule: &SnapshotQualityRule,
        context: &SnapshotWriteContext,
    ) -> Result<SnapshotQualityRule, PgStorageError> {
        rule.validate()?;
        context.validate(rule.tenant_id)?;
        let rule = serde_json::to_value(rule)?;
        let context = serde_json::to_value(context)?;
        let row = self.client.query_typed_one(
            "select quantos.persist_snapshot_quality_rule($1,$2) as document",
            &[(&Json(&rule), Type::JSONB), (&Json(&context), Type::JSONB)],
        )?;
        Ok(serde_json::from_value(row.get("document"))?)
    }

    /// Cold database reads prevent a local cache from hiding corruption or rule changes.
    pub fn evaluate_snapshot(
        &mut self,
        tenant_id: TenantId,
        snapshot_id: SnapshotId,
        usage: crate::SnapshotUsage,
        observed_at: DateTime<Utc>,
    ) -> Result<crate::SnapshotGateDecision, PgStorageError> {
        let snapshot = self
            .get_data_snapshot_uncached(tenant_id, snapshot_id)?
            .ok_or(PgStorageError::SnapshotPersistenceInvariant)?;
        let rules = crate::SnapshotQualityRuleset::from_rules(
            self.list_snapshot_quality_rules(tenant_id)?,
        )?;
        Ok(crate::SnapshotQualityGate::evaluate(
            &snapshot,
            usage,
            observed_at,
            &rules,
        ))
    }

    pub(crate) fn prepare_artifact_upload(
        &mut self,
        manifest: &ArtifactManifest,
        context: &SnapshotWriteContext,
    ) -> Result<Uuid, PgStorageError> {
        let document = serde_json::to_value(manifest)?;
        let row = self.client.query_typed_one(
            "select quantos.prepare_artifact_upload($1,$2) as id",
            &[
                (&Json(&document), Type::JSONB),
                (&Json(&serde_json::to_value(context)?), Type::JSONB),
            ],
        )?;
        Ok(row.get("id"))
    }

    pub(crate) fn finish_artifact_upload(
        &mut self,
        attempt: Uuid,
        registered: bool,
        context: &SnapshotWriteContext,
    ) -> Result<(), PgStorageError> {
        self.client.query_typed_one(
            "select quantos.finish_artifact_upload($1,$2,$3)",
            &[
                (&attempt, Type::UUID),
                (&registered, Type::BOOL),
                (&Json(&serde_json::to_value(context)?), Type::JSONB),
            ],
        )?;
        Ok(())
    }

    pub(crate) fn artifact_upload_manifest(
        &mut self,
        attempt: Uuid,
        context: &SnapshotWriteContext,
    ) -> Result<ArtifactManifest, PgStorageError> {
        let row = self.client.query_typed_one(
            "select quantos.artifact_upload_manifest($1,$2) as document",
            &[
                (&attempt, Type::UUID),
                (&Json(&serde_json::to_value(context)?), Type::JSONB),
            ],
        )?;
        Ok(serde_json::from_value(row.get("document"))?)
    }

    pub fn list_snapshot_quality_rules(
        &mut self,
        tenant_id: TenantId,
    ) -> Result<Vec<SnapshotQualityRule>, PgStorageError> {
        let rows = self.client.query_typed(
            "select tenant_id, usage_scope, allow_pending, allow_degraded, allow_failed,
                    require_license, require_freshness, updated_at
             from quantos.data_snapshot_quality_rules
             where tenant_id = $1
             order by usage_scope asc",
            &[(tenant_id.as_uuid(), Type::UUID)],
        )?;

        rows.iter().map(row_to_snapshot_quality_rule).collect()
    }
}

fn connect_client(database_url: &str) -> Result<Client, PgStorageError> {
    let mut bounded = Url::parse(database_url)?;
    if !bounded.query_pairs().any(|(k, _)| k == "connect_timeout") {
        bounded
            .query_pairs_mut()
            .append_pair("connect_timeout", "10");
    }
    let database_url = bounded.as_str();
    let url = Url::parse(database_url)?;
    let disable_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "disable");
    let relaxed_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && (value == "require" || value == "prefer"));

    if disable_tls {
        Ok(Client::connect(database_url, NoTls)?)
    } else {
        let mut builder = TlsConnector::builder();
        if relaxed_tls {
            builder.danger_accept_invalid_certs(true);
        }
        let connector = builder.build()?;
        Ok(Client::connect(
            database_url,
            MakeTlsConnector::new(connector),
        )?)
    }
}

fn row_to_artifact_manifest(row: &Row) -> Result<ArtifactManifest, PgStorageError> {
    let metadata_value: serde_json::Value = row.get("metadata");
    let metadata: BTreeMap<String, String> = serde_json::from_value(metadata_value)?;

    Ok(ArtifactManifest {
        artifact_id: ArtifactId::from_uuid(row.get::<_, Uuid>("artifact_id")),
        tenant_id: TenantId::from_uuid(row.get("tenant_id")),
        media_type: row.get("media_type"),
        content_hash: ContentHash::parse(row.get::<_, String>("content_hash").as_str())?,
        storage_bucket: row.get("storage_bucket"),
        object_key: row.get("object_key"),
        size_bytes: row.get::<_, i64>("size_bytes") as u64,
        metadata,
        created_at: row.get("created_at"),
    })
}

fn row_to_schema_registry_entry(row: &Row) -> Result<SchemaRegistryEntry, PgStorageError> {
    Ok(SchemaRegistryEntry {
        schema_entry_id: SchemaEntryId::from_uuid(row.get::<_, Uuid>("id")),
        tenant_id: TenantId::from_uuid(row.get("tenant_id")),
        domain: row.get("domain"),
        schema_name: row.get("schema_name"),
        schema_version: SchemaVersion::parse(row.get::<_, String>("schema_version").as_str())?,
        content_hash: ContentHash::parse(row.get::<_, String>("content_hash").as_str())?,
        schema_document: row.get("schema_document"),
        created_at: row.get("created_at"),
    })
}

fn row_to_data_snapshot(row: &Row) -> Result<DataSnapshotRecord, PgStorageError> {
    if !row.get::<_, bool>("references_valid") {
        return Err(SnapshotError::Reference.into());
    }
    let snapshot = DataSnapshotRecord {
        fields: crate::snapshot::DataSnapshotFields {
            snapshot_id: SnapshotId::from_uuid(row.get::<_, Uuid>("id")),
            tenant_id: TenantId::from_uuid(row.get("tenant_id")),
            schema_name: row.get("schema_name"),
            schema_version: SchemaVersion::parse(row.get::<_, String>("schema_version").as_str())?,
            schema_entry_id: row
                .get::<_, Option<Uuid>>("schema_entry_id")
                .map(SchemaEntryId::from_uuid),
            window: crate::SnapshotWindow {
                start_at: row.get("window_start_at"),
                end_at: row.get("window_end_at"),
            },
            sources: serde_json::from_value(row.get("sources"))?,
            quality: crate::SnapshotQuality::parse(row.get::<_, String>("quality").as_str())?,
            quality_findings: serde_json::from_value(row.get("quality_findings"))?,
            license_label: row.get("license_label"),
            captured_at: row.get("captured_at"),
            max_age_secs: row.get("max_age_secs"),
            expires_at: row.get("expires_at"),
            symbols: serde_json::from_value(row.get("symbols"))?,
            artifact_refs: serde_json::from_value(row.get("artifact_refs"))?,
            lineage: serde_json::from_value(row.get("lineage"))?,
            content_hash: ContentHash::parse(row.get::<_, String>("content_hash").as_str())?,
            created_at: row.get("created_at"),
        },
    };
    snapshot.validate_integrity()?;
    Ok(snapshot)
}

fn row_to_snapshot_quality_rule(row: &Row) -> Result<SnapshotQualityRule, PgStorageError> {
    Ok(SnapshotQualityRule {
        tenant_id: TenantId::from_uuid(row.get("tenant_id")),
        usage: crate::SnapshotUsage::parse(row.get::<_, String>("usage_scope").as_str())?,
        allow_pending: row.get("allow_pending"),
        allow_degraded: row.get("allow_degraded"),
        allow_failed: row.get("allow_failed"),
        require_license: row.get("require_license"),
        require_freshness: row.get("require_freshness"),
        updated_at: row.get("updated_at"),
    })
}
