use std::{fs, path::PathBuf, time::Duration};

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
    let mut monitor = PgCapacityMonitor::connect(&database_url)
        .context("failed to connect F09 capacity monitor to PostgreSQL")?;
    let evidence = monitor
        .evaluate_and_persist(Utc::now(), Duration::from_secs(cli.lookback_seconds))
        .context("failed to collect or evaluate the F09 capacity window")?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }
    let payload = serde_json::to_vec_pretty(&evidence).context("failed to serialize evidence")?;
    let temporary = output.with_extension("json.tmp");
    fs::write(&temporary, payload)
        .with_context(|| format!("failed to write {}", temporary.display()))?;
    fs::rename(&temporary, &output)
        .with_context(|| format!("failed to publish {}", output.display()))?;
    println!(
        "collected all F09 metric families; alerts={} evidence={}",
        evidence.alerts.len(),
        output.display()
    );
    Ok(())
}
