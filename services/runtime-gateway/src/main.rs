use anyhow::Result;
use quantos_auth::GatewayAuthMiddleware;
use quantos_core::HealthReport;
use quantos_runtime::pg::PgRuntimeStore;

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

#[allow(dead_code)]
fn build_runtime_store(database_url: &str) -> Result<PgRuntimeStore> {
    Ok(PgRuntimeStore::connect(database_url)?)
}

#[cfg(test)]
mod tests {
    use super::{build_auth_middleware, build_runtime_store};

    #[test]
    fn auth_middleware_builder_is_available_for_gateway_bootstrap() {
        let result = build_auth_middleware(
            "postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable",
        );
        assert!(result.is_err());
    }

    #[test]
    fn runtime_store_builder_is_available_for_gateway_bootstrap() {
        let result = build_runtime_store(
            "postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable",
        );
        assert!(result.is_err());
    }
}
