//! Local single-host persistence. A stable inode lock fences cooperating processes;
//! authenticated atomic replacement is synced before any downstream side effect.
//! This is not a distributed database or protection against an owner rolling back
//! the entire directory/key. Never use a browser-supplied path or key.
use crate::assisted::Error;
use hmac::{Hmac, Mac};
use quantos_core::canonical_json_bytes;
use serde_json::{Value, json};
use sha2::Sha256;
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

#[derive(Clone)]
pub struct DurableStore {
    directory: PathBuf,
    name: String,
    key: [u8; 32],
    verified: Arc<Mutex<Option<VerifiedBytes>>>,
}
// Bound to one immutable store name/key. Only successful MAC verification or
// completed authenticated fsync writes may populate this cache. No assertions
// supplied by callers or checkpoints can create a verified entry.
struct VerifiedBytes {
    bytes: Vec<u8>,
    value: Value,
}
pub struct LockedStore {
    store: DurableStore,
    _lock: File,
}
impl Drop for DurableStore {
    fn drop(&mut self) {
        zeroize::Zeroize::zeroize(&mut self.key);
    }
}
fn unavailable<T>(_: T) -> Error {
    Error::Unavailable
}
fn private_file(path: &Path) -> Result<(), Error> {
    let m = fs::symlink_metadata(path).map_err(unavailable)?;
    if !m.is_file() {
        return Err(Error::Unavailable);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};
        if m.permissions().mode() & 0o077 != 0 || m.nlink() != 1 {
            return Err(Error::Unavailable);
        }
    }
    Ok(())
}
fn options() -> OpenOptions {
    let mut o = OpenOptions::new();
    o.read(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        o.mode(0o600);
    }
    o
}
impl DurableStore {
    pub fn new(directory: &Path, name: &str, key: [u8; 32]) -> Result<Self, Error> {
        if key.iter().all(|b| *b == 0)
            || name.is_empty()
            || !name.bytes().all(|b| b.is_ascii_lowercase() || b == b'-')
        {
            return Err(Error::Invalid);
        }
        let m = fs::symlink_metadata(directory).map_err(unavailable)?;
        if !m.is_dir()
            || !directory.is_absolute()
            || fs::canonicalize(directory).map_err(unavailable)? != directory
        {
            return Err(Error::Unavailable);
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if m.permissions().mode() & 0o077 != 0 {
                return Err(Error::Unavailable);
            }
        }
        let store = Self {
            directory: directory.into(),
            name: name.into(),
            key,
            verified: Arc::new(Mutex::new(None)),
        };
        // Complete bootstrap before handing a store to request processing.
        {
            let tx = store.lock()?;
            tx.read()?;
        }
        Ok(store)
    }
    fn path(&self, suffix: &str) -> PathBuf {
        self.directory.join(format!("{}.{}", self.name, suffix))
    }
    pub fn lock(&self) -> Result<LockedStore, Error> {
        let path = self.path("lock");
        let created = match options().create_new(true).open(&path) {
            Ok(f) => {
                f.sync_all().map_err(unavailable)?;
                true
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => false,
            Err(_) => return Err(Error::Unavailable),
        };
        private_file(&path)?;
        let lock = options().open(path).map_err(unavailable)?;
        lock.lock().map_err(unavailable)?;
        let tx = LockedStore {
            store: self.clone(),
            _lock: lock,
        };
        if created && !self.path("json").try_exists().map_err(unavailable)? {
            tx.write(&Value::Null)?;
        }
        // A vanished checkpoint beside an existing lock is damage, never an
        // instruction to forget dedupe state and start a new execution history.
        private_file(&self.path("json"))?;
        Ok(tx)
    }
}
impl LockedStore {
    pub fn read(&self) -> Result<Option<Value>, Error> {
        let path = self.store.path("json");
        match fs::symlink_metadata(&path) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Err(Error::Unavailable),
            Err(_) => return Err(Error::Unavailable),
            Ok(_) => {}
        }
        private_file(&path)?;
        let f = File::open(path).map_err(unavailable)?;
        if f.metadata().map_err(unavailable)?.len() > 32 * 1024 * 1024 {
            return Err(Error::Unavailable);
        }
        let mut bytes = vec![];
        f.take(32 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(unavailable)?;
        {
            let cached = self.store.verified.lock().map_err(unavailable)?;
            if let Some(v) = cached.as_ref().filter(|v| v.bytes == bytes) {
                return Ok((!v.value.is_null()).then(|| v.value.clone()));
            }
        }
        let packet: Value = serde_json::from_slice(&bytes).map_err(unavailable)?;
        let raw = canonical_json_bytes(&json!([
            "quantos-l04-durable/v1",
            self.store.name,
            packet["value"]
        ]))
        .map_err(unavailable)?;
        let signature = hex::decode(packet["signature"].as_str().ok_or(Error::Unavailable)?)
            .map_err(unavailable)?;
        let mut mac = Hmac::<Sha256>::new_from_slice(&self.store.key).map_err(unavailable)?;
        mac.update(&raw);
        mac.verify_slice(&signature).map_err(unavailable)?;
        let value = packet["value"].clone();
        *self.store.verified.lock().map_err(unavailable)? = Some(VerifiedBytes {
            bytes,
            value: value.clone(),
        });
        Ok((!value.is_null()).then_some(value))
    }
    pub fn write(&self, value: &Value) -> Result<(), Error> {
        let raw = canonical_json_bytes(&json!(["quantos-l04-durable/v1", self.store.name, value]))
            .map_err(unavailable)?;
        let mut mac = Hmac::<Sha256>::new_from_slice(&self.store.key).map_err(unavailable)?;
        mac.update(&raw);
        let bytes = serde_json::to_vec(
            &json!({"value":value,"signature":hex::encode(mac.finalize().into_bytes())}),
        )
        .map_err(unavailable)?;
        if bytes.len() > 32 * 1024 * 1024 {
            return Err(Error::Unavailable);
        }
        let temporary = self.store.path(&format!("{}.tmp", uuid::Uuid::new_v4()));
        let mut file = options()
            .create_new(true)
            .open(&temporary)
            .map_err(unavailable)?;
        file.write_all(&bytes)
            .and_then(|()| file.sync_all())
            .map_err(unavailable)?;
        fs::rename(&temporary, self.store.path("json")).map_err(unavailable)?;
        File::open(&self.store.directory)
            .and_then(|f| f.sync_all())
            .map_err(unavailable)?;
        *self.store.verified.lock().map_err(unavailable)? = Some(VerifiedBytes {
            bytes,
            value: value.clone(),
        });
        Ok(())
    }
}
