use std::{
    sync::mpsc::{Receiver, SyncSender, sync_channel},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use chrono::{DateTime, Utc};
use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use postgres::{Client, NoTls, Row, types::Type};
use postgres_openssl::MakeTlsConnector;
use quantos_core::{AccountId, CoreError, TenantId};
use thiserror::Error;
use url::Url;

use crate::{PortfolioError, PortfolioSnapshot, PositionSnapshot};

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
        let mut transaction = self.client.transaction()?;
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
        for position in &snapshot.positions {
            transaction.execute(
                "insert into quantos.portfolio_marks (tenant_id, symbol, price, as_of, updated_at)
                 values ($1,$2,$3,$4,$5)
                 on conflict (tenant_id, symbol) do update
                 set price = excluded.price, as_of = excluded.as_of, updated_at = excluded.updated_at",
                &[
                    &snapshot.tenant_id.as_uuid(),
                    &position.symbol,
                    &position.mark_price,
                    &snapshot.as_of,
                    &snapshot.as_of,
                ],
            )?;
        }
        transaction.execute(
            "insert into quantos.portfolio_accounts (
                tenant_id, account_id, realized_pnl, unrealized_pnl,
                exposure_gross, exposure_net, last_event_sequence, as_of, updated_at
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            on conflict (tenant_id, account_id) do update
            set realized_pnl = excluded.realized_pnl,
                unrealized_pnl = excluded.unrealized_pnl,
                exposure_gross = excluded.exposure_gross,
                exposure_net = excluded.exposure_net,
                last_event_sequence = excluded.last_event_sequence,
                as_of = excluded.as_of,
                updated_at = excluded.updated_at",
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
        let rows = self.client.query_typed(
            "select p.symbol, p.quantity, p.average_entry_price, p.realized_pnl,
                    coalesce(m.price, p.average_entry_price) as mark_price
             from quantos.portfolio_positions p
             left join quantos.portfolio_marks m
               on m.tenant_id = p.tenant_id and m.symbol = p.symbol
             where p.tenant_id = $1 and p.account_id = $2
             order by p.symbol asc",
            &[
                (tenant_id.as_uuid(), Type::UUID),
                (account_id.as_uuid(), Type::UUID),
            ],
        )?;
        self.record_query_latency(tenant_id, "portfolio_query_latency_ms", started);
        Ok(rows.iter().map(row_to_position_snapshot).collect())
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
        let row = self.client.query_opt(
            "select realized_pnl, unrealized_pnl, exposure_gross, exposure_net, last_event_sequence
             from quantos.portfolio_accounts
             where tenant_id = $1 and account_id = $2",
            &[&tenant_id.as_uuid(), &account_id.as_uuid()],
        )?;
        self.record_query_latency(tenant_id, "risk_query_latency_ms", started);
        Ok(row.map(|row| AccountRiskState {
            realized_pnl: row.get(0),
            unrealized_pnl: row.get(1),
            exposure_gross: row.get(2),
            exposure_net: row.get(3),
            last_event_sequence: row.get::<_, i64>(4) as u64,
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

fn row_to_position_snapshot(row: &Row) -> PositionSnapshot {
    let quantity: f64 = row.get(1);
    let average_entry_price: f64 = row.get(2);
    let mark_price: f64 = row.get(4);
    PositionSnapshot {
        symbol: row.get(0),
        quantity,
        average_entry_price,
        mark_price,
        market_value: quantity * mark_price,
        unrealized_pnl: quantity * (mark_price - average_entry_price),
        realized_pnl: row.get(3),
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
