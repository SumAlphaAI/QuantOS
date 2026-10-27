//! Explicit, read-only owned archive verifier. No environment/database/network.
use std::{path::Path, process::ExitCode};
fn main() -> ExitCode {
    let a: Vec<_> = std::env::args().collect();
    if a.len() != 4 || a[1] != "--verify-owned-local-archive" {
        return ExitCode::from(2);
    }
    let Ok(h) = serde_json::from_value(serde_json::Value::String(a[3].clone())) else {
        return ExitCode::from(2);
    };
    match quantos_evidence::local::verify_archive(Path::new(&a[2]), &h) {
        Ok(p) => {
            println!(
                "{}",
                serde_json::json!({"profile":p.profile,"sourceCommit":p.source_commit,"auditEntries":p.operations_audit.len(),"commands":p.orders.len(),"orders":p.orders.len(),"executionAuthority":false,"targetDatabase":"NOT_RUN","runtimeAdmission":"DENIED"})
            );
            ExitCode::SUCCESS
        }
        Err(_) => {
            eprintln!("L04_ARCHIVE_REFUSED");
            ExitCode::from(1)
        }
    }
}
