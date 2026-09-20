use chrono::{DateTime, FixedOffset, Utc};

use crate::CoreError;

pub trait UtcClock {
    fn now(&self) -> DateTime<Utc>;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct SystemUtcClock;

impl UtcClock for SystemUtcClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

#[derive(Debug, Clone, Copy)]
pub struct FixedUtcClock {
    now: DateTime<Utc>,
}

impl FixedUtcClock {
    #[must_use]
    pub const fn new(now: DateTime<Utc>) -> Self {
        Self { now }
    }
}

impl UtcClock for FixedUtcClock {
    fn now(&self) -> DateTime<Utc> {
        self.now
    }
}

pub fn parse_utc_rfc3339(value: &str) -> Result<DateTime<Utc>, CoreError> {
    DateTime::<FixedOffset>::parse_from_rfc3339(value)
        .map(|parsed| parsed.with_timezone(&Utc))
        .map_err(|_| CoreError::invalid_timestamp(value))
}
