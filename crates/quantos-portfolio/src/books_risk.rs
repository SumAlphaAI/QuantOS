//! Read-only owner-authenticated X05 provenance for exact current risk. A hash is
//! content binding, not financial-source authenticity or execution authority.
use crate::native_ledger::Scope;
use chrono::{DateTime, Duration, Utc};
use quantos_core::{ContentHash, canonical_json_bytes};
use serde::{Deserialize, Serialize};
use serde_json::json;
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BooksRiskInput {
    pub scope: Scope,
    pub ledger_hash: ContentHash,
    pub reconciliation_hash: ContentHash,
    pub account_report_hash: ContentHash,
    pub source_id: String,
    pub source_hash: Option<ContentHash>,
    pub source_version: Option<u64>,
    pub basis_hash: Option<ContentHash>,
    pub coverage: String,
    pub source_trust: String,
    pub period_start: Option<DateTime<Utc>>,
    pub coverage_through: Option<DateTime<Utc>>,
    pub captured_at: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,
    pub account_state: String,
    pub protocol_state: String,
    pub open_obligations: u64,
    pub obligations_hash: ContentHash,
    pub unknown_obligations: u64,
}
impl BooksRiskInput {
    pub fn content_hash(&self) -> Result<ContentHash, quantos_core::CoreError> {
        Ok(ContentHash::sha256_bytes(&canonical_json_bytes(&json!([
            "quantos-books-risk-input/v1",
            self
        ]))?))
    }
    pub fn deadline(&self) -> Option<DateTime<Utc>> {
        Some(
            self.valid_until?.min(
                self.coverage_through?
                    .checked_add_signed(Duration::seconds(30))?,
            ),
        )
    }
    pub fn reason(&self, at: DateTime<Utc>) -> &str {
        if self.unknown_obligations > 0 {
            return "UNKNOWN_OR_QUARANTINED_OBLIGATIONS";
        }
        if self.source_hash.is_none()
            || self.source_version.is_none_or(|v| v == 0)
            || self.basis_hash.is_none()
            || self.source_id.is_empty()
        {
            return "BOOKS_SOURCE_UNAVAILABLE";
        }
        let (Some(start), Some(through), Some(captured), Some(until)) = (
            self.period_start,
            self.coverage_through,
            self.captured_at,
            self.valid_until,
        ) else {
            return "BOOKS_SOURCE_UNAVAILABLE";
        };
        if start > through
            || through > captured
            || captured > at
            || until <= captured
            || captured
                .checked_add_signed(Duration::seconds(30))
                .is_none_or(|end| until > end)
        {
            return "BOOKS_SOURCE_INVALID";
        }
        if self.deadline().is_none_or(|until| at >= until) {
            return "BOOKS_SOURCE_STALE";
        }
        if self.source_trust != "PINNED_INDEPENDENT_OWNER_REFERENCE_NOT_VENUE_ACCOUNT"
            || self.coverage != "SPOT_EMPTY_ORIGIN_NO_EXTERNAL_FLOWS_QUOTE_FEES"
        {
            return "BOOKS_COVERAGE_UNSUPPORTED";
        }
        if self.account_state != "MATCHED_DECLARED_ACCOUNT_BOOKS" {
            return "BOOKS_NOT_MATCHED";
        }
        if self.protocol_state != "MATCHED_OBSERVATIONS" {
            return "PROTOCOL_NOT_MATCHED";
        }
        if self.open_obligations > 0 {
            return "OPEN_FINANCIAL_OBLIGATIONS";
        }
        "ELIGIBLE_REFERENCE_BOOKS"
    }
    pub fn eligible(&self, at: DateTime<Utc>) -> bool {
        self.reason(at) == "ELIGIBLE_REFERENCE_BOOKS"
    }
}
