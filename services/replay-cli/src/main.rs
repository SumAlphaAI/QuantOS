use std::{
    fs::File,
    io::{BufRead, BufReader},
    path::PathBuf,
};

use anyhow::{Context, Result, bail};
use clap::Parser;
use quantos_core::CorrelationId;
use quantos_event::{RecordedEvent, pg::PgEventStore, replay_by_correlation};
use quantos_observability::service::run_observed_command;

#[derive(Debug, Parser)]
#[command(
    name = "replay-cli",
    about = "Replay QuantOS events from PostgreSQL or JSONL fixtures"
)]
struct Cli {
    #[arg(long)]
    correlation_id: String,
    #[arg(long)]
    database_url: Option<String>,
    #[arg(long)]
    input: Option<PathBuf>,
}

fn main() -> std::process::ExitCode {
    run_observed_command("replay-cli", "event.replay", run)
}

fn run() -> Result<()> {
    let cli = Cli::try_parse().context("invalid replay-cli arguments")?;
    let correlation_id = CorrelationId::parse_str(&cli.correlation_id)
        .with_context(|| format!("invalid correlation id `{}`", cli.correlation_id))?;
    let database_url = cli
        .database_url
        .or_else(|| std::env::var("DATABASE_URL").ok())
        .filter(|value| !value.trim().is_empty());

    let events = if let Some(database_url) = database_url.as_deref() {
        let mut store =
            PgEventStore::connect(database_url).context("failed to connect to PostgreSQL")?;
        store
            .events_by_correlation_id(correlation_id)
            .context("failed to query event log by correlation id")?
    } else if let Some(input) = cli.input.as_ref() {
        read_jsonl_events(input)?
            .into_iter()
            .filter(|event| event.correlation_id == correlation_id)
            .collect()
    } else {
        bail!(
            "provide --database-url/`DATABASE_URL` for PostgreSQL replay, or --input for JSONL replay"
        );
    };

    for event in replay_by_correlation(events.iter(), correlation_id) {
        println!(
            "{} {} {} {} {}",
            event.occurred_at.to_rfc3339(),
            event.sequence,
            event.event_kind,
            event.aggregate_type,
            event.aggregate_id
        );
    }

    Ok(())
}

fn read_jsonl_events(input: &PathBuf) -> Result<Vec<RecordedEvent>> {
    let file = File::open(input)
        .with_context(|| format!("failed to open replay fixture {}", input.display()))?;
    let reader = BufReader::new(file);

    let mut events = Vec::new();
    for line in reader.lines() {
        let line = line.context("failed to read JSONL line")?;
        if line.trim().is_empty() {
            continue;
        }
        let event: RecordedEvent =
            serde_json::from_str(&line).context("failed to parse RecordedEvent JSON")?;
        events.push(event);
    }

    Ok(events)
}
