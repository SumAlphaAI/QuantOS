#[path = "support/l03_fixture.rs"]
mod support;
use quantos_execution::{assisted::*, assisted_execution::*, durable::DurableStore, gateway::*};
use serde_json::json;
use std::{
    fs,
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
};
use support::*;
struct Directory(PathBuf);
impl Directory {
    fn new() -> Self {
        let p = std::env::temp_dir()
            .canonicalize()
            .unwrap()
            .join(format!("quantos-l04-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&p).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&p, fs::Permissions::from_mode(0o700)).unwrap();
        }
        Self(p)
    }
}
impl Drop for Directory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
struct Kernel(Arc<AtomicUsize>);
impl ExecutionKernel for Kernel {
    fn submit(&mut self, _: &BoundaryCommand) -> Result<(), String> {
        self.0.fetch_add(1, Ordering::SeqCst);
        Err("owned committed response loss".into())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        vec![]
    }
}
fn native(
    f: &Fixture,
    d: &Directory,
    key: [u8; 32],
    calls: Arc<AtomicUsize>,
) -> AssistedExecution<Kernel> {
    AssistedExecution::new(
        f.service.clone(),
        GatewayLimits {
            max_quantity: 1000.into(),
            max_notional: 50000.into(),
            allowed_venues: vec![f.subject.venue.clone()],
        },
        Kernel(calls),
        support::key(),
    )
    .unwrap()
    .with_durable(DurableStore::new(&d.0, "commands", key).unwrap())
    .unwrap()
}
#[test]
fn core_l04_durable_independent_instances_fence_proposal_and_current_revocation() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Directory::new();
    let key = key();
    let calls = Arc::new(AtomicUsize::new(0));
    let a = native(&f, &d, key, calls.clone());
    let b = native(&f, &d, key, calls.clone());
    let (rows1, rows2) = std::thread::scope(|s| {
        let a = s.spawn(|| a.submit("operator", r.request, "same", at()).unwrap());
        let b = s.spawn(|| b.submit("operator", r.request, "same", at()).unwrap());
        (a.join().unwrap(), b.join().unwrap())
    });
    assert_eq!(rows1, rows2);
    assert_eq!(rows1.state, "unknown");
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    drop(a);
    drop(b);
    let recovered = native(&f, &d, key, calls.clone());
    assert_eq!(
        recovered
            .submit("operator", r.request, "same", at())
            .unwrap(),
        rows1
    );
    assert!(
        recovered
            .submit("operator", r.request, "different", at())
            .is_err()
    );
    f.service.revoke_session("first").unwrap();
    assert!(
        recovered
            .submit("operator", r.request, "same", at())
            .is_err()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
#[test]
fn core_l04_store_hmac_wrong_key_corruption_deletion_permissions_and_link_refuse() {
    let d = Directory::new();
    let k = key();
    let store = DurableStore::new(&d.0, "events", k).unwrap();
    {
        let tx = store.lock().unwrap();
        assert!(tx.read().unwrap().is_none());
        tx.write(&json!({"original":1})).unwrap();
    }
    assert_eq!(
        store.lock().unwrap().read().unwrap().unwrap()["original"],
        1
    );
    assert!(DurableStore::new(&d.0, "events", key()).is_err());
    let original = fs::read(d.0.join("events.json")).unwrap();
    fs::write(d.0.join("events.json"), b"{}").unwrap();
    assert!(store.lock().unwrap().read().is_err());
    fs::write(d.0.join("events.json"), &original).unwrap();
    fs::remove_file(d.0.join("events.json")).unwrap();
    assert!(store.lock().is_err());
    #[cfg(unix)]
    {
        use std::os::unix::fs::{PermissionsExt, symlink};
        fs::write(d.0.join("events.json"), &original).unwrap();
        fs::set_permissions(d.0.join("events.json"), fs::Permissions::from_mode(0o644)).unwrap();
        assert!(store.lock().is_err());
        fs::remove_file(d.0.join("events.json")).unwrap();
        symlink(d.0.join("events.lock"), d.0.join("events.json")).unwrap();
        assert!(store.lock().is_err());
    }
}
#[test]
fn core_l04_checkpoint_tamper_wrong_authority_and_current_sessions_not_restored() {
    let f = Fixture::new(true);
    let r = f.pair();
    let snapshot = f.service.checkpoint().unwrap();
    f.service.restore_checkpoint(&snapshot).unwrap();
    let mut corrupted = snapshot.clone();
    corrupted["value"]["revision"] = json!(900);
    assert!(f.service.restore_checkpoint(&corrupted).is_err());
    let other = Fixture::new(true);
    assert!(other.service.restore_checkpoint(&snapshot).is_err());
    f.service.revoke_subject(f.subject.id).unwrap();
    f.service.restore_checkpoint(&snapshot).unwrap();
    assert!(f.service.inspect("operator", r.request, at()).is_err());
    f.service.revoke_session("operator").unwrap();
    f.service.restore_checkpoint(&snapshot).unwrap();
    assert!(f.service.inspect("operator", r.request, at()).is_err());
}
#[test]
fn core_l04_original_half_open_deadline_is_not_extended_by_recovery() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Directory::new();
    let k = key();
    let calls = Arc::new(AtomicUsize::new(0));
    let n = native(&f, &d, k, calls.clone());
    let receipt = n.submit("operator", r.request, "same", at()).unwrap();
    drop(n);
    let n = native(&f, &d, k, calls.clone());
    assert!(
        n.submit("operator", r.request, "same", receipt.expires_at)
            .is_err()
    );
    assert_eq!(
        n.inspect("operator", r.request, receipt.expires_at)
            .unwrap(),
        Some(receipt)
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}

#[test]
fn core_l04_kill_switch_persists_and_blocks_other_instances_before_io() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Directory::new();
    let k = key();
    let calls = Arc::new(AtomicUsize::new(0));
    let first = native(&f, &d, k, calls.clone());
    let other = native(&f, &d, k, calls.clone());
    first.engage_kill_switch().unwrap();
    assert_eq!(
        other
            .submit("operator", r.request, "same", at())
            .unwrap_err(),
        Error::Disabled
    );
    drop(first);
    drop(other);
    let restart = native(&f, &d, k, calls.clone());
    assert_eq!(
        restart
            .submit("operator", r.request, "same", at())
            .unwrap_err(),
        Error::Disabled
    );
    assert_eq!(calls.load(Ordering::SeqCst), 0);
}
#[test]
fn core_l04_verified_byte_cache_observes_other_writers_and_never_masks_corruption_or_permissions() {
    let d = Directory::new();
    let secret = key();
    let a = DurableStore::new(&d.0, "cache", secret).unwrap();
    a.lock().unwrap().write(&json!({"revision":1})).unwrap();
    assert_eq!(
        a.lock().unwrap().read().unwrap(),
        Some(json!({"revision":1}))
    );
    let b = DurableStore::new(&d.0, "cache", secret).unwrap();
    b.lock().unwrap().write(&json!({"revision":2})).unwrap();
    assert_eq!(
        a.lock().unwrap().read().unwrap(),
        Some(json!({"revision":2})),
        "cached read hid another writer"
    );
    let original = fs::read(d.0.join("cache.json")).unwrap();
    fs::write(d.0.join("cache.json"), b"{broken").unwrap();
    assert!(a.lock().unwrap().read().is_err());
    fs::write(d.0.join("cache.json"), &original).unwrap();
    assert_eq!(
        a.lock().unwrap().read().unwrap(),
        Some(json!({"revision":2}))
    );
    assert!(
        DurableStore::new(&d.0, "cache", key()).is_err(),
        "another key reused verified bytes"
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(d.0.join("cache.json"), fs::Permissions::from_mode(0o644)).unwrap();
        assert!(
            a.lock().is_err(),
            "byte cache bypassed current file permissions"
        );
    }
}

#[test]
fn controlled_native_stop_is_monotonic_durable_and_preserves_unknown_reservations() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Directory::new();
    let store_key = key();
    let calls = Arc::new(AtomicUsize::new(0));
    let a = native(&f, &d, store_key, calls.clone());
    a.apply_kill_control(1, true).unwrap();
    assert!(a.submit("operator", r.request, "original", at()).is_err());
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    drop(a);
    let b = native(&f, &d, store_key, calls.clone());
    assert_eq!(b.control_status().unwrap()["generation"], 1);
    assert_eq!(b.control_status().unwrap()["stopped"], true);
    b.apply_kill_control(2, false).unwrap();
    let first = b.submit("operator", r.request, "original", at()).unwrap();
    assert_eq!(first.state, "unknown");
    let anchor = b.control_status().unwrap()["reservationAnchor"].clone();
    b.apply_kill_control(3, true).unwrap();
    b.apply_kill_control(4, false).unwrap();
    assert_eq!(b.control_status().unwrap()["reservationAnchor"], anchor);
    assert_eq!(
        b.submit("operator", r.request, "original", at()).unwrap(),
        first
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(b.control_status().unwrap()["unknownCount"], 1);
}
#[test]
fn controlled_release_does_not_reset_permanent_emergency_stop() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Directory::new();
    let store_key = key();
    let calls = Arc::new(AtomicUsize::new(0));
    let a = native(&f, &d, store_key, calls.clone());
    a.engage_kill_switch().unwrap();
    a.apply_kill_control(1, true).unwrap();
    a.apply_kill_control(2, false).unwrap();
    assert_eq!(a.control_status().unwrap()["stopped"], true);
    assert_eq!(a.control_status().unwrap()["permanentStop"], true);
    drop(a);
    let b = native(&f, &d, store_key, calls.clone());
    assert!(b.submit("operator", r.request, "no-reset", at()).is_err());
    assert_eq!(calls.load(Ordering::SeqCst), 0);
}
#[test]
fn native_control_rejects_lower_generation_and_same_generation_fork() {
    let f = Fixture::new(true);
    let d = Directory::new();
    let calls = Arc::new(AtomicUsize::new(0));
    let a = native(&f, &d, key(), calls);
    a.apply_kill_control(2, true).unwrap();
    let bytes = fs::read(d.0.join("commands.json")).unwrap();
    assert!(a.apply_kill_control(1, false).is_err());
    assert!(a.apply_kill_control(2, false).is_err());
    assert_eq!(fs::read(d.0.join("commands.json")).unwrap(), bytes);
    a.apply_kill_control(2, true).unwrap();
    assert_eq!(fs::read(d.0.join("commands.json")).unwrap(), bytes);
}

fn activation(
    version: u64,
    enabled: bool,
    seconds: i64,
) -> quantos_execution::assisted_activation::RuntimeActivation {
    quantos_execution::assisted_activation::RuntimeActivation {
        version,
        enabled,
        valid_from: at(),
        valid_until: at() + chrono::Duration::seconds(seconds),
        head: quantos_core::ContentHash::sha256_bytes(
            format!("owned C11 version {version} enabled {enabled}").as_bytes(),
        ),
    }
}
#[test]
fn c11_native_and_approval_lease_gate_io_without_resetting_existing_unknown() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Directory::new();
    let k = key();
    let calls = Arc::new(AtomicUsize::new(0));
    let a = native(&f, &d, k, calls.clone());
    let enabled = activation(0, true, 20);
    f.service.apply_runtime_activation(enabled.clone()).unwrap();
    a.apply_runtime_activation(enabled).unwrap();
    let unknown = a.submit("operator", r.request, "original", at()).unwrap();
    assert_eq!(unknown.state, "unknown");
    let protected = a.control_status().unwrap()["reservationAnchor"].clone();
    let disabled = activation(1, false, 20);
    f.service
        .apply_runtime_activation(disabled.clone())
        .unwrap();
    a.apply_runtime_activation(disabled).unwrap();
    assert!(a.submit("operator", r.request, "original", at()).is_err());
    assert_eq!(
        a.inspect("operator", r.request, at()).unwrap(),
        Some(unknown.clone())
    );
    assert_eq!(
        f.service.capabilities("operator", at()).unwrap()["policyRevision"],
        1
    );
    let enabled = activation(2, true, 20);
    f.service.apply_runtime_activation(enabled.clone()).unwrap();
    a.apply_runtime_activation(enabled).unwrap();
    assert_eq!(
        a.submit("operator", r.request, "original", at()).unwrap(),
        unknown
    );
    assert_eq!(a.control_status().unwrap()["reservationAnchor"], protected);
    assert_eq!(a.control_status().unwrap()["generation"], 0);
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    drop(a);
    let b = native(&f, &d, k, calls.clone());
    assert_eq!(b.control_status().unwrap()["activation"]["version"], 2);
    assert_eq!(
        b.inspect("operator", r.request, at()).unwrap(),
        Some(unknown)
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
#[test]
fn c11_expiry_refuses_new_native_io_at_boundary_without_generation_change() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Directory::new();
    let calls = Arc::new(AtomicUsize::new(0));
    let a = native(&f, &d, key(), calls.clone());
    let lease = activation(0, true, 2);
    f.service.apply_runtime_activation(lease.clone()).unwrap();
    a.apply_runtime_activation(lease).unwrap();
    assert!(
        a.submit(
            "operator",
            r.request,
            "expired",
            at() + chrono::Duration::seconds(2)
        )
        .is_err()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    let status = a.control_status().unwrap();
    assert_eq!(status["generation"], 0);
    assert_eq!(status["issuedCount"], 0);
    assert_eq!(status["activation"]["version"], 0);
}
#[test]
fn c11_restart_rollback_and_same_version_fork_refuse_without_clearing_kill() {
    let f = Fixture::new(true);
    let d = Directory::new();
    let calls = Arc::new(AtomicUsize::new(0));
    let k = key();
    let a = native(&f, &d, k, calls.clone());
    a.apply_kill_control(3, true).unwrap();
    a.apply_runtime_activation(activation(2, true, 20)).unwrap();
    let before = fs::read(d.0.join("commands.json")).unwrap();
    assert!(
        a.apply_runtime_activation(activation(1, false, 20))
            .is_err()
    );
    assert!(
        a.apply_runtime_activation(activation(2, false, 20))
            .is_err()
    );
    assert_eq!(fs::read(d.0.join("commands.json")).unwrap(), before);
    drop(a);
    let b = native(&f, &d, k, calls.clone());
    assert!(
        b.apply_runtime_activation(activation(1, false, 20))
            .is_err()
    );
    assert_eq!(b.control_status().unwrap()["generation"], 3);
    assert_eq!(b.control_status().unwrap()["stopped"], true);
    assert_eq!(calls.load(Ordering::SeqCst), 0);
}

#[test]
fn c11_native_caps_command_deadline_even_when_service_has_no_runtime_lease() {
    let f = Fixture::new(true);
    let r = f.pair();
    let d = Directory::new();
    let calls = Arc::new(AtomicUsize::new(0));
    let a = native(&f, &d, key(), calls.clone());
    a.apply_runtime_activation(activation(0, true, 2)).unwrap();
    let c = a
        .submit("operator", r.request, "native-only", at())
        .unwrap();
    assert_eq!(c.expires_at, at() + chrono::Duration::seconds(2));
    assert!(
        a.submit(
            "operator",
            r.request,
            "native-only",
            at() + chrono::Duration::seconds(2)
        )
        .is_err()
    );
    assert_eq!(
        a.inspect("operator", r.request, at() + chrono::Duration::seconds(3))
            .unwrap(),
        Some(c)
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
