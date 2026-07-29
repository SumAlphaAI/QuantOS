use std::{collections::BTreeMap, env};

use chrono::Utc;
use native_tls::TlsConnector;
use postgres::{Client, NoTls};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{ContentHash, SchemaVersion, TenantId};
use quantos_storage::{ArtifactManifest, pg::PgStorageStore};
use serde_json::json;
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
fn postgres_storage_store_persists_artifacts_and_schema_registry() {
    let Some(database_url) = env::var("DATABASE_URL").ok() else {
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
}

fn seed_tenant(database_url: &str, tenant_id: TenantId) -> TenantCleanup {
    let mut client = connect_client(database_url).expect("connects for setup");
    let slug = format!("f05-storage-{}", tenant_id);
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
