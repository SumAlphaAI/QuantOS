use std::{fmt, str::FromStr};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::CoreError;

macro_rules! define_uuid_id {
    ($name:ident) => {
        #[derive(
            Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
        )]
        #[serde(transparent)]
        pub struct $name(Uuid);

        impl $name {
            #[must_use]
            pub fn new() -> Self {
                Self(Uuid::now_v7())
            }

            #[must_use]
            pub const fn from_uuid(value: Uuid) -> Self {
                Self(value)
            }

            pub fn parse_str(value: &str) -> Result<Self, CoreError> {
                Uuid::parse_str(value)
                    .map(Self)
                    .map_err(|_| CoreError::invalid_id(stringify!($name), value))
            }

            #[must_use]
            pub const fn as_uuid(&self) -> &Uuid {
                &self.0
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}", self.0)
            }
        }

        impl FromStr for $name {
            type Err = CoreError;

            fn from_str(s: &str) -> Result<Self, Self::Err> {
                Self::parse_str(s)
            }
        }
    };
}

define_uuid_id!(TenantId);
define_uuid_id!(WorkspaceId);
define_uuid_id!(ActorId);
define_uuid_id!(AccountId);
define_uuid_id!(RuntimeSessionId);
define_uuid_id!(WorkflowRunId);
define_uuid_id!(TaskAttemptId);
define_uuid_id!(ArtifactId);
define_uuid_id!(SnapshotId);
define_uuid_id!(AuditEntryId);
define_uuid_id!(ProposalId);
define_uuid_id!(DecisionId);
define_uuid_id!(CommandId);
define_uuid_id!(CorrelationId);
define_uuid_id!(DeadLetterId);
define_uuid_id!(EventId);
define_uuid_id!(FixtureId);
define_uuid_id!(InboxEntryId);
define_uuid_id!(OutboxEntryId);
define_uuid_id!(SchemaEntryId);
define_uuid_id!(StrategyDraftId);
define_uuid_id!(DraftVersionId);
