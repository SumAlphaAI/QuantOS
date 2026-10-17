//! Scoped, CAS-controlled exceptions. Recovery replays a hash-anchored journal;
//! reports and closure proofs are recomputed rather than deserialized as trusted.
use crate::{
    legacy::BreakKind,
    model::*,
    reconciliation::{Input, Report, compute},
};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use quantos_auth::AuthContext;
use quantos_core::{ActorId, ContentHash};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Open,
    Acknowledged,
    Closed,
}
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Exception {
    pub exception_id: ContentHash,
    pub day: NaiveDate,
    pub kind: BreakKind,
    pub entity: String,
    pub status: Status,
    pub revision: u64,
    pub first_detected_at: DateTime<Utc>,
    pub last_detected_at: DateTime<Utc>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub acknowledged_by: Option<ActorId>,
    pub closed_by: Option<ActorId>,
    pub resolution: Option<String>,
    pub last_report: ContentHash,
    pub closure_report: Option<ContentHash>,
    pub expected_revision: u64,
    pub actual_revision: u64,
    pub expected_source: String,
    pub actual_source: String,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
enum Action {
    Run {
        key: String,
        input: Box<Input>,
    },
    Acknowledge {
        id: ContentHash,
        revision: u64,
    },
    Close {
        id: ContentHash,
        revision: u64,
        report_id: ContentHash,
        resolution: String,
    },
    CloseDay {
        day: NaiveDate,
        report_id: ContentHash,
    },
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Event {
    sequence: u64,
    actor: ActorId,
    at: DateTime<Utc>,
    content: Action,
    previous_hash: Option<ContentHash>,
    hash: ContentHash,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JournalAnchor {
    pub count: u64,
    pub head: Option<ContentHash>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Journal {
    schema: String,
    scope: Scope,
    events: Vec<Event>,
}
#[derive(Clone, Default)]
struct State {
    at: Option<DateTime<Utc>>,
    reports: BTreeMap<String, Report>,
    latest: BTreeMap<NaiveDate, String>,
    records: BTreeMap<ContentHash, Exception>,
    versions: BTreeMap<String, (u64, ContentHash)>,
    sources_by_day: BTreeMap<NaiveDate, (String, String)>,
    closed_days: BTreeMap<NaiveDate, ContentHash>,
    events: Vec<Event>,
}
#[derive(Clone)]
pub struct ReconciliationService {
    scope: Scope,
    state: Arc<Mutex<State>>,
}
impl ReconciliationService {
    pub fn new(scope: Scope) -> Result<Self, Error> {
        scope.validate()?;
        Ok(Self {
            scope,
            state: Arc::new(Mutex::new(State::default())),
        })
    }
    fn transact(
        &self,
        a: &AuthContext,
        now: DateTime<Utc>,
        action: Action,
    ) -> Result<State, Error> {
        self.scope.authorize(a)?;
        let mut s = self.state.lock().map_err(|_| Error::Unavailable)?;
        clock(s.at, now)?;
        // A full staged projection prevents partial alert/clock/revision mutation on any error.
        let mut staged = s.clone();
        let changed = apply(&self.scope, &mut staged, a.actor_id, now, &action)?;
        if changed {
            if s.events.len() >= 10_000 {
                return Err(Error::Invalid(
                    "journal capacity; archive before new actions",
                ));
            }
            let sequence = s.events.len() as u64 + 1;
            let previous_hash = s.events.last().map(|e| e.hash.clone());
            let hash = hash(
                "quantos-x05-reconciliation-journal/v1",
                &(
                    &self.scope,
                    sequence,
                    a.actor_id,
                    now,
                    &action,
                    &previous_hash,
                ),
            );
            staged.events.push(Event {
                sequence,
                actor: a.actor_id,
                at: now,
                content: action,
                previous_hash,
                hash,
            });
            staged.at = Some(now);
            let bytes = serde_json::to_vec(&Journal {
                schema: "quantos-x05-journal/v1".into(),
                scope: self.scope.clone(),
                events: staged.events.clone(),
            })
            .map_err(|_| Error::Unavailable)?;
            if bytes.len() > 8 * 1024 * 1024 {
                return Err(Error::Invalid(
                    "journal byte capacity; archive before new actions",
                ));
            }
            *s = staged;
        }
        Ok(s.clone())
    }
    pub fn run(
        &self,
        a: &AuthContext,
        key: &str,
        input: &Input,
        now: DateTime<Utc>,
    ) -> Result<Report, Error> {
        let state = self.transact(
            a,
            now,
            Action::Run {
                key: key.into(),
                input: Box::new(input.clone()),
            },
        )?;
        state.reports.get(key).cloned().ok_or(Error::Unavailable)
    }
    pub fn acknowledge(
        &self,
        a: &AuthContext,
        id: &ContentHash,
        revision: u64,
        now: DateTime<Utc>,
    ) -> Result<Exception, Error> {
        let s = self.transact(
            a,
            now,
            Action::Acknowledge {
                id: id.clone(),
                revision,
            },
        )?;
        s.records.get(id).cloned().ok_or(Error::Unavailable)
    }
    pub fn close(
        &self,
        a: &AuthContext,
        id: &ContentHash,
        revision: u64,
        report: &ContentHash,
        resolution: &str,
        now: DateTime<Utc>,
    ) -> Result<Exception, Error> {
        let s = self.transact(
            a,
            now,
            Action::Close {
                id: id.clone(),
                revision,
                report_id: report.clone(),
                resolution: resolution.into(),
            },
        )?;
        s.records.get(id).cloned().ok_or(Error::Unavailable)
    }
    pub fn close_day(
        &self,
        a: &AuthContext,
        day: NaiveDate,
        report: &ContentHash,
        now: DateTime<Utc>,
    ) -> Result<(), Error> {
        self.transact(
            a,
            now,
            Action::CloseDay {
                day,
                report_id: report.clone(),
            },
        )?;
        Ok(())
    }
    pub fn records(&self, a: &AuthContext) -> Result<Vec<Exception>, Error> {
        self.scope.authorize(a)?;
        Ok(self
            .state
            .lock()
            .map_err(|_| Error::Unavailable)?
            .records
            .values()
            .cloned()
            .collect())
    }
    pub fn day_is_closed(&self, a: &AuthContext, day: NaiveDate) -> Result<bool, Error> {
        self.scope.authorize(a)?;
        Ok(self
            .state
            .lock()
            .map_err(|_| Error::Unavailable)?
            .closed_days
            .contains_key(&day))
    }
    pub fn journal(&self, a: &AuthContext) -> Result<(Vec<u8>, JournalAnchor), Error> {
        self.scope.authorize(a)?;
        let s = self.state.lock().map_err(|_| Error::Unavailable)?;
        let anchor = JournalAnchor {
            count: s.events.len() as u64,
            head: s.events.last().map(|e| e.hash.clone()),
        };
        let bytes = serde_json::to_vec(&Journal {
            schema: "quantos-x05-journal/v1".into(),
            scope: self.scope.clone(),
            events: s.events.clone(),
        })
        .map_err(|_| Error::Unavailable)?;
        Ok((bytes, anchor))
    }
    pub fn restore(scope: Scope, bytes: &[u8], anchor: &JournalAnchor) -> Result<Self, Error> {
        scope.validate()?;
        if bytes.len() > 8 * 1024 * 1024 {
            return Err(Error::Invalid("journal size"));
        }
        let journal: Journal =
            serde_json::from_slice(bytes).map_err(|_| Error::Invalid("journal schema"))?;
        if journal.schema != "quantos-x05-journal/v1"
            || journal.scope != scope
            || journal.events.len() > 10_000
            || anchor.count != journal.events.len() as u64
            || anchor.head != journal.events.last().map(|e| e.hash.clone())
        {
            return Err(Error::Invalid("journal anchor or scope"));
        }
        let mut s = State::default();
        for event in journal.events {
            actor_valid(event.actor)?;
            clock(s.at, event.at)?;
            let sequence = s.events.len() as u64 + 1;
            let previous = s.events.last().map(|e| e.hash.clone());
            if event.sequence != sequence
                || event.previous_hash != previous
                || event.hash
                    != hash(
                        "quantos-x05-reconciliation-journal/v1",
                        &(
                            &scope,
                            sequence,
                            event.actor,
                            event.at,
                            &event.content,
                            &previous,
                        ),
                    )
            {
                return Err(Error::Invalid("journal integrity"));
            }
            if !apply(&scope, &mut s, event.actor, event.at, &event.content)? {
                return Err(Error::Invalid("duplicate journal action"));
            }
            s.at = Some(event.at);
            s.events.push(event);
        }
        Ok(Self {
            scope,
            state: Arc::new(Mutex::new(s)),
        })
    }
}
fn latest<'a>(
    s: &'a State,
    day: NaiveDate,
    id: &ContentHash,
    now: DateTime<Utc>,
) -> Result<&'a Report, Error> {
    let key = s.latest.get(&day).ok_or(Error::Transition)?;
    let report = s.reports.get(key).ok_or(Error::Unavailable)?;
    let stale_now = [&report.input.expected, &report.input.actual]
        .iter()
        .any(|book| {
            now - book.captured_at > Duration::seconds(report.input.max_age_seconds)
                || book.positions.iter().any(|p| {
                    now - p.mark.source_at > Duration::seconds(report.input.max_age_seconds)
                })
        });
    if stale_now
        || report.id() != id
        || report.checked_at > now
        || now - report.checked_at > Duration::minutes(15)
        || report
            .differences
            .iter()
            .any(|d| d.kind == BreakKind::LedgerStaleMark)
    {
        return Err(Error::Transition);
    }
    Ok(report)
}
fn apply(
    scope: &Scope,
    s: &mut State,
    actor: ActorId,
    now: DateTime<Utc>,
    action: &Action,
) -> Result<bool, Error> {
    actor_valid(actor)?;
    match action {
        Action::Run { key, input } => {
            if !identifier(key) || key.len() > 128 || &input.scope != scope {
                return Err(Error::Invalid("run key or scope"));
            }
            if let Some(report) = s.reports.get(key) {
                if report.input != **input {
                    return Err(Error::Conflict);
                }
                return Ok(false);
            }
            if s.sources_by_day.get(&input.day).is_some_and(|pair| {
                pair != &(
                    input.expected.source_ref.clone(),
                    input.actual.source_ref.clone(),
                )
            }) {
                return Err(Error::Conflict);
            }
            let report = compute(input, now)?;
            for book in [&input.expected, &input.actual] {
                if let Some((revision, hash)) = s.versions.get(&book.source_ref)
                    && (book.revision < *revision
                        || book.revision == *revision && book.content_hash() != *hash)
                {
                    return Err(Error::Conflict);
                }
            }
            for d in &report.differences {
                let id = hash(
                    "quantos-x05-exception/v1",
                    &(scope, input.day, d.kind, &d.entity),
                );
                if let Some(record) = s.records.get_mut(&id) {
                    record.revision = record.revision.checked_add(1).ok_or(Error::Arithmetic)?;
                    record.last_detected_at = now;
                    record.last_report = report.report_id.clone();
                    record.expected_revision = input.expected.revision;
                    record.actual_revision = input.actual.revision;
                    // Any renewed observation invalidates a prior acknowledgement/closure.
                    record.status = Status::Open;
                    record.acknowledged_at = None;
                    record.closed_at = None;
                    record.acknowledged_by = None;
                    record.closed_by = None;
                    record.resolution = None;
                    record.closure_report = None;
                } else {
                    s.records.insert(
                        id.clone(),
                        Exception {
                            exception_id: id,
                            day: input.day,
                            kind: d.kind,
                            entity: d.entity.clone(),
                            status: Status::Open,
                            revision: 0,
                            first_detected_at: now,
                            last_detected_at: now,
                            acknowledged_at: None,
                            closed_at: None,
                            acknowledged_by: None,
                            closed_by: None,
                            resolution: None,
                            last_report: report.report_id.clone(),
                            closure_report: None,
                            expected_revision: input.expected.revision,
                            actual_revision: input.actual.revision,
                            expected_source: input.expected.source_ref.clone(),
                            actual_source: input.actual.source_ref.clone(),
                        },
                    );
                }
            }
            for book in [&input.expected, &input.actual] {
                s.versions.insert(
                    book.source_ref.clone(),
                    (book.revision, book.content_hash()),
                );
            }
            s.sources_by_day.insert(
                input.day,
                (
                    input.expected.source_ref.clone(),
                    input.actual.source_ref.clone(),
                ),
            );
            s.closed_days.remove(&input.day);
            s.latest.insert(input.day, key.clone());
            s.reports.insert(key.clone(), report);
            Ok(true)
        }
        Action::Acknowledge { id, revision } => {
            let r = s.records.get_mut(id).ok_or(Error::Transition)?;
            if r.revision != *revision {
                return Err(Error::Conflict);
            }
            if r.status != Status::Open || now < r.last_detected_at {
                return Err(Error::Transition);
            }
            r.status = Status::Acknowledged;
            r.revision = r.revision.checked_add(1).ok_or(Error::Arithmetic)?;
            r.acknowledged_at = Some(now);
            r.acknowledged_by = Some(actor);
            Ok(true)
        }
        Action::Close {
            id,
            revision,
            report_id,
            resolution,
        } => {
            let r = s.records.get(id).ok_or(Error::Transition)?;
            if r.revision != *revision {
                return Err(Error::Conflict);
            }
            if r.status != Status::Acknowledged || !identifier(resolution) {
                return Err(Error::Transition);
            }
            let ack = r.acknowledged_at.ok_or(Error::Transition)?;
            let report = latest(s, r.day, report_id, now)?;
            if report.checked_at < ack
                || report.input.expected.captured_at < ack
                || report.input.actual.captured_at < ack
                || !report.covered.contains(&r.entity)
                || report
                    .differences
                    .iter()
                    .any(|d| d.kind == r.kind && d.entity == r.entity)
                || report.input.expected.source_ref != r.expected_source
                || report.input.actual.source_ref != r.actual_source
                || report.input.expected.revision < r.expected_revision
                || report.input.actual.revision < r.actual_revision
                || report.input.expected.revision == r.expected_revision
                    && report.input.actual.revision == r.actual_revision
            {
                return Err(Error::Transition);
            }
            let r = s.records.get_mut(id).ok_or(Error::Unavailable)?;
            r.status = Status::Closed;
            r.revision = r.revision.checked_add(1).ok_or(Error::Arithmetic)?;
            r.closed_at = Some(now);
            r.closed_by = Some(actor);
            r.resolution = Some(resolution.clone());
            r.closure_report = Some(report_id.clone());
            Ok(true)
        }
        Action::CloseDay { day, report_id } => {
            let report = latest(s, *day, report_id, now)?;
            if !report.is_clean()
                || s.records
                    .values()
                    .any(|r| r.day == *day && r.status != Status::Closed)
            {
                return Err(Error::Transition);
            }
            if s.closed_days.get(day) == Some(report_id) {
                return Ok(false);
            }
            s.closed_days.insert(*day, report_id.clone());
            Ok(true)
        }
    }
}
