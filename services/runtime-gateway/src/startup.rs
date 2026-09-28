//! Independent, read-only connection initialization. Never replay business writes.
use anyhow::{Context, Result};
use serde_json::json;
use std::{
    io,
    time::{Duration, Instant},
};

fn transient_transport(error: &anyhow::Error) -> bool {
    error
        .chain()
        .filter_map(|cause| cause.downcast_ref::<io::Error>())
        .any(|cause| {
            matches!(
                cause.kind(),
                io::ErrorKind::ConnectionReset
                    | io::ErrorKind::ConnectionAborted
                    | io::ErrorKind::UnexpectedEof
                    | io::ErrorKind::TimedOut
            )
        })
}

async fn phase<T: Send + 'static>(
    name: &'static str,
    mut connect: impl FnMut() -> Result<T> + Send + 'static,
) -> Result<T> {
    tokio::task::spawn_blocking(move || {
        let started = Instant::now();
        for attempt in 1..=3 {
            eprintln!("{}", json!({"service":"runtime-gateway","event":"startup_phase",
                "phase":name,"attempt":attempt,"status":"started"}));
            match connect() {
                Ok(value) => {
                    eprintln!("{}", json!({"service":"runtime-gateway","event":"startup_phase",
                        "phase":name,"attempt":attempt,"status":"ready","elapsed_ms":started.elapsed().as_millis()}));
                    return Ok(value);
                }
                Err(error) => {
                    let retry = attempt < 3 && transient_transport(&error);
                    // Never emit error text, connection strings or credentials.
                    eprintln!("{}", json!({"service":"runtime-gateway","event":"startup_phase",
                        "phase":name,"attempt":attempt,"status":if retry {"retry_transport"} else {"failed"},
                        "elapsed_ms":started.elapsed().as_millis()}));
                    if !retry { return Err(error).with_context(|| format!("Runtime startup phase {name} failed")); }
                    std::thread::sleep(Duration::from_millis(250 * attempt));
                }
            }
        }
        unreachable!("last attempt always returns")
    }).await.context("Runtime startup task failed")?
}

pub async fn initialize<A: Send + 'static, B: Send + 'static, C: Send + 'static>(
    auth: impl FnMut() -> Result<A> + Send + 'static,
    store: impl FnMut() -> Result<B> + Send + 'static,
    worker: impl FnMut() -> Result<C> + Send + 'static,
) -> Result<(A, B, C)> {
    // join! also waits for peers on failure; no detached initialization remains.
    let (auth, store, worker) = tokio::join!(
        phase("bff_auth", auth),
        phase("runtime_store", store),
        phase("worker_store", worker)
    );
    Ok((auth?, store?, worker?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };

    #[tokio::test]
    async fn independent_connections_start_together() {
        fn meet(started: Arc<AtomicUsize>, value: i32) -> Result<i32> {
            started.fetch_add(1, Ordering::SeqCst);
            let deadline = Instant::now() + Duration::from_secs(2);
            while started.load(Ordering::SeqCst) < 3 && Instant::now() < deadline {
                std::thread::sleep(Duration::from_millis(1));
            }
            anyhow::ensure!(
                started.load(Ordering::SeqCst) == 3,
                "initialization was serialized"
            );
            Ok(value)
        }
        let started = Arc::new(AtomicUsize::new(0));
        let a = started.clone();
        let b = started.clone();
        let result = initialize(
            move || meet(a.clone(), 1),
            move || meet(b.clone(), 2),
            move || meet(started.clone(), 3),
        )
        .await
        .unwrap();
        assert_eq!(result, (1, 2, 3));
    }

    #[tokio::test]
    async fn retries_only_transient_transport_and_stops_at_three() {
        for (kind, failures, expected) in [
            (io::ErrorKind::ConnectionReset, 1, 2),
            (io::ErrorKind::UnexpectedEof, 9, 3),
            (io::ErrorKind::PermissionDenied, 9, 1),
        ] {
            let calls = Arc::new(AtomicUsize::new(0));
            let observed = calls.clone();
            let result = phase("test", move || {
                if observed.fetch_add(1, Ordering::SeqCst) < failures {
                    Err(io::Error::new(kind, "test transport")).context("wrapped connector error")
                } else {
                    Ok(())
                }
            })
            .await;
            assert_eq!(calls.load(Ordering::SeqCst), expected);
            assert_eq!(result.is_ok(), failures == 1);
        }
    }

    #[tokio::test]
    async fn certificate_or_role_failure_is_not_retried_and_peers_are_dropped() {
        struct Connection(Arc<AtomicUsize>);
        impl Drop for Connection {
            fn drop(&mut self) {
                self.0.fetch_add(1, Ordering::SeqCst);
            }
        }
        for message in ["certificate verify failed", "role denied"] {
            let calls = Arc::new(AtomicUsize::new(0));
            let observed = calls.clone();
            let drops = Arc::new(AtomicUsize::new(0));
            let a = drops.clone();
            let b = drops.clone();
            let result = initialize(
                move || -> Result<()> {
                    observed.fetch_add(1, Ordering::SeqCst);
                    anyhow::bail!(message)
                },
                move || Ok(Connection(a.clone())),
                move || Ok(Connection(b.clone())),
            )
            .await;
            assert!(result.is_err());
            assert_eq!(calls.load(Ordering::SeqCst), 1);
            assert_eq!(drops.load(Ordering::SeqCst), 2);
        }
    }
}
