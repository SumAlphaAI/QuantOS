//! Proto3 enum fields retain unknown i32 values; known values keep their JSON names.
use serde::{Deserialize, Serialize};

pub(crate) fn enum_value<T: TryFrom<i32> + Serialize>(
    value: i32,
) -> Result<serde_json::Value, serde_json::Error> {
    match T::try_from(value) {
        Ok(known) => serde_json::to_value(known),
        Err(_) => Ok(value.into()),
    }
}

pub(crate) struct OpenEnum<T> {
    pub value: i32,
    marker: std::marker::PhantomData<T>,
}
impl<'de, T: serde::de::DeserializeOwned> Deserialize<'de> for OpenEnum<T>
where
    T: Into<i32>,
{
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let raw = serde_json::Value::deserialize(deserializer)?;
        let value = if raw.is_number() {
            raw.as_i64()
                .and_then(|v| i32::try_from(v).ok())
                .ok_or_else(|| serde::de::Error::custom("enum number must be an i32"))?
        } else {
            serde_json::from_value::<T>(raw)
                .map_err(serde::de::Error::custom)?
                .into()
        };
        Ok(Self {
            value,
            marker: std::marker::PhantomData,
        })
    }
}
