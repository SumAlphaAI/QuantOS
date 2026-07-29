use std::str::FromStr;

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::CoreError;

pub const MAX_MONEY_SCALE: u32 = 9;
pub const MAX_QUANTITY_SCALE: u32 = 12;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Money {
    pub currency: String,
    pub amount: Decimal,
}

impl Money {
    pub fn new(currency: impl Into<String>, amount: Decimal) -> Result<Self, CoreError> {
        let currency = currency.into();
        validate_currency_code(&currency)?;
        validate_scale(amount, MAX_MONEY_SCALE, CoreError::invalid_money_scale)?;

        Ok(Self { currency, amount })
    }

    pub fn parse_str(currency: impl Into<String>, amount: &str) -> Result<Self, CoreError> {
        let amount = Decimal::from_str(amount)
            .map_err(|_| CoreError::invalid_money_scale(amount, MAX_MONEY_SCALE))?;
        Self::new(currency, amount)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Quantity(Decimal);

impl Quantity {
    pub fn new(value: Decimal) -> Result<Self, CoreError> {
        if value.is_sign_negative() {
            return Err(CoreError::invalid_quantity(&value.to_string()));
        }
        validate_scale(value, MAX_QUANTITY_SCALE, CoreError::invalid_quantity_scale)?;
        Ok(Self(value))
    }

    pub fn parse_str(value: &str) -> Result<Self, CoreError> {
        let decimal = Decimal::from_str(value)
            .map_err(|_| CoreError::invalid_quantity_scale(value, MAX_QUANTITY_SCALE))?;
        Self::new(decimal)
    }

    #[must_use]
    pub const fn value(self) -> Decimal {
        self.0
    }
}

fn validate_currency_code(value: &str) -> Result<(), CoreError> {
    if value.len() == 3 && value.chars().all(|ch| ch.is_ascii_uppercase()) {
        Ok(())
    } else {
        Err(CoreError::invalid_currency_code(value))
    }
}

fn validate_scale(
    value: Decimal,
    max_scale: u32,
    error: fn(&str, u32) -> CoreError,
) -> Result<(), CoreError> {
    if value.scale() <= max_scale {
        Ok(())
    } else {
        Err(error(&value.to_string(), max_scale))
    }
}

#[cfg(test)]
mod tests {
    use rust_decimal::Decimal;

    use super::{MAX_MONEY_SCALE, MAX_QUANTITY_SCALE, Money, Quantity};

    #[test]
    fn money_accepts_max_supported_scale() {
        let amount = Decimal::from_str_exact("1.123456789").expect("decimal parses");
        let money = Money::new("USD", amount).expect("money should parse");

        assert_eq!(money.amount.scale(), MAX_MONEY_SCALE);
    }

    #[test]
    fn money_rejects_excess_scale() {
        let error = Money::parse_str("USD", "1.1234567891").expect_err("money should fail");

        assert_eq!(error.machine_code(), "CORE_INVALID_MONEY_SCALE");
    }

    #[test]
    fn money_rejects_invalid_currency_codes() {
        let error = Money::parse_str("usd", "1.25").expect_err("currency should fail");

        assert_eq!(error.machine_code(), "CORE_INVALID_CURRENCY_CODE");
    }

    #[test]
    fn quantity_accepts_zero_and_high_precision_boundaries() {
        let zero = Quantity::parse_str("0").expect("zero quantity should be valid");
        let high_precision =
            Quantity::parse_str("42.123456789012").expect("boundary quantity should parse");

        assert_eq!(zero.value().to_string(), "0");
        assert_eq!(high_precision.value().scale(), MAX_QUANTITY_SCALE);
    }

    #[test]
    fn quantity_rejects_negative_values() {
        let error = Quantity::parse_str("-0.01").expect_err("negative quantity should fail");

        assert_eq!(error.machine_code(), "CORE_INVALID_QUANTITY");
    }

    #[test]
    fn quantity_rejects_excess_precision() {
        let error =
            Quantity::parse_str("0.1234567890123").expect_err("quantity precision should fail");

        assert_eq!(error.machine_code(), "CORE_INVALID_QUANTITY_SCALE");
    }
}
