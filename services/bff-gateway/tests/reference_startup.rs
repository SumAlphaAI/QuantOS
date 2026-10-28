use std::{
    io::{BufRead, BufReader, Read},
    process::{Child, Command, Stdio},
    sync::mpsc,
    time::Duration,
};

struct Running(Child);
impl Drop for Running {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

// Reference startup hashes the complete debug executable before readiness.
// Shared CI runners need headroom for that CPU/I/O work; this is a bounded
// correctness check, not a ten-second startup performance requirement.
const STARTUP_TIMEOUT: Duration = Duration::from_secs(60);

fn startup_line(child: &mut Running, stdout: mpsc::Receiver<String>) -> String {
    stdout
        .recv_timeout(STARTUP_TIMEOUT)
        .unwrap_or_else(|error| {
            // Stop and reap before reading stderr so a stalled process cannot hang
            // diagnostics or survive a failed readiness assertion.
            let _ = child.0.kill();
            let status = child.0.wait();
            let mut stderr = String::new();
            if let Some(mut pipe) = child.0.stderr.take() {
                let _ = pipe.read_to_string(&mut stderr);
            }
            panic!("reference startup failed: {error:?}; status={status:?}; stderr={stderr}");
        })
}

fn start(origin: &str) -> (Running, mpsc::Receiver<String>) {
    let mut child = Command::new(env!("CARGO_BIN_EXE_bff-gateway"))
        .env_clear()
        .env("QUANTOS_BFF_MODE", "reference")
        .env("QUANTOS_BFF_BIND", "127.0.0.1:0")
        .env("QUANTOS_BFF_REFERENCE_OPS_FEED", "clear-once")
        .env("QUANTOS_BFF_PUBLIC_ORIGIN", origin)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("start owned reference binary");
    let stdout = child.stdout.take().expect("stdout pipe");
    let (send, receive) = mpsc::channel();
    std::thread::spawn(move || {
        let mut line = String::new();
        let _ = BufReader::new(stdout).read_line(&mut line);
        let _ = send.send(line);
    });
    (Running(child), receive)
}

#[test]
fn operations_feed_starts_with_configured_download_origin() {
    let (mut child, stdout) = start("https://bff.reference.invalid");
    let line = startup_line(&mut child, stdout);
    let ready: serde_json::Value = serde_json::from_str(&line).expect("ready JSON");
    assert_eq!(ready["ready"], true);
    assert_eq!(ready["mode"], "reference-provider");
    assert!(child.0.try_wait().unwrap().is_none());
}

#[test]
fn operations_feed_does_not_bypass_download_origin_validation() {
    let (mut child, stdout) = start("http://outside.invalid");
    let line = startup_line(&mut child, stdout);
    assert!(line.is_empty(), "invalid origin must not announce ready");
    assert!(!child.0.wait().unwrap().success());
    let mut stderr = String::new();
    child
        .0
        .stderr
        .take()
        .unwrap()
        .read_to_string(&mut stderr)
        .unwrap();
    assert!(stderr.contains("HTTPS"), "{stderr}");
}
