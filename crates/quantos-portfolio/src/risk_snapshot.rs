use chrono::{DateTime, Duration, Utc};
use quantos_core::{AccountId, ContentHash, TenantId, canonical_json_bytes};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{InMemoryPortfolioProjection, PortfolioError, PortfolioSnapshot, approx_eq};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccountStatus {
    Active,
    Suspended,
    Closed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AccountStatusEvent {
    pub account_id: AccountId,
    pub status: AccountStatus,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MarketMarkEvent {
    pub symbol: String,
    pub price: f64,
    pub source_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RiskMark {
    pub symbol: String,
    pub price: f64,
    pub source_at: DateTime<Utc>,
    pub source_event_id: String,
}

/// An account-bound, complete point-in-time input. This is not trading authority.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RiskInputSnapshot {
    pub schema_version: String,
    pub portfolio: PortfolioSnapshot,
    pub account_status: AccountStatus,
    pub account_status_at: DateTime<Utc>,
    pub marks: Vec<RiskMark>,
    pub generated_at: DateTime<Utc>,
    pub max_age_seconds: i64,
    pub input_hash: ContentHash,
}

impl RiskInputSnapshot {
    fn computed_hash(&self) -> Result<ContentHash, PortfolioError> {
        Ok(ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "schema_version": self.schema_version,
            "portfolio": self.portfolio,
            "account_status": self.account_status,
            "account_status_at": self.account_status_at,
            "marks": self.marks,
            "generated_at": self.generated_at,
            "max_age_seconds": self.max_age_seconds,
        }))?))
    }

    /// Consumers must supply their trusted tenant/account and clock on every read.
    pub fn validate_for(
        &self,
        tenant: TenantId,
        account: AccountId,
        now: DateTime<Utc>,
        allowed_age_seconds: i64,
    ) -> Result<(), PortfolioError> {
        self.portfolio.validate()?;
        if self.schema_version != "quantos-risk-input/v1"
            || self.portfolio.tenant_id != tenant
            || self.portfolio.account_id != account
            || self.portfolio.account_status != Some(self.account_status)
            || self.portfolio.account_status_at != Some(self.account_status_at)
            || self.account_status != AccountStatus::Active
            || !(1..=3600).contains(&self.max_age_seconds)
            || !(1..=3600).contains(&allowed_age_seconds)
            || self.max_age_seconds > allowed_age_seconds
            || self.generated_at > now
            || self.account_status_at > self.portfolio.as_of
            || self.input_hash != self.computed_hash()?
        {
            return Err(PortfolioError::InvalidInput(
                "risk input binding or account status",
            ));
        }
        let fresh =
            |at| at <= self.generated_at && now - at <= Duration::seconds(self.max_age_seconds);
        if !fresh(self.portfolio.as_of) || !fresh(self.account_status_at) {
            return Err(PortfolioError::InvalidInput(
                "stale account or portfolio data",
            ));
        }
        let positions: Vec<_> = self
            .portfolio
            .positions
            .iter()
            .filter(|p| p.quantity != 0.0)
            .collect();
        if self.marks.len() != positions.len() {
            return Err(PortfolioError::InvalidInput("missing risk marks"));
        }
        for (mark, position) in self.marks.iter().zip(positions) {
            if mark.symbol != position.symbol
                || !mark.price.is_finite()
                || mark.price <= 0.0
                || !approx_eq(mark.price, position.mark_price)
                || !self.portfolio.valuation_marks.contains(mark)
                || mark.source_event_id.is_empty()
                || mark.source_at > self.portfolio.as_of
                || !fresh(mark.source_at)
            {
                return Err(PortfolioError::InvalidInput(
                    "stale, missing or inconsistent risk mark",
                ));
            }
        }
        Ok(())
    }
}

impl InMemoryPortfolioProjection {
    pub fn risk_snapshot(
        &self,
        account: AccountId,
        now: DateTime<Utc>,
        max_age_seconds: i64,
    ) -> Result<RiskInputSnapshot, PortfolioError> {
        let (status, at) = self
            .account_states
            .get(&account)
            .ok_or(PortfolioError::InvalidInput("unknown account state"))?;
        let portfolio = self.snapshot(account)?;
        let mut marks = Vec::new();
        for position in portfolio.positions.iter().filter(|p| p.quantity != 0.0) {
            let (price, source_at) = self
                .marks
                .get(&position.symbol)
                .ok_or(PortfolioError::InvalidInput("missing risk mark"))?;
            marks.push(RiskMark {
                symbol: position.symbol.clone(),
                price: *price,
                source_at: *source_at,
                source_event_id: self
                    .mark_sources
                    .get(&position.symbol)
                    .cloned()
                    .ok_or(PortfolioError::InvalidInput("missing mark provenance"))?,
            });
        }
        let mut input = RiskInputSnapshot {
            schema_version: "quantos-risk-input/v1".into(),
            portfolio,
            account_status: *status,
            account_status_at: *at,
            marks,
            generated_at: now,
            max_age_seconds,
            input_hash: ContentHash::sha256_bytes(b"pending"),
        };
        input.input_hash = input.computed_hash()?;
        input.validate_for(self.tenant_id, account, now, max_age_seconds)?;
        Ok(input)
    }
}
