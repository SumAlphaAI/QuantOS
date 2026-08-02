use std::collections::BTreeSet;

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::TradeCommand;

/// Rotation window: previous credentials stay usable for at most five minutes
/// after rotation while services recover.
pub const ROTATION_RECOVERY_WINDOW: ChronoDuration = ChronoDuration::minutes(5);

// ---------------------------------------------------------------------------
// Vault static secret references (no dynamic leases by design)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ZoneCaller {
    ExecutionGateway,
    ResearchEngine,
    Ui,
    Bff,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VaultSecretRef {
    pub name: String,
    pub purpose: String,
    /// Static reference to the Vault entry (`vault://...`); secret material is
    /// never present in this process boundary.
    pub vault_ref: String,
    pub rotated_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
}

impl VaultSecretRef {
    #[must_use]
    pub fn venue_testnet_key() -> Self {
        Self {
            name: "binance-testnet-key".to_owned(),
            purpose: "L01 approved testnet venue authentication".to_owned(),
            vault_ref: "vault://quantos/execution/binance-testnet-key".to_owned(),
            rotated_at: None,
            revoked_at: None,
        }
    }
}

#[derive(Debug, Error)]
pub enum ZoneError {
    #[error("ZONE_SECRET_ACCESS_DENIED: caller `{caller}` cannot resolve Vault secrets")]
    SecretAccessDenied { caller: String },
    #[error("ZONE_SECRET_REVOKED: secret `{name}` was revoked")]
    SecretRevoked { name: String },
    #[error("ZONE_SESSION_EXPIRED: service session `{service}` expired at {expires_at}")]
    SessionExpired {
        service: String,
        expires_at: DateTime<Utc>,
    },
    #[error("ZONE_COMMAND_EXPIRED: command `{command_id}` expired at {expires_at}")]
    CommandExpired {
        command_id: String,
        expires_at: DateTime<Utc>,
    },
    #[error("ZONE_EGRESS_BLOCKED: host `{host}` is not on the execution allowlist")]
    EgressBlocked { host: String },
    #[error("ZONE_MTLS_INVALID: certificate for `{service}` is not usable: {reason}")]
    MtlsInvalid { service: String, reason: String },
    #[error("ZONE_CREDENTIAL_STALE: credential version `{version}` is outside the rotation window")]
    CredentialStale { version: u64 },
}

/// Resolve a Vault reference for a caller. Only the Execution Gateway inside
/// the restricted zone may resolve; research engines, UI, and ordinary BFF
/// callers are always denied.
pub fn resolve_secret_ref(
    caller: ZoneCaller,
    secret: &VaultSecretRef,
) -> Result<VaultSecretRef, ZoneError> {
    if caller != ZoneCaller::ExecutionGateway {
        return Err(ZoneError::SecretAccessDenied {
            caller: format!("{caller:?}"),
        });
    }
    if secret.revoked_at.is_some() {
        return Err(ZoneError::SecretRevoked {
            name: secret.name.clone(),
        });
    }
    Ok(secret.clone())
}

// ---------------------------------------------------------------------------
// Service sessions + command TTL
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
pub struct ServiceSession {
    pub service_name: String,
    pub mtls_fingerprint: String,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

impl ServiceSession {
    pub fn validate(&self, now: DateTime<Utc>) -> Result<(), ZoneError> {
        if self.expires_at <= now {
            return Err(ZoneError::SessionExpired {
                service: self.service_name.clone(),
                expires_at: self.expires_at,
            });
        }
        Ok(())
    }
}

pub fn validate_command_ttl(command: &TradeCommand, now: DateTime<Utc>) -> Result<(), ZoneError> {
    if command.expires_at <= now {
        return Err(ZoneError::CommandExpired {
            command_id: command.command_id.to_string(),
            expires_at: command.expires_at,
        });
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Network egress allowlist (minimum egress by default)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default)]
pub struct EgressPolicy {
    allowed_hosts: BTreeSet<String>,
}

impl EgressPolicy {
    #[must_use]
    pub fn new(allowed_hosts: impl IntoIterator<Item = impl Into<String>>) -> Self {
        Self {
            allowed_hosts: allowed_hosts.into_iter().map(Into::into).collect(),
        }
    }

    /// Default execution-zone policy: only the approved testnet venue plus the
    /// platform control plane are reachable.
    #[must_use]
    pub fn execution_default() -> Self {
        Self::new(["testnet.binance.vision", "supabase.sumalpha.internal"])
    }

    pub fn check(&self, host: &str) -> Result<(), ZoneError> {
        if self.allowed_hosts.contains(host) {
            return Ok(());
        }
        Err(ZoneError::EgressBlocked {
            host: host.to_owned(),
        })
    }

    #[must_use]
    pub fn allowed_count(&self) -> usize {
        self.allowed_hosts.len()
    }
}

// ---------------------------------------------------------------------------
// mTLS identity + credential rotation/revocation
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
pub struct MtlsIdentity {
    pub service_name: String,
    pub cert_fingerprint: String,
    pub not_after: DateTime<Utc>,
    pub revoked: bool,
}

impl MtlsIdentity {
    pub fn validate(&self, now: DateTime<Utc>) -> Result<(), ZoneError> {
        if self.revoked {
            return Err(ZoneError::MtlsInvalid {
                service: self.service_name.clone(),
                reason: "certificate revoked".to_owned(),
            });
        }
        if self.not_after <= now {
            return Err(ZoneError::MtlsInvalid {
                service: self.service_name.clone(),
                reason: "certificate expired".to_owned(),
            });
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct CredentialVersion {
    pub version: u64,
    pub fingerprint: String,
    pub issued_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct RotationManager {
    active: CredentialVersion,
    previous: Option<(CredentialVersion, DateTime<Utc>)>,
}

impl RotationManager {
    #[must_use]
    pub fn new(active: CredentialVersion) -> Self {
        Self {
            active,
            previous: None,
        }
    }

    pub fn rotate(&mut self, next: CredentialVersion, rotated_at: DateTime<Utc>) {
        self.previous = Some((std::mem::replace(&mut self.active, next), rotated_at));
    }

    pub fn revoke_previous(&mut self) {
        self.previous = None;
    }

    /// A credential is usable when it is active, or when it is the immediately
    /// previous version still inside the five-minute recovery window.
    pub fn validate(&self, version: u64, now: DateTime<Utc>) -> Result<(), ZoneError> {
        if version == self.active.version {
            return Ok(());
        }
        if let Some((previous, rotated_at)) = &self.previous
            && version == previous.version
            && now - *rotated_at <= ROTATION_RECOVERY_WINDOW
        {
            return Ok(());
        }
        Err(ZoneError::CredentialStale { version })
    }

    #[must_use]
    pub fn active(&self) -> &CredentialVersion {
        &self.active
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_core::{CommandId, ContentHash, DecisionId};

    use super::*;
    use crate::{OrderIntent, OrderSide, VenueKind};

    fn now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
    }

    fn command_fixture(expires_at: DateTime<Utc>) -> TradeCommand {
        TradeCommand {
            command_id: CommandId::new(),
            decision_id: DecisionId::new(),
            account_id: "paper-account-0".to_owned(),
            venue: "binance-spot-testnet".to_owned(),
            venue_kind: VenueKind::Cex,
            symbol: "BTCUSDT".to_owned(),
            intent: OrderIntent::Limit,
            side: OrderSide::Buy,
            quantity: "1.0".to_owned(),
            limit_price: Some("100.25".to_owned()),
            stop_price: None,
            idempotency_key: "l02-1".to_owned(),
            approval_signature: None,
            expires_at,
            signature: ContentHash::sha256_bytes(b"l02"),
            issued_at: now(),
        }
    }

    #[test]
    fn only_execution_gateway_can_resolve_vault_references() {
        let secret = VaultSecretRef::venue_testnet_key();
        let resolved = resolve_secret_ref(ZoneCaller::ExecutionGateway, &secret)
            .expect("execution gateway resolves");
        assert_eq!(resolved.vault_ref, secret.vault_ref);

        for caller in [ZoneCaller::ResearchEngine, ZoneCaller::Ui, ZoneCaller::Bff] {
            let error = resolve_secret_ref(caller, &secret)
                .expect_err("non-execution callers must be denied");
            assert!(matches!(error, ZoneError::SecretAccessDenied { .. }));
        }

        let revoked = VaultSecretRef {
            revoked_at: Some(now()),
            ..VaultSecretRef::venue_testnet_key()
        };
        let error = resolve_secret_ref(ZoneCaller::ExecutionGateway, &revoked)
            .expect_err("revoked secrets are denied");
        assert!(matches!(error, ZoneError::SecretRevoked { .. }));
    }

    #[test]
    fn expired_sessions_and_commands_are_rejected() {
        let valid_session = ServiceSession {
            service_name: "execution-gateway".to_owned(),
            mtls_fingerprint: "sha256:cert".to_owned(),
            issued_at: now(),
            expires_at: now() + ChronoDuration::minutes(15),
        };
        valid_session.validate(now()).expect("valid session");

        let expired_session = ServiceSession {
            expires_at: now() - ChronoDuration::seconds(1),
            ..valid_session.clone()
        };
        let error = expired_session
            .validate(now())
            .expect_err("expired session rejected");
        assert!(matches!(error, ZoneError::SessionExpired { .. }));

        validate_command_ttl(&command_fixture(now() + ChronoDuration::minutes(2)), now())
            .expect("fresh command passes");
        let error =
            validate_command_ttl(&command_fixture(now() - ChronoDuration::seconds(1)), now())
                .expect_err("expired command rejected");
        assert!(matches!(error, ZoneError::CommandExpired { .. }));
    }

    #[test]
    fn unlisted_egress_hosts_are_blocked() {
        let policy = EgressPolicy::execution_default();
        policy
            .check("testnet.binance.vision")
            .expect("approved testnet venue allowed");
        assert!(policy.allowed_count() <= 2, "minimum egress surface");

        for host in [
            "api.binance.com",
            "fstream.binance.com",
            "example.com",
            "telemetry.unapproved.io",
        ] {
            let error = policy.check(host).expect_err("unlisted host blocked");
            assert!(matches!(error, ZoneError::EgressBlocked { .. }));
        }
    }

    #[test]
    fn rotation_recovers_within_five_minutes_then_stales() {
        let v1 = CredentialVersion {
            version: 1,
            fingerprint: "sha256:cert-v1".to_owned(),
            issued_at: now(),
        };
        let v2 = CredentialVersion {
            version: 2,
            fingerprint: "sha256:cert-v2".to_owned(),
            issued_at: now() + ChronoDuration::minutes(10),
        };
        let mut manager = RotationManager::new(v1);
        manager.rotate(v2, now() + ChronoDuration::minutes(10));

        let rotated_at = now() + ChronoDuration::minutes(10);
        manager
            .validate(2, rotated_at + ChronoDuration::minutes(1))
            .expect("new credential works immediately");
        manager
            .validate(1, rotated_at + ChronoDuration::minutes(4))
            .expect("previous credential works inside the recovery window");

        let error = manager
            .validate(1, rotated_at + ChronoDuration::minutes(6))
            .expect_err("previous credential stales after five minutes");
        assert!(matches!(error, ZoneError::CredentialStale { .. }));

        manager.revoke_previous();
        let error = manager
            .validate(1, rotated_at + ChronoDuration::minutes(1))
            .expect_err("revoked previous credential rejected");
        assert!(matches!(error, ZoneError::CredentialStale { .. }));
    }

    #[test]
    fn mtls_identity_enforces_expiry_and_revocation() {
        let identity = MtlsIdentity {
            service_name: "execution-gateway".to_owned(),
            cert_fingerprint: "sha256:cert".to_owned(),
            not_after: now() + ChronoDuration::days(30),
            revoked: false,
        };
        identity.validate(now()).expect("valid identity");

        let expired = MtlsIdentity {
            not_after: now() - ChronoDuration::seconds(1),
            ..identity.clone()
        };
        assert!(matches!(
            expired.validate(now()),
            Err(ZoneError::MtlsInvalid { .. })
        ));

        let revoked = MtlsIdentity {
            revoked: true,
            ..identity
        };
        assert!(matches!(
            revoked.validate(now()),
            Err(ZoneError::MtlsInvalid { .. })
        ));
    }

    #[test]
    fn zone_fixtures_contain_no_secret_material() {
        let zone_source = include_str!("zone.rs")
            .split("#[cfg(test)]")
            .next()
            .expect("module header exists")
            .to_lowercase();
        for forbidden in [
            "begin private key",
            "begin rsa private key",
            "akia",
            "api_secret=",
            "password=",
        ] {
            assert!(
                !zone_source.contains(forbidden),
                "zone module must not embed secret material pattern `{forbidden}`"
            );
        }
    }
}
