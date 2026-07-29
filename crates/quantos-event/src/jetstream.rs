use std::time::Duration;

use async_nats::{
    HeaderMap,
    header::NATS_MESSAGE_ID,
    jetstream::{
        self,
        consumer::{self, AckPolicy, DeliverPolicy, PullConsumer, ReplayPolicy},
        message::{AckKind, PublishMessage},
        stream::{self, RetentionPolicy, StorageType},
    },
};
use bytes::Bytes;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::runtime::{Builder, Runtime};

use crate::{RecordedEvent, pg::PgEventStore};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JetStreamConfig {
    pub server_url: String,
    pub stream_name: String,
    pub subject_prefix: String,
    pub durable_prefix: String,
    pub max_messages: i64,
    pub max_bytes: i64,
    pub duplicate_window: Duration,
    pub ack_wait: Duration,
    pub max_deliver: i64,
}

impl Default for JetStreamConfig {
    fn default() -> Self {
        Self {
            server_url: "nats://127.0.0.1:4222".to_owned(),
            stream_name: "QUANTOS_EVENTS".to_owned(),
            subject_prefix: "quantos.events".to_owned(),
            durable_prefix: "quantos".to_owned(),
            max_messages: 1_000_000,
            max_bytes: 1024 * 1024 * 256,
            duplicate_window: Duration::from_secs(120),
            ack_wait: Duration::from_secs(30),
            max_deliver: 5,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JetStreamEnvelope {
    pub subject: String,
    pub topic: String,
    pub event: RecordedEvent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct DispatchReport {
    pub dispatched: usize,
    pub dead_lettered: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct ConsumeReport {
    pub processed: usize,
    pub dead_lettered: usize,
    pub retried: usize,
}

#[derive(Debug, Error)]
pub enum JetStreamAdapterError {
    #[error(transparent)]
    Runtime(#[from] std::io::Error),
    #[error(transparent)]
    Connect(#[from] async_nats::ConnectError),
    #[error(transparent)]
    Message(#[from] async_nats::Error),
    #[error("JetStream operation failed: {0}")]
    JetStream(String),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Store(#[from] crate::pg::PgEventStoreError),
}

pub struct JetStreamAdapter {
    runtime: Runtime,
    context: jetstream::Context,
    config: JetStreamConfig,
}

impl JetStreamAdapter {
    pub fn connect(config: JetStreamConfig) -> Result<Self, JetStreamAdapterError> {
        let runtime = Builder::new_multi_thread().enable_all().build()?;
        let client = runtime.block_on(async_nats::connect(config.server_url.clone()))?;
        let context = jetstream::new(client);
        let adapter = Self {
            runtime,
            context,
            config,
        };
        adapter.ensure_stream()?;
        Ok(adapter)
    }

    pub fn ensure_stream(&self) -> Result<(), JetStreamAdapterError> {
        let config = stream::Config {
            name: self.config.stream_name.clone(),
            max_messages: self.config.max_messages,
            max_bytes: self.config.max_bytes,
            duplicate_window: self.config.duplicate_window,
            subjects: vec![format!("{}.>", self.config.subject_prefix)],
            retention: RetentionPolicy::WorkQueue,
            storage: StorageType::File,
            ..Default::default()
        };
        self.runtime
            .block_on(self.context.get_or_create_stream(config))
            .map_err(|error| JetStreamAdapterError::JetStream(error.to_string()))?;
        Ok(())
    }

    pub fn delete_stream(&self) -> Result<(), JetStreamAdapterError> {
        self.runtime
            .block_on(self.context.delete_stream(&self.config.stream_name))
            .map_err(|error| JetStreamAdapterError::JetStream(error.to_string()))?;
        Ok(())
    }

    pub fn publish_recorded_event(
        &self,
        topic: &str,
        event: &RecordedEvent,
    ) -> Result<String, JetStreamAdapterError> {
        let envelope = JetStreamEnvelope {
            subject: self.subject_for_topic(topic),
            topic: topic.to_owned(),
            event: event.clone(),
        };
        let payload = Bytes::from(serde_json::to_vec(&envelope)?);

        let mut headers = HeaderMap::new();
        headers.insert("x-quantos-correlation-id", event.correlation_id.to_string());
        headers.insert("x-quantos-tenant-id", event.tenant_id.to_string());
        headers.insert("x-quantos-topic", topic);
        headers.insert("x-quantos-event-id", event.event_id.to_string());
        headers.insert(NATS_MESSAGE_ID, event.event_id.to_string());

        self.runtime.block_on(async {
            self.context
                .send_publish(
                    envelope.subject.clone(),
                    PublishMessage::build()
                        .payload(payload)
                        .headers(headers)
                        .message_id(event.event_id.to_string()),
                )
                .await
                .map_err(|error| JetStreamAdapterError::JetStream(error.to_string()))?
                .await
                .map_err(|error| JetStreamAdapterError::JetStream(error.to_string()))
        })?;

        Ok(envelope.subject)
    }

    pub fn dispatch_pending_outbox(
        &self,
        store: &mut PgEventStore,
        limit: i64,
        max_attempts: u32,
        observed_at: DateTime<Utc>,
    ) -> Result<DispatchReport, JetStreamAdapterError> {
        let mut report = DispatchReport::default();
        let pending = store.pending_outbox(limit)?;

        for entry in pending {
            match self.publish_recorded_event(&entry.outbox.topic, &entry.event) {
                Ok(_) => {
                    store.mark_outbox_dispatched(entry.outbox.outbox_entry_id, observed_at)?;
                    report.dispatched += 1;
                }
                Err(error) => {
                    let dead_lettered = store.record_outbox_failure(
                        entry.outbox.outbox_entry_id,
                        &error.to_string(),
                        max_attempts,
                        observed_at,
                    )?;
                    if dead_lettered {
                        report.dead_lettered += 1;
                    }
                }
            }
        }

        Ok(report)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn consume_into_inbox<F>(
        &self,
        store: &mut PgEventStore,
        durable_name: &str,
        consumer_name: &str,
        batch: usize,
        max_attempts: u32,
        observed_at: DateTime<Utc>,
        mut handler: F,
    ) -> Result<ConsumeReport, JetStreamAdapterError>
    where
        F: FnMut(&RecordedEvent) -> Result<(), String>,
    {
        let consumer = self.get_or_create_pull_consumer(durable_name)?;
        let mut messages = self
            .runtime
            .block_on(consumer.fetch().max_messages(batch).messages())
            .map_err(|error| JetStreamAdapterError::JetStream(error.to_string()))?;
        let mut report = ConsumeReport::default();

        self.runtime.block_on(async {
            use futures_util::StreamExt;

            while let Some(message) = messages.next().await {
                let message = message?;
                let envelope: JetStreamEnvelope = serde_json::from_slice(&message.payload)?;

                match handler(&envelope.event) {
                    Ok(()) => {
                        store.record_inbox_success(consumer_name, &envelope.event, observed_at)?;
                        message.ack().await?;
                        report.processed += 1;
                    }
                    Err(detail) => {
                        let outcome = store.record_inbox_failure(
                            consumer_name,
                            &envelope.event,
                            &detail,
                            max_attempts,
                            observed_at,
                        )?;
                        if outcome.dead_lettered {
                            message.ack_with(AckKind::Term).await?;
                            report.dead_lettered += 1;
                        } else {
                            message.ack_with(AckKind::Nak(None)).await?;
                            report.retried += 1;
                        }
                    }
                }
            }

            Ok::<(), JetStreamAdapterError>(())
        })?;

        Ok(report)
    }

    pub fn subject_for_topic(&self, topic: &str) -> String {
        format!("{}.{}", self.config.subject_prefix, topic)
    }

    fn get_or_create_pull_consumer(
        &self,
        durable_name: &str,
    ) -> Result<PullConsumer, JetStreamAdapterError> {
        let stream = self
            .runtime
            .block_on(self.context.get_or_create_stream(stream::Config {
                name: self.config.stream_name.clone(),
                subjects: vec![format!("{}.>", self.config.subject_prefix)],
                retention: RetentionPolicy::WorkQueue,
                storage: StorageType::File,
                duplicate_window: self.config.duplicate_window,
                max_messages: self.config.max_messages,
                max_bytes: self.config.max_bytes,
                ..Default::default()
            }))
            .map_err(|error| JetStreamAdapterError::JetStream(error.to_string()))?;

        let durable = format!("{}-{}", self.config.durable_prefix, durable_name);
        let config = consumer::pull::Config {
            durable_name: Some(durable.clone()),
            ack_policy: AckPolicy::Explicit,
            ack_wait: self.config.ack_wait,
            max_deliver: self.config.max_deliver,
            deliver_policy: DeliverPolicy::All,
            replay_policy: ReplayPolicy::Instant,
            filter_subject: format!("{}.>", self.config.subject_prefix),
            ..Default::default()
        };

        self.runtime
            .block_on(stream.get_or_create_consumer(&durable, config))
            .map_err(|error| JetStreamAdapterError::JetStream(error.to_string()))
    }
}
