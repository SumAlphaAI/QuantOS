use std::{
    fs::File,
    io::{BufReader, BufWriter},
    path::PathBuf,
};

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use quantos_core::{AccountId, TenantId};
use quantos_observability::service::run_observed_command;
use quantos_portfolio::{
    InMemoryPortfolioProjection, PortfolioSnapshot, generate_fill_replay, read_events_jsonl,
    replay_start, snapshots_approx_eq, write_events_jsonl,
};

const GOLDEN_ACCOUNT: u128 = 0x0102_0304_0506_0708_090a_0b0c_0d0e_0f10;

#[derive(Debug, Parser)]
#[command(
    name = "portfolio-rebuild",
    about = "Generate and rebuild QuantOS portfolio replay projections"
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
        count: Option<u64>,
    },
    Rebuild {
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        golden: Option<PathBuf>,
        #[arg(long)]
        emit_golden: Option<PathBuf>,
        #[arg(long)]
        database_url: Option<String>,
    },
}

fn golden_account() -> AccountId {
    AccountId::from_uuid(uuid::Uuid::from_u128(GOLDEN_ACCOUNT))
}

fn main() -> std::process::ExitCode {
    run_observed_command("portfolio-rebuild", "portfolio.command", run)
}

fn run() -> Result<()> {
    match Cli::try_parse()
        .context("invalid portfolio-rebuild arguments")?
        .command
    {
        Command::GenerateReplay { output, count } => generate_replay(output, count),
        Command::Rebuild {
            input,
            golden,
            emit_golden,
            database_url,
        } => rebuild(input, golden, emit_golden, database_url),
    }
}

fn generate_replay(output: PathBuf, count: Option<u64>) -> Result<()> {
    let count = count.unwrap_or(10_000);
    let events = generate_fill_replay(golden_account(), count, replay_start());
    let output_file =
        File::create(&output).with_context(|| format!("failed to create {}", output.display()))?;
    let mut writer = BufWriter::new(output_file);
    write_events_jsonl(&mut writer, &events).context("failed to write replay dataset")?;
    println!(
        "generated {} portfolio events ({} fills + marks) into {}",
        events.len(),
        count,
        output.display()
    );
    Ok(())
}

fn rebuild(
    input: PathBuf,
    golden: Option<PathBuf>,
    emit_golden: Option<PathBuf>,
    database_url: Option<String>,
) -> Result<()> {
    let input_file =
        File::open(&input).with_context(|| format!("failed to open {}", input.display()))?;
    let events = read_events_jsonl(BufReader::new(input_file))
        .context("failed to parse portfolio replay dataset")?;

    let tenant_id = TenantId::new();
    let projection = InMemoryPortfolioProjection::rebuild(tenant_id, replay_start(), &events)
        .context("failed to rebuild portfolio projection")?;
    let snapshot = projection
        .snapshot(golden_account())
        .context("failed to build portfolio snapshot")?;

    println!(
        "rebuilt events={} positions={} realized_pnl={:.4} unrealized_pnl={:.4} exposure_gross={:.4} snapshot_hash={}",
        snapshot.last_event_sequence,
        snapshot.positions.len(),
        snapshot.realized_pnl,
        snapshot.unrealized_pnl,
        snapshot.exposure_gross,
        snapshot.snapshot_hash
    );

    if let Some(emit_golden) = emit_golden {
        let golden_file = File::create(&emit_golden)
            .with_context(|| format!("failed to create {}", emit_golden.display()))?;
        serde_json::to_writer_pretty(BufWriter::new(golden_file), &snapshot)
            .context("failed to write golden snapshot")?;
        println!("wrote golden snapshot to {}", emit_golden.display());
    }

    if let Some(golden) = golden {
        let golden_file =
            File::open(&golden).with_context(|| format!("failed to open {}", golden.display()))?;
        let expected: PortfolioSnapshot = serde_json::from_reader(BufReader::new(golden_file))
            .context("failed to parse golden snapshot")?;
        if !snapshots_approx_eq(&snapshot, &expected) {
            bail!(
                "golden mismatch: expected hash {} but rebuilt {}",
                expected.snapshot_hash,
                snapshot.snapshot_hash
            );
        }
        println!("golden snapshot matched (hash {})", snapshot.snapshot_hash);
    }

    if let Some(database_url) = database_url {
        let mut store = quantos_portfolio::pg::PgPortfolioStore::connect(&database_url)
            .context("failed to connect to PostgreSQL")?;
        store
            .save_snapshot(&snapshot)
            .context("failed to persist portfolio snapshot")?;
        println!("persisted portfolio snapshot to PostgreSQL");
    }
    Ok(())
}
