use native_tls::TlsConnector;
use postgres::{Client, NoTls, Row, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{AccountId, CoreError, TenantId};
use thiserror::Error;
use url::Url;

use crate::{PortfolioError, PortfolioSnapshot, PositionSnapshot};

#[derive(Debug, Error)]
pub enum PgPortfolioError {
    #[error(transparent)]
    Postgres(#[from] postgres::Error),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error(transparent)]
    Tls(#[from] native_tls::Error),
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
}

impl PgPortfolioStore {
    pub fn connect(database_url: &str) -> Result<Self, PgPortfolioError> {
        Ok(Self {
            client: connect_client(database_url)?,
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
        let row = self.client.query_opt(
            "select realized_pnl, unrealized_pnl, exposure_gross, exposure_net, last_event_sequence
             from quantos.portfolio_accounts
             where tenant_id = $1 and account_id = $2",
            &[&tenant_id.as_uuid(), &account_id.as_uuid()],
        )?;
        Ok(row.map(|row| AccountRiskState {
            realized_pnl: row.get(0),
            unrealized_pnl: row.get(1),
            exposure_gross: row.get(2),
            exposure_net: row.get(3),
            last_event_sequence: row.get::<_, i64>(4) as u64,
        }))
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
    let use_tls = matches!(
        url.query_pairs().find(|(key, _)| key == "sslmode"),
        Some((_, value)) if value != "disable"
    ) || !url
        .host_str()
        .is_some_and(|host| host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1");
    if use_tls {
        let connector = TlsConnector::new()?;
        let connector = MakeTlsConnector::new(connector);
        Ok(Client::connect(database_url, connector)?)
    } else {
        Ok(Client::connect(database_url, NoTls)?)
    }
}
