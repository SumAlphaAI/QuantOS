//! Immutable native observations shared with X04. Owner-side ingestion only.
use chrono::{DateTime, Utc};
use quantos_core::{CommandId, ContentHash, ProposalId};
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeOrder {
    pub order_id: String,
    pub command_id: CommandId,
    pub account_id: quantos_core::AccountId,
    pub symbol: String,
    pub side: String,
    pub quantity: String,
    pub filled_quantity: String,
    pub average_fill_price: Option<String>,
    pub status: String,
    pub submitted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeFill {
    pub fill_id: String,
    pub order_id: String,
    pub command_id: CommandId,
    pub account_id: quantos_core::AccountId,
    pub symbol: String,
    pub side: String,
    pub quantity: String,
    pub price: String,
    pub fee_currency: String,
    pub fee_amount: String,
    pub filled_at: DateTime<Utc>,
    pub fact_hash: ContentHash,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeExecutionFacts {
    pub schema_version: String,
    pub request_id: ProposalId,
    pub subject_hash: ContentHash,
    pub tenant_id: quantos_core::TenantId,
    pub workspace_id: quantos_core::WorkspaceId,
    pub account_id: quantos_core::AccountId,
    pub command_id: CommandId,
    pub decision_id: quantos_core::DecisionId,
    pub proposal_hash: ContentHash,
    pub quote_currency: String,
    pub outcome: String,
    pub journal_available: bool,
    pub consumer_ready: bool,
    pub reason: String,
    pub order: Option<NativeOrder>,
    pub fills: Vec<NativeFill>,
    pub fact_hashes: Vec<ContentHash>,
    pub native_source_hashes: Vec<ContentHash>,
    pub source_hash: ContentHash,
    pub recorded_at: DateTime<Utc>,
    pub execution_authority: bool,
}
