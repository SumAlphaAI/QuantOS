#![allow(dead_code)]
use chrono::{DateTime, Duration, TimeZone, Utc};
use quantos_auth::AuthContext;
use quantos_core::{
    AccountId, ActorId, ContentHash, DecisionId, ProposalId, TenantId, WorkspaceId,
};
use quantos_execution::{assisted::*, venue_protocol::EXECUTION_VENUE};
use quantos_policy::{Capability, Role, RunMode};
use quantos_risk::RiskVerdict;
use std::collections::BTreeMap;
use uuid::Uuid;
pub fn at() -> DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 10, 27, 0, 0, 0).unwrap()
}
pub fn key() -> [u8; 32] {
    let mut k = [0; 32];
    k[..16].copy_from_slice(Uuid::new_v4().as_bytes());
    k[16..].copy_from_slice(Uuid::new_v4().as_bytes());
    k
}
pub struct Fixture {
    pub service: AssistedApprovalService,
    pub mfa: MfaAttestor,
    pub scope: Scope,
    pub sessions: BTreeMap<String, Session>,
    pub subject: Subject,
    pub now: DateTime<Utc>,
}
impl Fixture {
    pub fn new(enabled: bool) -> Self {
        let now = at();
        let scope = Scope {
            tenant: TenantId::from_uuid(Uuid::from_u128(1)),
            workspace: WorkspaceId::from_uuid(Uuid::from_u128(2)),
            account: AccountId::from_uuid(Uuid::from_u128(3)),
        };
        let mfakey = key();
        let service = AssistedApprovalService::new(
            scope.clone(),
            Policy {
                enabled,
                ..Policy::default()
            },
            mfakey,
            key(),
            now,
        )
        .unwrap();
        let mut sessions = BTreeMap::new();
        for (name, index, role) in [
            ("operator", 10, Role::Operator),
            ("first", 11, Role::Approver),
            ("second", 12, Role::Approver),
            ("owner", 13, Role::Owner),
            ("viewer", 14, Role::Viewer),
            ("twin", 15, Role::Approver),
        ] {
            let auth = AuthContext {
                tenant_id: scope.tenant,
                workspace_id: scope.workspace,
                account_id: Some(scope.account),
                actor_id: ActorId::from_uuid(Uuid::from_u128(index)),
                user_id: Uuid::from_u128(if name == "twin" { 11 } else { index }),
                workspace_slug: "owned".into(),
                workspace_name: "owned".into(),
                role,
                mode: RunMode::AssistedLive,
                capabilities: [
                    ASSISTED_CAPABILITY,
                    Capability::EXECUTION_OPERATE,
                    Capability::STRATEGY_APPROVE,
                ]
                .into_iter()
                .map(|c| Capability::parse(c).unwrap())
                .collect(),
            };
            let session = Session {
                auth,
                revision: 1,
                issued_at: now,
                expires_at: now + Duration::minutes(15),
                active: true,
            };
            service
                .register_session(name.into(), session.clone())
                .unwrap();
            sessions.insert(name.into(), session);
        }
        let subject = Subject {
            id: ProposalId::new(),
            scope: scope.clone(),
            originator: sessions["operator"].auth.actor_id,
            originator_user: sessions["operator"].auth.user_id,
            proposal_hash: ContentHash::sha256_bytes(
                b"owned research projection, not target risk authority",
            ),
            decision: DecisionId::new(),
            verdict: RiskVerdict::ApprovalRequired,
            venue: EXECUTION_VENUE.into(),
            symbol: "BTCUSDT".into(),
            quote_currency: "USDT".into(),
            quantity: "1".into(),
            limit_price: "1000".into(),
            created_at: now,
            expires_at: now + Duration::minutes(5),
        };
        service.register_subject(subject.clone()).unwrap();
        Self {
            service,
            mfa: MfaAttestor::new(mfakey).unwrap(),
            scope,
            sessions,
            subject,
            now,
        }
    }
    pub fn open(&self) -> Receipt {
        self.service
            .open("operator", self.subject.id, "open", self.now)
            .unwrap()
            .receipt
    }
    pub fn proof(&self, who: &str, id: ProposalId) -> StepUpProof {
        self.mfa
            .attest_provider_completed(self.service.challenge(who, id, self.now).unwrap(), self.now)
            .unwrap()
    }
    pub fn pair(&self) -> Receipt {
        let r = self.open();
        let a = self.proof("first", r.request);
        let b = self.proof("second", r.request);
        self.service
            .approve("first", r.request, 0, "first", a, self.now)
            .unwrap();
        self.service
            .approve("second", r.request, 1, "second", b, self.now)
            .unwrap()
            .receipt
    }
}
