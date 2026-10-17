//! X04 owned order facts. The hash chain detects alteration and supports local
//! deterministic replay; it is not a signature, durable store or venue authority.
use crate::gateway::{GatewayOrder, KernelEvent};
use chrono::{DateTime, Utc};
use quantos_core::{ContentHash, canonical_json_bytes};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BoundaryCancel {
    pub command_id: String,
    pub venue_order_id: String,
    pub cancel_id: String,
    pub requested_at: DateTime<Utc>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CancelOutcome {
    Pending,
    Cancelled,
    Rejected,
    Uncertain,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CancelAudit {
    pub request: BoundaryCancel,
    pub order_id: String,
    pub completed_at: Option<DateTime<Utc>>,
    pub latency_micros: Option<i64>,
    pub outcome: CancelOutcome,
    pub reason: Option<String>,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum FactKind {
    Submitted {
        order: GatewayOrder,
        expires_at: DateTime<Utc>,
    },
    Kernel {
        event: KernelEvent,
    },
    CancelRequested {
        request: BoundaryCancel,
    },
    CancelUncertain {
        cancel_id: String,
    },
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OrderFact {
    pub sequence: u64,
    pub order_id: String,
    pub command_id: String,
    pub previous_hash: Option<ContentHash>,
    pub content: FactKind,
    pub hash: ContentHash,
}
impl OrderFact {
    pub(crate) fn next(
        prior: &[Self],
        order_id: &str,
        command_id: &str,
        content: FactKind,
    ) -> Self {
        let sequence = prior.len() as u64 + 1;
        let previous_hash = prior.last().map(|f| f.hash.clone());
        let bytes=canonical_json_bytes(&serde_json::json!({"domain":"quantos-x04-order-fact/v1","sequence":sequence,"order_id":order_id,"command_id":command_id,"previous_hash":previous_hash,"content":content})).expect("owned fact serializes");
        Self {
            sequence,
            order_id: order_id.into(),
            command_id: command_id.into(),
            previous_hash,
            content,
            hash: ContentHash::sha256_bytes(&bytes),
        }
    }
}

/// Persist this head outside the replay input to detect truncation as well as edits.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FactAnchor {
    pub count: u64,
    pub head: Option<ContentHash>,
}
