use anyhow::Result;
use quantos_auth::GatewayAuthMiddleware;
use quantos_core::HealthReport;

fn main() -> Result<()> {
    let report = HealthReport::ready("runtime-gateway");
    println!(
        "{} ready={}",
        report.service,
        if report.ready { "true" } else { "false" }
    );
    Ok(())
}

#[allow(dead_code)]
fn build_auth_middleware(database_url: &str) -> Result<GatewayAuthMiddleware> {
    Ok(GatewayAuthMiddleware::connect(database_url)?)
}

#[cfg(test)]
mod tests {
    use super::build_auth_middleware;

    #[test]
    fn auth_middleware_builder_is_available_for_gateway_bootstrap() {
        let result = build_auth_middleware(
            "postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable",
        );
        assert!(result.is_err());
    }
}
