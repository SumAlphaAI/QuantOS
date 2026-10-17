//! Read-only risk observations and virtual fills. No execution gateway/issuer,
//! adapter, network client, callback or kernel handle can enter this state.
use crate::model::*;
use chrono::{DateTime, Utc};
use quantos_auth::AuthContext;
use quantos_core::{CommandId, ContentHash};
use quantos_execution::authority::CurrentSources;
use quantos_risk::{
    RiskVerdict,
    guard::{GuardDecision, Phase, RiskGuard, Side, TradeIntent},
};
use rust_decimal::Decimal;
use serde::Serialize;
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Advice {
    pub advice_id: String,
    pub intent: TradeIntent,
    pub mark: Mark,
    pub risk: GuardDecision,
    pub generated_at: DateTime<Utc>,
    pub executable: bool,
}
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct VirtualEvent {
    pub sequence: u64,
    pub fill: Fill,
    pub advice_id: String,
    pub previous_hash: Option<ContentHash>,
    pub hash: ContentHash,
}
#[derive(Clone)]
struct State {
    at: Option<DateTime<Utc>>,
    advice: BTreeMap<String, (ContentHash, Advice)>,
    positions: BTreeMap<String, Position>,
    cash: Decimal,
    fills: BTreeMap<String, Fill>,
    events: Vec<VirtualEvent>,
    marks: BTreeMap<String, Mark>,
    revision: u64,
}
/// ```compile_fail
/// use quantos_reconcile::shadow::ShadowRunner;
/// fn forbidden(r: &ShadowRunner) { r.submit(); }
/// ```
#[derive(Clone)]
pub struct ShadowRunner {
    scope: Scope,
    seed: Seed,
    guard: RiskGuard,
    consumer: CommandId,
    state: Arc<Mutex<State>>,
}
impl ShadowRunner {
    pub fn new(scope: Scope, seed: Seed, guard: RiskGuard) -> Result<Self, Error> {
        scope.validate()?;
        seed.validate()?;
        totals(&seed.positions, seed.cash, seed.sequence)?;
        let state = State {
            at: None,
            advice: BTreeMap::new(),
            positions: seed.positions.clone(),
            cash: seed.cash,
            fills: BTreeMap::new(),
            events: vec![],
            marks: seed
                .positions
                .iter()
                .map(|(s, p)| (s.clone(), p.mark.clone()))
                .collect(),
            revision: 1,
        };
        Ok(Self {
            scope,
            seed,
            guard,
            consumer: CommandId::new(),
            state: Arc::new(Mutex::new(state)),
        })
    }
    pub fn recommend(
        &self,
        auth: &AuthContext,
        intent: &TradeIntent,
        sources: CurrentSources<'_>,
        tick: &Mark,
        now: DateTime<Utc>,
    ) -> Result<Advice, Error> {
        self.scope.authorize(auth)?;
        let mut s = self.state.lock().map_err(|_| Error::Unavailable)?;
        clock(s.at, now)?;
        tick.validate(now, 60)?;
        if intent.account_id != self.scope.account_id
            || intent.target != quantos_strategy_target_shadow()
            || tick.symbol != intent.symbol
            || sources.financials.quote_unit != self.scope.quote_unit
        {
            return Err(Error::Invalid("Shadow intent or quote binding"));
        }
        if s.marks.get(&tick.symbol).is_some_and(|old| {
            tick.sequence < old.sequence
                || tick.sequence == old.sequence && tick != old
                || tick.source_at < old.source_at
        }) {
            return Err(Error::Conflict);
        }
        let fingerprint = hash(
            "quantos-x05-advice-input/v1",
            &(auth.actor_id, intent, tick),
        );
        if let Some((prior, cached)) = s.advice.get(&intent.command_key) {
            if prior != &fingerprint {
                return Err(Error::Conflict);
            }
            if now >= cached.risk.expires_at {
                return Err(Error::Invalid("advice expired"));
            }
            if cached.risk.verdict == RiskVerdict::Allow {
                self.current(auth, cached, sources, now, || Ok(()))?;
            } else {
                self.guard.verify_decision(&cached.risk)?;
            }
            return Ok(cached.clone());
        }
        let revision = s.revision.checked_add(1).ok_or(Error::Arithmetic)?;
        let mut repriced = s.positions.get(&tick.symbol).cloned();
        if let Some(p) = &mut repriced {
            p.mark = tick.clone();
            p.unrealized_pnl = mul(p.quantity, sub(tick.price, p.average_entry_price)?)?;
        }
        let mut repriced_positions = s.positions.clone();
        if let Some(p) = &repriced {
            repriced_positions.insert(p.symbol.clone(), p.clone());
        }
        totals(
            &repriced_positions,
            s.cash,
            self.seed
                .sequence
                .checked_add(s.events.len() as u64)
                .ok_or(Error::Arithmetic)?,
        )?;
        let risk = self.guard.evaluate(
            auth,
            Phase::Pre,
            intent,
            sources.snapshot,
            sources.financials,
            sources.venue,
            sources.release,
            None,
            now,
        )?;
        let advice = Advice {
            advice_id: format!(
                "shadow-advice:{}",
                hash("quantos-x05-advice/v1", &(&self.scope, &intent.command_key))
            ),
            intent: intent.clone(),
            mark: tick.clone(),
            risk,
            generated_at: now,
            executable: false,
        };
        s.advice
            .insert(intent.command_key.clone(), (fingerprint, advice.clone()));
        s.positions = repriced_positions;
        s.marks.insert(tick.symbol.clone(), tick.clone());
        s.at = Some(now);
        s.revision = revision;
        Ok(advice)
    }
    fn current<T>(
        &self,
        auth: &AuthContext,
        a: &Advice,
        sources: CurrentSources<'_>,
        now: DateTime<Utc>,
        commit: impl FnOnce() -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.guard.with_current_allow(
            self.consumer,
            &a.risk,
            auth,
            &a.intent,
            sources.snapshot,
            sources.financials,
            sources.venue,
            sources.release,
            None,
            now,
            |_| commit(),
        )
    }
    #[allow(clippy::too_many_arguments)]
    pub fn simulate_fill(
        &self,
        auth: &AuthContext,
        advice_key: &str,
        fill_key: &str,
        quantity: Decimal,
        fee: Decimal,
        sources: CurrentSources<'_>,
        now: DateTime<Utc>,
    ) -> Result<Fill, Error> {
        self.scope.authorize(auth)?;
        positive(quantity)?;
        number(fee)?;
        if !identifier(fill_key) || fee < Decimal::ZERO {
            return Err(Error::Invalid("virtual fill key or fee"));
        }
        let mut s = self.state.lock().map_err(|_| Error::Unavailable)?;
        clock(s.at, now)?;
        let advice = s
            .advice
            .get(advice_key)
            .map(|(_, a)| a.clone())
            .ok_or(Error::Invalid("unknown advice"))?;
        advice.mark.validate(now, 60)?;
        let id = format!(
            "shadow-fill:{}",
            hash("quantos-x05-virtual-fill/v1", &(&self.scope, fill_key))
        );
        self.current(auth, &advice, sources, now, || {
            if let Some(f) = s.fills.get(&id) {
                if f.order_id != advice.advice_id || f.quantity != quantity || f.fee != fee {
                    return Err(Error::Conflict);
                }
                return Ok(f.clone());
            }
            if s.marks.get(&advice.mark.symbol) != Some(&advice.mark) {
                return Err(Error::Invalid("advice market observation superseded"));
            }
            let intended = advice
                .intent
                .quantity
                .parse::<Decimal>()
                .map_err(|_| Error::Invalid("intent quantity"))?;
            let limit = advice
                .intent
                .limit_price
                .parse::<Decimal>()
                .map_err(|_| Error::Invalid("intent price"))?;
            let filled = s
                .fills
                .values()
                .filter(|f| f.order_id == advice.advice_id)
                .try_fold(Decimal::ZERO, |n, f| add(n, f.quantity))?;
            if add(filled, quantity)? > intended
                || match advice.intent.side {
                    Side::Buy => advice.mark.price > limit,
                    Side::Sell => advice.mark.price < limit,
                }
            {
                return Err(Error::Invalid("virtual limit or overfill"));
            }
            let sequence = self
                .seed
                .sequence
                .checked_add(s.events.len() as u64)
                .and_then(|n| n.checked_add(1))
                .ok_or(Error::Arithmetic)?;
            let f = Fill {
                fill_id: id.clone(),
                order_id: advice.advice_id.clone(),
                command_id: advice.advice_id.clone(),
                symbol: advice.intent.symbol.clone(),
                side: advice.intent.side,
                quantity,
                price: advice.mark.price,
                fee,
                sequence,
                at: now,
            };
            let mut positions = s.positions.clone();
            let mut cash = s.cash;
            apply_fill(&mut positions, &mut cash, &f, &advice.mark)?;
            totals(&positions, cash, sequence)?;
            let revision = s.revision.checked_add(1).ok_or(Error::Arithmetic)?;
            let previous_hash = s.events.last().map(|e| e.hash.clone());
            let event = VirtualEvent {
                sequence,
                fill: f.clone(),
                advice_id: advice.advice_id.clone(),
                hash: hash(
                    "quantos-x05-virtual-event/v1",
                    &(&self.scope, sequence, &f, &previous_hash),
                ),
                previous_hash,
            };
            s.positions = positions;
            s.cash = cash;
            s.fills.insert(id, f.clone());
            s.events.push(event);
            s.at = Some(now);
            s.revision = revision;
            Ok(f)
        })
    }
    pub fn mark(&self, auth: &AuthContext, tick: &Mark, now: DateTime<Utc>) -> Result<(), Error> {
        self.scope.authorize(auth)?;
        tick.validate(now, 60)?;
        let mut s = self.state.lock().map_err(|_| Error::Unavailable)?;
        clock(s.at, now)?;
        if s.marks.get(&tick.symbol).is_some_and(|m| {
            tick.sequence < m.sequence
                || tick.sequence == m.sequence && tick != m
                || tick.source_at < m.source_at
        }) {
            return Err(Error::Conflict);
        }
        let mut p = s
            .positions
            .get(&tick.symbol)
            .cloned()
            .ok_or(Error::Invalid("unknown marked position"))?;
        p.mark = tick.clone();
        p.unrealized_pnl = mul(p.quantity, sub(tick.price, p.average_entry_price)?)?;
        let mut positions = s.positions.clone();
        positions.insert(tick.symbol.clone(), p.clone());
        totals(
            &positions,
            s.cash,
            self.seed
                .sequence
                .checked_add(s.events.len() as u64)
                .ok_or(Error::Arithmetic)?,
        )?;
        let revision = s.revision.checked_add(1).ok_or(Error::Arithmetic)?;
        s.positions.insert(tick.symbol.clone(), p);
        s.marks.insert(tick.symbol.clone(), tick.clone());
        s.at = Some(now);
        s.revision = revision;
        Ok(())
    }
    pub fn snapshot(&self, auth: &AuthContext, now: DateTime<Utc>) -> Result<Book, Error> {
        self.scope.authorize(auth)?;
        let s = self.state.lock().map_err(|_| Error::Unavailable)?;
        clock(s.at, now)?;
        let fills: Vec<_> = s.events.iter().map(|e| e.fill.clone()).collect();
        let mut orders = vec![];
        for (_, a) in s.advice.values() {
            if a.risk.verdict != RiskVerdict::Allow {
                continue;
            }
            let fs: Vec<_> = fills.iter().filter(|f| f.order_id == a.advice_id).collect();
            let q = fs
                .iter()
                .try_fold(Decimal::ZERO, |n, f| add(n, f.quantity))?;
            let value = fs
                .iter()
                .try_fold(Decimal::ZERO, |n, f| add(n, mul(f.quantity, f.price)?))?;
            let intended = a
                .intent
                .quantity
                .parse()
                .map_err(|_| Error::Invalid("quantity"))?;
            orders.push(Order {
                order_id: a.advice_id.clone(),
                command_id: a.advice_id.clone(),
                symbol: a.intent.symbol.clone(),
                side: a.intent.side,
                quantity: intended,
                filled_quantity: q,
                average_fill_price: if q == Decimal::ZERO {
                    None
                } else {
                    Some(value.checked_div(q).ok_or(Error::Arithmetic)?.round_dp(18))
                },
                status: if q == intended {
                    OrderStatus::Filled
                } else if q == Decimal::ZERO {
                    OrderStatus::Accepted
                } else {
                    OrderStatus::PartiallyFilled
                },
            });
        }
        orders.sort_by(|a, b| a.order_id.cmp(&b.order_id));
        let sequence = self
            .seed
            .sequence
            .checked_add(fills.len() as u64)
            .ok_or(Error::Arithmetic)?;
        let book = Book {
            source_hash: s
                .events
                .last()
                .map(|e| e.hash.clone())
                .unwrap_or_else(|| hash("quantos-x05-seed/v1", &self.seed)),
            source_ref: "shadow-virtual-ledger".into(),
            revision: s.revision,
            captured_at: now,
            seed: self.seed.clone(),
            orders,
            fills,
            positions: s.positions.values().cloned().collect(),
            ledger: totals(&s.positions, s.cash, sequence)?,
        };
        book.validate(now)?;
        Ok(book)
    }
    pub fn events(&self, auth: &AuthContext) -> Result<Vec<VirtualEvent>, Error> {
        self.scope.authorize(auth)?;
        Ok(self
            .state
            .lock()
            .map_err(|_| Error::Unavailable)?
            .events
            .clone())
    }
}
// Keep the target check in this module without any executable command conversion.
fn quantos_strategy_target_shadow() -> quantos_strategy::release::DeploymentTarget {
    quantos_strategy::release::DeploymentTarget::Shadow
}
