mod support;
use std::{
    io::Write,
    process::{Command, Stdio},
};
use support::*;
fn worker(bytes: Vec<u8>, valid_mode: bool) -> std::process::Output {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_quantos-reconcile"));
    if valid_mode {
        cmd.arg("--x05-offline-reconcile");
    }
    cmd.env_clear()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    if let Some(profile) = std::env::var_os("LLVM_PROFILE_FILE") {
        cmd.env("LLVM_PROFILE_FILE", profile);
    }
    let mut child = cmd.spawn().unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let writer = std::thread::spawn(move || stdin.write_all(&bytes));
    let out = child.wait_with_output().unwrap();
    let _ = writer.join().unwrap();
    out
}
#[test]
fn x05_native_worker_detects_all_twenty_classes_with_no_executor_protocol() {
    let (_, scope) = auth_scope();
    let mut bytes = vec![];
    for kind in quantos_reconcile::BreakKind::all() {
        let mut input = clean(&scope, now());
        corrupt(&mut input, *kind);
        let frame = serde_json::json!({"schema":"quantos-x05-offline/v1","input":input,"checked_at":now()+chrono::Duration::seconds(600)});
        bytes.extend(serde_json::to_vec(&frame).unwrap());
        bytes.push(b'\n');
    }
    let out = worker(bytes, true);
    assert!(out.status.success());
    let rows: Vec<serde_json::Value> = out
        .stdout
        .split(|b| *b == b'\n')
        .filter(|b| !b.is_empty())
        .map(|b| serde_json::from_slice(b).unwrap())
        .collect();
    assert_eq!(rows.len(), 20);
    for (row, kind) in rows.iter().zip(quantos_reconcile::BreakKind::all()) {
        assert_eq!(row["venueSubmitPath"], "ABSENT");
        assert_eq!(row["sourceAdmission"], "CALLER_PROVIDED");
        assert_eq!(row["formalAccepted"], false);
        assert!(
            row["report"]["differences"]
                .as_array()
                .unwrap()
                .iter()
                .any(|d| d["kind"] == kind.as_str() && d["within_sla"] == true)
        );
    }
    println!("X05_NATIVE_CLASSES=20 LOCATED=20 VENUE_SUBMIT_PATH=ABSENT");
}
#[test]
fn x05_native_worker_refuses_unknown_fields_submit_operations_and_unbounded_frames() {
    let (_, scope) = auth_scope();
    let valid = serde_json::json!({"schema":"quantos-x05-offline/v1","input":clean(&scope,now()),"checked_at":now()});
    for n in 0..7 {
        let mut frame = valid.clone();
        match n {
            0 => frame["schema"] = "wrong".into(),
            1 => frame["submit"] = serde_json::json!({"venue":"forbidden"}),
            2 => frame["input"]["scope"]["unknown"] = true.into(),
            3 => frame["input"]["actual"]["fills"][0]["quantity"] = "NaN".into(),
            4 => frame["input"]["actual"]["fills"][0]["fee"] = "-1".into(),
            5 => frame["input"]["actual"]["orders"][0]["quantity"] = "0".into(),
            _ => frame["input"]["actual"]["fills"][0]["command_id"] = "foreign".into(),
        };
        let mut bytes = serde_json::to_vec(&frame).unwrap();
        bytes.push(b'\n');
        assert!(!worker(bytes, true).status.success(), "{n}");
    }
    assert!(!worker(vec![b'x'; 1_048_578], true).status.success());
    assert!(!worker(b"{}".to_vec(), true).status.success());
    assert!(!worker(b"{bad json}\n".to_vec(), true).status.success());
    assert!(!worker(vec![], false).status.success());
    assert!(worker(vec![], true).status.success());
}
