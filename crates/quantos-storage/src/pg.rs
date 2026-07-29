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

use crate::{ArtifactManifest, SchemaRegistryEntry};
use quantos_core::{
    ArtifactId, ContentHash, CoreError, SchemaEntryId, SchemaVersion, TenantId,
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
