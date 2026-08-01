pub mod pg;

use std::{
    collections::{BTreeMap, BTreeSet},
    io::{BufRead, Write},
};

use chrono::{DateTime, Duration as ChronoDuration, TimeZone, Utc};
use quantos_core::{AccountId, ContentHash, CoreError, TenantId, canonical_json_bytes};
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

pub const REPLAY_SYMBOLS: [&str; 3] = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FillSide {
    Buy,
    Sell,
}

impl FillSide {
    fn signed(self, quantity: f64) -> f64 {
        match self {
            Self::Buy => quantity,
            Self::Sell => -quantity,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FillEvent {
    pub account_id: AccountId,
    pub symbol: String,
    pub side: FillSide,
    pub quantity: f64,
    pub price: f64,
    pub fee: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MarkPriceEvent {
    pub symbol: String,
    pub price: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PortfolioEventKind {
    Fill(FillEvent),
    MarkPrice(MarkPriceEvent),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PortfolioEvent {
    pub event_id: String,
    pub sequence: u64,
    pub occurred_at: DateTime<Utc>,
    #[serde(flatten)]
    pub kind: PortfolioEventKind,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PositionState {
    pub account_id: AccountId,
    pub symbol: String,
    pub quantity: f64,
    pub average_entry_price: f64,
    pub realized_pnl: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PositionSnapshot {
    pub symbol: String,
    pub quantity: f64,
    pub average_entry_price: f64,
    pub mark_price: f64,
    pub market_value: f64,
    pub unrealized_pnl: f64,
    pub realized_pnl: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PortfolioSnapshot {
    pub tenant_id: TenantId,
    pub account_id: AccountId,
    pub positions: Vec<PositionSnapshot>,
    pub realized_pnl: f64,
    pub unrealized_pnl: f64,
    pub exposure_gross: f64,
    pub exposure_net: f64,
    pub last_event_sequence: u64,
    pub as_of: DateTime<Utc>,
    pub snapshot_hash: ContentHash,
}

#[derive(Debug, Error)]
pub enum PortfolioError {
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("PORTFOLIO_DUPLICATE_EVENT: event `{event_id}` was already applied")]
    DuplicateEvent { event_id: String },
    #[error("PORTFOLIO_SEQUENCE_GAP: expected sequence {expected} but received {received}")]
    SequenceGap { expected: u64, received: u64 },
}

#[derive(Debug, Clone)]
pub struct InMemoryPortfolioProjection {
    tenant_id: TenantId,
    positions: BTreeMap<(AccountId, String), PositionState>,
    marks: BTreeMap<String, (f64, DateTime<Utc>)>,
    seen_event_ids: BTreeSet<String>,
    last_sequence: u64,
    last_event_at: DateTime<Utc>,
}

impl InMemoryPortfolioProjection {
    #[must_use]
    pub fn new(tenant_id: TenantId, started_at: DateTime<Utc>) -> Self {
        Self {
            tenant_id,
            positions: BTreeMap::new(),
            marks: BTreeMap::new(),
            seen_event_ids: BTreeSet::new(),
            last_sequence: 0,
            last_event_at: started_at,
        }
    }

    pub fn rebuild(
        tenant_id: TenantId,
        started_at: DateTime<Utc>,
        events: &[PortfolioEvent],
    ) -> Result<Self, PortfolioError> {
        let mut projection = Self::new(tenant_id, started_at);
        for event in events {
            projection.apply(event)?;
        }
        Ok(projection)
    }

    pub fn apply(&mut self, event: &PortfolioEvent) -> Result<(), PortfolioError> {
        if !self.seen_event_ids.insert(event.event_id.clone()) {
            return Err(PortfolioError::DuplicateEvent {
                event_id: event.event_id.clone(),
            });
        }
        let expected = self.last_sequence + 1;
        if event.sequence != expected {
            return Err(PortfolioError::SequenceGap {
                expected,
                received: event.sequence,
            });
        }
        match &event.kind {
            PortfolioEventKind::Fill(fill) => {
                let key = (fill.account_id, fill.symbol.clone());
                let position = self.positions.entry(key).or_insert_with(|| PositionState {
                    account_id: fill.account_id,
                    symbol: fill.symbol.clone(),
                    quantity: 0.0,
                    average_entry_price: 0.0,
                    realized_pnl: 0.0,
                });
                apply_fill(position, fill);
            }
            PortfolioEventKind::MarkPrice(mark) => {
                self.marks
                    .insert(mark.symbol.clone(), (mark.price, event.occurred_at));
            }
        }
        self.last_sequence = event.sequence;
        self.last_event_at = event.occurred_at;
        Ok(())
    }

    #[must_use]
    pub fn position(&self, account_id: AccountId, symbol: &str) -> Option<&PositionState> {
        self.positions.get(&(account_id, symbol.to_owned()))
    }

    #[must_use]
    pub fn mark(&self, symbol: &str) -> Option<(f64, DateTime<Utc>)> {
        self.marks.get(symbol).copied()
    }

    #[must_use]
    pub fn last_sequence(&self) -> u64 {
        self.last_sequence
    }

    pub fn snapshot(&self, account_id: AccountId) -> Result<PortfolioSnapshot, PortfolioError> {
        let mut positions = Vec::new();
        let mut realized_total = 0.0_f64;
        let mut unrealized_total = 0.0_f64;
        let mut exposure_gross = 0.0_f64;
        let mut exposure_net = 0.0_f64;
        for ((position_account, _), position) in &self.positions {
            if *position_account != account_id {
                continue;
            }
            let (mark_price, _) = self
                .marks
                .get(&position.symbol)
                .copied()
                .unwrap_or((position.average_entry_price, self.last_event_at));
            let market_value = position.quantity * mark_price;
            let unrealized = position.quantity * (mark_price - position.average_entry_price);
            realized_total += position.realized_pnl;
            unrealized_total += unrealized;
            exposure_gross += market_value.abs();
            exposure_net += market_value;
            positions.push(PositionSnapshot {
                symbol: position.symbol.clone(),
                quantity: position.quantity,
                average_entry_price: position.average_entry_price,
                mark_price,
                market_value,
                unrealized_pnl: unrealized,
                realized_pnl: position.realized_pnl,
            });
        }
        positions.sort_by(|left, right| left.symbol.cmp(&right.symbol));
        let snapshot_hash = ContentHash::sha256_bytes(&canonical_json_bytes(&json!({
            "positions": positions,
            "realized_pnl": realized_total,
            "unrealized_pnl": unrealized_total,
            "exposure_gross": exposure_gross,
            "exposure_net": exposure_net,
            "last_event_sequence": self.last_sequence,
            "as_of": self.last_event_at,
        }))?);
        Ok(PortfolioSnapshot {
            tenant_id: self.tenant_id,
            account_id,
            positions,
            realized_pnl: realized_total,
            unrealized_pnl: unrealized_total,
            exposure_gross,
            exposure_net,
            last_event_sequence: self.last_sequence,
            as_of: self.last_event_at,
            snapshot_hash,
        })
    }
}

/// Approximate float equality for golden-snapshot comparisons that cross a JSON text roundtrip.
#[must_use]
pub fn approx_eq(left: f64, right: f64) -> bool {
    (left - right).abs() <= 1e-9 * left.abs().max(right.abs()).max(1.0)
}

#[must_use]
pub fn position_snapshots_approx_eq(left: &[PositionSnapshot], right: &[PositionSnapshot]) -> bool {
    left.len() == right.len()
        && left.iter().zip(right.iter()).all(|(left, right)| {
            left.symbol == right.symbol
                && approx_eq(left.quantity, right.quantity)
                && approx_eq(left.average_entry_price, right.average_entry_price)
                && approx_eq(left.mark_price, right.mark_price)
                && approx_eq(left.market_value, right.market_value)
                && approx_eq(left.unrealized_pnl, right.unrealized_pnl)
                && approx_eq(left.realized_pnl, right.realized_pnl)
        })
}

#[must_use]
pub fn snapshots_approx_eq(left: &PortfolioSnapshot, right: &PortfolioSnapshot) -> bool {
    position_snapshots_approx_eq(&left.positions, &right.positions)
        && approx_eq(left.realized_pnl, right.realized_pnl)
        && approx_eq(left.unrealized_pnl, right.unrealized_pnl)
        && approx_eq(left.exposure_gross, right.exposure_gross)
        && approx_eq(left.exposure_net, right.exposure_net)
        && left.last_event_sequence == right.last_event_sequence
        && left.snapshot_hash == right.snapshot_hash
}

fn apply_fill(position: &mut PositionState, fill: &FillEvent) {
    let signed = fill.side.signed(fill.quantity);
    let current = position.quantity;
    if current == 0.0 || current.signum() == signed.signum() {
        let new_quantity = current + signed;
        position.average_entry_price = if new_quantity.abs() > 0.0 {
            (current * position.average_entry_price + signed * fill.price) / new_quantity
        } else {
            0.0
        };
        position.quantity = new_quantity;
    } else {
        let closing = signed.abs().min(current.abs());
        position.realized_pnl +=
            closing * (fill.price - position.average_entry_price) * current.signum();
        let new_quantity = current + signed;
        if new_quantity == 0.0 {
            position.average_entry_price = 0.0;
        } else if new_quantity.signum() != current.signum() {
            position.average_entry_price = fill.price;
        }
        position.quantity = new_quantity;
    }
    position.realized_pnl -= fill.fee;
}

/// Deterministic replay dataset: 80% closed round trips plus 20% open buys,
/// followed by one mark event per symbol. `count` counts fill events only.
#[must_use]
pub fn generate_fill_replay(
    account_id: AccountId,
    count: u64,
    start: DateTime<Utc>,
) -> Vec<PortfolioEvent> {
    let mut events = Vec::with_capacity(count as usize + REPLAY_SYMBOLS.len());
    let mut sequence = 0_u64;
    for index in 0..count {
        sequence += 1;
        let symbol = REPLAY_SYMBOLS[(index as usize) % REPLAY_SYMBOLS.len()].to_owned();
        let open_cycle = index % 5 == 4;
        let (side, quantity, price) = if open_cycle {
            (
                FillSide::Buy,
                (1 + index % 4) as f64,
                100.0 + (index % 9) as f64,
            )
        } else if index % 2 == 0 {
            (
                FillSide::Buy,
                (1 + index % 3) as f64,
                100.0 + (index % 7) as f64,
            )
        } else {
            (
                FillSide::Sell,
                (1 + (index - 1) % 3) as f64,
                100.0 + ((index - 1) % 7) as f64 + (index % 5) as f64 - 2.0,
            )
        };
        events.push(PortfolioEvent {
            event_id: format!("replay-fill-{sequence:06}"),
            sequence,
            occurred_at: start + ChronoDuration::milliseconds(sequence as i64),
            kind: PortfolioEventKind::Fill(FillEvent {
                account_id,
                symbol,
                side,
                quantity,
                price,
                fee: 0.5,
            }),
        });
    }
    for (symbol_index, symbol) in REPLAY_SYMBOLS.iter().enumerate() {
        sequence += 1;
        events.push(PortfolioEvent {
            event_id: format!("replay-mark-{symbol}"),
            sequence,
            occurred_at: start + ChronoDuration::milliseconds(sequence as i64),
            kind: PortfolioEventKind::MarkPrice(MarkPriceEvent {
                symbol: (*symbol).to_owned(),
                price: 110.0 + symbol_index as f64,
            }),
        });
    }
    events
}

pub fn write_events_jsonl(
    writer: &mut impl Write,
    events: &[PortfolioEvent],
) -> Result<(), PortfolioError> {
    for event in events {
        serde_json::to_writer(&mut *writer, event)?;
        writer.write_all(b"\n")?;
    }
    Ok(())
}

pub fn read_events_jsonl(reader: impl BufRead) -> Result<Vec<PortfolioEvent>, PortfolioError> {
    reader
        .lines()
        .map(|line| Ok(serde_json::from_str(&line?)?))
        .collect()
}

#[must_use]
pub fn replay_start() -> DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0)
        .single()
        .expect("valid timestamp")
}

#[cfg(test)]
mod tests {
    use std::time::Instant;

    use super::*;

    fn account() -> AccountId {
        AccountId::from_uuid(uuid::Uuid::from_u128(
            0x0102_0304_0506_0708_090a_0b0c_0d0e_0f10,
        ))
    }

    fn replay_events() -> Vec<PortfolioEvent> {
        generate_fill_replay(account(), 10_000, replay_start())
    }

    #[test]
    fn ten_thousand_event_replay_matches_golden_snapshot() {
        let tenant_id = TenantId::new();
        let events = replay_events();
        assert_eq!(events.len(), 10_003);
        let projection = InMemoryPortfolioProjection::rebuild(tenant_id, replay_start(), &events)
            .expect("rebuild succeeds");
        let snapshot = projection.snapshot(account()).expect("snapshot builds");

        let golden: PortfolioSnapshot =
            serde_json::from_str(GOLDEN_SNAPSHOT_JSON).expect("golden snapshot parses");
        assert!(
            snapshots_approx_eq(&snapshot, &golden),
            "rebuilt snapshot diverged from golden snapshot"
        );
    }

    #[test]
    fn rebuild_is_fully_repeatable() {
        let tenant_id = TenantId::new();
        let events = replay_events();
        let first = InMemoryPortfolioProjection::rebuild(tenant_id, replay_start(), &events)
            .expect("first rebuild succeeds")
            .snapshot(account())
            .expect("snapshot builds");
        let second = InMemoryPortfolioProjection::rebuild(tenant_id, replay_start(), &events)
            .expect("second rebuild succeeds")
            .snapshot(account())
            .expect("snapshot builds");
        assert_eq!(first, second);
    }

    #[test]
    fn out_of_order_and_duplicate_events_are_rejected() {
        let tenant_id = TenantId::new();
        let events = replay_events();
        let mut projection = InMemoryPortfolioProjection::new(tenant_id, replay_start());
        projection.apply(&events[0]).expect("first event applies");
        let duplicate = projection
            .apply(&events[0])
            .expect_err("duplicate rejected");
        assert!(matches!(duplicate, PortfolioError::DuplicateEvent { .. }));
        let gap = projection.apply(&events[2]).expect_err("gap rejected");
        assert!(matches!(gap, PortfolioError::SequenceGap { .. }));
    }

    #[test]
    fn portfolio_queries_stay_under_three_hundred_millis_p95() {
        let tenant_id = TenantId::new();
        let events = replay_events();
        let projection = InMemoryPortfolioProjection::rebuild(tenant_id, replay_start(), &events)
            .expect("rebuild succeeds");

        let mut durations = Vec::new();
        for index in 0..300_usize {
            let symbol = REPLAY_SYMBOLS[index % REPLAY_SYMBOLS.len()];
            let started = Instant::now();
            let position = projection.position(account(), symbol);
            let mark = projection.mark(symbol);
            let _ = projection.snapshot(account()).expect("snapshot builds");
            durations.push(started.elapsed());
            assert!(position.is_some());
            assert!(mark.is_some());
        }
        durations.sort();
        let p95 = durations[(durations.len() * 95 / 100).min(durations.len() - 1)];
        assert!(
            p95 < std::time::Duration::from_millis(300),
            "portfolio query p95 {p95:?} exceeded 300ms"
        );
    }

    const GOLDEN_SNAPSHOT_JSON: &str = include_str!("../tests/golden/portfolio_snapshot.json");
}
