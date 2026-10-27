#[path = "support/l04_book.rs"]
mod reconcile_support;
#[allow(dead_code)]
#[path = "../../quantos-operations/tests/support/mod.rs"]
mod support;
use quantos_core::{CorrelationId, SchemaVersion};
use quantos_event::{AppendOnlyLedger, NewRecordedEvent, RecordedEvent};
use quantos_evidence::{DrillKind, DrillReport, DrillResult, local::*};
use quantos_observability::service::{ExportedTraceRecord, JsonlTraceExporter};
use quantos_reconcile::{exceptions::ReconciliationService, model::Scope as ReconcileScope};
use std::{
    fs,
    path::PathBuf,
    process::{Command, Stdio},
};
use support::*;
fn temporary() -> PathBuf {
    let p = std::env::temp_dir().join(format!("quantos-l04-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&p).unwrap();
    p
}
struct Temp(PathBuf);
impl Drop for Temp {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
struct FailingKernel {
    calls: Arc<std::sync::atomic::AtomicUsize>,
}
impl ExecutionKernel for FailingKernel {
    fn submit(&mut self, _: &BoundaryCommand) -> std::result::Result<(), String> {
        self.calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        Err("owned uncertain transport".into())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        vec![]
    }
}
fn engine_failure() {
    let h = Harness::new();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    let c = h.command();
    let calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let g = SignedExecutionGateway::new(
        h.issuer.clone(),
        GatewayLimits {
            max_quantity: "100".parse().unwrap(),
            max_notional: "50000".parse().unwrap(),
            allowed_venues: vec!["OWNED_PAPER".into()],
        },
        FailingKernel {
            calls: calls.clone(),
        },
    )
    .unwrap();
    let s = OperationsService::new(
        h.config.clone(),
        h.seed.clone(),
        h.issuer.clone(),
        h.guard.clone(),
        g,
    )
    .unwrap();
    s.observe(&h.observer(), &h.report(n, true), &[], n)
        .unwrap();
    let p = s.prepare_submit(a, &m, "outage", &c, n).unwrap();
    assert_eq!(
        s.dispatch_prepared(a, &m, &p.id, h.f.sources(), n)
            .unwrap()
            .outcome,
        Outcome::Uncertain
    );
    assert!(s.dispatch_prepared(a, &m, &p.id, h.f.sources(), n).is_err());
    assert!(s.prepare_submit(a, &m, "new-key", &c, n).is_err());
    assert!(
        !s.observe(
            &h.observer(),
            &h.report(n + Duration::seconds(1), true),
            &[],
            n + Duration::seconds(1)
        )
        .unwrap()
        .ready
    );
    assert!(
        s.alerts(a)
            .unwrap()
            .iter()
            .any(|r| r.rule == "execution_uncertain" && r.active)
    );
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
}
fn packet() -> LocalPacket {
    engine_failure();
    let h = Harness::new();
    let s = h.service();
    let a = &h.f.auth;
    let n = h.f.now;
    let m = step(a, n);
    let c = h.command();
    h.observe(&s, n, true);
    let p = s.prepare_submit(a, &m, "l04-original", &c, n).unwrap();
    let (before, anchor) = s.checkpoint(a, &m, n).unwrap();
    h.gateway.submit(a, &c, h.f.sources(), n).unwrap(); // effect committed, owner acknowledgement absent
    let restored = h.service();
    restored.restore(a, &m, &before, &anchor, n).unwrap();
    assert!(
        restored
            .dispatch_prepared(a, &m, &p.id, h.f.sources(), n)
            .is_err()
    );
    let recovered = restored
        .recover_order(a, &m, "recover-original", &p.id, n)
        .unwrap();
    reference(&recovered);
    for _ in 0..32 {
        assert_eq!(
            restored
                .recover_order(a, &m, "recover-original", &p.id, n)
                .unwrap(),
            recovered
        );
    }
    let e = restored
        .evidence_chain(a, &c.command_id.to_string(), n)
        .unwrap();
    assert_eq!(e.fill_links.len(), 1);
    assert_eq!(h.gateway.downstream_submission_count(), Some(1));
    let (after, _) = restored.checkpoint(a, &m, n).unwrap();
    let events: Vec<PortfolioEvent> = serde_json::from_value(
        serde_json::from_slice::<serde_json::Value>(&after).unwrap()["events"].clone(),
    )
    .unwrap();
    let mut ledger = AppendOnlyLedger::new();
    let correlation = CorrelationId::new();
    let mut records = vec![];
    for ev in events {
        let name = match &ev.kind {
            PortfolioEventKind::Fill(_) => "portfolio.fill",
            PortfolioEventKind::MarketMark(_) => "portfolio.market_mark",
            PortfolioEventKind::MarkPrice(_) => "portfolio.mark_price",
            PortfolioEventKind::AccountStatus(_) => "portfolio.account_status",
        };
        let r = RecordedEvent::new(NewRecordedEvent {
            tenant_id: a.tenant_id,
            actor_id: a.actor_id,
            correlation_id: correlation,
            causation_id: None,
            aggregate_type: "portfolio".into(),
            aggregate_id: a.tenant_id.to_string(),
            sequence: ev.sequence,
            event_kind: name.into(),
            schema_version: SchemaVersion::parse("v1").unwrap(),
            occurred_at: ev.occurred_at,
            payload: serde_json::to_value(ev.kind).unwrap(),
        })
        .unwrap();
        ledger.append(r.clone()).unwrap();
        records.push(r);
    }
    assert_eq!(ledger.audit_entries().len(), records.len()); // memory F05 only, never DB persistence
    let snapshot = replay(&h.config.scope, h.config.started_at, &records, n).unwrap();
    assert_eq!(snapshot.snapshot_hash, e.portfolio.snapshot_hash);
    assert_eq!(snapshot.positions, e.portfolio.positions); // F05 envelope IDs are new, not rebound X06 source IDs.
    let mut redelivered = records.clone();
    redelivered.extend(records.clone());
    assert_eq!(
        replay(&h.config.scope, h.config.started_at, &redelivered, n).unwrap(),
        snapshot
    );
    let partial = replay(&h.config.scope, h.config.started_at, &records[..3], n).unwrap();
    assert_ne!(partial.snapshot_hash, snapshot.snapshot_hash);
    // Current X06 emergency stop + controlled rollback (resume), independent actor AND user.
    reference(
        &restored
            .engage_kill(a, &m, "stop", 0, "owned stop", n)
            .unwrap(),
    );
    let request = reference(
        &restored
            .request_resume(a, &m, "resume-request", 1, n)
            .unwrap(),
    );
    assert!(restored.approve_resume(a, &m, "self", &request, n).is_err());
    let ap = h.approver();
    reference(
        &restored
            .approve_resume(&ap, &step(&ap, n), "approve", &request, n)
            .unwrap(),
    );
    assert!(
        restored
            .execute_resume(a, &m, "early", &request, n)
            .is_err()
    );
    let end = n + Duration::seconds(1);
    h.observe(&restored, end, true);
    reference(
        &restored
            .execute_resume(a, &m, "resume", &request, end)
            .unwrap(),
    );
    assert_eq!(h.guard.revision().unwrap(), 2);
    assert!(
        restored
            .execute_resume(a, &m, "again", &request, end)
            .is_err()
    );
    assert_eq!(h.gateway.downstream_submission_count(), Some(1));
    assert!(restored.health(a, end).unwrap().ready);
    // Independent owned X05 golden books, not claimed to be DB or the executing account's actual book.
    let scope = ReconcileScope {
        tenant_id: a.tenant_id,
        workspace_id: a.workspace_id,
        account_id: a.account_id.unwrap(),
        quote_unit: "USDT".into(),
    };
    let mut ra = a.clone();
    ra.mode = quantos_policy::RunMode::Shadow;
    let rs = ReconciliationService::new(scope.clone()).unwrap();
    let input = reconcile_support::clean(&scope, end);
    let reconciliation = rs.run(&ra, "l04-clean", &input, end).unwrap();
    assert!(reconciliation.is_clean());
    let audit = restored.audit(a, 0, 100, None).unwrap();
    assert_eq!(audit.total, audit.rows.len() as u64);
    LocalPacket{schema:"quantos-service-l04-local/v1".into(),profile:PROFILE.into(),source_commit:std::env::var("QUANTOS_SERVICE_L04_SOURCE").unwrap_or_else(|_|"0".repeat(40)),scope:h.config.scope.clone(),started_at:h.config.started_at,checked_at:end,records,portfolio:snapshot,orders:vec![OrderObservation{command_id:e.command_id.clone(),order_id:e.order_id.clone(),fill_ids:e.fills.iter().map(|f|f.fill_id.clone()).collect(),evidence_hash:ContentHash::sha256_bytes(&quantos_core::canonical_json_bytes(&serde_json::to_value(&e).unwrap()).unwrap()),portfolio_hash:e.portfolio.snapshot_hash}],submission_attempts:33,downstream_submissions:1,operations_audit_head:audit.head.unwrap(),operations_audit:audit.rows,drills:DrillReport::build([DrillKind::Replay,DrillKind::Recovery,DrillKind::EngineFailure,DrillKind::KillSwitch].into_iter().map(|kind|DrillResult{kind,passed:true,detail:match kind {DrillKind::Replay=>"F05 owned records -> X01 replay; exact redelivery unchanged",DrillKind::Recovery=>"X06 post-effect recovery; same gateway lease; no resubmit",DrillKind::EngineFailure=>"Actual owned failing kernel; one call, uncertain quarantine; replay and greenwash refused",DrillKind::KillSwitch=>"X06 stop, self-approval refusal, fresh health + independent resume CAS"}.into(),duration_ms:0.0}).collect()).unwrap(),reconciliation,health:h.report(end,true),traces:vec![ExportedTraceRecord{service:"service-l04-owned".into(),correlation_id:correlation,operation:"recovery.checkpoint".into(),status:"succeeded".into(),attributes:serde_json::json!({"scope":"owned-local","executionAuthority":false}),recorded_at:end}]}
}
#[test]
fn service_l04_replay_recovery_rollback_and_f09_evidence_survive_new_verifier_process() {
    let p = packet();
    p.validate().unwrap();
    let t = Temp(temporary());
    let exporter = JsonlTraceExporter::new(t.0.join("traces.jsonl")).unwrap();
    exporter.export(&p.traces[0]).unwrap();
    assert_eq!(
        exporter
            .query("service-l04-owned", p.traces[0].correlation_id)
            .unwrap(),
        p.traces
    );
    let path = std::env::var_os("QUANTOS_SERVICE_L04_PACKET")
        .map(PathBuf::from)
        .unwrap_or_else(|| t.0.join("packet.json"));
    let anchor = archive(&path, &p).unwrap();
    let fresh = verify_archive(&path, &anchor).unwrap();
    assert_eq!(fresh.operations_audit.len(), p.operations_audit.len());
    let out = Command::new(env!("CARGO_BIN_EXE_l04-evidence"))
        .args([
            "--verify-owned-local-archive",
            path.to_str().unwrap(),
            anchor.as_str(),
        ])
        .env_clear()
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    let report: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(report["executionAuthority"], false);
    if let Some(path) = std::env::var_os("QUANTOS_SERVICE_L04_PROCESS") {
        fs::write(path,serde_json::to_vec_pretty(&serde_json::json!({"schema":"quantos-service-l04-process/v1","anchor":anchor,"summary":report,"childEnvironmentCleared":true,"dbEvents":"OWNED_F05_RECORDS_NOT_DATABASE","recovery":"SAME_GATEWAY_LEASE_NOT_CROSS_PROCESS_EXECUTION","archive":"ACTUAL_FILE_SYNC_AND_FRESH_VERIFIER_PROCESS","f09":"ACTUAL_JSONL_EXPORT_AND_QUERY_NOT_REMOTE_MONITORING","sourcePorts":"OWNED_TRUSTED_FIXTURES","downstreamSubmissions":1,"fillLinks":1,"recoveryAttempts":33})).unwrap()).unwrap();
    }
}
#[test]
fn service_l04_tape_and_packet_refuse_missing_foreign_tampered_or_contradictory_inputs() {
    let p = packet();
    for n in 0..12 {
        let mut q = p.clone();
        match n {
            0 => {
                q.records.remove(0);
            }
            1 => q.records[1].payload = serde_json::json!({}),
            2 => q.records[1].tenant_id = quantos_core::TenantId::new(),
            3 => q.records[1].occurred_at = q.checked_at + Duration::seconds(1),
            4 => q.orders.push(q.orders[0].clone()),
            5 => q.downstream_submissions = 2,
            6 => q.operations_audit.pop().map(|_| ()).unwrap(),
            7 => q.operations_audit[0].kind = "forged".into(),
            8 => q.drills.results[0].kind = DrillKind::Recovery,
            9 => q.health.components.pop().map(|_| ()).unwrap(),
            10 => {
                let mut input = q.reconciliation.input().clone();
                input.actual.ledger.cash += reconcile_support::d(1);
                q.reconciliation =
                    quantos_reconcile::reconciliation::offline_check(&input, q.checked_at).unwrap();
            }
            _ => q.traces[0].attributes = serde_json::json!({"authorization":"forbidden"}),
        };
        assert!(q.validate().is_err(), "mutation {n}");
    }
}
#[test]
fn service_l04_immutable_archive_refuses_overwrite_corruption_truncation_and_wrong_anchor() {
    let p = packet();
    let t = Temp(temporary());
    let path = t.0.join("packet");
    let a = archive(&path, &p).unwrap();
    assert!(archive(&path, &p).is_err());
    assert!(verify_archive(&path, &ContentHash::sha256_bytes(b"wrong")).is_err());
    let original = fs::read(&path).unwrap();
    fs::write(&path, &original[..original.len() - 1]).unwrap();
    assert!(verify_archive(&path, &a).is_err());
    fs::write(&path, b"{}").unwrap();
    assert!(verify_archive(&path, &a).is_err());
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }
}
#[test]
fn service_l04_database_read_port_checks_current_auth_before_io_and_replays_exact_stream() {
    let p = packet();
    let h = Harness::new();
    let mut a = h.f.auth.clone();
    a.tenant_id = p.scope.tenant_id;
    a.workspace_id = p.scope.workspace_id;
    a.account_id = Some(p.scope.account_id);
    a.mode = p.scope.mode;
    struct Reader {
        rows: Vec<RecordedEvent>,
        calls: usize,
    }
    impl EventReader for Reader {
        fn load(
            &mut self,
            _: quantos_core::TenantId,
            _: CorrelationId,
        ) -> std::result::Result<Vec<RecordedEvent>, quantos_evidence::local::Error> {
            self.calls += 1;
            Ok(self.rows.clone())
        }
    }
    let mut r = Reader {
        rows: p.records.clone(),
        calls: 0,
    };
    let c = p.records[0].correlation_id;
    let mut bad = a.clone();
    bad.account_id = None;
    assert!(recover_from_reader(&mut r, &p.scope, &bad, c, p.started_at, p.checked_at).is_err());
    assert_eq!(r.calls, 0);
    let mut bad = a.clone();
    bad.capabilities
        .remove(&Capability::parse(OPS_READ).unwrap());
    assert!(recover_from_reader(&mut r, &p.scope, &bad, c, p.started_at, p.checked_at).is_err());
    assert_eq!(r.calls, 0);
    assert_eq!(
        recover_from_reader(&mut r, &p.scope, &a, c, p.started_at, p.checked_at).unwrap(),
        p.portfolio
    );
    r.rows[0].correlation_id = CorrelationId::new();
    assert!(recover_from_reader(&mut r, &p.scope, &a, c, p.started_at, p.checked_at).is_err());
}
#[test]
fn service_l04_concurrent_archive_publish_has_one_immutable_winner() {
    let p = Arc::new(packet());
    let t = Temp(temporary());
    let path = Arc::new(t.0.join("packet"));
    let b = Arc::new(Barrier::new(16));
    let mut threads = vec![];
    for _ in 0..16 {
        let (p, path, b) = (p.clone(), path.clone(), b.clone());
        threads.push(thread::spawn(move || {
            b.wait();
            archive(&path, &p).ok()
        }));
    }
    let winners: Vec<_> = threads
        .into_iter()
        .filter_map(|t| t.join().unwrap())
        .collect();
    assert_eq!(winners.len(), 1);
    assert_eq!(
        verify_archive(&path, &winners[0])
            .unwrap()
            .operations_audit
            .len(),
        p.operations_audit.len()
    );
}
