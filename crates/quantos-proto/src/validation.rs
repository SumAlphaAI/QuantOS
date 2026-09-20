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
    fn validate_children(&self) -> Result<(), MetadataValidationError> {
        Ok(())
    }
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
    crate::quantos::trading::v1::RiskDecision,
    crate::quantos::trading::v1::TradeCommand,
    crate::quantos::trading::v1::Order,
    crate::quantos::trading::v1::Fill,
    crate::quantos::trading::v1::Position,
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
    crate::quantos::events::v1::ListEventsRequest,
);

impl HasCommandMetadata for crate::quantos::engine::v1::StreamExecuteRequest {
    fn command_metadata(&self) -> Option<&CommandMetadata> {
        self.request.as_ref()?.metadata.as_ref()
    }
}

pub fn validate_message_metadata<T: HasCommandMetadata>(
    message: &T,
) -> Result<(), MetadataValidationError> {
    validate_command_metadata(message.command_metadata())?;
    message.validate_children()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quantos::common::v1::{ActorKind, ActorRef, Environment, RuntimeMode};
    use crate::quantos::trading::v1::TradeCommand;

    pub(super) fn valid_metadata() -> CommandMetadata {
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

macro_rules! nested_metadata {
    ($ty:path, $this:ident, $body:block) => {
        impl HasCommandMetadata for $ty {
            fn command_metadata(&self) -> Option<&CommandMetadata> {
                self.metadata.as_ref()
            }
            fn validate_children(&self) -> Result<(), MetadataValidationError> {
                let $this = self;
                $body
            }
        }
    };
}
nested_metadata!(crate::quantos::trading::v1::TradeProposal, value, {
    validate_message_metadata(
        value
            .signal
            .as_ref()
            .ok_or(MetadataValidationError { field: "signal" })?,
    )
});
nested_metadata!(crate::quantos::events::v1::GetEventResponse, value, {
    validate_message_metadata(
        value
            .event
            .as_ref()
            .ok_or(MetadataValidationError { field: "event" })?,
    )
});
nested_metadata!(crate::quantos::events::v1::ListEventsResponse, value, {
    for event in &value.events {
        validate_message_metadata(event)?;
    }
    Ok(())
});
nested_metadata!(crate::quantos::events::v1::EventEnvelope, value, {
    use crate::quantos::events::v1::event_envelope::Payload;
    match &value.payload {
        None => Ok(()),
        Some(Payload::DataSnapshot(child)) => validate_message_metadata(child),
        Some(Payload::ResearchArtifact(child)) => validate_message_metadata(child),
        Some(Payload::Signal(child)) => validate_message_metadata(child),
        Some(Payload::TradeProposal(child)) => validate_message_metadata(child),
        Some(Payload::RiskDecision(child)) => validate_message_metadata(child),
        Some(Payload::TradeCommand(child)) => validate_message_metadata(child),
        Some(Payload::Order(child)) => validate_message_metadata(child),
        Some(Payload::Fill(child)) => validate_message_metadata(child),
        Some(Payload::Position(child)) => validate_message_metadata(child),
    }
});

#[cfg(test)]
mod exhaustive_tests {
    use super::*;
    fn check<T: HasCommandMetadata + Default>(build: impl Fn(CommandMetadata) -> T) {
        assert!(validate_message_metadata(&T::default()).is_err());
        for gap in 0..11 {
            let mut metadata = tests::valid_metadata();
            match gap {
                0 => metadata.request_id.clear(),
                1 => metadata.tenant_id.clear(),
                2 => metadata.workspace_id.clear(),
                3 => metadata.correlation_id.clear(),
                4 => metadata.actor = None,
                5 => metadata.actor.as_mut().unwrap().actor_id.clear(),
                6 => metadata.actor.as_mut().unwrap().actor_kind = 0,
                7 => metadata.mode = 0,
                8 => metadata.environment = 0,
                9 => metadata.issued_at = None,
                _ => (),
            }
            assert_eq!(
                validate_message_metadata(&build(metadata)).is_ok(),
                gap == 10,
                "{} gap {gap}",
                std::any::type_name::<T>()
            );
        }
    }
    #[test]
    fn all_25_types_reject_each_identity_gap() {
        check(|metadata| crate::quantos::research::v1::DataSnapshot {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::research::v1::ResearchArtifact {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::strategy::v1::StrategyRelease {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::strategy::v1::Signal {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::trading::v1::TradeProposal {
            signal: Some(crate::quantos::strategy::v1::Signal {
                metadata: Some(tests::valid_metadata()),
                ..Default::default()
            }),
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::trading::v1::RiskDecision {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::trading::v1::TradeCommand {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::trading::v1::Order {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::trading::v1::Fill {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::trading::v1::Position {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::events::v1::EventEnvelope {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::events::v1::GetEventRequest {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::events::v1::GetEventResponse {
            event: Some(crate::quantos::events::v1::EventEnvelope {
                metadata: Some(tests::valid_metadata()),
                ..Default::default()
            }),
            metadata: Some(metadata),
        });
        check(|metadata| crate::quantos::events::v1::ListEventsRequest {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::events::v1::ListEventsResponse {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::engine::v1::GetMetadataRequest {
            metadata: Some(metadata),
        });
        check(|metadata| crate::quantos::engine::v1::GetMetadataResponse {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::engine::v1::HealthRequest {
            metadata: Some(metadata),
        });
        check(|metadata| crate::quantos::engine::v1::HealthResponse {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::engine::v1::ExecuteRequest {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::engine::v1::ExecuteResponse {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(
            |metadata| crate::quantos::engine::v1::StreamExecuteRequest {
                request: Some(crate::quantos::engine::v1::ExecuteRequest {
                    metadata: Some(metadata),
                    ..Default::default()
                }),
            },
        );
        check(
            |metadata| crate::quantos::engine::v1::StreamExecuteResponse {
                metadata: Some(metadata),
                ..Default::default()
            },
        );
        check(|metadata| crate::quantos::engine::v1::CancelRequest {
            metadata: Some(metadata),
            ..Default::default()
        });
        check(|metadata| crate::quantos::engine::v1::CancelResponse {
            metadata: Some(metadata),
            ..Default::default()
        });
    }
    #[test]
    fn nested_event_paths_are_checked() {
        use crate::quantos::events::v1::*;
        let event = EventEnvelope {
            metadata: Some(tests::valid_metadata()),
            payload: Some(event_envelope::Payload::DataSnapshot(Default::default())),
            ..Default::default()
        };
        assert!(validate_message_metadata(&event).is_err());
        assert!(
            validate_message_metadata(&GetEventResponse {
                metadata: Some(tests::valid_metadata()),
                event: Some(event.clone())
            })
            .is_err()
        );
        assert!(
            validate_message_metadata(&ListEventsResponse {
                metadata: Some(tests::valid_metadata()),
                events: vec![event]
            })
            .is_err()
        );
        let event = EventEnvelope {
            metadata: Some(tests::valid_metadata()),
            payload: Some(event_envelope::Payload::ResearchArtifact(Default::default())),
            ..Default::default()
        };
        assert!(validate_message_metadata(&event).is_err());
        assert!(
            validate_message_metadata(&GetEventResponse {
                metadata: Some(tests::valid_metadata()),
                event: Some(event.clone())
            })
            .is_err()
        );
        assert!(
            validate_message_metadata(&ListEventsResponse {
                metadata: Some(tests::valid_metadata()),
                events: vec![event]
            })
            .is_err()
        );
        let event = EventEnvelope {
            metadata: Some(tests::valid_metadata()),
            payload: Some(event_envelope::Payload::Signal(Default::default())),
            ..Default::default()
        };
        assert!(validate_message_metadata(&event).is_err());
        assert!(
            validate_message_metadata(&GetEventResponse {
                metadata: Some(tests::valid_metadata()),
                event: Some(event.clone())
            })
            .is_err()
        );
        assert!(
            validate_message_metadata(&ListEventsResponse {
                metadata: Some(tests::valid_metadata()),
                events: vec![event]
            })
            .is_err()
        );
        let event = EventEnvelope {
            metadata: Some(tests::valid_metadata()),
            payload: Some(event_envelope::Payload::TradeProposal(Default::default())),
            ..Default::default()
        };
        assert!(validate_message_metadata(&event).is_err());
        assert!(
            validate_message_metadata(&GetEventResponse {
                metadata: Some(tests::valid_metadata()),
                event: Some(event.clone())
            })
            .is_err()
        );
        assert!(
            validate_message_metadata(&ListEventsResponse {
                metadata: Some(tests::valid_metadata()),
                events: vec![event]
            })
            .is_err()
        );
        let event = EventEnvelope {
            metadata: Some(tests::valid_metadata()),
            payload: Some(event_envelope::Payload::RiskDecision(Default::default())),
            ..Default::default()
        };
        assert!(validate_message_metadata(&event).is_err());
        assert!(
            validate_message_metadata(&GetEventResponse {
                metadata: Some(tests::valid_metadata()),
                event: Some(event.clone())
            })
            .is_err()
        );
        assert!(
            validate_message_metadata(&ListEventsResponse {
                metadata: Some(tests::valid_metadata()),
                events: vec![event]
            })
            .is_err()
        );
        let event = EventEnvelope {
            metadata: Some(tests::valid_metadata()),
            payload: Some(event_envelope::Payload::TradeCommand(Default::default())),
            ..Default::default()
        };
        assert!(validate_message_metadata(&event).is_err());
        assert!(
            validate_message_metadata(&GetEventResponse {
                metadata: Some(tests::valid_metadata()),
                event: Some(event.clone())
            })
            .is_err()
        );
        assert!(
            validate_message_metadata(&ListEventsResponse {
                metadata: Some(tests::valid_metadata()),
                events: vec![event]
            })
            .is_err()
        );
        let event = EventEnvelope {
            metadata: Some(tests::valid_metadata()),
            payload: Some(event_envelope::Payload::Order(Default::default())),
            ..Default::default()
        };
        assert!(validate_message_metadata(&event).is_err());
        assert!(
            validate_message_metadata(&GetEventResponse {
                metadata: Some(tests::valid_metadata()),
                event: Some(event.clone())
            })
            .is_err()
        );
        assert!(
            validate_message_metadata(&ListEventsResponse {
                metadata: Some(tests::valid_metadata()),
                events: vec![event]
            })
            .is_err()
        );
        let event = EventEnvelope {
            metadata: Some(tests::valid_metadata()),
            payload: Some(event_envelope::Payload::Fill(Default::default())),
            ..Default::default()
        };
        assert!(validate_message_metadata(&event).is_err());
        assert!(
            validate_message_metadata(&GetEventResponse {
                metadata: Some(tests::valid_metadata()),
                event: Some(event.clone())
            })
            .is_err()
        );
        assert!(
            validate_message_metadata(&ListEventsResponse {
                metadata: Some(tests::valid_metadata()),
                events: vec![event]
            })
            .is_err()
        );
        let event = EventEnvelope {
            metadata: Some(tests::valid_metadata()),
            payload: Some(event_envelope::Payload::Position(Default::default())),
            ..Default::default()
        };
        assert!(validate_message_metadata(&event).is_err());
        assert!(
            validate_message_metadata(&GetEventResponse {
                metadata: Some(tests::valid_metadata()),
                event: Some(event.clone())
            })
            .is_err()
        );
        assert!(
            validate_message_metadata(&ListEventsResponse {
                metadata: Some(tests::valid_metadata()),
                events: vec![event]
            })
            .is_err()
        );
    }
}
