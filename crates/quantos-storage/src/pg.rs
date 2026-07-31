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
    ArtifactId, ContentHash, CoreError, SchemaEntryId, SchemaVersion, SnapshotId, TenantId,
    canonical_json_bytes,
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
}

pub struct PgStorageStore {
    client: Client,
}

impl PgStorageStore {
    pub fn connect(database_url: &str) -> Result<Self, PgStorageError> {
        Ok(Self {
            client: connect_client(database_url)?,
        })
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
    ) -> Result<DataSnapshotRecord, PgStorageError> {
        let symbols = serde_json::to_value(&snapshot.symbols)?;
        let sources = serde_json::to_value(&snapshot.sources)?;
        let artifact_refs = serde_json::to_value(&snapshot.artifact_refs)?;
        let lineage = serde_json::to_value(&snapshot.lineage)?;
        let quality_findings = serde_json::to_value(&snapshot.quality_findings)?;
        let row = self.client.query_typed_one(
            "insert into quantos.data_snapshots (
                id, tenant_id, schema_entry_id, schema_name, schema_version,
                window_start_at, window_end_at, captured_at, max_age_secs, expires_at,
                quality, license_label, content_hash, symbols, sources, artifact_refs,
                lineage, quality_findings, created_at
            ) values (
                $1,$2,$3,$4,$5,
                $6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,$16,
                $17,$18,$19
            )
            on conflict (tenant_id, content_hash)
            do update set
                content_hash = quantos.data_snapshots.content_hash
            returning id, tenant_id, schema_entry_id, schema_name, schema_version,
                      window_start_at, window_end_at, captured_at, max_age_secs, expires_at,
                      quality, license_label, content_hash, symbols, sources, artifact_refs,
                      lineage, quality_findings, created_at",
            &[
                (snapshot.snapshot_id.as_uuid(), Type::UUID),
                (snapshot.tenant_id.as_uuid(), Type::UUID),
                (
                    &snapshot.schema_entry_id.map(|value| *value.as_uuid()),
                    Type::UUID,
                ),
                (&snapshot.schema_name, Type::TEXT),
                (&snapshot.schema_version.as_str(), Type::TEXT),
                (&snapshot.window.start_at, Type::TIMESTAMPTZ),
                (&snapshot.window.end_at, Type::TIMESTAMPTZ),
                (&snapshot.captured_at, Type::TIMESTAMPTZ),
                (&snapshot.max_age_secs, Type::INT8),
                (&snapshot.expires_at, Type::TIMESTAMPTZ),
                (&snapshot.quality.as_str(), Type::TEXT),
                (&snapshot.license_label, Type::TEXT),
                (&snapshot.content_hash.as_str(), Type::TEXT),
                (&Json(&symbols), Type::JSONB),
                (&Json(&sources), Type::JSONB),
                (&Json(&artifact_refs), Type::JSONB),
                (&Json(&lineage), Type::JSONB),
                (&Json(&quality_findings), Type::JSONB),
                (&snapshot.created_at, Type::TIMESTAMPTZ),
            ],
        )?;

        row_to_data_snapshot(&row)
    }

    pub fn get_data_snapshot(
        &mut self,
        tenant_id: TenantId,
        snapshot_id: SnapshotId,
    ) -> Result<Option<DataSnapshotRecord>, PgStorageError> {
        let row = self.client.query_typed_opt(
            "select id, tenant_id, schema_entry_id, schema_name, schema_version,
                    window_start_at, window_end_at, captured_at, max_age_secs, expires_at,
                    quality, license_label, content_hash, symbols, sources, artifact_refs,
                    lineage, quality_findings, created_at
             from quantos.data_snapshots
             where tenant_id = $1 and id = $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (snapshot_id.as_uuid(), Type::UUID),
            ],
        )?;

        row.map(|row| row_to_data_snapshot(&row)).transpose()
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
                    lineage, quality_findings, created_at
             from quantos.data_snapshots
             where tenant_id = $1 and content_hash = $2",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (&content_hash.as_str(), Type::TEXT),
            ],
        )?;

        row.map(|row| row_to_data_snapshot(&row)).transpose()
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
                    lineage, quality_findings, created_at
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
    ) -> Result<SnapshotQualityRule, PgStorageError> {
        let row = self.client.query_typed_one(
            "insert into quantos.data_snapshot_quality_rules (
                tenant_id, usage_scope, allow_pending, allow_degraded, allow_failed,
                require_license, require_freshness, updated_at
            ) values ($1,$2,$3,$4,$5,$6,$7,$8)
            on conflict (tenant_id, usage_scope)
            do update set
                allow_pending = excluded.allow_pending,
                allow_degraded = excluded.allow_degraded,
                allow_failed = excluded.allow_failed,
                require_license = excluded.require_license,
                require_freshness = excluded.require_freshness,
                updated_at = excluded.updated_at
            returning tenant_id, usage_scope, allow_pending, allow_degraded, allow_failed,
                      require_license, require_freshness, updated_at",
            &[
                (rule.tenant_id.as_uuid(), Type::UUID),
                (&rule.usage.as_str(), Type::TEXT),
                (&rule.allow_pending, Type::BOOL),
                (&rule.allow_degraded, Type::BOOL),
                (&rule.allow_failed, Type::BOOL),
                (&rule.require_license, Type::BOOL),
                (&rule.require_freshness, Type::BOOL),
                (&rule.updated_at, Type::TIMESTAMPTZ),
            ],
        )?;

        row_to_snapshot_quality_rule(&row)
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
    Ok(DataSnapshotRecord {
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
    })
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
