//! Deployable, dependency-light observability surface shared by QuantOS services.
//!
//! The HTTP surface intentionally exposes only operational metadata. It never
//! serializes process environment variables, request payloads, or credentials.

use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
    time::Duration,
};

use chrono::{DateTime, Utc};
use quantos_core::CorrelationId;
use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TraceProbe {
    pub service: String,
    pub correlation_id: CorrelationId,
    pub traceparent: String,
    pub sampled: bool,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug)]
struct Counters {
    requests: AtomicU64,
    errors: AtomicU64,
}

#[derive(Debug, Clone)]
pub struct ServiceObservability {
    service: Arc<str>,
    counters: Arc<Counters>,
}

impl ServiceObservability {
    #[must_use]
    pub fn new(service: impl Into<String>) -> Self {
        Self {
            service: Arc::from(service.into()),
            counters: Arc::new(Counters {
                requests: AtomicU64::new(0),
                errors: AtomicU64::new(0),
            }),
        }
    }

    #[must_use]
    pub fn service(&self) -> &str {
        &self.service
    }

    pub fn record_error(&self) {
        self.counters.errors.fetch_add(1, Ordering::Relaxed);
    }

    /// Serve `/healthz`, `/readyz`, `/metrics`, and correlation-addressable
    /// `/trace/<uuid>` endpoints. Unknown routes return a stable error envelope.
    pub fn serve(&self, address: SocketAddr) -> std::io::Result<()> {
        let listener = TcpListener::bind(address)?;
        for connection in listener.incoming() {
            match connection {
                Ok(mut stream) => {
                    stream.set_read_timeout(Some(Duration::from_secs(2)))?;
                    self.handle_connection(&mut stream)?;
                }
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(error) => return Err(error),
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
            "/healthz" | "/readyz" => (
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
                let compact = correlation_id.to_string().replace('-', "");
                let trace = TraceProbe {
                    service: self.service.to_string(),
                    correlation_id,
                    traceparent: format!("00-{compact}-0000000000000001-00"),
                    sampled: false,
                    recorded_at: Utc::now(),
                };
                (
                    "200 OK",
                    "application/json",
                    serde_json::to_string(&trace).expect("trace payload is serializable"),
                )
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

    fn metrics(&self) -> String {
        let service = self.service.replace(['\\', '"'], "_");
        format!(
            "# HELP quantos_service_ready Whether the service is ready.\n# TYPE quantos_service_ready gauge\nquantos_service_ready{{service=\"{service}\"}} 1\n# HELP quantos_observability_requests_total Observability HTTP requests.\n# TYPE quantos_observability_requests_total counter\nquantos_observability_requests_total{{service=\"{service}\"}} {}\n# HELP quantos_service_errors_total Structured service errors.\n# TYPE quantos_service_errors_total counter\nquantos_service_errors_total{{service=\"{service}\"}} {}\n",
            self.counters.requests.load(Ordering::Relaxed),
            self.counters.errors.load(Ordering::Relaxed),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::{ErrorEnvelope, ServiceObservability};
    use quantos_core::CorrelationId;

    #[test]
    fn exposes_health_metrics_and_correlation_trace() {
        let probe = ServiceObservability::new("runtime-gateway");
        assert!(probe.render("/healthz").contains("\"ready\":true"));
        assert!(probe.render("/metrics").contains("quantos_service_ready"));

        let correlation_id = CorrelationId::new();
        let response = probe.render(&format!("/trace/{correlation_id}"));
        assert!(response.contains(&correlation_id.to_string()));
        assert!(!response.contains("DATABASE_URL"));
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
}
