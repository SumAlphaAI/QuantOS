//! L02 trusted execution-host building blocks. No public command listener,
//! database URL fallback, real venue HTTP or operator control endpoint.
use chrono::{DateTime, Duration as CD, Utc};
use openssl::{
    hash::MessageDigest,
    pkey::{PKey, Private},
    sign::Signer,
    ssl::{
        SslAcceptor, SslConnector, SslMethod, SslOptions, SslRef, SslSessionCacheMode,
        SslVerifyMode, SslVersion,
    },
    x509::{X509, X509VerifyResult},
};
use quantos_auth::ExecutionSecretStore;
use quantos_core::{ContentHash, canonical_json_bytes};
use quantos_execution::{
    gateway::{BoundaryCommand, ExecutionKernel, KernelEvent},
    venue_protocol::EXECUTION_VENUE,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    io::{Read, Write},
    net::{IpAddr, SocketAddr, TcpStream},
    time::Duration,
};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Denial {
    Tls,
    Identity,
    Session,
    Expired,
    Rotation,
    Egress,
    Signing,
    Protocol,
    Unknown,
}
impl std::fmt::Display for Denial {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "l02_{self:?}")
    }
}
impl std::error::Error for Denial {}
fn fp_valid(fp: &str) -> bool {
    fp.strip_prefix("sha256:").is_some_and(|s| {
        s.len() == 64
            && s.bytes()
                .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
    })
}
pub fn fingerprint(cert: &X509) -> Result<String, Denial> {
    Ok(format!(
        "sha256:{}",
        cert.digest(MessageDigest::sha256())
            .map_err(|_| Denial::Tls)?
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    ))
}
/// Created only from an actually verified server-side TLS stream, never JSON.
#[derive(Clone)]
pub struct VerifiedPeer {
    fingerprint: String,
    not_before: DateTime<Utc>,
    not_after: DateTime<Utc>,
}
impl VerifiedPeer {
    pub fn from_tls(tls: &SslRef) -> Result<Self, Denial> {
        if !tls
            .verify_mode()
            .contains(SslVerifyMode::PEER | SslVerifyMode::FAIL_IF_NO_PEER_CERT)
            || tls.verify_result() != X509VerifyResult::OK
        {
            return Err(Denial::Tls);
        }
        let cert = tls.peer_certificate().ok_or(Denial::Tls)?;
        let epoch = openssl::asn1::Asn1Time::from_unix(0).map_err(|_| Denial::Tls)?;
        let time = |value: &openssl::asn1::Asn1TimeRef| -> Result<DateTime<Utc>, Denial> {
            let delta = epoch.diff(value).map_err(|_| Denial::Tls)?;
            DateTime::from_timestamp(i64::from(delta.days) * 86400 + i64::from(delta.secs), 0)
                .ok_or(Denial::Tls)
        };
        Ok(Self {
            fingerprint: fingerprint(&cert)?,
            not_before: time(cert.not_before())?,
            not_after: time(cert.not_after())?,
        })
    }
}
pub fn acceptor(ca: &X509, cert: &X509, key: &PKey<Private>) -> Result<SslAcceptor, Denial> {
    let mut b = SslAcceptor::mozilla_intermediate_v5(SslMethod::tls()).map_err(|_| Denial::Tls)?;
    b.set_min_proto_version(Some(SslVersion::TLS1_2))
        .map_err(|_| Denial::Tls)?;
    b.set_certificate(cert).map_err(|_| Denial::Tls)?;
    b.set_private_key(key).map_err(|_| Denial::Tls)?;
    b.check_private_key().map_err(|_| Denial::Tls)?;
    b.cert_store_mut()
        .add_cert(ca.clone())
        .map_err(|_| Denial::Tls)?;
    b.set_verify(SslVerifyMode::PEER | SslVerifyMode::FAIL_IF_NO_PEER_CERT);
    b.set_session_cache_mode(SslSessionCacheMode::OFF);
    b.set_options(SslOptions::NO_TICKET);
    Ok(b.build())
}
/// Exact DNS, port AND pinned addresses. No resolver/proxy/redirect fallback.
#[derive(Clone)]
pub struct NetworkAllowlist {
    host: String,
    port: u16,
    addresses: BTreeSet<IpAddr>,
}
impl NetworkAllowlist {
    pub fn new(host: String, port: u16, addresses: BTreeSet<IpAddr>) -> Result<Self, Denial> {
        if port == 0
            || addresses.is_empty()
            || host.len() > 253
            || host.is_empty()
            || !host
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'.' || b == b'-')
        {
            return Err(Denial::Egress);
        }
        Ok(Self {
            host,
            port,
            addresses,
        })
    }
    pub fn check(&self, host: &str, address: SocketAddr) -> Result<(), Denial> {
        if host != self.host
            || address.port() != self.port
            || !self.addresses.contains(&address.ip())
        {
            return Err(Denial::Egress);
        }
        Ok(())
    }
}
#[derive(Clone)]
pub struct CredentialBinding {
    pub version: u64,
    pub fingerprint: String,
    pub secret_name: String,
    pub not_before: DateTime<Utc>,
    pub not_after: DateTime<Utc>,
}
impl CredentialBinding {
    fn valid(&self) -> bool {
        self.version > 0
            && self.version <= i64::MAX as u64
            && fp_valid(&self.fingerprint)
            && self.secret_name == "binance-testnet-key"
            && self.not_before < self.not_after
    }
}
#[derive(Clone)]
pub struct SessionGrant {
    pub token_hash: String,
    pub account_id: Uuid,
    pub peer_fingerprint: String,
    pub version: u64,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub revoked: bool,
}
/// Control plane owns this registry. Request payloads cannot install grants.
pub struct ZoneGuard {
    active: CredentialBinding,
    previous: Option<(CredentialBinding, DateTime<Utc>)>,
    revoked: BTreeSet<u64>,
    sessions: BTreeMap<String, SessionGrant>,
    clock: DateTime<Utc>,
}
impl ZoneGuard {
    pub fn new(active: CredentialBinding, now: DateTime<Utc>) -> Result<Self, Denial> {
        if !active.valid() || active.not_before > now || active.not_after <= now {
            return Err(Denial::Rotation);
        }
        Ok(Self {
            active,
            previous: None,
            revoked: BTreeSet::new(),
            sessions: BTreeMap::new(),
            clock: now,
        })
    }
    pub fn install_session(&mut self, s: SessionGrant) -> Result<(), Denial> {
        if !fp_valid(&s.token_hash)
            || !fp_valid(&s.peer_fingerprint)
            || s.version == 0
            || s.issued_at > self.clock
            || s.expires_at <= self.clock
            || s.expires_at - s.issued_at > CD::minutes(15)
            || self.sessions.contains_key(&s.token_hash)
            || self.sessions.len() >= 4096
        {
            return Err(Denial::Session);
        }
        self.sessions.insert(s.token_hash.clone(), s);
        Ok(())
    }
    fn tick(&mut self, now: DateTime<Utc>) -> Result<(), Denial> {
        if now < self.clock {
            return Err(Denial::Expired);
        }
        self.clock = now;
        Ok(())
    }
    pub fn rotate(&mut self, next: CredentialBinding, now: DateTime<Utc>) -> Result<(), Denial> {
        if now < self.clock
            || !next.valid()
            || next.version <= self.active.version
            || next.not_before > now
            || next.not_after <= now
            || self.revoked.contains(&next.version)
            || next.fingerprint == self.active.fingerprint
        {
            return Err(Denial::Rotation);
        }
        self.tick(now)?;
        self.previous = Some((
            std::mem::replace(&mut self.active, next),
            now + CD::minutes(5),
        ));
        Ok(())
    }
    pub fn revoke_version(&mut self, version: u64) {
        self.revoked.insert(version);
    }
    pub fn revoke_session(&mut self, token_hash: &str) {
        if let Some(s) = self.sessions.get_mut(token_hash) {
            s.revoked = true;
        }
    }
    fn authorize(
        &mut self,
        peer: &VerifiedPeer,
        request: &ZoneRequest,
        now: DateTime<Utc>,
    ) -> Result<BoundSecretRequest, Denial> {
        self.tick(now)?;
        if now < peer.not_before || now >= peer.not_after {
            return Err(Denial::Tls);
        }
        let s = self
            .sessions
            .get(&request.session_hash)
            .ok_or(Denial::Session)?;
        if s.revoked
            || s.version != request.version
            || s.peer_fingerprint != peer.fingerprint
            || s.account_id.to_string() != request.command.account_id
        {
            return Err(Denial::Identity);
        }
        if s.issued_at > now
            || s.expires_at <= now
            || request.command.expires_at <= now
            || request.command.expires_at > s.expires_at
            || request.command.expires_at - now > CD::minutes(5)
        {
            return Err(Denial::Expired);
        }
        if self.revoked.contains(&request.version) {
            return Err(Denial::Rotation);
        }
        let c = if request.version == self.active.version {
            &self.active
        } else {
            let (old, until) = self.previous.as_ref().ok_or(Denial::Rotation)?;
            if request.version != old.version || now >= *until {
                return Err(Denial::Rotation);
            }
            old
        };
        if c.fingerprint != peer.fingerprint || now < c.not_before || now >= c.not_after {
            return Err(Denial::Identity);
        }
        if request.command.venue != EXECUTION_VENUE
            || request.command.venue_kind != "cex"
            || request.command.command_id.is_empty()
            || request.command.command_id.len() > 128
            || request.command.idempotency_key.len() > 256
        {
            return Err(Denial::Protocol);
        }
        Ok(BoundSecretRequest {
            session_hash: s.token_hash.clone(),
            secret_name: c.secret_name.clone(),
            command_account: s.account_id,
            command_expires_at: request.command.expires_at,
            peer_fingerprint: peer.fingerprint.clone(),
            version: c.version,
        })
    }
}
/// Already checked by the trusted host; fields are private and not deserializable.
pub struct BoundSecretRequest {
    session_hash: String,
    secret_name: String,
    command_account: Uuid,
    command_expires_at: DateTime<Utc>,
    peer_fingerprint: String,
    version: u64,
}
impl BoundSecretRequest {
    pub fn credential_version(&self) -> u64 {
        self.version
    }
}
/// Implementations keep key material inside the execution host, return only a
/// signature. The signature itself is not serialized across the zone protocol.
pub trait VaultSigner {
    fn sign(&mut self, bound: &BoundSecretRequest, message: &[u8]) -> Result<Vec<u8>, Denial>;
}
pub struct DatabaseVaultSigner {
    store: ExecutionSecretStore,
}
impl DatabaseVaultSigner {
    pub fn connect(explicit_execution_url: &str) -> Result<Self, Denial> {
        Ok(Self {
            store: ExecutionSecretStore::connect(explicit_execution_url)
                .map_err(|_| Denial::Signing)?,
        })
    }
}
impl VaultSigner for DatabaseVaultSigner {
    fn sign(&mut self, b: &BoundSecretRequest, message: &[u8]) -> Result<Vec<u8>, Denial> {
        let secret = self
            .store
            .resolve_for_zone(
                &b.session_hash,
                &b.secret_name,
                b.command_expires_at,
                b.command_account,
                &b.peer_fingerprint,
                b.version,
            )
            .map_err(|_| Denial::Signing)?
            .ok_or(Denial::Signing)?;
        let key =
            PKey::hmac(secret.expose_to_venue_adapter().as_bytes()).map_err(|_| Denial::Signing)?;
        let mut signer = Signer::new(MessageDigest::sha256(), &key).map_err(|_| Denial::Signing)?;
        signer.update(message).map_err(|_| Denial::Signing)?;
        signer.sign_to_vec().map_err(|_| Denial::Signing)
    }
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ZoneRequest {
    pub session_hash: String,
    pub version: u64,
    #[serde(deserialize_with = "strict_command")]
    pub command: BoundaryCommand,
}
fn strict_command<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<BoundaryCommand, D::Error> {
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Wire {
        command_id: String,
        account_id: String,
        venue: String,
        venue_kind: String,
        symbol: String,
        intent: String,
        side: String,
        quantity: String,
        limit_price: Option<String>,
        stop_price: Option<String>,
        idempotency_key: String,
        expires_at: DateTime<Utc>,
    }
    let w = Wire::deserialize(deserializer)?;
    Ok(BoundaryCommand {
        command_id: w.command_id,
        account_id: w.account_id,
        venue: w.venue,
        venue_kind: w.venue_kind,
        symbol: w.symbol,
        intent: w.intent,
        side: w.side,
        quantity: w.quantity,
        limit_price: w.limit_price,
        stop_price: w.stop_price,
        idempotency_key: w.idempotency_key,
        expires_at: w.expires_at,
    })
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ZoneReceipt {
    pub events: Vec<KernelEvent>,
    pub signing_proof: ContentHash,
}
pub struct RestrictedHost<K: ExecutionKernel, S: VaultSigner> {
    guard: ZoneGuard,
    kernel: K,
    signer: S,
}
impl<K: ExecutionKernel, S: VaultSigner> RestrictedHost<K, S> {
    pub fn new(guard: ZoneGuard, kernel: K, signer: S) -> Self {
        Self {
            guard,
            kernel,
            signer,
        }
    }
    pub fn control_mut(&mut self) -> &mut ZoneGuard {
        &mut self.guard
    }
    pub fn execute(
        &mut self,
        peer: &VerifiedPeer,
        request: &ZoneRequest,
        mut clock: impl FnMut() -> DateTime<Utc>,
    ) -> Result<ZoneReceipt, Denial> {
        let now = clock();
        let b = self.guard.authorize(peer, request, now)?;
        let bytes = canonical_json_bytes(&serde_json::json!([
            "quantos-l02-authorized-command/v1",
            request.command,
            b.version,
            b.peer_fingerprint
        ]))
        .map_err(|_| Denial::Protocol)?;
        let signature = self.signer.sign(&b, &bytes)?;
        if signature.len() != 32 {
            return Err(Denial::Signing);
        }
        let dispatch_at = clock();
        self.guard.authorize(peer, request, dispatch_at)?;
        self.kernel
            .submit_at(&request.command, dispatch_at)
            .map_err(|_| Denial::Unknown)?;
        Ok(ZoneReceipt {
            events: self.kernel.drain_events(),
            signing_proof: ContentHash::sha256_bytes(&signature),
        })
    }
}
/// Actual verified TLS client for an owned/approved execution-zone endpoint.
/// Supplied peer headers cannot substitute for the certificate at the server.
pub struct ZoneClient {
    connector: SslConnector,
    policy: NetworkAllowlist,
    server_fingerprint: String,
}
impl ZoneClient {
    pub fn new(
        ca: &X509,
        cert: &X509,
        key: &PKey<Private>,
        policy: NetworkAllowlist,
        server_fingerprint: String,
    ) -> Result<Self, Denial> {
        if !fp_valid(&server_fingerprint) {
            return Err(Denial::Tls);
        }
        let mut b = SslConnector::builder(SslMethod::tls()).map_err(|_| Denial::Tls)?;
        b.set_min_proto_version(Some(SslVersion::TLS1_2))
            .map_err(|_| Denial::Tls)?;
        b.set_verify(SslVerifyMode::PEER);
        b.cert_store_mut()
            .add_cert(ca.clone())
            .map_err(|_| Denial::Tls)?;
        b.set_certificate(cert).map_err(|_| Denial::Tls)?;
        b.set_private_key(key).map_err(|_| Denial::Tls)?;
        b.check_private_key().map_err(|_| Denial::Tls)?;
        Ok(Self {
            connector: b.build(),
            policy,
            server_fingerprint,
        })
    }
    pub fn execute(
        &self,
        host: &str,
        address: SocketAddr,
        request: &ZoneRequest,
    ) -> Result<ZoneReceipt, Denial> {
        self.policy.check(host, address)?;
        let bytes = serde_json::to_vec(request).map_err(|_| Denial::Protocol)?;
        if bytes.len() > 32768 {
            return Err(Denial::Protocol);
        }
        let stream = TcpStream::connect_timeout(&address, Duration::from_secs(2))
            .map_err(|_| Denial::Unknown)?;
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .map_err(|_| Denial::Unknown)?;
        stream
            .set_write_timeout(Some(Duration::from_secs(2)))
            .map_err(|_| Denial::Unknown)?;
        let mut tls = self
            .connector
            .connect(host, stream)
            .map_err(|_| Denial::Tls)?;
        if fingerprint(&tls.ssl().peer_certificate().ok_or(Denial::Tls)?)?
            != self.server_fingerprint
        {
            return Err(Denial::Tls);
        }
        tls.write_all(&bytes).map_err(|_| Denial::Unknown)?;
        tls.write_all(b"\n").map_err(|_| Denial::Unknown)?;
        tls.flush().map_err(|_| Denial::Unknown)?;
        let bytes = read_frame(&mut tls)?;
        serde_json::from_slice::<Result<ZoneReceipt, Denial>>(&bytes)
            .map_err(|_| Denial::Protocol)?
    }
}
pub fn read_frame(input: &mut impl Read) -> Result<Vec<u8>, Denial> {
    let mut bytes = vec![];
    for _ in 0..65536 {
        let mut b = [0];
        if input.read(&mut b).map_err(|_| Denial::Protocol)? == 0 {
            return Err(Denial::Protocol);
        }
        if b[0] == b'\n' {
            return Ok(bytes);
        }
        bytes.push(b[0]);
    }
    Err(Denial::Protocol)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };
    fn now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 10, 27, 0, 0, 0).unwrap()
    }
    fn fp(n: u8) -> String {
        format!("sha256:{}", format!("{n:02x}").repeat(32))
    }
    fn credential(version: u64) -> CredentialBinding {
        CredentialBinding {
            version,
            fingerprint: fp(version as u8),
            secret_name: "binance-testnet-key".into(),
            not_before: now(),
            not_after: now() + CD::days(1),
        }
    }
    fn session(version: u64) -> SessionGrant {
        SessionGrant {
            token_hash: fp(20 + version as u8),
            account_id: Uuid::from_u128(1),
            peer_fingerprint: fp(version as u8),
            version,
            issued_at: now(),
            expires_at: now() + CD::minutes(15),
            revoked: false,
        }
    }
    fn request(version: u64) -> ZoneRequest {
        ZoneRequest {
            session_hash: session(version).token_hash,
            version,
            command: BoundaryCommand {
                command_id: "owned-command".into(),
                account_id: Uuid::from_u128(1).to_string(),
                venue: EXECUTION_VENUE.into(),
                venue_kind: "cex".into(),
                symbol: "BTCUSDT".into(),
                intent: "limit".into(),
                side: "buy".into(),
                quantity: "1".into(),
                limit_price: Some("100".into()),
                stop_price: None,
                idempotency_key: "owned-key".into(),
                expires_at: now() + CD::minutes(2),
            },
        }
    }
    fn guard() -> ZoneGuard {
        let mut g = ZoneGuard::new(credential(1), now()).unwrap();
        g.install_session(session(1)).unwrap();
        g
    }
    fn peer(version: u8) -> VerifiedPeer {
        VerifiedPeer {
            fingerprint: fp(version),
            not_before: now() - CD::hours(1),
            not_after: now() + CD::days(1),
        }
    }
    #[test]
    fn l02_session_account_peer_version_and_ttl_reject_before_secret() {
        for mutation in [
            "peer",
            "account",
            "version",
            "revoked",
            "session-expired",
            "command-expired",
            "command-beyond-session",
            "future-session",
            "bad-venue",
        ] {
            let mut g = guard();
            let mut r = request(1);
            let mut p = peer(1);
            let mut at = now();
            match mutation {
                "peer" => p = peer(2),
                "account" => r.command.account_id = Uuid::from_u128(2).to_string(),
                "version" => r.version = 2,
                "revoked" => g.revoke_session(&r.session_hash),
                "session-expired" => {
                    at += CD::minutes(15);
                    r.command.expires_at = at + CD::seconds(1)
                }
                "command-expired" => r.command.expires_at = now(),
                "command-beyond-session" => r.command.expires_at = now() + CD::minutes(16),
                "future-session" => {
                    g.sessions.get_mut(&r.session_hash).unwrap().issued_at += CD::seconds(1)
                }
                _ => r.command.venue = "OTHER".into(),
            }
            assert!(g.authorize(&p, &r, at).is_err(), "{mutation}");
        }
    }
    #[test]
    fn l02_rotation_has_half_open_drain_and_immediate_revocation() {
        let mut g = guard();
        g.rotate(credential(2), now()).unwrap();
        g.install_session(session(2)).unwrap();
        let mut r = request(1);
        r.command.expires_at = now() + CD::minutes(6);
        g.authorize(&peer(1), &r, now() + CD::seconds(299)).unwrap();
        assert!(g.authorize(&peer(1), &r, now() + CD::seconds(300)).is_err());
        let mut r = request(2);
        r.command.expires_at = now() + CD::minutes(6);
        g.authorize(&peer(2), &r, now() + CD::seconds(300)).unwrap();
        g.revoke_version(2);
        assert!(g.authorize(&peer(2), &r, now() + CD::seconds(300)).is_err());
    }
    #[test]
    fn l02_rotation_control_updates_are_atomic_and_cannot_rollback() {
        let mut g = guard();
        for mut c in [credential(1), credential(0), credential(2)] {
            if c.version == 2 {
                c.not_before = now() + CD::seconds(1);
            }
            assert_eq!(g.rotate(c, now()), Err(Denial::Rotation));
            assert_eq!(g.active.version, 1);
        }
        g.rotate(credential(2), now()).unwrap();
        assert!(g.rotate(credential(1), now()).is_err());
        g.authorize(&peer(1), &request(1), now() + CD::seconds(1))
            .unwrap();
        assert!(g.authorize(&peer(1), &request(1), now()).is_err());
    }
    #[test]
    fn l02_no_unbounded_or_duplicate_session_can_be_installed() {
        let mut g = guard();
        assert!(g.install_session(session(1)).is_err());
        let mut s = session(2);
        s.expires_at += CD::seconds(1);
        assert!(g.install_session(s).is_err());
        let mut s = session(2);
        s.token_hash = "owned-unhashed-canary".into();
        assert!(g.install_session(s).is_err());
    }
    #[test]
    fn l02_exact_dns_port_and_pinned_address_precede_connection() {
        let p = NetworkAllowlist::new(
            "execution-zone.invalid".into(),
            443,
            ["127.0.0.1".parse().unwrap()].into(),
        )
        .unwrap();
        p.check("execution-zone.invalid", "127.0.0.1:443".parse().unwrap())
            .unwrap();
        for (host, ip) in [
            ("execution-zone.invalid.evil", "127.0.0.1:443"),
            ("execution-zone.invalid", "127.0.0.1:80"),
            ("execution-zone.invalid", "127.0.0.2:443"),
            ("execution-zone.invalid@evil", "127.0.0.1:443"),
            ("EXECUTION-ZONE.INVALID", "127.0.0.1:443"),
        ] {
            assert!(p.check(host, ip.parse().unwrap()).is_err());
        }
    }
    struct SpyKernel(Arc<AtomicUsize>);
    impl ExecutionKernel for SpyKernel {
        fn submit(&mut self, _: &BoundaryCommand) -> Result<(), String> {
            self.0.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }
        fn drain_events(&mut self) -> Vec<KernelEvent> {
            vec![]
        }
    }
    struct SpySigner {
        calls: Arc<AtomicUsize>,
        fail: bool,
    }
    impl VaultSigner for SpySigner {
        fn sign(&mut self, _: &BoundSecretRequest, _: &[u8]) -> Result<Vec<u8>, Denial> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            if self.fail {
                Err(Denial::Signing)
            } else {
                Ok(vec![7; 32])
            }
        }
    }
    #[test]
    fn l02_authorization_and_signing_failure_never_enter_kernel() {
        for fail in [false, true] {
            let kernel = Arc::new(AtomicUsize::new(0));
            let signer = Arc::new(AtomicUsize::new(0));
            let mut h = RestrictedHost::new(
                guard(),
                SpyKernel(kernel.clone()),
                SpySigner {
                    calls: signer.clone(),
                    fail,
                },
            );
            let mut r = request(1);
            r.command.expires_at = now();
            assert!(h.execute(&peer(1), &r, now).is_err());
            assert_eq!(signer.load(Ordering::SeqCst), 0);
            r.command.expires_at = now() + CD::seconds(1);
            assert_eq!(h.execute(&peer(1), &r, now).is_err(), fail);
            assert_eq!(kernel.load(Ordering::SeqCst), usize::from(!fail));
        }
    }
    #[test]
    fn l02_verified_peer_certificate_lifetime_is_rechecked() {
        for not_yet_valid in [false, true] {
            let mut p = peer(1);
            if not_yet_valid {
                p.not_before = now() + CD::seconds(1);
            } else {
                p.not_after = now();
            }
            assert_eq!(
                guard().authorize(&p, &request(1), now()).err(),
                Some(Denial::Tls)
            );
        }
    }
    #[test]
    fn l02_signing_delay_expiry_is_rechecked_at_dispatch() {
        let kernel = Arc::new(AtomicUsize::new(0));
        let signer = Arc::new(AtomicUsize::new(0));
        let mut host = RestrictedHost::new(
            guard(),
            SpyKernel(kernel.clone()),
            SpySigner {
                calls: signer.clone(),
                fail: false,
            },
        );
        let mut r = request(1);
        r.command.expires_at = now() + CD::seconds(1);
        let mut clocks = [now(), now() + CD::seconds(1)].into_iter();
        assert_eq!(
            host.execute(&peer(1), &r, || clocks.next().unwrap()).err(),
            Some(Denial::Expired)
        );
        assert_eq!(signer.load(Ordering::SeqCst), 1);
        assert_eq!(kernel.load(Ordering::SeqCst), 0);
    }
    #[test]
    fn l02_wire_refuses_authority_fields_and_oversized_truncated_frames() {
        let mut v = serde_json::to_value(request(1)).unwrap();
        v["peer_fingerprint"] = serde_json::json!(fp(1));
        assert!(serde_json::from_value::<ZoneRequest>(v).is_err());
        let mut nested = serde_json::to_value(request(1)).unwrap();
        nested["command"]["actor_id"] = serde_json::json!("forged");
        assert!(serde_json::from_value::<ZoneRequest>(nested).is_err());
        assert!(read_frame(&mut &b"{}"[..]).is_err());
        assert!(read_frame(&mut &vec![b'x'; 65537][..]).is_err());
    }
    #[test]
    fn l02_errors_never_serialize_arbitrary_secret_or_endpoint_material() {
        for e in [
            Denial::Tls,
            Denial::Identity,
            Denial::Session,
            Denial::Signing,
            Denial::Unknown,
        ] {
            assert!(!format!("{e:?} {e}").contains("owned-canary"));
            assert!(
                serde_json::to_string(&Err::<ZoneReceipt, _>(e))
                    .unwrap()
                    .len()
                    < 80
            );
        }
    }
}
