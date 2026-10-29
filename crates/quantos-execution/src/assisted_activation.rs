//! Owner-installed C11 runtime lease, distinct from risk kill generation and
//! approval policy revision. Existing receipts and UNKNOWN reservations never reset.
use crate::assisted::Error;
use chrono::{DateTime, Utc};
use quantos_core::ContentHash;
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RuntimeActivation {
    pub version: u64,
    pub enabled: bool,
    pub valid_from: DateTime<Utc>,
    pub valid_until: DateTime<Utc>,
    pub head: ContentHash,
}
impl RuntimeActivation {
    pub fn effective(&self, at: DateTime<Utc>) -> bool {
        self.enabled && self.valid_from <= at && at < self.valid_until
    }
    pub fn validate(&self) -> Result<(), Error> {
        if self.valid_until <= self.valid_from {
            Err(Error::Invalid)
        } else {
            Ok(())
        }
    }
    pub fn advances(&self, previous: &Option<Self>) -> Result<(), Error> {
        self.validate()?;
        if previous
            .as_ref()
            .is_some_and(|p| self.version < p.version || self.version == p.version && self != p)
        {
            Err(Error::Conflict)
        } else {
            Ok(())
        }
    }
}
