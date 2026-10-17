#[allow(dead_code)]
#[path = "../../../crates/quantos-execution/tests/support/tp07_fixture.rs"]
mod fixture;
use execution_gateway::X03CommandService;
use fixture::Fixture;
use quantos_execution::{
    gateway::*,
    oms::*,
    process_kernel::{PROTOCOL, PaperProcessKernel},
};
use quantos_risk::guard::Phase;
use rust_decimal::Decimal;
use std::{path::Path, time::Duration};
fn limits() -> GatewayLimits {
    GatewayLimits {
        max_quantity: Decimal::new(1000, 0),
        max_notional: Decimal::new(100_000, 0),
        allowed_venues: vec!["OWNED_PAPER".into()],
    }
}
#[test]
fn x04_real_process_submits_cancels_and_audits_terminal_rejection() {
    for (resting, late) in [(true, false), (true, true), (false, false)] {
        let f = Fixture::new();
        let g = f.guard();
        let i = f.issuer(&g);
        let p = f.register(&i);
        let d = f.eval(&g, Phase::Pre);
        let c = i.issue(&f.auth, &p, &d, None, f.sources(), f.now).unwrap();
        let exe = Path::new(env!("CARGO_BIN_EXE_execution-gateway"));
        let kernel = if resting {
            PaperProcessKernel::spawn_resting(exe, Duration::from_secs(1))
        } else {
            PaperProcessKernel::spawn(exe, Duration::from_secs(1))
        }
        .unwrap();
        let s = X03CommandService::new(i, limits(), kernel).unwrap();
        let first = s.submit(&f.auth, &c, f.sources(), f.now).unwrap();
        assert_eq!(
            first.order.status,
            if resting { "accepted" } else { "filled" }
        );
        assert_eq!(first.fills.len(), usize::from(!resting));
        let now = if late {
            c.expires_at + chrono::Duration::seconds(1)
        } else {
            f.now
        };
        let a = s.cancel(&f.auth, &c, "stable-user-key", now).unwrap();
        assert_eq!(
            a.outcome,
            if resting && !late {
                CancelOutcome::Cancelled
            } else {
                CancelOutcome::Rejected
            }
        );
        assert_eq!(a.latency_micros, Some(10_000));
        for _ in 0..100 {
            assert_eq!(s.cancel(&f.auth, &c, "stable-user-key", now).unwrap(), a);
        }
        assert_eq!(s.downstream_cancel_count(), Some(1));
        assert_eq!(s.downstream_submission_count(), Some(1));
        let history = s.order_history(&f.auth, &c, now).unwrap();
        assert!(
            history
                .iter()
                .any(|f| matches!(f.content, FactKind::CancelRequested { .. }))
        );
    }
}
#[test]
fn x04_native_wire_cancel_replay_is_strict_and_credential_free() {
    use std::{
        io::Write,
        process::{Command, Stdio},
    };
    for late in [false, true] {
        let now = chrono::Utc::now();
        let command = "owned-command";
        let b = BoundaryCommand {
            command_id: command.into(),
            account_id: "never-forward-account".into(),
            venue: "OWNED_PAPER".into(),
            venue_kind: "cex".into(),
            symbol: "BTCUSDT".into(),
            intent: "limit".into(),
            side: "buy".into(),
            quantity: "1".into(),
            limit_price: Some("100".into()),
            stop_price: None,
            idempotency_key: "never-forward-key".into(),
            expires_at: now + chrono::Duration::seconds(1),
        };
        let submit = serde_json::json!({"schema":PROTOCOL,"request_id":command,"order":NautilusBoundaryAdapter::wire_command(&b),"submitted_at":now});
        let r = BoundaryCancel {
            command_id: command.into(),
            venue_order_id: format!(
                "paper-order:{}",
                quantos_core::ContentHash::sha256_bytes(
                    NautilusBoundaryAdapter::wire_command(&b)
                        .client_order_id
                        .as_bytes()
                )
            ),
            cancel_id: "opaque-cancel".into(),
            requested_at: if late {
                now + chrono::Duration::seconds(2)
            } else {
                now
            },
        };
        let cancel = serde_json::json!({"schema":PROTOCOL,"request_id":r.cancel_id,"cancel":NautilusBoundaryAdapter::wire_cancel(&r)});
        let mut process = Command::new(env!("CARGO_BIN_EXE_execution-gateway"));
        process
            .arg("--x04-paper-resting-kernel")
            .env_clear()
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        if let Some(profile) = std::env::var_os("LLVM_PROFILE_FILE") {
            process.env("LLVM_PROFILE_FILE", profile);
        }
        let mut child = process.spawn().unwrap();
        let mut input = child.stdin.take().unwrap();
        for value in [&submit, &cancel, &cancel] {
            let bytes = serde_json::to_vec(value).unwrap();
            let text = String::from_utf8_lossy(&bytes);
            assert!(!text.contains("never-forward"));
            input.write_all(&bytes).unwrap();
            input.write_all(b"\n").unwrap();
        }
        drop(input);
        let out = child.wait_with_output().unwrap();
        assert!(out.status.success());
        let lines: Vec<serde_json::Value> = out
            .stdout
            .split(|b| *b == b'\n')
            .filter(|b| !b.is_empty())
            .map(|b| serde_json::from_slice(b).unwrap())
            .collect();
        assert_eq!(lines.len(), 4);
        assert_eq!(lines[2], lines[3]);
        let events = lines[2]["events"].as_array().unwrap();
        assert_eq!(events.len(), if late { 2 } else { 1 });
        assert_eq!(
            events.last().unwrap()["kind"],
            if late {
                "cancel_rejected"
            } else {
                "order_cancelled"
            }
        );
        if late {
            assert_eq!(events[0]["kind"], "order_expired");
        }
    }
}
#[test]
fn x04_cancel_transport_timeout_crash_and_binding_faults_are_uncertain() {
    use std::os::unix::fs::PermissionsExt;
    for mode in [
        "timeout",
        "crash",
        "wrong_id",
        "wrong_command",
        "wrong_venue",
        "wrong_cancel",
        "wrong_time",
        "malformed",
        "empty",
    ] {
        let dir = std::env::temp_dir().join(format!("quantos-x04-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&dir).unwrap();
        let path = dir.join("kernel.py");
        let code = format!(
            r#"#!/usr/bin/python3
import os,sys,json,time
mode={mode:?}
assert not any(k in os.environ for k in ('DATABASE_URL','SUPABASE_URL','TOKEN','SECRET','SIGNING_KEY'))
print(json.dumps({{'schema':'quantos-kernel/v1','backend':'QUANTOS_PAPER','pid':os.getpid()}}),flush=True)
command=None
for line in sys.stdin:
 r=json.loads(line)
 if 'order' in r:
  command=r['request_id']
  print(json.dumps({{'schema':r['schema'],'request_id':command,'events':[{{'kind':'order_accepted','command_id':command,'venue_order_id':'v','at':r['submitted_at']}}]}}),flush=True)
 else:
  assert set(r)=={{'schema','request_id','cancel'}}
  assert set(r['cancel'])=={{'client_order_id','venue_order_id','cancel_id','requested_at'}}
  if mode=='timeout': time.sleep(3)
  if mode=='crash': sys.exit(1)
  if mode=='malformed': print('{{bad json}}',flush=True);continue
  c=r['cancel']
  e={{'kind':'order_cancelled','command_id':command,'venue_order_id':'v','cancel_id':c['cancel_id'],'at':c['requested_at']}}
  if mode=='wrong_command': e['command_id']='foreign'
  if mode=='wrong_venue': e['venue_order_id']='foreign'
  if mode=='wrong_cancel': e['cancel_id']='foreign'
  if mode=='wrong_time': e['at']='2000-01-01T00:00:00Z'
  print(json.dumps({{'schema':r['schema'],'request_id':'foreign' if mode=='wrong_id' else r['request_id'],'events':[] if mode=='empty' else [e]}}),flush=True)
"#
        );
        std::fs::write(&path, code).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).unwrap();
        let f = Fixture::new();
        let g = f.guard();
        let i = f.issuer(&g);
        let p = f.register(&i);
        let d = f.eval(&g, Phase::Pre);
        let c = i.issue(&f.auth, &p, &d, None, f.sources(), f.now).unwrap();
        let kernel = PaperProcessKernel::spawn_resting(&path, Duration::from_millis(50)).unwrap();
        let s = X03CommandService::new(i, limits(), kernel).unwrap();
        s.submit(&f.auth, &c, f.sources(), f.now).unwrap();
        for key in ["first", "first", "new-key"] {
            assert!(s.cancel(&f.auth, &c, key, f.now).is_err(), "{mode}");
        }
        assert_eq!(s.downstream_cancel_count(), Some(1));
        assert!(matches!(
            s.order_history(&f.auth, &c, f.now)
                .unwrap()
                .last()
                .unwrap()
                .content,
            FactKind::CancelUncertain { .. }
        ));
        drop(s);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
