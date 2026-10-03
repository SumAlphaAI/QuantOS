use anyhow::{Context, Result, bail};
use chrono::Utc;
use clap::Parser;
use quantos_core::{ActorId, CorrelationId, TenantId};
use quantos_event::{
    AppendOnlyLedger,
    pg::{PgEventStore, PgEventStoreError},
};
use quantos_market::{
    ApprovedProvider, ApprovedProviderRegistry, MAX_LINE_BYTES, MAX_REPLAY_TICKS, MarketIngestor,
    RawMarketTick, default_approved_providers, default_replay_spec,
    durable::{DurableMarketError, DurableMarketIngestor},
    generate_replay_dataset, read_ticks_jsonl, write_ticks_jsonl,
};
use quantos_observability::service::run_observed_write_command;
use std::{
    fs::File,
    io::{BufRead, BufReader, BufWriter, Read},
    path::PathBuf,
    time::Duration,
};

mod binance;
mod cli;
use cli::{Cli, Command};

fn main() -> std::process::ExitCode {
    run_observed_write_command("market-ingestor", "market.command", run)
}
fn database_url() -> Result<String> {
    std::env::var("DATABASE_URL").context("MARKET_DATABASE_CONFIG_REQUIRED")
}
fn registry(path: PathBuf, live: bool) -> Result<ApprovedProviderRegistry> {
    let file = File::open(path).context("MARKET_APPROVAL_FILE")?;
    let mut bytes = vec![];
    file.take(1_048_577).read_to_end(&mut bytes)?;
    if bytes.len() > 1_048_576 {
        bail!("MARKET_APPROVAL_FILE_LIMIT");
    }
    let providers: Vec<ApprovedProvider> =
        serde_json::from_slice(&bytes).context("MARKET_APPROVAL_SCHEMA")?;
    let approvals = ApprovedProviderRegistry::new(providers)?;
    if live {
        approvals.require_live()?;
    }
    Ok(approvals)
}
fn run(correlation: CorrelationId) -> Result<()> {
    match Cli::try_parse().context("MARKET_ARGUMENTS")?.command {
        Command::GenerateReplay { output, count } => {
            let mut spec = default_replay_spec()?;
            if let Some(count) = count {
                spec.count = count;
            }
            let ticks = generate_replay_dataset(&spec)?; // Validate before opening/truncating the output.
            let mut writer = BufWriter::new(File::create(output).context("MARKET_OUTPUT_IO")?);
            write_ticks_jsonl(&mut writer, ticks)?;
            println!("generated={} correlation_id={correlation}", spec.count);
        }
        Command::IngestReplay { input } => {
            let ticks = read_ticks_jsonl(BufReader::new(
                File::open(input).context("MARKET_INPUT_IO")?,
            ))?;
            let mut ingestor = MarketIngestor::new(default_approved_providers());
            let mut ledger = AppendOnlyLedger::new();
            let summary =
                ingestor.ingest_batch(TenantId::new(), correlation, ticks, &mut ledger)?;
            println!(
                "input={} unique={} duplicates={} market_events={} anomalies={} recorded_events={} correlation_id={correlation}",
                summary.input_ticks,
                summary.unique_ticks,
                summary.duplicate_ticks,
                summary.market_events,
                summary.anomaly_events,
                summary.recorded_events
            );
        }
        Command::IngestSource {
            input,
            approvals,
            provider,
            tenant,
            actor,
            fixture,
        } => {
            let registry = registry(approvals, !fixture)?;
            registry.approved_provider(&provider)?;
            let tenant = TenantId::parse_str(&tenant)?;
            let actor = ActorId::parse_str(&actor)?;
            let mut durable = DurableMarketIngestor::connect(&database_url()?, registry, actor)?;
            let summary = ingest_frames(
                &mut BufReader::new(File::open(input).context("MARKET_INPUT_IO")?),
                &mut durable,
                tenant,
                correlation,
                &provider,
                fixture,
            )?;
            println!(
                "accepted={} duplicates={} rejected={} fixture={} correlation_id={correlation}",
                summary.accepted, summary.duplicates, summary.rejected, fixture
            );
        }
        Command::PollSource {
            approvals,
            provider,
            tenant,
            actor,
            endpoint_env,
            iterations,
            fixture,
        } => {
            if iterations == 0 || iterations > 1000 {
                bail!("MARKET_ITERATION_LIMIT");
            }
            let approval_registry = registry(approvals.clone(), !fixture)?;
            approval_registry.approved_provider(&provider)?;
            let tenant = TenantId::parse_str(&tenant)?;
            let actor = ActorId::parse_str(&actor)?;
            let endpoint =
                std::env::var(endpoint_env).context("MARKET_ENDPOINT_CONFIG_REQUIRED")?;
            let endpoint = url::Url::parse(&endpoint).context("MARKET_ENDPOINT_INVALID")?;
            if (endpoint.scheme() != "https"
                && !(fixture
                    && endpoint.scheme() == "http"
                    && matches!(
                        endpoint.host_str(),
                        Some("127.0.0.1" | "localhost" | "[::1]")
                    )))
                || !endpoint.username().is_empty()
                || endpoint.password().is_some()
            {
                bail!("MARKET_ENDPOINT_REQUIRES_HTTPS");
            }
            let mut durable =
                DurableMarketIngestor::connect(&database_url()?, approval_registry, actor)?;
            let client = reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(2))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .context("MARKET_HTTP_INIT")?;
            for iteration in 0..iterations {
                if iteration > 0 {
                    let refreshed = registry(approvals.clone(), !fixture)?;
                    refreshed.approved_provider(&provider)?;
                    durable = DurableMarketIngestor::connect(&database_url()?, refreshed, actor)?;
                }
                match client
                    .get(endpoint.clone())
                    .send()
                    .and_then(reqwest::blocking::Response::error_for_status)
                {
                    Ok(response) => {
                        let summary = match ingest_frames(
                            &mut BufReader::new(response),
                            &mut durable,
                            tenant,
                            correlation,
                            &provider,
                            fixture,
                        ) {
                            Ok(summary) => summary,
                            Err(error) => {
                                durable.watchdog(tenant, correlation, &provider, Utc::now())?;
                                return Err(error);
                            }
                        };
                        println!(
                            "accepted={} duplicates={} rejected={} correlation_id={correlation}",
                            summary.accepted, summary.duplicates, summary.rejected
                        );
                    }
                    Err(_) => {
                        durable.watchdog(tenant, correlation, &provider, Utc::now())?;
                        bail!("MARKET_SOURCE_UNAVAILABLE");
                    }
                }
                durable.watchdog(tenant, correlation, &provider, Utc::now())?;
                std::thread::sleep(Duration::from_millis(250));
            }
        }
        Command::BinanceRest {
            approvals,
            provider,
            tenant,
            actor,
            symbol,
            from_id,
            iterations,
            limit,
            poll_ms,
            fixture,
        } => {
            binance::run(
                binance::Config {
                    approvals,
                    provider,
                    tenant: TenantId::parse_str(&tenant)?,
                    actor: ActorId::parse_str(&actor)?,
                    symbol,
                    from_id,
                    iterations,
                    limit,
                    poll_ms,
                    fixture,
                },
                correlation,
            )?;
        }
        Command::Dispatch {
            tenant,
            consumer,
            limit,
        } => {
            if !(1..=1000).contains(&limit) || consumer.trim().is_empty() {
                bail!("MARKET_DISPATCH_CONFIG");
            }
            let tenant = TenantId::parse_str(&tenant)?;
            let mut store = PgEventStore::connect_for_outbox_tenants(&database_url()?, &[tenant])?
                .with_aggregate_scope("market");
            let report = store.poll_outbox_once(
                "market-ingestor",
                &consumer,
                limit,
                Utc::now(),
                chrono::Duration::seconds(30),
                3,
                |event, _claim| {
                    // The event is the immutable market projection; F05 owns inbox/checkpoint completion.
                    if event.aggregate_type != "market" {
                        return Err("MARKET_UNEXPECTED_AGGREGATE".into());
                    }
                    Ok(())
                },
                |_event| Ok(()),
            )?;
            println!(
                "processed={} duplicate_skipped={} dead_lettered={} correlation_id={correlation}",
                report.processed, report.duplicate_skipped, report.dead_lettered
            );
        }
        Command::Requeue {
            tenant,
            actor,
            dead_letter,
        } => {
            let tenant = TenantId::parse_str(&tenant)?;
            let actor = ActorId::parse_str(&actor)?;
            let id = quantos_core::DeadLetterId::parse_str(&dead_letter)?;
            let mut store = PgEventStore::connect_for_outbox_tenants(&database_url()?, &[tenant])?
                .with_aggregate_scope("market");
            store.requeue_dead_letter(tenant, id, actor, Utc::now())?;
            println!("requeued=true correlation_id={correlation}");
        }
    }
    Ok(())
}
#[derive(Debug, Default)]
struct SourceSummary {
    accepted: usize,
    duplicates: usize,
    rejected: usize,
}
fn ingest_frames(
    mut reader: &mut dyn BufRead,
    durable: &mut DurableMarketIngestor,
    tenant: TenantId,
    correlation: CorrelationId,
    provider: &str,
    fixture: bool,
) -> Result<SourceSummary> {
    let mut summary = SourceSummary::default();
    let mut line = Vec::new();
    let mut lines = 0;
    loop {
        line.clear();
        let n = (&mut reader)
            .take((MAX_LINE_BYTES + 1) as u64)
            .read_until(b'\n', &mut line)
            .context("MARKET_SOURCE_READ")?;
        if n == 0 {
            break;
        }
        if n > MAX_LINE_BYTES || lines >= MAX_REPLAY_TICKS {
            bail!("MARKET_RESOURCE_LIMIT");
        }
        lines += 1;
        if line.iter().all(u8::is_ascii_whitespace) {
            continue;
        }
        let observed = Utc::now();
        let tick = serde_json::from_slice::<RawMarketTick>(&line);
        let tick = match tick {
            Ok(tick) if tick.provider == provider => tick,
            _ => {
                durable.reject_frame(
                    tenant,
                    correlation,
                    provider,
                    &line,
                    observed,
                    "MARKET_FRAME_SCHEMA",
                )?;
                summary.rejected += 1;
                continue;
            }
        };
        let processing = if fixture { tick.received_at } else { observed };
        match durable.ingest(tenant, correlation, tick, processing) {
            Ok(result) => {
                if result.duplicate {
                    summary.duplicates += 1;
                } else {
                    summary.accepted += 1;
                }
            }
            Err(DurableMarketError::Market(e)) => {
                durable.reject_frame(
                    tenant,
                    correlation,
                    provider,
                    &line,
                    observed,
                    e.machine_code(),
                )?;
                summary.rejected += 1;
            }
            Err(DurableMarketError::Store(PgEventStoreError::MarketSourceConflict)) => {
                durable.reject_frame(
                    tenant,
                    correlation,
                    provider,
                    &line,
                    observed,
                    "MARKET_SOURCE_CONFLICT",
                )?;
                summary.rejected += 1;
            }
            Err(error) => return Err(error).context("MARKET_COMMIT_FAILED_RETRY_SOURCE"),
        }
    }
    Ok(summary)
}
