//! CORE:X02 current R04 -> signed risk review -> public approval Subject.
//! Trusted owner adapter only. This type is never an HTTP request schema.
//! Lock order: native -> approvals -> sources -> risk. Kill CAS uses risk only.
use crate::{
    OrderSide, assisted::*, authority::validate_proposal_binding, venue_protocol::EXECUTION_VENUE,
};
use chrono::{DateTime, Utc};
use quantos_auth::AuthContext;
use quantos_core::{ContentHash, ProposalId, canonical_json_bytes};
use quantos_policy::RunMode;
use quantos_portfolio::RiskInputSnapshot;
use quantos_risk::{RiskVerdict, guard::*};
use quantos_runtime::signal_proposal::{SignalProposalSchemaValidator, TradeProposalRecord};
use quantos_strategy::release::{DeploymentTarget, StrategyRelease};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::{Arc, Mutex},
};

#[derive(Clone)]
pub struct CurrentRiskSources {
    pub snapshot: RiskInputSnapshot,
    pub financials: AccountFinancials,
    pub venue: VenueState,
    pub release: StrategyRelease,
}
#[derive(Clone)]
struct Entry {
    subject: Subject,
    record: TradeProposalRecord,
    auth: AuthContext,
    intent: TradeIntent,
    decision: GuardDecision,
    current: CurrentRiskSources,
}
#[derive(Default)]
struct State {
    entries: BTreeMap<ProposalId, Entry>,
    revoked: BTreeSet<ProposalId>,
    immutable_checkpoint: Option<Value>,
}
/// Same guard instance must serve evaluation, kill CAS and dispatch validation.
#[derive(Clone)]
pub struct CurrentSubjectSource {
    guard: RiskGuard,
    state: Arc<Mutex<State>>,
    storage_key: Arc<StorageKey>,
}
struct StorageKey([u8; 32]);
impl Drop for StorageKey {
    fn drop(&mut self) {
        zeroize::Zeroize::zeroize(&mut self.0);
    }
}
fn invalid<E>(_: E) -> Error {
    Error::Invalid
}
fn digest<T: Serialize>(v: &T) -> Result<ContentHash, Error> {
    Ok(ContentHash::sha256_bytes(
        &canonical_json_bytes(&serde_json::to_value(v).map_err(invalid)?).map_err(invalid)?,
    ))
}
fn bind(e: &Entry) -> Result<(), Error> {
    validate_proposal_binding(&e.auth, &e.record, &e.intent).map_err(invalid)?;
    let r = &e.record;
    let s = &e.subject;
    let d = &e.decision;
    SignalProposalSchemaValidator::validate_signal_at(&r.output["signal"], d.decided_at)
        .map_err(invalid)?;
    let signal_until = r.output["signal"]["valid_until"]
        .as_str()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .ok_or(Error::Invalid)?;
    if e.auth.mode != RunMode::AssistedLive
        || e.intent.target != DeploymentTarget::Shadow
        || e.auth.user_id.is_nil()
        || e.auth.account_id != Some(e.intent.account_id)
        || r.created_at > d.decided_at
        || r.expires_at <= d.decided_at
        || r.expires_at > signal_until
        || s.created_at != d.decided_at
        || s.expires_at != r.expires_at.min(d.expires_at)
        || s.scope
            != (Scope {
                tenant: e.auth.tenant_id,
                workspace: e.auth.workspace_id,
                account: e.intent.account_id,
            })
        || s.originator != e.auth.actor_id
        || s.originator_user != e.auth.user_id
        || s.proposal_hash != digest(r)?
        || d.proposal_hash.as_ref() != Some(&s.proposal_hash)
        || s.decision != d.decision_id
        || s.verdict != RiskVerdict::ApprovalRequired
        || d.verdict != RiskVerdict::ApprovalRequired
        || d.purpose != "assisted_testnet_review"
        || s.venue != EXECUTION_VENUE
        || e.current.venue.venue != "OWNED_TESTNET"
        || s.quote_currency != "USDT"
        || e.current.financials.quote_unit != "USDT"
        || d.policy.quote_unit != "USDT"
        || s.symbol != e.intent.symbol
        || s.quantity != e.intent.quantity
        || s.limit_price != e.intent.limit_price
        || s.side
            != match e.intent.side {
                Side::Buy => OrderSide::Buy,
                Side::Sell => OrderSide::Sell,
            }
    {
        return Err(Error::Invalid);
    }
    Ok(())
}
impl CurrentSubjectSource {
    pub fn new(guard: RiskGuard, storage_key: [u8; 32]) -> Result<Self, Error> {
        if storage_key.iter().all(|b| *b == 0) {
            return Err(Error::Invalid);
        }
        Ok(Self {
            guard,
            state: Arc::new(Mutex::new(State::default())),
            storage_key: Arc::new(StorageKey(storage_key)),
        })
    }
    pub fn scope_matches(&self, scope: &Scope) -> bool {
        self.guard.scope_matches(scope.tenant, scope.workspace)
    }
    /// Owner resolves immutable R04 repository bytes and the exact registered
    /// X02 decision. A preview, checksum, browser projection or Allow is refused.
    pub fn register(
        &self,
        auth: AuthContext,
        record: TradeProposalRecord,
        intent: TradeIntent,
        decision: GuardDecision,
        current: CurrentRiskSources,
        at: DateTime<Utc>,
    ) -> Result<Subject, Error> {
        let subject = Subject {
            id: ProposalId::new(),
            scope: Scope {
                tenant: auth.tenant_id,
                workspace: auth.workspace_id,
                account: intent.account_id,
            },
            originator: auth.actor_id,
            originator_user: auth.user_id,
            proposal_hash: digest(&record)?,
            decision: decision.decision_id,
            verdict: decision.verdict,
            venue: EXECUTION_VENUE.into(),
            symbol: intent.symbol.clone(),
            quote_currency: "USDT".into(),
            side: match intent.side {
                Side::Buy => OrderSide::Buy,
                Side::Sell => OrderSide::Sell,
            },
            quantity: intent.quantity.clone(),
            limit_price: intent.limit_price.clone(),
            created_at: decision.decided_at,
            expires_at: record.expires_at.min(decision.expires_at),
        };
        let e = Entry {
            subject: subject.clone(),
            auth,
            record,
            intent,
            decision,
            current,
        };
        bind(&e)?;
        let mut state = self.state.lock().map_err(|_| Error::Unavailable)?;
        if state.entries.len() >= 4096
            || state
                .entries
                .values()
                .any(|v| v.record.proposal_id == e.record.proposal_id)
        {
            return Err(Error::Conflict);
        }
        self.check(&e, at, |_| ())?;
        state.immutable_checkpoint = None;
        state.entries.insert(subject.id, e);
        Ok(subject)
    }
    fn check<T>(
        &self,
        e: &Entry,
        clock: impl ClockInput,
        action: impl FnOnce(DateTime<Utc>) -> T,
    ) -> Result<T, Error> {
        bind(e)?;
        self.guard
            .with_current_assisted_review(
                &e.decision,
                &e.auth,
                &e.intent,
                &e.current.snapshot,
                &e.current.financials,
                &e.current.venue,
                &e.current.release,
                || clock.sample(),
                action,
            )
            .map_err(invalid)
    }
    /// Check immutable binding and current facts, holding both locks throughout
    /// the callback so a concurrent revoke/source update/kill cannot race IO.
    pub fn with_current<T>(
        &self,
        subject: &Subject,
        clock: impl ClockInput,
        action: impl FnOnce() -> T,
    ) -> Result<T, Error> {
        self.with_current_at(subject, clock, |_| action())
    }
    pub(crate) fn with_current_at<T>(
        &self,
        subject: &Subject,
        clock: impl ClockInput,
        action: impl FnOnce(DateTime<Utc>) -> T,
    ) -> Result<T, Error> {
        let state = self.state.lock().map_err(|_| Error::Unavailable)?;
        let e = state.entries.get(&subject.id).ok_or(Error::Invalid)?;
        if state.revoked.contains(&subject.id) || &e.subject != subject {
            return Err(Error::Invalid);
        }
        self.check(e, clock, |now| {
            if now >= subject.expires_at {
                Err(Error::Expired)
            } else {
                Ok(action(now))
            }
        })?
    }
    /// Trusted owner updates invalidate the old immutable review whenever the
    /// source hash/facts, scope, health, release or freshness no longer match.
    pub fn replace_current(
        &self,
        id: ProposalId,
        current: CurrentRiskSources,
    ) -> Result<(), Error> {
        let mut state = self.state.lock().map_err(|_| Error::Unavailable)?;
        let e = state.entries.get(&id).ok_or(Error::Invalid)?;
        let changed = digest(&json!([
            current.snapshot,
            current.financials,
            current.venue,
            current.release
        ]))? != digest(&json!([
            e.current.snapshot,
            e.current.financials,
            e.current.venue,
            e.current.release
        ]))?;
        // Immutable decision: changed sources require a new review and Subject.
        // Retain the original signed source for read-only causation/recovery.
        if changed {
            state.revoked.insert(id);
        }
        Ok(())
    }

    pub fn revoke(&self, id: ProposalId) -> Result<(), Error> {
        let mut state = self.state.lock().map_err(|_| Error::Unavailable)?;
        if !state.entries.contains_key(&id) {
            return Err(Error::Invalid);
        }
        state.revoked.insert(id);
        Ok(())
    }
    /// Trusted owner control only; the BFF does not expose a mutation route.
    /// Deployment-wide durability/control remains a separate L4 obligation.
    pub fn set_kill_switch(
        &self,
        auth: &AuthContext,
        scope: KillScope,
        engaged: bool,
        expected: u64,
        reason: &str,
        at: DateTime<Utc>,
    ) -> Result<KillReceipt, GuardError> {
        self.guard
            .set_kill_switch(auth, scope, engaged, expected, reason, at)
    }
    /// Safe C10 provenance: no keys, raw financials, source payload or executable token.
    pub fn provenance(&self, id: ProposalId) -> Result<Value, Error> {
        let state = self.state.lock().map_err(|_| Error::Unavailable)?;
        let e = state.entries.get(&id).ok_or(Error::Invalid)?;
        Ok(
            json!({"schema":"quantos-current-assisted-source/v1","proposalId":e.record.proposal_id,
            "proposalArtifactHash":e.record.artifact_manifest.content_hash,"proposalRecordHash":e.subject.proposal_hash,
            "decisionId":e.decision.decision_id,"decisionSignature":e.decision.signature,"decisionPurpose":e.decision.purpose,
            "snapshotHash":e.decision.snapshot_hash,"factsHash":e.decision.facts_hash,"policyVersion":e.decision.policy.version,
            "killGeneration":e.decision.kill_revision,"sourceReleaseTarget":"shadow","executionTarget":"OWNED_TESTNET_ONLY",
            "createdAt":e.subject.created_at,"expiresAt":e.subject.expires_at,"executionAuthority":false}),
        )
    }
    pub(crate) fn checkpoint(&self) -> Result<Value, Error> {
        let mut s = self.state.lock().map_err(|_| Error::Unavailable)?;
        if s.immutable_checkpoint.is_none() {
            let mut releases = BTreeMap::new();
            let entries=s.entries.values().map(|e| {
                if let std::collections::btree_map::Entry::Vacant(slot)=releases.entry(e.current.release.content_hash.to_string()) {
                    slot.insert(e.current.release.owner_checkpoint(&self.storage_key.0).map_err(invalid)?);
                }
                Ok::<_,Error>(json!({"subject":e.subject,"record":e.record,"auth":e.auth,"intent":e.intent,"decision":e.decision,
                    "snapshot":e.current.snapshot,"financials":e.current.financials,"venue":e.current.venue,"releaseHash":e.current.release.content_hash}))
            }).collect::<Result<Vec<_>,_>>()?;
            s.immutable_checkpoint = Some(json!({"entries":entries,"releases":releases}));
        }
        // Only immutable, already verified bytes are cached. Every checkpoint
        // still samples the actual risk generation/clock and current revocations.
        let mut v = s
            .immutable_checkpoint
            .as_ref()
            .ok_or(Error::Unavailable)?
            .clone();
        v["risk"] = self.guard.assisted_checkpoint().map_err(invalid)?;
        v["revoked"] = json!(s.revoked);
        Ok(v)
    }

    /// Called only AFTER the service checkpoint MAC has been verified. No
    /// unsigned disk/browser object can reconstruct a private release proof.
    pub(crate) fn restore_authenticated(&self, v: &Value) -> Result<(), Error> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Saved {
            subject: Subject,
            record: TradeProposalRecord,
            auth: AuthContext,
            intent: TradeIntent,
            decision: GuardDecision,
            snapshot: RiskInputSnapshot,
            financials: AccountFinancials,
            venue: VenueState,
            #[serde(rename = "releaseHash")]
            release_hash: ContentHash,
        }
        let immutable = json!({"entries":v["entries"],"releases":v["releases"]});
        let revoked: BTreeSet<ProposalId> =
            serde_json::from_value(v["revoked"].clone()).map_err(invalid)?;
        {
            let mut s = self.state.lock().map_err(|_| Error::Unavailable)?;
            if s.immutable_checkpoint.as_ref() == Some(&immutable) {
                // Outer approval MAC has already passed; the risk checkpoint is
                // still authenticated and checked for rollback on every read.
                self.guard
                    .restore_assisted_checkpoint(&v["risk"])
                    .map_err(invalid)?;
                s.revoked.extend(revoked);
                return Ok(());
            }
        }
        let rows: Vec<Saved> = serde_json::from_value(v["entries"].clone()).map_err(invalid)?;

        if rows.len() > 4096 {
            return Err(Error::Invalid);
        }
        let mut entries = BTreeMap::new();
        let mut ids = BTreeSet::new();
        let releases: BTreeMap<String, Value> =
            serde_json::from_value(v["releases"].clone()).map_err(invalid)?;
        let releases = releases
            .into_iter()
            .map(|(key, value)| {
                let r = StrategyRelease::from_owner_checkpoint(value, &self.storage_key.0)
                    .map_err(invalid)?;
                if r.content_hash.to_string() != key {
                    return Err(Error::Invalid);
                }
                Ok((key, r))
            })
            .collect::<Result<BTreeMap<_, _>, Error>>()?;
        for r in rows {
            let e = Entry {
                subject: r.subject,
                record: r.record,
                auth: r.auth,
                intent: r.intent,
                decision: r.decision,
                current: CurrentRiskSources {
                    snapshot: r.snapshot,
                    financials: r.financials,
                    venue: r.venue,
                    release: releases
                        .get(&r.release_hash.to_string())
                        .ok_or(Error::Invalid)?
                        .clone(),
                },
            };
            // Current facts may intentionally be revoked/stale; restore must keep
            // them denied, not reject their read-only historical facts or renew them.
            self.guard.verify_decision(&e.decision).map_err(invalid)?;
            if !ids.insert(e.record.proposal_id.clone())
                || entries.insert(e.subject.id, e).is_some()
            {
                return Err(Error::Conflict);
            }
        }
        let mut s = self.state.lock().map_err(|_| Error::Unavailable)?;
        self.guard
            .restore_assisted_checkpoint(&v["risk"])
            .map_err(invalid)?;
        s.entries = entries;
        s.immutable_checkpoint = Some(immutable);
        s.revoked.extend(revoked);
        Ok(())
    }
}
