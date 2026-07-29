use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{ContentHash, CoreError, FixtureId, SchemaVersion};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Fixture {
    pub fixture_id: FixtureId,
    pub kind: String,
    pub schema_version: SchemaVersion,
    pub fields: BTreeMap<String, Value>,
    pub hash: ContentHash,
}

impl Fixture {
    pub fn canonical_json(&self) -> String {
        let document = fixture_hash_document(&self.kind, &self.schema_version, &self.fields);

        canonical_json_string(&document).expect("fixture canonicalization should not fail")
    }
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

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::{FixtureBuilder, SchemaVersion};

    #[test]
    fn canonicalization_sorts_nested_objects_consistently() {
        let version = SchemaVersion::parse("v1").expect("schema version parses");
        let fixture_a = FixtureBuilder::new("snapshot", version.clone())
            .with_field("payload", json!({ "z": 2, "a": { "y": 1, "x": 0 } }))
            .expect("field serializes")
            .build()
            .expect("fixture builds");
        let fixture_b = FixtureBuilder::new("snapshot", version)
            .with_field("payload", json!({ "a": { "x": 0, "y": 1 }, "z": 2 }))
            .expect("field serializes")
            .build()
            .expect("fixture builds");

        assert_eq!(fixture_a.canonical_json(), fixture_b.canonical_json());
        assert_eq!(fixture_a.hash, fixture_b.hash);
    }
}
