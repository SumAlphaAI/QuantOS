use quantos_market::{ApprovedProvider, default_approved_providers};
use std::{
    fs,
    path::Path,
    process::{Command, Output},
};
fn run(args: &[&str], trace: &Path) -> Output {
    Command::new(env!("CARGO_BIN_EXE_market-ingestor"))
        .args(args)
        .env("QUANTOS_TRACE_EXPORT_PATH", trace)
        .output()
        .unwrap()
}
#[test]
fn cli_success_rejection_and_config_paths() {
    let root = std::env::temp_dir().join(format!("r01-cli-{}", quantos_core::CorrelationId::new()));
    fs::create_dir_all(&root).unwrap();
    let trace = root.join("trace.jsonl");
    let ticks = root.join("ticks.jsonl");
    let file = ticks.to_str().unwrap();
    let success = run(
        &["generate-replay", "--output", file, "--count", "24"],
        &trace,
    );
    assert!(
        success.status.success(),
        "{}",
        String::from_utf8_lossy(&success.stderr)
    );
    let ingested = run(&["ingest-replay", "--input", file], &trace);
    assert!(ingested.status.success());
    assert!(String::from_utf8_lossy(&ingested.stdout).contains("input=24"));
    let bytes = fs::read(&ticks).unwrap();
    let invalid = run(
        &["generate-replay", "--output", file, "--count", "0"],
        &trace,
    );
    assert!(!invalid.status.success());
    assert_eq!(fs::read(&ticks).unwrap(), bytes);
    for args in [
        vec!["unknown"],
        vec!["ingest-replay", "--input", "/missing-r01-input"],
        vec!["generate-replay", "--output", "/missing-r01-dir/ticks"],
        vec!["dispatch", "--tenant", "invalid", "--consumer", "x"],
        vec![
            "dispatch",
            "--tenant",
            "invalid",
            "--consumer",
            "x",
            "--limit",
            "1001",
        ],
        vec![
            "dispatch",
            "--tenant",
            "invalid",
            "--consumer",
            "x",
            "--limit",
            "0",
        ],
        vec![
            "requeue",
            "--tenant",
            "invalid",
            "--actor",
            "invalid",
            "--dead-letter",
            "invalid",
        ],
    ] {
        assert!(!run(&args, &trace).status.success());
    }
    fs::write(&ticks, "malformed\n").unwrap();
    assert!(
        !run(&["ingest-replay", "--input", file], &trace)
            .status
            .success()
    );
    let approvals = root.join("approval.json");
    let valid: ApprovedProvider = default_approved_providers()
        .approved_provider("approved.binance.spot")
        .unwrap()
        .clone();
    fs::write(
        &approvals,
        serde_json::to_vec(&vec![valid.clone()]).unwrap(),
    )
    .unwrap();
    let a = approvals.to_str().unwrap();
    let base = [
        "ingest-source",
        "--input",
        file,
        "--approvals",
        a,
        "--provider",
        "approved.binance.spot",
        "--tenant",
        "invalid",
        "--actor",
        "invalid",
    ];
    assert!(!run(&base, &trace).status.success());
    let mut fixture = base.to_vec();
    fixture.push("--fixture");
    assert!(!run(&fixture, &trace).status.success());
    let poll = [
        "poll-source",
        "--approvals",
        a,
        "--provider",
        "approved.binance.spot",
        "--tenant",
        "invalid",
        "--actor",
        "invalid",
        "--iterations",
        "0",
    ];
    assert!(!run(&poll, &trace).status.success());
    let mut excessive_poll = poll;
    excessive_poll[10] = "1001";
    assert!(!run(&excessive_poll, &trace).status.success());
    fs::write(&approvals, "invalid").unwrap();
    assert!(!run(&base, &trace).status.success());
    fs::write(&approvals, vec![b'x'; 1_048_577]).unwrap();
    assert!(!run(&base, &trace).status.success());
    let mut live = valid;
    live.approval_reference = "test:record".into();
    fs::write(&approvals, serde_json::to_vec(&vec![live]).unwrap()).unwrap();
    assert!(!run(&base, &trace).status.success());
    let tenant = quantos_core::TenantId::new().to_string();
    let actor = quantos_core::ActorId::new().to_string();
    let poll_config = [
        "poll-source",
        "--approvals",
        a,
        "--provider",
        "approved.binance.spot",
        "--tenant",
        &tenant,
        "--actor",
        &actor,
    ];
    for endpoint in [
        "invalid-url",
        "ftp://example.invalid",
        "http://example.invalid",
        "https://u:p@example.invalid",
        "https://:p@example.invalid",
        "https://example.invalid",
    ] {
        let output = Command::new(env!("CARGO_BIN_EXE_market-ingestor"))
            .args(poll_config)
            .env("QUANTOS_TRACE_EXPORT_PATH", &trace)
            .env("QUANTOS_MARKET_SOURCE_URL", endpoint)
            .env_remove("DATABASE_URL")
            .output()
            .unwrap();
        assert!(!output.status.success());
    }
    assert!(
        !Command::new(env!("CARGO_BIN_EXE_market-ingestor"))
            .args(poll_config)
            .env("QUANTOS_TRACE_EXPORT_PATH", &trace)
            .env_remove("QUANTOS_MARKET_SOURCE_URL")
            .output()
            .unwrap()
            .status
            .success()
    );
    let missing_sink = Command::new(env!("CARGO_BIN_EXE_market-ingestor"))
        .args(["generate-replay", "--output", file, "--count", "2"])
        .env("QUANTOS_TRACE_EXPORT_PATH", "")
        .output()
        .unwrap();
    assert!(!missing_sink.status.success());
    assert!(fs::read_to_string(trace).unwrap().contains("failed"));
    fs::remove_dir_all(root).unwrap();
}
#[test]
fn cli_supabase_fixture_and_recovery_paths() {
    if std::env::var("QUANTOS_RUN_R01_POSTGRES_TESTS").as_deref() != Ok("1") {
        eprintln!("CLI target NOT RUN");
        return;
    }
    let tenant = std::env::var("QUANTOS_R01_CLI_TENANT").unwrap();
    let actor = std::env::var("QUANTOS_R01_CLI_ACTOR").unwrap();
    let root = std::env::temp_dir().join(format!(
        "r01-cli-target-{}",
        quantos_core::CorrelationId::new()
    ));
    fs::create_dir_all(&root).unwrap();
    let trace = root.join("trace.jsonl");
    let ticks = root.join("ticks.jsonl");
    let file = ticks.to_str().unwrap();
    assert!(
        run(
            &["generate-replay", "--output", file, "--count", "3"],
            &trace
        )
        .status
        .success()
    );
    let original = fs::read(&ticks).unwrap();
    let mixed = [b"malformed\n".as_slice(), original.as_slice()].concat();
    fs::write(&ticks, &mixed).unwrap();
    let approvals = root.join("approvals.json");
    let p = default_approved_providers()
        .approved_provider("approved.binance.spot")
        .unwrap()
        .clone();
    fs::write(&approvals, serde_json::to_vec(&vec![p]).unwrap()).unwrap();
    let a = approvals.to_str().unwrap();
    let args = [
        "ingest-source",
        "--input",
        file,
        "--approvals",
        a,
        "--provider",
        "approved.binance.spot",
        "--tenant",
        &tenant,
        "--actor",
        &actor,
        "--fixture",
    ];
    let first = run(&args, &trace);
    assert!(
        first.status.success(),
        "{}",
        String::from_utf8_lossy(&first.stderr)
    );
    assert!(String::from_utf8_lossy(&first.stdout).contains("accepted=3 duplicates=0 rejected=1"));
    let retry = run(&args, &trace);
    assert!(retry.status.success());
    assert!(String::from_utf8_lossy(&retry.stdout).contains("accepted=0 duplicates=3 rejected=1"));
    let dispatch = run(
        &["dispatch", "--tenant", &tenant, "--consumer", "r01-cli"],
        &trace,
    );
    assert!(
        dispatch.status.success(),
        "{}",
        String::from_utf8_lossy(&dispatch.stderr)
    );
    assert!(String::from_utf8_lossy(&dispatch.stdout).contains("processed=4"));
    let mut json: serde_json::Value =
        serde_json::from_slice(original.split(|b| *b == b'\n').next().unwrap()).unwrap();
    json["price"] = "999".into();
    let mut changed = serde_json::to_vec(&json).unwrap();
    changed.push(b'\n');
    fs::write(&ticks, changed).unwrap();
    let result = run(&args, &trace);
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let mut invalid: serde_json::Value =
        serde_json::from_slice(original.split(|b| *b == b'\n').next().unwrap()).unwrap();
    invalid["source_tick_id"] = "".into();
    fs::write(&ticks, serde_json::to_vec(&invalid).unwrap()).unwrap();
    let result = run(&args, &trace);
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    // A real failed delivery and authorized CLI dead-letter replay.
    let tenant_id = quantos_core::TenantId::parse_str(&tenant).unwrap();
    let mut store = quantos_event::pg::PgEventStore::connect_for_outbox_tenants(
        &std::env::var("DATABASE_URL").unwrap(),
        &[tenant_id],
    )
    .unwrap()
    .with_aggregate_scope("market");
    let failed = store
        .poll_outbox_once(
            "r01-cli-test",
            "r01-cli-fault",
            100,
            chrono::Utc::now(),
            chrono::Duration::seconds(30),
            1,
            |_, _| Err("injected".into()),
            |_| Ok(()),
        )
        .unwrap();
    assert!(failed.dead_lettered > 0);
    let dead = store.dead_letters(tenant_id, "r01-cli-fault").unwrap();
    let dead_id = dead[0].dead_letter_id.to_string();
    assert!(
        run(
            &[
                "requeue",
                "--tenant",
                &tenant,
                "--actor",
                &actor,
                "--dead-letter",
                &dead_id
            ],
            &trace
        )
        .status
        .success()
    );
    let no_actor = quantos_core::ActorId::new().to_string();
    let bad = [
        "ingest-source",
        "--input",
        file,
        "--approvals",
        a,
        "--provider",
        "approved.binance.spot",
        "--tenant",
        &tenant,
        "--actor",
        &no_actor,
        "--fixture",
    ];
    fs::write(&ticks, &original).unwrap();
    assert!(!run(&bad, &trace).status.success());
    fs::write(&ticks, vec![b'x'; quantos_market::MAX_LINE_BYTES + 1]).unwrap();
    assert!(!run(&args, &trace).status.success());
    // A loopback HTTP source is allowed only with the explicit fixture flag.
    fn source(
        body: Vec<u8>,
        status: &'static str,
        count: usize,
    ) -> (String, std::thread::JoinHandle<()>) {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let thread = std::thread::spawn(move || {
            for _ in 0..count {
                let (mut socket, _) = listener.accept().unwrap();
                socket
                    .set_read_timeout(Some(std::time::Duration::from_secs(3)))
                    .unwrap();
                let mut request = [0; 4096];
                assert!(socket.read(&mut request).unwrap() > 0);
                write!(
                    socket,
                    "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                )
                .unwrap();
                socket.write_all(&body).unwrap();
            }
        });
        (url, thread)
    }
    let mut raw: serde_json::Value =
        serde_json::from_slice(original.split(|b| *b == b'\n').next().unwrap()).unwrap();
    raw["source_tick_id"] = "poll-unique".into();
    let mut body = serde_json::to_vec(&raw).unwrap();
    body.extend_from_slice(b"\n \ninvalid-json\n");
    let (url, server) = source(body, "200 OK", 2);
    let poll = [
        "poll-source",
        "--approvals",
        a,
        "--provider",
        "approved.binance.spot",
        "--tenant",
        &tenant,
        "--actor",
        &actor,
        "--fixture",
        "--iterations",
        "2",
    ];
    let success = Command::new(env!("CARGO_BIN_EXE_market-ingestor"))
        .args(poll)
        .env("QUANTOS_TRACE_EXPORT_PATH", &trace)
        .env("QUANTOS_MARKET_SOURCE_URL", url)
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(
        success.status.success(),
        "{}",
        String::from_utf8_lossy(&success.stderr)
    );
    let (url, server) = source(vec![], "503 Unavailable", 1);
    let failed = Command::new(env!("CARGO_BIN_EXE_market-ingestor"))
        .args(poll)
        .env("QUANTOS_TRACE_EXPORT_PATH", &trace)
        .env("QUANTOS_MARKET_SOURCE_URL", url)
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(!failed.status.success());
    let (url, server) = source(vec![b'x'; quantos_market::MAX_LINE_BYTES + 1], "200 OK", 1);
    let rejected = Command::new(env!("CARGO_BIN_EXE_market-ingestor"))
        .args(poll)
        .env("QUANTOS_TRACE_EXPORT_PATH", &trace)
        .env("QUANTOS_MARKET_SOURCE_URL", url)
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(!rejected.status.success());
    fs::remove_dir_all(root).unwrap();
}
