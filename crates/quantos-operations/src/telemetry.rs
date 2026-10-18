use crate::{model::*, service::OperationsService};
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::ContentHash;
use quantos_execution::gateway::ExecutionKernel;
use quantos_observability::{AlertRecord, ServiceHealthReport};
use quantos_policy::Role;
use std::collections::BTreeSet;

impl<K: ExecutionKernel> OperationsService<K> {
    pub(crate) fn observed_health<'a>(
        &self,
        s: &'a State,
        now: DateTime<Utc>,
    ) -> Result<&'a Health> {
        let h = s.health.as_ref().ok_or(Error::Stale)?;
        if h.observed_at > now || now - h.observed_at > Duration::seconds(30) {
            return Err(Error::Stale);
        }
        Ok(h)
    }
    pub(crate) fn fresh_health<'a>(&self, s: &'a State, now: DateTime<Utc>) -> Result<&'a Health> {
        let health = self.observed_health(s, now)?;
        if self.synchronized(s).is_err()
            || s.operations
                .values()
                .any(|o| o.outcome == Outcome::Uncertain)
        {
            return Err(Error::RecoveryRequired);
        }
        Ok(health)
    }
    pub fn health(&self, a: &AuthContext, now: DateTime<Utc>) -> Result<Health> {
        self.config.scope.authorize(a, OPS_READ)?;
        let s = self.lock()?;
        Self::clock(&s, now)?;
        let mut health = self.observed_health(&s, now)?.clone();
        health.ready &= self.synchronized(&s).is_ok()
            && !s
                .operations
                .values()
                .any(|o| o.outcome == Outcome::Uncertain);
        Ok(health)
    }
    pub fn alerts(&self, a: &AuthContext) -> Result<Vec<Alert>> {
        self.config.scope.authorize(a, OPS_READ)?;
        Ok(self.lock()?.alerts.values().cloned().collect())
    }
    pub fn incidents(&self, a: &AuthContext) -> Result<Vec<Incident>> {
        self.config.scope.authorize(a, OPS_READ)?;
        Ok(self.lock()?.incidents.values().cloned().collect())
    }

    /// Only the configured F09 backend observer may publish observations. Free
    /// text/details/metric JSON are hashed, never copied into service views.
    pub fn observe(
        &self,
        a: &AuthContext,
        report: &ServiceHealthReport,
        alerts: &[AlertRecord],
        now: DateTime<Utc>,
    ) -> Result<Health> {
        self.config.scope.authorize(a, OPS_OBSERVE)?;
        if a.actor_id != self.config.observer || a.role != Role::Service {
            return Err(Error::Denied);
        }
        let expected: BTreeSet<_> = ["execution", "portfolio", "risk", "reconciliation"]
            .into_iter()
            .collect();
        if report.service != "service-x06"
            || report.components.len() != 4
            || report
                .components
                .iter()
                .map(|c| c.name.as_str())
                .collect::<BTreeSet<_>>()
                != expected
            || report.ready != report.components.iter().all(|c| c.ready)
            || report.checked_at > now
            || now - report.checked_at > Duration::seconds(30)
            || report.components.iter().any(|c| {
                c.checked_at > report.checked_at || now - c.checked_at > Duration::seconds(30)
            })
            || alerts.len() > 32
        {
            return Err(Error::Invalid);
        }
        const RULES: &[&str] = &[
            "outbox_oldest_age",
            "dead_letter_ratio",
            "realtime_projection_delay",
            "realtime_quota_utilization",
            "risk_query_p95_ms",
            "portfolio_query_p95_ms",
            "risk_mv_freshness",
            "ops_aggregate_freshness",
            "storage_error_rate",
            "secret_rotation_failed",
            "secret_read_failed",
        ];
        if alerts.iter().any(|a| {
            !RULES.contains(&a.rule_id.as_str())
                || a.triggered_at > report.checked_at
                || now - a.triggered_at > Duration::seconds(30)
        }) {
            return Err(Error::Invalid);
        }
        let mut s = self.lock()?;
        Self::clock(&s, now)?;
        let source_hash = hash(&(report, alerts))?;
        if let Some(h) = &s.health {
            if report.checked_at < h.observed_at {
                return Err(Error::Stale);
            }
            if report.checked_at == h.observed_at {
                return if source_hash == h.source_hash {
                    Ok(h.clone())
                } else {
                    Err(Error::Conflict)
                };
            }
        }
        let mut staged = s.clone();
        let revision = staged.health.as_ref().map_or(1, |h| h.revision + 1);
        let health = Health {
            revision,
            ready: report.ready
                && alerts.is_empty()
                && self.synchronized(&staged).is_ok()
                && !staged
                    .operations
                    .values()
                    .any(|o| o.outcome == Outcome::Uncertain),
            observed_at: report.checked_at,
            source_hash: source_hash.clone(),
        };
        let mut rules: BTreeSet<String> = alerts.iter().map(|a| a.rule_id.clone()).collect();
        for component in &report.components {
            if !component.ready {
                rules.insert(format!("{}_unavailable", component.name));
            }
        }
        if staged
            .operations
            .values()
            .any(|o| o.outcome == Outcome::Uncertain)
        {
            rules.insert("execution_uncertain".into());
        }
        if self.synchronized(&staged).is_err() {
            rules.insert("projection_out_of_sync".into());
        }
        for alert in staged.alerts.values_mut() {
            if alert.active && !rules.contains(&alert.rule) {
                alert.active = false;
                alert.revision += 1;
                alert.source_revision = revision;
            }
        }
        for rule in rules {
            let id = hash(&("service-x06-alert/v1", &self.config.scope, &rule))?;
            let row = staged.alerts.entry(id.clone()).or_insert(Alert {
                id: id.clone(),
                rule,
                active: false,
                acknowledged: false,
                revision: 0,
                source_revision: revision,
            });
            let recurrent = !row.active;
            if recurrent {
                row.active = true;
                row.acknowledged = false;
                row.revision += 1;
                row.source_revision = revision;
            }
            // A recurrent source fault reopens previously resolved incidents.
            for incident in staged.incidents.values_mut().filter(|i| i.alert_id == id) {
                if recurrent && incident.status == CaseStatus::Resolved {
                    incident.status = CaseStatus::Open;
                    incident.acknowledged_by = None;
                    incident.acknowledged_user = None;
                    incident.revision += 1;
                    incident.opened_source = revision;
                }
            }
        }
        staged.health = Some(health.clone());
        self.append(
            &mut staged,
            a.actor_id,
            "observe",
            &source_hash,
            Outcome::Applied {
                reference: source_hash.clone(),
            },
            now,
        )?;
        *s = staged;
        Ok(health)
    }
    pub fn acknowledge_alert(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        id: &ContentHash,
        revision: u64,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.change(
            a,
            step,
            key,
            "acknowledge_alert",
            &(id, revision),
            now,
            |s| {
                let alert = s.alerts.get_mut(id).ok_or(Error::Denied)?;
                if alert.revision != revision || alert.acknowledged {
                    return Err(Error::Conflict);
                }
                alert.acknowledged = true;
                alert.revision += 1;
                hash(alert)
            },
        )
    }
    /// Acknowledgement is operator workflow state, never source resolution.
    pub fn unacknowledge_alert(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        id: &ContentHash,
        revision: u64,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.change(
            a,
            step,
            key,
            "unacknowledge_alert",
            &(id, revision),
            now,
            |s| {
                let alert = s.alerts.get_mut(id).ok_or(Error::Denied)?;
                if alert.revision != revision || !alert.acknowledged {
                    return Err(Error::Conflict);
                }
                alert.acknowledged = false;
                alert.revision += 1;
                hash(alert)
            },
        )
    }
    pub fn open_incident(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        alert_id: &ContentHash,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.change(a, step, key, "open_incident", alert_id, now, |s| {
            let alert = s.alerts.get(alert_id).ok_or(Error::Denied)?;
            if !alert.active {
                return Err(Error::Conflict);
            }
            let id = hash(&("service-x06-incident/v1", &self.config.scope, alert_id))?;
            if s.incidents.contains_key(&id) {
                return Err(Error::Conflict);
            }
            s.incidents.insert(
                id.clone(),
                Incident {
                    id: id.clone(),
                    alert_id: alert_id.clone(),
                    status: CaseStatus::Open,
                    revision: 0,
                    requester: a.actor_id,
                    requester_user: a.user_id.to_string(),
                    acknowledged_by: None,
                    acknowledged_user: None,
                    opened_source: alert.source_revision,
                },
            );
            Ok(id)
        })
    }
    pub fn acknowledge_incident(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        id: &ContentHash,
        revision: u64,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.change(
            a,
            step,
            key,
            "acknowledge_incident",
            &(id, revision),
            now,
            |s| {
                let i = s.incidents.get_mut(id).ok_or(Error::Denied)?;
                if i.revision != revision || i.status != CaseStatus::Open {
                    return Err(Error::Conflict);
                }
                i.status = CaseStatus::Acknowledged;
                i.revision += 1;
                i.acknowledged_by = Some(a.actor_id);
                i.acknowledged_user = Some(a.user_id.to_string());
                hash(i)
            },
        )
    }
    pub fn resolve_incident(
        &self,
        a: &AuthContext,
        step: &VerifiedStepUp,
        key: &str,
        id: &ContentHash,
        revision: u64,
        now: DateTime<Utc>,
    ) -> Result<Operation> {
        self.config.scope.authorize(a, OPS_APPROVE)?;
        if a.role != Role::Approver {
            return Err(Error::Denied);
        }
        step.check(a, now)?;
        let mut s = self.lock()?;
        let mut staged = s.clone();
        let (op, new) = self.begin(
            &mut staged,
            a,
            key,
            "resolve_incident",
            &(id, revision),
            now,
        )?;
        if !new {
            return Ok(staged.operations[&op].clone());
        }
        let health = self.fresh_health(&staged, now)?;
        let i = staged.incidents.get(id).ok_or(Error::Denied)?;
        if i.requester == a.actor_id
            || i.requester_user == a.user_id.to_string()
            || i.acknowledged_by == Some(a.actor_id)
            || i.acknowledged_user.as_deref() == Some(a.user_id.to_string().as_str())
            || i.revision != revision
            || i.status != CaseStatus::Acknowledged
            || health.revision <= i.opened_source
            || !health.ready
            || staged
                .alerts
                .get(&i.alert_id)
                .is_none_or(|a| a.active || !a.acknowledged)
        {
            return Err(Error::Denied);
        }
        let i = staged.incidents.get_mut(id).ok_or(Error::Invalid)?;
        i.status = CaseStatus::Resolved;
        i.revision += 1;
        let reference = hash(i)?;
        let out = self.finish(&mut staged, a, &op, Outcome::Applied { reference }, now)?;
        *s = staged;
        Ok(out)
    }
}
