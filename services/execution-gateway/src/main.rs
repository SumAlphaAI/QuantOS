use anyhow::Result;
use quantos_core::HealthReport;
use quantos_execution::gateway::{
    ExecutionGateway, GatewayLimits, NautilusBoundaryAdapter, PaperKernel,
};
use quantos_observability::service::ServiceObservability;
use rust_decimal::Decimal;

fn main() -> Result<()> {
    if let Some(address) = std::env::var("QUANTOS_OBSERVABILITY_ADDR")
        .ok()
        .filter(|value| !value.trim().is_empty())
    {
        let address = address.parse()?;
        return Ok(ServiceObservability::new("execution-gateway").serve(address)?);
    }
    let report = HealthReport::ready("execution-gateway");
    println!(
        "{{\"service\":\"{}\",\"ready\":{}}}",
        report.service, report.ready
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
