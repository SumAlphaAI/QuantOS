pub mod clock;
pub mod error;
pub mod fixture;
pub mod id;
pub mod precision;
pub mod versioning;

pub use clock::{FixedUtcClock, SystemUtcClock, UtcClock, parse_utc_rfc3339};
pub use error::{CoreError, ErrorCode};
pub use fixture::{Fixture, FixtureBuilder, canonical_json_bytes};
pub use id::{
    AccountId, ActorId, ArtifactId, AuditEntryId, CommandId, CorrelationId, DeadLetterId,
    DecisionId, DraftVersionId, EventId, FixtureId, InboxEntryId, OutboxEntryId, ProposalId,
    RuntimeSessionId, SchemaEntryId, SnapshotId, StrategyDraftId, TaskAttemptId, TenantId,
    WorkflowRunId, WorkspaceId,
};
pub use precision::{MAX_MONEY_SCALE, MAX_QUANTITY_SCALE, Money, Quantity};
pub use versioning::{BuildVersion, ContentHash, SchemaVersion};

use serde::{Deserialize, Serialize};

pub const WORKSPACE_NAME: &str = "sumalpha-quantos";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HealthReport {
    pub service: &'static str,
    pub ready: bool,
}

impl HealthReport {
    #[must_use]
    pub fn ready(service: &'static str) -> Self {
        Self {
            service,
            ready: true,
        }
    }
}
