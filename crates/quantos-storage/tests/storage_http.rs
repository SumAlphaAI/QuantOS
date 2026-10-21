//! Deterministic HTTP fault injection; this is not Supabase target acceptance.
use bytes::Bytes;
use chrono::Utc;
use quantos_core::{ContentHash, TenantId};
use quantos_storage::{
    ArtifactManifest,
    pg::{PgStorageStore, SnapshotWriteContext},
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
            socket.set_nonblocking(false).unwrap();
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
            if method == "POST" {
                assert!(
                    request.to_lowercase().contains("x-upsert: false"),
                    "immutable uploads must remain create-only even when the adapter was configured for upsert"
                );
            }
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
        a.put_artifact(&m, Bytes::from_static(b"forged!")),
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
fn invalid_tenant_is_rejected_before_upload_and_success_persists() {
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
    let actor = quantos_core::ActorId::new();
    let context = SnapshotWriteContext {
        tenant_id: m.tenant_id,
        actor_id: actor,
        correlation_id: quantos_core::CorrelationId::new(),
        causation_id: quantos_core::EventId::new(),
        reason: "owned HTTP fixture".into(),
    };
    let (base, server) = serve(vec![]);
    assert!(matches!(
        adapter(base, true).upload_and_register(
            &mut store,
            &m,
            Bytes::from_static(b"payload"),
            &context
        ),
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
    let mut tls_builder =
        openssl::ssl::SslConnector::builder(openssl::ssl::SslMethod::tls()).unwrap();
    tls_builder.set_verify(if relaxed {
        openssl::ssl::SslVerifyMode::NONE
    } else {
        openssl::ssl::SslVerifyMode::PEER
    });
    if let Some((_, root)) = parsed.query_pairs().find(|(k, _)| k == "sslrootcert") {
        tls_builder.set_ca_file(root.as_ref()).unwrap();
    }
    let tls = postgres_openssl::MakeTlsConnector::new(tls_builder.build());
    let mut native_url = parsed.clone();
    let options = parsed
        .query_pairs()
        .filter(|(key, _)| key != "sslrootcert" && key != "sslmode")
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect::<Vec<_>>();
    native_url.set_query(None);
    native_url
        .query_pairs_mut()
        .extend_pairs(options)
        .append_pair("sslmode", "require");
    if parsed
        .query_pairs()
        .any(|(k, v)| k == "sslmode" && v == "disable")
    {
        native_url
            .query_pairs_mut()
            .clear()
            .append_pair("sslmode", "disable");
    }
    let mut db = postgres::Client::connect(native_url.as_str(), tls).unwrap();
    db.execute(
        "insert into quantos.tenants(id,slug,name) values ($1,$2,'http-test')",
        &[
            m.tenant_id.as_uuid(),
            &format!(
                "r02-{}-{}",
                std::env::var("QUANTOS_R02_RUN_ID")
                    .unwrap_or_else(|_| uuid::Uuid::new_v4().to_string()),
                m.tenant_id
            ),
        ],
    )
    .unwrap();
    db.execute("insert into quantos.actors(id,tenant_id,actor_kind,service_name,display_name) values($1,$2,'service','r02-http','R02 HTTP fixture')", &[actor.as_uuid(), m.tenant_id.as_uuid()]).unwrap();
    db.execute("insert into quantos.actor_capabilities(tenant_id,actor_id,capability) values($1,$2,'artifact.write')", &[m.tenant_id.as_uuid(), actor.as_uuid()]).unwrap();
    let (base, server) = serve(vec![("POST", "200 OK", b"")]);
    let persisted = adapter(base, true)
        .upload_and_register(&mut store, &m, Bytes::from_static(b"payload"), &context)
        .unwrap();
    assert_eq!(persisted.content_hash, m.content_hash);
    server.join().unwrap();
    let (base, server) = serve(vec![
        ("GET", "200 OK", b"payload"),
        ("DELETE", "200 OK", b""),
        ("GET", "403 Forbidden", b"denied"),
        ("DELETE", "500 Internal Server Error", b"failed"),
    ]);
    let recorded = adapter(base, false);
    assert_eq!(
        recorded.get_artifact_recorded(&mut store, &m).unwrap(),
        Bytes::from_static(b"payload")
    );
    recorded.delete_artifact_recorded(&mut store, &m).unwrap();
    assert!(
        matches!(recorded.get_artifact_recorded(&mut store, &m), Err(SupabaseStorageError::HttpStatus { status, .. }) if status.as_u16() == 403)
    );
    assert!(
        matches!(recorded.delete_artifact_recorded(&mut store, &m), Err(SupabaseStorageError::HttpStatus { status, .. }) if status.as_u16() == 500)
    );
    server.join().unwrap();
    let metrics = db.query_one(
        "select count(*)::bigint, sum(metric_value)::double precision from quantos.operational_metric_samples where tenant_id=$1 and metric_name='storage_operation_error'",
        &[m.tenant_id.as_uuid()],
    ).unwrap();
    assert_eq!(
        metrics.get::<_, i64>(0),
        5,
        "upload, two reads and two deletes each record an outcome"
    );
    assert_eq!(
        metrics.get::<_, f64>(1),
        2.0,
        "HTTP failures must persist failed outcomes"
    );

    for (status, body, duplicate) in [
        ("409 Conflict", b"exists".as_slice(), true),
        (
            "400 Bad Request",
            br#"{"statusCode":"409"}"#.as_slice(),
            true,
        ),
        (
            "400 Bad Request",
            br#"{"error":"Duplicate"}"#.as_slice(),
            true,
        ),
        ("400 Bad Request", b"invalid JSON".as_slice(), false),
        (
            "400 Bad Request",
            br#"{"error":"Invalid"}"#.as_slice(),
            false,
        ),
        ("503 Unavailable", b"retry".as_slice(), false),
    ] {
        let mut responses = vec![("POST", status, body)];
        if duplicate {
            responses.push(("GET", "200 OK", b"payload"));
        }
        let (base, server) = serve(responses);
        let result = adapter(base, true).upload_and_register(
            &mut store,
            &m,
            Bytes::from_static(b"payload"),
            &context,
        );
        assert_eq!(result.is_ok(), duplicate);
        server.join().unwrap();
    }
    // Resume a real persisted attempt after the upload outcome was uncertain.
    let attempt: uuid::Uuid = db.query_one("select id from quantos.artifact_upload_attempts where tenant_id=$1 and state='reconcile' order by created_at desc limit 1", &[m.tenant_id.as_uuid()]).unwrap().get(0);
    let (base, server) = serve(vec![("GET", "200 OK", b"payload")]);
    let a = adapter(base, false);
    assert_eq!(
        a.reconcile_upload(&mut store, attempt, &context)
            .unwrap()
            .content_hash,
        m.content_hash
    );
    assert!(
        a.reconcile_upload(&mut store, uuid::Uuid::new_v4(), &context)
            .is_err()
    );
    server.join().unwrap();
    assert_eq!(
        db.query_one(
            "select state from quantos.artifact_upload_attempts where id=$1",
            &[&attempt]
        )
        .unwrap()
        .get::<_, String>(0),
        "registered"
    );
    let (base, server) = serve(vec![]);
    let a = adapter(base, false);
    assert!(matches!(
        a.upload_and_register(&mut store, &m, Bytes::from_static(b"short"), &context),
        Err(SupabaseStorageError::InvalidManifest)
    ));
    assert!(matches!(
        a.upload_and_register(&mut store, &m, Bytes::from_static(b"forged!"), &context),
        Err(SupabaseStorageError::HashMismatch { .. })
    ));
    for case in 0..6 {
        let mut bad = context.clone();
        match case {
            0 => bad.tenant_id = TenantId::new(),
            1 => bad.reason.clear(),
            2 => bad.reason = "x".repeat(513),
            3 => bad.actor_id = quantos_core::ActorId::from_uuid(uuid::Uuid::nil()),
            4 => bad.correlation_id = quantos_core::CorrelationId::from_uuid(uuid::Uuid::nil()),
            _ => bad.causation_id = quantos_core::EventId::from_uuid(uuid::Uuid::nil()),
        }
        assert!(
            a.upload_and_register(&mut store, &m, Bytes::from_static(b"payload"), &bad)
                .is_err()
        );
    }
    server.join().unwrap();
    db.execute(
        "update quantos.actors set is_active=false where id=$1 and tenant_id=$2",
        &[actor.as_uuid(), m.tenant_id.as_uuid()],
    )
    .unwrap();
    // Preserve the tenant: cascading deletion must not bypass append-only ledger triggers.
}

#[test]
fn immutable_upload_verifies_existing_bytes_after_uncertain_write() {
    let m = manifest(TenantId::new());
    let (url, server) = serve(vec![
        ("POST", "200 OK", b""),
        ("POST", "409 Conflict", b"exists"),
        ("GET", "200 OK", b"payload"),
        ("POST", "503 Unavailable", b"uncertain"),
        ("GET", "200 OK", b"corrupt"),
    ]);
    let a = adapter(url, true);
    a.put_artifact_immutable(&m, Bytes::from_static(b"payload"))
        .unwrap();
    a.put_artifact_immutable(&m, Bytes::from_static(b"payload"))
        .unwrap();
    assert!(matches!(
        a.put_artifact_immutable(&m, Bytes::from_static(b"payload")),
        Err(SupabaseStorageError::HttpStatus { .. })
    ));
    assert!(matches!(
        a.put_artifact_immutable(&m, Bytes::from_static(b"short")),
        Err(SupabaseStorageError::InvalidManifest)
    ));
    server.join().unwrap();
}
