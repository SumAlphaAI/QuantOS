//! SERVICE:L03 backend approval workflow. This issues no executable command,
//! RiskGuard token, venue credential or production permission. Trusted adapters
//! register current identities/subjects and attest provider-completed step-up.
use crate::venue_protocol::EXECUTION_VENUE;
use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, Mac};
use quantos_auth::AuthContext;
use quantos_core::{
    AccountId, ActorId, ContentHash, DecisionId, ProposalId, TenantId, WorkspaceId,
    canonical_json_bytes,
};
use quantos_policy::{Capability, Role, RunMode};
use quantos_risk::RiskVerdict;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::{Arc, Mutex},
};
use uuid::Uuid;
pub const ASSISTED_CAPABILITY: &str = "execution.assisted_testnet";
/// Fixed times are for trusted controlled callers; the HTTP owner passes a
/// clock callback which is sampled after the service state lock is held.
pub trait ClockInput {
    fn sample(&self) -> DateTime<Utc>;
}
impl ClockInput for DateTime<Utc> {
    fn sample(&self) -> DateTime<Utc> {
        *self
    }
}
impl<F: Fn() -> DateTime<Utc> + ?Sized> ClockInput for &F {
    fn sample(&self) -> DateTime<Utc> {
        self()
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Error {
    Disabled,
    Unauthorized,
    Expired,
    Invalid,
    Conflict,
    SelfApproval,
    SameApprover,
    MfaInvalid,
    MfaConsumed,
    PolicyChanged,
    Unavailable,
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "service_l03_{self:?}")
    }
}
impl std::error::Error for Error {}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Scope {
    pub tenant: TenantId,
    pub workspace: WorkspaceId,
    pub account: AccountId,
}
#[derive(Clone)]
pub struct Policy {
    pub enabled: bool,
    pub max_notional: Decimal,
    pub symbols: BTreeSet<String>,
    pub approval_ttl: Duration,
    pub mfa_ttl: Duration,
}
impl Default for Policy {
    fn default() -> Self {
        Self {
            enabled: false,
            max_notional: Decimal::from(50000),
            symbols: ["BTCUSDT".into(), "ETHUSDT".into()].into(),
            approval_ttl: Duration::minutes(5),
            mfa_ttl: Duration::minutes(2),
        }
    }
}
impl Policy {
    fn validate(&self) -> Result<(), Error> {
        if self.max_notional <= Decimal::ZERO
            || self.max_notional.scale() > 8
            || self.symbols.is_empty()
            || self.symbols.len() > 100
            || self.symbols.iter().any(|s| {
                s.is_empty()
                    || s.len() > 20
                    || !s
                        .bytes()
                        .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
            })
            || self.approval_ttl < Duration::seconds(1)
            || self.approval_ttl > Duration::seconds(300)
            || self.mfa_ttl < Duration::seconds(1)
            || self.mfa_ttl > Duration::seconds(120)
        {
            return Err(Error::Invalid);
        }
        Ok(())
    }
}
#[derive(Clone)]
pub struct Session {
    pub auth: AuthContext,
    pub revision: u64,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub active: bool,
}
/// Current trusted R04/risk projection, not accepted in an approval HTTP body.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Subject {
    pub id: ProposalId,
    pub scope: Scope,
    pub originator: ActorId,
    pub originator_user: Uuid,
    pub proposal_hash: ContentHash,
    pub decision: DecisionId,
    pub verdict: RiskVerdict,
    pub venue: String,
    pub symbol: String,
    pub quote_currency: String,
    pub side: crate::OrderSide,
    pub quantity: String,
    pub limit_price: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}
fn hash<T: Serialize>(v: &T) -> Result<ContentHash, Error> {
    Ok(ContentHash::sha256_bytes(
        &canonical_json_bytes(&serde_json::to_value(v).map_err(|_| Error::Invalid)?)
            .map_err(|_| Error::Invalid)?,
    ))
}
fn sign<T: Serialize>(key: &[u8; 32], domain: &str, v: &T) -> Result<String, Error> {
    let bytes =
        canonical_json_bytes(&serde_json::json!([domain, v])).map_err(|_| Error::Invalid)?;
    let mut h = Hmac::<Sha256>::new_from_slice(key).map_err(|_| Error::Invalid)?;
    h.update(&bytes);
    Ok(hex::encode(h.finalize().into_bytes()))
}
fn verify<T: Serialize>(key: &[u8; 32], domain: &str, v: &T, signature: &str) -> Result<(), Error> {
    let bytes =
        canonical_json_bytes(&serde_json::json!([domain, v])).map_err(|_| Error::Invalid)?;
    if signature.len() != 64 {
        return Err(Error::MfaInvalid);
    }
    let sig = hex::decode(signature).map_err(|_| Error::MfaInvalid)?;
    let mut h = Hmac::<Sha256>::new_from_slice(key).map_err(|_| Error::Invalid)?;
    h.update(&bytes);
    h.verify_slice(&sig).map_err(|_| Error::MfaInvalid)
}
fn amount(raw: &str) -> Result<Decimal, Error> {
    if raw.is_empty() || raw.len() > 64 || !raw.bytes().all(|b| b.is_ascii_digit() || b == b'.') {
        return Err(Error::Invalid);
    }
    let n = Decimal::from_str_exact(raw).map_err(|_| Error::Invalid)?;
    if n <= Decimal::ZERO || n.scale() > 8 {
        return Err(Error::Invalid);
    }
    Ok(n)
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Challenge {
    pub id: ProposalId,
    pub request: ProposalId,
    pub subject_hash: ContentHash,
    pub policy_revision: u64,
    pub scope: Scope,
    pub actor: ActorId,
    pub user: Uuid,
    pub session: String,
    pub session_revision: u64,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StepUpProof {
    pub challenge: Challenge,
    pub completed_at: DateTime<Utc>,
    pub signature: String,
}
impl std::fmt::Debug for StepUpProof {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("StepUpProof(REDACTED)")
    }
}
/// Trusted MFA-provider adapter only. Never expose attestation as a user route.
/// The owned test adapter simulates completion; this is not a real MFA factor.
pub struct MfaAttestor {
    key: [u8; 32],
}
impl Drop for MfaAttestor {
    fn drop(&mut self) {
        zeroize::Zeroize::zeroize(&mut self.key);
    }
}
impl MfaAttestor {
    pub fn new(key: [u8; 32]) -> Result<Self, Error> {
        if key.iter().all(|b| *b == 0) {
            return Err(Error::Invalid);
        }
        Ok(Self { key })
    }
    pub fn attest_provider_completed(
        &self,
        challenge: Challenge,
        at: DateTime<Utc>,
    ) -> Result<StepUpProof, Error> {
        if at < challenge.issued_at || at >= challenge.expires_at {
            return Err(Error::Expired);
        }
        let mut p = StepUpProof {
            challenge,
            completed_at: at,
            signature: String::new(),
        };
        p.signature = sign(&self.key, "l03-step-up/v1", &p)?;
        Ok(p)
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Receipt {
    pub requester: ActorId,
    pub request: ProposalId,
    pub subject_hash: ContentHash,
    pub policy_revision: u64,
    pub revision: u64,
    pub status: String,
    pub approvers: Vec<ActorId>,
    pub expires_at: DateTime<Utc>,
    pub notional: String,
    pub execution_authority: bool,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Outcome {
    pub receipt: Receipt,
    pub replayed: bool,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Audit {
    pub sequence: u64,
    pub scope: Scope,
    pub previous: Option<ContentHash>,
    pub request: ProposalId,
    pub subject_hash: ContentHash,
    pub actor: ActorId,
    pub user: Uuid,
    pub slot: u8,
    pub policy_revision: u64,
    pub revision: u64,
    pub at: DateTime<Utc>,
    pub proof_hash: ContentHash,
    pub signature: String,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Anchor {
    pub count: usize,
    pub head: Option<ContentHash>,
}
#[derive(Clone, Serialize, Deserialize)]
struct Approval {
    session: String,
    proof: StepUpProof,
}
#[derive(Clone, Serialize, Deserialize)]
struct Request {
    subject: Subject,
    hash: ContentHash,
    requester: ActorId,
    requester_user: Uuid,
    requester_session: String,
    requester_revision: u64,
    receipt: Receipt,
    approvals: Vec<Approval>,
}
#[derive(Clone, Serialize, Deserialize)]
struct Cached {
    binding: ContentHash,
    receipt: Receipt,
}
struct State {
    scope: Scope,
    policy: Policy,
    revision: u64,
    clock: DateTime<Utc>,
    mfa_key: [u8; 32],
    audit_key: [u8; 32],
    sessions: BTreeMap<String, Session>,
    subjects: BTreeMap<ProposalId, Subject>,
    revoked_subjects: BTreeSet<ProposalId>,
    current_sources: Option<crate::assisted_source::CurrentSubjectSource>,
    requests: BTreeMap<ProposalId, Request>,
    challenges: BTreeMap<ProposalId, Challenge>,
    used: BTreeSet<ProposalId>,
    cache: BTreeMap<(ActorId, ContentHash), Cached>,
    audit: Vec<Audit>,
}
impl Drop for State {
    fn drop(&mut self) {
        zeroize::Zeroize::zeroize(&mut self.mfa_key);
        zeroize::Zeroize::zeroize(&mut self.audit_key);
    }
}
#[derive(Clone)]
pub struct AssistedApprovalService(Arc<Mutex<State>>);
impl State {
    fn tick(&mut self, at: DateTime<Utc>) -> Result<(), Error> {
        if at < self.clock {
            return Err(Error::Expired);
        }
        self.clock = at;
        Ok(())
    }
    fn gate(&self) -> Result<(), Error> {
        if !self.policy.enabled {
            return Err(Error::Disabled);
        }
        Ok(())
    }
    fn auth(&self, session: &str, at: DateTime<Utc>, approve: bool) -> Result<&Session, Error> {
        let s = self.sessions.get(session).ok_or(Error::Unauthorized)?;
        let a = &s.auth;
        if !s.active
            || s.issued_at > at
            || s.expires_at <= at
            || a.user_id.is_nil()
            || a.actor_id.as_uuid().is_nil()
            || a.tenant_id != self.scope.tenant
            || a.workspace_id != self.scope.workspace
            || a.account_id != Some(self.scope.account)
            || a.mode != RunMode::AssistedLive
            || !a
                .capabilities
                .iter()
                .any(|c| c.as_str() == ASSISTED_CAPABILITY)
            || !a.capabilities.iter().any(|c| {
                c.as_str()
                    == if approve {
                        Capability::STRATEGY_APPROVE
                    } else {
                        Capability::EXECUTION_OPERATE
                    }
            })
            || if approve {
                !matches!(a.role, Role::Owner | Role::Approver)
            } else {
                !matches!(a.role, Role::Owner | Role::Operator)
            }
        {
            return Err(Error::Unauthorized);
        }
        Ok(s)
    }
    fn subject(&self, s: &Subject, at: DateTime<Utc>) -> Result<Decimal, Error> {
        if s.scope != self.scope
            || s.verdict != RiskVerdict::ApprovalRequired
            || s.created_at > at
            || s.expires_at <= at
            || s.venue != EXECUTION_VENUE
            || s.quote_currency != "USDT"
            || !s.symbol.ends_with("USDT")
            || self.revoked_subjects.contains(&s.id)
            || !self.policy.symbols.contains(&s.symbol)
        {
            return Err(Error::Invalid);
        }
        if let Some(source) = &self.current_sources {
            source.with_current(s, at, || ())?;
        }
        let n = amount(&s.quantity)?
            .checked_mul(amount(&s.limit_price)?)
            .ok_or(Error::Invalid)?;
        if n > self.policy.max_notional {
            return Err(Error::Invalid);
        }
        Ok(n)
    }
    fn current(&self, r: &Request, at: DateTime<Utc>) -> Result<(), Error> {
        if r.receipt.policy_revision != self.revision {
            return Err(Error::PolicyChanged);
        }
        if at >= r.receipt.expires_at {
            return Err(Error::Expired);
        }
        self.subject(&r.subject, at)?;
        let requester = self.auth(&r.requester_session, at, false)?;
        if requester.revision != r.requester_revision
            || requester.auth.actor_id != r.requester
            || requester.auth.user_id != r.requester_user
        {
            return Err(Error::Unauthorized);
        }
        for a in &r.approvals {
            self.proof(r, &a.session, &a.proof, at)?;
        }
        Ok(())
    }
    fn proof(
        &self,
        r: &Request,
        session: &str,
        p: &StepUpProof,
        at: DateTime<Utc>,
    ) -> Result<(), Error> {
        let s = self.auth(session, at, true)?;
        let c = &p.challenge;
        if c.scope != self.scope
            || c.actor != s.auth.actor_id
            || c.user != s.auth.user_id
            || c.session != session
            || c.session_revision != s.revision
            || c.request != r.receipt.request
            || c.subject_hash != r.hash
            || c.policy_revision != self.revision
            || c.issued_at > p.completed_at
            || p.completed_at > at
            || at >= c.expires_at
            || c.expires_at - c.issued_at > self.policy.mfa_ttl
            || c.issued_at > at
            || self
                .challenges
                .get(&c.id)
                .is_none_or(|known| hash(known).ok() != hash(c).ok())
        {
            return Err(Error::MfaInvalid);
        }
        let mut unsigned = p.clone();
        unsigned.signature.clear();
        verify(&self.mfa_key, "l03-step-up/v1", &unsigned, &p.signature)
    }
    fn key(actor: ActorId, key: &str) -> Result<(ActorId, ContentHash), Error> {
        if key.is_empty() || key.len() > 128 {
            return Err(Error::Invalid);
        }
        Ok((actor, hash(&key)?))
    }
}
impl AssistedApprovalService {
    pub fn new(
        scope: Scope,
        policy: Policy,
        mfa_key: [u8; 32],
        audit_key: [u8; 32],
        at: DateTime<Utc>,
    ) -> Result<Self, Error> {
        policy.validate()?;
        if scope.tenant.as_uuid().is_nil()
            || scope.workspace.as_uuid().is_nil()
            || scope.account.as_uuid().is_nil()
            || mfa_key.iter().all(|b| *b == 0)
            || audit_key.iter().all(|b| *b == 0)
            || mfa_key == audit_key
        {
            return Err(Error::Invalid);
        }
        Ok(Self(Arc::new(Mutex::new(State {
            scope,
            policy,
            revision: 1,
            clock: at,
            mfa_key,
            audit_key,
            sessions: BTreeMap::new(),
            subjects: BTreeMap::new(),
            revoked_subjects: BTreeSet::new(),
            current_sources: None,
            requests: BTreeMap::new(),
            challenges: BTreeMap::new(),
            used: BTreeSet::new(),
            cache: BTreeMap::new(),
            audit: vec![],
        }))))
    }
    /// Privileged owner wiring; no client route can register or replace identities.
    pub fn register_session(&self, handle: String, session: Session) -> Result<(), Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        if handle.is_empty()
            || handle.len() > 128
            || session.revision == 0
            || session.issued_at > s.clock
            || session.expires_at <= s.clock
            || session.expires_at - session.issued_at > Duration::minutes(15)
            || s.sessions.len() >= 4096
            || s.sessions.contains_key(&handle)
        {
            return Err(Error::Invalid);
        }
        s.sessions.insert(handle, session);
        Ok(())
    }
    pub fn update_session(&self, handle: &str, expected: u64, next: Session) -> Result<(), Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let old = s.sessions.get(handle).ok_or(Error::Unauthorized)?;
        if old.revision != expected
            || next.revision != expected.checked_add(1).ok_or(Error::Invalid)?
            || old.auth.actor_id != next.auth.actor_id
            || old.auth.user_id != next.auth.user_id
            || next.issued_at > s.clock
            || next.expires_at <= s.clock
            || next.expires_at - next.issued_at > Duration::minutes(15)
        {
            return Err(Error::Conflict);
        }
        s.sessions.insert(handle.into(), next);
        Ok(())
    }
    pub fn revoke_subject(&self, id: ProposalId) -> Result<(), Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        if !s.subjects.contains_key(&id) {
            return Err(Error::Invalid);
        }
        s.revoked_subjects.insert(id);
        Ok(())
    }
    pub fn revoke_session(&self, handle: &str) -> Result<(), Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        s.sessions
            .get_mut(handle)
            .ok_or(Error::Unauthorized)?
            .active = false;
        Ok(())
    }
    /// Install before any subjects/requests. There is no detachment or fallback
    /// to raw projections after a source authority has been configured.
    pub fn with_current_sources(
        &self,
        source: crate::assisted_source::CurrentSubjectSource,
    ) -> Result<(), Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        if s.current_sources.is_some()
            || !s.subjects.is_empty()
            || !s.requests.is_empty()
            || !source.scope_matches(&s.scope)
        {
            return Err(Error::Invalid);
        }
        s.current_sources = Some(source);
        Ok(())
    }
    /// Trusted current subject feed only. Values cannot be overwritten in place.
    pub fn register_subject(&self, subject: Subject) -> Result<(), Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        if subject.originator.as_uuid().is_nil()
            || subject.originator_user.is_nil()
            || subject.scope != s.scope
            || subject.expires_at <= subject.created_at
            || s.subjects.len() >= 4096
            || s.subjects.contains_key(&subject.id)
        {
            return Err(Error::Invalid);
        }
        if let Some(source) = &s.current_sources {
            source.with_current(&subject, subject.created_at, || ())?;
        }
        s.subjects.insert(subject.id, subject);
        Ok(())
    }
    pub fn update_policy(
        &self,
        expected: u64,
        policy: Policy,
        clock: impl ClockInput,
    ) -> Result<u64, Error> {
        policy.validate()?;
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let at = clock.sample();
        if expected != s.revision {
            return Err(Error::Conflict);
        }
        s.tick(at)?;
        s.revision = s.revision.checked_add(1).ok_or(Error::Unavailable)?;
        s.policy = policy;
        Ok(s.revision)
    }
    pub fn reachable(&self) -> Result<bool, Error> {
        Ok(self
            .0
            .lock()
            .map_err(|_| Error::Unavailable)?
            .policy
            .enabled)
    }
    pub fn capabilities(
        &self,
        session: &str,
        clock: impl ClockInput,
    ) -> Result<serde_json::Value, Error> {
        let s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let at = clock.sample();
        let request = s.policy.enabled && s.auth(session, at, false).is_ok();
        let approve = s.policy.enabled && s.auth(session, at, true).is_ok();
        Ok(
            serde_json::json!({"enabled":s.policy.enabled,"policyRevision":s.revision,"request":request,"approve":approve,"executionAuthority":false,"venue":"binance-spot-testnet"}),
        )
    }
    pub fn open(
        &self,
        session: &str,
        subject: ProposalId,
        key: &str,
        clock: impl ClockInput,
    ) -> Result<Outcome, Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let at = clock.sample();
        s.gate()?;
        s.tick(at)?;
        let requester_revision = s.auth(session, at, false)?.revision;
        let identity = s.auth(session, at, false)?.auth.clone();
        let sub = s.subjects.get(&subject).ok_or(Error::Invalid)?.clone();
        let notional = s.subject(&sub, at)?;
        let k = State::key(identity.actor_id, key)?;
        let binding = hash(&serde_json::json!(["open", subject, hash(&sub)?]))?;
        if let Some(c) = s.cache.get(&k) {
            if c.binding != binding {
                return Err(Error::Conflict);
            }
            let r = s.requests.get(&c.receipt.request).ok_or(Error::Conflict)?;
            s.current(r, at)?;
            return Ok(Outcome {
                receipt: c.receipt.clone(),
                replayed: true,
            });
        }
        if s.requests.len() >= 4096 || s.cache.len() >= 16384 {
            return Err(Error::Unavailable);
        }
        let receipt = Receipt {
            requester: identity.actor_id,
            request: ProposalId::new(),
            subject_hash: hash(&sub)?,
            policy_revision: s.revision,
            revision: 0,
            status: "pending".into(),
            approvers: vec![],
            expires_at: sub.expires_at.min(at + s.policy.approval_ttl),
            notional: notional.to_string(),
            execution_authority: false,
        };
        let r = Request {
            subject: sub,
            hash: receipt.subject_hash.clone(),
            requester: identity.actor_id,
            requester_user: identity.user_id,
            requester_session: session.into(),
            requester_revision,
            receipt: receipt.clone(),
            approvals: vec![],
        };
        s.requests.insert(receipt.request, r);
        s.cache.insert(
            k,
            Cached {
                binding,
                receipt: receipt.clone(),
            },
        );
        Ok(Outcome {
            receipt,
            replayed: false,
        })
    }
    pub fn challenge(
        &self,
        session: &str,
        id: ProposalId,
        clock: impl ClockInput,
    ) -> Result<Challenge, Error> {
        self.challenge_until(session, id, None, clock)
    }
    /// A verified owner may shorten the step-up deadline to the original F06
    /// completion window. It can never extend the configured/session deadline.
    pub fn challenge_until(
        &self,
        session: &str,
        id: ProposalId,
        original_deadline: Option<DateTime<Utc>>,
        clock: impl ClockInput,
    ) -> Result<Challenge, Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let at = clock.sample();
        s.gate()?;
        s.tick(at)?;
        let a = s.auth(session, at, true)?.clone();
        let r = s.requests.get(&id).ok_or(Error::Invalid)?;
        s.current(r, at)?;
        Self::independent(r, &a.auth)?;
        if original_deadline.is_some_and(|d| d <= at) {
            return Err(Error::Expired);
        }
        if r.approvals.len() >= 2 || s.challenges.len() >= 8192 {
            return Err(Error::Conflict);
        }
        let c = Challenge {
            id: ProposalId::new(),
            request: id,
            subject_hash: r.hash.clone(),
            policy_revision: s.revision,
            scope: s.scope.clone(),
            actor: a.auth.actor_id,
            user: a.auth.user_id,
            session: session.into(),
            session_revision: a.revision,
            issued_at: at,
            expires_at: r
                .receipt
                .expires_at
                .min(a.expires_at)
                .min(at + s.policy.mfa_ttl)
                .min(original_deadline.unwrap_or(DateTime::<Utc>::MAX_UTC)),
        };
        s.challenges.insert(c.id, c.clone());
        Ok(c)
    }
    fn independent(r: &Request, a: &AuthContext) -> Result<(), Error> {
        if a.actor_id == r.requester
            || a.actor_id == r.subject.originator
            || a.user_id == r.requester_user
            || a.user_id == r.subject.originator_user
        {
            return Err(Error::SelfApproval);
        }
        if r.approvals
            .iter()
            .any(|p| p.proof.challenge.actor == a.actor_id || p.proof.challenge.user == a.user_id)
        {
            return Err(Error::SameApprover);
        }
        Ok(())
    }
    pub fn approve(
        &self,
        session: &str,
        id: ProposalId,
        expected: u64,
        key: &str,
        proof: StepUpProof,
        clock: impl ClockInput,
    ) -> Result<Outcome, Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let at = clock.sample();
        s.gate()?;
        s.tick(at)?;
        let a = s.auth(session, at, true)?.auth.clone();
        let r = s.requests.get(&id).ok_or(Error::Invalid)?.clone();
        s.current(&r, at)?;
        s.proof(&r, session, &proof, at)?;
        let k = State::key(a.actor_id, key)?;
        let binding = hash(&serde_json::json!(["approve", id, expected, proof]))?;
        if let Some(c) = s.cache.get(&k) {
            if c.binding != binding {
                return Err(Error::Conflict);
            }
            return Ok(Outcome {
                receipt: c.receipt.clone(),
                replayed: true,
            });
        }
        Self::independent(&r, &a)?;
        if s.used.contains(&proof.challenge.id) {
            return Err(Error::MfaConsumed);
        }
        if expected != r.receipt.revision || r.approvals.len() >= 2 {
            return Err(Error::Conflict);
        }
        if s.cache.len() >= 16384 || s.audit.len() >= 8192 {
            return Err(Error::Unavailable);
        }
        let mut next = r.clone();
        next.approvals.push(Approval {
            session: session.into(),
            proof: proof.clone(),
        });
        next.receipt.revision += 1;
        next.receipt.approvers.push(a.actor_id);
        next.receipt.status = if next.approvals.len() == 2 {
            "approved"
        } else {
            "awaiting_second"
        }
        .into();
        next.receipt.expires_at = next.receipt.expires_at.min(proof.challenge.expires_at);
        let mut audit = Audit {
            sequence: s.audit.len() as u64 + 1,
            scope: s.scope.clone(),
            previous: s.audit.last().map(hash).transpose()?,
            request: id,
            subject_hash: r.hash,
            actor: a.actor_id,
            user: a.user_id,
            slot: next.approvals.len() as u8,
            policy_revision: s.revision,
            revision: next.receipt.revision,
            at,
            proof_hash: hash(&proof.challenge.id)?,
            signature: String::new(),
        };
        audit.signature = sign(&s.audit_key, "l03-approval-audit/v1", &audit)?;
        let receipt = next.receipt.clone();
        s.used.insert(proof.challenge.id);
        s.audit.push(audit);
        s.requests.insert(id, next);
        s.cache.insert(
            k,
            Cached {
                binding,
                receipt: receipt.clone(),
            },
        );
        Ok(Outcome {
            receipt,
            replayed: false,
        })
    }
    pub fn inspect(
        &self,
        session: &str,
        id: ProposalId,
        clock: impl ClockInput,
    ) -> Result<Receipt, Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let at = clock.sample();
        s.gate()?;
        s.tick(at)?;
        if s.auth(session, at, false).is_err() {
            s.auth(session, at, true)?;
        }
        let r = s.requests.get(&id).ok_or(Error::Invalid)?;
        s.current(r, at)?;
        Ok(r.receipt.clone())
    }
    /// The native bridge runs under the approval lock. A receipt or serialized
    /// proof is never an execution token; current policy, identities and subject
    /// are rechecked even for original-command recovery. Lock order: bridge -> service.
    pub(crate) fn with_execution<T>(
        &self,
        session: &str,
        id: ProposalId,
        clock: impl ClockInput,
        action: impl FnOnce(&Subject, &Receipt, DateTime<Utc>, DateTime<Utc>) -> Result<T, Error>,
    ) -> Result<T, Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let now = clock.sample();
        s.gate()?;
        s.tick(now)?;
        let actor = s.auth(session, now, false)?;
        let r = s.requests.get(&id).ok_or(Error::Invalid)?;
        s.current(r, now)?;
        if session != r.requester_session
            || r.requester != actor.auth.actor_id
            || r.requester_user != actor.auth.user_id
            || r.receipt.status != "approved"
            || r.approvals.len() != 2
            || s.subjects.get(&r.subject.id) != Some(&r.subject)
        {
            return Err(Error::Unauthorized);
        }
        let deadline = r
            .approvals
            .iter()
            .fold(r.receipt.expires_at.min(actor.expires_at), |d, a| {
                d.min(a.proof.challenge.expires_at)
            });
        let run = |current| {
            if current >= deadline {
                return Err(Error::Expired);
            }
            action(&r.subject, &r.receipt, deadline, current)
        };
        if let Some(source) = &s.current_sources {
            source.with_current_at(&r.subject, &|| clock.sample(), run)?
        } else {
            run(now)
        }
    }

    /// Read facts after an approval deadline without restoring write authority.
    pub fn execution_view(
        &self,
        session: &str,
        id: ProposalId,
        clock: impl ClockInput,
    ) -> Result<Receipt, Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let now = clock.sample();
        s.gate()?;
        s.tick(now)?;
        if s.auth(session, now, false).is_err() {
            s.auth(session, now, true)?;
        }
        Ok(s.requests.get(&id).ok_or(Error::Invalid)?.receipt.clone())
    }
    /// Trusted owner persistence only. This is authenticated with the audit key;
    /// restoring a browser receipt or a checkpoint from another scope is denied.
    pub fn checkpoint(&self) -> Result<serde_json::Value, Error> {
        let s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let value = serde_json::json!({
            "scope":s.scope,"revision":s.revision,"clock":s.clock,
            "subjects":s.subjects,"revokedSubjects":s.revoked_subjects,
            "requests":s.requests,"challenges":s.challenges,"used":s.used,
            "cache":s.cache.iter().collect::<Vec<_>>(),"audit":s.audit,
            "currentSources":s.current_sources.as_ref().map(|source|source.checkpoint()).transpose()?
        });
        Ok(
            serde_json::json!({"value":value,"signature":sign(&s.audit_key,"l04-approval-checkpoint/v1",&value)?}),
        )
    }
    /// Current policy and sessions are supplied by the trusted owner, never
    /// restored from disk. Original request/session generations remain pinned.
    pub fn restore_checkpoint(&self, checkpoint: &serde_json::Value) -> Result<(), Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let v = &checkpoint["value"];
        verify(
            &s.audit_key,
            "l04-approval-checkpoint/v1",
            v,
            checkpoint["signature"].as_str().ok_or(Error::Invalid)?,
        )?;
        if v["scope"] != serde_json::to_value(&s.scope).map_err(|_| Error::Invalid)?
            || v["revision"].as_u64() != Some(s.revision)
        {
            return Err(Error::PolicyChanged);
        }
        fn decode<T: serde::de::DeserializeOwned>(v: &serde_json::Value) -> Result<T, Error> {
            serde_json::from_value(v.clone()).map_err(|_| Error::Invalid)
        }
        let clock = decode(&v["clock"])?;
        if clock < s.clock && !s.requests.is_empty() {
            return Err(Error::Expired);
        }
        match (&s.current_sources, v.get("currentSources")) {
            (Some(source), Some(v)) if !v.is_null() => source.restore_authenticated(v)?,
            (None, None | Some(serde_json::Value::Null)) => (),
            _ => return Err(Error::Invalid),
        }
        s.clock = clock;
        s.subjects = decode(&v["subjects"])?;
        s.revoked_subjects
            .extend(decode::<BTreeSet<ProposalId>>(&v["revokedSubjects"])?);
        s.requests = decode(&v["requests"])?;
        s.challenges = decode(&v["challenges"])?;
        s.used = decode(&v["used"])?;
        s.cache = decode::<Vec<((ActorId, ContentHash), Cached)>>(&v["cache"])?
            .into_iter()
            .collect();
        s.audit = decode(&v["audit"])?;
        Ok(())
    }
    /// Trusted audit export, not a client permission or restore/issuance API.
    pub fn audit_snapshot(&self) -> Result<(Vec<Audit>, Anchor), Error> {
        let s = self.0.lock().map_err(|_| Error::Unavailable)?;
        Ok((
            s.audit.clone(),
            Anchor {
                count: s.audit.len(),
                head: s.audit.last().map(hash).transpose()?,
            },
        ))
    }
    pub fn verify_audit(&self, entries: &[Audit], anchor: &Anchor) -> Result<(), Error> {
        let s = self.0.lock().map_err(|_| Error::Unavailable)?;
        if entries.len() != anchor.count || entries.last().map(hash).transpose()? != anchor.head {
            return Err(Error::Invalid);
        }
        let mut previous = None;
        for (i, entry) in entries.iter().enumerate() {
            if entry.scope != s.scope
                || entry.sequence != i as u64 + 1
                || entry.previous != previous
            {
                return Err(Error::Invalid);
            }
            let mut unsigned = entry.clone();
            unsigned.signature.clear();
            verify(
                &s.audit_key,
                "l03-approval-audit/v1",
                &unsigned,
                &entry.signature,
            )?;
            previous = Some(hash(entry)?);
        }
        Ok(())
    }
}

#[cfg(test)]
mod clock_tests {
    use super::*;
    #[test]
    fn service_l03_http_clock_callback_is_sampled_under_the_state_lock() {
        let at = Utc::now();
        let service = AssistedApprovalService::new(
            Scope {
                tenant: TenantId::new(),
                workspace: WorkspaceId::new(),
                account: AccountId::new(),
            },
            Policy::default(),
            [1; 32],
            [2; 32],
            at,
        )
        .unwrap();
        let clone = service.clone();
        let (started_tx, started_rx) = std::sync::mpsc::channel();
        let (clock_tx, clock_rx) = std::sync::mpsc::channel();
        let held = service.0.lock().unwrap();
        let child = std::thread::spawn(move || {
            started_tx.send(()).unwrap();
            clone
                .capabilities("unknown", &|| {
                    clock_tx.send(()).unwrap();
                    at
                })
                .unwrap()
        });
        started_rx
            .recv_timeout(std::time::Duration::from_secs(1))
            .unwrap();
        assert!(
            clock_rx
                .recv_timeout(std::time::Duration::from_millis(30))
                .is_err()
        );
        drop(held);
        clock_rx
            .recv_timeout(std::time::Duration::from_secs(1))
            .unwrap();
        assert_eq!(child.join().unwrap()["executionAuthority"], false);
    }
}
