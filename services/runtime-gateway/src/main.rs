use anyhow::Result;
use quantos_auth::GatewayAuthMiddleware;
use quantos_core::HealthReport;
use quantos_observability::service::ServiceObservability;
use quantos_runtime::pg::PgRuntimeStore;

fn main() -> Result<()> {
    if let Some(address) = std::env::var("QUANTOS_OBSERVABILITY_ADDR")
        .ok()
        .filter(|value| !value.trim().is_empty())
    {
        let address = address.parse()?;
        return Ok(ServiceObservability::from_env("runtime-gateway")?.serve(address)?);
    }
    let report = HealthReport::ready("runtime-gateway");
    println!(
        "{{\"service\":\"{}\",\"ready\":{}}}",
        report.service, report.ready
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

    // Invalid URLs fail before network access, even when CI has PostgreSQL on 5432.
    #[test]
    fn auth_middleware_builder_propagates_invalid_database_url() {
        let error = build_auth_middleware("not-a-database-url")
            .err()
            .expect("invalid URL must fail");
        assert!(matches!(
            error.downcast_ref::<quantos_auth::AuthError>(),
            Some(quantos_auth::AuthError::Url(_))
        ));
    }

    #[test]
    fn runtime_store_builder_propagates_invalid_database_url() {
        let error = build_runtime_store("not-a-database-url")
            .err()
            .expect("invalid URL must fail");
        assert!(matches!(
            error.downcast_ref::<quantos_runtime::pg::PgRuntimeError>(),
            Some(quantos_runtime::pg::PgRuntimeError::Url(_))
        ));
    }
}
