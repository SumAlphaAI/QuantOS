use std::str::FromStr;

use chrono::{TimeZone, Utc};
use quantos_core::{
    BuildVersion, ContentHash, CoreError, ErrorCode, FixedUtcClock, Fixture, FixtureBuilder,
    HealthReport, Money, Quantity, SchemaVersion, SystemUtcClock, TenantId, UtcClock,
    WORKSPACE_NAME, canonical_json_bytes, parse_utc_rfc3339,
};
use rust_decimal::Decimal;
use serde::{Serialize, Serializer, ser::Error as _};
use serde_json::json;
use uuid::Uuid;

struct SerializationFailure;

impl Serialize for SerializationFailure {
    fn serialize<S>(&self, _serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        Err(S::Error::custom("intentional failure"))
    }
}

#[test]
fn clocks_are_utc_fixed_and_strictly_parsed() {
    let before = Utc::now();
    let observed = SystemUtcClock.now();
    assert!(observed >= before && observed <= Utc::now());

    let fixed_at = Utc.with_ymd_and_hms(2026, 9, 20, 0, 0, 0).single().unwrap();
    assert_eq!(FixedUtcClock::new(fixed_at).now(), fixed_at);
    assert_eq!(
        parse_utc_rfc3339("2026-07-28T18:30:00+08:00").unwrap(),
        Utc.with_ymd_and_hms(2026, 7, 28, 10, 30, 0)
            .single()
            .unwrap()
    );
    assert_eq!(
        parse_utc_rfc3339("2026-01-05T01:15:00-05:00").unwrap(),
        Utc.with_ymd_and_hms(2026, 1, 5, 6, 15, 0).single().unwrap()
    );
    assert_eq!(
        parse_utc_rfc3339("bad").unwrap_err().machine_code(),
        "CORE_INVALID_TIMESTAMP"
    );
}

#[test]
fn every_error_code_and_constructor_is_stable() {
    let codes = [
        (ErrorCode::InvalidId, "CORE_INVALID_ID"),
        (ErrorCode::InvalidTimestamp, "CORE_INVALID_TIMESTAMP"),
        (ErrorCode::InvalidCurrencyCode, "CORE_INVALID_CURRENCY_CODE"),
        (ErrorCode::InvalidMoneyScale, "CORE_INVALID_MONEY_SCALE"),
        (ErrorCode::InvalidQuantity, "CORE_INVALID_QUANTITY"),
        (
            ErrorCode::InvalidQuantityScale,
            "CORE_INVALID_QUANTITY_SCALE",
        ),
        (
            ErrorCode::InvalidSchemaVersion,
            "CORE_INVALID_SCHEMA_VERSION",
        ),
        (ErrorCode::InvalidBuildVersion, "CORE_INVALID_BUILD_VERSION"),
        (ErrorCode::InvalidContentHash, "CORE_INVALID_CONTENT_HASH"),
        (ErrorCode::FixtureHashMismatch, "CORE_FIXTURE_HASH_MISMATCH"),
        (
            ErrorCode::SerializationFailure,
            "CORE_SERIALIZATION_FAILURE",
        ),
    ];
    for (code, expected) in codes {
        let error = CoreError::new(code, "detail".to_owned());
        assert_eq!(code.as_str(), expected);
        assert_eq!(code.to_string(), expected);
        assert_eq!(error.code(), code);
        assert_eq!(error.machine_code(), expected);
        assert_eq!(error.message(), "detail");
        assert!(error.to_string().starts_with(expected));
    }

    let errors = [
        CoreError::invalid_id("TenantId", "bad"),
        CoreError::invalid_timestamp("bad"),
        CoreError::invalid_currency_code("usd"),
        CoreError::invalid_money_scale("1.123", 2),
        CoreError::invalid_quantity("-1"),
        CoreError::invalid_quantity_scale("1.123", 2),
        CoreError::invalid_schema_version("1"),
        CoreError::invalid_build_version("date"),
        CoreError::invalid_content_hash("bad"),
        CoreError::fixture_hash_mismatch("expected", "actual"),
        CoreError::serialization_failure("fixture", "detail"),
    ];
    assert!(errors.iter().all(|error| !error.message().is_empty()));
}

#[test]
fn typed_ids_cover_all_public_construction_paths() {
    let uuid = Uuid::from_u128(42);
    let tenant = TenantId::from_uuid(uuid);
    assert_eq!(*tenant.as_uuid(), uuid);
    assert_eq!(TenantId::parse_str(&tenant.to_string()).unwrap(), tenant);
    assert_eq!(TenantId::from_str(&tenant.to_string()).unwrap(), tenant);
    assert_eq!(format!("{tenant}"), uuid.to_string());
    assert_eq!(TenantId::new().as_uuid().get_version_num(), 7);
    assert_eq!(TenantId::default().as_uuid().get_version_num(), 7);
    assert_eq!(
        TenantId::parse_str("bad").unwrap_err().machine_code(),
        "CORE_INVALID_ID"
    );
}

#[test]
fn money_and_quantity_enforce_constructor_and_serde_boundaries() {
    let amount = Decimal::from_str_exact("1.123456789").unwrap();
    let money = Money::new("USD", amount).unwrap();
    assert_eq!(money.currency(), "USD");
    assert_eq!(money.amount(), amount);
    assert_eq!(Money::parse_str("USD", "1.25").unwrap().amount().scale(), 2);
    assert_eq!(
        Money::parse_str("usd", "1").unwrap_err().machine_code(),
        "CORE_INVALID_CURRENCY_CODE"
    );
    assert_eq!(
        Money::parse_str("USD", "1.1234567891")
            .unwrap_err()
            .machine_code(),
        "CORE_INVALID_MONEY_SCALE"
    );
    assert_eq!(
        Money::parse_str("USD", "bad").unwrap_err().machine_code(),
        "CORE_INVALID_MONEY_SCALE"
    );

    let quantity = Quantity::parse_str("42.123456789012").unwrap();
    assert_eq!(quantity.value().scale(), 12);
    assert_eq!(Quantity::new(Decimal::ZERO).unwrap().value(), Decimal::ZERO);
    assert_eq!(
        Quantity::parse_str("-0.1").unwrap_err().machine_code(),
        "CORE_INVALID_QUANTITY"
    );
    assert_eq!(
        Quantity::parse_str("0.1234567890123")
            .unwrap_err()
            .machine_code(),
        "CORE_INVALID_QUANTITY_SCALE"
    );
    assert_eq!(
        Quantity::parse_str("bad").unwrap_err().machine_code(),
        "CORE_INVALID_QUANTITY_SCALE"
    );

    let money_json = serde_json::to_string(&money).unwrap();
    assert_eq!(serde_json::from_str::<Money>(&money_json).unwrap(), money);
    let quantity_json = serde_json::to_string(&quantity).unwrap();
    assert_eq!(
        serde_json::from_str::<Quantity>(&quantity_json).unwrap(),
        quantity
    );
}

#[test]
fn money_deserialization_rejects_every_malformed_shape() {
    for invalid in [
        json!(null),
        json!({"amount": "1"}),
        json!({"currency": 1, "amount": "1"}),
        json!({"currency": "USD"}),
        json!({"currency": "USD", "amount": {}, "extra": true}),
        json!({"currency": "USD", "amount": "1", "extra": true}),
        json!({"currency": "usd", "amount": "1"}),
        json!({"currency": "USD", "amount": "1.1234567891"}),
    ] {
        assert!(serde_json::from_value::<Money>(invalid).is_err());
    }
    assert!(serde_json::from_value::<Quantity>(json!("-1")).is_err());
}

#[test]
fn versions_and_hashes_cover_valid_and_invalid_wire_forms() {
    for invalid in ["", "v", "V1", "vABC", "v@1", "vtag"] {
        assert!(SchemaVersion::parse(invalid).is_err());
    }
    let schema = SchemaVersion::from_str("v1_beta-2").unwrap();
    assert_eq!(schema.as_str(), "v1_beta-2");
    assert_eq!(schema.to_string(), "v1_beta-2");
    assert_eq!(
        serde_json::from_str::<SchemaVersion>(r#""v1""#)
            .unwrap()
            .as_str(),
        "v1"
    );
    assert!(serde_json::from_str::<SchemaVersion>(r#""invalid""#).is_err());

    let build = BuildVersion::from_str("1.2.3-alpha.1+build.7").unwrap();
    assert_eq!(build.as_semver().major, 1);
    assert_eq!(BuildVersion::parse(&build.to_string()).unwrap(), build);
    assert_eq!(
        serde_json::from_str::<BuildVersion>(&serde_json::to_string(&build).unwrap()).unwrap(),
        build
    );
    assert_eq!(
        BuildVersion::parse("date").unwrap_err().machine_code(),
        "CORE_INVALID_BUILD_VERSION"
    );
    assert!(serde_json::from_str::<BuildVersion>(r#""date""#).is_err());

    let hash = ContentHash::sha256_bytes(b"roundtrip");
    assert_eq!(ContentHash::from_str(hash.as_str()).unwrap(), hash);
    assert_eq!(hash.to_string(), hash.as_str());
    assert_eq!(
        serde_json::from_str::<ContentHash>(&serde_json::to_string(&hash).unwrap()).unwrap(),
        hash
    );
    for invalid in [
        "md5:00000000000000000000000000000000",
        "sha256:abc",
        "sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "sha256:gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg",
    ] {
        assert!(ContentHash::parse(invalid).is_err());
    }
    assert!(serde_json::from_str::<ContentHash>(r#""bad""#).is_err());
}

fn sample_fixture() -> Fixture {
    FixtureBuilder::new("snapshot", SchemaVersion::parse("v1").unwrap())
        .with_field(
            "payload",
            json!({"z": null, "bools": [true, false], "number": 42, "string": "line\nquote\"slash\\", "nested": {"b": 2, "a": 1}}),
        )
        .unwrap()
        .build()
        .unwrap()
}

#[test]
fn fixtures_are_canonical_verified_and_serde_safe() {
    let fixture = sample_fixture();
    fixture.verify().unwrap();
    assert_eq!(fixture.kind(), "snapshot");
    assert_eq!(fixture.schema_version().as_str(), "v1");
    assert!(fixture.fields().contains_key("payload"));
    assert_eq!(fixture.fixture_id().as_uuid().get_version_num(), 7);
    assert_eq!(
        fixture.hash(),
        &ContentHash::sha256_bytes(fixture.canonical_json().as_bytes())
    );

    let encoded = serde_json::to_string(&fixture).unwrap();
    assert_eq!(serde_json::from_str::<Fixture>(&encoded).unwrap(), fixture);
    assert_eq!(
        String::from_utf8(canonical_json_bytes(&json!({"z": 1, "a": [null, true, "x"]})).unwrap())
            .unwrap(),
        r#"{"a":[null,true,"x"],"z":1}"#
    );
}

#[test]
fn fixture_rejects_hash_tampering_and_malformed_shapes() {
    let fixture = sample_fixture();
    let mut tampered = serde_json::to_value(&fixture).unwrap();
    tampered["hash"] = json!(ContentHash::sha256_bytes(b"wrong").as_str());
    assert!(
        serde_json::from_value::<Fixture>(tampered)
            .unwrap_err()
            .to_string()
            .contains("CORE_FIXTURE_HASH_MISMATCH")
    );

    let valid = serde_json::to_value(&fixture).unwrap();
    for (field, value) in [
        ("kind", json!("modified")),
        ("schema_version", json!("v2")),
        ("fields", json!({"payload": "modified"})),
    ] {
        let mut modified = valid.clone();
        modified[field] = value;
        assert!(
            serde_json::from_value::<Fixture>(modified)
                .unwrap_err()
                .to_string()
                .contains("CORE_FIXTURE_HASH_MISMATCH")
        );
    }
    assert!(serde_json::from_value::<Fixture>(json!(null)).is_err());
    for field in ["fixture_id", "kind", "schema_version", "fields", "hash"] {
        let mut missing = valid.clone();
        missing.as_object_mut().unwrap().remove(field);
        assert!(
            serde_json::from_value::<Fixture>(missing).is_err(),
            "missing {field}"
        );

        let mut invalid = valid.clone();
        invalid[field] = json!({});
        assert!(
            serde_json::from_value::<Fixture>(invalid).is_err(),
            "invalid {field}"
        );
    }
    let mut unknown = valid;
    unknown["unknown"] = json!(true);
    assert!(serde_json::from_value::<Fixture>(unknown).is_err());
}

#[test]
fn builder_maps_serialization_failures_and_fixture_hashes_are_repeatable() {
    let version = SchemaVersion::parse("v1").unwrap();
    assert_eq!(
        FixtureBuilder::new("failure", version.clone())
            .with_field("bad", SerializationFailure)
            .unwrap_err()
            .machine_code(),
        "CORE_SERIALIZATION_FAILURE"
    );
    for index in 0..1_000 {
        let first = FixtureBuilder::new("corpus", version.clone())
            .with_field("index", index)
            .unwrap()
            .with_field("payload", json!({"z": index + 1, "a": "量化"}))
            .unwrap()
            .build()
            .unwrap();
        let second = FixtureBuilder::new("corpus", version.clone())
            .with_field("payload", json!({"a": "量化", "z": index + 1}))
            .unwrap()
            .with_field("index", index)
            .unwrap()
            .build()
            .unwrap();
        assert_eq!(first.hash(), second.hash());
    }
}

#[test]
fn workspace_health_contract_is_stable() {
    assert_eq!(WORKSPACE_NAME, "sumalpha-quantos");
    let report = HealthReport::ready("runtime-gateway");
    assert_eq!(report.service, "runtime-gateway");
    assert!(report.ready);
}
