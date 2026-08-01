use chrono::{DateTime, Duration as ChronoDuration, Utc};
use quantos_core::{ContentHash, CoreError, SnapshotId, canonical_json_bytes};
use quantos_storage::DataSnapshotRecord;
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

/// Adapter version pinned into every environment hash so engine upgrades change replays.
pub const BACKTEST_ADAPTER_VERSION: &str = "quantos-strategy.backtest.v1";

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

#[derive(Debug, Clone, PartialEq)]
pub struct BacktestRequest {
    pub snapshot: DataSnapshotRecord,
    pub series: BacktestBarSeries,
    pub cost_model: BacktestCostModel,
    pub warmup_bars: usize,
}

impl BacktestRequest {
    fn input_hash(&self, adapter_name: &str) -> Result<ContentHash, CoreError> {
        Ok(ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "adapter": adapter_name,
            "snapshot_hash": self.snapshot.content_hash.as_str(),
            "series_hash": self.series.content_hash.as_str(),
            "cost_model": self.cost_model,
            "warmup_bars": self.warmup_bars,
        }))?))
    }

    fn environment_hash(&self, adapter_name: &str) -> Result<ContentHash, CoreError> {
        Ok(ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "adapter_version": BACKTEST_ADAPTER_VERSION,
            "adapter": adapter_name,
            "snapshot_hash": self.snapshot.content_hash.as_str(),
            "series_hash": self.series.content_hash.as_str(),
            "cost_model": self.cost_model,
        }))?))
    }
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

#[derive(Debug, Clone, PartialEq)]
pub struct BacktestValidationReport {
    pub snapshot_id: SnapshotId,
    pub adapter: String,
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
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error("BACKTEST_SERIES_EMPTY: bar series must contain at least two bars")]
    SeriesEmpty,
    #[error("BACKTEST_INPUT_BINDING_MISMATCH: series is not bound to snapshot `{snapshot_hash}`")]
    InputBindingMismatch { snapshot_hash: String },
    #[error(
        "BACKTEST_DATA_LEAKAGE: snapshot captured at {captured_at} is newer than the first decision at {first_decision_at}"
    )]
    DataLeakage {
        captured_at: DateTime<Utc>,
        first_decision_at: DateTime<Utc>,
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
    if request.series.snapshot_hash != request.snapshot.content_hash {
        return Err(BacktestError::InputBindingMismatch {
            snapshot_hash: request.snapshot.content_hash.to_string(),
        });
    }

    let warmup = request.warmup_bars.min(request.series.bars.len() - 1);
    let first_decision_at = request.series.bars[warmup].close_time;
    if request.snapshot.captured_at > first_decision_at {
        return Err(BacktestError::DataLeakage {
            captured_at: request.snapshot.captured_at,
            first_decision_at,
        });
    }

    let mut cash = 100_000.0_f64;
    let initial_cash = cash;
    let mut position_qty = 0.0_f64;
    let mut trade_count = 0_u32;
    let mut fees_total = 0.0_f64;
    let mut slippage_total = 0.0_f64;
    let mut gross_pnl = 0.0_f64;
    let mut equity_curve = Vec::with_capacity(request.series.bars.len() - warmup);
    let mut entry_cost_basis = 0.0_f64;

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

        match (decision.side, position_qty > 0.0) {
            (BacktestSide::Long, false) if decision.quantity > 0.0 => {
                let fill_price =
                    bar.close * (1.0 + f64::from(request.cost_model.slippage_bps) / 10_000.0);
                let notional = fill_price * decision.quantity;
                let fee = request.cost_model.fee(notional);
                let slippage = request.cost_model.slippage(bar.close * decision.quantity);
                cash -= notional + fee;
                fees_total += fee;
                slippage_total += slippage;
                position_qty = decision.quantity;
                entry_cost_basis = notional;
                trade_count += 1;
            }
            (BacktestSide::Flat, true) => {
                let fill_price =
                    bar.close * (1.0 - f64::from(request.cost_model.slippage_bps) / 10_000.0);
                let notional = fill_price * position_qty;
                let fee = request.cost_model.fee(notional);
                let slippage = request.cost_model.slippage(bar.close * position_qty);
                cash += notional - fee;
                fees_total += fee;
                slippage_total += slippage;
                gross_pnl += notional - entry_cost_basis;
                position_qty = 0.0;
                trade_count += 1;
            }
            _ => {}
        }

        equity_curve.push(cash + position_qty * bar.close);
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
    let sharpe = if variance > 0.0 {
        mean_return / variance.sqrt() * (returns.len() as f64).sqrt()
    } else {
        0.0
    };
    let net_pnl = final_equity - initial_cash;

    let metrics = BacktestMetrics {
        total_return,
        max_drawdown,
        sharpe,
        trade_count,
        gross_pnl,
        net_pnl,
    };
    let costs = BacktestCosts {
        fees_total,
        slippage_total,
    };
    let adapter_name = adapter.adapter_name();
    let generated_at = request
        .series
        .bars
        .last()
        .map(|bar| bar.close_time)
        .unwrap_or(first_decision_at);
    let report_payload = json!({
        "snapshot_id": request.snapshot.snapshot_id.to_string(),
        "adapter": adapter_name,
        "costs": costs,
        "metrics": metrics,
        "decisions": (request.series.bars.len() - warmup) as u32,
        "generated_at": generated_at,
    });
    let report_hash = ContentHash::sha256_bytes(&canonical_json_bytes(&report_payload)?);

    Ok(BacktestValidationReport {
        snapshot_id: request.snapshot.snapshot_id,
        adapter: adapter_name.to_owned(),
        input_hash: request.input_hash(adapter_name)?,
        environment_hash: request.environment_hash(adapter_name)?,
        costs,
        metrics,
        leak_check: LeakCheckSummary {
            decisions: (request.series.bars.len() - warmup) as u32,
            violations: 0,
        },
        generated_at,
        report_hash,
    })
}

#[cfg(test)]
mod tests {
    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_core::{ArtifactId, SchemaVersion, TenantId};
    use quantos_storage::{
        DataSnapshotInput, DataSnapshotRecord, SnapshotArtifactRef, SnapshotLineageEntry,
        SnapshotQuality, SnapshotSourceRef, SnapshotWindow,
    };
    use serde_json::json;

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
                    end_at: series_start() + ChronoDuration::hours(4),
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
                    content_hash: ContentHash::sha256_bytes(br#"{"bars":"fixture"}"#),
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

    fn honest_request() -> BacktestRequest {
        let snapshot = honest_snapshot(series_start() - ChronoDuration::hours(1));
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
        assert_eq!(
            report.generated_at,
            request.series.bars.last().expect("bars exist").close_time
        );
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
            let first_decision_at = request.series.bars[request.warmup_bars].close_time;
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
}
