use std::{env, net::SocketAddr, sync::Arc};

use anyhow::{Context, ensure};
use bff_gateway::BffProvider;
use quantos_observability::service::ServiceObservability;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let live = env::var("QUANTOS_BFF_MODE").as_deref() == Ok("live");
    let bind = env::var("QUANTOS_BFF_BIND").unwrap_or_else(|_| "127.0.0.1:4010".to_owned());
    let address: SocketAddr = bind
        .parse()
        .context("QUANTOS_BFF_BIND must be a socket address")?;
    if !live {
        ensure!(
            address.ip().is_loopback(),
            "the reference provider may only bind to a loopback address"
        );
    }
    let observer = Arc::new(if live {
        ServiceObservability::from_required_env("bff-gateway")?
    } else {
        ServiceObservability::from_env("bff-gateway")?
    });
    if let Ok(observability_address) = env::var("QUANTOS_OBSERVABILITY_ADDR") {
        observer.start_background(observability_address.parse()?)?;
    }
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .with_context(|| format!("failed to bind the reference provider to {address}"))?;
    let router = if live {
        let database_url = env::var("QUANTOS_BFF_DATABASE_URL")
            .context("live BFF requires QUANTOS_BFF_DATABASE_URL")?;
        let project_url = env::var("SUPABASE_URL").context("live BFF requires SUPABASE_URL")?;
        let publishable_key = env::var("SUPABASE_PUBLISHABLE_KEY")
            .context("live BFF requires SUPABASE_PUBLISHABLE_KEY")?;
        let terminal_origin = env::var("QUANTOS_TERMINAL_ORIGIN")
            .context("live BFF requires QUANTOS_TERMINAL_ORIGIN")?;
        let public_origin = env::var("QUANTOS_BFF_PUBLIC_ORIGIN")
            .context("live BFF requires QUANTOS_BFF_PUBLIC_ORIGIN matching the configured browser BFF origin")?;
        let environment = env::var("QUANTOS_BFF_ENVIRONMENT")
            .context("live BFF requires QUANTOS_BFF_ENVIRONMENT")?;
        let observer = observer.clone();
        tokio::task::spawn_blocking(move || {
            bff_gateway::live::router_with_download_origin(
                &database_url,
                &project_url,
                publishable_key,
                terminal_origin,
                public_origin,
                environment,
                observer,
            )
        })
        .await
        .context("live BFF initialization failed")??
    } else {
        let provider =
            if env::var("QUANTOS_BFF_REFERENCE_CONTEXT").as_deref() == Ok("assisted-local") {
                BffProvider::assisted_reference(
                    env::var("QUANTOS_BFF_OWNED_ASSISTED").as_deref() == Ok("enabled"),
                )
            } else if env::var("QUANTOS_BFF_REFERENCE_CONTEXT").as_deref() == Ok("shadow") {
                BffProvider::shadow_reference()
            } else {
                BffProvider::default()
            };
        if env::var("QUANTOS_BFF_REFERENCE_OPS_FEED").as_deref() == Ok("clear-once") {
            let feed = provider.clone();
            tokio::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(2500)).await;
                let _ = feed.renew_operations_reference().await;
            });
        }
        let public_origin = env::var("QUANTOS_BFF_PUBLIC_ORIGIN")
            .unwrap_or_else(|_| "https://bff.reference.invalid".to_owned());
        provider.with_download_origin(&public_origin)?.router()
    };
    println!(
        r#"{{"service":"bff-gateway","ready":true,"mode":"{}","address":"{address}"}}"#,
        if live { "live" } else { "reference-provider" }
    );
    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .context("reference provider server failed")
}
