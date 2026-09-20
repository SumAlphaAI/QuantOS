use std::str::FromStr;

use rust_decimal::Decimal;
use serde::{Deserialize, Deserializer, Serialize, de};
use serde_json::Value;

use crate::CoreError;

pub const MAX_MONEY_SCALE: u32 = 9;
pub const MAX_QUANTITY_SCALE: u32 = 12;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Money {
    currency: String,
    amount: Decimal,
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

    #[must_use]
    pub fn currency(&self) -> &str {
        &self.currency
    }

    #[must_use]
    pub const fn amount(&self) -> Decimal {
        self.amount
    }
}

impl<'de> Deserialize<'de> for Money {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let Value::Object(mut fields) = Value::deserialize(deserializer)? else {
            return Err(de::Error::custom("money must be a JSON object"));
        };
        let currency = fields
            .remove("currency")
            .and_then(|value| value.as_str().map(str::to_owned))
            .ok_or_else(|| de::Error::custom("money currency must be a string"))?;
        let amount = fields
            .remove("amount")
            .ok_or_else(|| de::Error::missing_field("amount"))?;
        if !fields.is_empty() {
            return Err(de::Error::custom("money contains unknown fields"));
        }
        let amount = serde_json::from_value::<Decimal>(amount).map_err(de::Error::custom)?;
        Self::new(currency, amount).map_err(de::Error::custom)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
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

impl<'de> Deserialize<'de> for Quantity {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = <Decimal as Deserialize>::deserialize(deserializer)?;
        Self::new(value).map_err(de::Error::custom)
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
