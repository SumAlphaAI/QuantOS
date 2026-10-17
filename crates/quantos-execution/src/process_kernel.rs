//! QuantOS-owned, bounded stdio process protocol. No upstream code is linked or
//! launched. The reference backend is Paper; real Nautilus admission is separate.
use crate::gateway::{
    BoundaryCommand, ExecutionKernel, KernelEvent, NautilusBoundaryAdapter, NautilusOrderWire,
};
use chrono::{DateTime, Utc};
use quantos_core::{CommandId, ContentHash, Quantity};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    io::{self, BufRead, BufReader, Write},
    path::Path,
    process::{Child, Command, Stdio},
    sync::mpsc::{self, Receiver, SyncSender},
    thread::{self, JoinHandle},
    time::Duration,
};

pub const PROTOCOL: &str = "quantos-kernel/v1";
pub const MAX_FRAME: usize = 65_536;
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Ready {
    schema: String,
    backend: String,
    pid: u32,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Submit {
    schema: String,
    request_id: String,
    order: NautilusOrderWire,
    submitted_at: DateTime<Utc>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Reply {
    schema: String,
    request_id: String,
    events: Vec<KernelEvent>,
}
fn invalid() -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, "invalid kernel protocol frame")
}
fn read_frame(input: &mut impl BufRead) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    std::io::Read::take(&mut *input, (MAX_FRAME + 1) as u64).read_until(b'\n', &mut bytes)?;
    if bytes.is_empty() || bytes.len() > MAX_FRAME || bytes.last() != Some(&b'\n') {
        return Err(invalid());
    }
    Ok(bytes)
}
fn frame(value: &impl Serialize) -> io::Result<Vec<u8>> {
    let mut bytes = serde_json::to_vec(value).map_err(|_| invalid())?;
    bytes.push(b'\n');
    if bytes.len() > MAX_FRAME {
        return Err(invalid());
    }
    Ok(bytes)
}
fn write_frame(output: &mut impl Write, value: &impl Serialize) -> io::Result<()> {
    output.write_all(&frame(value)?)?;
    output.flush()
}

struct PrivateDirectory(std::path::PathBuf);
impl PrivateDirectory {
    fn new() -> Result<Self, String> {
        let path = std::env::temp_dir().join(format!("quantos-paper-kernel-{}", CommandId::new()));
        std::fs::create_dir(&path).map_err(|_| "kernel working directory unavailable")?;
        let directory = Self(path);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&directory.0, std::fs::Permissions::from_mode(0o700))
                .map_err(|_| "kernel directory permission failed")?;
        }
        Ok(directory)
    }
}
impl Drop for PrivateDirectory {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

pub struct PaperProcessKernel {
    _directory: PrivateDirectory,
    child: Child,
    sender: Option<SyncSender<Vec<u8>>>,
    replies: Receiver<Result<Vec<u8>, String>>,
    worker: Option<JoinHandle<()>>,
    pending: Vec<KernelEvent>,
    timeout: Duration,
    failed: bool,
}
impl PaperProcessKernel {
    /// Only an operator-selected absolute local executable; no shell, inherited
    /// environment, credentials, DB URLs, sessions or stderr are forwarded.
    pub fn spawn(executable: &Path, timeout: Duration) -> Result<Self, String> {
        if !executable.is_absolute()
            || !executable.is_file()
            || timeout.is_zero()
            || timeout > Duration::from_secs(1)
        {
            return Err("kernel configuration".into());
        }
        let directory = PrivateDirectory::new()?;
        let mut child = Command::new(executable)
            .arg("--tp07-paper-kernel")
            .env_clear()
            .current_dir(&directory.0)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| "kernel spawn failed")?;
        let mut input = child.stdin.take().ok_or("kernel stdin missing")?;
        let output = child.stdout.take().ok_or("kernel stdout missing")?;
        let (sender, requests) = mpsc::sync_channel::<Vec<u8>>(1);
        let (responses, replies) = mpsc::channel();
        let worker = thread::spawn(move || {
            let mut output = BufReader::new(output);
            let ready = read_frame(&mut output).map_err(|_| "kernel handshake failed".into());
            if responses.send(ready).is_err() {
                return;
            }
            for request in requests {
                let response = input
                    .write_all(&request)
                    .and_then(|()| input.flush())
                    .and_then(|()| read_frame(&mut output))
                    .map_err(|_| "kernel I/O outcome unknown".into());
                let failed = response.is_err();
                if responses.send(response).is_err() || failed {
                    break;
                }
            }
        });
        let mut kernel = Self {
            _directory: directory,
            child,
            sender: Some(sender),
            replies,
            worker: Some(worker),
            pending: vec![],
            timeout,
            failed: false,
        };
        // Startup precedes any command/authority lock. It is not a trade deadline.
        let ready = kernel
            .replies
            .recv_timeout(Duration::from_secs(60))
            .ok()
            .and_then(Result::ok)
            .and_then(|bytes| serde_json::from_slice::<Ready>(&bytes).ok());
        if !ready.is_some_and(|r| {
            r.schema == PROTOCOL && r.backend == "QUANTOS_PAPER" && r.pid == kernel.child.id()
        }) {
            kernel.close();
            return Err("kernel handshake rejected".into());
        }
        Ok(kernel)
    }
    #[must_use]
    pub fn pid(&self) -> u32 {
        self.child.id()
    }
    fn close(&mut self) {
        self.failed = true;
        self.sender.take();
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
    fn exchange(
        &mut self,
        command: &BoundaryCommand,
        now: DateTime<Utc>,
    ) -> Result<Vec<KernelEvent>, String> {
        if self.failed {
            return Err("kernel quarantined".into());
        }
        let remaining = (command.expires_at - now)
            .to_std()
            .map_err(|_| "expired kernel request")?;
        if remaining.is_zero() {
            return Err("expired kernel request".into());
        }
        let request = Submit {
            schema: PROTOCOL.into(),
            request_id: command.command_id.clone(),
            order: NautilusBoundaryAdapter::wire_command(command),
            submitted_at: now,
        };
        let bytes = frame(&request).map_err(|_| "oversized kernel request")?;
        self.sender
            .as_ref()
            .ok_or("kernel unavailable")?
            .send(bytes)
            .map_err(|_| "kernel unavailable")?;
        let bytes = self
            .replies
            .recv_timeout(self.timeout.min(remaining))
            .map_err(|_| "kernel timeout outcome unknown")??;
        let reply: Reply = serde_json::from_slice(&bytes).map_err(|_| "kernel response invalid")?;
        if reply.schema != PROTOCOL
            || reply.request_id != command.command_id
            || reply.events.len() > 16
            || reply.events.is_empty()
            || reply.events.iter().any(|event| match event {
                KernelEvent::OrderAccepted { command_id, at, .. }
                | KernelEvent::OrderRejected { command_id, at, .. }
                | KernelEvent::OrderFilled { command_id, at, .. } => {
                    command_id != &command.command_id || *at < now || *at >= command.expires_at
                }
            })
        {
            return Err("kernel response binding invalid".into());
        }
        Ok(reply.events)
    }
}
impl Drop for PaperProcessKernel {
    fn drop(&mut self) {
        self.close();
    }
}
impl ExecutionKernel for PaperProcessKernel {
    fn submit(&mut self, _: &BoundaryCommand) -> Result<(), String> {
        Err("explicit submission time required".into())
    }
    fn submit_at(&mut self, command: &BoundaryCommand, now: DateTime<Utc>) -> Result<(), String> {
        match self.exchange(command, now) {
            Ok(events) => {
                self.pending.extend(events);
                Ok(())
            }
            Err(error) => {
                self.close();
                Err(error)
            }
        }
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        std::mem::take(&mut self.pending)
    }
}
/// Standalone Paper backend. It accepts only owned LIMIT/GTD simulation wire data;
/// there is no venue, Agent, model, auth, database, tool, or secret resolver here.
pub fn serve_paper_kernel(input: impl BufRead, mut output: impl Write) -> io::Result<()> {
    write_frame(
        &mut output,
        &Ready {
            schema: PROTOCOL.into(),
            backend: "QUANTOS_PAPER".into(),
            pid: std::process::id(),
        },
    )?;
    let mut input = input;
    let mut seen = BTreeMap::<String, (Submit, Reply)>::new();
    while !input.fill_buf()?.is_empty() {
        let request: Submit =
            serde_json::from_slice(&read_frame(&mut input)?).map_err(|_| invalid())?;
        let o = &request.order;
        if request.schema != PROTOCOL
            || request.request_id.is_empty()
            || request.request_id.len() > 160
            || o.trader_id != "QUANTOS-PAPER-001"
            || o.strategy_id != "QUANTOS-EXECUTION-GATEWAY"
            || o.order_type != "LIMIT"
            || !matches!(o.order_side.as_str(), "BUY" | "SELL")
            || o.time_in_force != "GTD"
            || o.trigger_price.is_some()
            || o.expire_time.is_none_or(|at| at <= request.submitted_at)
            || o.client_order_id.is_empty()
            || o.instrument_id.is_empty()
            || !Quantity::parse_str(&o.quantity).is_ok_and(|q| q.value() > Decimal::ZERO)
            || !o
                .price
                .as_deref()
                .is_some_and(|p| Quantity::parse_str(p).is_ok_and(|p| p.value() > Decimal::ZERO))
        {
            return Err(invalid());
        }
        if let Some((prior, reply)) = seen.get(&o.client_order_id) {
            if prior != &request {
                return Err(invalid());
            }
            write_frame(&mut output, reply)?;
            continue;
        }
        if seen.len() >= 10_000 {
            return Err(invalid());
        }
        let id = ContentHash::sha256_bytes(o.client_order_id.as_bytes())
            .as_str()
            .to_owned();
        let reply = Reply {
            schema: PROTOCOL.into(),
            request_id: request.request_id.clone(),
            events: vec![
                KernelEvent::OrderAccepted {
                    command_id: request.request_id.clone(),
                    venue_order_id: format!("paper-order:{id}"),
                    at: request.submitted_at,
                },
                KernelEvent::OrderFilled {
                    command_id: request.request_id.clone(),
                    venue_order_id: format!("paper-order:{id}"),
                    venue_fill_id: format!("paper-fill:{id}"),
                    quantity: o.quantity.clone(),
                    price: o.price.clone().ok_or_else(invalid)?,
                    fee_currency: "USD".into(),
                    fee_amount: "0".into(),
                    at: request.submitted_at,
                },
            ],
        };
        write_frame(&mut output, &reply)?;
        seen.insert(o.client_order_id.clone(), (request, reply));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration as ChronoDuration, TimeZone};
    fn request() -> Submit {
        let now = Utc.with_ymd_and_hms(2026, 10, 17, 0, 0, 0).unwrap();
        Submit {
            schema: PROTOCOL.into(),
            request_id: "opaque-command-id".into(),
            submitted_at: now,
            order: NautilusOrderWire {
                trader_id: "QUANTOS-PAPER-001".into(),
                strategy_id: "QUANTOS-EXECUTION-GATEWAY".into(),
                instrument_id: "BTCUSDT.OWNED_PAPER".into(),
                client_order_id: "opaque-client-id".into(),
                order_side: "BUY".into(),
                order_type: "LIMIT".into(),
                quantity: "1".into(),
                price: Some("100".into()),
                trigger_price: None,
                time_in_force: "GTD".into(),
                expire_time: Some(now + ChronoDuration::seconds(1)),
            },
        }
    }
    #[test]
    fn tp07_protocol_frames_are_bounded_complete_and_strict() {
        assert!(read_frame(&mut &b""[..]).is_err());
        assert!(read_frame(&mut &b"{}"[..]).is_err());
        assert!(read_frame(&mut vec![b'x'; MAX_FRAME + 1].as_slice()).is_err());
        assert!(frame(&"x".repeat(MAX_FRAME)).is_err());
        let r = request();
        let bytes = frame(&r).unwrap();
        let parsed: Submit =
            serde_json::from_slice(&read_frame(&mut bytes.as_slice()).unwrap()).unwrap();
        assert_eq!(r, parsed);
        let mut unknown = serde_json::to_value(r).unwrap();
        unknown["session"] = serde_json::json!("forbidden");
        assert!(serde_json::from_value::<Submit>(unknown).is_err());
    }
    #[test]
    fn tp07_paper_protocol_deduplicates_exact_wire_and_rejects_key_conflict() {
        let r = request();
        let mut input = frame(&r).unwrap();
        input.extend(frame(&r).unwrap());
        let mut out = vec![];
        serve_paper_kernel(input.as_slice(), &mut out).unwrap();
        let lines = out
            .split(|b| *b == b'\n')
            .filter(|b| !b.is_empty())
            .collect::<Vec<_>>();
        assert_eq!(lines.len(), 3);
        let ready: Ready = serde_json::from_slice(lines[0]).unwrap();
        assert_eq!(ready.backend, "QUANTOS_PAPER");
        assert_eq!(ready.pid, std::process::id());
        assert_eq!(lines[1], lines[2]);
        let reply: Reply = serde_json::from_slice(lines[1]).unwrap();
        assert_eq!(reply.events.len(), 2);
        let mut conflict = r.clone();
        conflict.order.quantity = "2".into();
        let mut input = frame(&r).unwrap();
        input.extend(frame(&conflict).unwrap());
        assert!(serve_paper_kernel(input.as_slice(), vec![]).is_err());
    }
    #[test]
    fn tp07_paper_protocol_refuses_invalid_vocabulary_amounts_and_lifetimes() {
        for n in 0..14 {
            let mut r = request();
            match n {
                0 => r.schema = "wrong".into(),
                1 => r.request_id = "".into(),
                2 => r.order.trader_id = "foreign".into(),
                3 => r.order.strategy_id = "foreign".into(),
                4 => r.order.order_type = "MARKET".into(),
                5 => r.order.order_side = "invalid".into(),
                6 => r.order.time_in_force = "GTC".into(),
                7 => r.order.trigger_price = Some("1".into()),
                8 => r.order.expire_time = Some(r.submitted_at),
                9 => r.order.client_order_id = "".into(),
                10 => r.order.instrument_id = "".into(),
                11 => r.order.quantity = "0".into(),
                12 => r.order.price = None,
                _ => r.order.price = Some("-1".into()),
            }
            assert!(
                serve_paper_kernel(frame(&r).unwrap().as_slice(), vec![]).is_err(),
                "{n}"
            );
        }
        assert!(serve_paper_kernel(&b"{bad json}\n"[..], vec![]).is_err());
    }
    struct BrokenOutput;
    impl Write for BrokenOutput {
        fn write(&mut self, _: &[u8]) -> io::Result<usize> {
            Err(io::Error::other("owned failure"))
        }
        fn flush(&mut self) -> io::Result<()> {
            Err(io::Error::other("owned failure"))
        }
    }
    #[test]
    fn tp07_paper_protocol_reports_output_failure_without_executing_input() {
        assert!(serve_paper_kernel(&b""[..], BrokenOutput).is_err());
    }
}
