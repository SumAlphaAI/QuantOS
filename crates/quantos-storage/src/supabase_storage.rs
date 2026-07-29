use std::time::Duration;

use bytes::Bytes;
use reqwest::{
    StatusCode,
    blocking::Client,
    header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue},
};
use thiserror::Error;
use url::Url;

use crate::{ArtifactManifest, pg::PgStorageStore};
use quantos_core::ContentHash;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SupabaseStorageConfig {
    pub project_url: String,
    pub bucket_name: String,
    pub api_key: String,
    pub authorization_token: Option<String>,
    pub upsert: bool,
}

impl Default for SupabaseStorageConfig {
    fn default() -> Self {
        Self {
            project_url: "https://your-project-ref.supabase.co".to_owned(),
            bucket_name: "quantos-artifacts".to_owned(),
            api_key: "replace-with-service-role-key".to_owned(),
            authorization_token: None,
            upsert: true,
        }
    }
}

#[derive(Debug, Error)]
pub enum SupabaseStorageError {
    #[error(transparent)]
    Transport(#[from] reqwest::Error),
    #[error(transparent)]
    InvalidHeaderValue(#[from] reqwest::header::InvalidHeaderValue),
    #[error(transparent)]
    Persist(#[from] crate::pg::PgStorageError),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error("Supabase Storage request failed with status {status}: {body}")]
    HttpStatus { status: StatusCode, body: String },
    #[error("artifact hash mismatch: expected {expected}, got {actual}")]
    HashMismatch { expected: String, actual: String },
}

pub struct SupabaseStorageAdapter {
    client: Client,
    config: SupabaseStorageConfig,
}

impl SupabaseStorageAdapter {
    pub fn connect(config: SupabaseStorageConfig) -> Result<Self, SupabaseStorageError> {
        Url::parse(&config.project_url)?;

        let mut default_headers = HeaderMap::new();
        default_headers.insert("apikey", HeaderValue::from_str(&config.api_key)?);
        default_headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", config.auth_token()))?,
        );

        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .default_headers(default_headers)
            .build()?;

        Ok(Self { client, config })
    }

    pub fn put_artifact(
        &self,
        manifest: &ArtifactManifest,
        payload: Bytes,
    ) -> Result<(), SupabaseStorageError> {
        validate_payload_hash(&manifest.content_hash, &payload)?;

        let response = self
            .client
            .post(self.object_url(manifest))
            .header(CONTENT_TYPE, manifest.media_type.as_str())
            .header(
                "x-upsert",
                if self.config.upsert { "true" } else { "false" },
            )
            .body(payload.to_vec())
            .send()?;

        self.ensure_success(response)
    }

    pub fn get_artifact(&self, manifest: &ArtifactManifest) -> Result<Bytes, SupabaseStorageError> {
        let response = self.client.get(self.object_url(manifest)).send()?;
        let response = self.ensure_success_response(response)?;
        let bytes = response.bytes()?;
        validate_payload_hash(&manifest.content_hash, &bytes)?;
        Ok(bytes)
    }

    pub fn delete_artifact(&self, manifest: &ArtifactManifest) -> Result<(), SupabaseStorageError> {
        let response = self.client.delete(self.object_url(manifest)).send()?;
        self.ensure_success(response)
    }

    pub fn upload_and_register(
        &self,
        storage: &mut PgStorageStore,
        manifest: &ArtifactManifest,
        payload: Bytes,
    ) -> Result<ArtifactManifest, SupabaseStorageError> {
        self.put_artifact(manifest, payload)?;

        match storage.upsert_artifact(manifest) {
            Ok(persisted) => Ok(persisted),
            Err(error) => {
                let _ = self.delete_artifact(manifest);
                Err(error.into())
            }
        }
    }

    fn object_url(&self, manifest: &ArtifactManifest) -> String {
        format!(
            "{}/storage/v1/object/{}/{}",
            self.config.project_url.trim_end_matches('/'),
            manifest.storage_bucket,
            manifest.object_key.trim_start_matches('/')
        )
    }

    fn ensure_success(
        &self,
        response: reqwest::blocking::Response,
    ) -> Result<(), SupabaseStorageError> {
        self.ensure_success_response(response).map(|_| ())
    }

    fn ensure_success_response(
        &self,
        response: reqwest::blocking::Response,
    ) -> Result<reqwest::blocking::Response, SupabaseStorageError> {
        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }

        let body = response
            .text()
            .unwrap_or_else(|_| "<unavailable>".to_owned());
        Err(SupabaseStorageError::HttpStatus { status, body })
    }
}

impl SupabaseStorageConfig {
    fn auth_token(&self) -> &str {
        self.authorization_token
            .as_deref()
            .unwrap_or(self.api_key.as_str())
    }
}

fn validate_payload_hash(
    expected: &ContentHash,
    payload: &Bytes,
) -> Result<(), SupabaseStorageError> {
    let actual = ContentHash::sha256_bytes(payload);
    if &actual != expected {
        return Err(SupabaseStorageError::HashMismatch {
            expected: expected.as_str().to_owned(),
            actual: actual.as_str().to_owned(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use bytes::Bytes;

    use super::{SupabaseStorageAdapter, SupabaseStorageConfig, validate_payload_hash};
    use crate::ArtifactManifest;
    use chrono::{TimeZone, Utc};
    use quantos_core::{ContentHash, TenantId};

    #[test]
    fn object_url_points_to_supabase_storage_endpoint() {
        let tenant_id = TenantId::new();
        let payload = Bytes::from_static(br#"{"artifact":"payload"}"#);
        let manifest = ArtifactManifest::new(
            tenant_id,
            "application/json",
            ContentHash::sha256_bytes(&payload),
            "quantos-artifacts",
            payload.len() as u64,
            Utc.with_ymd_and_hms(2026, 7, 28, 12, 0, 0)
                .single()
                .expect("valid timestamp"),
        );

        let adapter = SupabaseStorageAdapter::connect(SupabaseStorageConfig {
            project_url: "https://example.supabase.co/".to_owned(),
            bucket_name: "quantos-artifacts".to_owned(),
            api_key: "test-key".to_owned(),
            authorization_token: None,
            upsert: true,
        })
        .expect("adapter builds");

        assert_eq!(
            adapter.object_url(&manifest),
            format!(
                "https://example.supabase.co/storage/v1/object/{}/{}",
                manifest.storage_bucket, manifest.object_key
            )
        );
    }

    #[test]
    fn payload_hash_validation_rejects_mismatch() {
        let error = validate_payload_hash(
            &ContentHash::sha256_bytes(br#"{"expected":"payload"}"#),
            &Bytes::from_static(br#"{"actual":"payload"}"#),
        )
        .expect_err("hash mismatch should be rejected");

        assert!(error.to_string().contains("artifact hash mismatch"));
    }
}
