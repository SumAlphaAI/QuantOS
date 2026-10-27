#[path = "support/l01_fixture.rs"]
mod fixture;
use fixture::*;
use quantos_execution::{gateway::*, venue::*, venue_protocol::*};
use serde_json::{Value, json};
use std::{
    io::{BufRead, BufReader, Write},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{Arc, Mutex, mpsc},
    time::Duration,
};
struct Process {
    child: Child,
    input: ChildStdin,
    replies: mpsc::Receiver<String>,
}
impl Drop for Process {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
#[derive(Clone)]
struct Port {
    process: Arc<Mutex<Process>>,
    case: usize,
    calls: Arc<Mutex<usize>>,
}
impl ProtocolPort for Port {
    fn exchange(&mut self, request: &Request) -> Result<Response, TransportFault> {
        *self.calls.lock().unwrap() += 1;
        let mut p = self.process.lock().unwrap();
        writeln!(p.input, "{}", json!({"case":self.case,"request":request}))
            .map_err(|_| TransportFault::Disconnected)?;
        p.input.flush().map_err(|_| TransportFault::Disconnected)?;
        let line = p
            .replies
            .recv_timeout(Duration::from_secs(5))
            .map_err(|_| TransportFault::Timeout)?;
        let v: Value = serde_json::from_str(
            line.strip_prefix("L01_REPLY=")
                .ok_or(TransportFault::Disconnected)?,
        )
        .map_err(|_| TransportFault::Disconnected)?;
        if v["case"].as_u64() != Some(self.case as u64) {
            return Err(TransportFault::Disconnected);
        }
        Ok(response(v["response"].clone()))
    }
}
#[test]
fn l01_two_hundred_cases_through_actual_owned_stdio_and_x04_replay() {
    // Cargo builds this package's owned example for ordinary `cargo test`.
    // Resolve it beside the active test profile, including custom target dirs;
    // the explicit override remains available to the sealed L01 review runner.
    let exe = std::env::var_os("QUANTOS_L01_FIXTURE_EXECUTABLE")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            std::env::current_exe()
                .expect("test executable path")
                .parent()
                .and_then(std::path::Path::parent)
                .expect("Cargo test profile directory")
                .join("examples")
                .join(format!("l01_fixture{}", std::env::consts::EXE_SUFFIX))
        });
    assert!(
        exe.is_file(),
        "Cargo-built owned fixture missing: {}",
        exe.display()
    );
    assert!(!std::env::vars().any(|(k, _)| {
        [
            "DATABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
            "BINANCE_API_KEY",
            "BINANCE_API_SECRET",
        ]
        .contains(&k.as_str())
    }));
    let mut child = Command::new(&exe)
        .arg("--owned-fixture-stdio")
        .env_clear()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let input = child.stdin.take().unwrap();
    let stdout = child.stdout.take().unwrap();
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else {
                break;
            };
            if tx.send(line).is_err() {
                break;
            }
        }
    });
    let process = Arc::new(Mutex::new(Process {
        child,
        input,
        replies: rx,
    }));
    let calls = Arc::new(Mutex::new(0));
    let mut result = vec![];
    for (i, case) in cases().iter().enumerate() {
        let port = Port {
            process: process.clone(),
            case: i,
            calls: calls.clone(),
        };
        let kernel = ProtocolKernel::new(VenueConfig::approved_testnet(), rules(), port).unwrap();
        let mut g = ExecutionGateway::new(
            GatewayLimits {
                max_quantity: 1000.into(),
                max_notional: 1_000_000.into(),
                allowed_venues: vec![EXECUTION_VENUE.into()],
            },
            kernel,
        );
        let c = command(i, case);
        let receipt = g.submit(&c, now()).unwrap();
        g.try_collect_events().unwrap();
        if case["kind"] == "cancelled" || case["kind"] == "cancel_rejected" {
            g.cancel(&c.command_id.to_string(), &format!("cancel-{i}"), now())
                .unwrap();
        }
        let state = g.order(&receipt.order_id).unwrap();
        assert_eq!(state.status, case["expectedStatus"]);
        let before = *calls.lock().unwrap();
        assert!(g.submit(&c, now()).unwrap().replayed);
        assert_eq!(*calls.lock().unwrap(), before);
        let replay =
            ExecutionGateway::<quantos_execution::gateway::NautilusBoundaryAdapter>::replay_facts(
                g.facts(),
                &g.fact_anchor(),
            )
            .unwrap();
        assert_eq!(replay.order(&receipt.order_id), g.order(&receipt.order_id));
        assert_eq!(replay.fills(), g.fills());
        result.push(json!({"id":case["id"],"kind":case["kind"],"status":g.order(&receipt.order_id).unwrap().status,"fills":g.fills().len(),"anchor":g.fact_anchor(),"duplicateWrites":0}));
    }
    assert_eq!(*calls.lock().unwrap(), 250);
    assert_eq!(result.len(), 200);
    if let Ok(path) = std::env::var("QUANTOS_L01_PROCESS_MATRIX") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-l01-owned-process/v1","transport":"ACTUAL_OWNED_STDIO_NOT_EXCHANGE_HTTP","cases":result,"wireRequests":250,"actualTestnetConnected":false,"productionCredentialsUsed":false,"credentialsInherited":false})).unwrap()).unwrap();
    }
}
