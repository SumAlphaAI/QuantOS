use std::{collections::BTreeMap, env};

use bytes::Bytes;
use chrono::Utc;
use native_tls::TlsConnector;
use postgres::{Client, NoTls};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{ContentHash, TenantId};
use quantos_storage::{
    ArtifactManifest,
    pg::PgStorageStore,
    supabase_storage::{SupabaseStorageAdapter, SupabaseStorageConfig},
};
use url::Url;

struct TenantCleanup {
    database_url: String,
    tenant_id: TenantId,
}

impl Drop for TenantCleanup {
    fn drop(&mut self) {
        if let Ok(mut client) = connect_client(&self.database_url) {
            let _ = client.execute(
                "delete from quantos.tenants where id = $1",
                &[self.tenant_id.as_uuid()],
            );
        }
    }
}

#[test]
fn supabase_storage_adapter_round_trips_artifacts_and_registers_manifest() {
    if env::var("QUANTOS_RUN_SUPABASE_STORAGE_TESTS")
        .ok()
        .as_deref()
        != Some("1")
    {
        eprintln!(
            "skipping Supabase Storage integration test: QUANTOS_RUN_SUPABASE_STORAGE_TESTS is not set"
        );
        return;
    }

    let Some(database_url) = env::var("DATABASE_URL").ok() else {
        eprintln!("skipping Supabase Storage integration test: DATABASE_URL is not set");
        return;
    };
    let Some(project_url) = env::var("SUPABASE_URL").ok() else {
        eprintln!("skipping Supabase Storage integration test: SUPABASE_URL is not set");
        return;
    };
    let Some(service_role_key) = env::var("SUPABASE_SERVICE_ROLE_KEY").ok() else {
        eprintln!(
            "skipping Supabase Storage integration test: SUPABASE_SERVICE_ROLE_KEY is not set"
        );
        return;
    };

    let bucket_name =
        env::var("SUPABASE_STORAGE_BUCKET").unwrap_or_else(|_| "quantos-artifacts".to_owned());
    let authorization_token = env::var("SUPABASE_STORAGE_AUTH_TOKEN")
        .ok()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| service_role_key.clone());
    let tenant_id = TenantId::new();
    let _cleanup = seed_tenant(&database_url, tenant_id);
    let mut storage = PgStorageStore::connect(&database_url).expect("connects to PostgreSQL");
    let adapter = SupabaseStorageAdapter::connect(SupabaseStorageConfig {
        project_url,
        bucket_name: bucket_name.clone(),
        api_key: service_role_key,
        authorization_token: Some(authorization_token),
        upsert: true,
    })
    .expect("connects to Supabase Storage");

    let payload = Bytes::from_static(br#"{"artifact":"supabase-storage-proof"}"#);
    let hash = ContentHash::sha256_bytes(&payload);
    let mut manifest = ArtifactManifest::new(
        tenant_id,
        "application/json",
        hash.clone(),
        bucket_name,
        payload.len() as u64,
        Utc::now(),
    );
    manifest.metadata = BTreeMap::from([("source".to_owned(), "supabase-storage-live".to_owned())]);

    let persisted = adapter
        .upload_and_register(&mut storage, &manifest, payload.clone())
        .expect("artifact uploads and registers");
    assert_eq!(persisted.content_hash, hash);

    let downloaded = adapter
        .get_artifact(&persisted)
        .expect("artifact downloads from Supabase Storage");
    assert_eq!(downloaded, payload);

    let fetched = storage
        .find_artifact_by_hash(tenant_id, &hash)
        .expect("artifact query succeeds")
        .expect("artifact exists");
    assert_eq!(fetched.object_key, persisted.object_key);
    assert_eq!(fetched.storage_bucket, persisted.storage_bucket);
    assert_eq!(fetched.metadata["source"], "supabase-storage-live");

    adapter
        .delete_artifact(&persisted)
        .expect("artifact deletes from Supabase Storage");
}

fn seed_tenant(database_url: &str, tenant_id: TenantId) -> TenantCleanup {
    let mut client = connect_client(database_url).expect("connects for setup");
    let slug = format!("f05-supabase-storage-{}", tenant_id);
    client
        .execute(
            "insert into quantos.tenants (id, slug, name) values ($1, $2, $3)
             on conflict (id) do nothing",
            &[tenant_id.as_uuid(), &slug, &slug],
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
