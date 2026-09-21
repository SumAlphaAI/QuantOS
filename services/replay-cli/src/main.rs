use std::{
    fs::File,
    io::{BufRead, BufReader},
    path::PathBuf,
};

use anyhow::{Context, Result, bail};
use chrono::Utc;
use clap::{Parser, Subcommand};
use quantos_core::{ActorId, CorrelationId, DeadLetterId, TenantId};
use quantos_event::{RecordedEvent, pg::PgEventStore, replay_by_correlation};
use quantos_observability::service::run_observed_command;

#[derive(Debug, Parser)]
#[command(
    name = "replay-cli",
    about = "Replay QuantOS events from PostgreSQL or JSONL fixtures"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Read one tenant's ordered correlation chain.
    Correlation {
        #[arg(long)]
        tenant_id: String,
        #[arg(long)]
        correlation_id: String,
        #[arg(long)]
        database_url: Option<String>,
        #[arg(long)]
        input: Option<PathBuf>,
    },
    /// Requeue one pending dead letter through the normal fenced consumer path.
    DeadLetterRequeue {
        #[arg(long)]
        tenant_id: String,
        #[arg(long)]
        dead_letter_id: String,
        #[arg(long)]
        actor_id: String,
        #[arg(long)]
        database_url: Option<String>,
    },
}

fn database_url(explicit: Option<String>) -> Option<String> {
    explicit
        .or_else(|| std::env::var("DATABASE_URL").ok())
        .filter(|value| !value.trim().is_empty())
}

fn parse_tenant_id(value: &str) -> Result<TenantId> {
    TenantId::parse_str(value).with_context(|| format!("invalid tenant id `{value}`"))
}

fn replay_correlation(
    tenant_id: String,
    correlation_id: String,
    explicit_url: Option<String>,
    input: Option<PathBuf>,
) -> Result<()> {
    let tenant_id = parse_tenant_id(&tenant_id)?;
    let correlation_id = CorrelationId::parse_str(&correlation_id)
        .with_context(|| format!("invalid correlation id `{correlation_id}`"))?;
    let database_url = database_url(explicit_url);

    let events = if let Some(database_url) = database_url.as_deref() {
        let mut store =
            PgEventStore::connect(database_url).context("failed to connect to PostgreSQL")?;
        store
            .events_by_correlation_id(tenant_id, correlation_id)
            .context("failed to query tenant event log by correlation id")?
    } else if let Some(input) = input.as_ref() {
        read_jsonl_events(input)?
    } else {
        bail!(
            "provide --database-url/`DATABASE_URL` for PostgreSQL replay, or --input for JSONL replay"
        );
    };

    for event in replay_by_correlation(events.iter(), tenant_id, correlation_id) {
        println!(
            "{} {} {} {} {} actor={} cause={}",
            event.occurred_at.to_rfc3339(),
            event.sequence,
            event.event_kind,
            event.aggregate_type,
            event.aggregate_id,
            event.actor_id,
            event.causation_id,
        );
    }
    Ok(())
}

fn main() -> std::process::ExitCode {
    run_observed_command("replay-cli", "event.replay", run)
}

fn run() -> Result<()> {
    let cli = Cli::try_parse().context("invalid replay-cli arguments")?;
    match cli.command {
        Command::Correlation {
            tenant_id,
            correlation_id,
            database_url,
            input,
        } => replay_correlation(tenant_id, correlation_id, database_url, input),
        Command::DeadLetterRequeue {
            tenant_id,
            dead_letter_id,
            actor_id,
            database_url: explicit_url,
        } => {
            let tenant_id = parse_tenant_id(&tenant_id)?;
            let dead_letter_id = DeadLetterId::parse_str(&dead_letter_id)
                .with_context(|| format!("invalid dead-letter id `{dead_letter_id}`"))?;
            let actor_id = ActorId::parse_str(&actor_id)
                .with_context(|| format!("invalid actor id `{actor_id}`"))?;
            let database_url = database_url(explicit_url)
                .context("--database-url or DATABASE_URL is required for dead-letter requeue")?;
            PgEventStore::connect(&database_url)
                .context("failed to connect to PostgreSQL")?
                .requeue_dead_letter(tenant_id, dead_letter_id, actor_id, Utc::now())
                .context("failed to requeue dead letter")?;
            println!("requeued dead-letter {dead_letter_id} for tenant {tenant_id}");
            Ok(())
        }
    }
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
