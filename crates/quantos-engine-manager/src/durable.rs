use std::{
    collections::BTreeMap,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    os::{
        fd::AsRawFd,
        unix::fs::{OpenOptionsExt, PermissionsExt},
    },
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

use quantos_proto::quantos::engine::v1::ExecuteResponse;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{EngineCircuitState, EngineManagerError};

static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone)]
pub(crate) struct DurableLedger {
    directory: PathBuf,
}

#[derive(Debug, Serialize, Deserialize)]
struct CompletedRecord {
    fingerprint: String,
    tenant_id: String,
    engine_name: String,
    response: ExecuteResponse,
}

#[derive(Debug, Serialize, Deserialize)]
struct CircuitRecord {
    manifest_sha256: String,
    state: EngineCircuitState,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct LedgerState {
    pending: BTreeMap<String, String>,
    completed: BTreeMap<String, CompletedRecord>,
    circuits: BTreeMap<String, CircuitRecord>,
}

pub(crate) enum BeginRequest {
    Cached(Box<ExecuteResponse>),
    Dispatch(File),
}

fn transport(error: impl ToString) -> EngineManagerError {
    EngineManagerError::Transport(format!("durable ledger: {}", error.to_string()))
}

fn lock(path: &Path, nonblocking: bool) -> Result<File, EngineManagerError> {
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .mode(0o600)
        .open(path)
        .map_err(transport)?;
    // F08 runs over UDS on Unix. Advisory locks are released by the kernel on
    // process death, including an OS kill in the middle of a request.
    let mode = libc::LOCK_EX | if nonblocking { libc::LOCK_NB } else { 0 };
    let result = unsafe { libc::flock(file.as_raw_fd(), mode) };
    if result != 0 {
        return Err(EngineManagerError::DurableBusy);
    }
    Ok(file)
}

impl DurableLedger {
    pub(crate) fn new(directory: PathBuf) -> Result<Self, EngineManagerError> {
        if !directory.exists() {
            fs::create_dir_all(&directory).map_err(transport)?;
            fs::set_permissions(&directory, fs::Permissions::from_mode(0o700))
                .map_err(transport)?;
        }
        let metadata = fs::symlink_metadata(&directory).map_err(transport)?;
        if !metadata.file_type().is_dir() || metadata.permissions().mode() & 0o077 != 0 {
            return Err(transport(
                "state directory must be a private real directory",
            ));
        }
        let ledger = Self { directory };
        ledger.read_locked()?;
        Ok(ledger)
    }

    fn state_path(&self) -> PathBuf {
        self.directory.join("state.json")
    }

    fn read(&self) -> Result<LedgerState, EngineManagerError> {
        let path = self.state_path();
        if !path.exists() {
            return Ok(LedgerState::default());
        }
        let mut bytes = Vec::new();
        File::open(path)
            .map_err(transport)?
            .read_to_end(&mut bytes)
            .map_err(transport)?;
        serde_json::from_slice(&bytes).map_err(transport)
    }

    fn read_locked(&self) -> Result<LedgerState, EngineManagerError> {
        let _guard = lock(&self.directory.join("state.lock"), false)?;
        self.read()
    }

    fn update<T>(
        &self,
        change: impl FnOnce(&mut LedgerState) -> Result<T, EngineManagerError>,
    ) -> Result<T, EngineManagerError> {
        let _guard = lock(&self.directory.join("state.lock"), false)?;
        let mut state = self.read()?;
        let value = change(&mut state)?;
        let bytes = serde_json::to_vec(&state).map_err(transport)?;
        let temp = self.directory.join(format!(
            "state.{}.{}.tmp",
            std::process::id(),
            NEXT_TEMP.fetch_add(1, Ordering::Relaxed)
        ));
        let mut output = OpenOptions::new()
            .create_new(true)
            .write(true)
            .mode(0o600)
            .open(&temp)
            .map_err(transport)?;
        output.write_all(&bytes).map_err(transport)?;
        output.sync_all().map_err(transport)?;
        fs::rename(&temp, self.state_path()).map_err(transport)?;
        File::open(&self.directory)
            .map_err(transport)?
            .sync_all()
            .map_err(transport)?;
        Ok(value)
    }

    pub(crate) fn begin_request(
        &self,
        key: &str,
        fingerprint: &str,
        retry_safe: bool,
    ) -> Result<BeginRequest, EngineManagerError> {
        let digest = Sha256::digest(key.as_bytes());
        let name: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
        let guard = lock(&self.directory.join(format!("request-{name}.lock")), true)?;
        let state = self.read_locked()?;
        if let Some(record) = state.completed.get(key) {
            return if record.fingerprint == fingerprint {
                Ok(BeginRequest::Cached(Box::new(record.response.clone())))
            } else {
                Err(EngineManagerError::IdempotencyConflict)
            };
        }
        if let Some(pending) = state.pending.get(key) {
            if pending != fingerprint {
                return Err(EngineManagerError::IdempotencyConflict);
            }
            if !retry_safe {
                return Err(EngineManagerError::ResultUncertain);
            }
        } else {
            self.update(|state| {
                state.pending.insert(key.to_owned(), fingerprint.to_owned());
                Ok(())
            })?;
        }
        Ok(BeginRequest::Dispatch(guard))
    }

    pub(crate) fn complete_request(
        &self,
        key: &str,
        fingerprint: &str,
        tenant_id: &str,
        engine_name: &str,
        response: &ExecuteResponse,
    ) -> Result<(), EngineManagerError> {
        self.update(|state| {
            if state.pending.get(key).map(String::as_str) != Some(fingerprint) {
                return Err(EngineManagerError::IdempotencyConflict);
            }
            state.completed.insert(
                key.to_owned(),
                CompletedRecord {
                    fingerprint: fingerprint.to_owned(),
                    tenant_id: tenant_id.to_owned(),
                    engine_name: engine_name.to_owned(),
                    response: response.clone(),
                },
            );
            state.pending.remove(key);
            Ok(())
        })
    }

    pub(crate) fn completed(
        &self,
        key: &str,
    ) -> Result<Option<ExecuteResponse>, EngineManagerError> {
        Ok(self
            .read_locked()?
            .completed
            .get(key)
            .map(|record| record.response.clone()))
    }

    pub(crate) fn completed_owners(
        &self,
    ) -> Result<BTreeMap<String, (String, String)>, EngineManagerError> {
        Ok(self
            .read_locked()?
            .completed
            .values()
            .map(|record| {
                (
                    record.response.execution_id.clone(),
                    (record.tenant_id.clone(), record.engine_name.clone()),
                )
            })
            .collect())
    }

    pub(crate) fn owner_for_execution(
        &self,
        execution_id: &str,
    ) -> Result<Option<(String, String)>, EngineManagerError> {
        Ok(self
            .read_locked()?
            .completed
            .values()
            .find(|record| record.response.execution_id == execution_id)
            .map(|record| (record.tenant_id.clone(), record.engine_name.clone())))
    }

    pub(crate) fn completed_count(&self) -> Result<usize, EngineManagerError> {
        Ok(self.read_locked()?.completed.len())
    }

    pub(crate) fn circuit(
        &self,
        engine_name: &str,
        manifest_sha256: &str,
    ) -> Result<Option<EngineCircuitState>, EngineManagerError> {
        Ok(self
            .read_locked()?
            .circuits
            .get(engine_name)
            .filter(|record| record.manifest_sha256 == manifest_sha256)
            .map(|record| {
                let mut state = record.state;
                state.half_open_probe = false;
                state.reported_rss_mb = 0;
                state
            }))
    }

    pub(crate) fn save_circuit(
        &self,
        engine_name: &str,
        manifest_sha256: &str,
        circuit: EngineCircuitState,
    ) -> Result<(), EngineManagerError> {
        self.update(|state| {
            state.circuits.insert(
                engine_name.to_owned(),
                CircuitRecord {
                    manifest_sha256: manifest_sha256.to_owned(),
                    state: circuit,
                },
            );
            Ok(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pending_key_is_exclusive_and_completed_result_survives_reopen() {
        let directory = tempfile::tempdir().expect("temp state directory");
        let ledger = DurableLedger::new(directory.path().join("ledger")).expect("new ledger");
        let guard = match ledger
            .begin_request("key", "fingerprint", true)
            .expect("begin")
        {
            BeginRequest::Dispatch(guard) => guard,
            BeginRequest::Cached(_) => panic!("new key cannot be cached"),
        };
        assert_eq!(
            ledger
                .begin_request("key", "fingerprint", true)
                .err()
                .map(|e| e.machine_code()),
            Some("ENGINE_DURABLE_BUSY")
        );
        drop(guard);
        assert_eq!(
            ledger
                .begin_request("key", "fingerprint", false)
                .err()
                .map(|e| e.machine_code()),
            Some("ENGINE_RESULT_UNCERTAIN")
        );
        assert_eq!(
            ledger
                .begin_request("key", "changed", true)
                .err()
                .map(|e| e.machine_code()),
            Some("ENGINE_IDEMPOTENCY_CONFLICT")
        );
        let guard = match ledger
            .begin_request("key", "fingerprint", true)
            .expect("retry")
        {
            BeginRequest::Dispatch(guard) => guard,
            BeginRequest::Cached(_) => panic!("pending key cannot be cached"),
        };
        let response = ExecuteResponse {
            execution_id: "execution-1".to_owned(),
            ..ExecuteResponse::default()
        };
        ledger
            .complete_request("key", "fingerprint", "tenant", "engine", &response)
            .expect("durable completion");
        drop(guard);
        let reopened = DurableLedger::new(directory.path().join("ledger")).expect("reopen");
        assert!(
            matches!(reopened.begin_request("key", "fingerprint", true), Ok(BeginRequest::Cached(value)) if *value == response)
        );
        assert_eq!(
            reopened.completed_owners().expect("owners")["execution-1"],
            ("tenant".to_owned(), "engine".to_owned())
        );
        assert_eq!(reopened.completed_count().expect("count"), 1);
        assert_eq!(
            reopened.owner_for_execution("execution-1").expect("owner"),
            Some(("tenant".to_owned(), "engine".to_owned()))
        );
        assert_eq!(
            reopened
                .begin_request("key", "changed", true)
                .err()
                .map(|e| e.machine_code()),
            Some("ENGINE_IDEMPOTENCY_CONFLICT")
        );
    }

    #[test]
    fn corrupt_ledger_fails_closed() {
        let directory = tempfile::tempdir().expect("temp state directory");
        std::fs::write(directory.path().join("state.json"), b"not-json").expect("corrupt state");
        assert!(DurableLedger::new(directory.path().to_path_buf()).is_err());
    }

    #[test]
    fn world_readable_state_directory_is_rejected() {
        let directory = tempfile::tempdir().expect("temp state directory");
        std::fs::set_permissions(directory.path(), std::fs::Permissions::from_mode(0o755))
            .expect("change permissions");
        assert!(DurableLedger::new(directory.path().to_path_buf()).is_err());
    }
}
