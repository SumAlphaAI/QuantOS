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
    DecisionId, EventId, FixtureId, InboxEntryId, OutboxEntryId, ProposalId, RuntimeSessionId,
    SchemaEntryId, SnapshotId, TaskAttemptId, TenantId, WorkflowRunId, WorkspaceId,
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

#[cfg(test)]
mod tests {
    use super::{
        BuildVersion, ContentHash, FixtureBuilder, HealthReport, SchemaVersion, WORKSPACE_NAME,
    };
    use serde_json::json;

    #[test]
    fn workspace_name_is_stable() {
        assert_eq!(WORKSPACE_NAME, "sumalpha-quantos");
    }

    #[test]
    fn ready_report_marks_service_ready() {
        let report = HealthReport::ready("runtime-gateway");

        assert!(report.ready);
        assert_eq!(report.service, "runtime-gateway");
    }

    #[test]
    fn fixture_hash_is_stable_for_same_payload() {
        let version = SchemaVersion::parse("v1").expect("schema version parses");
        let fixture_a = FixtureBuilder::new("trade-command", version.clone())
            .with_field("symbol", "BTCUSDT")
            .expect("field serializes")
            .with_field("details", json!({ "limit": "65000.25", "side": "buy" }))
            .expect("field serializes")
            .build()
            .expect("fixture builds");
        let fixture_b = FixtureBuilder::new("trade-command", version)
            .with_field("details", json!({ "side": "buy", "limit": "65000.25" }))
            .expect("field serializes")
            .with_field("symbol", "BTCUSDT")
            .expect("field serializes")
            .build()
            .expect("fixture builds");

        assert_eq!(fixture_a.hash, fixture_b.hash);
        assert_eq!(
            fixture_a.hash,
            ContentHash::sha256_bytes(fixture_a.canonical_json().as_bytes())
        );
    }

    #[test]
    fn build_version_uses_semver_primitives() {
        let version = BuildVersion::parse("1.4.2").expect("version parses");

        assert_eq!(version.to_string(), "1.4.2");
    }
}
