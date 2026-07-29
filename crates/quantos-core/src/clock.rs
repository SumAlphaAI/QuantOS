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

#[cfg(test)]
mod tests {
    use chrono::{TimeZone, Timelike, Utc};

    use super::{FixedUtcClock, UtcClock, parse_utc_rfc3339};

    #[test]
    fn fixed_clock_always_returns_same_utc_value() {
        let fixed = FixedUtcClock::new(
            Utc.with_ymd_and_hms(2026, 7, 28, 10, 30, 0)
                .single()
                .expect("valid timestamp"),
        );

        assert_eq!(fixed.now(), fixed.now());
    }

    #[test]
    fn parser_normalizes_positive_offset_to_utc() {
        let timestamp = parse_utc_rfc3339("2026-07-28T18:30:00+08:00").expect("timestamp parses");

        assert_eq!(timestamp.hour(), 10);
        assert_eq!(timestamp.minute(), 30);
        assert_eq!(timestamp.timezone(), Utc);
    }

    #[test]
    fn parser_normalizes_negative_offset_to_utc() {
        let timestamp = parse_utc_rfc3339("2026-01-05T01:15:00-05:00").expect("timestamp parses");

        assert_eq!(timestamp.hour(), 6);
        assert_eq!(timestamp.minute(), 15);
    }

    #[test]
    fn invalid_timestamps_return_stable_machine_codes() {
        let error = parse_utc_rfc3339("2026/07/28 18:30:00").expect_err("timestamp should fail");

        assert_eq!(error.machine_code(), "CORE_INVALID_TIMESTAMP");
    }
}
