use std::{
    sync::mpsc::{Receiver, SyncSender, sync_channel},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use chrono::{DateTime, Utc};
use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use postgres::{Client, NoTls};
use postgres_openssl::MakeTlsConnector;
use quantos_core::{AccountId, CoreError, TenantId};
use thiserror::Error;
use url::Url;

use crate::{PortfolioError, PortfolioSnapshot, PositionSnapshot, RiskInputSnapshot};

#[derive(Debug, Error)]
pub enum PgPortfolioError {
    #[error(transparent)]
    Thread(#[from] std::io::Error),
    #[error(transparent)]
    Postgres(#[from] postgres::Error),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error(transparent)]
    Tls(#[from] openssl::error::ErrorStack),
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Portfolio(#[from] PortfolioError),
}

/// Account-level risk input state: realized/unrealized P&L, gross/net exposure, last event sequence.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct AccountRiskState {
    pub realized_pnl: f64,
    pub unrealized_pnl: f64,
    pub exposure_gross: f64,
    pub exposure_net: f64,
    pub last_event_sequence: u64,
    pub account_status: Option<crate::AccountStatus>,
    pub account_status_at: Option<DateTime<Utc>>,
}

pub struct PgPortfolioStore {
    client: Client,
    metric_sender: Option<SyncSender<QueryMetric>>,
    metric_worker: Option<JoinHandle<()>>,
}

struct QueryMetric {
    tenant_id: uuid::Uuid,
    name: &'static str,
    milliseconds: f64,
    observed_at: DateTime<Utc>,
}

impl PgPortfolioStore {
    pub fn connect(database_url: &str) -> Result<Self, PgPortfolioError> {
        let client = connect_client(database_url)?;
        let (metric_sender, receiver) = sync_channel(1024);
        let metric_url = database_url.to_owned();
        let metric_worker = thread::Builder::new()
            .name("portfolio-query-metrics".to_owned())
            .spawn(move || flush_query_metrics(&metric_url, receiver))?;
        Ok(Self {
            client,
            metric_sender: Some(metric_sender),
            metric_worker: Some(metric_worker),
        })
    }

    pub fn save_snapshot(&mut self, snapshot: &PortfolioSnapshot) -> Result<(), PgPortfolioError> {
        self.save(snapshot, None)
    }

    pub fn save_risk_snapshot(
        &mut self,
        input: &RiskInputSnapshot,
    ) -> Result<(), PgPortfolioError> {
        input.validate_for(
            input.portfolio.tenant_id,
            input.portfolio.account_id,
            input.generated_at,
            input.max_age_seconds,
        )?;
        self.save(&input.portfolio, Some(input))
    }

    fn save(
        &mut self,
        snapshot: &PortfolioSnapshot,
        risk: Option<&RiskInputSnapshot>,
    ) -> Result<(), PgPortfolioError> {
        snapshot.validate()?;
        let payload = serde_json::to_value(snapshot).map_err(PortfolioError::from)?;
        let risk_payload = risk
            .map(serde_json::to_value)
            .transpose()
            .map_err(PortfolioError::from)?;
        let mut transaction = self.client.transaction()?;
        // Lock the existing parent even on the first projection write; every writer uses this lock.
        if transaction
            .query_opt(
                "select id from quantos.accounts where tenant_id = $1 and id = $2 for update",
                &[
                    &snapshot.tenant_id.as_uuid(),
                    &snapshot.account_id.as_uuid(),
                ],
            )?
            .is_none()
        {
            return Err(PortfolioError::InvalidInput("account outside tenant").into());
        }
        if let Some(row) = transaction.query_opt(
            "select last_event_sequence, as_of, snapshot_json, risk_input_json from quantos.portfolio_accounts where tenant_id = $1 and account_id = $2",
            &[&snapshot.tenant_id.as_uuid(), &snapshot.account_id.as_uuid()],
        )? {
            let sequence: i64 = row.get(0);
            let as_of: DateTime<Utc> = row.get(1);
            let prior: Option<serde_json::Value> = row.get(2);
            let prior: Option<PortfolioSnapshot> = prior.map(serde_json::from_value).transpose().map_err(PortfolioError::from)?;
            if let Some(prior) = &prior { prior.validate()?; }
            let prior_risk: Option<serde_json::Value> = row.get(3);
            if sequence > snapshot.last_event_sequence as i64 || as_of > snapshot.as_of
                || (sequence == snapshot.last_event_sequence as i64 && prior.is_some_and(|value| value != *snapshot))
                || risk.is_some_and(|input| prior_risk.as_ref().and_then(|r| r.get("generated_at")).and_then(|v| v.as_str())
                    .and_then(|v| DateTime::parse_from_rfc3339(v).ok()).is_some_and(|at| at > input.generated_at))
            {
                return Err(PortfolioError::SnapshotConflict.into());
            }
        }
        transaction.execute(
            "delete from quantos.portfolio_positions where tenant_id = $1 and account_id = $2",
            &[
                &snapshot.tenant_id.as_uuid(),
                &snapshot.account_id.as_uuid(),
            ],
        )?;
        for position in &snapshot.positions {
            transaction.execute(
                "insert into quantos.portfolio_positions (
                    tenant_id, account_id, symbol, quantity, average_entry_price,
                    realized_pnl, last_event_sequence, as_of, updated_at
                ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
                &[
                    &snapshot.tenant_id.as_uuid(),
                    &snapshot.account_id.as_uuid(),
                    &position.symbol,
                    &position.quantity,
                    &position.average_entry_price,
                    &position.realized_pnl,
                    &(snapshot.last_event_sequence as i64),
                    &snapshot.as_of,
                    &snapshot.as_of,
                ],
            )?;
        }
        for mark in &snapshot.valuation_marks {
            transaction.execute(
                "insert into quantos.portfolio_marks (tenant_id, symbol, price, as_of, updated_at)
                 values ($1,$2,$3,$4,$5)
                 on conflict (tenant_id, symbol) do update
                 set price = excluded.price, as_of = excluded.as_of, updated_at = excluded.updated_at
                 where quantos.portfolio_marks.as_of <= excluded.as_of",
                &[
                    &snapshot.tenant_id.as_uuid(),
                    &mark.symbol,
                    &mark.price,
                    &mark.source_at,
                    &mark.source_at,
                ],
            )?;
        }
        transaction.execute(
            "insert into quantos.portfolio_accounts (
                tenant_id, account_id, realized_pnl, unrealized_pnl,
                exposure_gross, exposure_net, last_event_sequence, as_of, updated_at, snapshot_json, risk_input_json
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            on conflict (tenant_id, account_id) do update
            set realized_pnl = excluded.realized_pnl,
                unrealized_pnl = excluded.unrealized_pnl,
                exposure_gross = excluded.exposure_gross,
                exposure_net = excluded.exposure_net,
                last_event_sequence = excluded.last_event_sequence,
                as_of = excluded.as_of,
                updated_at = excluded.updated_at,
                snapshot_json = excluded.snapshot_json,
                risk_input_json = excluded.risk_input_json",
            &[
                &snapshot.tenant_id.as_uuid(),
                &snapshot.account_id.as_uuid(),
                &snapshot.realized_pnl,
                &snapshot.unrealized_pnl,
                &snapshot.exposure_gross,
                &snapshot.exposure_net,
                &(snapshot.last_event_sequence as i64),
                &snapshot.as_of,
                &snapshot.as_of,
                &payload,
                &risk_payload,
            ],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn positions_for_account(
        &mut self,
        tenant_id: TenantId,
        account_id: AccountId,
    ) -> Result<Vec<PositionSnapshot>, PgPortfolioError> {
        let started = Instant::now();
        let snapshot = self.snapshot_for_account(tenant_id, account_id)?;
        self.record_query_latency(tenant_id, "portfolio_query_latency_ms", started);
        Ok(snapshot.map_or_else(Vec::new, |snapshot| snapshot.positions))
    }

    /// One row contains the complete saved valuation; newer global marks cannot tear this read.
    pub fn snapshot_for_account(
        &mut self,
        tenant_id: TenantId,
        account_id: AccountId,
    ) -> Result<Option<PortfolioSnapshot>, PgPortfolioError> {
        let row = self.client.query_opt(
            "select snapshot_json from quantos.portfolio_accounts where tenant_id = $1 and account_id = $2",
            &[&tenant_id.as_uuid(), &account_id.as_uuid()],
        )?;
        row.map(|row| {
            let value: Option<serde_json::Value> = row.get(0);
            let snapshot: PortfolioSnapshot = serde_json::from_value(value.ok_or(
                PortfolioError::InvalidInput("legacy projection requires rebuild"),
            )?)
            .map_err(PortfolioError::from)?;
            snapshot.validate()?;
            if snapshot.tenant_id != tenant_id || snapshot.account_id != account_id {
                return Err(PortfolioError::InvalidInput("saved snapshot identity").into());
            }
            Ok(snapshot)
        })
        .transpose()
    }

    pub fn risk_snapshot_for_account(
        &mut self,
        tenant_id: TenantId,
        account_id: AccountId,
        now: DateTime<Utc>,
        allowed_age_seconds: i64,
    ) -> Result<Option<RiskInputSnapshot>, PgPortfolioError> {
        let started = Instant::now();
        let row = self.client.query_opt(
            "select risk_input_json from quantos.portfolio_accounts where tenant_id = $1 and account_id = $2",
            &[&tenant_id.as_uuid(), &account_id.as_uuid()],
        )?;
        let result = row
            .and_then(|row| row.get::<_, Option<serde_json::Value>>(0))
            .map(|value| {
                let input: RiskInputSnapshot =
                    serde_json::from_value(value).map_err(PortfolioError::from)?;
                input.validate_for(tenant_id, account_id, now, allowed_age_seconds)?;
                Ok(input)
            })
            .transpose();
        self.record_query_latency(tenant_id, "risk_query_latency_ms", started);
        result
    }

    pub fn mark_for_symbol(
        &mut self,
        tenant_id: TenantId,
        symbol: &str,
    ) -> Result<Option<f64>, PgPortfolioError> {
        let row = self.client.query_opt(
            "select price from quantos.portfolio_marks where tenant_id = $1 and symbol = $2",
            &[&tenant_id.as_uuid(), &symbol],
        )?;
        Ok(row.map(|row| row.get(0)))
    }

    pub fn account_state(
        &mut self,
        tenant_id: TenantId,
        account_id: AccountId,
    ) -> Result<Option<AccountRiskState>, PgPortfolioError> {
        let started = Instant::now();
        let snapshot = self.snapshot_for_account(tenant_id, account_id)?;
        self.record_query_latency(tenant_id, "risk_query_latency_ms", started);
        Ok(snapshot.map(|snapshot| AccountRiskState {
            realized_pnl: snapshot.realized_pnl,
            unrealized_pnl: snapshot.unrealized_pnl,
            exposure_gross: snapshot.exposure_gross,
            exposure_net: snapshot.exposure_net,
            last_event_sequence: snapshot.last_event_sequence,
            account_status: snapshot.account_status,
            account_status_at: snapshot.account_status_at,
        }))
    }

    fn record_query_latency(&self, tenant_id: TenantId, name: &'static str, started: Instant) {
        let metric = QueryMetric {
            tenant_id: *tenant_id.as_uuid(),
            name,
            milliseconds: started.elapsed().as_secs_f64() * 1000.0,
            observed_at: Utc::now(),
        };
        if self
            .metric_sender
            .as_ref()
            .is_some_and(|sender| sender.try_send(metric).is_err())
        {
            eprintln!("portfolio/risk query metric queue is unavailable or full");
        }
    }
}

impl Drop for PgPortfolioStore {
    fn drop(&mut self) {
        self.metric_sender.take();
        if let Some(worker) = self.metric_worker.take() {
            let _ = worker.join();
        }
    }
}

fn flush_query_metrics(database_url: &str, receiver: Receiver<QueryMetric>) {
    let mut client = match connect_client(database_url) {
        Ok(client) => client,
        Err(error) => {
            eprintln!("portfolio/risk metric worker could not connect: {error}");
            return;
        }
    };
    while let Ok(first) = receiver.recv() {
        let mut batch = vec![first];
        // Coalesce adjacent requests into one remote write without delaying
        // the user-facing query. A bounded channel prevents unbounded memory.
        std::thread::sleep(Duration::from_millis(200));
        while batch.len() < 256 {
            match receiver.try_recv() {
                Ok(metric) => batch.push(metric),
                Err(_) => break,
            }
        }
        let rows = serde_json::Value::Array(
            batch
                .into_iter()
                .map(|metric| {
                    serde_json::json!({
                        "tenant_id": metric.tenant_id,
                        "metric_name": metric.name,
                        "metric_value": metric.milliseconds,
                        "observed_at": metric.observed_at,
                    })
                })
                .collect(),
        );
        if let Err(error) = client.execute(
            "insert into quantos.operational_metric_samples (
                tenant_id, metric_name, metric_value, source, attributes, observed_at)
             select sample.tenant_id, sample.metric_name, sample.metric_value,
                    sample.metric_name, '{}'::jsonb, sample.observed_at
             from jsonb_to_recordset($1::jsonb) as sample(
                tenant_id uuid, metric_name text, metric_value float8,
                observed_at timestamptz)",
            &[&rows],
        ) {
            eprintln!("portfolio/risk query metric persist failed: {error}");
        }
    }
}

fn connect_client(database_url: &str) -> Result<Client, PgPortfolioError> {
    let url = Url::parse(database_url)?;
    let local = url
        .host_str()
        .is_some_and(|host| host == "localhost" || host == "127.0.0.1");
    let root = url
        .query_pairs()
        .find(|(key, _)| key == "sslrootcert")
        .map(|(_, value)| value.into_owned())
        .or_else(|| std::env::var("QUANTOS_BFF_SSLROOTCERT").ok());
    let options = url
        .query_pairs()
        .filter(|(key, _)| key != "sslmode" && key != "sslrootcert")
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    let mut connection_url = url.clone();
    connection_url.set_query(None);
    if !options.is_empty() {
        connection_url.query_pairs_mut().extend_pairs(options);
    }
    let mut config: postgres::Config = connection_url.as_str().parse()?;
    config.connect_timeout(Duration::from_secs(5));
    if local
        && url
            .query_pairs()
            .any(|(key, value)| key == "sslmode" && value == "disable")
    {
        config.ssl_mode(postgres::config::SslMode::Disable);
        return Ok(config.connect(NoTls)?);
    }
    let mut builder = SslConnector::builder(SslMethod::tls())?;
    builder.set_verify(SslVerifyMode::PEER);
    if let Some(root) = root {
        builder.set_ca_file(root)?;
    } else {
        builder.set_default_verify_paths()?;
    }
    config.ssl_mode(postgres::config::SslMode::Require);
    Ok(config.connect(MakeTlsConnector::new(builder.build()))?)
}
