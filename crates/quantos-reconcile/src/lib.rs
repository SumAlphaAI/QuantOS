//! X05 trusted Shadow observation and reconciliation. `legacy` remains synthetic
//! fixture compatibility. The new runner has no venue, execution or command issuer.
pub mod legacy;
pub use legacy::*;
pub mod current;
pub mod exceptions;
pub mod model;
pub mod reconciliation;
pub mod shadow;
