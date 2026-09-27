use std::{
    fs,
    path::PathBuf,
    time::{Duration, Instant},
};

use anyhow::{Context, Result};
use chrono::Utc;
use clap::Parser;
use quantos_observability::{capacity::PgCapacityMonitor, service::run_observed_command};

#[derive(Debug, Parser)]
#[command(
    name = "capacity-monitor",
    about = "Collect one restart-safe F09 capacity window and emit ADR evidence"
)]
struct Cli {
    #[arg(long)]
    database_url: Option<String>,
    #[arg(long)]
    output: Option<PathBuf>,
    #[arg(long, default_value_t = 900)]
    lookback_seconds: u64,
    #[arg(long, default_value = "global")]
    scope: String,
    #[arg(long)]
    tenant_id: Option<uuid::Uuid>,
    /// Evaluate every minute; each tick reconnects so a database outage can recover.
    #[arg(long)]
    watch: bool,
}

fn main() -> std::process::ExitCode {
    run_observed_command("capacity-monitor", "capacity.evaluate", run)
}

fn run() -> Result<()> {
    let cli = Cli::try_parse().context("invalid capacity-monitor arguments")?;
    let database_url = cli
        .database_url
        .or_else(|| std::env::var("DATABASE_URL").ok())
        .filter(|value| !value.trim().is_empty())
        .context("DATABASE_URL or --database-url is required")?;
    let output = cli
        .output
        .or_else(|| {
            std::env::var("QUANTOS_F09_EVIDENCE_PATH")
                .ok()
                .map(PathBuf::from)
        })
        .unwrap_or_else(|| PathBuf::from("artifacts/observability/f09-alerts.json"));
    if cli.watch {
        loop {
            let started = Instant::now();
            if let Err(error) = collect_once(
                &database_url,
                &output,
                cli.lookback_seconds,
                &cli.scope,
                cli.tenant_id,
            ) {
                eprintln!("F09 scheduled capacity tick failed: {error:#}");
            }
            std::thread::sleep(
                Duration::from_secs(60)
                    .saturating_sub(started.elapsed())
                    .max(Duration::from_secs(1)),
            );
        }
    }
    collect_once(
        &database_url,
        &output,
        cli.lookback_seconds,
        &cli.scope,
        cli.tenant_id,
    )
}

fn collect_once(
    database_url: &str,
    output: &PathBuf,
    lookback_seconds: u64,
    scope: &str,
    tenant_id: Option<uuid::Uuid>,
) -> Result<()> {
    // A previous PASS must never survive a failed scheduled tick as fresh ADR evidence.
    if output.exists() {
        fs::remove_file(output).with_context(|| format!("failed to clear {}", output.display()))?;
    }
    let mut monitor = PgCapacityMonitor::connect_scoped_for_tenant(database_url, scope, tenant_id)
        .context("failed to connect F09 capacity monitor to PostgreSQL")?;
    let evidence = monitor
        .evaluate_and_persist(Utc::now(), Duration::from_secs(lookback_seconds))
        .context("failed to collect or evaluate the F09 capacity window")?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }
    let payload = serde_json::to_vec_pretty(&evidence).context("failed to serialize evidence")?;
    let temporary = output.with_extension("json.tmp");
    fs::write(&temporary, payload)
        .with_context(|| format!("failed to write {}", temporary.display()))?;
    fs::rename(&temporary, output)
        .with_context(|| format!("failed to publish {}", output.display()))?;
    println!(
        "collected all F09 metric families; alerts={} evidence={}",
        evidence.alerts.len(),
        output.display()
    );
    Ok(())
}
