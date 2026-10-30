//! CORE:L03 explicit native composition. No Paper-mode impersonation and no
//! public command deserialization. Only the service's locked two-person check
//! can issue a command. All IO passes through the existing X04/L01 boundary.
use crate::{OrderIntent, TradeCommand, VenueKind, assisted::*, gateway::*};
use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, Mac};
use quantos_core::{CommandId, ContentHash, ProposalId, canonical_json_bytes};
use quantos_risk::guard::NativeRiskContext;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::Sha256;
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};
/// Immutable exact current-risk reservation. It is evidence, never a public IO token.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CurrentExecutionBinding {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub market_provenance: Option<quantos_portfolio::market_provenance::Summary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub books: Option<quantos_portfolio::books_risk::BooksRiskInput>,
    pub snapshot_hash: ContentHash,
    pub ledger_hash: ContentHash,
    pub source_hash: ContentHash,
    pub source_version: u64,
    pub kill_generation: String,
    pub decision_id: quantos_core::DecisionId,
    pub proposal_hash: ContentHash,
    pub activation: crate::assisted_activation::RuntimeActivation,
    pub notional: String,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CommandReceipt {
    pub request_id: ProposalId,
    pub subject_hash: ContentHash,
    pub command_id: CommandId,
    pub expires_at: DateTime<Utc>,
    pub state: String,
    pub order: Option<GatewayOrder>,
    pub signature: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_risk: Option<CurrentExecutionBinding>,
}
#[derive(Serialize, Deserialize)]
struct Issued {
    key: String,
    completed: bool,
    issued_at: DateTime<Utc>,
    receipt: CommandReceipt,
    #[serde(default)]
    subject: Option<Subject>,
    #[serde(default)]
    evidence: Option<crate::execution_facts::CommandFacts>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    approval: Option<Receipt>,
}
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct NativeControl {
    generation: u64,
    active: bool,
}
struct Inner<K: ExecutionKernel> {
    approvals: AssistedApprovalService,
    gateway: ExecutionGateway<K>,
    issued: BTreeMap<ProposalId, Issued>,
    proposal_claims: BTreeMap<ContentHash, ProposalId>,
    snapshot_claims: BTreeMap<ContentHash, ProposalId>,
    key: [u8; 32],
    durable: Option<crate::durable::DurableStore>,
    poisoned: bool,
    killed: bool,
    control: NativeControl,
    activation: Option<crate::assisted_activation::RuntimeActivation>,
}
impl<K: ExecutionKernel> Drop for Inner<K> {
    fn drop(&mut self) {
        zeroize::Zeroize::zeroize(&mut self.key);
    }
}
/// Clones share the command reservation, native gateway and approval authority.
/// No method exposes a gateway, signing key, mutable command or restore API.
pub struct AssistedExecution<K: ExecutionKernel>(Arc<Mutex<Inner<K>>>);
impl<K: ExecutionKernel> Clone for AssistedExecution<K> {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}
impl<K: ExecutionKernel> AssistedExecution<K> {
    pub fn new(
        approvals: AssistedApprovalService,
        limits: GatewayLimits,
        kernel: K,
        key: [u8; 32],
    ) -> Result<Self, Error> {
        if key.iter().all(|b| *b == 0) {
            return Err(Error::Invalid);
        }
        Ok(Self(Arc::new(Mutex::new(Inner {
            approvals,
            gateway: ExecutionGateway::new(limits, kernel),
            issued: BTreeMap::new(),
            proposal_claims: BTreeMap::new(),
            snapshot_claims: BTreeMap::new(),
            key,
            durable: None,
            poisoned: false,
            killed: false,
            control: NativeControl::default(),
            activation: None,
        }))))
    }
    /// Owner-only wiring. The store must be shared by every local replica.
    pub fn with_durable(self, store: crate::durable::DurableStore) -> Result<Self, Error> {
        {
            let mut state = self.0.lock().map_err(|_| Error::Unavailable)?;
            state.durable = Some(store);
        }
        Ok(self)
    }
    /// Trusted emergency stop. It survives local process recovery and has no
    /// automatic reset path; read-only facts remain inspectable.
    pub fn engage_kill_switch(&self) -> Result<(), Error> {
        let mut state = self.0.lock().map_err(|_| Error::Unavailable)?;
        let durable = state.durable.take();
        let result = (|| {
            let tx = durable.as_ref().map(|s| s.lock()).transpose()?;
            if let Some(tx) = &tx {
                load(&mut state, tx.read()?)?;
            }
            state.killed = true;
            state.gateway.engage_kill_switch();
            if let Some(tx) = &tx {
                tx.write(&checkpoint(&state)?)?;
            }
            Ok(())
        })();
        state.durable = durable;
        result
    }
    /// Trusted owner synchronization only, after the signed current risk/control
    /// decision has committed. Does not reset emergency stop, issued commands,
    /// reservations, signatures, expiry, or UNKNOWN evidence.
    pub fn apply_kill_control(&self, generation: u64, active: bool) -> Result<(), Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let store = s.durable.take();
        let result = (|| {
            let tx = store.as_ref().map(|v| v.lock()).transpose()?;
            if let Some(t) = &tx {
                load(&mut s, t.read()?)?;
            }
            if generation < s.control.generation
                || generation == s.control.generation && active != s.control.active
            {
                return Err(Error::Conflict);
            }
            if generation == s.control.generation {
                return Ok(());
            }
            s.control = NativeControl { generation, active };
            if let Some(t) = &tx {
                t.write(&checkpoint(&s)?)?;
            }
            Ok(())
        })();
        s.durable = store;
        result
    }
    /// Trusted durable C11 synchronization. Does not alter kill generation,
    /// permanent stops, proposals, command identities, or UNKNOWN facts.
    pub fn apply_runtime_activation(
        &self,
        next: crate::assisted_activation::RuntimeActivation,
    ) -> Result<(), Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let store = s.durable.take();
        let result = (|| {
            let tx = store.as_ref().map(|v| v.lock()).transpose()?;
            if let Some(t) = &tx {
                load(&mut s, t.read()?)?;
            }
            next.advances(&s.activation)?;
            if s.activation.as_ref() == Some(&next) {
                return Ok(());
            }
            s.activation = Some(next);
            if let Some(t) = &tx {
                t.write(&checkpoint(&s)?)?;
            }
            Ok(())
        })();
        s.durable = store;
        result
    }
    /// Immutable reservation anchor lets the owner refuse missing/rolled-back
    /// commands on a cold restart before synchronizing any control state.
    pub fn control_status(&self) -> Result<serde_json::Value, Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let store = s.durable.take();
        let result = (|| {
            let stored = store
                .as_ref()
                .map(|v| v.lock()?.read())
                .transpose()?
                .flatten();
            if store.is_some() {
                load(&mut s, stored.clone())?;
            }
            let anchor = ContentHash::sha256_bytes(
                &canonical_json_bytes(&if s.snapshot_claims.is_empty() {
                    json!([
                        "quantos-native-reservation-anchor/v1",
                        s.issued,
                        s.proposal_claims
                    ])
                } else {
                    json!([
                        "quantos-native-reservation-anchor/v1",
                        s.issued,
                        s.proposal_claims,
                        s.snapshot_claims
                    ])
                })
                .map_err(|_| Error::Unavailable)?,
            );
            let mut reservations = BTreeMap::new();
            for (id, issued) in &s.issued {
                reservations.insert(
                    format!("issued:{id}"),
                    ContentHash::sha256_bytes(
                        &canonical_json_bytes(&json!(issued)).map_err(|_| Error::Unavailable)?,
                    ),
                );
            }
            for (proposal, request) in &s.proposal_claims {
                reservations.insert(
                    format!("claim:{proposal}"),
                    ContentHash::sha256_bytes(request.to_string().as_bytes()),
                );
            }
            for (snapshot, request) in &s.snapshot_claims {
                reservations.insert(
                    format!("snapshot:{snapshot}"),
                    ContentHash::sha256_bytes(request.to_string().as_bytes()),
                );
            }
            Ok(
                json!({"snapshotClaims":s.snapshot_claims,"activation":s.activation,"reservations":reservations,"generation":s.control.generation,"active":s.control.active,"permanentStop":s.killed,"stopped":s.killed||s.control.active,"initialized":stored.is_some(),"reservationAnchor":anchor,"issuedCount":s.issued.len(),"unknownCount":s.issued.values().filter(|r|r.receipt.state=="unknown").count()}),
            )
        })();
        s.durable = store;
        result
    }
    pub fn submit(
        &self,
        session: &str,
        request: ProposalId,
        key: &str,
        clock: impl ClockInput,
    ) -> Result<CommandReceipt, Error> {
        self.submit_checked(session, request, key, None, clock)
    }
    /// Owner-only exact current snapshot. Caller holds authenticated valuation,
    /// account-books publisher and ledger locks through reservation/IO. Public
    /// clients cannot supply this context.
    pub fn submit_current(
        &self,
        session: &str,
        request: ProposalId,
        key: &str,
        current: &NativeRiskContext,
        clock: impl ClockInput,
    ) -> Result<CommandReceipt, Error> {
        self.submit_checked(session, request, key, Some(current), clock)
    }
    fn submit_checked(
        &self,
        session: &str,
        request: ProposalId,
        key: &str,
        current: Option<&NativeRiskContext>,
        clock: impl ClockInput,
    ) -> Result<CommandReceipt, Error> {
        if key.is_empty() || key.len() > 128 {
            return Err(Error::Invalid);
        }
        let mut state = self.0.lock().map_err(|_| Error::Unavailable)?;
        if state.poisoned {
            return Err(Error::Unavailable);
        }
        // Separate the lock owner from the mutable fields without ever dropping
        // the OS lock across reservation, IO and result persistence.
        let durable = state.durable.take();
        let result = (|| {
            let transaction = durable.as_ref().map(|s| s.lock()).transpose()?;
            if let Some(tx) = &transaction {
                load(&mut state, tx.read()?)?;
            }
            let service = state.approvals.clone();
            service.with_execution(
                session,
                request,
                clock,
                |subject, approval, deadline, now, signed_context, current_activation| {
                    if state.killed
                        || state.control.active
                        || state.activation.as_ref().is_some_and(|a| !a.effective(now))
                    {
                        return Err(Error::Disabled);
                    }
                    if let Some(old) = state.issued.get(&request) {
                        if old.key != key {
                            return Err(Error::Conflict);
                        }
                        if now >= old.receipt.expires_at {
                            return Err(Error::Expired);
                        }
                        return Ok(old.receipt.clone()); // no resubmit, including unknown
                    }
                    // Never let the legacy interface execute a current-risk Subject.
                    // Equality includes ledger bytes, authenticated input, original
                    // scope/generation and half-open source deadline, not just a hash.
                    let binding = match (signed_context, current) {
                        (None, None) => None,
                        (Some(signed), Some(current)) if &signed == current => {
                            if current.snapshot.kill_generation
                                != state.control.generation.to_string()
                                || now >= current.snapshot.expires_at
                            {
                                return Err(Error::PolicyChanged);
                            }
                            let activation = state.activation.clone().ok_or(Error::Disabled)?;
                            if Some(&activation) != current_activation || !activation.effective(now)
                            {
                                return Err(Error::Disabled);
                            }
                            if state
                                .snapshot_claims
                                .contains_key(&current.snapshot.snapshot_hash)
                            {
                                return Err(Error::Conflict);
                            }
                            use std::str::FromStr;
                            let notional = rust_decimal::Decimal::from_str(&subject.quantity)
                                .map_err(|_| Error::Invalid)?
                                .checked_mul(
                                    rust_decimal::Decimal::from_str(&subject.limit_price)
                                        .map_err(|_| Error::Invalid)?,
                                )
                                .ok_or(Error::Invalid)?;
                            Some(CurrentExecutionBinding {
                                market_provenance: current.snapshot.market_provenance.clone(),
                                books: current.books.clone(),
                                snapshot_hash: current.snapshot.snapshot_hash.clone(),
                                ledger_hash: current.snapshot.ledger_hash.clone(),
                                source_hash: current.snapshot.source_hash.clone(),
                                source_version: current.snapshot.source_version,
                                kill_generation: current.snapshot.kill_generation.clone(),
                                decision_id: subject.decision,
                                proposal_hash: subject.proposal_hash.clone(),
                                activation,
                                notional: notional.normalize().to_string(),
                            })
                        }
                        _ => return Err(Error::PolicyChanged),
                    };
                    if state.proposal_claims.contains_key(&subject.proposal_hash) {
                        return Err(Error::Conflict);
                    }
                    if state.issued.len() >= 4096 {
                        return Err(Error::Unavailable);
                    }
                    let id = CommandId::new();
                    let expires = (now + Duration::seconds(30)).min(deadline).min(
                        state
                            .activation
                            .as_ref()
                            .map(|a| a.valid_until)
                            .unwrap_or(deadline),
                    );
                    let signature = command_signature(
                        &state.key,
                        request,
                        approval,
                        subject,
                        id,
                        expires,
                        binding.as_ref(),
                    )?;
                    let command = TradeCommand {
                        command_id: id,
                        decision_id: subject.decision,
                        account_id: subject.scope.account.to_string(),
                        venue: subject.venue.clone(),
                        venue_kind: VenueKind::Cex,
                        symbol: subject.symbol.clone(),
                        intent: OrderIntent::Limit,
                        side: subject.side,
                        quantity: subject.quantity.clone(),
                        limit_price: Some(subject.limit_price.clone()),
                        stop_price: None,
                        idempotency_key: id.to_string(),
                        approval_signature: Some(signature.clone()),
                        expires_at: expires,
                        signature: ContentHash::parse(&format!("sha256:{signature}"))
                            .map_err(|_| Error::Invalid)?,
                        issued_at: now,
                    };
                    // Validate before reservation; once native IO begins, every failure is
                    // unknown, retains the same command and can never trigger a new POST.
                    state
                        .gateway
                        .validate_command(&command, now)
                        .map_err(|_| Error::Invalid)?;
                    let receipt = CommandReceipt {
                        request_id: request,
                        subject_hash: approval.subject_hash.clone(),
                        command_id: id,
                        expires_at: expires,
                        state: "unknown".into(),
                        order: None,
                        signature,
                        current_risk: binding.clone(),
                    };
                    if let Some(b) = &binding {
                        state
                            .snapshot_claims
                            .insert(b.snapshot_hash.clone(), request);
                    }
                    state
                        .proposal_claims
                        .insert(subject.proposal_hash.clone(), request);
                    state.issued.insert(
                        request,
                        Issued {
                            key: key.into(),
                            completed: false,
                            issued_at: command.issued_at,
                            receipt,
                            subject: Some(subject.clone()),
                            evidence: None,
                            approval: Some(approval.clone()),
                        },
                    );
                    if let Some(tx) = &transaction {
                        tx.write(&checkpoint(&state)?)?;
                    }
                    let result = state.gateway.submit(&command, now);
                    let collected = state.gateway.try_collect_events();
                    let order = state
                        .gateway
                        .facts()
                        .iter()
                        .find(|f| f.command_id == id.to_string())
                        .and_then(|f| state.gateway.order(&f.order_id))
                        .cloned();
                    let evidence =
                        crate::execution_facts::CommandFacts::capture(&state.gateway, id)?;
                    let receipt = &mut state
                        .issued
                        .get_mut(&request)
                        .ok_or(Error::Unavailable)?
                        .receipt;
                    receipt.order = order;
                    if result.is_ok() && collected.is_ok() {
                        receipt.state = "accepted".into();
                    }
                    let result = receipt.clone();
                    state
                        .issued
                        .get_mut(&request)
                        .ok_or(Error::Unavailable)?
                        .evidence = evidence;

                    state
                        .issued
                        .get_mut(&request)
                        .ok_or(Error::Unavailable)?
                        .completed = true;
                    if let Some(tx) = &transaction
                        && tx.write(&checkpoint(&state)?).is_err()
                    {
                        state.poisoned = true;
                        return Err(Error::Unavailable);
                    }
                    Ok(result)
                },
            )
        })();
        state.durable = durable;
        result
    }
    pub fn inspect(
        &self,
        session: &str,
        request: ProposalId,
        clock: impl ClockInput,
    ) -> Result<Option<CommandReceipt>, Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let durable = s.durable.take();
        let loaded = (|| {
            if let Some(store) = &durable {
                let tx = store.lock()?;
                load(&mut s, tx.read()?)?;
            }
            Ok::<_, Error>(())
        })();
        s.durable = durable;
        loaded?;
        s.approvals.execution_view(session, request, clock)?;
        Ok(s.issued.get(&request).map(|i| i.receipt.clone()))
    }
    /// Current authenticated read of original durable observations. No IO,
    /// reservation, expiry renewal or venue query can occur through this path.
    pub fn execution_facts(
        &self,
        session: &str,
        request: ProposalId,
        clock: impl ClockInput,
    ) -> Result<Option<crate::execution_facts::ExecutionFacts>, Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let durable = s.durable.take();
        let result = (|| {
            if let Some(store) = &durable {
                let tx = store.lock()?;
                load(&mut s, tx.read()?)?;
            }
            let approval = s.approvals.execution_view(session, request, clock)?;
            let Some(i) = s.issued.get(&request) else {
                return Ok(None);
            };
            if approval.subject_hash != i.receipt.subject_hash {
                return Err(Error::Unavailable);
            }
            let Some(subject) = i.subject.as_ref() else {
                return Ok(None);
            }; // legacy evidence absent, never fabricate fills
            crate::execution_facts::project(
                subject,
                request,
                i.receipt.subject_hash.clone(),
                i.receipt.command_id,
                &i.receipt.state,
                i.issued_at,
                i.evidence.as_ref(),
            )
            .map(Some)
        })();
        s.durable = durable;
        result
    }
    /// Trusted C10 projection. Never exposes the private executable command.
    pub fn audit_facts(&self) -> Result<Vec<serde_json::Value>, Error> {
        let mut s = self.0.lock().map_err(|_| Error::Unavailable)?;
        let durable = s.durable.take();
        let loaded = (|| {
            if let Some(store) = &durable {
                let tx = store.lock()?;
                load(&mut s, tx.read()?)?;
            }
            Ok::<_, Error>(())
        })();
        s.durable = durable;
        loaded?;
        s.issued.values().map(|i| {
            if !s.approvals.matches_execution_binding(i.receipt.request_id,&i.receipt.subject_hash)? {return Err(Error::Unavailable);}
            let facts=i.subject.as_ref().map(|subject| crate::execution_facts::project(subject,i.receipt.request_id,i.receipt.subject_hash.clone(),i.receipt.command_id,&i.receipt.state,i.issued_at,i.evidence.as_ref())).transpose()?;
            Ok(json!({"requestId":i.receipt.request_id,"commandId":i.receipt.command_id,"subjectHash":i.receipt.subject_hash,"issuedAt":i.issued_at,"completed":i.completed,"state":i.receipt.state,"orderId":i.receipt.order.as_ref().map(|o|&o.order_id),"currentRisk":i.receipt.current_risk,"executionFactsHash":facts.as_ref().map(|f|&f.source_hash),"fillIds":facts.as_ref().map(|f|f.fills.iter().map(|fill|&fill.fill_id).collect::<Vec<_>>()).unwrap_or_default()}))
        }).collect()
    }
    pub fn submission_count(&self) -> Result<usize, Error> {
        Ok(self
            .0
            .lock()
            .map_err(|_| Error::Unavailable)?
            .gateway
            .downstream_submission_count())
    }
}

fn checkpoint<K: ExecutionKernel>(state: &Inner<K>) -> Result<serde_json::Value, Error> {
    Ok(
        json!({"issued":state.issued,"claims":state.proposal_claims,"snapshotClaims":state.snapshot_claims,"killed":state.killed,"control":state.control,"activation":state.activation}),
    )
}
fn load<K: ExecutionKernel>(
    state: &mut Inner<K>,
    v: Option<serde_json::Value>,
) -> Result<(), Error> {
    if let Some(v) = v {
        let activation: Option<crate::assisted_activation::RuntimeActivation> = v
            .get("activation")
            .map(|v| serde_json::from_value(v.clone()).map_err(|_| Error::Unavailable))
            .transpose()?
            .flatten();
        match (&activation, &state.activation) {
            (Some(a), _) => a.advances(&state.activation)?,
            (None, Some(_)) => return Err(Error::Unavailable),
            _ => (),
        }

        let control = v
            .get("control")
            .map(|v| {
                serde_json::from_value::<NativeControl>(v.clone()).map_err(|_| Error::Unavailable)
            })
            .transpose()?
            .unwrap_or_default();
        if control.generation < state.control.generation
            || control.generation == state.control.generation
                && control.active != state.control.active
        {
            return Err(Error::Conflict);
        }

        let killed = v["killed"].as_bool().ok_or(Error::Unavailable)?;
        if state.killed && !killed {
            return Err(Error::Conflict);
        }
        let issued: BTreeMap<ProposalId, Issued> =
            serde_json::from_value(v["issued"].clone()).map_err(|_| Error::Unavailable)?;
        for (id, old) in &state.issued {
            let next = issued.get(id).ok_or(Error::Conflict)?;
            if old.key != next.key
                || old.issued_at != next.issued_at
                || old.subject != next.subject
                || old.approval != next.approval
                || old.receipt.command_id != next.receipt.command_id
                || old.receipt.signature != next.receipt.signature
                || old.receipt.expires_at != next.receipt.expires_at
                || old.receipt.current_risk != next.receipt.current_risk
                || old.completed
                    && serde_json::to_value(old).map_err(|_| Error::Unavailable)?
                        != serde_json::to_value(next).map_err(|_| Error::Unavailable)?
            {
                return Err(Error::Conflict);
            }
        }
        let claims: BTreeMap<ContentHash, ProposalId> =
            serde_json::from_value(v["claims"].clone()).map_err(|_| Error::Unavailable)?;
        let snapshots: BTreeMap<ContentHash, ProposalId> =
            serde_json::from_value(v.get("snapshotClaims").cloned().unwrap_or(json!({})))
                .map_err(|_| Error::Unavailable)?;
        for (key, id) in &state.proposal_claims {
            if claims.get(key) != Some(id) {
                return Err(Error::Conflict);
            }
        }
        for (key, id) in &state.snapshot_claims {
            if snapshots.get(key) != Some(id) {
                return Err(Error::Conflict);
            }
        }
        for (id, i) in &issued {
            if !matches!(i.receipt.state.as_str(), "accepted" | "unknown")
                || i.receipt.state == "accepted"
                    && (!i.completed || i.subject.is_some() && i.evidence.is_none())
            {
                return Err(Error::Unavailable);
            }
            if i.receipt.request_id != *id {
                return Err(Error::Unavailable);
            }
            if let Some(subject) = &i.subject {
                let hash = ContentHash::sha256_bytes(
                    &canonical_json_bytes(
                        &serde_json::to_value(subject).map_err(|_| Error::Unavailable)?,
                    )
                    .map_err(|_| Error::Unavailable)?,
                );
                if hash != i.receipt.subject_hash {
                    return Err(Error::Unavailable);
                }
                if claims.get(&subject.proposal_hash) != Some(id) {
                    return Err(Error::Unavailable);
                }
                if let Some(binding) = &i.receipt.current_risk {
                    if let Some(b) = &binding.books
                        && (b.scope.tenant_id != subject.scope.tenant
                            || b.scope.workspace_id != subject.scope.workspace
                            || b.scope.account_id != subject.scope.account
                            || b.ledger_hash != binding.ledger_hash
                            || !b.eligible(i.issued_at)
                            || b.deadline()
                                .is_none_or(|until| i.receipt.expires_at > until))
                    {
                        return Err(Error::Unavailable);
                    }
                    let approval = i.approval.as_ref().ok_or(Error::Unavailable)?;
                    if binding.proposal_hash != subject.proposal_hash
                        || binding.decision_id != subject.decision
                        || snapshots.get(&binding.snapshot_hash) != Some(id)
                        || approval.request != *id
                        || approval.subject_hash != hash
                        || i.receipt.expires_at > binding.activation.valid_until
                        || command_signature(
                            &state.key,
                            *id,
                            approval,
                            subject,
                            i.receipt.command_id,
                            i.receipt.expires_at,
                            Some(binding),
                        )? != i.receipt.signature
                    {
                        return Err(Error::Unavailable);
                    }
                }
                if let Some(e) = &i.evidence {
                    e.validate(subject, i.receipt.command_id, i.receipt.order.as_ref())?;
                }
            } else if i.evidence.is_some() {
                return Err(Error::Unavailable);
            }
        }

        if claims.values().any(|id| !issued.contains_key(id))
            || snapshots.iter().any(|(hash, id)| {
                issued
                    .get(id)
                    .and_then(|i| i.receipt.current_risk.as_ref())
                    .is_none_or(|b| &b.snapshot_hash != hash)
            })
        {
            return Err(Error::Unavailable);
        }
        state.activation = activation;
        state.control = control;
        state.killed = killed;
        if killed {
            state.gateway.engage_kill_switch();
        }
        state.issued = issued;
        state.proposal_claims = claims;
        state.snapshot_claims = snapshots;
    } else if !state.issued.is_empty()
        || state.control.generation > 0
        || state.killed
        || state.activation.is_some()
    {
        return Err(Error::Unavailable);
    }
    Ok(())
}

fn command_signature(
    key: &[u8; 32],
    request: ProposalId,
    approval: &Receipt,
    subject: &Subject,
    id: CommandId,
    expires: DateTime<Utc>,
    binding: Option<&CurrentExecutionBinding>,
) -> Result<String, Error> {
    let value = if let Some(binding) = binding {
        json!([
            "core-l04-current-native-command/v1",
            request,
            approval,
            subject,
            id,
            expires,
            binding
        ])
    } else {
        json!([
            "core-l03-native-command/v1",
            request,
            approval,
            subject,
            id,
            expires
        ])
    };
    let bytes = canonical_json_bytes(&value).map_err(|_| Error::Invalid)?;
    let mut mac = Hmac::<Sha256>::new_from_slice(key).map_err(|_| Error::Invalid)?;
    mac.update(&bytes);
    Ok(hex::encode(mac.finalize().into_bytes()))
}
