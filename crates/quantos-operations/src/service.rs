use crate::model::*;
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::ContentHash;
use quantos_execution::{
    authority::{AtomicCommandIssuer, CurrentSources, SignedCommand},
    dispatch::{OrderEvidence, SignedExecutionGateway},
    gateway::ExecutionKernel,
};
use quantos_policy::{Capability, Role, RunMode};
use quantos_portfolio::{
    FillEvent, FillSide, InMemoryPortfolioProjection, PortfolioEvent, PortfolioEventKind,
    RiskInputSnapshot,
};
use quantos_risk::guard::{KillScope, RiskGuard};
use serde::Serialize;
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex, MutexGuard},
};

/// Fixed account backend service. Lock order: service -> gateway -> issuer -> risk.
/// Clones share state and downstream leases. Never supply a credential resolver or
/// arbitrary callback from an untrusted client.
pub struct OperationsService<K: ExecutionKernel> {
    pub(crate) config: Config,
    pub(crate) state: Arc<Mutex<State>>,
    issuer: AtomicCommandIssuer,
    guard: RiskGuard,
    gateway: SignedExecutionGateway<K>,
}
impl<K: ExecutionKernel> Clone for OperationsService<K> {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            state: self.state.clone(),
            issuer: self.issuer.clone(),
            guard: self.guard.clone(),
            gateway: self.gateway.clone(),
        }
    }
}
impl<K: ExecutionKernel> OperationsService<K> {
    pub fn new(
        config: Config,
        seed: Vec<PortfolioEvent>,
        issuer: AtomicCommandIssuer,
        guard: RiskGuard,
        gateway: SignedExecutionGateway<K>,
    ) -> Result<Self> {
        if !issuer.scope_matches(config.scope.tenant_id, config.scope.workspace_id)
            || !issuer.uses_risk_guard(&guard)
            || !gateway.uses_issuer(&issuer)
        {
            return Err(Error::Invalid);
        }
        if !matches!(config.scope.mode, RunMode::Paper | RunMode::Shadow)
            || !(16..=4096).contains(&config.max_actions)
            || config.scope.tenant_id.as_uuid().is_nil()
            || config.scope.workspace_id.as_uuid().is_nil()
            || config.scope.account_id.as_uuid().is_nil()
            || config.observer.as_uuid().is_nil()
            || config.quote_unit.is_empty()
            || config.quote_unit.len() > 12
            || !config.quote_unit.bytes().all(|b| b.is_ascii_uppercase())
            || seed.is_empty()
            || seed.len() > 4096
        {
            return Err(Error::Invalid);
        }
        if seed.iter().any(|event| match &event.kind {
            PortfolioEventKind::Fill(f) => f.account_id != config.scope.account_id,
            PortfolioEventKind::AccountStatus(a) => a.account_id != config.scope.account_id,
            _ => false,
        }) {
            return Err(Error::Denied);
        }
        let projection =
            InMemoryPortfolioProjection::rebuild(config.scope.tenant_id, config.started_at, &seed)
                .map_err(|_| Error::Invalid)?;
        let checked_at = seed.last().ok_or(Error::Invalid)?.occurred_at;
        projection
            .risk_snapshot(config.scope.account_id, checked_at, 60)
            .map_err(|_| Error::Invalid)?
            .validate_for(
                config.scope.tenant_id,
                config.scope.account_id,
                checked_at,
                60,
            )
            .map_err(|_| Error::Invalid)?;
        let at = seed.last().ok_or(Error::Invalid)?.occurred_at;
        let state = State {
            schema: "quantos-service-x06-state/v1".into(),
            scope: config.scope.clone(),
            quote_unit: config.quote_unit.clone(),
            seed_hash: hash(&seed)?,
            seed_len: seed.len(),
            events: seed,
            links: vec![],
            orders: BTreeMap::new(),
            operations: BTreeMap::new(),
            pending: BTreeMap::new(),
            audit: vec![],
            at,
            health: None,
            alerts: BTreeMap::new(),
            incidents: BTreeMap::new(),
            resumes: BTreeMap::new(),
        };
        Ok(Self {
            config,
            state: Arc::new(Mutex::new(state)),
            issuer,
            guard,
            gateway,
        })
    }
    pub(crate) fn lock(&self) -> Result<MutexGuard<'_, State>> {
        self.state.lock().map_err(|_| Error::RecoveryRequired)
    }
    pub(crate) fn clock(s: &State, now: DateTime<Utc>) -> Result<()> {
        if now < s.at {
            Err(Error::Stale)
        } else {
            Ok(())
        }
    }
    pub(crate) fn writable(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        now: DateTime<Utc>,
    ) -> Result<()> {
        self.config.scope.authorize(a, OPS_OPERATE)?;
        if !matches!(a.role, Role::Owner | Role::Operator) {
            return Err(Error::Denied);
        }
        step.check(a, now)
    }
    fn trading(&self, a: &AuthContext, step: &VerifiedStepUp, now: DateTime<Utc>) -> Result<()> {
        self.writable(a, step, now)?;
        self.config
            .scope
            .authorize(a, Capability::EXECUTION_OPERATE)
    }
    pub(crate) fn append(
        &self,
        s: &mut State,
        a: quantos_core::ActorId,
        kind: &str,
        id: &ContentHash,
        outcome: Outcome,
        now: DateTime<Utc>,
    ) -> Result<()> {
        if s.audit.len() >= self.config.max_actions {
            return Err(Error::Capacity);
        }
        let mut row = AuditRow {
            sequence: s.audit.len() as u64 + 1,
            actor: a,
            at: now,
            kind: kind.into(),
            subject: id.clone(),
            outcome,
            previous: s.audit.last().map(|r| r.hash.clone()),
            hash: ContentHash::sha256_bytes(b"pending"),
        };
        row.hash = hash(&(
            "service-x06-audit/v1",
            &self.config.scope,
            row.sequence,
            row.actor,
            row.at,
            &row.kind,
            &row.subject,
            &row.outcome,
            &row.previous,
        ))?;
        s.audit.push(row);
        s.at = now;
        Ok(())
    }
    pub(crate) fn begin<T: Serialize + ?Sized>(
        &self,
        s: &mut State,
        a: &AuthContext,
        key: &str,
        kind: &str,
        payload: &T,
        now: DateTime<Utc>,
    ) -> Result<(ContentHash, bool)> {
        identifier(key)?;
        Self::clock(s, now)?;
        let id = hash(&("service-x06-operation/v1", &self.config.scope, key))?;
        let binding = hash(&(kind, a.actor_id, a.user_id, payload))?;
        if let Some(old) = s.operations.get(&id) {
            if old.binding != binding
                || old.actor != a.actor_id
                || old.user != a.user_id.to_string()
            {
                return Err(Error::Conflict);
            }
            return Ok((id, false));
        }
        if s.audit.len() + 3 > self.config.max_actions {
            return Err(Error::Capacity);
        }
        let op = Operation {
            id: id.clone(),
            kind: kind.into(),
            actor: a.actor_id,
            user: a.user_id.to_string(),
            binding,
            outcome: Outcome::Prepared,
            prepared_at: now,
        };
        self.append(s, a.actor_id, kind, &id, Outcome::Prepared, now)?;
        s.operations.insert(id.clone(), op);
        Self::size(s)?;
        Ok((id, true))
    }
    pub(crate) fn finish(
        &self,
        s: &mut State,
        a: &AuthContext,
        id: &ContentHash,
        outcome: Outcome,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        let kind = s.operations.get(id).ok_or(Error::Invalid)?.kind.clone();
        self.append(s, a.actor_id, &kind, id, outcome.clone(), now)?;
        let op = s.operations.get_mut(id).ok_or(Error::Invalid)?;
        op.outcome = outcome;
        let out = op.clone();
        self.sync_local_alert(s)?;
        Ok(out)
    }
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn change<T: Serialize, F>(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        kind: &str,
        payload: &T,
        now: DateTime<Utc>,
        f: F,
    ) -> Result<Operation>
    where
        F: FnOnce(&mut State) -> Result<ContentHash>,
    {
        self.writable(a, step, now)?;
        let mut s = self.lock()?;
        let mut staged = s.clone();
        let (id, new) = self.begin(&mut staged, a, key, kind, payload, now)?;
        if !new {
            return Ok(staged.operations[&id].clone());
        }
        let reference = f(&mut staged)?;
        let out = self.finish(&mut staged, a, &id, Outcome::Applied { reference }, now)?;
        Self::size(&staged)?;
        *s = staged;
        Ok(out)
    }
    fn size(s: &State) -> Result<()> {
        if serde_json::to_vec(s).map_err(|_| Error::Invalid)?.len() > 8 * 1024 * 1024 - 16384 {
            Err(Error::Capacity)
        } else {
            Ok(())
        }
    }
    pub(crate) fn synchronized(&self, s: &State) -> Result<quantos_execution::oms::FactAnchor> {
        let anchor = self.gateway.fact_anchor().ok_or(Error::RecoveryRequired)?;
        let mut facts: Vec<_> = s
            .orders
            .values()
            .flat_map(|r| r.evidence.facts.clone())
            .collect();
        facts.sort_by_key(|f| f.sequence);
        quantos_execution::gateway::ExecutionGateway::<
            quantos_execution::gateway::NautilusBoundaryAdapter,
        >::replay_facts(&facts, &anchor)
        .map_err(|_| Error::RecoveryRequired)?;
        Ok(anchor)
    }
    pub(crate) fn sync_local_alert(&self, s: &mut State) -> Result<()> {
        let active = s
            .operations
            .values()
            .any(|op| op.outcome == Outcome::Uncertain);
        let id = hash(&(
            "service-x06-alert/v1",
            &self.config.scope,
            "execution_uncertain",
        ))?;
        let revision = s.health.as_ref().map_or(0, |h| h.revision);
        if active || s.alerts.contains_key(&id) {
            let row = s.alerts.entry(id.clone()).or_insert(Alert {
                id: id.clone(),
                rule: "execution_uncertain".into(),
                active: false,
                acknowledged: false,
                revision: 0,
                source_revision: revision,
            });
            let recurrent = active && !row.active;
            if row.active != active {
                row.active = active;
                row.revision += 1;
                row.source_revision = revision;
                if active {
                    row.acknowledged = false;
                }
            }
            if recurrent {
                for incident in s.incidents.values_mut().filter(|i| i.alert_id == id) {
                    if incident.status == CaseStatus::Resolved {
                        incident.status = CaseStatus::Open;
                        incident.acknowledged_by = None;
                        incident.acknowledged_user = None;
                        incident.revision += 1;
                        incident.opened_source = revision;
                    }
                }
            }
        }
        Ok(())
    }
    fn projection(&self, s: &State) -> Result<InMemoryPortfolioProjection> {
        InMemoryPortfolioProjection::rebuild(
            self.config.scope.tenant_id,
            self.config.started_at,
            &s.events,
        )
        .map_err(|_| Error::RecoveryRequired)
    }
    pub fn risk_snapshot(&self, a: &AuthContext, now: DateTime<Utc>) -> Result<RiskInputSnapshot> {
        self.config.scope.authorize(a, Capability::ACCOUNT_READ)?;
        let s = self.lock()?;
        Self::clock(&s, now)?;
        self.synchronized(&s)?;
        let snap = self
            .projection(&s)?
            .risk_snapshot(self.config.scope.account_id, now, 60)
            .map_err(|_| Error::Stale)?;
        snap.validate_for(
            self.config.scope.tenant_id,
            self.config.scope.account_id,
            now,
            60,
        )
        .map_err(|_| Error::Stale)?;
        Ok(snap)
    }
    pub fn evidence_chain(
        &self,
        a: &AuthContext,
        command_id: &str,
        now: DateTime<Utc>,
    ) -> Result<EvidenceChain> {
        self.config.scope.authorize(a, Capability::ACCOUNT_READ)?;
        let s = self.lock()?;
        Self::clock(&s, now)?;
        let row = s.orders.get(command_id).ok_or(Error::Denied)?;
        let c = &row.command;
        let mut order = row.evidence.order.clone();
        order.rejection_reason = None; // Free kernel text never enters public evidence.
        Ok(EvidenceChain {
            command_id: command_id.into(),
            proposal_id: c.proposal_id.clone(),
            proposal_hash: c.proposal_hash.clone(),
            decision_id: c.source_decision_id.to_string(),
            risk_snapshot_hash: c.current_risk.snapshot_hash.clone(),
            approval_id: c.approval.as_ref().map(|r| r.id.to_string()),
            approval: c.approval.as_ref().map(|r| ApprovalView {
                id: r.id.to_string(),
                requester: r.requester,
                approver: r.approver,
                state: r.state,
                revision: r.revision,
                consumed_by_command: r.command_id.map(|id| id.to_string()),
                expires_at: r.expires_at,
            }),
            risk_verdict: c.current_risk.verdict.as_str().into(),
            risk_kill_revision: c.current_risk.kill_revision,
            risk_expires_at: c.current_risk.expires_at,
            order,
            order_id: row.evidence.order.order_id.clone(),
            order_status: row.evidence.order.status.clone(),
            fills: row.evidence.fills.clone(),
            facts: row
                .evidence
                .facts
                .iter()
                .map(|f| FactRef {
                    sequence: f.sequence,
                    hash: f.hash.clone(),
                })
                .collect(),
            fill_links: s
                .links
                .iter()
                .filter(|l| l.command_id == command_id)
                .cloned()
                .collect(),
            opening_events_hash: s.seed_hash.clone(),
            portfolio_events_hash: hash(&s.events)?,
            portfolio: self
                .projection(&s)?
                .snapshot(self.config.scope.account_id)
                .map_err(|_| Error::Invalid)?,
            portfolio_source_current: self.synchronized(&s).is_ok(),
            captured_at: row.captured_at,
        })
    }
    pub fn audit(
        &self,
        a: &AuthContext,
        after: u64,
        limit: usize,
        head: Option<&ContentHash>,
    ) -> Result<AuditPage> {
        self.config.scope.authorize(a, AUDIT_READ)?;
        if !(1..=100).contains(&limit) {
            return Err(Error::Invalid);
        }
        let s = self.lock()?;
        if let Some(h) = head
            && s.audit.last().map(|r| &r.hash) != Some(h)
        {
            return Err(Error::Conflict);
        }
        Ok(AuditPage {
            rows: s
                .audit
                .iter()
                .filter(|r| r.sequence > after)
                .take(limit)
                .cloned()
                .collect(),
            head: s.audit.last().map(|r| r.hash.clone()),
            total: s.audit.len() as u64,
        })
    }
    pub fn operation(&self, a: &AuthContext, id: &ContentHash) -> Result<Operation> {
        self.config.scope.authorize(a, OPS_READ)?;
        self.lock()?
            .operations
            .get(id)
            .cloned()
            .ok_or(Error::Denied)
    }

    /// Explicit prepare enables a host to persist a checkpoint before bounded I/O.
    /// Restoration quarantines Prepared; it never blindly re-executes this intent.
    pub fn prepare_submit(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        command: &SignedCommand,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.trading(a, step, now)?;
        if self.config.scope.mode != RunMode::Paper {
            return Err(Error::Denied);
        }
        if command.intent.account_id != self.config.scope.account_id {
            return Err(Error::Denied);
        }
        self.issuer
            .verify_command(a, command, now)
            .map_err(|_| Error::Denied)?;
        let mut s = self.lock()?;
        let mut staged = s.clone();
        let (id, new) = self.begin(&mut staged, a, key, "submit", command, now)?;
        if new {
            if staged.pending.iter().any(|(old, c)| {
                c.command_id == command.command_id
                    && staged.operations[old].outcome != Outcome::Rejected
            }) {
                return Err(Error::Conflict);
            }
            staged.pending.insert(id.clone(), command.clone());
            Self::size(&staged)?;
            *s = staged;
        }
        Ok(s.operations[&id].clone())
    }
    pub fn dispatch_prepared(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        id: &ContentHash,
        sources: CurrentSources<'_>,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.trading(a, step, now)?;
        let mut s = self.lock()?;
        Self::clock(&s, now)?;
        let op = s.operations.get(id).ok_or(Error::Denied)?.clone();
        if op.kind != "submit" || op.actor != a.actor_id || op.user != a.user_id.to_string() {
            return Err(Error::Denied);
        }
        let command = s.pending.get(id).ok_or(Error::Invalid)?.clone();
        if matches!(op.outcome, Outcome::Uncertain | Outcome::Rejected) {
            return Err(Error::RecoveryRequired);
        }
        let anchor = self.synchronized(&s)?;
        let portfolio = self
            .projection(&s)?
            .snapshot(self.config.scope.account_id)
            .map_err(|_| Error::Invalid)?;
        if sources.snapshot.portfolio != portfolio
            || sources.financials.quote_unit != self.config.quote_unit
        {
            return Err(Error::Stale);
        }
        if matches!(op.outcome, Outcome::Applied { .. }) {
            self.gateway
                .validate_current_at_anchor(a, &command, sources, &anchor, now)
                .map_err(|_| Error::Denied)?;
            return Ok(op);
        }
        if s.audit.len() + 2 > self.config.max_actions {
            return Err(Error::Capacity);
        }
        let mut staged = s.clone();
        let result = self
            .gateway
            .submit_at_anchor(a, &command, sources, &anchor, now);
        let outcome = if result.is_ok() {
            match self
                .gateway
                .inspect_order(a, &command, now)
                .ok()
                .and_then(|e| self.capture(&mut staged, &command, e, now).ok())
            {
                Some(reference) => Outcome::Applied { reference },
                None => {
                    staged = s.clone();
                    Outcome::Uncertain
                }
            }
        } else {
            match result {
                Err(quantos_execution::dispatch::DispatchError::Command(_)) => Outcome::Rejected,
                Err(quantos_execution::dispatch::DispatchError::Gateway(
                    quantos_execution::gateway::GatewayError::BoundaryRejected { .. },
                )) => Outcome::Rejected,
                _ => Outcome::Uncertain,
            }
        };
        let outcome = if Self::size(&staged).is_err() {
            staged = s.clone();
            Outcome::Uncertain
        } else {
            outcome
        };
        let operation = self.finish(&mut staged, a, id, outcome, now)?;
        *s = staged;
        Ok(operation)
    }
    pub fn recover_order(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        id: &ContentHash,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.trading(a, step, now)?;
        self.change(a, step, key, "recover_order", id, now, |s| {
            let original = s.operations.get(id).ok_or(Error::Denied)?;
            if original.actor != a.actor_id
                || original.user != a.user_id.to_string()
                || !matches!(original.kind.as_str(), "submit" | "cancel")
            {
                return Err(Error::Denied);
            }
            let cancel_recovery = original.kind == "cancel";
            let command = s.pending.get(id).ok_or(Error::Invalid)?.clone();
            let evidence = self
                .gateway
                .refresh_order(a, &command, now)
                .map_err(|_| Error::RecoveryRequired)?;
            if cancel_recovery
                && !matches!(
                    evidence.order.status.as_str(),
                    "cancelled" | "filled" | "expired" | "rejected"
                )
            {
                return Err(Error::RecoveryRequired);
            }
            let reference = self.capture(s, &command, evidence, now)?;
            if matches!(
                s.operations[id].outcome,
                Outcome::Prepared | Outcome::Uncertain
            ) {
                s.operations.get_mut(id).ok_or(Error::Invalid)?.outcome = Outcome::Applied {
                    reference: reference.clone(),
                };
            }
            self.append(
                s,
                a.actor_id,
                "recover_original",
                id,
                Outcome::Applied {
                    reference: reference.clone(),
                },
                now,
            )?;
            Ok(reference)
        })
    }
    pub fn cancel(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        command_id: &str,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.trading(a, step, now)?;
        // Reserve before external I/O; failures are uncertain, never automatic retries.
        let mut s = self.lock()?;
        let command = s
            .orders
            .get(command_id)
            .ok_or(Error::Denied)?
            .command
            .clone();
        if command.requester != a.actor_id {
            return Err(Error::Denied);
        }
        self.gateway
            .inspect_order(a, &command, now)
            .map_err(|_| Error::Denied)?;
        let mut staged = s.clone();
        let (id, new) = self.begin(&mut staged, a, key, "cancel", command_id, now)?;
        if !new {
            return Ok(staged.operations[&id].clone());
        }
        if new
            && staged.operations.values().any(|op| {
                op.id != id
                    && op.kind == "cancel"
                    && matches!(op.outcome, Outcome::Prepared | Outcome::Uncertain)
                    && staged
                        .pending
                        .get(&op.id)
                        .is_some_and(|c| c.command_id == command.command_id)
            })
        {
            return Err(Error::RecoveryRequired);
        }
        staged.pending.insert(id.clone(), command.clone());
        Self::size(&staged)?;
        *s = staged.clone();
        let outcome = match self.gateway.cancel(a, &command, id.as_str(), now) {
            Ok(receipt) => {
                if let Ok(evidence) = self.gateway.inspect_order(a, &command, now) {
                    if self.capture(&mut staged, &command, evidence, now).is_ok() {
                        Outcome::Applied {
                            reference: hash(&receipt)?,
                        }
                    } else {
                        staged = s.clone();
                        Outcome::Uncertain
                    }
                } else {
                    Outcome::Uncertain
                }
            }
            Err(_) => Outcome::Uncertain,
        };
        let outcome = if Self::size(&staged).is_err() {
            staged = s.clone();
            Outcome::Uncertain
        } else {
            outcome
        };
        let operation = self.finish(&mut staged, a, &id, outcome, now)?;
        *s = staged;
        Ok(operation)
    }
    fn fill_event(&self, record: &OrderRecord, link: &FillLink) -> Result<PortfolioEvent> {
        let fill = record
            .evidence
            .fills
            .iter()
            .find(|f| f.fill_id == link.fill_id)
            .ok_or(Error::Invalid)?;
        let positive = |s: &str| -> Result<f64> {
            let n = s.parse::<f64>().map_err(|_| Error::Invalid)?;
            if n.is_finite() && n > 0.0 {
                Ok(n)
            } else {
                Err(Error::Invalid)
            }
        };
        let fee = fill.fee_amount.parse::<f64>().map_err(|_| Error::Invalid)?;
        if !fee.is_finite()
            || fee < 0.0
            || (fee > 0.0 && fill.fee_currency != self.config.quote_unit)
        {
            return Err(Error::Invalid);
        }
        Ok(PortfolioEvent {
            event_id: link.event_id.clone(),
            sequence: link.sequence,
            occurred_at: fill.filled_at,
            kind: PortfolioEventKind::Fill(FillEvent {
                account_id: self.config.scope.account_id,
                symbol: fill.symbol.clone(),
                side: if record.evidence.order.side == "buy" {
                    FillSide::Buy
                } else if record.evidence.order.side == "sell" {
                    FillSide::Sell
                } else {
                    return Err(Error::Invalid);
                },
                quantity: positive(&fill.quantity)?,
                price: positive(&fill.price)?,
                fee,
            }),
        })
    }
    fn capture(
        &self,
        s: &mut State,
        command: &SignedCommand,
        evidence: OrderEvidence,
        now: DateTime<Utc>,
    ) -> Result<ContentHash> {
        let id = command.command_id.to_string();
        if evidence.order.command_id != id
            || evidence.order.account_id != self.config.scope.account_id.to_string()
            || !matches!(
                evidence.order.status.as_str(),
                "accepted" | "partially_filled" | "filled" | "cancelled" | "expired" | "rejected"
            )
            || evidence.fills.len() > 1024
            || evidence.facts.is_empty()
            || evidence.facts.len() > 4096
            || evidence.fills.iter().any(|f| {
                f.command_id != id || f.order_id != evidence.order.order_id || f.filled_at > now
            })
            || evidence
                .facts
                .iter()
                .any(|f| f.command_id != id || f.order_id != evidence.order.order_id)
        {
            return Err(Error::Invalid);
        }
        let record = OrderRecord {
            command: command.clone(),
            evidence,
            captured_at: now,
        };
        let mut projection = self.projection(s)?;
        for fill in &record.evidence.fills {
            if let Some(old) = s.links.iter().find(|l| l.fill_id == fill.fill_id) {
                if old.command_id != id {
                    return Err(Error::Conflict);
                }
                let old_record = s.orders.get(&id).ok_or(Error::Invalid)?;
                if old_record
                    .evidence
                    .fills
                    .iter()
                    .find(|f| f.fill_id == fill.fill_id)
                    != Some(fill)
                {
                    return Err(Error::Conflict);
                }
                continue;
            }
            if s.events.len() >= 8192 {
                return Err(Error::Capacity);
            }
            let event_id = hash(&(
                "service-x06-fill-event/v1",
                &self.config.scope,
                &fill.fill_id,
            ))?
            .to_string();
            let link = FillLink {
                command_id: id.clone(),
                fill_id: fill.fill_id.clone(),
                event_id,
                sequence: projection.last_sequence() + 1,
            };
            let event = self.fill_event(&record, &link)?;
            projection.apply(&event).map_err(|_| Error::Invalid)?;
            s.events.push(event);
            s.links.push(link);
        }
        let reference = hash(&record.evidence)?;
        s.orders.insert(id, record);
        Ok(reference)
    }
    pub fn engage_kill(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        revision: u64,
        reason: &str,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.trading(a, step, now)?;
        if reason.trim().is_empty() || reason.len() > 256 {
            return Err(Error::Invalid);
        }
        self.change(
            a,
            step,
            key,
            "engage_kill",
            &(revision, hash(reason)?),
            now,
            |_| {
                // Only the fixed account; no user-supplied global/account selector.
                let receipt = self
                    .guard
                    .set_kill_switch(
                        a,
                        KillScope::Account(self.config.scope.account_id),
                        true,
                        revision,
                        "service-x06 controlled engage",
                        now,
                    )
                    .map_err(|_| Error::Conflict)?;
                hash(&receipt)
            },
        )
    }
    pub fn request_resume(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        revision: u64,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.trading(a, step, now)?;
        self.change(a, step, key, "request_resume", &revision, now, |s| {
            let health = self.fresh_health(s, now)?;
            if !health.ready
                || self.guard.revision().map_err(|_| Error::RecoveryRequired)? != revision
            {
                return Err(Error::Conflict);
            }
            let id = hash(&("resume", &self.config.scope, key))?;
            s.resumes.insert(
                id.clone(),
                Resume {
                    requester: a.actor_id,
                    user: a.user_id.to_string(),
                    revision,
                    source_revision: health.revision,
                    expires_at: now + Duration::minutes(5),
                    approver: None,
                    consumed: false,
                },
            );
            Ok(id)
        })
    }
    pub fn approve_resume(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        id: &ContentHash,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.config.scope.authorize(a, OPS_APPROVE)?;
        if a.role != Role::Approver {
            return Err(Error::Denied);
        }
        step.check(a, now)?;
        // Independent approvers have no generic ops.operate requirement or control privilege.
        let mut s = self.lock()?;
        let mut staged = s.clone();
        let (op, new) = self.begin(&mut staged, a, key, "approve_resume", id, now)?;
        if !new {
            return Ok(staged.operations[&op].clone());
        }
        let request = staged.resumes.get_mut(id).ok_or(Error::Denied)?;
        if request.requester == a.actor_id
            || request.user == a.user_id.to_string()
            || request.consumed
            || request.approver.is_some()
            || now >= request.expires_at
        {
            return Err(Error::Denied);
        }
        request.approver = Some((a.actor_id, a.user_id.to_string()));
        let out = self.finish(
            &mut staged,
            a,
            &op,
            Outcome::Applied {
                reference: id.clone(),
            },
            now,
        )?;
        *s = staged;
        Ok(out)
    }
    pub fn execute_resume(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        id: &ContentHash,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.trading(a, step, now)?;
        if a.role != Role::Owner {
            return Err(Error::Denied);
        }
        self.change(a, step, key, "execute_resume", id, now, |s| {
            let health = self.fresh_health(s, now)?;
            let request = s.resumes.get(id).ok_or(Error::Denied)?.clone();
            if request.consumed
                || now >= request.expires_at
                || request.approver.is_none()
                || request.approver.as_ref().is_some_and(|(actor, user)| {
                    *actor == a.actor_id || *user == a.user_id.to_string()
                })
                || !health.ready
                || health.revision <= request.source_revision
            {
                return Err(Error::Denied);
            }
            let receipt = self
                .guard
                .set_kill_switch(
                    a,
                    KillScope::Account(self.config.scope.account_id),
                    false,
                    request.revision,
                    "service-x06 independent approved resume",
                    now,
                )
                .map_err(|_| Error::Conflict)?;
            s.resumes.get_mut(id).ok_or(Error::Invalid)?.consumed = true;
            hash(&receipt)
        })
    }
    pub fn runbook(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        runbook: Runbook,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.change(a, step, key, "runbook", &runbook, now, |s| match &runbook {
            Runbook::InspectEvidence { command_id } => {
                hash(&s.orders.get(command_id).ok_or(Error::Denied)?.evidence)
            }
            Runbook::InspectHealth {} => hash(self.fresh_health(s, now)?),
        })
    }
    /// Restricted backend checkpoint. May contain signed command/evidence material;
    /// never return it from an account/audit query or expose to a client/Agent.
    pub fn checkpoint(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        now: DateTime<Utc>,
    ) -> Result<(Vec<u8>, CheckpointAnchor)> {
        self.writable(a, step, now)?;
        if a.role != Role::Owner {
            return Err(Error::Denied);
        }
        let s = self.lock()?;
        Self::clock(&s, now)?;
        Self::size(&s)?;
        let bytes = serde_json::to_vec(&*s).map_err(|_| Error::Invalid)?;
        let digest = ContentHash::sha256_bytes(&bytes);
        Ok((
            bytes,
            CheckpointAnchor {
                digest,
                scope: self.config.scope.clone(),
                sequence: s.audit.len() as u64,
                lease: self.gateway.checkpoint_lease(),
            },
        ))
    }
    pub fn restore(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        bytes: &[u8],
        anchor: &CheckpointAnchor,
        now: DateTime<Utc>,
    ) -> Result<()> {
        self.writable(a, step, now)?;
        if a.role != Role::Owner
            || bytes.len() > 8 * 1024 * 1024
            || ContentHash::sha256_bytes(bytes) != anchor.digest
            || anchor.scope != self.config.scope
            || anchor.lease != self.gateway.checkpoint_lease()
        {
            return Err(Error::Denied);
        }
        let mut current = self.lock()?;
        Self::clock(&current, now)?;
        // Restore only into a fresh service instance. Never roll an active instance backwards.
        if !current.audit.is_empty() {
            return Err(Error::Conflict);
        }
        let mut s: State = serde_json::from_slice(bytes).map_err(|_| Error::Invalid)?;
        if s.quote_unit != self.config.quote_unit
            || s.schema != current.schema
            || s.scope != self.config.scope
            || s.seed_hash != current.seed_hash
            || s.seed_len != current.seed_len
            || s.events.get(..s.seed_len) != current.events.get(..current.seed_len)
            || s.at > now
            || s.audit.len() > self.config.max_actions
            || s.audit.len() as u64 != anchor.sequence
        {
            return Err(Error::Invalid);
        }
        let mut previous = None;
        let mut at = self.config.started_at;
        for (i, row) in s.audit.iter().enumerate() {
            if row.sequence != i as u64 + 1
                || row.previous != previous
                || row.at < at
                || row.at > s.at
                || row.hash
                    != hash(&(
                        "service-x06-audit/v1",
                        &s.scope,
                        row.sequence,
                        row.actor,
                        row.at,
                        &row.kind,
                        &row.subject,
                        &row.outcome,
                        &row.previous,
                    ))?
            {
                return Err(Error::Invalid);
            }
            previous = Some(row.hash.clone());
            at = row.at;
        }
        self.projection(&s)?;
        if s.events.len() != s.seed_len + s.links.len() {
            return Err(Error::Invalid);
        }
        for (index, link) in s.links.iter().enumerate() {
            let record = s.orders.get(&link.command_id).ok_or(Error::Invalid)?;
            if s.events[s.seed_len + index] != self.fill_event(record, link)? {
                return Err(Error::Invalid);
            }
        }
        for (id, operation) in &s.operations {
            if &operation.id != id
                || operation.prepared_at > s.at
                || !s
                    .audit
                    .iter()
                    .any(|r| &r.subject == id && r.actor == operation.actor)
            {
                return Err(Error::Invalid);
            }
        }
        let pending: Vec<_> = s
            .operations
            .values()
            .filter(|o| o.outcome == Outcome::Prepared)
            .map(|o| o.id.clone())
            .collect();
        for id in pending {
            s.operations.get_mut(&id).ok_or(Error::Invalid)?.outcome = Outcome::Uncertain;
            self.append(
                &mut s,
                self.config.observer,
                "restore_quarantine",
                &id,
                Outcome::Uncertain,
                now,
            )?;
        }
        self.sync_local_alert(&mut s)?;
        Self::size(&s)?;
        *current = s;
        Ok(())
    }
}
