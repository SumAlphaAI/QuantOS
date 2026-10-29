use super::native_refresh_cases::context;
use super::*;
use quantos_execution::assisted_activation::RuntimeActivation;
fn activation(f: &F, version: u64) -> RuntimeActivation {
    RuntimeActivation {
        version,
        enabled: true,
        valid_from: f.f.now,
        valid_until: f.f.now + Duration::seconds(30),
        head: ContentHash::sha256_bytes(format!("lease-{version}").as_bytes()),
    }
}
fn pair(f: &F, subject: Subject, key: &str) -> Receipt {
    f.service.register_subject(subject.clone()).unwrap();
    let r = f
        .service
        .open("requester", subject.id, key, f.f.now)
        .unwrap()
        .receipt;
    for (i, who) in ["first", "second"].into_iter().enumerate() {
        let p = f
            .mfa
            .attest_provider_completed(
                f.service.challenge(who, r.request, f.f.now).unwrap(),
                f.f.now,
            )
            .unwrap();
        f.service
            .approve(
                who,
                r.request,
                i as u64,
                &format!("{key}-{who}"),
                p,
                f.f.now,
            )
            .unwrap();
    }
    f.service.inspect("requester", r.request, f.f.now).unwrap()
}
#[test]
fn exact_current_dispatch_requires_new_pair_owner_context_current_c11_and_one_snapshot_budget() {
    let f = F::new();
    let c = context(&f, true, 0);
    let r = f
        .source
        .refresh_native(f.subject.id, c.clone(), f.f.now)
        .unwrap();
    let approved = pair(&f, r.subject.unwrap(), "new-pair");
    let (n, calls) = f.native();
    let lease = activation(&f, 1);
    f.service.apply_runtime_activation(lease.clone()).unwrap();
    n.apply_runtime_activation(lease.clone()).unwrap();
    assert!(
        n.submit("requester", approved.request, "legacy-bypass", f.f.now)
            .is_err()
    );
    let mut wrong = c.clone();
    wrong.input.version += 1;
    assert!(
        n.submit_current(
            "requester",
            approved.request,
            "wrong-source",
            &wrong,
            f.f.now
        )
        .is_err()
    );
    let next = activation(&f, 2);
    f.service.apply_runtime_activation(next.clone()).unwrap();
    assert!(
        n.submit_current("requester", approved.request, "old-native-c11", &c, f.f.now)
            .is_err()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    n.apply_runtime_activation(next.clone()).unwrap();
    let command = n
        .submit_current("requester", approved.request, "current", &c, f.f.now)
        .unwrap();
    assert_eq!(command.state, "accepted");
    let b = command.current_risk.as_ref().unwrap();
    assert_eq!(b.snapshot_hash, c.snapshot.snapshot_hash);
    assert_eq!(b.activation, next);
    assert_eq!(b.notional, "1000");
    assert!(command.expires_at <= next.valid_until);
    assert_eq!(
        n.submit_current("requester", approved.request, "current", &c, f.f.now)
            .unwrap(),
        command
    );
    assert!(
        n.submit_current("requester", approved.request, "new-key", &c, f.f.now)
            .is_err()
    );
    // A distinct immutable Proposal and fresh decision cannot spend the same snapshot twice.
    let mut intent = f.f.intent.clone();
    intent.command_key = "distinct-proposal".into();
    let mut record = F::record(&f.f);
    record.proposal_id = "proposal:distinct-proposal".into();
    record.output["proposal_id"] = json!(record.proposal_id);
    let bytes = canonical_json_bytes(&record.output).unwrap();
    record.artifact_manifest.content_hash = ContentHash::sha256_bytes(&bytes);
    record.artifact_manifest.size_bytes = bytes.len() as u64;
    let candidate = f
        .source
        .register_candidate(f.f.auth.clone(), record, intent, F::current(&f.f))
        .unwrap();
    let second = f
        .source
        .refresh_native(candidate, c.clone(), f.f.now)
        .unwrap();
    let second = pair(&f, second.subject.unwrap(), "another-pair");
    assert!(
        n.submit_current("requester", second.request, "same-budget", &c, f.f.now)
            .is_err()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    let cp = f.service.checkpoint().unwrap();
    let restored_source = CurrentSubjectSource::new(f.f.guard(), [74; 32]).unwrap();
    let restored = F::service(&f.f, &restored_source);
    restored.restore_checkpoint(&cp).unwrap();
    assert_eq!(restored_source.review_candidates(f.f.now).unwrap().len(), 2);
}
#[test]
fn current_snapshot_generation_expiry_and_disabled_activation_never_dispatch() {
    for kind in ["expiry", "generation", "disabled"] {
        let f = F::new();
        let c = context(&f, true, 0);
        let review = f
            .source
            .refresh_native(f.subject.id, c.clone(), f.f.now)
            .unwrap();
        let approved = pair(&f, review.subject.unwrap(), "pair");
        let (n, calls) = f.native();
        let mut lease = activation(&f, 1);
        if kind == "disabled" {
            lease.enabled = false;
        }
        f.service.apply_runtime_activation(lease.clone()).unwrap();
        n.apply_runtime_activation(lease).unwrap();
        if kind == "generation" {
            n.apply_kill_control(1, false).unwrap();
        }
        let at = if kind == "expiry" {
            c.snapshot.expires_at
        } else {
            f.f.now
        };
        assert!(
            n.submit_current("requester", approved.request, "deny", &c, at)
                .is_err()
        );
        assert_eq!(calls.load(Ordering::SeqCst), 0);
    }
}
#[test]
fn current_durable_claims_signature_and_immutable_high_water_refuse_rollback() {
    let f = F::new();
    let c = context(&f, true, 0);
    let r = f
        .source
        .refresh_native(f.subject.id, c.clone(), f.f.now)
        .unwrap();
    let approved = pair(&f, r.subject.unwrap(), "pair");
    let directory = std::env::temp_dir()
        .canonicalize()
        .unwrap()
        .join(format!("quantos-current-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&directory).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    let store =
        quantos_execution::durable::DurableStore::new(&directory, "commands", [81; 32]).unwrap();
    let (n, calls) = f.native();
    let n = n.with_durable(store.clone()).unwrap();
    let lease = activation(&f, 1);
    f.service.apply_runtime_activation(lease.clone()).unwrap();
    n.apply_runtime_activation(lease).unwrap();
    let empty = store.lock().unwrap().read().unwrap().unwrap();
    let command = n
        .submit_current("requester", approved.request, "current", &c, f.f.now)
        .unwrap();
    let saved = store.lock().unwrap().read().unwrap().unwrap();
    store.lock().unwrap().write(&empty).unwrap();
    assert!(n.control_status().is_err());
    store.lock().unwrap().write(&saved).unwrap();
    assert_eq!(
        n.inspect("requester", approved.request, f.f.now)
            .unwrap()
            .unwrap(),
        command
    );
    let (cold, _) = f.native();
    let cold = cold.with_durable(store.clone()).unwrap();
    let mut tampered = saved.clone();
    tampered["issued"][approved.request.to_string()]["receipt"]["currentRisk"]["notional"] =
        json!("0");
    store.lock().unwrap().write(&tampered).unwrap();
    assert!(
        cold.inspect("requester", approved.request, f.f.now)
            .is_err()
    );
    store.lock().unwrap().write(&saved).unwrap();
    assert_eq!(
        cold.inspect("requester", approved.request, f.f.now)
            .unwrap()
            .unwrap(),
        command
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    std::fs::remove_dir_all(directory).unwrap();
}
