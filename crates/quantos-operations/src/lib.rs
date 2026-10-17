//! SERVICE:X06 trusted-backend service. AuthContext and VerifiedStepUp come from
//! a verified session host. No public HTTP auth, database, ledger editor or shell.
//!
//! ```compile_fail
//! use quantos_operations::OperationsService;
//! use quantos_execution::gateway::ExecutionKernel;
//! fn cannot_edit_ledger<K: ExecutionKernel>(service: &OperationsService<K>) {
//!     service.adjust_balance("account", "1000000");
//! }
//! ```
//! ```compile_fail
//! use quantos_operations::VerifiedStepUp;
//! let forged: VerifiedStepUp = serde_json::from_str("{}").unwrap();
//! ```
//! ```compile_fail
//! use quantos_operations::CheckpointAnchor;
//! let forged: CheckpointAnchor = serde_json::from_str("{}").unwrap();
//! ```
mod model;
mod service;
mod telemetry;
pub use model::*;
pub use service::OperationsService;
