//! X03 process-local authority. Issuer -> RiskGuard is the sole lock order.
//! Backend adapters must resolve R04 records, F06 sessions and current sources;
//! this API must never accept client-supplied identity or source assertions.
use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, Mac};
use quantos_auth::AuthContext;
use quantos_core::{
    ActorId, CommandId, ContentHash, DecisionId, ProposalId, TenantId, WorkspaceId,
    canonical_json_bytes,
};
use quantos_policy::{Capability, Role, RunMode};
use quantos_portfolio::RiskInputSnapshot;
use quantos_risk::guard::{
    AccountFinancials, ApprovalToken, GuardDecision, GuardError, RiskGuard, Side, TradeIntent,
    VenueState,
};
use quantos_runtime::signal_proposal::{SignalProposalSchemaValidator, TradeProposalRecord};
use quantos_strategy::release::{DeploymentTarget, StrategyRelease};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::Sha256;
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex, MutexGuard},
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CommandError {
    #[error(transparent)]
    Risk(#[from] GuardError),
    #[error(transparent)]
    Core(#[from] quantos_core::CoreError),
    #[error("X03 rejected: {0}")]
    Rejected(&'static str),
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalState {
    Pending,
    Approved,
    Rejected,
    Cancelled,
    Consumed,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ApprovalReceipt {
    pub id: ProposalId,
    pub proposal_hash: ContentHash,
    pub requester: ActorId,
    pub state: ApprovalState,
    pub revision: u64,
    pub expires_at: DateTime<Utc>,
    pub approver: Option<ActorId>,
    pub command_id: Option<CommandId>,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SignedCommand {
    pub command_id: CommandId,
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub requester: ActorId,
    pub originator: ActorId,
    pub proposal_hash: ContentHash,
    pub proposal_id: String,
    pub intent: TradeIntent,
    pub venue: String,
    pub source_decision_id: DecisionId,
    pub current_risk: GuardDecision,
    pub approval: Option<ApprovalReceipt>,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub signer: String,
    pub signature: String,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IssuerAudit {
    pub sequence: u64,
    pub previous: Option<ContentHash>,
    pub actor: ActorId,
    pub at: DateTime<Utc>,
    pub event: String,
    pub subject: String,
    pub outcome: String,
    pub signature: String,
}
#[derive(Clone)]
struct Proposal {
    record: TradeProposalRecord,
    intent: TradeIntent,
    originator: ActorId,
}
struct Approval {
    receipt: ApprovalReceipt,
    token: Option<ApprovalToken>,
}
struct Issued {
    binding: ContentHash,
    decision: GuardDecision,
    command: SignedCommand,
}
#[derive(Default)]
struct State {
    proposals: BTreeMap<ContentHash, Proposal>,
    approvals: BTreeMap<ProposalId, Approval>,
    issued: BTreeMap<(quantos_core::AccountId, String), Issued>,
    downstream: BTreeMap<CommandId, CommandId>,
    audit: Vec<IssuerAudit>,
    at: Option<DateTime<Utc>>,
}
struct Inner {
    tenant: TenantId,
    workspace: WorkspaceId,
    risk: RiskGuard,
    consumer: CommandId,
    signer: String,
    key: [u8; 32],
    ttl: Duration,
    state: Mutex<State>,
}
/// Clones share approval consumption, command cache, audit chain and risk authority.
/// Secret keys are never Debug/Serialize. Independent authorities are not durable.
#[derive(Clone)]
pub struct AtomicCommandIssuer(Arc<Inner>);
/// Trusted current module outputs, resolved again on every attempt, including cache hits.
pub struct CurrentSources<'a> {
    pub snapshot: &'a RiskInputSnapshot,
    pub financials: &'a AccountFinancials,
    pub venue: &'a VenueState,
    pub release: &'a StrategyRelease,
}
impl AtomicCommandIssuer {
    pub fn same_instance(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
    pub fn uses_risk_guard(&self, guard: &RiskGuard) -> bool {
        self.0.risk.same_instance(guard)
    }
    pub fn scope_matches(&self, tenant: TenantId, workspace: WorkspaceId) -> bool {
        self.0.tenant == tenant
            && self.0.workspace == workspace
            && self.0.risk.scope_matches(tenant, workspace)
    }
    pub fn new(
        tenant: TenantId,
        workspace: WorkspaceId,
        risk: RiskGuard,
        signer: String,
        key: [u8; 32],
        ttl_seconds: i64,
    ) -> Result<Self, CommandError> {
        if signer.trim().is_empty()
            || key.iter().all(|b| *b == 0)
            || !(1..=60).contains(&ttl_seconds)
        {
            return Err(CommandError::Rejected("configuration"));
        }
        Ok(Self(Arc::new(Inner {
            tenant,
            workspace,
            risk,
            consumer: CommandId::new(),
            signer,
            key,
            ttl: Duration::seconds(ttl_seconds),
            state: Mutex::new(State::default()),
        })))
    }
    fn lock(&self) -> Result<MutexGuard<'_, State>, CommandError> {
        self.0
            .state
            .lock()
            .map_err(|_| CommandError::Rejected("state unavailable"))
    }
    fn authorized(
        &self,
        auth: &AuthContext,
        intent: &TradeIntent,
        approve: bool,
    ) -> Result<(), CommandError> {
        let cap = if approve {
            Capability::STRATEGY_APPROVE
        } else {
            Capability::EXECUTION_OPERATE
        };
        if auth.tenant_id != self.0.tenant
            || auth.workspace_id != self.0.workspace
            || !matches!(
                (auth.mode, intent.target),
                (RunMode::Paper, DeploymentTarget::Paper)
                    | (RunMode::Shadow, DeploymentTarget::Shadow)
            )
            || auth.account_id.is_some_and(|id| id != intent.account_id)
            || !auth.capabilities.iter().any(|c| c.as_str() == cap)
            || if approve {
                !matches!(auth.role, Role::Owner | Role::Approver)
            } else {
                !matches!(auth.role, Role::Owner | Role::Operator | Role::Service)
            }
        {
            return Err(CommandError::Rejected("authorization"));
        }
        Ok(())
    }
    fn clock(state: &State, now: DateTime<Utc>) -> Result<(), CommandError> {
        if state.at.is_some_and(|at| now < at) {
            Err(CommandError::Rejected("backward clock"))
        } else {
            Ok(())
        }
    }
    fn live(p: &Proposal, now: DateTime<Utc>) -> Result<(), CommandError> {
        if p.record.created_at > now || now >= p.record.expires_at {
            return Err(CommandError::Rejected("proposal expired"));
        }
        Ok(())
    }
    /// Trusted R04 repository handoff. Pins the complete immutable record, originator
    /// and exact order; non-executable proposal bytes never become a venue command.
    pub fn register_proposal(
        &self,
        auth: &AuthContext,
        record: TradeProposalRecord,
        intent: TradeIntent,
        now: DateTime<Utc>,
    ) -> Result<ContentHash, CommandError> {
        self.authorized(auth, &intent, false)?;
        validate_proposal_binding(auth, &record, &intent)?;
        let p = Proposal {
            record,
            intent,
            originator: auth.actor_id,
        };
        Self::live(&p, now)?;
        let id = hash(
            &json!({"record":p.record,"intent":p.intent,"originator":p.originator,"workspace":self.0.workspace}),
        )?;
        let mut s = self.lock()?;
        Self::clock(&s, now)?;
        if s.proposals.iter().any(|(key, existing)| {
            existing.record.proposal_id == p.record.proposal_id && key != &id
        }) {
            return Err(CommandError::Rejected("proposal identity conflict"));
        }
        if !s.proposals.contains_key(&id) {
            self.audit(
                &mut s,
                auth.actor_id,
                now,
                "proposal_registered",
                &id.to_string(),
                "accepted",
            )?;
            s.proposals.insert(id.clone(), p);
        }
        Ok(id)
    }
    pub fn request_approval(
        &self,
        auth: &AuthContext,
        proposal: &ContentHash,
        now: DateTime<Utc>,
        expires: DateTime<Utc>,
    ) -> Result<ApprovalReceipt, CommandError> {
        let mut s = self.lock()?;
        Self::clock(&s, now)?;
        let p = s
            .proposals
            .get(proposal)
            .ok_or(CommandError::Rejected("unknown proposal"))?;
        self.authorized(auth, &p.intent, false)?;
        Self::live(p, now)?;
        if expires <= now || expires > p.record.expires_at || expires - now > Duration::seconds(60)
        {
            return Err(CommandError::Rejected("approval expiry"));
        }
        let receipt = ApprovalReceipt {
            id: ProposalId::new(),
            proposal_hash: proposal.clone(),
            requester: auth.actor_id,
            state: ApprovalState::Pending,
            revision: 0,
            expires_at: expires,
            approver: None,
            command_id: None,
        };
        self.audit(
            &mut s,
            auth.actor_id,
            now,
            "approval_requested",
            &receipt.id.to_string(),
            "pending",
        )?;
        s.approvals.insert(
            receipt.id,
            Approval {
                receipt: receipt.clone(),
                token: None,
            },
        );
        Ok(receipt)
    }
    /// CAS transitions: Pending -> Approved/Rejected/Cancelled; Approved -> Cancelled.
    /// Expiry is effective at the deadline without a scheduler. Terminal states cannot revive.
    pub fn transition_approval(
        &self,
        auth: &AuthContext,
        id: ProposalId,
        expected: u64,
        next: ApprovalState,
        now: DateTime<Utc>,
    ) -> Result<ApprovalReceipt, CommandError> {
        let mut s = self.lock()?;
        Self::clock(&s, now)?;
        let a = s
            .approvals
            .get(&id)
            .ok_or(CommandError::Rejected("unknown approval"))?;
        let p = s
            .proposals
            .get(&a.receipt.proposal_hash)
            .ok_or(CommandError::Rejected("unknown proposal"))?;
        Self::live(p, now)?;
        let cancel = next == ApprovalState::Cancelled;
        self.authorized(auth, &p.intent, !cancel)?;
        if (cancel && auth.actor_id != a.receipt.requester)
            || (!cancel && (auth.actor_id == a.receipt.requester || auth.actor_id == p.originator))
        {
            return Err(CommandError::Rejected("self approval or cancellation"));
        }
        if a.receipt.revision != expected
            || now >= a.receipt.expires_at
            || !matches!(
                (a.receipt.state, next),
                (
                    ApprovalState::Pending,
                    ApprovalState::Approved | ApprovalState::Rejected | ApprovalState::Cancelled
                ) | (ApprovalState::Approved, ApprovalState::Cancelled)
            )
        {
            return Err(CommandError::Rejected("approval transition or expiry"));
        }
        let token = if next == ApprovalState::Approved {
            Some(self.0.risk.approve(
                auth,
                a.receipt.requester,
                &p.intent,
                now,
                a.receipt.expires_at,
            )?)
        } else {
            None
        };
        let mut receipt = a.receipt.clone();
        receipt.state = next;
        receipt.revision += 1;
        if !cancel {
            receipt.approver = Some(auth.actor_id);
        }
        self.audit(
            &mut s,
            auth.actor_id,
            now,
            "approval_transition",
            &id.to_string(),
            match next {
                ApprovalState::Approved => "approved",
                ApprovalState::Rejected => "rejected",
                _ => "cancelled",
            },
        )?;
        s.approvals.insert(
            id,
            Approval {
                receipt: receipt.clone(),
                token,
            },
        );
        Ok(receipt)
    }
    pub fn approval_token(
        &self,
        auth: &AuthContext,
        id: ProposalId,
        now: DateTime<Utc>,
    ) -> Result<ApprovalToken, CommandError> {
        let s = self.lock()?;
        Self::clock(&s, now)?;
        let a = s
            .approvals
            .get(&id)
            .ok_or(CommandError::Rejected("unknown approval"))?;
        let p = s
            .proposals
            .get(&a.receipt.proposal_hash)
            .ok_or(CommandError::Rejected("unknown proposal"))?;
        self.authorized(auth, &p.intent, false)?;
        if a.receipt.requester != auth.actor_id
            || a.receipt.state != ApprovalState::Approved
            || now >= a.receipt.expires_at
        {
            return Err(CommandError::Rejected("approval unavailable"));
        }
        a.token
            .clone()
            .ok_or(CommandError::Rejected("approval unavailable"))
    }
    #[allow(clippy::too_many_arguments)]
    pub fn issue(
        &self,
        auth: &AuthContext,
        proposal: &ContentHash,
        decision: &GuardDecision,
        approval: Option<ProposalId>,
        sources: CurrentSources<'_>,
        now: DateTime<Utc>,
    ) -> Result<SignedCommand, CommandError> {
        let mut s = self.lock()?;
        Self::clock(&s, now)?;
        let result = self.issue_locked(&mut s, auth, proposal, decision, approval, sources, now);
        if result.is_err() {
            self.audit(
                &mut s,
                auth.actor_id,
                now,
                "issuance_refused",
                &proposal.to_string(),
                "denied",
            )?;
        }
        result
    }
    #[allow(clippy::too_many_arguments)]
    fn issue_locked(
        &self,
        s: &mut State,
        auth: &AuthContext,
        proposal: &ContentHash,
        decision: &GuardDecision,
        approval: Option<ProposalId>,
        sources: CurrentSources<'_>,
        now: DateTime<Utc>,
    ) -> Result<SignedCommand, CommandError> {
        let p = s
            .proposals
            .get(proposal)
            .ok_or(CommandError::Rejected("unknown proposal"))?
            .clone();
        self.authorized(auth, &p.intent, false)?;
        Self::live(&p, now)?;
        let key = (p.intent.account_id, p.intent.command_key.clone());
        let binding = hash(
            &json!({"proposal":proposal,"requester":auth.actor_id,"approval":approval,"decision":decision.decision_id}),
        )?;
        let cached = s.issued.get(&key);
        if cached.is_some_and(|i| i.binding != binding) {
            return Err(CommandError::Rejected("idempotency conflict"));
        }
        let receipt = if let Some(id) = approval {
            let a = s
                .approvals
                .get(&id)
                .ok_or(CommandError::Rejected("unknown approval"))?;
            if a.receipt.proposal_hash != *proposal
                || a.receipt.requester != auth.actor_id
                || now >= a.receipt.expires_at
                || !(a.receipt.state == ApprovalState::Approved
                    || (a.receipt.state == ApprovalState::Consumed
                        && cached
                            .is_some_and(|i| Some(i.command.command_id) == a.receipt.command_id)))
            {
                return Err(CommandError::Rejected("approval consumed or invalid"));
            }
            Some((
                a.receipt.clone(),
                a.token
                    .clone()
                    .ok_or(CommandError::Rejected("approval missing"))?,
            ))
        } else {
            None
        };
        self.0.risk.with_current_allow(
            self.0.consumer,
            decision,
            auth,
            &p.intent,
            sources.snapshot,
            sources.financials,
            sources.venue,
            sources.release,
            receipt.as_ref().map(|a| &a.1),
            now,
            |current| {
                if let Some(existing) = s.issued.get(&key) {
                    if existing.command.venue != sources.venue.venue {
                        return Err(CommandError::Rejected("venue conflict"));
                    }
                    if now >= existing.command.expires_at
                        || current.expires_at < existing.command.expires_at
                    {
                        return Err(CommandError::Rejected("command expiry or source deadline"));
                    }
                    let command = existing.command.clone();
                    self.audit(
                        s,
                        auth.actor_id,
                        now,
                        "command_replayed",
                        &command.command_id.to_string(),
                        "same_command",
                    )?;
                    return Ok(command);
                }
                let command_id = CommandId::new();
                let consumed = receipt.as_ref().map(|(r, _)| {
                    let mut r = r.clone();
                    r.state = ApprovalState::Consumed;
                    r.revision += 1;
                    r.command_id = Some(command_id);
                    r
                });
                let expires = now
                    .checked_add_signed(self.0.ttl)
                    .ok_or(CommandError::Rejected("clock range"))?
                    .min(p.record.expires_at)
                    .min(decision.expires_at)
                    .min(current.expires_at);
                if expires <= now {
                    return Err(CommandError::Rejected("command expiry"));
                }
                let mut command = SignedCommand {
                    command_id,
                    tenant_id: self.0.tenant,
                    workspace_id: self.0.workspace,
                    requester: auth.actor_id,
                    originator: p.originator,
                    proposal_hash: proposal.clone(),
                    proposal_id: p.record.proposal_id.clone(),
                    intent: p.intent.clone(),
                    venue: sources.venue.venue.clone(),
                    source_decision_id: decision.decision_id,
                    current_risk: current.clone(),
                    approval: consumed.clone(),
                    issued_at: now,
                    expires_at: expires,
                    signer: self.0.signer.clone(),
                    signature: String::new(),
                };
                command.signature = self.sign("command", &command)?;
                // Signing and audit serialization complete before any approval/cache mutation.
                self.audit(
                    s,
                    auth.actor_id,
                    now,
                    "command_issued",
                    &command_id.to_string(),
                    "issued_and_approval_consumed_atomically",
                )?;
                if let Some(r) = consumed {
                    let id = r.id;
                    s.approvals
                        .get_mut(&id)
                        .expect("checked under lock")
                        .receipt = r;
                }
                s.issued.insert(
                    key,
                    Issued {
                        binding,
                        decision: decision.clone(),
                        command: command.clone(),
                    },
                );
                Ok(command)
            },
        )
    }
    /// Current local authenticity/lifetime/kill check. No downstream submission is performed.
    pub fn verify_command(
        &self,
        auth: &AuthContext,
        command: &SignedCommand,
        now: DateTime<Utc>,
    ) -> Result<(), CommandError> {
        self.authorized(auth, &command.intent, false)?;
        let s = self.lock()?;
        let issued = self.bound_command(&s, auth, command, now)?;
        self.0
            .risk
            .validate_allow(&issued.decision, auth, &command.intent, now)?;
        Ok(())
    }
    fn bound_command<'a>(
        &self,
        s: &'a State,
        auth: &AuthContext,
        command: &SignedCommand,
        now: DateTime<Utc>,
    ) -> Result<&'a Issued, CommandError> {
        Self::clock(s, now)?;
        if command.tenant_id != self.0.tenant
            || command.workspace_id != self.0.workspace
            || command.requester != auth.actor_id
            || command.signer != self.0.signer
            || command.issued_at > now
            || now >= command.expires_at
        {
            return Err(CommandError::Rejected("command scope or expiry"));
        }
        self.verify("command", command, &command.signature)?;
        let issued = s
            .issued
            .get(&(
                command.intent.account_id,
                command.intent.command_key.clone(),
            ))
            .ok_or(CommandError::Rejected("unknown command"))?;
        if issued.command != *command {
            return Err(CommandError::Rejected("command binding"));
        }
        Ok(issued)
    }
    /// X04 control of an already claimed order. Cancellation remains available
    /// after issuance expiry or kill: it cannot create new exposure. Current
    /// identity/capability/account scope, exact signed binding and consumer lease
    /// are still required. The callback must not reenter this issuer.
    pub fn with_order_control<T, E: From<CommandError>>(
        &self,
        consumer: CommandId,
        auth: &AuthContext,
        command: &SignedCommand,
        now: DateTime<Utc>,
        control: impl FnOnce() -> Result<T, E>,
    ) -> Result<T, E> {
        self.authorized(auth, &command.intent, false)?;
        let s = self.lock()?;
        Self::clock(&s, now)?;
        self.verify("command", command, &command.signature)?;
        let issued = s
            .issued
            .get(&(
                command.intent.account_id,
                command.intent.command_key.clone(),
            ))
            .ok_or(CommandError::Rejected("unknown order command"))?;
        if issued.command != *command
            || command.requester != auth.actor_id
            || command.issued_at > now
            || s.downstream.get(&command.command_id) != Some(&consumer)
        {
            return Err(CommandError::Rejected("order control binding").into());
        }
        control()
    }
    /// TP07 dispatch transaction: authenticate the exact stored command, recheck all
    /// current sources and the consumed approval, and hold issuer -> risk locks
    /// across the bounded downstream callback. The callback must never reenter
    /// issuer/risk; its consumer must quarantine uncertain transport outcomes.
    pub fn with_current_command<T, E: From<CommandError> + From<GuardError>>(
        &self,
        consumer: CommandId,
        auth: &AuthContext,
        command: &SignedCommand,
        sources: CurrentSources<'_>,
        now: DateTime<Utc>,
        dispatch: impl FnOnce() -> Result<T, E>,
    ) -> Result<T, E> {
        self.authorized(auth, &command.intent, false)?;
        let mut s = self.lock()?;
        let decision = self.bound_command(&s, auth, command, now)?.decision.clone();
        let approval = if let Some(receipt) = &command.approval {
            let stored = s
                .approvals
                .get(&receipt.id)
                .ok_or(CommandError::Rejected("unknown approval"))?;
            if stored.receipt != *receipt
                || receipt.state != ApprovalState::Consumed
                || receipt.command_id != Some(command.command_id)
                || now >= receipt.expires_at
            {
                return Err(CommandError::Rejected("dispatch approval binding").into());
            }
            Some(
                stored
                    .token
                    .clone()
                    .ok_or(CommandError::Rejected("approval missing"))?,
            )
        } else {
            None
        };
        if sources.venue.venue != command.venue {
            return Err(CommandError::Rejected("dispatch venue binding").into());
        }
        self.0.risk.with_current_allow(
            self.0.consumer,
            &decision,
            auth,
            &command.intent,
            sources.snapshot,
            sources.financials,
            sources.venue,
            sources.release,
            approval.as_ref(),
            now,
            |current| {
                if current.expires_at < command.expires_at {
                    return Err(CommandError::Rejected("dispatch source deadline").into());
                }
                if s.downstream
                    .get(&command.command_id)
                    .is_some_and(|id| *id != consumer)
                {
                    return Err(CommandError::Rejected("downstream command already claimed").into());
                }
                // Retain the owner even on an uncertain callback error. A different
                // gateway cannot automatically resubmit after transport ambiguity.
                s.downstream.insert(command.command_id, consumer);
                dispatch()
            },
        )
    }
    pub fn approval_status(
        &self,
        auth: &AuthContext,
        id: ProposalId,
    ) -> Result<ApprovalReceipt, CommandError> {
        let s = self.lock()?;
        let a = s
            .approvals
            .get(&id)
            .ok_or(CommandError::Rejected("unknown approval"))?;
        let p = s
            .proposals
            .get(&a.receipt.proposal_hash)
            .ok_or(CommandError::Rejected("unknown proposal"))?;
        self.authorized(auth, &p.intent, false)?;
        if auth.actor_id != a.receipt.requester {
            return Err(CommandError::Rejected("approval scope"));
        }
        Ok(a.receipt.clone())
    }
    fn audit(
        &self,
        state: &mut State,
        actor: ActorId,
        at: DateTime<Utc>,
        event: &str,
        subject: &str,
        outcome: &str,
    ) -> Result<(), CommandError> {
        let mut row = IssuerAudit {
            sequence: state.audit.len() as u64 + 1,
            previous: state.audit.last().map(hash).transpose()?,
            actor,
            at,
            event: event.into(),
            subject: subject.into(),
            outcome: outcome.into(),
            signature: String::new(),
        };
        row.signature = self.sign("audit", &row)?;
        state.audit.push(row);
        state.at = Some(at);
        Ok(())
    }
    pub fn audit_log(&self, auth: &AuthContext) -> Result<Vec<IssuerAudit>, CommandError> {
        if auth.tenant_id != self.0.tenant
            || auth.workspace_id != self.0.workspace
            || auth.account_id.is_some()
            || auth.role != Role::Owner
            || !auth
                .capabilities
                .iter()
                .any(|c| c.as_str() == Capability::EXECUTION_OPERATE)
        {
            return Err(CommandError::Rejected("audit scope"));
        }
        Ok(self.lock()?.audit.clone())
    }
    pub fn verify_audit(&self, rows: &[IssuerAudit]) -> Result<(), CommandError> {
        if self.lock()?.audit.as_slice() != rows {
            return Err(CommandError::Rejected("audit completeness"));
        }
        let mut previous = None;
        for (i, row) in rows.iter().enumerate() {
            if row.sequence != i as u64 + 1 || row.previous != previous {
                return Err(CommandError::Rejected("audit chain"));
            }
            self.verify("audit", row, &row.signature)?;
            previous = Some(hash(row)?);
        }
        Ok(())
    }
    fn payload<T: Serialize>(&self, domain: &str, value: &T) -> Result<Vec<u8>, CommandError> {
        let mut v =
            serde_json::to_value(value).map_err(|_| CommandError::Rejected("serialization"))?;
        v.as_object_mut()
            .ok_or(CommandError::Rejected("payload"))?
            .remove("signature");
        Ok(canonical_json_bytes(
            &json!({"schema":"quantos-command-hmac/v1","domain":domain,"tenant":self.0.tenant,"workspace":self.0.workspace,"key_id":self.0.signer,"value":v}),
        )?)
    }
    fn sign<T: Serialize>(&self, domain: &str, value: &T) -> Result<String, CommandError> {
        let mut mac = Hmac::<Sha256>::new_from_slice(&self.0.key)
            .map_err(|_| CommandError::Rejected("key"))?;
        mac.update(&self.payload(domain, value)?);
        Ok(hex::encode(mac.finalize().into_bytes()))
    }
    fn verify<T: Serialize>(
        &self,
        domain: &str,
        value: &T,
        signature: &str,
    ) -> Result<(), CommandError> {
        let bytes = hex::decode(signature).map_err(|_| CommandError::Rejected("signature"))?;
        let mut mac = Hmac::<Sha256>::new_from_slice(&self.0.key)
            .map_err(|_| CommandError::Rejected("key"))?;
        mac.update(&self.payload(domain, value)?);
        mac.verify_slice(&bytes)
            .map_err(|_| CommandError::Rejected("signature"))
    }
}
fn hash<T: Serialize>(value: &T) -> Result<ContentHash, CommandError> {
    let v = serde_json::to_value(value).map_err(|_| CommandError::Rejected("serialization"))?;
    Ok(ContentHash::sha256_bytes(&canonical_json_bytes(&v)?))
}

/// Immutable R04 record binding shared by Paper/Shadow and Assisted review.
pub(crate) fn validate_proposal_binding(
    auth: &AuthContext,
    record: &TradeProposalRecord,
    intent: &TradeIntent,
) -> Result<(), CommandError> {
    let out = &record.output;
    let action = match intent.side {
        Side::Buy => "PROPOSAL_ACTION_BUY",
        Side::Sell => "PROPOSAL_ACTION_SELL",
    };
    let notional = Decimal::from_str_exact(&intent.quantity)
        .ok()
        .zip(Decimal::from_str_exact(&intent.limit_price).ok())
        .and_then(|(q, p)| q.checked_mul(p));
    let valid = out["notional"]["value"]
        .as_str()
        .and_then(|v| Decimal::from_str_exact(v).ok())
        == notional
        && notional.is_some()
        && out["metadata"]["actor"]["actor_id"].as_str()
            == Some(auth.actor_id.to_string().as_str())
        && SignalProposalSchemaValidator::validate_proposal(out).is_ok()
        && record.artifact_manifest.tenant_id == auth.tenant_id
        && record.artifact_manifest.content_hash == hash(out)?
        && record.artifact_manifest.size_bytes == canonical_json_bytes(out)?.len() as u64
        && record.artifact_manifest.media_type == "application/json"
        && record.artifact_manifest.created_at <= record.created_at
        && out["signal"]["symbol"].as_str() == Some(intent.symbol.as_str())
        && out["signal"]["generated_at"]
            .as_str()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .is_some_and(|at| at <= record.created_at)
        && out["metadata"]["issued_at"]
            .as_str()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .is_some_and(|at| at <= record.created_at)
        && out["evidence_refs"]
            == serde_json::to_value(&record.evidence_refs)
                .map_err(|_| CommandError::Rejected("serialization"))?
        && out["counter_views"] == json!(record.counter_views)
        && out["metadata"]["tenant_id"].as_str() == Some(auth.tenant_id.to_string().as_str())
        && out["metadata"]["workspace_id"].as_str() == Some(auth.workspace_id.to_string().as_str())
        && out["proposal_id"].as_str() == Some(record.proposal_id.as_str())
        && out["account_id"].as_str() == Some(record.account_id.as_str())
        && record.account_id == intent.account_id.to_string()
        && record.symbol == intent.symbol
        && out["symbol"].as_str() == Some(intent.symbol.as_str())
        && out["signal"]["strategy_release_id"].as_str()
            == Some(intent.release_id.to_string().as_str())
        && out["signal"]["signal_id"].as_str() == Some(record.signal_id.as_str())
        && out["action"].as_str() == Some(action)
        && out["quantity"]["value"].as_str() == Some(intent.quantity.as_str())
        && out["expires_at"]
            .as_str()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .is_some_and(|t| t == record.expires_at)
        && record.capability == "decision.proposal.v1"
        && !record.executable
        && !record.evidence_refs.is_empty()
        && !record.counter_views.is_empty();
    if !valid {
        return Err(CommandError::Rejected("proposal binding"));
    }
    Ok(())
}
