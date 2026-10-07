use std::time::Duration;

use bytes::Bytes;
use reqwest::{
    StatusCode,
    blocking::Client,
    header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue},
};
use thiserror::Error;
use url::Url;

use crate::{
    ArtifactManifest, object_key_for_content,
    pg::{PgStorageStore, SnapshotWriteContext},
};
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
            upsert: false,
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
    #[error("ARTIFACT_INVALID_MANIFEST: tenant/hash path, bucket, media type or size is invalid")]
    InvalidManifest,
    #[error(
        "ARTIFACT_REGISTRATION_RECOVERY_PENDING: upload attempt {attempt} retained for reconciliation"
    )]
    RecoveryPending { attempt: uuid::Uuid },
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
        self.validate_manifest(manifest)?;
        if manifest.size_bytes != payload.len() as u64 {
            return Err(SupabaseStorageError::InvalidManifest);
        }
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
        self.validate_manifest(manifest)?;
        let response = self.client.get(self.object_url(manifest)).send()?;
        let response = self.ensure_success_response(response)?;
        let bytes = response.bytes()?;
        validate_payload_hash(&manifest.content_hash, &bytes)?;
        Ok(bytes)
    }

    pub fn delete_artifact(&self, manifest: &ArtifactManifest) -> Result<(), SupabaseStorageError> {
        self.validate_manifest(manifest)?;
        let response = self.client.delete(self.object_url(manifest)).send()?;
        self.ensure_success(response)
    }

    /// Persist recovery intent before HTTP. An uncertain upload is reconciled;
    /// registration failure never deletes a content-addressed existing object.
    pub fn upload_and_register(
        &self,
        storage: &mut PgStorageStore,
        manifest: &ArtifactManifest,
        payload: Bytes,
        context: &SnapshotWriteContext,
    ) -> Result<ArtifactManifest, SupabaseStorageError> {
        self.validate_manifest(manifest)?;
        context
            .validate(manifest.tenant_id)
            .map_err(crate::pg::PgStorageError::from)?;
        if manifest.size_bytes != payload.len() as u64 {
            return Err(SupabaseStorageError::InvalidManifest);
        }
        validate_payload_hash(&manifest.content_hash, &payload)?;
        let attempt = storage.prepare_artifact_upload(manifest, context)?;
        // Force create-only even when a low-level caller configured upsert.
        let response = self
            .client
            .post(self.object_url(manifest))
            .header(CONTENT_TYPE, &manifest.media_type)
            .header("x-upsert", "false")
            .body(payload.to_vec())
            .send();
        let upload = response
            .map_err(SupabaseStorageError::from)
            .and_then(|response| {
                if response.status().is_success() {
                    return Ok(());
                }
                let status = response.status();
                let body = response.text().unwrap_or_default();
                let duplicate = status == StatusCode::CONFLICT
                    || (status == StatusCode::BAD_REQUEST
                        && serde_json::from_str::<serde_json::Value>(&body)
                            .ok()
                            .is_some_and(|b| {
                                b["statusCode"] == "409" || b["error"] == "Duplicate"
                            }));
                if duplicate {
                    self.get_artifact(manifest).map(|_| ())
                } else {
                    Err(SupabaseStorageError::HttpStatus { status, body })
                }
            });
        storage.record_storage_outcome(manifest.tenant_id, upload.is_err());
        if let Err(error) = upload {
            if storage
                .finish_artifact_upload(attempt, false, context)
                .is_err()
            {
                return Err(SupabaseStorageError::RecoveryPending { attempt });
            }
            return Err(error);
        }
        match storage.upsert_artifact(manifest) {
            Ok(persisted) => {
                storage.finish_artifact_upload(attempt, true, context)?;
                Ok(persisted)
            }
            Err(_) => {
                let _ = storage.finish_artifact_upload(attempt, false, context);
                Err(SupabaseStorageError::RecoveryPending { attempt })
            }
        }
    }

    /// Explicit retry after checking the existing object. Never deletes an object;
    /// unknown/missing/corrupt objects retain their prepared/reconcile state.
    pub fn reconcile_upload(
        &self,
        storage: &mut PgStorageStore,
        attempt: uuid::Uuid,
        context: &SnapshotWriteContext,
    ) -> Result<ArtifactManifest, SupabaseStorageError> {
        let manifest = storage.artifact_upload_manifest(attempt, context)?;
        self.get_artifact(&manifest)?;
        let persisted = storage.upsert_artifact(&manifest)?;
        storage.finish_artifact_upload(attempt, true, context)?;
        Ok(persisted)
    }

    fn validate_manifest(&self, manifest: &ArtifactManifest) -> Result<(), SupabaseStorageError> {
        if manifest.storage_bucket != self.config.bucket_name
            || manifest.object_key
                != object_key_for_content(&manifest.tenant_id, &manifest.content_hash)
            || manifest.media_type.trim().is_empty()
            || manifest.size_bytes > i64::MAX as u64
        {
            return Err(SupabaseStorageError::InvalidManifest);
        }
        Ok(())
    }

    pub fn get_artifact_recorded(
        &self,
        storage: &mut PgStorageStore,
        manifest: &ArtifactManifest,
    ) -> Result<Bytes, SupabaseStorageError> {
        let result = self.get_artifact(manifest);
        storage.record_storage_outcome(manifest.tenant_id, result.is_err());
        result
    }

    pub fn delete_artifact_recorded(
        &self,
        storage: &mut PgStorageStore,
        manifest: &ArtifactManifest,
    ) -> Result<(), SupabaseStorageError> {
        let result = self.delete_artifact(manifest);
        storage.record_storage_outcome(manifest.tenant_id, result.is_err());
        result
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
#[path = "../tests/unit/supabase_storage.rs"]
mod tests;
