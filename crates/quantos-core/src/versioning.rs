use std::{fmt, str::FromStr};

use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::CoreError;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SchemaVersion(String);

impl SchemaVersion {
    pub fn parse(value: &str) -> Result<Self, CoreError> {
        let mut chars = value.chars();
        let Some('v') = chars.next() else {
            return Err(CoreError::invalid_schema_version(value));
        };

        let suffix = chars.as_str();
        if suffix.is_empty()
            || !suffix.chars().all(|ch| {
                ch.is_ascii_lowercase() || ch.is_ascii_digit() || matches!(ch, '.' | '_' | '-')
            })
            || !suffix.chars().any(|ch| ch.is_ascii_digit())
        {
            return Err(CoreError::invalid_schema_version(value));
        }

        Ok(Self(value.to_owned()))
    }

    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for SchemaVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for SchemaVersion {
    type Err = CoreError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::parse(s)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct BuildVersion(Version);

impl BuildVersion {
    pub fn parse(value: &str) -> Result<Self, CoreError> {
        Version::parse(value)
            .map(Self)
            .map_err(|_| CoreError::invalid_build_version(value))
    }

    #[must_use]
    pub const fn as_semver(&self) -> &Version {
        &self.0
    }
}

impl fmt::Display for BuildVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl FromStr for BuildVersion {
    type Err = CoreError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::parse(s)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ContentHash(String);

impl ContentHash {
    pub fn parse(value: &str) -> Result<Self, CoreError> {
        let Some(hex_digest) = value.strip_prefix("sha256:") else {
            return Err(CoreError::invalid_content_hash(value));
        };

        if hex_digest.len() != 64
            || hex_digest != hex_digest.to_ascii_lowercase()
            || !hex_digest.chars().all(|ch| ch.is_ascii_hexdigit())
        {
            return Err(CoreError::invalid_content_hash(value));
        }

        Ok(Self(value.to_owned()))
    }

    #[must_use]
    pub fn sha256_bytes(bytes: &[u8]) -> Self {
        let digest = Sha256::digest(bytes);
        Self(format!("sha256:{}", hex::encode(digest)))
    }

    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for ContentHash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for ContentHash {
    type Err = CoreError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::parse(s)
    }
}

#[cfg(test)]
mod tests {
    use super::{BuildVersion, ContentHash, SchemaVersion};

    #[test]
    fn schema_versions_require_v_prefix() {
        let version = SchemaVersion::parse("v1").expect("schema version parses");

        assert_eq!(version.as_str(), "v1");
        assert_eq!(
            SchemaVersion::parse("1")
                .expect_err("version should fail")
                .machine_code(),
            "CORE_INVALID_SCHEMA_VERSION"
        );
    }

    #[test]
    fn build_versions_use_semver() {
        assert_eq!(
            BuildVersion::parse("1.2.3")
                .expect("version parses")
                .to_string(),
            "1.2.3"
        );
        assert_eq!(
            BuildVersion::parse("2026-07-28")
                .expect_err("semver should fail")
                .machine_code(),
            "CORE_INVALID_BUILD_VERSION"
        );
    }

    #[test]
    fn content_hashes_are_lowercase_sha256() {
        let hash = ContentHash::sha256_bytes(br#"{"a":1}"#);

        assert!(hash.as_str().starts_with("sha256:"));
        assert_eq!(
            ContentHash::parse(hash.as_str()).expect("hash parses"),
            hash
        );
        assert_eq!(
            ContentHash::parse("sha256:ABC")
                .expect_err("uppercase hash should fail")
                .machine_code(),
            "CORE_INVALID_CONTENT_HASH"
        );
    }
}
