//! Wire projection carries execution attribution. The protobuf is a reference,
//! not a replacement for persisted schema/lineage verification on consumption.
use crate::{DataSnapshotRecord, SnapshotError, pg::SnapshotWriteContext};
use chrono::{DateTime, Utc};
use quantos_core::{ActorId, CorrelationId, EventId, TenantId};
use quantos_proto::{
    generated::google::protobuf::{Duration, Timestamp},
    quantos::{
        common::v1::{ArtifactRef, CommandMetadata, DataSourceRef, TimeWindow},
        research::v1::DataSnapshot,
    },
};

impl SnapshotWriteContext {
    pub fn from_command_metadata(
        metadata: &CommandMetadata,
        reason: impl Into<String>,
    ) -> Result<Self, SnapshotError> {
        quantos_proto::validate_command_metadata(Some(metadata))
            .map_err(|_| SnapshotError::WriteContext)?;
        let actor = metadata.actor.as_ref().ok_or(SnapshotError::WriteContext)?;
        let context = Self {
            tenant_id: TenantId::parse_str(&metadata.tenant_id)?,
            actor_id: ActorId::parse_str(&actor.actor_id)?,
            correlation_id: CorrelationId::parse_str(&metadata.correlation_id)?,
            causation_id: EventId::parse_str(if metadata.causation_id.is_empty() {
                &metadata.request_id
            } else {
                &metadata.causation_id
            })?,
            reason: reason.into(),
        };
        context.validate(context.tenant_id)?;
        Ok(context)
    }
}

fn timestamp(t: DateTime<Utc>) -> Timestamp {
    Timestamp {
        seconds: t.timestamp(),
        nanos: t.timestamp_subsec_nanos() as i32,
    }
}

pub fn snapshot_to_wire(
    record: &DataSnapshotRecord,
    metadata: CommandMetadata,
) -> Result<DataSnapshot, SnapshotError> {
    record.validate_integrity()?;
    let context = SnapshotWriteContext::from_command_metadata(&metadata, "wire projection")?;
    context.validate(record.tenant_id)?;
    Ok(DataSnapshot {
        metadata: Some(metadata),
        snapshot_id: record.snapshot_id.to_string(),
        schema_version: record.schema_version.as_str().into(),
        window: Some(TimeWindow {
            start_at: Some(timestamp(record.window.start_at)),
            end_at: Some(timestamp(record.window.end_at)),
        }),
        sources: record
            .sources
            .iter()
            .map(|s| DataSourceRef {
                source_id: s.source_id.clone(),
                provider: s.provider.clone(),
                dataset: s.dataset.clone(),
                license_label: s.license_label.clone(),
            })
            .collect(),
        quality: match record.quality {
            crate::SnapshotQuality::Pending => 1,
            crate::SnapshotQuality::Passed => 2,
            crate::SnapshotQuality::Degraded => 3,
            crate::SnapshotQuality::Failed => 4,
        },
        content_hash: record.content_hash.as_str().into(),
        license_label: record.license_label.clone(),
        captured_at: Some(timestamp(record.captured_at)),
        max_age: Some(Duration {
            seconds: record.max_age_secs,
            nanos: 0,
        }),
        symbols: record.symbols.clone(),
        artifact_refs: record
            .artifact_refs
            .iter()
            .map(|a| ArtifactRef {
                artifact_id: a.artifact_id.to_string(),
                uri: format!("supabase://{}/{}", a.storage_bucket, a.object_key),
                media_type: a.media_type.clone(),
                sha256: a.content_hash.as_str().trim_start_matches("sha256:").into(),
                classification: 2,
            })
            .collect(),
    })
}

#[cfg(test)]
#[path = "../tests/unit/wire.rs"]
mod tests;

impl crate::pg::PgStorageStore {
    /// Resolve an untrusted wire projection using an independently authenticated
    /// server context. Canonical PG state and current source/quality rules win.
    pub fn resolve_snapshot_reference(
        &mut self,
        reference: &DataSnapshot,
        context: &SnapshotWriteContext,
        usage: crate::SnapshotUsage,
        observed_at: DateTime<Utc>,
        policy: &crate::provenance::SnapshotSourcePolicy,
    ) -> Result<DataSnapshotRecord, crate::pg::PgStorageError> {
        let metadata = reference
            .metadata
            .as_ref()
            .ok_or(SnapshotError::WriteContext)?;
        let supplied = SnapshotWriteContext::from_command_metadata(metadata, &context.reason)?;
        context.validate(context.tenant_id)?;
        if supplied.tenant_id != context.tenant_id
            || supplied.actor_id != context.actor_id
            || supplied.correlation_id != context.correlation_id
            || supplied.causation_id != context.causation_id
        {
            return Err(SnapshotError::WriteContext.into());
        }
        self.authorize_snapshot_reader(context.tenant_id, context.actor_id)?;
        let id = quantos_core::SnapshotId::parse_str(&reference.snapshot_id)?;
        let (snapshot, _) =
            self.load_authorized_snapshot(context.tenant_id, id, usage, observed_at, policy)?;
        if snapshot_to_wire(&snapshot, metadata.clone())? != *reference {
            return Err(crate::provenance::SourceAuthorizationError(
                "wire projection differs from persisted snapshot",
            )
            .into());
        }
        Ok(snapshot)
    }
}
