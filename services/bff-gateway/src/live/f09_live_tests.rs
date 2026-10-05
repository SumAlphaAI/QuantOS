use super::*;

use std::{collections::HashSet, env, fs};

use axum::{body::Body, http::Request};
use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use postgres::{Client, NoTls, types::Type};
use postgres_openssl::MakeTlsConnector;
use sha2::{Digest, Sha256};
use tower::ServiceExt;
use url::Url;

fn connect_admin(database_url: &str) -> Client {
    let url = Url::parse(database_url).expect("F09 database URL parses");
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
    let root = url
        .query_pairs()
        .find(|(key, _)| key == "sslrootcert")
        .map(|(_, value)| value.into_owned())
        .or_else(|| env::var("QUANTOS_BFF_SSLROOTCERT").ok());
    let options = url
        .query_pairs()
        .filter(|(key, _)| key != "sslmode" && key != "sslrootcert")
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    let mut connection_url = url.clone();
    connection_url.set_query(None);
    if !options.is_empty() {
        connection_url.query_pairs_mut().extend_pairs(options);
    }
    let mut config: postgres::Config = connection_url.as_str().parse().expect("database config");
    if local {
        config.ssl_mode(postgres::config::SslMode::Disable);
        return config.connect(NoTls).expect("local test database connects");
    }
    let mut builder = SslConnector::builder(SslMethod::tls()).expect("TLS builder");
    builder.set_verify(SslVerifyMode::PEER);
    if let Some(root) = root {
        builder.set_ca_file(root).expect("F09 CA file loads");
    } else {
        builder
            .set_default_verify_paths()
            .expect("system CA paths load");
    }
    config.ssl_mode(postgres::config::SslMode::Require);
    config
        .connect(MakeTlsConnector::new(builder.build()))
        .expect("test Supabase connects with certificate verification")
}

fn seed_auth_user(db: &mut Client, user_id: Uuid) {
    let columns = db
        .query(
            "select column_name from information_schema.columns
             where table_schema='auth' and table_name='users'",
            &[],
        )
        .expect("Auth catalog reads")
        .into_iter()
        .map(|row| row.get::<_, String>(0))
        .collect::<HashSet<_>>();
    let email = format!("f09-trace-{user_id}@example.invalid");
    let candidates = [
        ("id", format!("'{user_id}'::uuid")),
        ("aud", "'authenticated'".into()),
        ("role", "'authenticated'".into()),
        ("email", format!("'{email}'")),
        ("encrypted_password", "'not-used'".into()),
        ("email_confirmed_at", "now()".into()),
        ("raw_app_meta_data", "'{}'::jsonb".into()),
        ("raw_user_meta_data", "'{}'::jsonb".into()),
        ("created_at", "now()".into()),
        ("updated_at", "now()".into()),
        ("confirmation_token", "''".into()),
        ("recovery_token", "''".into()),
        ("email_change", "''".into()),
        ("email_change_token_new", "''".into()),
        ("email_change_token_current", "''".into()),
        ("email_change_confirm_status", "0".into()),
        ("is_super_admin", "false".into()),
        ("is_sso_user", "false".into()),
        ("is_anonymous", "false".into()),
    ];
    let selected = candidates
        .into_iter()
        .filter(|(name, _)| columns.contains(*name))
        .collect::<Vec<_>>();
    let names = selected
        .iter()
        .map(|(name, _)| *name)
        .collect::<Vec<_>>()
        .join(", ");
    let values = selected
        .iter()
        .map(|(_, value)| value.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    db.batch_execute(&format!(
        "insert into auth.users ({names}) values ({values}) on conflict (id) do nothing"
    ))
    .expect("F09 Auth fixture inserts");
}

#[test]
#[ignore = "Supabase target test: run explicitly with QUANTOS_RUN_F09_POSTGRES_TESTS=1"]
fn real_logout_db_write_matches_persistent_trace() {
    assert_eq!(
        env::var("QUANTOS_RUN_F09_POSTGRES_TESTS").as_deref(),
        Ok("1"),
        "explicit Supabase target test requires QUANTOS_RUN_F09_POSTGRES_TESTS=1"
    );
    let database_url = env::var("DATABASE_URL").expect("F09 database URL required");
    let project_url = env::var("SUPABASE_URL").expect("F09 Supabase URL required");
    // This logout/trace component fixture uses the configured test connection,
    // just like its middleware and owned session setup. It never runs an A2
    // settings handler; production still requires its separate narrow BFF URL.
    // Keep one dedicated test identity: audit entries referencing it are
    // append-only, so deleting the user would mutate immutable evidence.
    let user_id = Uuid::parse_str("f0900000-0000-4000-8000-000000000009").unwrap();
    let raw_session = Uuid::new_v4().to_string();
    let session_hash = format!("{:x}", Sha256::digest(raw_session.as_bytes()));
    let mut db = connect_admin(&database_url);
    seed_auth_user(&mut db, user_id);
    db.execute_typed(
        "insert into quantos.bff_sessions(session_hash,user_id,expires_at,mfa_verified)
         values($1,$2,now()+interval '5 minutes',true)",
        &[(&session_hash.as_str(), Type::TEXT), (&user_id, Type::UUID)],
    )
    .expect("real BFF session persists");

    let trace_path = env::temp_dir().join(format!("f09-bff-live-{}.jsonl", Uuid::new_v4()));
    let observer = Arc::new(
        ServiceObservability::with_jsonl_exporter("bff-gateway", &trace_path)
            .expect("persistent BFF trace opens"),
    );
    let origin = "https://f09-trace.example.invalid";
    let state = Arc::new(LiveState {
        verifier: SupabaseAuthVerifier::new(&project_url, "unused-test-key".into())
            .expect("Auth verifier config"),
        middleware: Mutex::new(GatewayAuthMiddleware::connect(&database_url).expect("BFF DB")),
        a2: Mutex::new(settings::A2Store::new(&database_url).expect("test A2 state DB")),
        database_url: database_url.clone(),
        proofs: Mutex::new(BTreeMap::new()),
        mfa: settings::SupabaseMfa::new(&project_url, "unused-test-key".into())
            .expect("MFA config"),
        terminal_origin: origin.into(),
        environment: "dev".into(),
    });
    let router = Router::new()
        .route("/v1/auth/logout", post(logout))
        .with_state(state.clone())
        .layer(middleware::from_fn_with_state(
            observer.clone(),
            trace_write_request,
        ));

    let request = |request_origin: &str| {
        Request::builder()
            .method(Method::POST)
            .uri("/v1/auth/logout")
            .header(header::ORIGIN, request_origin)
            .header(header::COOKIE, format!("quantos_session={raw_session}"))
            .body(Body::empty())
            .expect("logout request")
    };
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("F09 BFF test runtime");
    let rejected = runtime
        .block_on(
            router
                .clone()
                .oneshot(request("https://wrong.example.invalid")),
        )
        .unwrap();
    assert_eq!(rejected.status(), StatusCode::FORBIDDEN);
    assert_eq!(
        db.query_one(
            "select count(*) from quantos.bff_sessions where session_hash=$1",
            &[&session_hash],
        )
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    let rejected_id = rejected.headers()["x-correlation-id"].to_str().unwrap();
    assert!(
        observer
            .render(&format!("/trace/{rejected_id}"))
            .contains("\"status\":\"failed\"")
    );

    let accepted = runtime.block_on(router.oneshot(request(origin))).unwrap();
    assert_eq!(accepted.status(), StatusCode::NO_CONTENT);
    assert_eq!(
        db.query_one(
            "select count(*) from quantos.bff_sessions where session_hash=$1",
            &[&session_hash],
        )
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    let accepted_id = accepted.headers()["x-correlation-id"].to_str().unwrap();
    let trace = observer.render(&format!("/trace/{accepted_id}"));
    assert!(trace.contains("http.post /v1/auth/logout"));
    assert!(trace.contains("\"status\":\"succeeded\""));
    assert!(!trace.contains(&raw_session));
    drop(runtime);
    drop(state);
    fs::remove_file(trace_path).expect("trace fixture cleans up");
    println!("F09 BFF real session revoke and persistent trace share correlation_id={accepted_id}");
}
