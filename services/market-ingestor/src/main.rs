use std::{
    fs::File,
    io::{BufReader, BufWriter},
    path::PathBuf,
};

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use quantos_core::CorrelationId;
use quantos_event::AppendOnlyLedger;
use quantos_market::{
    MarketIngestor, default_approved_providers, default_replay_spec, generate_replay_dataset,
    read_ticks_jsonl, write_ticks_jsonl,
};
use quantos_observability::service::run_observed_command;

#[derive(Debug, Parser)]
#[command(
    name = "market-ingestor",
    about = "Generate and ingest QuantOS market replay datasets"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    GenerateReplay {
        #[arg(long)]
        output: PathBuf,
        #[arg(long)]
        count: Option<usize>,
    },
    IngestReplay {
        #[arg(long)]
        input: PathBuf,
    },
}

fn main() -> std::process::ExitCode {
    run_observed_command("market-ingestor", "market.command", run)
}

fn run() -> Result<()> {
    match Cli::try_parse()
        .context("invalid market-ingestor arguments")?
        .command
    {
        Command::GenerateReplay { output, count } => generate_replay(output, count),
        Command::IngestReplay { input } => ingest_replay(input),
    }
}

fn generate_replay(output: PathBuf, count: Option<usize>) -> Result<()> {
    let mut spec = default_replay_spec().context("failed to load default market replay spec")?;
    if let Some(count) = count {
        spec.count = count;
    }

    let output_file =
        File::create(&output).with_context(|| format!("failed to create {}", output.display()))?;
    let mut writer = BufWriter::new(output_file);
    write_ticks_jsonl(&mut writer, generate_replay_dataset(&spec))
        .context("failed to write replay dataset")?;

    println!(
        "generated {} replay ticks into {}",
        spec.count,
        output.display()
    );
    Ok(())
}

fn ingest_replay(input: PathBuf) -> Result<()> {
    let input_file =
        File::open(&input).with_context(|| format!("failed to open {}", input.display()))?;
    let ticks =
        read_ticks_jsonl(BufReader::new(input_file)).context("failed to parse replay dataset")?;

    let mut ingestor = MarketIngestor::new(default_approved_providers());
    let mut ledger = AppendOnlyLedger::new();
    let summary = ingestor
        .ingest_batch(
            quantos_core::TenantId::new(),
            CorrelationId::new(),
            ticks,
            &mut ledger,
        )
        .context("failed to ingest replay dataset")?;

    println!(
        "input={} unique={} duplicates={} market_events={} anomalies={} recorded_events={}",
        summary.input_ticks,
        summary.unique_ticks,
        summary.duplicate_ticks,
        summary.market_events,
        summary.anomaly_events,
        summary.recorded_events
    );
    Ok(())
}
