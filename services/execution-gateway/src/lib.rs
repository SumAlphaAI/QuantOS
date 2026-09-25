//! Trusted in-process TradeCommand boundary. A future authenticated command
//! ingress can call this service; no public order endpoint is exposed here.

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Utc};
use quantos_auth::ExecutionSecretStore;
use quantos_execution::{
    TradeCommand,
    gateway::{ExecutionGateway, ExecutionKernel, SubmissionReceipt},
};
use uuid::Uuid;

pub trait CommandSecretResolver {
    fn permits(
        &mut self,
        session_token_hash: &str,
        secret_name: &str,
        command_expires_at: DateTime<Utc>,
        command_account_id: Uuid,
    ) -> Result<bool>;
}

impl CommandSecretResolver for ExecutionSecretStore {
    fn permits(
        &mut self,
        session_token_hash: &str,
        secret_name: &str,
        command_expires_at: DateTime<Utc>,
        command_account_id: Uuid,
    ) -> Result<bool> {
        // Never log or serialize the returned plaintext. A venue adapter will
        // need a separate, credential-bearing interface before live trading.
        Ok(self
            .resolve_for_command(
                session_token_hash,
                secret_name,
                command_expires_at,
                command_account_id,
            )?
            .is_some())
    }
}

pub struct ExecutionCommandService<K: ExecutionKernel, R: CommandSecretResolver> {
    gateway: ExecutionGateway<K>,
    resolver: R,
    secret_name: String,
}

impl<K: ExecutionKernel, R: CommandSecretResolver> ExecutionCommandService<K, R> {
    pub fn new(gateway: ExecutionGateway<K>, resolver: R, secret_name: String) -> Self {
        Self {
            gateway,
            resolver,
            secret_name,
        }
    }

    pub fn submit(
        &mut self,
        command: &TradeCommand,
        session_token_hash: &str,
        now: DateTime<Utc>,
    ) -> Result<SubmissionReceipt> {
        self.gateway.validate_command(command, now)?;
        let account_id = Uuid::parse_str(&command.account_id)
            .context("TradeCommand account_id must be a UUID")?;
        if !self.resolver.permits(
            session_token_hash,
            &self.secret_name,
            command.expires_at,
            account_id,
        )? {
            bail!("TradeCommand service session or secret reference denied");
        }
        Ok(self.gateway.submit(command, now)?)
    }

    pub fn downstream_submission_count(&self) -> usize {
        self.gateway.downstream_submission_count()
    }
}

#[cfg(test)]
mod tests {
    use std::{cell::Cell, rc::Rc};

    use chrono::Duration;
    use quantos_core::{CommandId, ContentHash, DecisionId};
    use quantos_execution::{
        OrderIntent, OrderSide, VenueKind,
        gateway::{GatewayLimits, PaperKernel},
    };
    use rust_decimal::Decimal;

    use super::*;

    struct Resolver {
        allow: bool,
        calls: Rc<Cell<u32>>,
    }

    impl CommandSecretResolver for Resolver {
        fn permits(&mut self, _: &str, _: &str, _: DateTime<Utc>, _: Uuid) -> Result<bool> {
            self.calls.set(self.calls.get() + 1);
            Ok(self.allow)
        }
    }

    fn fixture(now: DateTime<Utc>) -> TradeCommand {
        TradeCommand {
            command_id: CommandId::new(),
            decision_id: DecisionId::new(),
            account_id: Uuid::new_v4().to_string(),
            venue: "paper-venue".to_owned(),
            venue_kind: VenueKind::Cex,
            symbol: "BTCUSDT".to_owned(),
            intent: OrderIntent::Limit,
            side: OrderSide::Buy,
            quantity: "1".to_owned(),
            limit_price: Some("100".to_owned()),
            stop_price: None,
            idempotency_key: "f06-command".to_owned(),
            approval_signature: None,
            expires_at: now + Duration::minutes(2),
            signature: ContentHash::sha256_bytes(b"f06-test-command"),
            issued_at: now,
        }
    }

    #[test]
    fn expired_and_denied_commands_never_reach_kernel() {
        let now = Utc::now();
        let calls = Rc::new(Cell::new(0));
        let resolver = Resolver {
            allow: false,
            calls: Rc::clone(&calls),
        };
        let gateway = ExecutionGateway::new(
            GatewayLimits {
                max_quantity: Decimal::new(10, 0),
                max_notional: Decimal::new(1000, 0),
                allowed_venues: vec!["paper-venue".to_owned()],
            },
            PaperKernel::new("100"),
        );
        let mut service = ExecutionCommandService::new(gateway, resolver, "venue.paper".to_owned());
        let mut command = fixture(now);
        command.expires_at = now - Duration::seconds(1);
        assert!(service.submit(&command, "hash", now).is_err());
        assert_eq!(calls.get(), 0);
        command.expires_at = now + Duration::minutes(2);
        assert!(service.submit(&command, "hash", now).is_err());
        assert_eq!(calls.get(), 1);
        assert_eq!(service.downstream_submission_count(), 0);
    }

    #[test]
    fn allowed_command_submits_once_and_replay_rechecks_session() {
        let now = Utc::now();
        let calls = Rc::new(Cell::new(0));
        let resolver = Resolver {
            allow: true,
            calls: Rc::clone(&calls),
        };
        let gateway = ExecutionGateway::new(
            GatewayLimits {
                max_quantity: Decimal::new(10, 0),
                max_notional: Decimal::new(1000, 0),
                allowed_venues: vec!["paper-venue".to_owned()],
            },
            PaperKernel::new("100"),
        );
        let mut service = ExecutionCommandService::new(gateway, resolver, "venue.paper".to_owned());
        let command = fixture(now);
        assert!(!service.submit(&command, "hash", now).unwrap().replayed);
        assert!(service.submit(&command, "hash", now).unwrap().replayed);
        assert_eq!(calls.get(), 2);
        assert_eq!(service.downstream_submission_count(), 1);
    }
}
