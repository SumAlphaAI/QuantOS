use anyhow::{Context, Result, bail};
use chrono::{Duration, Utc};
use execution_gateway::ExecutionCommandService;
use quantos_auth::ExecutionSecretStore;
use quantos_core::{CommandId, ContentHash, DecisionId, HealthReport};
use quantos_execution::gateway::{
    ExecutionGateway, GatewayLimits, NautilusBoundaryAdapter, PaperKernel,
};
use quantos_execution::{OrderIntent, OrderSide, TradeCommand, VenueKind};
use quantos_observability::service::ServiceObservability;
use rust_decimal::Decimal;
use uuid::Uuid;

fn main() -> Result<()> {
    if std::env::args().nth(1).as_deref() == Some("--f06-paper-probe") {
        return run_f06_paper_probe();
    }
    if let Ok(url) = std::env::var("QUANTOS_EXECUTION_DATABASE_URL") {
        // Fail startup if the managed connection cannot assume the restricted
        // role. No generic DATABASE_URL fallback is allowed here.
        let _secret_store = ExecutionSecretStore::connect(&url)?;
    }
    if let Some(address) = std::env::var("QUANTOS_OBSERVABILITY_ADDR")
        .ok()
        .filter(|value| !value.trim().is_empty())
    {
        let address = address.parse()?;
        return Ok(ServiceObservability::from_env("execution-gateway")?.serve(address)?);
    }
    let report = HealthReport::ready("execution-gateway");
    println!(
        "{{\"service\":\"{}\",\"ready\":{}}}",
        report.service, report.ready
    );
    Ok(())
}

/// A local-only F06 probe that exercises the real restricted DB login,
/// command-to-account binding, Vault resolver and paper kernel in one process.
/// X03 owns the future authenticated command ingress and issuer validation.
fn run_f06_paper_probe() -> Result<()> {
    if std::env::var("QUANTOS_F06_ISOLATED_PROJECT").as_deref() != Ok("1")
        || std::env::var("QUANTOS_F06_TARGET_ISOLATED").as_deref() != Ok("1")
    {
        bail!("F06 paper probe is restricted to the confirmed isolated project");
    }
    let scenario = std::env::var("QUANTOS_F06_PROBE_SCENARIO")?;
    let database_url = std::env::var("QUANTOS_EXECUTION_DATABASE_URL")?;
    let account_id = Uuid::parse_str(&std::env::var("QUANTOS_F06_PROBE_ACCOUNT_ID")?)?;
    let session_hash = std::env::var("QUANTOS_F06_PROBE_SESSION_HASH")?;
    let secret_name = std::env::var("QUANTOS_F06_PROBE_SECRET_NAME")?;
    let store = ExecutionSecretStore::connect(&database_url)?;
    let mut service =
        ExecutionCommandService::new(build_paper_gateway("100.00"), store, secret_name);
    let now = Utc::now();
    let command = TradeCommand {
        command_id: CommandId::new(),
        decision_id: DecisionId::new(),
        account_id: if scenario == "account_mismatch" {
            Uuid::new_v4().to_string()
        } else {
            account_id.to_string()
        },
        venue: "paper-venue".to_owned(),
        venue_kind: VenueKind::Cex,
        symbol: "F06TEST".to_owned(),
        intent: OrderIntent::Limit,
        side: OrderSide::Buy,
        quantity: "1".to_owned(),
        limit_price: Some("100".to_owned()),
        stop_price: None,
        idempotency_key: "f06-isolated-probe".to_owned(),
        approval_signature: None,
        expires_at: if scenario == "expired" {
            now - Duration::seconds(1)
        } else {
            now + Duration::minutes(1)
        },
        // This is a synthetic probe command, not an X03-issued credential.
        signature: ContentHash::sha256_bytes(b"f06-isolated-paper-probe"),
        issued_at: now,
    };
    match scenario.as_str() {
        "active" => {
            let first = service.submit(&command, &session_hash, now)?;
            let replay = service.submit(&command, &session_hash, now)?;
            if first.replayed || !replay.replayed || service.downstream_submission_count() != 1 {
                bail!("F06 paper probe did not enforce one downstream submission");
            }
        }
        "account_mismatch" | "expired" | "reference_rotating" | "reference_revoked"
        | "session_revoked" => {
            let failure = service
                .submit(&command, &session_hash, now)
                .err()
                .context("F06 paper probe unexpectedly accepted a denied command")?;
            let expected = if scenario == "expired" {
                "command_expired"
            } else {
                "service session or secret reference denied"
            };
            if !failure.to_string().contains(expected) || service.downstream_submission_count() != 0
            {
                bail!("F06 paper probe accepted a denied command");
            }
        }
        _ => bail!("unrecognized F06 paper probe scenario"),
    }
    println!(
        "{{\"status\":\"PASS\",\"scenario\":\"{}\",\"downstreamSubmissions\":{}}}",
        scenario,
        service.downstream_submission_count()
    );
    Ok(())
}

/// Default kernel: the paper kernel is the documented replacement path and
/// keeps the gateway fully operational without any external process.
#[allow(dead_code)]
fn build_paper_gateway(reference_price: &str) -> ExecutionGateway<PaperKernel> {
    ExecutionGateway::new(default_limits(), PaperKernel::new(reference_price))
}

/// Optional kernel: the Nautilus boundary adapter talks to an out-of-process
/// NautilusTrader service over QuantOS-owned wire payloads; no Nautilus type
/// enters this process.
#[allow(dead_code)]
fn build_nautilus_gateway() -> ExecutionGateway<NautilusBoundaryAdapter> {
    ExecutionGateway::new(default_limits(), NautilusBoundaryAdapter::new())
}

fn default_limits() -> GatewayLimits {
    GatewayLimits {
        max_quantity: Decimal::new(1_000_000, 0),
        max_notional: Decimal::new(100_000_000, 0),
        allowed_venues: vec!["paper-venue".to_owned()],
    }
}

#[cfg(test)]
mod tests {
    use super::{build_nautilus_gateway, build_paper_gateway};

    #[test]
    fn paper_gateway_builder_is_available_for_bootstrap() {
        let gateway = build_paper_gateway("100.00");
        assert_eq!(gateway.downstream_submission_count(), 0);
    }

    #[test]
    fn nautilus_gateway_builder_is_available_for_bootstrap() {
        let gateway = build_nautilus_gateway();
        assert_eq!(gateway.downstream_submission_count(), 0);
        assert!(gateway.kernel().outbox().is_empty());
    }
}
