use std::{env, net::SocketAddr};

use anyhow::{Context, ensure};
use bff_gateway::BffProvider;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let bind = env::var("QUANTOS_BFF_BIND").unwrap_or_else(|_| "127.0.0.1:4010".to_owned());
    let address: SocketAddr = bind
        .parse()
        .context("QUANTOS_BFF_BIND must be a socket address")?;
    ensure!(
        address.ip().is_loopback(),
        "the reference provider may only bind to a loopback address"
    );
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .with_context(|| format!("failed to bind the reference provider to {address}"))?;
    println!(
        r#"{{"service":"bff-gateway","ready":true,"mode":"reference-provider","address":"{address}"}}"#
    );
    axum::serve(listener, BffProvider::default().router())
        .await
        .context("reference provider server failed")
}
