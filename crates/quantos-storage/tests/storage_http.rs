//! Deterministic HTTP fault injection; this is not Supabase target acceptance.
use bytes::Bytes;
use chrono::Utc;
use quantos_core::{ContentHash, TenantId};
use quantos_storage::{
    ArtifactManifest,
    pg::PgStorageStore,
    supabase_storage::{SupabaseStorageAdapter, SupabaseStorageConfig, SupabaseStorageError},
};
use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
    time::{Duration, Instant},
};

fn serve(
    responses: Vec<(&'static str, &'static str, &'static [u8])>,
) -> (String, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let handle = thread::spawn(move || {
        for (method, status, body) in responses {
            let deadline = Instant::now() + Duration::from_secs(10);
            let mut socket = loop {
                match listener.accept() {
                    Ok((socket, _)) => break socket,
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        assert!(
                            Instant::now() < deadline,
                            "expected HTTP request did not arrive"
                        );
                        thread::sleep(Duration::from_millis(5));
                    }
                    Err(e) => panic!("{e}"),
                }
            };
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = Vec::new();
            let mut buf = [0; 4096];
            loop {
                let n = socket.read(&mut buf).unwrap();
                assert!(n > 0);
                request.extend_from_slice(&buf[..n]);
                if let Some(end) = request.windows(4).position(|w| w == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&request[..end]).to_lowercase();
                    let length = headers
                        .lines()
                        .find_map(|l| l.strip_prefix("content-length: "))
                        .unwrap_or("0")
                        .parse::<usize>()
                        .unwrap();
                    if request.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            let request = String::from_utf8_lossy(&request);
            assert!(request.starts_with(&format!("{method} /storage/v1/object/")));
            assert!(request.to_lowercase().contains("apikey: test-key"));
            assert!(
                request
                    .to_lowercase()
                    .contains("authorization: bearer test-token")
            );
            write!(
                socket,
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            )
            .unwrap();
            socket.write_all(body).unwrap();
        }
    });
    (url, handle)
}
fn adapter(url: String, upsert: bool) -> SupabaseStorageAdapter {
    SupabaseStorageAdapter::connect(SupabaseStorageConfig {
        project_url: url,
        api_key: "test-key".into(),
        authorization_token: Some("test-token".into()),
        upsert,
        ..Default::default()
    })
    .unwrap()
}
fn manifest(tenant: TenantId) -> ArtifactManifest {
    ArtifactManifest::new(
        tenant,
        "application/json",
        ContentHash::sha256_bytes(b"payload"),
        "quantos-artifacts",
        7,
        Utc::now(),
    )
}
#[test]
fn http_success_errors_and_corrupt_downloads() {
    let m = manifest(TenantId::new());
    let (url, server) = serve(vec![
        ("POST", "200 OK", b""),
        ("GET", "200 OK", b"payload"),
        ("DELETE", "200 OK", b""),
        ("GET", "200 OK", b"corrupt"),
        ("POST", "403 Forbidden", b"denied"),
        ("GET", "404 Not Found", b"missing"),
        ("DELETE", "500 Internal Server Error", b"failed"),
    ]);
    let a = adapter(url, false);
    a.put_artifact(&m, Bytes::from_static(b"payload")).unwrap();
    assert_eq!(a.get_artifact(&m).unwrap(), Bytes::from_static(b"payload"));
    a.delete_artifact(&m).unwrap();
    assert!(matches!(
        a.get_artifact(&m),
        Err(SupabaseStorageError::HashMismatch { .. })
    ));
    assert!(
        matches!(a.put_artifact(&m, Bytes::from_static(b"payload")), Err(SupabaseStorageError::HttpStatus { status, body }) if status.as_u16() == 403 && body == "denied")
    );
    assert!(
        matches!(a.get_artifact(&m), Err(SupabaseStorageError::HttpStatus { status, .. }) if status.as_u16() == 404)
    );
    assert!(
        matches!(a.delete_artifact(&m), Err(SupabaseStorageError::HttpStatus { status, .. }) if status.as_u16() == 500)
    );
    server.join().unwrap();
    assert!(matches!(
        a.put_artifact(&m, Bytes::from_static(b"wrong")),
        Err(SupabaseStorageError::HashMismatch { .. })
    ));
    assert!(matches!(
        a.get_artifact(&m),
        Err(SupabaseStorageError::Transport(_))
    ));
}
#[test]
fn invalid_configuration_fails_before_requests() {
    let mut c = SupabaseStorageConfig {
        project_url: "not a URL".into(),
        ..Default::default()
    };
    assert!(matches!(
        SupabaseStorageAdapter::connect(c.clone()),
        Err(SupabaseStorageError::Url(_))
    ));
    c.project_url = "http://127.0.0.1".into();
    c.api_key = "invalid\nheader".into();
    assert!(matches!(
        SupabaseStorageAdapter::connect(c.clone()),
        Err(SupabaseStorageError::InvalidHeaderValue(_))
    ));
    c.api_key = "test-key".into();
    c.authorization_token = Some("invalid\nheader".into());
    assert!(matches!(
        SupabaseStorageAdapter::connect(c),
        Err(SupabaseStorageError::InvalidHeaderValue(_))
    ));
}
#[test]
fn registration_failure_compensates_upload_and_success_persists() {
    let Ok(url) = std::env::var("DATABASE_URL") else {
        assert_ne!(
            std::env::var("QUANTOS_RUN_F05_POSTGRES_TESTS")
                .ok()
                .as_deref(),
            Some("1"),
            "DATABASE_URL required"
        );
        return;
    };
    let mut store = PgStorageStore::connect(&url).unwrap();
    let m = manifest(TenantId::new()); // no tenant: FK must reject registration
    let (base, server) = serve(vec![("POST", "200 OK", b""), ("DELETE", "200 OK", b"")]);
    assert!(matches!(
        adapter(base, true).upload_and_register(&mut store, &m, Bytes::from_static(b"payload")),
        Err(SupabaseStorageError::Persist(_))
    ));
    server.join().unwrap();
    assert!(
        store
            .find_artifact_by_hash(m.tenant_id, &m.content_hash)
            .unwrap()
            .is_none()
    );
    // Match the target TLS support of the production adapter without printing credentials.
    let parsed = url::Url::parse(&url).unwrap();
    let relaxed = parsed
        .query_pairs()
        .any(|(k, v)| k == "sslmode" && matches!(v.as_ref(), "require" | "prefer"));
    let mut tls_builder = native_tls::TlsConnector::builder();
    tls_builder.danger_accept_invalid_certs(relaxed);
    let tls = postgres_native_tls::MakeTlsConnector::new(tls_builder.build().unwrap());
    let mut db = postgres::Client::connect(&url, tls).unwrap();
    db.execute(
        "insert into quantos.tenants(id,slug,name) values ($1,$2,'http-test')",
        &[m.tenant_id.as_uuid(), &format!("http-{}", m.tenant_id)],
    )
    .unwrap();
    let (base, server) = serve(vec![("POST", "200 OK", b"")]);
    let persisted = adapter(base, true)
        .upload_and_register(&mut store, &m, Bytes::from_static(b"payload"))
        .unwrap();
    assert_eq!(persisted.content_hash, m.content_hash);
    server.join().unwrap();
    // Preserve the tenant: cascading deletion must not bypass append-only ledger triggers.
}
