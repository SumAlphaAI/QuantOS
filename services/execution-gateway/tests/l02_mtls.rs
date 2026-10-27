use chrono::{DateTime, Duration, Utc};
use execution_gateway::restricted_zone::*;
use openssl::{
    asn1::{Asn1Integer, Asn1Time},
    bn::BigNum,
    hash::MessageDigest,
    pkey::{PKey, Private},
    rsa::Rsa,
    ssl::{SslConnector, SslMethod, SslVerifyMode},
    x509::{
        X509, X509NameBuilder,
        extension::{BasicConstraints, ExtendedKeyUsage, KeyUsage, SubjectAlternativeName},
    },
};
use quantos_core::ContentHash;
use quantos_execution::{
    gateway::{BoundaryCommand, ExecutionKernel, GatewayLimits, KernelEvent},
    venue_protocol::EXECUTION_VENUE,
};
use serde_json::{Value, json};
use std::{
    io::{BufRead, BufReader, Write},
    net::{SocketAddr, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::mpsc,
    time::{Duration as SD, SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;
fn now() -> DateTime<Utc> {
    DateTime::from_timestamp(Utc::now().timestamp(), 0).unwrap()
}
fn certificate(
    cn: &str,
    issuer: Option<(&X509, &PKey<Private>)>,
    server: bool,
    expired: bool,
) -> (X509, PKey<Private>) {
    let key = PKey::from_rsa(Rsa::generate(2048).unwrap()).unwrap();
    let mut name = X509NameBuilder::new().unwrap();
    name.append_entry_by_text("CN", cn).unwrap();
    let name = name.build();
    let mut b = X509::builder().unwrap();
    b.set_version(2).unwrap();
    let mut serial = BigNum::new().unwrap();
    serial
        .rand(128, openssl::bn::MsbOption::MAYBE_ZERO, false)
        .unwrap();
    let serial = Asn1Integer::from_bn(&serial).unwrap();
    b.set_serial_number(&serial).unwrap();
    b.set_subject_name(&name).unwrap();
    b.set_issuer_name(issuer.map(|(c, _)| c.subject_name()).unwrap_or(&name))
        .unwrap();
    b.set_pubkey(&key).unwrap();
    let epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    b.set_not_before(&Asn1Time::from_unix(epoch - 3600).unwrap())
        .unwrap();
    b.set_not_after(&Asn1Time::from_unix(if expired { epoch - 1 } else { epoch + 86400 }).unwrap())
        .unwrap();
    if issuer.is_none() {
        b.append_extension(BasicConstraints::new().critical().ca().build().unwrap())
            .unwrap();
        b.append_extension(KeyUsage::new().key_cert_sign().crl_sign().build().unwrap())
            .unwrap();
    } else {
        b.append_extension(BasicConstraints::new().critical().build().unwrap())
            .unwrap();
        b.append_extension(
            KeyUsage::new()
                .digital_signature()
                .key_encipherment()
                .build()
                .unwrap(),
        )
        .unwrap();
        let mut eku = ExtendedKeyUsage::new();
        if server {
            eku.server_auth();
        } else {
            eku.client_auth();
        }
        b.append_extension(eku.build().unwrap()).unwrap();
        let san = SubjectAlternativeName::new()
            .dns(cn)
            .build(&b.x509v3_context(issuer.map(|(c, _)| c.as_ref()), None))
            .unwrap();
        b.append_extension(san).unwrap();
    }
    b.sign(
        issuer.map(|(_, k)| k).unwrap_or(&key),
        MessageDigest::sha256(),
    )
    .unwrap();
    (b.build(), key)
}
struct Harness {
    child: Child,
    dir: PathBuf,
    ca: X509,
    server: X509,
    peer1: (X509, PKey<Private>),
    peer2: (X509, PKey<Private>),
    other: (X509, PKey<Private>),
    expired: (X509, PKey<Private>),
    rogue: (X509, PKey<Private>),
    address: SocketAddr,
    lines: mpsc::Receiver<String>,
}
impl Drop for Harness {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}
impl Harness {
    fn new(account: Uuid, at: DateTime<Utc>, schedule: Vec<i64>, rotation: bool) -> Self {
        assert!(!std::env::vars().any(|(k, _)| {
            [
                "DATABASE_URL",
                "QUANTOS_EXECUTION_DATABASE_URL",
                "SUPABASE_SERVICE_ROLE_KEY",
                "BINANCE_API_KEY",
                "BINANCE_API_SECRET",
            ]
            .contains(&k.as_str())
        }));
        let (ca, ca_key) = certificate("owned-l02-ca", None, false, false);
        let (server, server_key) =
            certificate("execution-zone.invalid", Some((&ca, &ca_key)), true, false);
        let peer1 = certificate(
            "execution-worker.invalid",
            Some((&ca, &ca_key)),
            false,
            false,
        );
        let peer2 = certificate(
            "execution-worker-2.invalid",
            Some((&ca, &ca_key)),
            false,
            false,
        );
        let other = certificate(
            "research-engine.invalid",
            Some((&ca, &ca_key)),
            false,
            false,
        );
        let expired = certificate("expired-worker.invalid", Some((&ca, &ca_key)), false, true);
        let (rogue_ca, rogue_key) = certificate("owned-rogue-ca", None, false, false);
        let rogue = certificate(
            "rogue-worker.invalid",
            Some((&rogue_ca, &rogue_key)),
            false,
            false,
        );
        let dir = std::env::temp_dir().join(format!("quantos-l02-{}", Uuid::new_v4()));
        std::fs::create_dir(&dir).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700)).unwrap();
        }
        for (name, bytes) in [
            ("ca.pem", ca.to_pem().unwrap()),
            ("server.pem", server.to_pem().unwrap()),
            (
                "server-key.pem",
                server_key.private_key_to_pem_pkcs8().unwrap(),
            ),
            ("peer-1.pem", peer1.0.to_pem().unwrap()),
            ("peer-2.pem", peer2.0.to_pem().unwrap()),
        ] {
            let path = dir.join(name);
            std::fs::write(&path, bytes).unwrap();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600)).unwrap();
            }
        }
        std::fs::write(
            dir.join("config.json"),
            serde_json::to_vec(
                &json!({"account":account,"now":at,"schedule":schedule,"rotation":rotation}),
            )
            .unwrap(),
        )
        .unwrap();
        let exe = std::env::var("QUANTOS_L02_FIXTURE_EXECUTABLE")
            .unwrap_or_else(|_| env!("CARGO_BIN_EXE_execution-gateway").into());
        let mut child = Command::new(exe)
            .arg("--l02-owned-zone-fixture")
            .arg(&dir)
            .env_clear()
            .env("TMPDIR", std::env::temp_dir())
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let out = child.stdout.take().unwrap();
        let (tx, lines) = mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(out).lines() {
                let Ok(line) = line else { break };
                if tx.send(line).is_err() {
                    break;
                }
            }
        });
        let first = lines.recv_timeout(SD::from_secs(5)).unwrap();
        let ready: Value = serde_json::from_str(first.strip_prefix("L02_READY=").unwrap()).unwrap();
        assert_eq!(ready["pid"].as_u64(), Some(child.id() as u64));
        assert_eq!(ready["backend"], "OWNED_L02_MTLS");
        assert_eq!(ready["serverFingerprint"], fingerprint(&server).unwrap());
        let address = ready["address"].as_str().unwrap().parse().unwrap();
        Self {
            child,
            dir,
            ca,
            server,
            peer1,
            peer2,
            other,
            expired,
            rogue,
            address,
            lines,
        }
    }
    fn client(&self, peer: &(X509, PKey<Private>)) -> ZoneClient {
        ZoneClient::new(
            &self.ca,
            &peer.0,
            &peer.1,
            NetworkAllowlist::new(
                "execution-zone.invalid".into(),
                self.address.port(),
                [self.address.ip()].into(),
            )
            .unwrap(),
            fingerprint(&self.server).unwrap(),
        )
        .unwrap()
    }
    fn trace(&self) -> Value {
        let line = self.lines.recv_timeout(SD::from_secs(5)).unwrap();
        serde_json::from_str(line.strip_prefix("L02_TRACE=").unwrap()).unwrap()
    }
}
fn request(index: u64, version: u64, at: DateTime<Utc>, account: Uuid) -> ZoneRequest {
    ZoneRequest {
        session_hash: format!("sha256:{}", if version == 1 { "1" } else { "2" }.repeat(64)),
        version,
        command: BoundaryCommand {
            command_id: format!("owned-l02-{index}"),
            account_id: account.to_string(),
            venue: EXECUTION_VENUE.into(),
            venue_kind: "cex".into(),
            symbol: "BTCUSDT".into(),
            intent: "limit".into(),
            side: "buy".into(),
            quantity: "1".into(),
            limit_price: Some("100".into()),
            stop_price: None,
            idempotency_key: format!("owned-l02-key-{index}"),
            expires_at: at + Duration::minutes(2),
        },
    }
}
#[test]
fn l02_real_process_mutual_tls_identity_ttl_egress_and_no_reissue() {
    let at = now();
    let account = Uuid::from_u128(1);
    let h = Harness::new(account, at, vec![], false);
    let good = h.client(&h.peer1);
    let r = request(1, 1, at, account);
    let receipt = good
        .execute("execution-zone.invalid", h.address, &r)
        .unwrap();
    assert_eq!(receipt.events.len(), 2);
    assert!(matches!(&receipt.events[1],KernelEvent::OrderFilled{quantity,..}if quantity=="1"));
    assert_eq!(h.trace()["protocolCalls"], 1);
    let again = good
        .execute("execution-zone.invalid", h.address, &r)
        .unwrap();
    assert!(again.events.is_empty());
    assert_eq!(h.trace()["protocolCalls"], 1);
    let mut cases = vec![
        json!({"id":"valid-mutual-tls-fill","outcome":"PASS"}),
        json!({"id":"same-command-no-reissue","outcome":"PASS"}),
    ];
    for (peer, id) in [
        (&h.other, "research-ui-bff-certificate-not-allowlisted"),
        (&h.expired, "expired-client-certificate"),
        (&h.rogue, "untrusted-client-ca"),
    ] {
        assert!(
            h.client(peer)
                .execute("execution-zone.invalid", h.address, &r)
                .is_err()
        );
        if id.starts_with("research") {
            assert_eq!(h.trace()["protocolCalls"], 1);
        }
        cases.push(json!({"id":id,"outcome":"DENIED"}));
    }
    let mut b = SslConnector::builder(SslMethod::tls()).unwrap();
    b.cert_store_mut().add_cert(h.ca.clone()).unwrap();
    b.set_verify(SslVerifyMode::PEER);
    let s = TcpStream::connect(h.address).unwrap();
    s.set_read_timeout(Some(SD::from_secs(2))).unwrap();
    s.set_write_timeout(Some(SD::from_secs(2))).unwrap();
    if let Ok(mut tls) = b.build().connect("execution-zone.invalid", s) {
        let _ = tls.write_all(b"{}\n");
        assert!(read_frame(&mut tls).is_err());
    }
    cases.push(json!({"id":"missing-client-certificate","outcome":"DENIED"}));
    assert_eq!(
        good.execute("execution-zone.invalid.evil", h.address, &r)
            .err(),
        Some(Denial::Egress)
    );
    assert_eq!(
        good.execute(
            "execution-zone.invalid",
            SocketAddr::new(h.address.ip(), h.address.port() + 1),
            &r
        )
        .err(),
        Some(Denial::Egress)
    );
    cases.push(json!({"id":"unlisted-host-and-port-before-connect","outcome":"DENIED"}));
    let wrong_name = ZoneClient::new(
        &h.ca,
        &h.peer1.0,
        &h.peer1.1,
        NetworkAllowlist::new(
            "wrong.invalid".into(),
            h.address.port(),
            [h.address.ip()].into(),
        )
        .unwrap(),
        fingerprint(&h.server).unwrap(),
    )
    .unwrap();
    assert_eq!(
        wrong_name.execute("wrong.invalid", h.address, &r).err(),
        Some(Denial::Tls)
    );
    cases.push(json!({"id":"server-hostname-verification","outcome":"DENIED"}));
    let wrong_pin = ZoneClient::new(
        &h.ca,
        &h.peer1.0,
        &h.peer1.1,
        NetworkAllowlist::new(
            "execution-zone.invalid".into(),
            h.address.port(),
            [h.address.ip()].into(),
        )
        .unwrap(),
        format!("sha256:{}", "f".repeat(64)),
    )
    .unwrap();
    assert_eq!(
        wrong_pin
            .execute("execution-zone.invalid", h.address, &r)
            .err(),
        Some(Denial::Tls)
    );
    cases.push(json!({"id":"server-pin-verification","outcome":"DENIED"}));
    let (untrusted_root, _) = certificate("owned-unrelated-root", None, false, false);
    let wrong_root = ZoneClient::new(
        &untrusted_root,
        &h.peer1.0,
        &h.peer1.1,
        NetworkAllowlist::new(
            "execution-zone.invalid".into(),
            h.address.port(),
            [h.address.ip()].into(),
        )
        .unwrap(),
        fingerprint(&h.server).unwrap(),
    )
    .unwrap();
    assert_eq!(
        wrong_root
            .execute("execution-zone.invalid", h.address, &r)
            .err(),
        Some(Denial::Tls)
    );
    cases.push(json!({"id":"untrusted-server-root","outcome":"DENIED"}));
    for (id, mut r) in [
        ("expired-command", request(2, 1, at, account)),
        ("cross-account", request(3, 1, at, Uuid::from_u128(2))),
        ("wrong-session", request(4, 1, at, account)),
    ] {
        if id == "expired-command" {
            r.command.expires_at = at;
        }
        if id == "wrong-session" {
            r.session_hash = ContentHash::sha256_bytes(b"owned-unknown-session").to_string();
        }
        assert!(
            good.execute("execution-zone.invalid", h.address, &r)
                .is_err()
        );
        assert_eq!(h.trace()["protocolCalls"], 1);
        cases.push(json!({"id":id,"outcome":"DENIED"}));
    }
    if let Ok(path) = std::env::var("QUANTOS_L02_TLS_EVIDENCE") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-l02-mtls-process/v1","scope":"ACTUAL_EPHEMERAL_MTLS_OWNED_CHILD_NOT_TARGET_DEPLOYMENT","cases":cases,"protocolWrites":1,"actualVault":false,"actualTestnet":false,"productionCredentialsUsed":false,"childEnvironmentCleared":true,"childEnvironment":"CLEARED_PLUS_TMPDIR_ONLY","privateKeysExported":false})).unwrap()).unwrap();
    }
}
#[test]
fn l02_real_process_certificate_and_synthetic_secret_rotation_revoke() {
    let at = now();
    let account = Uuid::from_u128(1);
    let h = Harness::new(account, at, vec![0, 10, 309, 310, 310, 320], true);
    let old = h.client(&h.peer1);
    let new = h.client(&h.peer2);
    let first = old
        .execute(
            "execution-zone.invalid",
            h.address,
            &request(1, 1, at, account),
        )
        .unwrap();
    h.trace();
    let rotated = new
        .execute(
            "execution-zone.invalid",
            h.address,
            &request(2, 2, at + Duration::seconds(10), account),
        )
        .unwrap();
    h.trace();
    assert_ne!(first.signing_proof, rotated.signing_proof);
    old.execute(
        "execution-zone.invalid",
        h.address,
        &request(3, 1, at + Duration::seconds(309), account),
    )
    .unwrap();
    h.trace();
    assert_eq!(
        old.execute(
            "execution-zone.invalid",
            h.address,
            &request(4, 1, at + Duration::seconds(310), account)
        )
        .err(),
        Some(Denial::Rotation)
    );
    h.trace();
    new.execute(
        "execution-zone.invalid",
        h.address,
        &request(5, 2, at + Duration::seconds(310), account),
    )
    .unwrap();
    h.trace();
    assert_eq!(
        new.execute(
            "execution-zone.invalid",
            h.address,
            &request(6, 2, at + Duration::seconds(320), account)
        )
        .err(),
        Some(Denial::Rotation)
    );
    assert_eq!(h.trace()["protocolCalls"], 4);
    if let Ok(path) = std::env::var("QUANTOS_L02_ROTATION_EVIDENCE") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-l02-rotation/v1","scope":"CONTROLLED_CLOCK_REAL_CERTIFICATES_SYNTHETIC_PROCESS_LOCAL_KEYS","newVersionAtSeconds":10,"oldAcceptedAtSecondsAfterRotation":299,"oldDeniedAtSecondsAfterRotation":300,"revokedActiveDenied":true,"protocolWrites":4,"realVaultRotationSla":"NOT_RUN","productionCredentialsUsed":false})).unwrap()).unwrap();
    }
}
#[test]
fn l02_service_session_expiry_crosses_actual_tls_before_any_protocol_write() {
    let at = now();
    let account = Uuid::from_u128(1);
    let h = Harness::new(account, at, vec![900], false);
    let r = request(1, 1, at + Duration::seconds(900), account);
    assert_eq!(
        h.client(&h.peer1)
            .execute("execution-zone.invalid", h.address, &r)
            .err(),
        Some(Denial::Expired)
    );
    assert_eq!(h.trace()["protocolCalls"], 0);
    if let Ok(path) = std::env::var("QUANTOS_L02_SESSION_EVIDENCE") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-l02-session-expiry/v1","scope":"ACTUAL_MTLS_WITH_CONTROLLED_SESSION_CLOCK","atSessionExpiry":"DENIED","protocolWrites":0,"productionCredentialsUsed":false})).unwrap()).unwrap();
    }
}
#[allow(dead_code)]
#[path = "../../../crates/quantos-execution/tests/support/tp07_fixture.rs"]
mod signed_fixture;
struct RemoteKernel {
    client: ZoneClient,
    address: SocketAddr,
    events: Vec<KernelEvent>,
}
impl ExecutionKernel for RemoteKernel {
    fn submit(&mut self, _: &BoundaryCommand) -> Result<(), String> {
        Err("controlled-clock-required".into())
    }
    fn submit_at(&mut self, c: &BoundaryCommand, _: DateTime<Utc>) -> Result<(), String> {
        let r = ZoneRequest {
            session_hash: format!("sha256:{}", "1".repeat(64)),
            version: 1,
            command: c.clone(),
        };
        let receipt = self
            .client
            .execute("execution-zone.invalid", self.address, &r)
            .map_err(|e| e.to_string())?;
        self.events.extend(receipt.events);
        Ok(())
    }
    fn drain_events(&mut self) -> Vec<KernelEvent> {
        std::mem::take(&mut self.events)
    }
}
#[test]
fn l02_x03_signed_gateway_to_actual_mtls_zone_l01_and_x04_fill() {
    use quantos_execution::dispatch::SignedExecutionGateway;
    use quantos_risk::guard::Phase;
    let mut f = signed_fixture::Fixture::new();
    f.venue.venue = EXECUTION_VENUE.into();
    let guard = f.guard();
    let issuer = f.issuer(&guard);
    let proposal = f.register(&issuer);
    let risk = f.eval(&guard, Phase::Pre);
    let command = issuer
        .issue(&f.auth, &proposal, &risk, None, f.sources(), f.now)
        .unwrap();
    let at = DateTime::from_timestamp_millis(f.now.timestamp_millis() + 1).unwrap();
    let h = Harness::new(*f.auth.account_id.unwrap().as_uuid(), at, vec![], false);
    let kernel = RemoteKernel {
        client: h.client(&h.peer1),
        address: h.address,
        events: vec![],
    };
    let gateway = SignedExecutionGateway::new(
        issuer,
        GatewayLimits {
            max_quantity: 1000.into(),
            max_notional: 1_000_000.into(),
            allowed_venues: vec![EXECUTION_VENUE.into()],
        },
        kernel,
    )
    .unwrap();
    gateway.submit(&f.auth, &command, f.sources(), at).unwrap();
    assert_eq!(h.trace()["protocolCalls"], 1);
    let evidence = gateway.inspect_order(&f.auth, &command, at).unwrap();
    assert_eq!(evidence.order.status, "filled");
    assert_eq!(evidence.fills.len(), 1);
    gateway.submit(&f.auth, &command, f.sources(), at).unwrap();
    if let Ok(path) = std::env::var("QUANTOS_L02_SIGNED_EVIDENCE") {
        std::fs::write(path,serde_json::to_vec_pretty(&json!({"schema":"quantos-l02-signed-process/v1","scope":"ACTUAL_X03_TO_OWNED_MTLS_ZONE_L01_X04","orderStatus":evidence.order.status,"fills":1,"protocolWrites":1,"replayedWithoutRemoteIo":true,"vaultResolver":"OWNED_SYNTHETIC_HMAC_NOT_SUPABASE","actualTestnet":false,"productionCredentialsUsed":false})).unwrap()).unwrap();
    }
}
