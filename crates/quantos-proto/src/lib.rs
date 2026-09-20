#![allow(clippy::derive_partial_eq_without_eq)]

pub mod generated;
mod validation;

pub use generated::quantos;
pub use validation::{
    HasCommandMetadata, MetadataValidationError, validate_command_metadata,
    validate_message_metadata,
};
