#[allow(dead_code)]
#[path = "../../../crates/quantos-operations/tests/support/mod.rs"]
mod support;
use quantos_execution::process_kernel::PaperProcessKernel;
use std::{path::Path, time::Duration as WallDuration};
use support::*;

#[test]
fn service_x06_native_paper_execution_cancel_evidence_and_recovery() {
    for resting in [false, true] {
        let h = Harness::new();
        let a = &h.f.auth;
        let n = h.f.now;
        let m = step(a, n);
        let c = h.command();
        let exe = Path::new(env!("CARGO_BIN_EXE_execution-gateway"));
        let kernel = if resting {
            PaperProcessKernel::spawn_resting(exe, WallDuration::from_secs(1))
        } else {
            PaperProcessKernel::spawn(exe, WallDuration::from_secs(1))
        }
        .unwrap();
        let gateway = SignedExecutionGateway::new(
            h.issuer.clone(),
            GatewayLimits {
                max_quantity: "100".parse().unwrap(),
                max_notional: "50000".parse().unwrap(),
                allowed_venues: vec!["OWNED_PAPER".into()],
            },
            kernel,
        )
        .unwrap();
        let service = OperationsService::new(
            h.config.clone(),
            h.seed.clone(),
            h.issuer.clone(),
            h.guard.clone(),
            gateway.clone(),
        )
        .unwrap();
        let prepared = service
            .prepare_submit(a, &m, "native-submit", &c, n)
            .unwrap();
        reference(
            &service
                .dispatch_prepared(a, &m, &prepared.id, h.f.sources(), n)
                .unwrap(),
        );
        let evidence = service
            .evidence_chain(a, &c.command_id.to_string(), n)
            .unwrap();
        assert_eq!(evidence.fills.len(), usize::from(!resting));
        assert_eq!(
            evidence.order_status,
            if resting { "accepted" } else { "filled" }
        );
        let cancel = service
            .cancel(a, &m, "native-cancel", &c.command_id.to_string(), n)
            .unwrap();
        reference(&cancel);
        assert_eq!(
            service
                .cancel(a, &m, "native-cancel", &c.command_id.to_string(), n)
                .unwrap(),
            cancel
        );
        assert_eq!(gateway.downstream_submission_count(), Some(1));
        assert_eq!(gateway.downstream_cancel_count(), Some(1));
        let (bytes, anchor) = service.checkpoint(a, &m, n).unwrap();
        let restored = OperationsService::new(
            h.config.clone(),
            h.seed.clone(),
            h.issuer.clone(),
            h.guard.clone(),
            gateway.clone(),
        )
        .unwrap();
        restored.restore(a, &m, &bytes, &anchor, n).unwrap();
        assert_eq!(
            restored
                .evidence_chain(a, &c.command_id.to_string(), n)
                .unwrap()
                .order_status,
            if resting { "cancelled" } else { "filled" }
        );
        assert_eq!(gateway.downstream_submission_count(), Some(1));
        println!("SERVICE_X06_NATIVE_PAPER resting={resting} SUBMITS=1 CANCELS=1 RECOVERY_IO=0");
    }
}
