//! Authenticated X03 downstream consumption. Legacy TradeCommand is a private
//! compatibility representation inside this verified transaction, never ingress.
use crate::{
    OrderIntent, OrderSide, TradeCommand, VenueKind,
    authority::{AtomicCommandIssuer, CommandError, CurrentSources, SignedCommand},
    gateway::{
        ExecutionGateway, ExecutionKernel, GatewayError, GatewayFill, GatewayLimits, GatewayOrder,
        SubmissionReceipt,
    },
};
use chrono::{DateTime, Utc};
use quantos_auth::AuthContext;
use quantos_core::{CommandId, ContentHash, canonical_json_bytes};
use quantos_risk::guard::{GuardError, Side};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DispatchError {
    #[error(transparent)]
    Command(#[from] CommandError),
    #[error(transparent)]
    Gateway(#[from] GatewayError),
    #[error("dispatch state unavailable or invalid configuration")]
    Unavailable,
}
impl From<GuardError> for DispatchError {
    fn from(error: GuardError) -> Self {
        Self::Command(CommandError::Risk(error))
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DispatchReceipt {
    pub submission: SubmissionReceipt,
    pub order: GatewayOrder,
    pub fills: Vec<GatewayFill>,
}
/// Clones share downstream dedupe and event projection. Local memory only.
/// Lock order: downstream -> issuer -> risk -> bounded kernel I/O. Never reenter.
pub struct SignedExecutionGateway<K: ExecutionKernel> {
    consumer: CommandId,
    issuer: AtomicCommandIssuer,
    gateway: Arc<Mutex<ExecutionGateway<K>>>,
}
impl<K: ExecutionKernel> Clone for SignedExecutionGateway<K> {
    fn clone(&self) -> Self {
        Self {
            consumer: self.consumer,
            issuer: self.issuer.clone(),
            gateway: Arc::clone(&self.gateway),
        }
    }
}
impl<K: ExecutionKernel> SignedExecutionGateway<K> {
    pub fn new(
        issuer: AtomicCommandIssuer,
        limits: GatewayLimits,
        kernel: K,
    ) -> Result<Self, DispatchError> {
        if limits.max_quantity <= rust_decimal::Decimal::ZERO
            || limits.max_notional <= rust_decimal::Decimal::ZERO
            || limits.allowed_venues.is_empty()
        {
            return Err(DispatchError::Unavailable);
        }
        Ok(Self {
            consumer: CommandId::new(),
            issuer,
            gateway: Arc::new(Mutex::new(ExecutionGateway::new(limits, kernel))),
        })
    }
    pub fn submit(
        &self,
        auth: &AuthContext,
        command: &SignedCommand,
        sources: CurrentSources<'_>,
        now: DateTime<Utc>,
    ) -> Result<DispatchReceipt, DispatchError> {
        let mut gateway = self
            .gateway
            .lock()
            .map_err(|_| DispatchError::Unavailable)?;
        let payload = serde_json::to_value(command).map_err(|_| DispatchError::Unavailable)?;
        let bytes = canonical_json_bytes(&payload).map_err(|_| DispatchError::Unavailable)?;
        let internal = TradeCommand {
            command_id: command.command_id,
            decision_id: command.source_decision_id,
            account_id: command.intent.account_id.to_string(),
            venue: command.venue.clone(),
            venue_kind: VenueKind::Cex,
            symbol: command.intent.symbol.clone(),
            intent: OrderIntent::Limit,
            side: match command.intent.side {
                Side::Buy => OrderSide::Buy,
                Side::Sell => OrderSide::Sell,
            },
            quantity: command.intent.quantity.clone(),
            limit_price: Some(command.intent.limit_price.clone()),
            stop_price: None,
            // Preserve scoped dedupe without forwarding tenant/workspace or caller key bytes.
            // Canonical structured input prevents delimiter ambiguity; domain separates this key.
            idempotency_key: ContentHash::sha256_bytes(
                &canonical_json_bytes(&serde_json::json!([
                    "quantos-signed-dispatch-idempotency/v1",
                    command.tenant_id,
                    command.workspace_id,
                    command.intent.account_id,
                    command.intent.command_key
                ]))
                .map_err(|_| DispatchError::Unavailable)?,
            )
            .to_string(),
            approval_signature: None,
            issued_at: command.issued_at,
            expires_at: command.expires_at,
            signature: ContentHash::sha256_bytes(&bytes),
        };
        gateway.validate_command(&internal, now)?;
        self.issuer
            .with_current_command(self.consumer, auth, command, sources, now, || {
                let submission = gateway.submit(&internal, now)?;
                gateway.try_collect_events()?;
                let order = gateway
                    .order(&submission.order_id)
                    .cloned()
                    .ok_or(DispatchError::Unavailable)?;
                let fills = gateway
                    .fills()
                    .iter()
                    .filter(|f| f.order_id == submission.order_id)
                    .cloned()
                    .collect();
                Ok(DispatchReceipt {
                    submission,
                    order,
                    fills,
                })
            })
    }
    /// Cancel only an authenticated, issuer-bound order owned by this consumer.
    /// The caller supplies a stable request key for transport-safe replay.
    pub fn cancel(
        &self,
        auth: &AuthContext,
        command: &SignedCommand,
        key: &str,
        now: DateTime<Utc>,
    ) -> Result<crate::oms::CancelAudit, DispatchError> {
        let mut gateway = self
            .gateway
            .lock()
            .map_err(|_| DispatchError::Unavailable)?;
        self.issuer
            .with_order_control(self.consumer, auth, command, now, || {
                Ok(gateway.cancel(&command.command_id.to_string(), key, now)?)
            })
    }
    pub fn order_history(
        &self,
        auth: &AuthContext,
        command: &SignedCommand,
        now: DateTime<Utc>,
    ) -> Result<Vec<crate::oms::OrderFact>, DispatchError> {
        let gateway = self
            .gateway
            .lock()
            .map_err(|_| DispatchError::Unavailable)?;
        self.issuer
            .with_order_control(self.consumer, auth, command, now, || {
                Ok(gateway
                    .facts()
                    .iter()
                    .filter(|f| f.command_id == command.command_id.to_string())
                    .cloned()
                    .collect())
            })
    }
    pub fn downstream_cancel_count(&self) -> Option<usize> {
        self.gateway
            .lock()
            .ok()
            .map(|g| g.downstream_cancel_count())
    }
    #[must_use]
    pub fn downstream_submission_count(&self) -> Option<usize> {
        self.gateway
            .lock()
            .ok()
            .map(|g| g.downstream_submission_count())
    }
}
