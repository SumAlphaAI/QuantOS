use serde_json::Value;
use thiserror::Error;

use crate::backtest::{BacktestDecision, DecisionContext, MomentumAdapter, StrategyAdapter};

/// Adapter version for strategy-lab generated rules replayed through the S02 backtest engine.
pub const GENERATED_ADAPTER_NAME: &str = "strategy-lab.generated.v1";

#[derive(Debug, Error)]
pub enum GeneratedStrategyError {
    #[error("GENERATED_STRATEGY_RELEASE_BLOCKED: static check failed with findings {findings:?}")]
    ReleaseBlocked { findings: Vec<String> },
    #[error("GENERATED_STRATEGY_UNSUPPORTED: {detail}")]
    Unsupported { detail: String },
}

/// `StrategyAdapter` backed by a strategy-lab `StrategyDraftArtifact`.
///
/// Only drafts whose static checks passed (`release_eligible == true`) can be adapted;
/// blocked drafts are rejected here as well so a failed static check can never reach
/// backtest or Release paths.
#[derive(Debug)]
pub struct GeneratedStrategyAdapter {
    inner: MomentumAdapter,
}

impl GeneratedStrategyAdapter {
    pub fn from_draft_payload(payload: &Value) -> Result<Self, GeneratedStrategyError> {
        let release_eligible = payload
            .get("release_eligible")
            .and_then(Value::as_bool)
            .ok_or_else(|| GeneratedStrategyError::Unsupported {
                detail: "draft payload is missing `release_eligible`".to_owned(),
            })?;
        if !release_eligible {
            let findings = payload
                .get("static_check")
                .and_then(|check| check.get("findings"))
                .and_then(Value::as_array)
                .map(|findings| {
                    findings
                        .iter()
                        .filter_map(|finding| finding.as_str().map(str::to_owned))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            return Err(GeneratedStrategyError::ReleaseBlocked { findings });
        }

        let strategy =
            payload
                .get("strategy")
                .ok_or_else(|| GeneratedStrategyError::Unsupported {
                    detail: "draft payload is missing `strategy`".to_owned(),
                })?;
        let rule = strategy
            .get("rule")
            .and_then(Value::as_str)
            .ok_or_else(|| GeneratedStrategyError::Unsupported {
                detail: "draft strategy is missing `rule`".to_owned(),
            })?;
        if rule != "momentum" {
            return Err(GeneratedStrategyError::Unsupported {
                detail: format!("rule `{rule}` is not supported by the backtest adapter"),
            });
        }
        let parameters =
            strategy
                .get("parameters")
                .ok_or_else(|| GeneratedStrategyError::Unsupported {
                    detail: "draft strategy is missing `parameters`".to_owned(),
                })?;
        let lookback = integer_field(parameters, "lookback")?;
        if !(1..=500).contains(&lookback) {
            return Err(GeneratedStrategyError::Unsupported {
                detail: format!("lookback `{lookback}` is out of range"),
            });
        }
        let entry_threshold_bps = integer_field(parameters, "entry_threshold_bps")?;
        let exit_threshold_bps = integer_field(parameters, "exit_threshold_bps")?;
        if entry_threshold_bps.abs() > 5_000 || exit_threshold_bps.abs() > 5_000 {
            return Err(GeneratedStrategyError::Unsupported {
                detail: "thresholds exceed ±5000bps bounds".to_owned(),
            });
        }

        Ok(Self {
            inner: MomentumAdapter::new(lookback as usize, entry_threshold_bps, exit_threshold_bps),
        })
    }
}

impl StrategyAdapter for GeneratedStrategyAdapter {
    fn adapter_name(&self) -> &'static str {
        GENERATED_ADAPTER_NAME
    }

    fn decide(&mut self, ctx: &mut DecisionContext<'_>) -> BacktestDecision {
        self.inner.decide(ctx)
    }
}

fn integer_field(parameters: &Value, field: &str) -> Result<i64, GeneratedStrategyError> {
    parameters
        .get(field)
        .and_then(Value::as_i64)
        .ok_or_else(|| GeneratedStrategyError::Unsupported {
            detail: format!("parameter `{field}` must be an integer"),
        })
}

#[cfg(test)]
mod tests {
    use chrono::{Duration as ChronoDuration, TimeZone, Utc};
    use quantos_core::{ArtifactId, ContentHash, SchemaVersion, TenantId};
    use quantos_storage::{
        DataSnapshotInput, DataSnapshotRecord, SnapshotArtifactRef, SnapshotLineageEntry,
        SnapshotQuality, SnapshotSourceRef, SnapshotWindow,
    };
    use serde_json::json;

    use super::*;
    use crate::backtest::{BacktestBarSeries, BacktestCostModel, BacktestRequest, run_backtest};

    fn series_start() -> chrono::DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0)
            .single()
            .expect("valid timestamp")
    }

    fn snapshot(captured_at: chrono::DateTime<Utc>) -> DataSnapshotRecord {
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

    fn draft_payload(release_eligible: bool, findings: Vec<String>) -> Value {
        json!({
            "artifact_type": "StrategyDraftArtifact",
            "engine": "strategy-lab",
            "strategy": {
                "name": "trend.momentum.btc",
                "rule": "momentum",
                "parameters": {
                    "lookback": 6,
                    "entry_threshold_bps": 20,
                    "exit_threshold_bps": -10,
                    "max_position_notional": "25000",
                    "universe": ["BTCUSDT"],
                },
                "rule_source": "momentum(close, lookback=6)",
            },
            "release_eligible": release_eligible,
            "static_check": {
                "passed": release_eligible,
                "findings": findings,
            },
        })
    }

    fn request() -> BacktestRequest {
        let snapshot = snapshot(series_start() - ChronoDuration::hours(1));
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

    #[test]
    fn hundred_static_check_failures_all_block_release_path() {
        let mut blocked = 0_u32;
        for index in 0..100_u32 {
            let payload =
                draft_payload(false, vec![format!("forbidden_construct:probe-{index:03}")]);
            let error = GeneratedStrategyAdapter::from_draft_payload(&payload)
                .expect_err("blocked draft must be rejected");
            assert!(matches!(
                error,
                GeneratedStrategyError::ReleaseBlocked { .. }
            ));
            blocked += 1;
        }
        assert_eq!(blocked, 100);
    }

    #[test]
    fn clean_generated_draft_replays_through_backtest_pipeline() {
        let payload = draft_payload(true, vec![]);
        let mut adapter =
            GeneratedStrategyAdapter::from_draft_payload(&payload).expect("clean draft adapts");
        assert_eq!(adapter.adapter_name(), GENERATED_ADAPTER_NAME);

        let backtest_request = request();
        let report = run_backtest(&backtest_request, &mut adapter).expect("backtest succeeds");
        assert!(report.metrics.trade_count > 0);
        assert!(report.costs.fees_total > 0.0);
        assert_eq!(report.leak_check.violations, 0);
        assert_eq!(report.adapter, GENERATED_ADAPTER_NAME);

        let mut second = GeneratedStrategyAdapter::from_draft_payload(&payload)
            .expect("clean draft adapts again");
        let replay = run_backtest(&backtest_request, &mut second).expect("replay succeeds");
        assert_eq!(replay.report_hash, report.report_hash);
    }

    #[test]
    fn unsupported_rules_are_rejected() {
        let mut payload = draft_payload(true, vec![]);
        payload["strategy"]["rule"] = Value::String("grid".to_owned());
        let error = GeneratedStrategyAdapter::from_draft_payload(&payload)
            .expect_err("unsupported rule must be rejected");
        assert!(matches!(error, GeneratedStrategyError::Unsupported { .. }));
    }
}
