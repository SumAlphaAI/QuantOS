#[path = "support/l03_fixture.rs"]
mod approvals;
#[allow(dead_code)]
#[path = "support/tp07_fixture.rs"]
mod native;
use quantos_execution::{
    dispatch::SignedExecutionGateway,
    gateway::{BoundaryCommand, ExecutionKernel, GatewayLimits, KernelEvent},
};
use quantos_policy::RunMode;
use quantos_risk::guard::Phase;
use serde_json::json;
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
struct Count(Arc<AtomicUsize>);
impl ExecutionKernel for Count {
    fn submit(&mut self, _: &BoundaryCommand) -> Result<(), String> {
        self.0.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        vec![]
    }
}
#[test]
fn service_l03_approved_workflow_cannot_open_native_assisted_execution() {
    let approvals = approvals::Fixture::new(true);
    let receipt = approvals.pair();
    assert_eq!(receipt.status, "approved");
    assert!(!receipt.execution_authority);
    let f = native::Fixture::new();
    let guard = f.guard();
    let issuer = f.issuer(&guard);
    let proposal = f.register(&issuer);
    let decision = f.eval(&guard, Phase::Pre);
    let command = issuer
        .issue(&f.auth, &proposal, &decision, None, f.sources(), f.now)
        .unwrap();
    let calls = Arc::new(AtomicUsize::new(0));
    let g = SignedExecutionGateway::new(
        issuer,
        GatewayLimits {
            max_quantity: 1000.into(),
            max_notional: 1_000_000.into(),
            allowed_venues: vec![f.venue.venue.clone()],
        },
        Count(calls.clone()),
    )
    .unwrap();
    let mut assisted = f.auth.clone();
    assisted.mode = RunMode::AssistedLive;
    assert!(g.submit(&assisted, &command, f.sources(), f.now).is_err());
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    if let Ok(path) = std::env::var("QUANTOS_SERVICE_L03_NATIVE") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-service-l03-native/v1","scope":"ACTUAL_X03_ASSISTED_MODE_REFUSAL_NOT_ASSISTED_ISSUANCE","workflowApproved":true,"executionAuthority":false,"nativeAssistedSubmit":"DENIED","kernelCalls":0,"productionCredentialsUsed":false})).unwrap()).unwrap();
    }
}
