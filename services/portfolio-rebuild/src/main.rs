use std::{
    fs::File,
    io::{BufReader, BufWriter, Write},
    path::PathBuf,
};

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Utc};
use clap::{Parser, Subcommand};
use quantos_core::{AccountId, CorrelationId, TenantId};
use quantos_observability::service::run_observed_write_command;
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
        #[arg(long)]
        account_id: Option<uuid::Uuid>,
    },
    Rebuild {
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        golden: Option<PathBuf>,
        #[arg(long)]
        emit_golden: Option<PathBuf>,
        #[arg(long, requires = "risk_at")]
        risk_output: Option<PathBuf>,
        #[arg(long, requires = "risk_output")]
        risk_at: Option<DateTime<Utc>>,
        #[arg(long, default_value_t = 30)]
        max_age_seconds: i64,
        #[arg(long)]
        database_url: Option<String>,
        #[arg(long)]
        use_database_env: bool,
        #[arg(long)]
        tenant_id: Option<uuid::Uuid>,
        #[arg(long)]
        account_id: Option<uuid::Uuid>,
    },
}

struct RebuildTarget {
    risk_output: Option<PathBuf>,
    risk_at: Option<DateTime<Utc>>,
    max_age_seconds: i64,
    database_url: Option<String>,
    use_database_env: bool,
    tenant_id: Option<uuid::Uuid>,
    account_id: Option<uuid::Uuid>,
}

fn golden_account() -> AccountId {
    AccountId::from_uuid(uuid::Uuid::from_u128(GOLDEN_ACCOUNT))
}

fn main() -> std::process::ExitCode {
    run_observed_write_command("portfolio-rebuild", "portfolio.command", run)
}

fn run(correlation_id: CorrelationId) -> Result<()> {
    match Cli::try_parse()
        .context("invalid portfolio-rebuild arguments")?
        .command
    {
        Command::GenerateReplay {
            output,
            count,
            account_id,
        } => generate_replay(output, count, account_id, correlation_id),
        Command::Rebuild {
            input,
            golden,
            emit_golden,
            risk_output,
            risk_at,
            max_age_seconds,
            database_url,
            use_database_env,
            tenant_id,
            account_id,
        } => rebuild(
            input,
            golden,
            emit_golden,
            RebuildTarget {
                risk_output,
                risk_at,
                max_age_seconds,
                database_url,
                use_database_env,
                tenant_id,
                account_id,
            },
            correlation_id,
        ),
    }
}

fn generate_replay(
    output: PathBuf,
    count: Option<u64>,
    account_id: Option<uuid::Uuid>,
    correlation_id: CorrelationId,
) -> Result<()> {
    let count = count.unwrap_or(10_000);
    let events = generate_fill_replay(
        account_id
            .map(AccountId::from_uuid)
            .unwrap_or_else(golden_account),
        count,
        replay_start(),
    );
    let output_file =
        File::create(&output).with_context(|| format!("failed to create {}", output.display()))?;
    let mut writer = BufWriter::new(output_file);
    write_events_jsonl(&mut writer, &events).context("failed to write replay dataset")?;
    writer.flush().context("failed to flush replay dataset")?;
    println!(
        "generated {} portfolio events ({} fills + marks) into {} correlation_id={}",
        events.len(),
        count,
        output.display(),
        correlation_id
    );
    Ok(())
}

fn rebuild(
    input: PathBuf,
    golden: Option<PathBuf>,
    emit_golden: Option<PathBuf>,
    target: RebuildTarget,
    correlation_id: CorrelationId,
) -> Result<()> {
    let input_file =
        File::open(&input).with_context(|| format!("failed to open {}", input.display()))?;
    let events = read_events_jsonl(BufReader::new(input_file))
        .context("failed to parse portfolio replay dataset")?;

    if target.use_database_env && target.database_url.is_some() {
        bail!("choose either --database-url or --use-database-env");
    }
    let database_url = if target.use_database_env {
        Some(std::env::var("DATABASE_URL").context("DATABASE_URL required")?)
    } else {
        target.database_url
    };
    if database_url.is_some() && (target.tenant_id.is_none() || target.account_id.is_none()) {
        bail!("PostgreSQL persistence requires --tenant-id and --account-id");
    }
    let tenant_id = target
        .tenant_id
        .map(TenantId::from_uuid)
        .unwrap_or_default();
    let account_id = target
        .account_id
        .map(AccountId::from_uuid)
        .unwrap_or_else(golden_account);
    let projection = InMemoryPortfolioProjection::rebuild(tenant_id, replay_start(), &events)
        .context("failed to rebuild portfolio projection")?;
    let snapshot = projection
        .snapshot(account_id)
        .context("failed to build portfolio snapshot")?;

    println!(
        "rebuilt events={} positions={} realized_pnl={:.4} unrealized_pnl={:.4} exposure_gross={:.4} snapshot_hash={} correlation_id={}",
        snapshot.last_event_sequence,
        snapshot.positions.len(),
        snapshot.realized_pnl,
        snapshot.unrealized_pnl,
        snapshot.exposure_gross,
        snapshot.snapshot_hash,
        correlation_id
    );

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

    // Validate all requested products before emitting any projection/golden files.
    let risk_input = target
        .risk_at
        .map(|at| projection.risk_snapshot(account_id, at, target.max_age_seconds))
        .transpose()
        .context("failed to build fresh account-bound risk input")?;
    snapshot.validate().context("invalid rebuilt snapshot")?;
    if let Some(emit_golden) = emit_golden {
        let golden_file = File::create(&emit_golden)
            .with_context(|| format!("failed to create {}", emit_golden.display()))?;
        let mut writer = BufWriter::new(golden_file);
        serde_json::to_writer_pretty(&mut writer, &snapshot)
            .context("failed to write golden snapshot")?;
        writer.flush().context("failed to flush golden snapshot")?;
        println!(
            "wrote golden snapshot to {} correlation_id={}",
            emit_golden.display(),
            correlation_id
        );
    }

    if let (Some(output), Some(input)) = (&target.risk_output, &risk_input) {
        let file = File::create(output)
            .with_context(|| format!("failed to create {}", output.display()))?;
        let mut writer = BufWriter::new(file);
        serde_json::to_writer_pretty(&mut writer, input).context("failed to write risk input")?;
        writer.flush().context("failed to flush risk input")?;
        println!(
            "wrote risk input {} hash={}",
            output.display(),
            input.input_hash
        );
    }

    if let Some(database_url) = database_url {
        let mut store = quantos_portfolio::pg::PgPortfolioStore::connect(&database_url)
            .context("failed to connect to PostgreSQL")?;
        if let Some(input) = &risk_input {
            store
                .save_risk_snapshot(input)
                .context("failed to persist portfolio risk snapshot")?;
        } else {
            store
                .save_snapshot(&snapshot)
                .context("failed to persist portfolio snapshot")?;
        }
        println!("persisted portfolio snapshot to PostgreSQL correlation_id={correlation_id}");
    }
    Ok(())
}
