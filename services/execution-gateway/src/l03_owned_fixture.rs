//! Explicit owned loopback HTTP fixture. Step-up completion endpoints below
//! exist only here, never in the reusable owner router or default service.
#[path = "../../../crates/quantos-execution/tests/support/l03_fixture.rs"]
mod fixture;
use axum::{
    Router,
    body::Bytes,
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
};
use chrono::Duration;
use execution_gateway::l03_http::{HttpHost, response, router, session};
use quantos_core::{ContentHash, ProposalId};
use quantos_execution::assisted::*;
use serde::Deserialize;
use serde_json::json;
use std::{
    io::Write,
    sync::{Arc, Mutex},
};
struct Owned {
    fixture: fixture::Fixture,
    offset: Arc<Mutex<i64>>,
    subjects: Vec<ProposalId>,
    negative: std::collections::BTreeMap<String, ProposalId>,
}
impl Owned {
    fn now(&self) -> chrono::DateTime<chrono::Utc> {
        self.fixture.now + Duration::seconds(*self.offset.lock().unwrap())
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Advance {
    seconds: i64,
}
async fn stepup(
    State(o): State<Arc<Owned>>,
    Path(id): Path<ProposalId>,
    headers: HeaderMap,
) -> axum::response::Response {
    response((|| {
        let c = o
            .fixture
            .service
            .challenge(session(&headers)?, id, o.now())?;
        o.fixture.mfa.attest_provider_completed(c, o.now())
    })())
}
async fn advance(State(o): State<Arc<Owned>>, body: Bytes) -> axum::response::Response {
    response((|| {
        let b: Advance = serde_json::from_slice(&body).map_err(|_| Error::Invalid)?;
        if !(0..=900).contains(&b.seconds) {
            return Err(Error::Invalid);
        }
        let mut t = o.offset.lock().map_err(|_| Error::Unavailable)?;
        *t = t
            .checked_add(b.seconds)
            .filter(|v| *v <= 3600)
            .ok_or(Error::Invalid)?;
        Ok::<_, Error>(json!({"advanced":true}))
    })())
}
async fn summary(State(o): State<Arc<Owned>>) -> axum::response::Response {
    response((|| {
        let (audit, anchor) = o.fixture.service.audit_snapshot()?;
        o.fixture.service.verify_audit(&audit, &anchor)?;
        Ok::<_, Error>(
            json!({"scope":"OWNED_HTTP_WITH_SYNTHETIC_MFA_PORT_NOT_PUBLIC_BFF_OR_TRADING","audit":audit,"anchor":anchor,"auditVerified":true,"ordersIssued":0,"mfa":"KEYED_SYNTHETIC_TRUSTED_ATTESTATION_PORT","subjects":o.subjects,"productionCredentialsUsed":false}),
        )
    })())
}
pub fn serve(mode: &str) -> anyhow::Result<()> {
    let enabled = mode == "owned-enabled";
    let fixture = fixture::Fixture::new(enabled);
    let mut subjects = vec![];
    for i in 0..50 {
        let mut subject = fixture.subject.clone();
        subject.id = ProposalId::new();
        subject.proposal_hash =
            ContentHash::sha256_bytes(format!("owned-http-subject-{i}").as_bytes());
        subject.quantity = (i + 1).to_string();
        fixture.service.register_subject(subject.clone())?;
        subjects.push(subject.id);
    }
    let mut negative = std::collections::BTreeMap::new();
    for kind in ["overcap", "symbol", "risk", "expired"] {
        let mut s = fixture.subject.clone();
        s.id = ProposalId::new();
        match kind {
            "overcap" => s.quantity = "50.00000001".into(),
            "symbol" => s.symbol = "DOGEUSDT".into(),
            "risk" => s.verdict = quantos_risk::RiskVerdict::Deny,
            _ => {
                s.created_at = fixture.now - Duration::minutes(1);
                s.expires_at = fixture.now;
            }
        }
        fixture.service.register_subject(s.clone())?;
        negative.insert(kind.into(), s.id);
    }
    let offset = Arc::new(Mutex::new(0));
    let o = Arc::new(Owned {
        fixture,
        offset: offset.clone(),
        subjects,
        negative,
    });
    let origin = o.fixture.now;
    let app = router(HttpHost {
        service: o.fixture.service.clone(),
        clock: Arc::new(move || origin + Duration::seconds(*offset.lock().unwrap())),
    })
    .merge(
        Router::new()
            .route("/_owned/step-up/:id", post(stepup))
            .route("/_owned/advance", post(advance))
            .route("/_owned/summary", get(summary))
            .with_state(o.clone()),
    );
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?;
    runtime.block_on(async move{let listener=tokio::net::TcpListener::bind("127.0.0.1:0").await?;println!("L03_READY={}",json!({"pid":std::process::id(),"backend":"OWNED_SERVICE_L03_HTTP","address":listener.local_addr()?.to_string(),"enabled":enabled,"subjects":o.subjects,"negativeSubjects":o.negative}));std::io::stdout().flush()?;axum::serve(listener,app).await?;Ok::<(),anyhow::Error>(())})
}
