use std::fmt;

use crate::quantos::common::v1::CommandMetadata;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MetadataValidationError {
    pub field: &'static str,
}

impl fmt::Display for MetadataValidationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "required command metadata field is missing or invalid: {}",
            self.field
        )
    }
}

impl std::error::Error for MetadataValidationError {}

fn require_text(value: &str, field: &'static str) -> Result<(), MetadataValidationError> {
    if value.trim().is_empty() {
        return Err(MetadataValidationError { field });
    }
    Ok(())
}

pub fn validate_command_metadata(
    metadata: Option<&CommandMetadata>,
) -> Result<(), MetadataValidationError> {
    let metadata = metadata.ok_or(MetadataValidationError { field: "metadata" })?;
    require_text(&metadata.request_id, "metadata.request_id")?;
    require_text(&metadata.tenant_id, "metadata.tenant_id")?;
    require_text(&metadata.workspace_id, "metadata.workspace_id")?;
    require_text(&metadata.correlation_id, "metadata.correlation_id")?;
    if metadata.mode == 0 {
        return Err(MetadataValidationError {
            field: "metadata.mode",
        });
    }
    if metadata.environment == 0 {
        return Err(MetadataValidationError {
            field: "metadata.environment",
        });
    }
    if metadata.issued_at.is_none() {
        return Err(MetadataValidationError {
            field: "metadata.issued_at",
        });
    }
    let actor = metadata.actor.as_ref().ok_or(MetadataValidationError {
        field: "metadata.actor",
    })?;
    require_text(&actor.actor_id, "metadata.actor.actor_id")?;
    if actor.actor_kind == 0 {
        return Err(MetadataValidationError {
            field: "metadata.actor.actor_kind",
        });
    }
    Ok(())
}

pub trait HasCommandMetadata {
    fn command_metadata(&self) -> Option<&CommandMetadata>;
}

macro_rules! impl_has_metadata {
    ($($type:path),+ $(,)?) => {
        $(
            impl HasCommandMetadata for $type {
                fn command_metadata(&self) -> Option<&CommandMetadata> {
                    self.metadata.as_ref()
                }
            }
        )+
    };
}

impl_has_metadata!(
    crate::quantos::research::v1::DataSnapshot,
    crate::quantos::research::v1::ResearchArtifact,
    crate::quantos::strategy::v1::StrategyRelease,
    crate::quantos::strategy::v1::Signal,
    crate::quantos::trading::v1::TradeProposal,
    crate::quantos::trading::v1::RiskDecision,
    crate::quantos::trading::v1::TradeCommand,
    crate::quantos::trading::v1::Order,
    crate::quantos::trading::v1::Fill,
    crate::quantos::trading::v1::Position,
    crate::quantos::events::v1::EventEnvelope,
    crate::quantos::engine::v1::GetMetadataRequest,
    crate::quantos::engine::v1::GetMetadataResponse,
    crate::quantos::engine::v1::HealthRequest,
    crate::quantos::engine::v1::HealthResponse,
    crate::quantos::engine::v1::ExecuteRequest,
    crate::quantos::engine::v1::ExecuteResponse,
    crate::quantos::engine::v1::StreamExecuteResponse,
    crate::quantos::engine::v1::CancelRequest,
    crate::quantos::engine::v1::CancelResponse,
    crate::quantos::events::v1::GetEventRequest,
    crate::quantos::events::v1::GetEventResponse,
    crate::quantos::events::v1::ListEventsRequest,
    crate::quantos::events::v1::ListEventsResponse,
);

impl HasCommandMetadata for crate::quantos::engine::v1::StreamExecuteRequest {
    fn command_metadata(&self) -> Option<&CommandMetadata> {
        self.request.as_ref()?.metadata.as_ref()
    }
}

pub fn validate_message_metadata<T: HasCommandMetadata>(
    message: &T,
) -> Result<(), MetadataValidationError> {
    validate_command_metadata(message.command_metadata())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quantos::common::v1::{ActorKind, ActorRef, Environment, RuntimeMode};
    use crate::quantos::trading::v1::TradeCommand;

    fn valid_metadata() -> CommandMetadata {
        CommandMetadata {
            request_id: "request-1".into(),
            tenant_id: "tenant-1".into(),
            workspace_id: "workspace-1".into(),
            actor: Some(ActorRef {
                actor_id: "actor-1".into(),
                actor_kind: ActorKind::User as i32,
                display_name: String::new(),
                capabilities: vec![],
            }),
            correlation_id: "correlation-1".into(),
            causation_id: String::new(),
            mode: RuntimeMode::Paper as i32,
            environment: Environment::Test as i32,
            issued_at: Some(pbjson_types::Timestamp {
                seconds: 1,
                nanos: 0,
            }),
        }
    }

    #[test]
    fn rejects_missing_and_empty_security_metadata() {
        let command = TradeCommand::default();
        assert_eq!(
            validate_message_metadata(&command).unwrap_err().field,
            "metadata"
        );

        for (field, mutate) in [
            ("metadata.request_id", 0),
            ("metadata.tenant_id", 1),
            ("metadata.workspace_id", 2),
            ("metadata.correlation_id", 3),
        ] {
            let mut metadata = valid_metadata();
            match mutate {
                0 => metadata.request_id.clear(),
                1 => metadata.tenant_id.clear(),
                2 => metadata.workspace_id.clear(),
                _ => metadata.correlation_id.clear(),
            }
            assert_eq!(
                validate_command_metadata(Some(&metadata))
                    .unwrap_err()
                    .field,
                field
            );
        }
    }

    #[test]
    fn accepts_complete_security_metadata() {
        assert!(validate_command_metadata(Some(&valid_metadata())).is_ok());
    }
}
