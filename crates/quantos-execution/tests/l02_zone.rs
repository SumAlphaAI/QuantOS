use chrono::{Duration, TimeZone, Utc};
use quantos_execution::zone::*;
fn now() -> chrono::DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 10, 27, 0, 0, 0).unwrap()
}
fn credential(version: u64, issued_at: chrono::DateTime<Utc>) -> CredentialVersion {
    CredentialVersion {
        version,
        fingerprint: format!("owned-fingerprint-{version}"),
        issued_at,
    }
}
#[test]
fn l02_future_session_is_not_yet_authority() {
    let session = ServiceSession {
        service_name: "execution-gateway".into(),
        mtls_fingerprint: "owned-fingerprint".into(),
        issued_at: now() + Duration::seconds(1),
        expires_at: now() + Duration::minutes(2),
    };
    assert!(session.validate(now()).is_err());
}
#[test]
fn l02_rotation_never_authorizes_before_issuance_or_before_rotation() {
    let mut r = RotationManager::new(credential(1, now()));
    r.rotate(
        credential(2, now() + Duration::minutes(1)),
        now() + Duration::minutes(1),
    );
    assert!(r.validate(2, now()).is_err());
    assert!(r.validate(1, now() - Duration::seconds(1)).is_err());
}
#[test]
fn l02_rotation_window_is_half_open_and_previous_can_be_revoked() {
    let mut r = RotationManager::new(credential(1, now()));
    r.rotate(credential(2, now()), now());
    r.validate(1, now() + Duration::seconds(299)).unwrap();
    assert!(r.validate(1, now() + Duration::seconds(300)).is_err());
    r.revoke_previous();
    assert!(r.validate(1, now()).is_err());
}
