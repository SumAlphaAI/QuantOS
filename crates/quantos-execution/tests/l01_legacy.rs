use quantos_execution::venue::*;
#[test]
fn l01_endpoint_is_an_exact_origin_not_a_testnet_substring() {
    for endpoint in [
        "https://testnet.attacker.invalid",
        "https://testnet.binance.vision.attacker.invalid",
        "http://localhost",
        "https://testnet.binance.vision/?credential=owned-canary",
    ] {
        let c = VenueConfig {
            endpoint: endpoint.into(),
            ..VenueConfig::approved_testnet()
        };
        assert!(c.validate().is_err());
    }
}
#[test]
fn l01_configuration_rejects_unbounded_precision_and_zero_limits() {
    for c in [
        VenueConfig {
            price_precision: 29,
            ..VenueConfig::approved_testnet()
        },
        VenueConfig {
            quantity_precision: 10000,
            ..VenueConfig::approved_testnet()
        },
        VenueConfig {
            rate_limit_per_second: 0,
            ..VenueConfig::approved_testnet()
        },
    ] {
        assert!(c.validate().is_err());
    }
}
#[test]
fn l01_invalid_configuration_debug_and_errors_do_not_echo_material() {
    let c = VenueConfig {
        api_key_ref: "owned-canary-material".into(),
        endpoint: "https://testnet.invalid/?token=owned-canary-material".into(),
        ..VenueConfig::approved_testnet()
    };
    assert!(!format!("{c:?}").contains("owned-canary-material"));
    assert!(
        !c.validate()
            .unwrap_err()
            .to_string()
            .contains("owned-canary-material")
    );
}
#[path = "support/l01_fixture.rs"]
mod fixture;
#[test]
fn l01_legacy_decimal_rounding_is_exact_and_zero_or_nondecimal_is_refused() {
    let c = fixture::cases()[0].clone();
    let mut command = fixture::command(0, &c);
    command.venue = APPROVED_TESTNET_VENUE.into();
    command.quantity = "9007199254740993.123456".into();
    let intent = map_order_intent(&command, &VenueConfig::approved_testnet()).unwrap();
    assert_eq!(intent.quantity, "9007199254740993.1234");
    for value in ["0", "0.00001", "NaN", "inf", "-1", "1e3"] {
        command.quantity = value.into();
        assert!(map_order_intent(&command, &VenueConfig::approved_testnet()).is_err());
    }
}
#[test]
fn l01_legacy_order_types_and_secret_details_are_not_silently_mapped() {
    use quantos_execution::OrderIntent;
    let c = fixture::cases()[0].clone();
    let mut command = fixture::command(0, &c);
    command.venue = APPROVED_TESTNET_VENUE.into();
    command.intent = OrderIntent::StopLimit;
    command.stop_price = Some("100.239".into());
    let intent = map_order_intent(&command, &VenueConfig::approved_testnet()).unwrap();
    assert_eq!(intent.order_type, "STOP_LOSS_LIMIT");
    assert_eq!(intent.stop_price.as_deref(), Some("100.23"));
    let e = VenueTransportError::Authentication {
        detail: "owned-canary-material".into(),
    };
    assert!(!format!("{e:?} {e}").contains("owned-canary"));
}
#[test]
fn l01_empty_or_duplicate_legacy_compatibility_report_is_not_complete() {
    let mut report = CompatReport {
        version: COMPAT_REPORT_VERSION.into(),
        venue_id: APPROVED_TESTNET_VENUE.into(),
        endpoint: APPROVED_TESTNET_ENDPOINT.into(),
        scenarios: vec![],
        generated_at: fixture::now(),
    };
    assert!(!report.fully_mapped());
    report.scenarios = (0..200)
        .map(|_| CompatScenarioResult {
            scenario_id: "repeated".into(),
            kind: TestnetScenarioKind::NormalFill,
            mapped_event_kinds: vec!["accepted".into(), "filled".into()],
            mapped: true,
        })
        .collect();
    assert!(!report.fully_mapped());
}
