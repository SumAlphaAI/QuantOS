//! Declarative clap-generated command parser; business logic stays in main.rs.
use clap::{Parser, Subcommand};
use std::path::PathBuf;
#[derive(Debug, Parser)]
#[command(
    name = "market-ingestor",
    about = "Approved source ingestion into the Supabase event ledger; deterministic replay validation"
)]
pub(super) struct Cli {
    #[command(subcommand)]
    pub(super) command: Command,
}
#[derive(Debug, Subcommand)]
pub(super) enum Command {
    GenerateReplay {
        #[arg(long)]
        output: PathBuf,
        #[arg(long)]
        count: Option<usize>,
    },
    /// In-memory validation only. Use ingest-source for persistent writes.
    IngestReplay {
        #[arg(long)]
        input: PathBuf,
    },
    IngestSource {
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        approvals: PathBuf,
        #[arg(long)]
        provider: String,
        #[arg(long)]
        tenant: String,
        #[arg(long)]
        actor: String,
        /// Explicitly validate historical fixtures, never a live provider receipt.
        #[arg(long, default_value_t = false)]
        fixture: bool,
    },
    /// Approved HTTPS JSONL adapter. The endpoint must support at-least-once resend.
    PollSource {
        #[arg(long)]
        approvals: PathBuf,
        #[arg(long)]
        provider: String,
        #[arg(long)]
        tenant: String,
        #[arg(long)]
        actor: String,
        #[arg(long, default_value = "QUANTOS_MARKET_SOURCE_URL")]
        endpoint_env: String,
        #[arg(long, default_value_t = 1)]
        iterations: usize,
        #[arg(long, default_value_t = false)]
        fixture: bool,
    },
    /// Native Binance Spot REST aggregate trades, no API key. Cursor is stored in Supabase.
    BinanceRest {
        #[arg(long)]
        approvals: PathBuf,
        #[arg(long, default_value = "binance.spot.aggtrades")]
        provider: String,
        #[arg(long)]
        tenant: String,
        #[arg(long)]
        actor: String,
        #[arg(long, default_value = "BTCUSDT")]
        symbol: String,
        #[arg(long)]
        from_id: Option<i64>,
        #[arg(long, default_value_t = 10)]
        iterations: usize,
        #[arg(long, default_value_t = 1000)]
        limit: usize,
        #[arg(long, default_value_t = 1000)]
        poll_ms: u64,
        /// Loopback fixture transport is test-only, never a real provider receipt.
        #[arg(long, default_value_t = false)]
        fixture: bool,
    },
    /// Reuse F05 outbox/inbox leases, retries, dead letters and durable checkpoint.
    Dispatch {
        #[arg(long)]
        tenant: String,
        #[arg(long)]
        consumer: String,
        #[arg(long, default_value_t = 100)]
        limit: i64,
    },
    Requeue {
        #[arg(long)]
        tenant: String,
        #[arg(long)]
        actor: String,
        #[arg(long)]
        dead_letter: String,
    },
}
