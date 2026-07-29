use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ErrorCode {
    InvalidId,
    InvalidTimestamp,
    InvalidCurrencyCode,
    InvalidMoneyScale,
    InvalidQuantity,
    InvalidQuantityScale,
    InvalidSchemaVersion,
    InvalidBuildVersion,
    InvalidContentHash,
    SerializationFailure,
}

impl ErrorCode {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::InvalidId => "CORE_INVALID_ID",
            Self::InvalidTimestamp => "CORE_INVALID_TIMESTAMP",
            Self::InvalidCurrencyCode => "CORE_INVALID_CURRENCY_CODE",
            Self::InvalidMoneyScale => "CORE_INVALID_MONEY_SCALE",
            Self::InvalidQuantity => "CORE_INVALID_QUANTITY",
            Self::InvalidQuantityScale => "CORE_INVALID_QUANTITY_SCALE",
            Self::InvalidSchemaVersion => "CORE_INVALID_SCHEMA_VERSION",
            Self::InvalidBuildVersion => "CORE_INVALID_BUILD_VERSION",
            Self::InvalidContentHash => "CORE_INVALID_CONTENT_HASH",
            Self::SerializationFailure => "CORE_SERIALIZATION_FAILURE",
        }
    }
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoreError {
    code: ErrorCode,
    message: String,
}

impl CoreError {
    #[must_use]
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    #[must_use]
    pub fn code(&self) -> ErrorCode {
        self.code
    }

    #[must_use]
    pub fn machine_code(&self) -> &'static str {
        self.code.as_str()
    }

    #[must_use]
    pub fn message(&self) -> &str {
        &self.message
    }

    #[must_use]
    pub fn invalid_id(kind: &'static str, value: &str) -> Self {
        Self::new(
            ErrorCode::InvalidId,
            format!("invalid {kind} value `{value}`"),
        )
    }

    #[must_use]
    pub fn invalid_timestamp(value: &str) -> Self {
        Self::new(
            ErrorCode::InvalidTimestamp,
            format!("invalid RFC3339 timestamp `{value}`"),
        )
    }

    #[must_use]
    pub fn invalid_currency_code(value: &str) -> Self {
        Self::new(
            ErrorCode::InvalidCurrencyCode,
            format!("currency code must be 3 uppercase ASCII letters, got `{value}`"),
        )
    }

    #[must_use]
    pub fn invalid_money_scale(value: &str, max_scale: u32) -> Self {
        Self::new(
            ErrorCode::InvalidMoneyScale,
            format!("money `{value}` exceeds max scale {max_scale}"),
        )
    }

    #[must_use]
    pub fn invalid_quantity(value: &str) -> Self {
        Self::new(
            ErrorCode::InvalidQuantity,
            format!("quantity must be non-negative, got `{value}`"),
        )
    }

    #[must_use]
    pub fn invalid_quantity_scale(value: &str, max_scale: u32) -> Self {
        Self::new(
            ErrorCode::InvalidQuantityScale,
            format!("quantity `{value}` exceeds max scale {max_scale}"),
        )
    }

    #[must_use]
    pub fn invalid_schema_version(value: &str) -> Self {
        Self::new(
            ErrorCode::InvalidSchemaVersion,
            format!(
                "schema version must start with `v` and contain lowercase ASCII version tags, got `{value}`"
            ),
        )
    }

    #[must_use]
    pub fn invalid_build_version(value: &str) -> Self {
        Self::new(
            ErrorCode::InvalidBuildVersion,
            format!("build version must be valid semver, got `{value}`"),
        )
    }

    #[must_use]
    pub fn invalid_content_hash(value: &str) -> Self {
        Self::new(
            ErrorCode::InvalidContentHash,
            format!("content hash must match `sha256:<64 lowercase hex>`, got `{value}`"),
        )
    }

    #[must_use]
    pub fn serialization_failure(context: &'static str, detail: &str) -> Self {
        Self::new(
            ErrorCode::SerializationFailure,
            format!("failed to serialize {context}: {detail}"),
        )
    }
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for CoreError {}

#[cfg(test)]
mod tests {
    use super::{CoreError, ErrorCode};

    #[test]
    fn every_error_maps_to_stable_machine_code() {
        let error = CoreError::invalid_money_scale("12.1234567891", 9);

        assert_eq!(error.code(), ErrorCode::InvalidMoneyScale);
        assert_eq!(error.machine_code(), "CORE_INVALID_MONEY_SCALE");
        assert!(error.to_string().contains("CORE_INVALID_MONEY_SCALE"));
    }
}
