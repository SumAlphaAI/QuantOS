//! Offline supplied-data worker. No environment loading, network, DB or executor.
use quantos_reconcile::reconciliation::{Input, offline_check};
use serde::Deserialize;
use std::io::{self, BufRead, Write};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    schema: String,
    input: Input,
    checked_at: chrono::DateTime<chrono::Utc>,
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    if std::env::args().skip(1).collect::<Vec<_>>() != ["--x05-offline-reconcile"] {
        return Err("offline worker requires explicit mode".into());
    }
    let stdin = io::stdin();
    let mut input = stdin.lock();
    let stdout = io::stdout();
    let mut out = stdout.lock();
    while !input.fill_buf()?.is_empty() {
        let mut bytes = vec![];
        std::io::Read::take(&mut input, 1_048_577).read_until(b'\n', &mut bytes)?;
        if bytes.len() > 1_048_576 || bytes.last() != Some(&b'\n') {
            return Err("invalid bounded frame".into());
        }
        let request: Request = serde_json::from_slice(&bytes)?;
        if request.schema != "quantos-x05-offline/v1" {
            return Err("invalid schema".into());
        }
        let report = offline_check(&request.input, request.checked_at)?;
        serde_json::to_writer(
            &mut out,
            &serde_json::json!({"schema":"quantos-x05-offline/v1","sourceAdmission":"CALLER_PROVIDED","venueSubmitPath":"ABSENT","formalAccepted":false,"report":report}),
        )?;
        out.write_all(b"\n")?;
        out.flush()?;
    }
    Ok(())
}
