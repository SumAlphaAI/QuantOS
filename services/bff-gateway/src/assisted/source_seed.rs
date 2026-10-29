//! Explicit local profile: actual R04 repository/schema, S03 release/X01
//! projection and X02 keyed review; all domain/venue/identity inputs are owned.
//! No public upload route, dotenv, deployment target or live registration.
use super::*;
use quantos_execution::assisted_source::{CurrentRiskSources, CurrentSubjectSource};
use quantos_risk::guard::{RiskGuard, Side};
use quantos_runtime::signal_proposal::InMemorySignalProposalRepository;
use quantos_strategy::release::DeploymentTarget;

pub(super) fn current(
    service: &AssistedApprovalService,
    scope: &Scope,
    key: [u8; 32],
    at: DateTime<Utc>,
    expiry: DateTime<Utc>,
) -> Result<(CurrentSubjectSource, BTreeMap<ProposalId, Subject>), Error> {
    let mut f = crate::execution::reference_seed::Fixture::with_expiry_at(600, at);
    // Preserve actual public identity. Never impersonate Paper to obtain Allow.
    f.auth.mode = RunMode::AssistedLive;
    f.auth
        .capabilities
        .insert(Capability::parse(ASSISTED_CAPABILITY).map_err(|_| Error::Invalid)?);
    f.auth.user_id = *f.auth.actor_id.as_uuid();
    f.auth.account_id = Some(scope.account);
    f.financials.quote_unit = "USDT".into();
    f.financials.source_ref = "owned-current-cash-and-daily-ledger".into();
    f.venue.quote_unit = "USDT".into();
    f.venue.venue = "OWNED_TESTNET".into();
    f.policy.version = "core-x02-owned.v1".into();
    f.policy.quote_unit = "USDT".into();
    f.policy.decision_ttl_seconds = 60;
    f.policy.limits.max_notional_per_order = 50000.0;
    f.policy.limits.approval_notional_threshold = 500.0;
    f.intent.target = DeploymentTarget::Shadow; // prerequisite, never deployment permission
    let guard = RiskGuard::new(
        scope.tenant,
        scope.workspace,
        f.policy.clone(),
        "core-x02-owned-risk.v1".into(),
        key,
    )
    .map_err(|_| Error::Invalid)?;
    let source = CurrentSubjectSource::new(guard.clone(), key)?;
    service.with_current_sources(source.clone())?;
    let mut repository = InMemorySignalProposalRepository::new();
    let mut subjects = BTreeMap::new();
    for i in 0..50 {
        f.intent.command_key = format!("owned-current-r04-{i}");
        f.intent.quantity = (i + 1).to_string();
        f.intent.limit_price = "1000".into();
        f.intent.side = Side::Buy;
        let mut record = f.record();
        record.output["notional"]["value"] = json!(((i + 1) * 1000).to_string());
        record.expires_at = record.expires_at.min(expiry);
        record.output["expires_at"] = json!(record.expires_at);
        let bytes = canonical_json_bytes(&record.output).map_err(|_| Error::Invalid)?;
        record.artifact_manifest.content_hash = ContentHash::sha256_bytes(&bytes);
        record.artifact_manifest.size_bytes = bytes.len() as u64;
        let record = repository.upsert_proposal(record).clone();
        let decision = guard
            .evaluate_assisted_review(
                &f.auth,
                &f.intent,
                &f.input,
                &f.financials,
                &f.venue,
                &f.release,
                &ContentHash::sha256_bytes(
                    &canonical_json_bytes(
                        &serde_json::to_value(&record).map_err(|_| Error::Invalid)?,
                    )
                    .map_err(|_| Error::Invalid)?,
                ),
                at,
            )
            .map_err(|_| Error::Invalid)?;
        let s = source.register(
            f.auth.clone(),
            record,
            f.intent.clone(),
            decision,
            CurrentRiskSources {
                snapshot: f.input.clone(),
                financials: f.financials.clone(),
                venue: f.venue.clone(),
                release: f.release.clone(),
            },
            at,
        )?;
        service.register_subject(s.clone())?;
        subjects.insert(s.id, s);
    }
    Ok((source, subjects))
}
