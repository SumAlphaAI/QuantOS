//! Server-configured approvals are separate from client-provided license labels.
use chrono::{DateTime, Utc};
use quantos_core::{ContentHash, TenantId};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

use crate::{DataSnapshotRecord, SnapshotQuality, SnapshotUsage};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SourceApproval {
    pub provider: String,
    pub dataset: String,
    pub license_label: String,
    pub approval_reference: String,
    pub approval_version: String,
    pub approval_document_hash: ContentHash,
    pub scope_hash: ContentHash,
    pub tenant_id: TenantId,
    pub symbols: Vec<String>,
    pub allowed_usages: Vec<SnapshotUsage>,
    pub expires_at: DateTime<Utc>,
    pub enabled: bool,
}

#[derive(Debug, Error)]
#[error("SNAPSHOT_SOURCE_AUTHORIZATION: {0}")]
pub struct SourceAuthorizationError(pub &'static str);

pub struct SnapshotSourcePolicy {
    approvals: Vec<SourceApproval>,
}

impl SnapshotSourcePolicy {
    /// Load only from a reviewed server configuration, never from an API request.
    pub fn new(approvals: Vec<SourceApproval>) -> Result<Self, SourceAuthorizationError> {
        if approvals.is_empty() || approvals.len() > 1024 {
            return Err(SourceAuthorizationError(
                "approval set missing or oversized",
            ));
        }
        let mut identities = std::collections::BTreeSet::new();
        for a in &approvals {
            if [
                &a.provider,
                &a.dataset,
                &a.license_label,
                &a.approval_reference,
                &a.approval_version,
            ]
            .iter()
            .any(|s| s.trim().is_empty())
                || a.symbols.is_empty()
                || a.allowed_usages.is_empty()
                || !identities.insert((a.tenant_id, a.provider.clone(), a.dataset.clone()))
            {
                return Err(SourceAuthorizationError("invalid or ambiguous approval"));
            }
        }
        Ok(Self { approvals })
    }

    pub fn validate_event(
        &self,
        snapshot: &DataSnapshotRecord,
        event: &Value,
        usage: SnapshotUsage,
        observed_at: DateTime<Utc>,
    ) -> Result<(), SourceAuthorizationError> {
        let approval = self
            .approvals
            .iter()
            .find(|a| {
                a.tenant_id == snapshot.tenant_id
                    && event["provider"] == a.provider
                    && event["dataset"] == a.dataset
            })
            .ok_or(SourceAuthorizationError(
                "provider/dataset/tenant not approved",
            ))?;
        if !approval.enabled
            || observed_at >= approval.expires_at
            || !approval.allowed_usages.contains(&usage)
            || event["license_label"] != approval.license_label
            || event["approval_reference"] != approval.approval_reference
            || event["approval_version"] != approval.approval_version
            || snapshot.license_label != approval.license_label
        {
            return Err(SourceAuthorizationError(
                "expired, revoked or out-of-scope source",
            ));
        }
        let symbol = event["normalized_symbol"]
            .as_str()
            .ok_or(SourceAuthorizationError("symbol missing"))?;
        if !approval.symbols.iter().any(|s| s == symbol)
            || !snapshot.symbols.iter().any(|s| s == symbol)
            || event["source_tick_id"]
                .as_str()
                .is_none_or(|s| s.trim().is_empty())
            || !snapshot.sources.iter().any(|s| {
                s.provider == approval.provider
                    && s.dataset == approval.dataset
                    && s.license_label == approval.license_label
                    && (s.source_id == format!("market:{}:{symbol}", approval.provider)
                        || event["source_tick_id"] == s.source_id)
            })
        {
            return Err(SourceAuthorizationError(
                "unbound source identity or symbol",
            ));
        }
        let at: DateTime<Utc> = serde_json::from_value(event["event_time"].clone())
            .map_err(|_| SourceAuthorizationError("source time missing"))?;
        if at < snapshot.window.start_at || at > snapshot.window.end_at || at > observed_at {
            return Err(SourceAuthorizationError("source outside snapshot window"));
        }
        if !matches!(event["quality"].as_str(), Some("passed" | "degraded"))
            || (snapshot.quality == SnapshotQuality::Passed && event["quality"] != "passed")
        {
            return Err(SourceAuthorizationError(
                "source quality cannot be promoted",
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "../tests/unit/provenance.rs"]
mod tests;
