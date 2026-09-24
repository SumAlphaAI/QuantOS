use std::{env, net::SocketAddr};

use anyhow::{Context, ensure};
use bff_gateway::BffProvider;

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
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .with_context(|| format!("failed to bind the reference provider to {address}"))?;
    let router = if live {
        bff_gateway::live::router(
            &env::var("QUANTOS_BFF_DATABASE_URL")
                .context("live BFF requires QUANTOS_BFF_DATABASE_URL")?,
            &env::var("SUPABASE_URL").context("live BFF requires SUPABASE_URL")?,
            env::var("SUPABASE_PUBLISHABLE_KEY")
                .context("live BFF requires SUPABASE_PUBLISHABLE_KEY")?,
            env::var("QUANTOS_TERMINAL_ORIGIN")
                .context("live BFF requires QUANTOS_TERMINAL_ORIGIN")?,
        )?
    } else {
        BffProvider::default().router()
    };
    println!(
        r#"{{"service":"bff-gateway","ready":true,"mode":"{}","address":"{address}"}}"#,
        if live { "live" } else { "reference-provider" }
    );
    axum::serve(listener, router)
        .await
        .context("reference provider server failed")
}
