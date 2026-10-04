use super::*;
#[test]
fn retry_after_is_strict_and_fatal_errors_do_not_churn() {
    for value in [
        "",
        "garbage3",
        "-1",
        "1.5",
        "604801",
        "999999999999999999999999",
        "Wed, 01 Jan 2030",
    ] {
        assert_eq!(retry_after(value), None);
    }
    assert_eq!(retry_after(" 12 "), Some(12));
    for message in [
        "BINANCE_RATE_LIMIT retry_after=12",
        "BINANCE_TRANSPORT",
        "BINANCE_SOURCE_UNAVAILABLE",
        "BINANCE_HTTP_STATUS 503",
    ] {
        assert!(exit_policy(&anyhow::anyhow!(message)).retryable);
    }
    for message in [
        "BINANCE_RATE_LIMIT retry_after=unspecified",
        "BINANCE_HTTP_STATUS 403",
        "BINANCE_RESPONSE_SCHEMA",
        "BINANCE_SOURCE_GAP",
        "BINANCE_TIMESTAMP",
        "BINANCE_RESPONSE_LIMIT",
        "BINANCE_PAGE_LIMIT",
        "BINANCE_ID_OVERFLOW",
        "database failure",
    ] {
        assert!(!exit_policy(&anyhow::anyhow!(message)).retryable);
    }
}
#[test]
fn aggregate_mapping_identity_and_gap_boundaries() {
    let now = Utc::now();
    let good = br#"[{"a":7,"p":"100.1250","q":"2.00","T":1700000000000,"f":10,"l":12,"m":true}]"#;
    let rows = decode(good, "p", "BTCUSDT", Some(7), now).unwrap();
    assert_eq!(rows[0].source_tick_id, "BTCUSDT:agg:7");
    assert_eq!(rows[0].price, "100.1250");
    assert_eq!(rows[0].volume, "2.00");
    assert_eq!(rows[0].received_at, now);
    assert!(decode(good, "p", "BTCUSDT", Some(8), now).is_err());
    assert!(
        decode(good, "p", "ETHUSDT", None, now).unwrap()[0]
            .source_tick_id
            .starts_with("ETHUSDT:")
    );
    assert!(
        decode(b"[]", "p", "BTCUSDT", Some(7), now)
            .unwrap()
            .is_empty()
    );
    assert!(decode(b"{}", "p", "BTCUSDT", None, now).is_err());
    let base: serde_json::Value = serde_json::from_slice(good).unwrap();
    for (field, value) in [
        ("a", -1),
        ("a", i64::MAX),
        ("f", -1),
        ("l", 9),
        ("T", i64::MAX),
    ] {
        let mut bad = base.clone();
        bad[0][field] = value.into();
        assert!(
            decode(
                &serde_json::to_vec(&bad).unwrap(),
                "p",
                "BTCUSDT",
                None,
                now
            )
            .is_err()
        );
    }
    let mut bad = base.clone();
    bad[0]["p"] = serde_json::Value::Null;
    assert!(
        decode(
            &serde_json::to_vec(&bad).unwrap(),
            "p",
            "BTCUSDT",
            None,
            now
        )
        .is_err()
    );
    let repeated = vec![base[0].clone(); 1001];
    assert!(
        decode(
            &serde_json::to_vec(&repeated).unwrap(),
            "p",
            "BTCUSDT",
            None,
            now
        )
        .is_err()
    );
    assert!(
        decode(
            &serde_json::to_vec(&vec![base[0].clone(); 2]).unwrap(),
            "p",
            "BTCUSDT",
            None,
            now
        )
        .is_err()
    );
}
#[test]
fn endpoint_cannot_redirect_native_calls_to_other_hosts() {
    for u in [
        "https://data-api.binance.vision/",
        "https://data-api.binance.vision:443/",
    ] {
        assert!(endpoint(u, false).is_ok());
    }
    for u in [
        "http://localhost:123/",
        "http://127.0.0.1:123/",
        "http://[::1]:123/",
    ] {
        assert!(endpoint(u, true).is_ok());
        assert!(endpoint(u, false).is_err());
    }
    for u in [
        "garbage",
        "http://data-api.binance.vision/",
        "https://example.com/",
        "https://data-api.binance.vision:444/",
        "https://u@data-api.binance.vision/",
        "https://:pw@data-api.binance.vision/",
        "https://data-api.binance.vision/path",
        "https://data-api.binance.vision/?a=1",
        "https://data-api.binance.vision/#x",
        "http://other.invalid/",
    ] {
        assert!(endpoint(u, true).is_err(), "{u}");
    }
}

#[test]
fn server_clock_diagnostics_preserve_unknowns_and_rtt_bounds() {
    use std::{
        io::{Read, Write},
        net::TcpListener,
    };
    for body in ["{\"serverTime\":1700000000000}", "{}"] {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = url::Url::parse(&format!("http://{}/", listener.local_addr().unwrap())).unwrap();
        std::thread::scope(|scope| {
            scope.spawn(|| {
                let (mut stream, _) = listener.accept().unwrap();
                let mut request = [0; 4096];
                let size = stream.read(&mut request).unwrap();
                assert!(size > 0);
                write!(
                    stream,
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                )
                .unwrap();
            });
            let source = Source {
                client: reqwest::blocking::Client::new(),
                base,
            };
            let r = source.clock_observation("BTCUSDT").unwrap();
            if body == "{}" {
                assert_eq!(r["status"], "UNMEASURED");
                assert!(r["offset_lower_ms"].is_null());
            } else {
                assert_eq!(r["status"], "MEASURED_RTT_BOUNDS");
                assert!(
                    r["offset_lower_ms"].as_i64().unwrap()
                        <= r["offset_upper_ms"].as_i64().unwrap()
                );
            }
        });
    }
}
#[test]
fn owned_stop_pipe_is_bounded_and_eof_stops_requests() {
    for bytes in [b"stop\nextra".as_slice(), b"".as_slice()] {
        let flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let mut reader = std::io::Cursor::new(bytes);
        super::stop_pipe(&mut reader, flag.clone());
        assert!(flag.load(std::sync::atomic::Ordering::Acquire));
        assert!(reader.position() <= 5);
    }
}
