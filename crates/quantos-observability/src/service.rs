//! Deployable, dependency-light observability surface shared by QuantOS services.
//!
//! The HTTP surface intentionally exposes only operational metadata. It never
//! serializes process environment variables, request payloads, or credentials.

use std::{
    fs::{File, OpenOptions},
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::ExitCode,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::Duration,
};

use chrono::{DateTime, Utc};
use quantos_core::CorrelationId;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::redact_value;

const MAX_REQUEST_BYTES: usize = 8 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ErrorEnvelope {
    pub code: String,
    pub message: String,
    pub service: String,
    pub correlation_id: CorrelationId,
    pub occurred_at: DateTime<Utc>,
    pub retryable: bool,
}

impl ErrorEnvelope {
    #[must_use]
    pub fn new(
        service: impl Into<String>,
        code: impl Into<String>,
        message: impl Into<String>,
        correlation_id: CorrelationId,
        retryable: bool,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            service: service.into(),
            correlation_id,
            occurred_at: Utc::now(),
            retryable,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProbeHealth {
    pub service: String,
    pub status: &'static str,
    pub ready: bool,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ExportedTraceRecord {
    pub service: String,
    pub correlation_id: CorrelationId,
    pub operation: String,
    pub status: String,
    pub attributes: Value,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TraceQueryResult {
    pub service: String,
    pub correlation_id: CorrelationId,
    pub records: Vec<ExportedTraceRecord>,
}

#[derive(Debug, Clone)]
pub struct JsonlTraceExporter {
    path: Arc<PathBuf>,
    write_lock: Arc<Mutex<()>>,
}

impl JsonlTraceExporter {
    pub fn new(path: impl Into<PathBuf>) -> std::io::Result<Self> {
        let path = path.into();
        if let Some(parent) = path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
        {
            std::fs::create_dir_all(parent)?;
        }
        OpenOptions::new().create(true).append(true).open(&path)?;
        Ok(Self {
            path: Arc::new(path),
            write_lock: Arc::new(Mutex::new(())),
        })
    }

    #[must_use]
    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn export(&self, record: &ExportedTraceRecord) -> std::io::Result<()> {
        let _guard = self
            .write_lock
            .lock()
            .map_err(|_| std::io::Error::other("trace exporter lock poisoned"))?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.path())?;
        let mut safe_record = record.clone();
        safe_record.attributes = redact_value(safe_record.attributes);
        serde_json::to_writer(&mut file, &safe_record).map_err(std::io::Error::other)?;
        file.write_all(b"\n")?;
        file.flush()
    }

    pub fn query(
        &self,
        service: &str,
        correlation_id: CorrelationId,
    ) -> std::io::Result<Vec<ExportedTraceRecord>> {
        let _guard = self
            .write_lock
            .lock()
            .map_err(|_| std::io::Error::other("trace exporter lock poisoned"))?;
        let file = File::open(self.path())?;
        let mut records = Vec::new();
        for line in std::io::BufRead::lines(std::io::BufReader::new(file)) {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            let record: ExportedTraceRecord =
                serde_json::from_str(&line).map_err(std::io::Error::other)?;
            if record.service == service && record.correlation_id == correlation_id {
                records.push(record);
            }
        }
        Ok(records)
    }

    fn is_ready(&self) -> bool {
        OpenOptions::new().append(true).open(self.path()).is_ok()
    }
}

#[derive(Debug)]
struct Counters {
    requests: AtomicU64,
    errors: AtomicU64,
    listener_failed: AtomicBool,
}

#[derive(Debug, Clone)]
pub struct ServiceObservability {
    service: Arc<str>,
    counters: Arc<Counters>,
    exporter: Option<JsonlTraceExporter>,
}

impl ServiceObservability {
    #[must_use]
    pub fn new(service: impl Into<String>) -> Self {
        Self {
            service: Arc::from(service.into()),
            counters: Arc::new(Counters {
                requests: AtomicU64::new(0),
                errors: AtomicU64::new(0),
                listener_failed: AtomicBool::new(false),
            }),
            exporter: None,
        }
    }

    pub fn with_jsonl_exporter(
        service: impl Into<String>,
        path: impl Into<PathBuf>,
    ) -> std::io::Result<Self> {
        let mut observability = Self::new(service);
        observability.exporter = Some(JsonlTraceExporter::new(path)?);
        Ok(observability)
    }

    pub fn from_env(service: impl Into<String>) -> std::io::Result<Self> {
        let service = service.into();
        match std::env::var("QUANTOS_TRACE_EXPORT_PATH") {
            Ok(path) if !path.trim().is_empty() => Self::with_jsonl_exporter(service, path),
            _ => Ok(Self::new(service)),
        }
    }

    /// Live write services must have a persistent trace sink before they can
    /// accept business requests. The deployment owns durable storage and log
    /// shipping; this checks that an exporter is configured and writable.
    pub fn from_required_env(service: impl Into<String>) -> std::io::Result<Self> {
        let path = required_export_path(std::env::var("QUANTOS_TRACE_EXPORT_PATH").ok())?;
        Self::with_jsonl_exporter(service, path)
    }

    #[must_use]
    pub fn service(&self) -> &str {
        &self.service
    }

    #[must_use]
    pub fn is_ready(&self) -> bool {
        !self.counters.listener_failed.load(Ordering::Relaxed)
            && self
                .exporter
                .as_ref()
                .is_some_and(JsonlTraceExporter::is_ready)
    }

    pub fn record_error(&self) {
        self.counters.errors.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_trace(
        &self,
        correlation_id: CorrelationId,
        operation: impl Into<String>,
        status: impl Into<String>,
        attributes: Value,
    ) -> std::io::Result<()> {
        let status = status.into();
        if status == "failed" {
            self.record_error();
        }
        let Some(exporter) = &self.exporter else {
            return Ok(());
        };
        exporter.export(&ExportedTraceRecord {
            service: self.service.to_string(),
            correlation_id,
            operation: operation.into(),
            status,
            attributes: redact_value(attributes),
            recorded_at: Utc::now(),
        })
    }

    /// Serve `/healthz`, `/readyz`, `/metrics`, and correlation-addressable
    /// `/trace/<uuid>` endpoints. Unknown routes return a stable error envelope.
    pub fn serve(&self, address: SocketAddr) -> std::io::Result<()> {
        self.serve_listener(Self::bind(address)?)
    }

    pub fn start_background(&self, address: SocketAddr) -> std::io::Result<()> {
        let listener = Self::bind(address)?;
        let observer = self.clone();
        std::thread::Builder::new()
            .name(format!("{}-observability", self.service))
            .spawn(move || {
                if let Err(error) = observer.serve_listener(listener) {
                    eprintln!("observability listener failed: {error}");
                }
            })?;
        Ok(())
    }

    fn bind(address: SocketAddr) -> std::io::Result<TcpListener> {
        if !address.ip().is_loopback() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "observability HTTP must bind to loopback",
            ));
        }
        TcpListener::bind(address)
    }

    fn serve_listener(&self, listener: TcpListener) -> std::io::Result<()> {
        self.serve_connections(listener.incoming())
    }

    fn serve_connections(
        &self,
        connections: impl IntoIterator<Item = std::io::Result<TcpStream>>,
    ) -> std::io::Result<()> {
        for connection in connections {
            match connection {
                Ok(mut stream) => {
                    let result = stream
                        .set_read_timeout(Some(Duration::from_secs(2)))
                        .and_then(|()| stream.set_write_timeout(Some(Duration::from_secs(2))))
                        .and_then(|()| self.handle_connection(&mut stream));
                    if result.is_err() {
                        // A stalled/disconnected client is not a listener failure.
                        self.counters.errors.fetch_add(1, Ordering::Relaxed);
                    }
                }
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(error) => {
                    self.counters.listener_failed.store(true, Ordering::Relaxed);
                    self.counters.errors.fetch_add(1, Ordering::Relaxed);
                    return Err(error);
                }
            }
        }
        Ok(())
    }

    fn handle_connection(&self, stream: &mut TcpStream) -> std::io::Result<()> {
        let mut buffer = [0_u8; MAX_REQUEST_BYTES];
        let read = stream.read(&mut buffer)?;
        let request = String::from_utf8_lossy(&buffer[..read]);
        let path = request
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().nth(1))
            .unwrap_or("/");
        let response = self.render(path);
        stream.write_all(response.as_bytes())
    }

    #[must_use]
    pub fn render(&self, path: &str) -> String {
        self.counters.requests.fetch_add(1, Ordering::Relaxed);
        let (status, content_type, body) = match path {
            "/healthz" => (
                "200 OK",
                "application/json",
                serde_json::to_string(&ProbeHealth {
                    service: self.service.to_string(),
                    status: "ready",
                    ready: true,
                    checked_at: Utc::now(),
                })
                .expect("health payload is serializable"),
            ),
            "/readyz" => {
                let ready = self.is_ready();
                (
                    if ready {
                        "200 OK"
                    } else {
                        "503 Service Unavailable"
                    },
                    "application/json",
                    serde_json::to_string(&ProbeHealth {
                        service: self.service.to_string(),
                        status: if ready {
                            "ready"
                        } else {
                            "trace_exporter_unavailable"
                        },
                        ready,
                        checked_at: Utc::now(),
                    })
                    .expect("readiness payload is serializable"),
                )
            }
            "/metrics" => ("200 OK", "text/plain; version=0.0.4", self.metrics()),
            _ if path.starts_with("/trace/") => self.trace_response(path),
            _ => {
                self.record_error();
                let envelope = ErrorEnvelope::new(
                    self.service.to_string(),
                    "OBSERVABILITY_ROUTE_NOT_FOUND",
                    "observability route not found",
                    CorrelationId::new(),
                    false,
                );
                (
                    "404 Not Found",
                    "application/json",
                    serde_json::to_string(&envelope).expect("error envelope is serializable"),
                )
            }
        };
        format!(
            "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
    }

    fn trace_response(&self, path: &str) -> (&'static str, &'static str, String) {
        let raw = path.trim_start_matches("/trace/");
        match CorrelationId::parse_str(raw) {
            Ok(correlation_id) => {
                let Some(exporter) = &self.exporter else {
                    return self.trace_exporter_unavailable(correlation_id);
                };
                match exporter.query(&self.service, correlation_id) {
                    Ok(records) => (
                        "200 OK",
                        "application/json",
                        serde_json::to_string(&TraceQueryResult {
                            service: self.service.to_string(),
                            correlation_id,
                            records,
                        })
                        .expect("trace query is serializable"),
                    ),
                    Err(_) => {
                        self.record_error();
                        let envelope = ErrorEnvelope::new(
                            self.service.to_string(),
                            "OBSERVABILITY_TRACE_EXPORTER_FAILURE",
                            "trace exporter query failed",
                            correlation_id,
                            true,
                        );
                        (
                            "500 Internal Server Error",
                            "application/json",
                            serde_json::to_string(&envelope)
                                .expect("error envelope is serializable"),
                        )
                    }
                }
            }
            Err(_) => {
                self.record_error();
                let envelope = ErrorEnvelope::new(
                    self.service.to_string(),
                    "OBSERVABILITY_INVALID_CORRELATION_ID",
                    "trace correlation id must be a UUID",
                    CorrelationId::new(),
                    false,
                );
                (
                    "400 Bad Request",
                    "application/json",
                    serde_json::to_string(&envelope).expect("error envelope is serializable"),
                )
            }
        }
    }

    fn trace_exporter_unavailable(
        &self,
        correlation_id: CorrelationId,
    ) -> (&'static str, &'static str, String) {
        self.record_error();
        let envelope = ErrorEnvelope::new(
            self.service.to_string(),
            "OBSERVABILITY_TRACE_EXPORTER_NOT_CONFIGURED",
            "set QUANTOS_TRACE_EXPORT_PATH to enable trace export and query",
            correlation_id,
            true,
        );
        (
            "503 Service Unavailable",
            "application/json",
            serde_json::to_string(&envelope).expect("error envelope is serializable"),
        )
    }

    fn metrics(&self) -> String {
        let service = self.service.replace(['\\', '"'], "_");
        let ready = self.is_ready();
        format!(
            "# HELP quantos_service_ready Whether the service and trace exporter are ready.\n# TYPE quantos_service_ready gauge\nquantos_service_ready{{service=\"{service}\"}} {}\n# HELP quantos_observability_requests_total Observability HTTP requests.\n# TYPE quantos_observability_requests_total counter\nquantos_observability_requests_total{{service=\"{service}\"}} {}\n# HELP quantos_service_errors_total Structured service errors.\n# TYPE quantos_service_errors_total counter\nquantos_service_errors_total{{service=\"{service}\"}} {}\n",
            u8::from(ready),
            self.counters.requests.load(Ordering::Relaxed),
            self.counters.errors.load(Ordering::Relaxed),
        )
    }
}

fn required_export_path(raw: Option<String>) -> std::io::Result<PathBuf> {
    let value = raw
        .filter(|path| !path.trim().is_empty())
        .ok_or_else(|| std::io::Error::other("QUANTOS_TRACE_EXPORT_PATH is required"))?;
    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err(std::io::Error::other(
            "QUANTOS_TRACE_EXPORT_PATH must be absolute",
        ));
    }
    Ok(path)
}

/// Run one batch-service command with the same trace/error contract as the
/// long-running gateways. The optional operations HTTP surface runs alongside
/// the batch command and cannot suppress the command itself.
pub fn run_observed_command<E>(
    service: &str,
    operation: &str,
    command: impl FnOnce() -> Result<(), E>,
) -> ExitCode {
    run_observed_command_with_exporter(service, operation, false, |_| command())
}

/// Use for a batch command that can persist F0 business state.
pub fn run_observed_write_command<E>(
    service: &str,
    operation: &str,
    command: impl FnOnce(CorrelationId) -> Result<(), E>,
) -> ExitCode {
    run_observed_command_with_exporter(service, operation, true, command)
}

fn run_observed_command_with_exporter<E>(
    service: &str,
    operation: &str,
    require_exporter: bool,
    command: impl FnOnce(CorrelationId) -> Result<(), E>,
) -> ExitCode {
    let observability = match if require_exporter {
        ServiceObservability::from_required_env(service)
    } else {
        ServiceObservability::from_env(service)
    } {
        Ok(observability) => observability,
        Err(_) => return emit_bootstrap_failure(service, "OBSERVABILITY_TRACE_EXPORTER_INIT"),
    };

    if let Some(address) = std::env::var("QUANTOS_OBSERVABILITY_ADDR")
        .ok()
        .filter(|value| !value.trim().is_empty())
    {
        let Ok(address) = address.parse() else {
            return emit_bootstrap_failure(service, "OBSERVABILITY_INVALID_ADDRESS");
        };
        if observability.start_background(address).is_err() {
            return emit_bootstrap_failure(service, "OBSERVABILITY_HTTP_SERVER_FAILURE");
        }
    }

    let correlation_id = CorrelationId::new();
    if observability
        .record_trace(
            correlation_id,
            operation,
            "started",
            serde_json::json!({"kind": "batch_command"}),
        )
        .is_err()
    {
        return emit_export_failure(service, correlation_id);
    }

    match command(correlation_id) {
        Ok(()) => {
            if observability
                .record_trace(
                    correlation_id,
                    operation,
                    "succeeded",
                    serde_json::json!({"kind": "batch_command"}),
                )
                .is_err()
            {
                return emit_export_failure(service, correlation_id);
            }
            eprintln!(
                "{}",
                serde_json::json!({
                    "service": service,
                    "level": "info",
                    "code": "BATCH_COMMAND_SUCCEEDED",
                    "operation": operation,
                    "correlation_id": correlation_id,
                    "occurred_at": Utc::now(),
                })
            );
            ExitCode::SUCCESS
        }
        Err(_) => {
            let _ = observability.record_trace(
                correlation_id,
                operation,
                "failed",
                serde_json::json!({"kind": "batch_command", "error_code": "BATCH_COMMAND_FAILED"}),
            );
            emit_error_envelope(ErrorEnvelope::new(
                service,
                "BATCH_COMMAND_FAILED",
                "batch command failed; inspect the correlation trace",
                correlation_id,
                false,
            ))
        }
    }
}

fn emit_bootstrap_failure(service: &str, code: &str) -> ExitCode {
    emit_error_envelope(ErrorEnvelope::new(
        service,
        code,
        "service observability bootstrap failed",
        CorrelationId::new(),
        false,
    ))
}

fn emit_export_failure(service: &str, correlation_id: CorrelationId) -> ExitCode {
    emit_error_envelope(ErrorEnvelope::new(
        service,
        "OBSERVABILITY_TRACE_EXPORT_FAILURE",
        "trace export failed",
        correlation_id,
        true,
    ))
}

fn emit_error_envelope(envelope: ErrorEnvelope) -> ExitCode {
    eprintln!(
        "{}",
        serde_json::to_string(&envelope).expect("error envelope is serializable")
    );
    ExitCode::FAILURE
}

#[cfg(test)]
mod tests {
    use super::{ErrorEnvelope, ServiceObservability, TraceQueryResult, required_export_path};
    use quantos_core::CorrelationId;
    use serde_json::json;

    #[test]
    fn exposes_health_metrics_and_correlation_trace() {
        let trace_path = std::env::temp_dir().join(format!(
            "quantos-observability-{}.jsonl",
            CorrelationId::new()
        ));
        let probe = ServiceObservability::with_jsonl_exporter("runtime-gateway", &trace_path)
            .expect("trace exporter");
        assert!(probe.render("/healthz").contains("\"ready\":true"));
        assert!(probe.render("/readyz").contains("\"ready\":true"));
        assert!(probe.render("/metrics").contains("quantos_service_ready"));

        let correlation_id = CorrelationId::new();
        probe
            .record_trace(
                correlation_id,
                "runtime.claim",
                "succeeded",
                json!({"worker": "test"}),
            )
            .expect("trace export");
        let response = probe.render(&format!("/trace/{correlation_id}"));
        let body = response.split("\r\n\r\n").nth(1).expect("response body");
        let query: TraceQueryResult = serde_json::from_str(body).expect("valid query");
        assert_eq!(query.records.len(), 1);
        assert_eq!(query.records[0].operation, "runtime.claim");
        assert!(!response.contains("DATABASE_URL"));
        std::fs::remove_file(trace_path).expect("remove trace fixture");
        assert!(!probe.is_ready());
        assert!(probe.render("/readyz").contains("\"ready\":false"));
    }

    #[test]
    fn stalled_client_does_not_stop_listener_and_listener_failure_changes_readiness() {
        use std::{
            io::{Read, Write},
            net::{TcpListener, TcpStream},
        };
        let path =
            std::env::temp_dir().join(format!("f09-listener-{}.jsonl", CorrelationId::new()));
        let probe = ServiceObservability::with_jsonl_exporter("runtime-gateway", &path).unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let idle = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (idle_server, _) = listener.accept().unwrap();
        let mut good = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (good_server, _) = listener.accept().unwrap();
        good.write_all(b"GET /readyz HTTP/1.1\r\nHost: localhost\r\n\r\n")
            .unwrap();
        probe
            .serve_connections([Ok(idle_server), Ok(good_server)])
            .unwrap();
        let mut response = String::new();
        good.read_to_string(&mut response).unwrap();
        assert!(response.contains("200 OK"));
        assert!(probe.is_ready());
        drop(idle);
        assert!(
            probe
                .serve_connections([Err(std::io::Error::other("listener unavailable"))])
                .is_err()
        );
        assert!(!probe.is_ready());
        assert!(probe.render("/readyz").contains("503 Service Unavailable"));
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn returns_stable_structured_errors() {
        let probe = ServiceObservability::new("execution-gateway");
        let response = probe.render("/unknown");
        let body = response.split("\r\n\r\n").nth(1).expect("response body");
        let envelope: ErrorEnvelope = serde_json::from_str(body).expect("valid envelope");
        assert_eq!(envelope.code, "OBSERVABILITY_ROUTE_NOT_FOUND");
        assert_eq!(envelope.service, "execution-gateway");
        assert!(!envelope.retryable);
    }

    #[test]
    fn live_write_trace_sink_requires_absolute_path() {
        assert!(required_export_path(None).is_err());
        assert!(required_export_path(Some("  ".to_owned())).is_err());
        assert!(required_export_path(Some("relative/trace.jsonl".to_owned())).is_err());
        let path = std::env::temp_dir().join("f09-trace.jsonl");
        assert_eq!(
            required_export_path(Some(path.display().to_string())).unwrap(),
            path
        );
    }

    #[test]
    fn persisted_trace_redacts_nested_credentials_and_rejects_remote_listener() {
        let trace_path = std::env::temp_dir().join(format!(
            "quantos-observability-secret-{}.jsonl",
            CorrelationId::new()
        ));
        let probe = ServiceObservability::with_jsonl_exporter("runtime-gateway", &trace_path)
            .expect("trace exporter");
        let id = CorrelationId::new();
        probe
            .record_trace(
                id,
                "write",
                "succeeded",
                json!({
                    "nested": {"authorization": "Bearer sensitive-value"}, "safe": "ok"
                }),
            )
            .expect("trace export");
        let written = std::fs::read_to_string(&trace_path).expect("read trace");
        assert!(!written.contains("sensitive-value"));
        assert!(written.contains("[REDACTED]"));
        assert!(probe.serve("0.0.0.0:0".parse().unwrap()).is_err());
        std::fs::remove_file(trace_path).expect("remove trace fixture");
    }
}
