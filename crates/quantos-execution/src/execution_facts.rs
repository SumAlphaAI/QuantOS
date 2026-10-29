//! X04 immutable per-command read projection from actual OMS observations.
//! The scoped chain is derived from the gateway journal, whose original hashes
//! are retained separately. Neither hash chain nor this DTO grants execution.
use crate::{
    assisted::{Error, Subject},
    gateway::{ExecutionGateway, ExecutionKernel, GatewayFill, GatewayOrder},
    oms::{FactAnchor, OrderFact},
};
use chrono::{DateTime, Utc};
use quantos_core::{CommandId, ContentHash, ProposalId, canonical_json_bytes};
use serde::{Deserialize, Serialize};
use serde_json::json;
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct CommandFacts {
    facts: Vec<OrderFact>,
    anchor: FactAnchor,
    source_hashes: Vec<ContentHash>,
    order: GatewayOrder,
    fills: Vec<GatewayFill>,
}
impl CommandFacts {
    pub(crate) fn capture<K: ExecutionKernel>(
        gateway: &ExecutionGateway<K>,
        command: CommandId,
    ) -> Result<Option<Self>, Error> {
        let original = gateway
            .facts()
            .iter()
            .filter(|f| f.command_id == command.to_string())
            .collect::<Vec<_>>();
        if original.len() > 20002 {
            return Err(Error::Unavailable);
        }
        if original.is_empty() {
            return Ok(None);
        }
        let mut facts = vec![];
        for f in &original {
            facts.push(OrderFact::next(
                &facts,
                &f.order_id,
                &f.command_id,
                f.content.clone(),
            ));
        }
        let anchor = FactAnchor {
            count: facts.len() as u64,
            head: facts.last().map(|f| f.hash.clone()),
        };
        let replay = ExecutionGateway::<crate::gateway::NautilusBoundaryAdapter>::replay_facts(
            &facts, &anchor,
        )
        .map_err(|_| Error::Unavailable)?;
        let order = replay
            .order(&facts[0].order_id)
            .ok_or(Error::Unavailable)?
            .clone();
        if gateway.order(&order.order_id) != Some(&order) {
            return Err(Error::Unavailable);
        }
        let fills = replay.fills().to_vec();
        if fills.len() > 10000 {
            return Err(Error::Unavailable);
        }
        if gateway
            .fills()
            .iter()
            .filter(|f| f.command_id == command.to_string())
            .cloned()
            .collect::<Vec<_>>()
            != fills
        {
            return Err(Error::Unavailable);
        }
        Ok(Some(Self {
            facts,
            anchor,
            source_hashes: original.iter().map(|f| f.hash.clone()).collect(),
            order,
            fills,
        }))
    }
    pub(crate) fn validate(
        &self,
        subject: &Subject,
        command: CommandId,
        order: Option<&GatewayOrder>,
    ) -> Result<(), Error> {
        let replay = ExecutionGateway::<crate::gateway::NautilusBoundaryAdapter>::replay_facts(
            &self.facts,
            &self.anchor,
        )
        .map_err(|_| Error::Unavailable)?;
        if self.facts.len() > 20002
            || self.fills.len() > 10000
            || self.facts.is_empty()
            || self.source_hashes.len() != self.facts.len()
            || self
                .facts
                .iter()
                .any(|f| f.command_id != command.to_string() || f.order_id != self.order.order_id)
            || replay.order(&self.order.order_id) != Some(&self.order)
            || replay.fills() != self.fills
            || order != Some(&self.order)
            || self.order.command_id != command.to_string()
            || self.order.account_id != subject.scope.account.to_string()
            || self.order.symbol != subject.symbol
            || self.order.side != subject.side.as_str()
            || self.order.quantity != subject.quantity
        {
            return Err(Error::Unavailable);
        }
        Ok(())
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ObservedOrder {
    pub order_id: String,
    pub command_id: CommandId,
    pub account_id: quantos_core::AccountId,
    pub symbol: String,
    pub side: String,
    pub quantity: String,
    pub filled_quantity: String,
    pub average_fill_price: Option<String>,
    pub status: String,
    pub submitted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ObservedFill {
    pub fill_id: String,
    pub order_id: String,
    pub command_id: CommandId,
    pub account_id: quantos_core::AccountId,
    pub symbol: String,
    pub side: String,
    pub quantity: String,
    pub price: String,
    pub fee_currency: String,
    pub fee_amount: String,
    pub filled_at: DateTime<Utc>,
    pub fact_hash: ContentHash,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExecutionFacts {
    pub schema_version: String,
    pub request_id: ProposalId,
    pub subject_hash: ContentHash,
    pub tenant_id: quantos_core::TenantId,
    pub workspace_id: quantos_core::WorkspaceId,
    pub account_id: quantos_core::AccountId,
    pub command_id: CommandId,
    pub decision_id: quantos_core::DecisionId,
    pub proposal_hash: ContentHash,
    pub quote_currency: String,
    pub outcome: String,
    pub journal_available: bool,
    pub consumer_ready: bool,
    pub reason: String,
    pub order: Option<ObservedOrder>,
    pub fills: Vec<ObservedFill>,
    pub fact_hashes: Vec<ContentHash>,
    pub native_source_hashes: Vec<ContentHash>,
    pub source_hash: ContentHash,
    pub recorded_at: DateTime<Utc>,
    pub execution_authority: bool,
}
impl ExecutionFacts {
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn project(
        subject: &Subject,
        request: ProposalId,
        hash: ContentHash,
        command: CommandId,
        outcome: &str,
        at: DateTime<Utc>,
        e: Option<&CommandFacts>,
    ) -> Result<Self, Error> {
        let quote_fees = e.is_none_or(|e| {
            e.fills
                .iter()
                .all(|f| f.fee_currency == subject.quote_currency)
        });
        let ready = outcome == "accepted" && e.is_some() && quote_fees;
        let mut v = Self {
            schema_version: "quantos-native-execution-facts.v1".into(),
            request_id: request,
            subject_hash: hash,
            tenant_id: subject.scope.tenant,
            workspace_id: subject.scope.workspace,
            account_id: subject.scope.account,
            command_id: command,
            decision_id: subject.decision,
            proposal_hash: subject.proposal_hash.clone(),
            quote_currency: subject.quote_currency.clone(),
            outcome: outcome.into(),
            journal_available: e.is_some(),
            consumer_ready: ready,
            reason: if outcome == "unknown" {
                "OUTCOME_UNRESOLVED"
            } else if e.is_none() {
                "JOURNAL_UNAVAILABLE"
            } else if !quote_fees {
                "FEE_CONVERSION_REQUIRED"
            } else {
                "OBSERVED_NATIVE_FACTS"
            }
            .into(),
            order: e.map(|e| ObservedOrder {
                order_id: e.order.order_id.clone(),
                command_id: command,
                account_id: subject.scope.account,
                symbol: e.order.symbol.clone(),
                side: e.order.side.clone(),
                quantity: e.order.quantity.clone(),
                filled_quantity: e.order.filled_quantity.clone(),
                average_fill_price: e.order.average_fill_price.clone(),
                status: e.order.status.clone(),
                submitted_at: e.order.submitted_at,
                updated_at: e.order.updated_at,
            }),
            fills: vec![],
            fact_hashes: e
                .map(|e| e.facts.iter().map(|f| f.hash.clone()).collect())
                .unwrap_or_default(),
            native_source_hashes: e.map(|e| e.source_hashes.clone()).unwrap_or_default(),
            source_hash: ContentHash::sha256_bytes(b"pending"),
            recorded_at: e.map(|e| e.order.updated_at.max(at)).unwrap_or(at),
            execution_authority: false,
        };
        if let Some(e) = e {
            for f in &e.fills {
                let fact=e.facts.iter().find(|fact|matches!(&fact.content,crate::oms::FactKind::Kernel {event:crate::gateway::KernelEvent::OrderFilled {venue_fill_id,..}} if f.venue_fill_id.as_ref()==Some(venue_fill_id))).ok_or(Error::Unavailable)?;
                v.fills.push(ObservedFill {
                    fill_id: f.fill_id.clone(),
                    order_id: f.order_id.clone(),
                    command_id: command,
                    account_id: subject.scope.account,
                    symbol: f.symbol.clone(),
                    side: subject.side.as_str().into(),
                    quantity: f.quantity.clone(),
                    price: f.price.clone(),
                    fee_currency: f.fee_currency.clone(),
                    fee_amount: f.fee_amount.clone(),
                    filled_at: f.filled_at,
                    fact_hash: fact.hash.clone(),
                });
            }
        }
        let mut body = serde_json::to_value(&v).map_err(|_| Error::Unavailable)?;
        body.as_object_mut()
            .ok_or(Error::Unavailable)?
            .remove("sourceHash");
        v.source_hash = ContentHash::sha256_bytes(
            &canonical_json_bytes(&json!(["quantos-native-execution-source/v1", body]))
                .map_err(|_| Error::Unavailable)?,
        );
        Ok(v)
    }
}
