//! Shared invariants executed by the live handlers, not reference-only fixtures.
use axum::http::StatusCode;
use chrono::{DateTime, Duration, Utc};
use serde_json::Value;

use super::settings::{ApiError, hash};

pub(super) fn csrf_valid(expected: &str, cookie: Option<&str>, header: Option<&str>) -> bool {
    cookie
        .zip(header)
        .is_some_and(|(cookie, header)| cookie == header && hash(header) == expected)
}

pub(super) fn factors_from_user(user: &Value) -> Result<Vec<Value>, ApiError> {
    // Supabase User.Factors is omitempty: an absent member means no factors.
    if user.get("factors").is_none() {
        return user["id"]
            .as_str()
            .and_then(|id| uuid::Uuid::parse_str(id).ok())
            .map(|_| Vec::new())
            .ok_or_else(ApiError::unavailable);
    }
    let factors = user["factors"]
        .as_array()
        .ok_or_else(ApiError::unavailable)?;
    if factors.iter().any(|factor| {
        !matches!(factor["status"].as_str(), Some("verified" | "unverified"))
            || factor["id"]
                .as_str()
                .and_then(|id| uuid::Uuid::parse_str(id).ok())
                .is_none()
    }) {
        return Err(ApiError::unavailable());
    }
    Ok(factors.clone())
}

pub(super) fn authorize_enrollment(
    scope: &str,
    factors: &[Value],
    recovering_existing: bool,
) -> Result<(), ApiError> {
    if scope == "security"
        || scope == "first_factor"
            && (recovering_existing || !factors.iter().any(|f| f["status"] == "verified"))
    {
        return Ok(());
    }
    Err(ApiError::new(StatusCode::FORBIDDEN, "RECENT_AUTH_REQUIRED"))
}

pub(super) fn cancellation_policy(
    current: Option<&Value>,
    checkpoint_cancel: bool,
) -> &'static str {
    if current.map_or(checkpoint_cancel, |factor| factor["status"] == "unverified") {
        "cancelUnverifiedMfa"
    } else {
        "revokeMfaFactor"
    }
}

pub(super) fn protect_last_factor(factors: &[Value], target: &Value) -> Result<(), ApiError> {
    if target["status"] == "verified"
        && factors.iter().filter(|f| f["status"] == "verified").count() <= 1
    {
        return Err(ApiError::new(StatusCode::CONFLICT, "LAST_FACTOR_PROTECTED"));
    }
    Ok(())
}

pub(super) fn challenge_expiry(now: DateTime<Utc>) -> DateTime<Utc> {
    now + Duration::minutes(5)
}

pub(super) fn delivery_authorized(authorized: bool) -> bool {
    authorized
}

pub(super) fn last_verified_at(
    user: &Value,
    mfa_at: Option<DateTime<Utc>>,
) -> Result<DateTime<Utc>, ApiError> {
    let primary = user["last_sign_in_at"]
        .as_str()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|t| t.with_timezone(&Utc));
    primary
        .into_iter()
        .chain(mfa_at)
        .filter(|t| *t <= Utc::now() + Duration::seconds(30))
        .max()
        .ok_or_else(ApiError::unavailable)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn factor(status: &str) -> Value {
        json!({"id":"11111111-1111-4111-8111-111111111111", "status":status})
    }

    #[test]
    fn first_factor_cannot_create_after_any_verified_factor_exists() {
        let verified = factor("verified");
        assert_eq!(
            authorize_enrollment("first_factor", std::slice::from_ref(&verified), false)
                .unwrap_err()
                .status,
            StatusCode::FORBIDDEN
        );
        assert!(authorize_enrollment("first_factor", &[factor("unverified")], false).is_ok());
        assert!(authorize_enrollment("security", std::slice::from_ref(&verified), false).is_ok());
        assert!(authorize_enrollment("first_factor", &[verified], true).is_ok());
        assert!(authorize_enrollment("unknown", &[], true).is_err());
    }

    #[test]
    fn current_factor_status_overrides_cancel_checkpoint() {
        assert_eq!(
            cancellation_policy(Some(&factor("verified")), true),
            "revokeMfaFactor"
        );
        assert_eq!(
            cancellation_policy(Some(&factor("unverified")), false),
            "cancelUnverifiedMfa"
        );
        assert_eq!(cancellation_policy(None, true), "cancelUnverifiedMfa");
        assert_eq!(cancellation_policy(None, false), "revokeMfaFactor");
    }

    #[test]
    fn malformed_factor_state_cannot_be_treated_as_unenrolled() {
        for value in [
            json!({}),
            json!({"factors":null}),
            json!({"factors":[{}]}),
            json!({"factors":[{"id":"bad","status":"verified"}]}),
        ] {
            assert!(factors_from_user(&value).is_err());
        }
        assert!(
            factors_from_user(&json!({"id":"11111111-1111-4111-8111-111111111111"}))
                .unwrap()
                .is_empty()
        );
        assert!(
            factors_from_user(&json!({"factors":[]}))
                .unwrap()
                .is_empty()
        );
        assert_eq!(
            factors_from_user(&json!({"factors":[factor("unverified")]}))
                .unwrap()
                .len(),
            1
        );
    }

    #[test]
    fn last_verified_factor_cannot_be_removed_even_with_unverified_siblings() {
        let verified = factor("verified");
        assert_eq!(
            protect_last_factor(&[verified.clone(), factor("unverified")], &verified)
                .unwrap_err()
                .status,
            StatusCode::CONFLICT
        );
        assert!(protect_last_factor(&[verified.clone(), verified.clone()], &verified).is_ok());
        assert!(protect_last_factor(&[verified], &factor("unverified")).is_ok());
    }

    #[test]
    fn live_csrf_requires_bound_cookie_and_header() {
        let digest = hash("correct");
        assert!(csrf_valid(&digest, Some("correct"), Some("correct")));
        for (cookie, header) in [
            (None, Some("correct")),
            (Some("correct"), None),
            (Some("wrong"), Some("correct")),
            (Some("wrong"), Some("wrong")),
        ] {
            assert!(!csrf_valid(&digest, cookie, header));
        }
    }

    #[test]
    fn live_challenge_has_five_minute_lifetime() {
        let now = DateTime::from_timestamp(1_700_000_000, 0).unwrap();
        assert_eq!(challenge_expiry(now) - now, Duration::minutes(5));
    }

    #[test]
    fn revoked_delivery_is_terminal() {
        assert!(!delivery_authorized(false));
        assert!(delivery_authorized(true));
    }

    #[test]
    fn verification_time_comes_from_auth_facts_not_session_expiry() {
        let primary = DateTime::from_timestamp(1_700_000_000, 0).unwrap();
        let mfa = primary + Duration::seconds(64);
        let user = json!({"last_sign_in_at":primary.to_rfc3339()});
        assert_eq!(last_verified_at(&user, None).unwrap(), primary);
        assert_eq!(last_verified_at(&user, Some(mfa)).unwrap(), mfa);
        assert!(last_verified_at(&json!({}), None).is_err());
    }
}
