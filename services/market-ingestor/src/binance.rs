//! Binance aggregate trades retain their own identity and aggregate quantity semantics.
use anyhow::{Context, Result, bail};
use chrono::{DateTime, Utc};
use quantos_core::{ActorId, CorrelationId, TenantId};
use quantos_market::{RawMarketTick, durable::DurableMarketIngestor};
use serde::Deserialize;
use std::{
    io::Read,
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};

pub(super) struct Config {
    pub approvals: PathBuf,
    pub provider: String,
    pub tenant: TenantId,
    pub actor: ActorId,
    pub symbol: String,
    pub from_id: Option<i64>,
    pub iterations: usize,
    pub limit: usize,
    pub poll_ms: u64,
    pub fixture: bool,
}
#[derive(Debug, Deserialize)]
struct Trade {
    a: i64,
    p: String,
    q: String,
    #[serde(rename = "T")]
    time: i64,
    f: i64,
    l: i64,
    m: bool,
}
fn decode(
    bytes: &[u8],
    provider: &str,
    symbol: &str,
    expected: Option<i64>,
    received: DateTime<Utc>,
) -> Result<Vec<RawMarketTick>> {
    let rows: Vec<Trade> = serde_json::from_slice(bytes).context("BINANCE_RESPONSE_SCHEMA")?;
    if rows.len() > 1000 {
        bail!("BINANCE_PAGE_LIMIT");
    }
    let mut next = expected;
    let mut out = Vec::with_capacity(rows.len());
    for t in rows {
        if t.a < 0 || t.f < 0 || t.l < t.f || next.is_some_and(|n| n != t.a) {
            bail!("BINANCE_SOURCE_GAP");
        }
        next = Some(t.a.checked_add(1).context("BINANCE_ID_OVERFLOW")?);
        // f/l and maker flag are validated provider metadata, not an invented single trade count.
        let _maker = t.m;
        out.push(RawMarketTick {
            provider: provider.into(),
            source_tick_id: format!("{symbol}:agg:{}", t.a),
            provider_symbol: symbol.into(),
            event_time: DateTime::from_timestamp_millis(t.time).context("BINANCE_TIMESTAMP")?,
            received_at: received,
            price: t.p,
            volume: t.q,
        });
    }
    Ok(out)
}
fn endpoint(value: &str, fixture: bool) -> Result<url::Url> {
    let u = url::Url::parse(value).context("BINANCE_ENDPOINT")?;
    let official = u.scheme() == "https"
        && u.host_str() == Some("data-api.binance.vision")
        && u.port_or_known_default() == Some(443);
    let local = fixture
        && u.scheme() == "http"
        && matches!(u.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"));
    if !(official || local)
        || !u.username().is_empty()
        || u.password().is_some()
        || u.path() != "/"
        || u.query().is_some()
        || u.fragment().is_some()
    {
        bail!("BINANCE_ENDPOINT_NOT_ALLOWED");
    }
    Ok(u)
}
struct FetchedPage {
    ticks: Vec<RawMarketTick>,
    timing: serde_json::Value,
}
struct Source {
    client: reqwest::blocking::Client,
    base: url::Url,
}
impl Source {
    fn clock_observation(&self, symbol: &str) -> Result<serde_json::Value> {
        let start = Utc::now();
        let clock = Instant::now();
        let result = self
            .client
            .get(self.base.join("api/v3/time")?)
            .send()
            .and_then(reqwest::blocking::Response::error_for_status)
            .and_then(|r| r.json::<serde_json::Value>());
        let end = Utc::now();
        let value = result.ok().and_then(|v| v["serverTime"].as_i64());
        Ok(
            serde_json::json!({"kind":"binance_clock_observation","symbol":symbol,
            "local_start_at":start,"local_end_at":end,"server_time_ms":value,"rtt_ms":clock.elapsed().as_secs_f64()*1000.0,
            "offset_lower_ms":value.map(|v|v-end.timestamp_millis()),"offset_upper_ms":value.map(|v|v-start.timestamp_millis()),
            "status":if value.is_some(){"MEASURED_RTT_BOUNDS"}else{"UNMEASURED"}}),
        )
    }

    fn fetch(&self, symbol: &str, from: Option<i64>, limit: usize) -> Result<FetchedPage> {
        let clock = Instant::now();
        let started = Utc::now();
        let mut url = self.base.join("api/v3/aggTrades")?;
        url.query_pairs_mut()
            .append_pair("symbol", symbol)
            .append_pair("limit", &limit.to_string());
        if let Some(n) = from {
            url.query_pairs_mut().append_pair("fromId", &n.to_string());
        }
        let response = self.client.get(url).send().context("BINANCE_TRANSPORT")?;
        let status = response.status();
        // Never retry bans or throttling inside this client. Supervisor/caller must honor Retry-After.
        if status.as_u16() == 429 || status.as_u16() == 418 {
            let wait = response
                .headers()
                .get("retry-after")
                .and_then(|x| x.to_str().ok())
                .and_then(retry_after)
                .map_or_else(|| "unspecified".into(), |n| n.to_string());
            bail!("BINANCE_RATE_LIMIT retry_after={}", wait);
        }
        if !status.is_success() {
            bail!("BINANCE_HTTP_STATUS {}", status.as_u16());
        }
        let received = Utc::now();
        let headers_ms = clock.elapsed().as_secs_f64() * 1000.0;
        let body_clock = Instant::now();
        let mut bytes = Vec::new();
        response
            .take(1_048_577)
            .read_to_end(&mut bytes)
            .context("BINANCE_RESPONSE_READ")?;
        if bytes.len() > 1_048_576 {
            bail!("BINANCE_RESPONSE_LIMIT");
        }
        let body_completed = Utc::now();
        let body_ms = body_clock.elapsed().as_secs_f64() * 1000.0;
        let decode_clock = Instant::now();
        let ticks = decode(&bytes, "", symbol, from, received)?;
        Ok(FetchedPage {
            ticks,
            timing: serde_json::json!({"request_started_at":started,
            "headers_received_at":received,"body_completed_at":body_completed,"decoded_at":Utc::now(),
            "headers_ms":headers_ms,"body_ms":body_ms,"decode_ms":decode_clock.elapsed().as_secs_f64()*1000.0}),
        })
    }
}
fn stop_pipe(reader: impl Read, stop: Arc<AtomicBool>) {
    let mut command = [0u8; 5];
    let _ = reader.take(5).read_exact(&mut command);
    // Owned pipe command, EOF or read failure all stop new requests; memory is bounded.
    stop.store(true, Ordering::Release);
}
pub(super) fn run(config: Config, correlation: CorrelationId) -> Result<()> {
    if !(1..=1000).contains(&config.iterations)
        || !(1..=1000).contains(&config.limit)
        || !(1000..=60_000).contains(&config.poll_ms)
        || config.from_id.is_some_and(|n| n < 0)
    {
        bail!("BINANCE_CONFIGURATION");
    }
    let approvals = super::registry(config.approvals.clone(), !config.fixture)?;
    let approved = approvals.approved_provider(&config.provider)?;
    if !approved.instruments.contains_key(&config.symbol) {
        bail!("BINANCE_SYMBOL_NOT_APPROVED");
    }
    let base = endpoint(
        &std::env::var("QUANTOS_BINANCE_REST_BASE_URL")
            .unwrap_or_else(|_| "https://data-api.binance.vision/".into()),
        config.fixture,
    )?;
    let source = Source {
        client: reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(3))
            .redirect(reqwest::redirect::Policy::none())
            .build()?,
        base,
    };
    let stop = Arc::new(AtomicBool::new(false));
    if std::env::var("QUANTOS_BINANCE_STOP_STDIN").as_deref() == Ok("1") {
        let owned_stop = stop.clone();
        std::thread::spawn(move || stop_pipe(std::io::stdin(), owned_stop));
    }
    let database = super::database_url()?;
    let mut writer = DurableMarketIngestor::connect(&database, approvals, config.actor)?;
    let existing = writer.binance_cursor(config.tenant, &config.provider, &config.symbol)?;
    if stop.load(Ordering::Acquire) {
        return Ok(());
    }
    // Initial window is explicit, or starts at the current newest aggregate trade. Never reset an existing cursor.
    let first = match (existing, config.from_id) {
        (Some(n), Some(requested)) if requested != n => bail!("BINANCE_CURSOR_ALREADY_INITIALIZED"),
        (Some(n), _) | (_, Some(n)) => n,
        (None, None) => {
            let fetched = source.fetch(&config.symbol, None, 1)?;
            let t = fetched.ticks.first().context("BINANCE_EMPTY_BOOTSTRAP")?;
            t.source_tick_id
                .rsplit(':')
                .next()
                .context("BINANCE_BOOTSTRAP")?
                .parse::<i64>()?
        }
    };
    if existing.is_none() {
        writer.ingest_binance_page(
            config.tenant,
            correlation,
            &config.provider,
            &config.symbol,
            first,
            vec![],
        )?;
    }
    // Diagnostic only; never modifies source timestamps or freshness thresholds.
    if !config.fixture && !stop.load(Ordering::Acquire) {
        println!("{}", source.clock_observation(&config.symbol)?);
    }
    let monitor_stop = stop.clone();
    // Separate connection and timer: blocked HTTP/write work cannot suppress transport alerts.
    std::thread::scope(|scope| {
        let monitor = scope.spawn(|| -> Result<()> {
            let mut watch = DurableMarketIngestor::connect(
                &database,
                super::registry(config.approvals.clone(), !config.fixture)?,
                config.actor,
            )?;
            while !monitor_stop.load(Ordering::Acquire) {
                watch
                    .refresh_approvals(super::registry(config.approvals.clone(), !config.fixture)?);
                if let Some(receipt) = watch.binance_watchdog_receipt(
                    config.tenant,
                    correlation,
                    &config.provider,
                    &config.symbol,
                    Utc::now(),
                )? {
                    println!("{receipt}");
                }
                std::thread::sleep(Duration::from_millis(250));
            }
            Ok(())
        });
        let poll = (|| -> Result<()> {
            let mut next = first;
            for iteration in 0..config.iterations {
                if stop.load(Ordering::Acquire) {
                    break;
                }
                let poll_clock = Instant::now();
                if monitor.is_finished() {
                    bail!("BINANCE_WATCHDOG_UNAVAILABLE");
                }
                // Refresh approvals on each poll; disabling the provider stops writes immediately on the next attempt.
                writer
                    .refresh_approvals(super::registry(config.approvals.clone(), !config.fixture)?);
                if stop.load(Ordering::Acquire) {
                    break;
                }
                match source.fetch(&config.symbol, Some(next), config.limit) {
                    Ok(mut fetched) => {
                        let count = fetched.ticks.len();
                        for tick in &mut fetched.ticks {
                            tick.provider = config.provider.clone();
                        }
                        let mut receipt = writer.ingest_binance_page_receipt(
                            config.tenant,
                            correlation,
                            &config.provider,
                            &config.symbol,
                            next,
                            fetched.ticks,
                        )?;
                        // Only the acknowledged durable cursor is reused; conflicts still fail closed in SQL.
                        next = receipt["next_id"]
                            .as_str()
                            .context("BINANCE_CURSOR_MISSING")?
                            .parse()?;
                        receipt["input"] = count.into();
                        receipt["transport"] = fetched.timing;
                        receipt["fixture"] = config.fixture.into();
                        receipt["correlation_id"] = correlation.to_string().into();
                        println!("{receipt}");
                        let committed = next;
                        println!(
                            "binance symbol={} input={count} next_id={committed} fixture={} correlation_id={correlation}",
                            config.symbol, config.fixture
                        );
                    }
                    Err(e) => {
                        let message = e.to_string();
                        if !exit_policy(&e).retryable {
                            return Err(e);
                        }
                        if message.starts_with("BINANCE_RATE_LIMIT") {
                            return Err(e);
                        }
                        println!(
                            "binance source_unavailable=true cursor_unchanged=true correlation_id={correlation}"
                        );
                        if stop.load(Ordering::Acquire) {
                            break;
                        }
                        if iteration + 1 == config.iterations {
                            bail!("BINANCE_SOURCE_UNAVAILABLE");
                        }
                    }
                }
                // Minimum request-start interval, not an extra delay after the acknowledged page.
                std::thread::sleep(
                    Duration::from_millis(config.poll_ms).saturating_sub(poll_clock.elapsed()),
                );
            }
            Ok(())
        })();
        stop.store(true, Ordering::Release);
        let monitoring = monitor
            .join()
            .map_err(|_| anyhow::anyhow!("BINANCE_WATCHDOG_PANIC"))?;
        poll?;
        monitoring
    })
}

fn retry_after(value: &str) -> Option<u64> {
    let value = value.trim();
    if value.is_empty() || !value.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    value.parse::<u64>().ok().filter(|n| *n <= 604_800)
}

#[derive(serde::Serialize)]
pub(super) struct ExitPolicy {
    pub code: &'static str,
    pub retryable: bool,
    pub retry_after_secs: Option<u64>,
}
pub(super) fn exit_policy(error: &anyhow::Error) -> ExitPolicy {
    let message = error.to_string();
    let rate = message.strip_prefix("BINANCE_RATE_LIMIT retry_after=");
    let wait = rate.and_then(retry_after);
    let retryable = if rate.is_some() {
        wait.is_some()
    } else {
        message.starts_with("BINANCE_TRANSPORT")
            || message.starts_with("BINANCE_SOURCE_UNAVAILABLE")
            || message.starts_with("BINANCE_HTTP_STATUS 5")
    };
    ExitPolicy {
        code: if rate.is_some() {
            "BINANCE_RATE_LIMIT"
        } else if retryable {
            "BINANCE_SOURCE_UNAVAILABLE"
        } else {
            [
                "BINANCE_RESPONSE_SCHEMA",
                "BINANCE_SOURCE_GAP",
                "BINANCE_TIMESTAMP",
                "BINANCE_RESPONSE_LIMIT",
                "BINANCE_PAGE_LIMIT",
                "BINANCE_ID_OVERFLOW",
            ]
            .into_iter()
            .find(|code| message.starts_with(code))
            .unwrap_or("BINANCE_FATAL")
        },
        retryable,
        retry_after_secs: wait,
    }
}
#[cfg(test)]
mod tests;
