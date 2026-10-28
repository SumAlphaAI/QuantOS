//! Explicit owned fixture mode; never the default service command ingress.
//! Keys/certificates are ephemeral files supplied by the local test harness.
use chrono::{DateTime, Duration, Utc};
use execution_gateway::restricted_zone::*;
use openssl::{hash::MessageDigest, pkey::PKey, sign::Signer, x509::X509};
use quantos_execution::{venue::VenueConfig, venue_protocol::*};
use serde_json::{Value, json};
use std::{
    io::{Write, stdout},
    net::TcpListener,
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
};
#[path = "../../../crates/quantos-execution/tests/support/l01_fixture.rs"]
mod fixture;
struct OwnedSigner([PKey<openssl::pkey::Private>; 2]);
impl VaultSigner for OwnedSigner {
    fn sign(&mut self, b: &BoundSecretRequest, message: &[u8]) -> Result<Vec<u8>, Denial> {
        let key = self
            .0
            .get(
                b.credential_version()
                    .checked_sub(1)
                    .ok_or(Denial::Signing)? as usize,
            )
            .ok_or(Denial::Signing)?;
        let mut signer = Signer::new(MessageDigest::sha256(), key).map_err(|_| Denial::Signing)?;
        signer.update(message).map_err(|_| Denial::Signing)?;
        signer.sign_to_vec().map_err(|_| Denial::Signing)
    }
}
fn owned_key() -> PKey<openssl::pkey::Private> {
    let mut bytes = [0; 32];
    openssl::rand::rand_bytes(&mut bytes).unwrap();
    let key = PKey::hmac(&bytes).unwrap();
    bytes.fill(0);
    key
}
struct OwnedPort(Arc<AtomicUsize>);
impl ProtocolPort for OwnedPort {
    fn exchange(&mut self, request: &Request) -> Result<Response, TransportFault> {
        let count = self.0.fetch_add(1, Ordering::SeqCst) + 1;
        let case = json!({"kind":"filled","quantity":request.params["quantity"],"price":request.params["price"],"side":request.params["side"].to_lowercase(),"orderId":count as u64+100,"tradeId":count as u64+200});
        Ok(fixture::response(fixture::reply(
            &case,
            request,
            &request.params["newClientOrderId"],
        )))
    }
}
pub fn serve_owned_fixture(
    directory: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let dir = PathBuf::from(directory);
    let temporary = std::env::temp_dir().canonicalize()?;
    let dir = dir.canonicalize()?;
    if dir.parent() != Some(temporary.as_path())
        || !dir
            .file_name()
            .and_then(|s| s.to_str())
            .is_some_and(|s| s.starts_with("quantos-l02-"))
    {
        return Err(Box::new(Denial::Protocol));
    }
    for name in [
        "config.json",
        "ca.pem",
        "server.pem",
        "server-key.pem",
        "peer-1.pem",
        "peer-2.pem",
    ] {
        if !std::fs::symlink_metadata(dir.join(name))?
            .file_type()
            .is_file()
        {
            return Err(Box::new(Denial::Protocol));
        }
    }
    let config: Value = serde_json::from_slice(&std::fs::read(dir.join("config.json"))?)?;
    let ca = X509::from_pem(&std::fs::read(dir.join("ca.pem"))?)?;
    let cert = X509::from_pem(&std::fs::read(dir.join("server.pem"))?)?;
    let key = PKey::private_key_from_pem(&std::fs::read(dir.join("server-key.pem"))?)?;
    let peer1 = fingerprint(&X509::from_pem(&std::fs::read(dir.join("peer-1.pem"))?)?)?;
    let peer2 = fingerprint(&X509::from_pem(&std::fs::read(dir.join("peer-2.pem"))?)?)?;
    let base: DateTime<Utc> = serde_json::from_value(config["now"].clone())?;
    let account: uuid::Uuid = serde_json::from_value(config["account"].clone())?;
    let credential = |version, fp: String| CredentialBinding {
        version,
        fingerprint: fp,
        secret_name: "binance-testnet-key".into(),
        not_before: base,
        not_after: base + Duration::days(1),
    };
    let session = |version, fp: String| SessionGrant {
        token_hash: format!("sha256:{}", if version == 1 { "1" } else { "2" }.repeat(64)),
        account_id: account,
        peer_fingerprint: fp,
        version,
        issued_at: base,
        expires_at: base + Duration::minutes(15),
        revoked: false,
    };
    let mut guard = ZoneGuard::new(credential(1, peer1.clone()), base)?;
    guard.install_session(session(1, peer1))?;
    let mut rules = fixture::rules();
    rules.observed_at = base - Duration::seconds(1);
    rules.expires_at = base + Duration::hours(1);
    let calls = Arc::new(AtomicUsize::new(0));
    let kernel = ProtocolKernel::new(
        VenueConfig::approved_testnet(),
        rules,
        OwnedPort(calls.clone()),
    )
    .map_err(|_| Denial::Protocol)?;
    let mut host = RestrictedHost::new(guard, kernel, OwnedSigner([owned_key(), owned_key()]));
    let tls = acceptor(&ca, &cert, &key)?;
    let listener = TcpListener::bind("127.0.0.1:0")?;
    println!(
        "L02_READY={}",
        json!({"pid":std::process::id(),"address":listener.local_addr()?.to_string(),"backend":"OWNED_L02_MTLS","serverFingerprint":fingerprint(&cert)?})
    );
    stdout().flush()?;
    let mut index = 0;
    let mut rotated = false;
    for stream in listener.incoming() {
        let stream = stream?;
        stream.set_read_timeout(Some(std::time::Duration::from_secs(2)))?;
        stream.set_write_timeout(Some(std::time::Duration::from_secs(2)))?;
        let Ok(mut channel) = tls.accept(stream) else {
            continue;
        };
        let Ok(peer) = VerifiedPeer::from_tls(channel.ssl()) else {
            continue;
        };
        let Ok(bytes) = read_frame(&mut channel) else {
            continue;
        };
        let result = if let Ok(request) = serde_json::from_slice::<ZoneRequest>(&bytes) {
            // Schedule is fixture-only trusted control input, never a request clock field.
            let at = if config["wallClock"] == true {
                DateTime::from_timestamp_millis(Utc::now().timestamp_millis())
                    .ok_or(Denial::Protocol)?
            } else {
                base + Duration::seconds(config["schedule"][index].as_i64().unwrap_or(0))
            };
            index += 1;
            if config["rotation"] == true && at >= base + Duration::seconds(10) && !rotated {
                host.control_mut()
                    .rotate(credential(2, peer2.clone()), base + Duration::seconds(10))?;
                host.control_mut()
                    .install_session(session(2, peer2.clone()))?;
                rotated = true;
            }
            if config["rotation"] == true && at >= base + Duration::seconds(320) {
                host.control_mut().revoke_version(2);
            }
            host.execute(&peer, &request, || at)
        } else {
            Err(Denial::Protocol)
        };
        if config["pauseReplyAtRequest"].as_u64() == Some(index as u64) {
            println!(
                "L02_PENDING={}",
                json!({"protocolCalls":calls.load(Ordering::SeqCst),"requests":index})
            );
            stdout().flush()?;
            // Explicit owned crash-window injection; never used by live ingress.
            std::thread::sleep(std::time::Duration::from_millis(800));
        }
        let bytes = serde_json::to_vec(&result)?;
        let _ = channel.write_all(&bytes);
        let _ = channel.write_all(b"\n");
        let _ = channel.flush();
        println!(
            "L02_TRACE={}",
            json!({"protocolCalls":calls.load(Ordering::SeqCst),"requests":index})
        );
        stdout().flush()?;
    }
    Ok(())
}
