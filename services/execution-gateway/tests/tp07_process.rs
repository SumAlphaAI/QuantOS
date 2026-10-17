#[allow(dead_code)] // shared fixture API is also exercised by the execution-crate tests
#[path = "../../../crates/quantos-execution/tests/support/tp07_fixture.rs"]
mod fixture;
use execution_gateway::X03CommandService;
use fixture::Fixture;
use quantos_execution::{gateway::*, process_kernel::PaperProcessKernel};
use quantos_risk::guard::Phase;
use rust_decimal::Decimal;
use std::{
    path::{Path, PathBuf},
    time::Duration,
};
fn limits() -> GatewayLimits {
    GatewayLimits {
        max_quantity: Decimal::new(1000, 0),
        max_notional: Decimal::new(100_000, 0),
        allowed_venues: vec!["OWNED_PAPER".into()],
    }
}
#[test]
fn tp07_real_paper_child_consumes_x03_once_and_maps_owned_order_fill() {
    let f = Fixture::new();
    let g = f.guard();
    let i = f.issuer(&g);
    let p = f.register(&i);
    let d = f.eval(&g, Phase::Pre);
    let c = i.issue(&f.auth, &p, &d, None, f.sources(), f.now).unwrap();
    let kernel = PaperProcessKernel::spawn(
        Path::new(env!("CARGO_BIN_EXE_execution-gateway")),
        Duration::from_secs(1),
    )
    .unwrap();
    assert_ne!(kernel.pid(), std::process::id());
    let service = X03CommandService::new(i, limits(), kernel).unwrap();
    let mut order = None;
    for _ in 0..1000 {
        let r = service.submit(&f.auth, &c, f.sources(), f.now).unwrap();
        assert_eq!(r.order.status, "filled");
        assert_eq!(r.fills.len(), 1);
        assert_eq!(r.order.command_id, c.command_id.to_string());
        assert_eq!(r.fills[0].filled_at, f.now);
        assert_eq!(
            order.get_or_insert(r.order.order_id.clone()),
            &r.order.order_id
        );
    }
    assert_eq!(service.downstream_submission_count(), Some(1));
    drop(service);
    // Drop kills/waits; /proc is additionally available on Linux.
}
struct FixtureProcess {
    directory: PathBuf,
    executable: PathBuf,
}
impl Drop for FixtureProcess {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.directory);
    }
}
fn process(mode: &str) -> FixtureProcess {
    let directory = std::env::temp_dir().join(format!("quantos-tp07-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&directory).unwrap();
    let executable = directory.join("kernel.py");
    let body = format!(
        r#"#!/usr/bin/python3
import os, sys, json, time
assert not any(k in os.environ for k in ('DATABASE_URL','SUPABASE_URL','TOKEN','SECRET','SIGNING_KEY'))
mode={mode:?}
if mode=='handshake':
 print(json.dumps({{'schema':'wrong','backend':'QUANTOS_PAPER','pid':os.getpid()}}),flush=True);sys.exit(0)
print(json.dumps({{'schema':'quantos-kernel/v1','backend':'QUANTOS_PAPER','pid':os.getpid()}}),flush=True)
for line in sys.stdin:
 request=json.loads(line)
 assert set(request)=={{'schema','request_id','order','submitted_at'}}
 forbidden=('tenant_id','actor_id','requester','session','token','approval','signature','decision')
 assert not any(key in request['order'] for key in forbidden)
 if mode=='timeout': time.sleep(3)
 if mode=='crash': sys.exit(1)
 if mode=='oversize': print('x'*70000,flush=True);continue
 reply={{'schema':'quantos-kernel/v1','request_id':request['request_id'],'events':[]}}
 if mode=='wrong_id': reply['request_id']='foreign'
 if mode=='unknown_field': reply['secret']='unexpected'
 if mode=='unknown_event': reply['events']=[{{'kind':'order_accepted','command_id':'foreign','venue_order_id':'v','at':request['submitted_at']}}]
 if mode=='no_newline': sys.stdout.write(json.dumps(reply));sys.stdout.flush();sys.exit(0)
 print(json.dumps(reply),flush=True)
"#
    );
    std::fs::write(&executable, body).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    FixtureProcess {
        directory,
        executable,
    }
}
#[test]
fn tp07_process_protocol_timeout_crash_malformed_and_unbound_reply_fail_closed() {
    for mode in [
        "timeout",
        "crash",
        "oversize",
        "wrong_id",
        "unknown_field",
        "unknown_event",
        "no_newline",
    ] {
        let f = Fixture::new();
        let g = f.guard();
        let i = f.issuer(&g);
        let p = f.register(&i);
        let d = f.eval(&g, Phase::Pre);
        let c = i.issue(&f.auth, &p, &d, None, f.sources(), f.now).unwrap();
        let fixture = process(mode);
        let kernel =
            PaperProcessKernel::spawn(&fixture.executable, Duration::from_millis(50)).unwrap();
        let s = X03CommandService::new(i, limits(), kernel).unwrap();
        for _ in 0..2 {
            assert!(s.submit(&f.auth, &c, f.sources(), f.now).is_err(), "{mode}");
        }
        assert_eq!(s.downstream_submission_count(), Some(1));
    }
}
#[test]
fn tp07_process_configuration_and_handshake_are_validated() {
    assert!(PaperProcessKernel::spawn(Path::new("relative"), Duration::from_secs(1)).is_err());
    let fixture = process("handshake");
    assert!(PaperProcessKernel::spawn(&fixture.executable, Duration::from_secs(1)).is_err());
    assert!(PaperProcessKernel::spawn(&fixture.executable, Duration::ZERO).is_err());
    assert!(PaperProcessKernel::spawn(&fixture.executable, Duration::from_secs(2)).is_err());
}

#[test]
fn tp07_reference_process_protocol_replays_exact_wire_without_identity_fields() {
    use quantos_execution::process_kernel::PROTOCOL;
    use std::{
        io::Write,
        process::{Command, Stdio},
    };
    let now = chrono::Utc::now();
    let boundary = BoundaryCommand {
        command_id: quantos_core::CommandId::new().to_string(),
        account_id: "not-forwarded-account".into(),
        venue: "OWNED_PAPER".into(),
        venue_kind: "cex".into(),
        symbol: "BTCUSDT".into(),
        intent: "limit".into(),
        side: "buy".into(),
        quantity: "1".into(),
        limit_price: Some("100".into()),
        stop_price: None,
        idempotency_key: "not-forwarded-user-key".into(),
        expires_at: now + chrono::Duration::seconds(5),
    };
    let wire = NautilusBoundaryAdapter::wire_command(&boundary);
    let request = serde_json::json!({"schema":PROTOCOL,"request_id":boundary.command_id,"order":wire,"submitted_at":now});
    let bytes = serde_json::to_vec(&request).unwrap();
    assert!(!String::from_utf8_lossy(&bytes).contains("not-forwarded"));
    let mut process = Command::new(env!("CARGO_BIN_EXE_execution-gateway"));
    process
        .arg("--tp07-paper-kernel")
        .env_clear()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    // Test-only instrumentation channel. Production PaperProcessKernel still env_clear's everything.
    if let Some(profile) = std::env::var_os("LLVM_PROFILE_FILE") {
        process.env("LLVM_PROFILE_FILE", profile);
    }
    let mut child = process.spawn().unwrap();
    let pid = child.id();
    let mut input = child.stdin.take().unwrap();
    for _ in 0..2 {
        input.write_all(&bytes).unwrap();
        input.write_all(b"\n").unwrap();
    }
    drop(input);
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    let rows: Vec<serde_json::Value> = output
        .stdout
        .split(|b| *b == b'\n')
        .filter(|b| !b.is_empty())
        .map(|line| serde_json::from_slice(line).unwrap())
        .collect();
    assert_eq!(rows.len(), 3);
    assert_eq!(rows[0]["pid"], pid);
    assert_eq!(rows[0]["backend"], "QUANTOS_PAPER");
    assert_eq!(rows[1], rows[2]);
    assert_eq!(rows[1]["events"].as_array().unwrap().len(), 2);
}
