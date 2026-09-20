use std::collections::BTreeMap;

use serde::{Deserialize, Deserializer, Serialize, de};
use serde_json::Value;

use crate::{ContentHash, CoreError, FixtureId, SchemaVersion};

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Fixture {
    fixture_id: FixtureId,
    kind: String,
    schema_version: SchemaVersion,
    fields: BTreeMap<String, Value>,
    hash: ContentHash,
}

impl Fixture {
    pub fn canonical_json(&self) -> String {
        let document = fixture_hash_document(&self.kind, &self.schema_version, &self.fields);

        canonical_json_string(&document).expect("fixture canonicalization should not fail")
    }

    pub fn verify(&self) -> Result<(), CoreError> {
        let actual = ContentHash::sha256_bytes(self.canonical_json().as_bytes());
        if actual == self.hash {
            Ok(())
        } else {
            Err(CoreError::fixture_hash_mismatch(
                self.hash.as_str(),
                actual.as_str(),
            ))
        }
    }

    #[must_use]
    pub const fn fixture_id(&self) -> FixtureId {
        self.fixture_id
    }

    #[must_use]
    pub fn kind(&self) -> &str {
        &self.kind
    }

    #[must_use]
    pub fn schema_version(&self) -> &SchemaVersion {
        &self.schema_version
    }

    #[must_use]
    pub fn fields(&self) -> &BTreeMap<String, Value> {
        &self.fields
    }

    #[must_use]
    pub fn hash(&self) -> &ContentHash {
        &self.hash
    }
}

impl<'de> Deserialize<'de> for Fixture {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let Value::Object(mut fields) = Value::deserialize(deserializer)? else {
            return Err(de::Error::custom("fixture must be a JSON object"));
        };
        let fixture = Self {
            fixture_id: take_field(&mut fields, "fixture_id").map_err(de::Error::custom)?,
            kind: take_field(&mut fields, "kind").map_err(de::Error::custom)?,
            schema_version: take_field(&mut fields, "schema_version").map_err(de::Error::custom)?,
            fields: take_field(&mut fields, "fields").map_err(de::Error::custom)?,
            hash: take_field(&mut fields, "hash").map_err(de::Error::custom)?,
        };
        if !fields.is_empty() {
            return Err(de::Error::custom("fixture contains unknown fields"));
        }
        fixture.verify().map_err(de::Error::custom)?;
        Ok(fixture)
    }
}

fn take_field<T>(fields: &mut serde_json::Map<String, Value>, name: &str) -> Result<T, String>
where
    T: serde::de::DeserializeOwned,
{
    let value = fields
        .remove(name)
        .ok_or_else(|| format!("fixture is missing `{name}`"))?;
    serde_json::from_value(value).map_err(|error| format!("invalid fixture `{name}`: {error}"))
}

#[derive(Debug, Clone, PartialEq)]
pub struct FixtureBuilder {
    kind: String,
    schema_version: SchemaVersion,
    fields: BTreeMap<String, Value>,
}

impl FixtureBuilder {
    #[must_use]
    pub fn new(kind: impl Into<String>, schema_version: SchemaVersion) -> Self {
        Self {
            kind: kind.into(),
            schema_version,
            fields: BTreeMap::new(),
        }
    }

    pub fn with_field(
        mut self,
        key: impl Into<String>,
        value: impl Serialize,
    ) -> Result<Self, CoreError> {
        let key = key.into();
        let value = serde_json::to_value(value).map_err(|error| {
            CoreError::serialization_failure("fixture field", &error.to_string())
        })?;
        self.fields.insert(key, value);
        Ok(self)
    }

    pub fn build(self) -> Result<Fixture, CoreError> {
        let fixture_id = FixtureId::new();
        let document = fixture_hash_document(&self.kind, &self.schema_version, &self.fields);
        let canonical_json = canonical_json_string(&document)?;
        let hash = ContentHash::sha256_bytes(canonical_json.as_bytes());

        Ok(Fixture {
            fixture_id,
            kind: self.kind,
            schema_version: self.schema_version,
            fields: self.fields,
            hash,
        })
    }
}

fn fixture_hash_document(
    kind: &str,
    schema_version: &SchemaVersion,
    fields: &BTreeMap<String, Value>,
) -> Value {
    serde_json::json!({
        "kind": kind,
        "schema_version": schema_version.as_str(),
        "fields": fields,
    })
}

pub fn canonical_json_bytes(value: &Value) -> Result<Vec<u8>, CoreError> {
    canonical_json_string(value).map(String::into_bytes)
}

fn canonical_json_string(value: &Value) -> Result<String, CoreError> {
    let mut output = String::new();
    write_canonical_json(value, &mut output)?;
    Ok(output)
}

fn write_canonical_json(value: &Value, output: &mut String) -> Result<(), CoreError> {
    match value {
        Value::Null => output.push_str("null"),
        Value::Bool(boolean) => output.push_str(if *boolean { "true" } else { "false" }),
        Value::Number(number) => output.push_str(&number.to_string()),
        Value::String(string) => {
            let encoded = serde_json::to_string(string).map_err(|error| {
                CoreError::serialization_failure("fixture string", &error.to_string())
            })?;
            output.push_str(&encoded);
        }
        Value::Array(items) => {
            output.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                write_canonical_json(item, output)?;
            }
            output.push(']');
        }
        Value::Object(map) => {
            output.push('{');
            let mut entries = map.iter().collect::<Vec<_>>();
            entries.sort_by(|left, right| left.0.cmp(right.0));
            for (index, (key, item)) in entries.into_iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                let encoded = serde_json::to_string(key).map_err(|error| {
                    CoreError::serialization_failure("fixture object key", &error.to_string())
                })?;
                output.push_str(&encoded);
                output.push(':');
                write_canonical_json(item, output)?;
            }
            output.push('}');
        }
    }
    Ok(())
}
