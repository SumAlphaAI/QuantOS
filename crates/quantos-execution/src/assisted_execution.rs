//! CORE:L03 explicit native composition. No Paper-mode impersonation and no
//! public command deserialization. Only the service's locked two-person check
//! can issue a command. All IO passes through the existing X04/L01 boundary.
use crate::{OrderIntent, TradeCommand, VenueKind, assisted::*, gateway::*};
use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, Mac};
use quantos_core::{CommandId, ContentHash, ProposalId, canonical_json_bytes};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::Sha256;
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};
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
}
#[derive(Serialize, Deserialize)]
struct Issued {
    key: String,
    completed: bool,
    issued_at: DateTime<Utc>,
    receipt: CommandReceipt,
}
struct Inner<K: ExecutionKernel> {
    approvals: AssistedApprovalService,
    gateway: ExecutionGateway<K>,
    issued: BTreeMap<ProposalId, Issued>,
    proposal_claims: BTreeMap<ContentHash, ProposalId>,
    key: [u8; 32],
    durable: Option<crate::durable::DurableStore>,
    poisoned: bool,
    killed: bool,
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
            key,
            durable: None,
            poisoned: false,
            killed: false,
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
    pub fn submit(
        &self,
        session: &str,
        request: ProposalId,
        key: &str,
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
                |subject, approval, deadline, now| {
                    if state.killed {
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
                    if state.proposal_claims.contains_key(&subject.proposal_hash) {
                        return Err(Error::Conflict);
                    }
                    if state.issued.len() >= 4096 {
                        return Err(Error::Unavailable);
                    }
                    let id = CommandId::new();
                    let expires = (now + Duration::seconds(30)).min(deadline);
                    let bytes = canonical_json_bytes(&json!([
                        "core-l03-native-command/v1",
                        request,
                        approval,
                        subject,
                        id,
                        expires
                    ]))
                    .map_err(|_| Error::Invalid)?;
                    let mut mac =
                        Hmac::<Sha256>::new_from_slice(&state.key).map_err(|_| Error::Invalid)?;
                    mac.update(&bytes);
                    let signature = hex::encode(mac.finalize().into_bytes());
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
                    };
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
        Ok(s.issued.values().map(|i|json!({"requestId":i.receipt.request_id,"commandId":i.receipt.command_id,"subjectHash":i.receipt.subject_hash,"issuedAt":i.issued_at,"completed":i.completed,"state":i.receipt.state,"orderId":i.receipt.order.as_ref().map(|o|&o.order_id)})).collect())
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
    Ok(json!({"issued":state.issued,"claims":state.proposal_claims,"killed":state.killed}))
}
fn load<K: ExecutionKernel>(
    state: &mut Inner<K>,
    v: Option<serde_json::Value>,
) -> Result<(), Error> {
    if let Some(v) = v {
        state.killed = v["killed"].as_bool().ok_or(Error::Unavailable)?;
        if state.killed {
            state.gateway.engage_kill_switch();
        }
        state.issued =
            serde_json::from_value(v["issued"].clone()).map_err(|_| Error::Unavailable)?;
        state.proposal_claims =
            serde_json::from_value(v["claims"].clone()).map_err(|_| Error::Unavailable)?;
    } else if !state.issued.is_empty() {
        return Err(Error::Unavailable);
    }
    Ok(())
}
