use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_core::{
    ContentHash, CoreError, SnapshotId, StrategyDraftId, TenantId, WorkspaceId,
    canonical_json_bytes,
};
use quantos_storage::DataSnapshotRecord;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use thiserror::Error;

/// Adapter version pinned into every environment hash so engine upgrades change replays.
pub const BACKTEST_ADAPTER_VERSION: &str = "quantos-strategy.backtest.v2";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BacktestBar {
    pub index: u32,
    pub open_time: DateTime<Utc>,
    pub close_time: DateTime<Utc>,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BacktestBarSeries {
    pub symbol: String,
    pub snapshot_hash: ContentHash,
    pub bars: Vec<BacktestBar>,
    pub content_hash: ContentHash,
}

impl BacktestBarSeries {
    #[must_use]
    pub fn new(
        symbol: impl Into<String>,
        snapshot_hash: ContentHash,
        bars: Vec<BacktestBar>,
    ) -> Self {
        let symbol = symbol.into();
        let content_hash = ContentHash::sha256_bytes(
            &canonical_json_bytes(&json!({
                "symbol": symbol,
                "snapshot_hash": snapshot_hash.as_str(),
                "bars": bars,
            }))
            .expect("bar series canonicalizes"),
        );
        Self {
            symbol,
            snapshot_hash,
            bars,
            content_hash,
        }
    }

    /// Hash of stored bytes, independent of the containing Snapshot (avoids a hash cycle).
    pub fn data_hash(&self) -> Result<ContentHash, CoreError> {
        Ok(ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "symbol": self.symbol, "bars": self.bars,
        }))?))
    }

    /// Deterministic fixture series used by contract tests and replay harnesses.
    #[must_use]
    pub fn fixture(
        symbol: &str,
        snapshot_hash: ContentHash,
        bar_count: u32,
        start: DateTime<Utc>,
    ) -> Self {
        let bars = (0..bar_count)
            .map(|index| {
                let wave = ((index % 9) as f64 - 4.0) * 0.0011;
                let trend = (index as f64) * 0.0004;
                let base = 100.0 * (1.0 + trend + wave);
                let spread = 0.0006 + ((index % 5) as f64) * 0.0001;
                BacktestBar {
                    index,
                    open_time: start + ChronoDuration::minutes(i64::from(index) * 5),
                    close_time: start + ChronoDuration::minutes(i64::from(index) * 5 + 4),
                    open: base * (1.0 - spread / 2.0),
                    high: base * (1.0 + spread),
                    low: base * (1.0 - spread),
                    close: base * (1.0 + spread / 2.0),
                }
            })
            .collect();
        Self::new(symbol, snapshot_hash, bars)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct BacktestCostModel {
    pub fee_bps: u32,
    pub slippage_bps: u32,
}

impl BacktestCostModel {
    #[must_use]
    pub const fn new(fee_bps: u32, slippage_bps: u32) -> Self {
        Self {
            fee_bps,
            slippage_bps,
        }
    }

    fn fee(&self, notional: f64) -> f64 {
        notional * f64::from(self.fee_bps) / 10_000.0
    }

    fn slippage(&self, notional: f64) -> f64 {
        notional * f64::from(self.slippage_bps) / 10_000.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BacktestSide {
    Long,
    Flat,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BacktestDecision {
    pub side: BacktestSide,
    pub quantity: f64,
}

/// Decision view over the bar series. Every read is logged for look-ahead detection.
pub struct DecisionContext<'a> {
    bar_index: usize,
    bars: &'a [BacktestBar],
    accessed: &'a mut Vec<usize>,
}

impl<'a> DecisionContext<'a> {
    #[must_use]
    pub fn bar_index(&self) -> usize {
        self.bar_index
    }

    #[must_use]
    pub fn bar_at(&mut self, index: usize) -> Option<&BacktestBar> {
        self.accessed.push(index);
        self.bars.get(index)
    }

    #[must_use]
    pub fn current_bar(&mut self) -> Option<&BacktestBar> {
        let index = self.bar_index;
        self.bar_at(index)
    }
}

pub trait StrategyAdapter {
    fn adapter_name(&self) -> &'static str;
    /// Trusted native implementation identity, including all effective parameters.
    fn configuration(&self) -> Value;
    /// Restore the deterministic initial state before every replay.
    fn reset(&mut self);
    fn permits_symbol(&self, _symbol: &str) -> bool {
        true
    }
    fn max_notional(&self) -> Option<f64> {
        None
    }
    fn decide(&mut self, ctx: &mut DecisionContext<'_>) -> BacktestDecision;
}

/// Honest momentum rule: only reads bars at or before the decision index.
#[derive(Debug)]
pub struct MomentumAdapter {
    lookback: usize,
    entry_threshold_bps: i64,
    exit_threshold_bps: i64,
    position: BacktestSide,
}

impl MomentumAdapter {
    #[must_use]
    pub const fn new(lookback: usize, entry_threshold_bps: i64, exit_threshold_bps: i64) -> Self {
        Self {
            lookback,
            entry_threshold_bps,
            exit_threshold_bps,
            position: BacktestSide::Flat,
        }
    }
}

impl StrategyAdapter for MomentumAdapter {
    fn adapter_name(&self) -> &'static str {
        "momentum.v1"
    }

    fn configuration(&self) -> Value {
        json!({"rule":"momentum", "lookback":self.lookback,
            "entry_threshold_bps":self.entry_threshold_bps, "exit_threshold_bps":self.exit_threshold_bps})
    }

    fn reset(&mut self) {
        self.position = BacktestSide::Flat;
    }

    fn decide(&mut self, ctx: &mut DecisionContext<'_>) -> BacktestDecision {
        let index = ctx.bar_index();
        let lookback = self.lookback.min(index);
        let (current_close, past_close) = {
            let Some(current) = ctx.current_bar() else {
                return BacktestDecision {
                    side: self.position,
                    quantity: 0.0,
                };
            };
            let current_close = current.close;
            let Some(past) = ctx.bar_at(index - lookback) else {
                return BacktestDecision {
                    side: self.position,
                    quantity: 0.0,
                };
            };
            (current_close, past.close)
        };
        let return_bps = ((current_close / past_close) - 1.0) * 10_000.0;
        let decision = match (self.position, return_bps) {
            (BacktestSide::Flat, value) if value >= self.entry_threshold_bps as f64 => {
                BacktestSide::Long
            }
            (BacktestSide::Long, value) if value <= self.exit_threshold_bps as f64 => {
                BacktestSide::Flat
            }
            (position, _) => position,
        };
        self.position = decision;
        BacktestDecision {
            side: decision,
            quantity: 1.0,
        }
    }
}

/// Supplied by the trusted host; these are replay provenance, never release authority.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BacktestCandidate {
    pub source_commit: String,
    pub image_digest: ContentHash,
    pub runtime_digest: ContentHash,
    pub clock: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BacktestDraftBinding {
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub draft_id: StrategyDraftId,
    pub version: u64,
    pub version_hash: ContentHash,
    pub parameter_hash: ContentHash,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BacktestRequest {
    pub snapshot: DataSnapshotRecord,
    pub series: BacktestBarSeries,
    pub cost_model: BacktestCostModel,
    pub warmup_bars: usize,
    pub candidate: BacktestCandidate,
    /// Set only by the authenticated S01 service for persisted draft consumption.
    pub draft: Option<BacktestDraftBinding>,
}

impl BacktestRequest {
    fn input_hash(&self, adapter: &dyn StrategyAdapter) -> Result<ContentHash, CoreError> {
        Ok(ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "adapter": adapter.adapter_name(), "parameters": adapter.configuration(),
            "snapshot_id": self.snapshot.snapshot_id, "tenant_id": self.snapshot.tenant_id,
            "snapshot_hash": self.snapshot.content_hash, "series_hash": self.series.content_hash,
            "cost_model": self.cost_model, "warmup_bars": self.warmup_bars,
            "candidate": self.candidate, "draft": self.draft,
        }))?))
    }

    fn environment_hash(&self, adapter: &dyn StrategyAdapter) -> Result<ContentHash, CoreError> {
        Ok(ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "adapter_version": BACKTEST_ADAPTER_VERSION, "adapter": adapter.adapter_name(),
            "candidate": self.candidate, "fill_policy": "signal-close/next-open;terminal-mark-close",
            "initial_cash": 100_000.0, "cost_model": self.cost_model,
        }))?))
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BacktestFill {
    pub signal_bar: u32,
    pub execution_bar: u32,
    pub side: BacktestSide,
    pub quantity: f64,
    pub reference_price: f64,
    pub fill_price: f64,
    pub fee: f64,
    pub slippage: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BacktestCosts {
    pub fees_total: f64,
    pub slippage_total: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BacktestMetrics {
    pub total_return: f64,
    pub max_drawdown: f64,
    pub sharpe: f64,
    pub trade_count: u32,
    pub gross_pnl: f64,
    pub net_pnl: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LeakCheckSummary {
    pub decisions: u32,
    pub violations: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BacktestValidationReport {
    pub snapshot_id: SnapshotId,
    pub adapter: String,
    pub candidate: BacktestCandidate,
    pub draft: Option<BacktestDraftBinding>,
    pub parameter_hash: ContentHash,
    pub fills: Vec<BacktestFill>,
    pub input_hash: ContentHash,
    pub environment_hash: ContentHash,
    pub costs: BacktestCosts,
    pub metrics: BacktestMetrics,
    pub leak_check: LeakCheckSummary,
    pub generated_at: DateTime<Utc>,
    pub report_hash: ContentHash,
}

#[derive(Debug, Error)]
pub enum BacktestError {
    #[error("BACKTEST_INVALID_INPUT: {0}")]
    InvalidInput(String),
    #[error("BACKTEST_INVALID_DECISION: quantity/cash/risk or arithmetic is invalid")]
    InvalidDecision,

    #[error(transparent)]
    Core(#[from] CoreError),
    #[error("BACKTEST_SERIES_EMPTY: bar series must contain at least two bars")]
    SeriesEmpty,
    #[error("BACKTEST_INPUT_BINDING_MISMATCH: series is not bound to snapshot `{snapshot_hash}`")]
    InputBindingMismatch { snapshot_hash: String },
    #[error(
        "BACKTEST_DATA_LEAKAGE: snapshot captured at {captured_at} is newer than the pinned replay clock {replay_clock}"
    )]
    DataLeakage {
        captured_at: DateTime<Utc>,
        replay_clock: DateTime<Utc>,
    },
    #[error(
        "BACKTEST_LOOK_AHEAD: decision at bar {bar_index} accessed future bar {accessed_index}"
    )]
    LookAhead {
        bar_index: usize,
        accessed_index: usize,
    },
}

pub fn run_backtest(
    request: &BacktestRequest,
    adapter: &mut dyn StrategyAdapter,
) -> Result<BacktestValidationReport, BacktestError> {
    if request.series.bars.len() < 2 {
        return Err(BacktestError::SeriesEmpty);
    }
    let invalid = |message: &str| BacktestError::InvalidInput(message.to_owned());
    request
        .snapshot
        .validate_integrity()
        .map_err(|_| invalid("snapshot integrity"))?;
    let parameter_hash =
        ContentHash::sha256_bytes(&canonical_json_bytes(&adapter.configuration())?);
    if request.series.snapshot_hash != request.snapshot.content_hash {
        return Err(BacktestError::InputBindingMismatch {
            snapshot_hash: request.snapshot.content_hash.to_string(),
        });
    }
    if request.candidate.source_commit.len() != 40
        || !request
            .candidate
            .source_commit
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err(invalid("full candidate source SHA required"));
    }
    if request.warmup_bars >= request.series.bars.len() - 1
        || request.cost_model.fee_bps > 10_000
        || request.cost_model.slippage_bps >= 10_000
    {
        return Err(invalid("warmup or cost model bounds"));
    }
    if request.snapshot.captured_at > request.candidate.clock {
        return Err(BacktestError::DataLeakage {
            captured_at: request.snapshot.captured_at,
            replay_clock: request.candidate.clock,
        });
    }
    if request.snapshot.expires_at < request.candidate.clock
        || request.snapshot.quality != quantos_storage::SnapshotQuality::Passed
        || !request.snapshot.quality_findings.is_empty()
    {
        return Err(invalid("expired or unapproved snapshot"));
    }
    if !request.snapshot.symbols.contains(&request.series.symbol)
        || !adapter.permits_symbol(&request.series.symbol)
    {
        return Err(invalid("symbol outside snapshot or strategy universe"));
    }
    if let Some(draft) = &request.draft
        && (draft.tenant_id != request.snapshot.tenant_id
            || draft.version == 0
            || draft.parameter_hash != parameter_hash)
    {
        return Err(invalid("draft parameter or tenant binding"));
    }
    for (i, bar) in request.series.bars.iter().enumerate() {
        if bar.index as usize != i
            || bar.open_time >= bar.close_time
            || (i > 0 && request.series.bars[i - 1].close_time >= bar.open_time)
            || bar.open_time < request.snapshot.window.start_at
            || bar.close_time > request.snapshot.window.end_at
            || bar.close_time > request.candidate.clock
            || ![bar.open, bar.high, bar.low, bar.close]
                .into_iter()
                .all(|p| p.is_finite() && p > 0.0)
            || bar.low > bar.open.min(bar.close)
            || bar.high < bar.open.max(bar.close)
            || bar.low > bar.high
        {
            return Err(invalid(
                "bar chronology, availability, OHLC or numeric bounds",
            ));
        }
    }
    let rebuilt = BacktestBarSeries::new(
        &request.series.symbol,
        request.series.snapshot_hash.clone(),
        request.series.bars.clone(),
    );
    if rebuilt.content_hash != request.series.content_hash
        || !request
            .snapshot
            .artifact_refs
            .iter()
            .any(|r| Some(&r.content_hash) == request.series.data_hash().ok().as_ref())
    {
        return Err(invalid("series bytes are not bound to snapshot Artifact"));
    }
    if adapter
        .max_notional()
        .is_some_and(|limit| !limit.is_finite() || limit <= 0.0)
    {
        return Err(invalid("strategy risk limit"));
    }
    adapter.reset();
    let warmup = request.warmup_bars;
    let mut cash = 100_000.0_f64;
    let initial_cash = cash;
    let mut position_qty = 0.0_f64;
    let mut trade_count = 0_u32;
    let mut fees_total = 0.0_f64;
    let mut slippage_total = 0.0_f64;

    let mut equity_curve = Vec::with_capacity(request.series.bars.len() - warmup);
    let mut fills = Vec::new();
    let mut pending: Option<(u32, BacktestDecision)> = None;

    for bar_index in warmup..request.series.bars.len() {
        let bar = &request.series.bars[bar_index];
        let mut accessed = Vec::new();
        let decision = {
            let mut ctx = DecisionContext {
                bar_index,
                bars: &request.series.bars,
                accessed: &mut accessed,
            };
            adapter.decide(&mut ctx)
        };
        if let Some(future) = accessed
            .iter()
            .copied()
            .filter(|index| *index > bar_index)
            .max()
        {
            return Err(BacktestError::LookAhead {
                bar_index,
                accessed_index: future,
            });
        }

        if !decision.quantity.is_finite() || decision.quantity < 0.0 {
            return Err(BacktestError::InvalidDecision);
        }
        // A close-based signal can only fill at the next bar's open. The last signal expires.
        if let Some((signal_bar, prior)) = pending.take() {
            let buying = prior.side == BacktestSide::Long && position_qty == 0.0;
            let selling = prior.side == BacktestSide::Flat && position_qty > 0.0;
            if buying || selling {
                let direction = if buying { 1.0 } else { -1.0 };
                let fill_price = bar.open
                    * (1.0 + direction * f64::from(request.cost_model.slippage_bps) / 10_000.0);
                let quantity = if buying {
                    prior
                        .quantity
                        .min(adapter.max_notional().unwrap_or(f64::MAX) / fill_price)
                } else {
                    position_qty
                };
                if quantity <= 0.0 {
                    return Err(BacktestError::InvalidDecision);
                }
                let notional = fill_price * quantity;
                let fee = request.cost_model.fee(notional);
                let slippage = request.cost_model.slippage(bar.open * quantity);
                if ![notional, fee, slippage].into_iter().all(f64::is_finite)
                    || (buying && notional + fee >= cash)
                {
                    return Err(BacktestError::InvalidDecision);
                }
                cash += if buying {
                    -notional - fee
                } else {
                    notional - fee
                };
                position_qty = if buying { quantity } else { 0.0 };
                fees_total += fee;
                slippage_total += slippage;
                trade_count += 1;
                fills.push(BacktestFill {
                    signal_bar,
                    execution_bar: bar.index,
                    side: prior.side,
                    quantity,
                    reference_price: bar.open,
                    fill_price,
                    fee,
                    slippage,
                });
            }
        }
        pending = Some((bar.index, decision));
        let equity = cash + position_qty * bar.close;
        if !equity.is_finite() || equity <= 0.0 {
            return Err(BacktestError::InvalidDecision);
        }
        equity_curve.push(equity);
    }

    let final_equity = *equity_curve.last().unwrap_or(&initial_cash);
    let total_return = final_equity / initial_cash - 1.0;
    let mut peak = initial_cash;
    let mut max_drawdown = 0.0_f64;
    for equity in &equity_curve {
        peak = peak.max(*equity);
        max_drawdown = max_drawdown.max((peak - equity) / peak);
    }
    let returns: Vec<f64> = equity_curve
        .windows(2)
        .map(|window| window[1] / window[0] - 1.0)
        .collect();
    let mean_return = returns.iter().sum::<f64>() / returns.len().max(1) as f64;
    let variance = returns
        .iter()
        .map(|value| (value - mean_return).powi(2))
        .sum::<f64>()
        / returns.len().max(1) as f64;
    if !mean_return.is_finite() || !variance.is_finite() || returns.iter().any(|r| !r.is_finite()) {
        return Err(BacktestError::InvalidDecision);
    }
    let sharpe = if variance > 0.0 {
        mean_return / variance.sqrt() * (returns.len() as f64).sqrt()
    } else {
        0.0
    };
    let net_pnl = final_equity - initial_cash;
    if ![
        total_return,
        max_drawdown,
        sharpe,
        net_pnl,
        fees_total,
        slippage_total,
        net_pnl + fees_total + slippage_total,
    ]
    .into_iter()
    .all(f64::is_finite)
    {
        return Err(BacktestError::InvalidDecision);
    }

    let metrics = BacktestMetrics {
        total_return,
        max_drawdown,
        sharpe,
        trade_count,
        gross_pnl: net_pnl + fees_total + slippage_total,
        net_pnl,
    };
    let costs = BacktestCosts {
        fees_total,
        slippage_total,
    };
    let adapter_name = adapter.adapter_name();
    let mut report = BacktestValidationReport {
        snapshot_id: request.snapshot.snapshot_id,
        adapter: adapter_name.to_owned(),
        candidate: request.candidate.clone(),
        draft: request.draft.clone(),
        parameter_hash,
        fills,
        input_hash: request.input_hash(adapter)?,
        environment_hash: request.environment_hash(adapter)?,
        costs,
        metrics,
        leak_check: LeakCheckSummary {
            decisions: (request.series.bars.len() - warmup) as u32,
            violations: 0,
        },
        generated_at: request.candidate.clock,
        report_hash: ContentHash::sha256_bytes(b"pending"),
    };
    report.report_hash = report.payload_hash()?;
    Ok(report)
}

impl BacktestValidationReport {
    fn payload_hash(&self) -> Result<ContentHash, CoreError> {
        let mut payload = serde_json::to_value(self).expect("finite validation report");
        payload
            .as_object_mut()
            .expect("report object")
            .remove("report_hash");
        Ok(ContentHash::sha256_bytes(&canonical_json_bytes(&payload)?))
    }
    pub fn verify_integrity(&self) -> Result<(), BacktestError> {
        if self.payload_hash()? != self.report_hash {
            return Err(BacktestError::InvalidInput("report digest".to_owned()));
        }
        Ok(())
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_core::{ArtifactId, SchemaVersion, TenantId};
    use quantos_storage::{
        DataSnapshotInput, DataSnapshotRecord, SnapshotArtifactRef, SnapshotLineageEntry,
        SnapshotQuality, SnapshotSourceRef, SnapshotWindow,
    };
    use serde_json::{Value, json};

    use super::*;

    fn series_start() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
    }

    fn honest_snapshot(captured_at: DateTime<Utc>) -> DataSnapshotRecord {
        DataSnapshotRecord::new(
            TenantId::new(),
            DataSnapshotInput {
                schema_name: "DataSnapshot".to_owned(),
                schema_version: SchemaVersion::parse("v1").expect("schema version parses"),
                schema_entry_id: None,
                window: SnapshotWindow {
                    start_at: series_start(),
                    end_at: series_start() + ChronoDuration::minutes(239),
                },
                sources: vec![SnapshotSourceRef {
                    source_id: "approved.binance.spot:BTCUSDT".to_owned(),
                    provider: "approved.binance.spot".to_owned(),
                    dataset: "crypto.bars.v1".to_owned(),
                    license_label: "internal-approved".to_owned(),
                }],
                quality: SnapshotQuality::Passed,
                quality_findings: vec![],
                license_label: "internal-approved".to_owned(),
                captured_at,
                max_age_secs: 86_400,
                symbols: vec!["BTCUSDT".to_owned()],
                artifact_refs: vec![SnapshotArtifactRef {
                    artifact_id: ArtifactId::new(),
                    media_type: "application/json".to_owned(),
                    content_hash: BacktestBarSeries::fixture(
                        "BTCUSDT",
                        ContentHash::sha256_bytes(b"unbound"),
                        48,
                        series_start(),
                    )
                    .data_hash()
                    .unwrap(),
                    storage_bucket: "quantos-artifacts".to_owned(),
                    object_key: "tenant/example/snapshots/bars".to_owned(),
                }],
                lineage: vec![SnapshotLineageEntry {
                    lineage_kind: "market_event_range".to_owned(),
                    reference: "market:BTCUSDT".to_owned(),
                    details: json!({ "from_sequence": 1, "to_sequence": 48 }),
                }],
            },
            captured_at,
        )
        .expect("snapshot builds")
    }

    pub(crate) fn honest_request() -> BacktestRequest {
        let snapshot = honest_snapshot(series_start() + ChronoDuration::hours(4));
        let series = BacktestBarSeries::fixture(
            "BTCUSDT",
            snapshot.content_hash.clone(),
            48,
            series_start(),
        );
        BacktestRequest {
            snapshot,
            series,
            cost_model: BacktestCostModel::new(8, 12),
            warmup_bars: 8,
            candidate: BacktestCandidate {
                source_commit: "a".repeat(40),
                image_digest: ContentHash::sha256_bytes(b"fixture-image"),
                runtime_digest: ContentHash::sha256_bytes(b"fixture-runtime"),
                clock: series_start() + ChronoDuration::hours(4),
            },
            draft: None,
        }
    }

    struct LookAheadProbe {
        future_offset: usize,
        position: BacktestSide,
    }

    impl StrategyAdapter for LookAheadProbe {
        fn adapter_name(&self) -> &'static str {
            "leak-probe.v1"
        }

        fn configuration(&self) -> Value {
            json!({"future_offset":self.future_offset})
        }
        fn reset(&mut self) {
            self.position = BacktestSide::Flat;
        }
        fn decide(&mut self, ctx: &mut DecisionContext<'_>) -> BacktestDecision {
            let index = ctx.bar_index();
            let _ = ctx.bar_at(index + self.future_offset);
            let _ = ctx.current_bar();
            let side = match self.position {
                BacktestSide::Flat => BacktestSide::Long,
                BacktestSide::Long => BacktestSide::Flat,
            };
            self.position = side;
            BacktestDecision {
                side,
                quantity: 1.0,
            }
        }
    }

    #[test]
    fn ten_replays_produce_identical_metrics_and_hashes() {
        let request = honest_request();
        let reports: Vec<BacktestValidationReport> = (0..10)
            .map(|_| {
                let mut adapter = MomentumAdapter::new(6, 20, -10);
                run_backtest(&request, &mut adapter).expect("backtest succeeds")
            })
            .collect();

        let baseline = &reports[0];
        let mut reused = MomentumAdapter::new(6, 20, -10);
        for _ in 0..10 {
            assert_eq!(&run_backtest(&request, &mut reused).unwrap(), baseline);
        }
        for report in &reports {
            assert_eq!(report.report_hash, baseline.report_hash);
            assert_eq!(report.metrics, baseline.metrics);
            assert_eq!(report.costs, baseline.costs);
            assert_eq!(report.input_hash, baseline.input_hash);
            assert_eq!(report.environment_hash, baseline.environment_hash);
        }
    }

    #[test]
    fn validation_report_contains_costs_environment_and_input_hash() {
        let request = honest_request();
        let mut adapter = MomentumAdapter::new(6, 20, -10);
        let report = run_backtest(&request, &mut adapter).expect("backtest succeeds");

        assert!(!report.input_hash.as_str().is_empty());
        assert!(!report.environment_hash.as_str().is_empty());
        assert!(report.costs.fees_total > 0.0);
        assert!(report.costs.slippage_total > 0.0);
        assert!(report.metrics.trade_count > 0);
        assert_eq!(report.leak_check.violations, 0);
        assert_eq!(report.generated_at, request.candidate.clock);
    }

    #[test]
    fn hundred_lookahead_and_leakage_fixtures_all_fail() {
        let mut rejected = 0_u32;

        for future_offset in 1..=50_usize {
            let request = honest_request();
            let mut probe = LookAheadProbe {
                future_offset,
                position: BacktestSide::Flat,
            };
            let error =
                run_backtest(&request, &mut probe).expect_err("look-ahead probe must be rejected");
            assert!(matches!(error, BacktestError::LookAhead { .. }));
            rejected += 1;
        }

        for minutes_late in 1..=50_i64 {
            let request = honest_request();
            let first_decision_at = request.candidate.clock;
            let leaky_snapshot =
                honest_snapshot(first_decision_at + ChronoDuration::minutes(minutes_late));
            let leaky_series = BacktestBarSeries::fixture(
                "BTCUSDT",
                leaky_snapshot.content_hash.clone(),
                48,
                series_start(),
            );
            let leaky_request = BacktestRequest {
                snapshot: leaky_snapshot,
                series: leaky_series,
                ..request
            };
            let mut adapter = MomentumAdapter::new(6, 20, -10);
            let error = run_backtest(&leaky_request, &mut adapter)
                .expect_err("leaky snapshot must be rejected");
            assert!(matches!(error, BacktestError::DataLeakage { .. }));
            rejected += 1;
        }

        assert_eq!(rejected, 100);
    }

    #[test]
    fn series_not_bound_to_snapshot_is_rejected() {
        let request = honest_request();
        let foreign_series = BacktestBarSeries::fixture(
            "BTCUSDT",
            ContentHash::sha256_bytes(br#"{"snapshot":"foreign"}"#),
            48,
            series_start(),
        );
        let mismatched = BacktestRequest {
            series: foreign_series,
            ..request
        };
        let mut adapter = MomentumAdapter::new(6, 20, -10);
        let error =
            run_backtest(&mismatched, &mut adapter).expect_err("unbound series must be rejected");
        assert!(matches!(error, BacktestError::InputBindingMismatch { .. }));
    }
    struct Scripted {
        step: usize,
        close: bool,
        quantity: f64,
    }
    impl StrategyAdapter for Scripted {
        fn adapter_name(&self) -> &'static str {
            "s02.scripted.fixture"
        }
        fn configuration(&self) -> Value {
            json!({"quantity":self.quantity,"close":self.close})
        }
        fn reset(&mut self) {
            self.step = 0;
        }
        fn decide(&mut self, _: &mut DecisionContext<'_>) -> BacktestDecision {
            let side = if self.step == 0 || !self.close {
                BacktestSide::Long
            } else {
                BacktestSide::Flat
            };
            self.step += 1;
            BacktestDecision {
                side,
                quantity: self.quantity,
            }
        }
    }
    fn near(a: f64, b: f64) {
        assert!((a - b).abs() < 1e-8, "{a} != {b}");
    }

    #[test]
    fn s02_analytic_roundtrip_costs_and_terminal_mark_reconcile() {
        let request = honest_request();
        for close in [true, false] {
            let mut adapter = Scripted {
                step: 0,
                close,
                quantity: 2.0,
            };
            let r = run_backtest(&request, &mut adapter).unwrap();
            let buy = request.series.bars[9].open;
            let sell = if close {
                request.series.bars[10].open
            } else {
                request.series.bars.last().unwrap().close
            };
            let slip = (buy + if close { sell } else { 0.0 }) * 2.0 * 0.0012;
            let fees = (buy * 1.0012 + if close { sell * 0.9988 } else { 0.0 }) * 2.0 * 0.0008;
            near(r.metrics.gross_pnl, (sell - buy) * 2.0);
            near(r.metrics.net_pnl, (sell - buy) * 2.0 - slip - fees);
            near(r.costs.fees_total, fees);
            near(r.costs.slippage_total, slip);
            assert_eq!(r.metrics.trade_count, if close { 2 } else { 1 });
            assert_eq!(r.fills[0].signal_bar, 8);
            assert_eq!(r.fills[0].execution_bar, 9);
            assert!(r.fills.iter().all(|f| f.execution_bar == f.signal_bar + 1));
            r.verify_integrity().unwrap();
        }
        let mut zero = request.clone();
        zero.cost_model = BacktestCostModel::new(0, 0);
        let free = run_backtest(
            &zero,
            &mut Scripted {
                step: 0,
                close: true,
                quantity: 2.0,
            },
        )
        .unwrap();
        near(free.metrics.net_pnl, free.metrics.gross_pnl);
        assert_eq!(free.costs.fees_total, 0.0);
    }

    #[test]
    fn s02_candidate_parameters_clock_and_report_bytes_are_bound() {
        let request = honest_request();
        let baseline = run_backtest(&request, &mut MomentumAdapter::new(6, 20, -10)).unwrap();
        for kind in 0..7 {
            let mut r = request.clone();
            match kind {
                0 => r.candidate.source_commit = "b".repeat(40),
                1 => r.candidate.image_digest = ContentHash::sha256_bytes(b"other-image"),
                2 => r.candidate.runtime_digest = ContentHash::sha256_bytes(b"other-runtime"),
                3 => r.candidate.clock += ChronoDuration::seconds(1),
                4 => r.cost_model.fee_bps += 1,
                5 => r.warmup_bars += 1,
                _ => (),
            }
            let other = run_backtest(
                &r,
                &mut MomentumAdapter::new(if kind == 6 { 7 } else { 6 }, 20, -10),
            )
            .unwrap();
            assert_ne!(baseline.input_hash, other.input_hash);
            assert_ne!(baseline.report_hash, other.report_hash);
            if kind < 4 {
                assert_ne!(baseline.environment_hash, other.environment_hash);
            }
        }
        for field in [
            "input_hash",
            "environment_hash",
            "parameter_hash",
            "report_hash",
        ] {
            let mut value = serde_json::to_value(&baseline).unwrap();
            value[field] = json!(ContentHash::sha256_bytes(b"tampered"));
            let forged: BacktestValidationReport = serde_json::from_value(value).unwrap();
            assert!(forged.verify_integrity().is_err());
        }
        let mut forged = baseline.clone();
        forged.leak_check.violations = 1;
        assert!(forged.verify_integrity().is_err());
        forged = baseline.clone();
        forged.fills[0].fee += 1.0;
        assert!(forged.verify_integrity().is_err());
        let decoded: BacktestValidationReport =
            serde_json::from_slice(&serde_json::to_vec(&baseline).unwrap()).unwrap();
        decoded.verify_integrity().unwrap();
        assert_eq!(decoded, baseline);
    }

    #[test]
    fn s02_hundred_malformed_inputs_fail_and_valid_retry_recovers() {
        for i in 0..100 {
            let mut r = honest_request();
            match i % 20 {
                0 => r.series.bars[0].close = f64::NAN,
                1 => r.series.bars[0].open = f64::INFINITY,
                2 => r.series.bars[0].low = 0.0,
                3 => r.series.bars[0].high = 0.1,
                4 => r.series.bars[1].index = 0,
                5 => r.series.bars[1].open_time = r.series.bars[0].close_time,
                6 => r.series.bars[0].close_time = r.series.bars[0].open_time,
                7 => r.series.content_hash = ContentHash::sha256_bytes(b"forged"),
                8 => r.series.symbol = "ETHUSDT".to_owned(),
                9 => r.warmup_bars = r.series.bars.len(),
                10 => r.cost_model.slippage_bps = 10000,
                11 => r.cost_model.fee_bps = 10001,
                12 => r.candidate.source_commit = "short".to_owned(),
                13 => r.candidate.clock = r.snapshot.expires_at + ChronoDuration::seconds(1),
                14 => r.series.bars[0].open_time -= ChronoDuration::seconds(1),
                15 => r.series.bars.last_mut().unwrap().close_time += ChronoDuration::minutes(2),
                16 => r.series.bars[2].close += 0.001, // valid prices, stale hash
                17 => {
                    r.series.bars[2].close += 0.001;
                    r.series = BacktestBarSeries::new(
                        "BTCUSDT",
                        r.snapshot.content_hash.clone(),
                        r.series.bars,
                    );
                } // rehashed but wrong stored Artifact
                18 => r.candidate.source_commit = "G".repeat(40),
                _ => r.series.bars[0].open = -1.0,
            }
            assert!(
                run_backtest(&r, &mut MomentumAdapter::new(6, 20, -10)).is_err(),
                "case {i}"
            );
        }
        for quantity in [f64::NAN, f64::INFINITY, -1.0, 0.0, 1e300] {
            assert!(matches!(
                run_backtest(
                    &honest_request(),
                    &mut Scripted {
                        step: 0,
                        close: true,
                        quantity
                    }
                ),
                Err(BacktestError::InvalidDecision)
            ));
        }
        // Finite prices can still overflow the variance of returns. They must not
        // silently produce a zero Sharpe or a seemingly valid report.
        for price in [1e200, 1e300] {
            let mut r = honest_request();
            for i in [12, 13] {
                let bar = &mut r.series.bars[i];
                bar.open = price;
                bar.high = price;
                bar.low = price;
                bar.close = price;
            }
            let mut input = r.snapshot.input();
            input.artifact_refs[0].content_hash = r.series.data_hash().unwrap();
            r.snapshot =
                DataSnapshotRecord::new(r.snapshot.tenant_id, input, r.snapshot.created_at)
                    .unwrap();
            r.series =
                BacktestBarSeries::new("BTCUSDT", r.snapshot.content_hash.clone(), r.series.bars);
            assert!(
                matches!(
                    run_backtest(
                        &r,
                        &mut Scripted {
                            step: 0,
                            close: false,
                            quantity: 1.0
                        }
                    ),
                    Err(BacktestError::InvalidDecision)
                ),
                "finite-price statistics overflow must fail closed"
            );
        }
        assert!(run_backtest(&honest_request(), &mut MomentumAdapter::new(6, 20, -10)).is_ok());
    }

    #[test]
    fn s02_owned_process_s01_artifact_to_ten_replays_reject_and_recover() {
        use crate::{DraftArtifactRef, DraftSaveKind, DraftVersionInput, drafts::DraftService};
        use quantos_auth::AuthContext;
        use quantos_core::{AccountId, ActorId, WorkspaceId};
        use quantos_policy::{Capability, Role, RunMode};
        use quantos_storage::{
            ArtifactManifest, InMemoryArtifactCatalog, InMemoryDataSnapshotCatalog,
            SnapshotQualityRuleset, default_quality_rules,
        };
        use std::{collections::BTreeSet, path::Path, process::Command};
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let output = Command::new(root.join("engines/.venv/bin/python"))
            .arg(root.join("scripts/tp06-produce.py"))
            .current_dir(&root)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let payloads: Vec<Value> = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(payloads.len(), 102);
        let payload = &payloads[0];
        let mut request = honest_request();
        // Capture the actual frozen Git candidate; image/runtime are explicit owned local fixture digests.
        request.candidate.source_commit = quantos_core::fixture_source::fixture_source_commit(
            &root,
            std::env::var("GITHUB_SHA").ok().as_deref(),
        )
        .expect("owned fixture requires a checkout HEAD or frozen archive SHA");
        request.candidate.image_digest =
            ContentHash::sha256_bytes(&std::fs::read(std::env::current_exe().unwrap()).unwrap());
        request.candidate.runtime_digest=ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "os":std::env::consts::OS,"arch":std::env::consts::ARCH,
            "cargo_lock":ContentHash::sha256_bytes(&std::fs::read(root.join("Cargo.lock")).unwrap()),
            "rust_toolchain":ContentHash::sha256_bytes(&std::fs::read(root.join("rust-toolchain.toml")).unwrap()),
            "engine_lock":ContentHash::sha256_bytes(&std::fs::read(root.join("engines/uv.lock")).unwrap()),
        })).unwrap());
        let clock = request.candidate.clock;
        let auth = AuthContext {
            tenant_id: request.snapshot.tenant_id,
            actor_id: ActorId::new(),
            user_id: uuid::Uuid::now_v7(),
            workspace_id: WorkspaceId::new(),
            workspace_slug: "s02".to_owned(),
            workspace_name: "S02 fixture".to_owned(),
            role: Role::Operator,
            mode: RunMode::Paper,
            account_id: Some(AccountId::new()),
            capabilities: BTreeSet::from([Capability::parse(Capability::STRATEGY_WRITE).unwrap()]),
        };
        let mut snapshots = InMemoryDataSnapshotCatalog::new();
        snapshots.upsert(request.snapshot.clone()).unwrap();
        let artifact = ArtifactManifest::new(
            auth.tenant_id,
            "application/json",
            ContentHash::sha256_bytes(&canonical_json_bytes(payload).unwrap()),
            "owned-fixture",
            canonical_json_bytes(payload).unwrap().len() as u64,
            clock,
        );
        let reference = DraftArtifactRef {
            artifact_id: artifact.artifact_id,
            content_hash: artifact.content_hash.clone(),
        };
        let mut artifacts = InMemoryArtifactCatalog::new();
        artifacts.upsert(artifact);
        let service = DraftService::new(
            snapshots,
            artifacts,
            SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, clock))
                .unwrap(),
        );
        let draft = service
            .create(&auth, "S02 real process fixture", clock)
            .unwrap();
        let input = DraftVersionInput {
            draft_id: draft.draft_id,
            parameters: payload["strategy"].clone(),
            data_snapshot_id: Some(request.snapshot.snapshot_id),
            artifact_refs: vec![reference],
            base_version: 0,
            save_kind: DraftSaveKind::Manual,
            saved_at: clock,
        };
        let saved = service.save(&auth, input.clone()).unwrap();
        let baseline = service
            .backtest(&auth, draft.draft_id, request.clone(), payload)
            .unwrap();
        assert_eq!(
            baseline.draft.as_ref().unwrap().version_hash,
            saved.content_hash
        );
        for _ in 1..10 {
            assert_eq!(
                baseline,
                service
                    .backtest(&auth, draft.draft_id, request.clone(), payload)
                    .unwrap()
            );
        }
        for scope in 0..3 {
            let mut foreign = auth.clone();
            match scope {
                0 => foreign.tenant_id = TenantId::new(),
                1 => foreign.workspace_id = WorkspaceId::new(),
                _ => foreign.capabilities.clear(),
            };
            assert!(
                service
                    .backtest(&foreign, draft.draft_id, request.clone(), payload)
                    .is_err()
            );
        }
        for bad in &payloads[2..] {
            assert!(
                service
                    .backtest(&auth, draft.draft_id, request.clone(), bad)
                    .is_err()
            );
        }
        let mut foreign_snapshot = request.clone();
        foreign_snapshot.snapshot = honest_request().snapshot;
        assert!(
            service
                .backtest(&auth, draft.draft_id, foreign_snapshot, payload)
                .is_err()
        );
        let mut forged = payload.clone();
        forged["strategy"]["parameters"]["lookback"] = json!(7);
        assert!(
            service
                .backtest(&auth, draft.draft_id, request.clone(), &forged)
                .is_err()
        );
        let mut changed = input.clone();
        changed.base_version = 1;
        changed.parameters["parameters"]["lookback"] = json!(7);
        service.save(&auth, changed).unwrap();
        assert!(
            service
                .backtest(&auth, draft.draft_id, request.clone(), payload)
                .is_err()
        );
        let mut recovery = input;
        recovery.base_version = 2;
        service.save(&auth, recovery).unwrap();
        let recovered = service
            .backtest(&auth, draft.draft_id, request, payload)
            .unwrap();
        assert_eq!(recovered.metrics, baseline.metrics);
        assert_ne!(recovered.report_hash, baseline.report_hash);
        baseline.verify_integrity().unwrap();
        println!(
            "S02_VALIDATION_REPORT={}",
            serde_json::to_string(&baseline).unwrap()
        );
        assert_eq!(baseline.draft.unwrap().version, 1);
        assert_eq!(recovered.draft.unwrap().version, 3);
    }

    #[test]
    fn s02_generated_universe_and_notional_are_effective_constraints() {
        let payload = json!({"artifact_type":"StrategyDraftArtifact","release_eligible":true,"static_check":{"passed":true,"findings":[]},"strategy":{"rule":"momentum","rule_source":"momentum(close, lookback=6)","parameters":{"lookback":6,"entry_threshold_bps":20,"exit_threshold_bps":-10,"max_position_notional":"1","universe":["BTCUSDT"]}}});
        let mut adapter =
            crate::generated::GeneratedStrategyAdapter::from_draft_payload(&payload).unwrap();
        let r = run_backtest(&honest_request(), &mut adapter).unwrap();
        assert!(!r.fills.is_empty());
        for fill in &r.fills {
            if fill.side == BacktestSide::Long {
                assert!(fill.quantity * fill.fill_price <= 1.0 + 1e-12);
            }
        }
        let mut foreign = payload;
        foreign["strategy"]["parameters"]["universe"] = json!(["ETHUSDT"]);
        assert!(
            run_backtest(
                &honest_request(),
                &mut crate::generated::GeneratedStrategyAdapter::from_draft_payload(&foreign)
                    .unwrap()
            )
            .is_err()
        );
    }
}
