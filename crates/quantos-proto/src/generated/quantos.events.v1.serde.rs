impl serde::Serialize for EventEnvelope {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.metadata.is_some() {
            len += 1;
        }
        if !self.event_id.is_empty() {
            len += 1;
        }
        if self.kind != 0 {
            len += 1;
        }
        if !self.aggregate_id.is_empty() {
            len += 1;
        }
        if self.occurred_at.is_some() {
            len += 1;
        }
        if self.payload.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.events.v1.EventEnvelope", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.event_id.is_empty() {
            struct_ser.serialize_field("eventId", &self.event_id)?;
        }
        if self.kind != 0 {
            let v = crate::protojson::enum_value::<EventKind>(self.kind).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("kind", &v)?;
        }
        if !self.aggregate_id.is_empty() {
            struct_ser.serialize_field("aggregateId", &self.aggregate_id)?;
        }
        if let Some(v) = self.occurred_at.as_ref() {
            struct_ser.serialize_field("occurredAt", v)?;
        }
        if let Some(v) = self.payload.as_ref() {
            match v {
                event_envelope::Payload::DataSnapshot(v) => {
                    struct_ser.serialize_field("dataSnapshot", v)?;
                }
                event_envelope::Payload::ResearchArtifact(v) => {
                    struct_ser.serialize_field("researchArtifact", v)?;
                }
                event_envelope::Payload::Signal(v) => {
                    struct_ser.serialize_field("signal", v)?;
                }
                event_envelope::Payload::TradeProposal(v) => {
                    struct_ser.serialize_field("tradeProposal", v)?;
                }
                event_envelope::Payload::RiskDecision(v) => {
                    struct_ser.serialize_field("riskDecision", v)?;
                }
                event_envelope::Payload::TradeCommand(v) => {
                    struct_ser.serialize_field("tradeCommand", v)?;
                }
                event_envelope::Payload::Order(v) => {
                    struct_ser.serialize_field("order", v)?;
                }
                event_envelope::Payload::Fill(v) => {
                    struct_ser.serialize_field("fill", v)?;
                }
                event_envelope::Payload::Position(v) => {
                    struct_ser.serialize_field("position", v)?;
                }
            }
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for EventEnvelope {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "event_id",
            "eventId",
            "kind",
            "aggregate_id",
            "aggregateId",
            "occurred_at",
            "occurredAt",
            "data_snapshot",
            "dataSnapshot",
            "research_artifact",
            "researchArtifact",
            "signal",
            "trade_proposal",
            "tradeProposal",
            "risk_decision",
            "riskDecision",
            "trade_command",
            "tradeCommand",
            "order",
            "fill",
            "position",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            EventId,
            Kind,
            AggregateId,
            OccurredAt,
            DataSnapshot,
            ResearchArtifact,
            Signal,
            TradeProposal,
            RiskDecision,
            TradeCommand,
            Order,
            Fill,
            Position,
        }
        impl<'de> serde::Deserialize<'de> for GeneratedField {
            fn deserialize<D>(deserializer: D) -> std::result::Result<GeneratedField, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct GeneratedVisitor;

                impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
                    type Value = GeneratedField;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                        write!(formatter, "expected one of: {:?}", &FIELDS)
                    }

                    #[allow(unused_variables)]
                    fn visit_str<E>(self, value: &str) -> std::result::Result<GeneratedField, E>
                    where
                        E: serde::de::Error,
                    {
                        match value {
                            "metadata" => Ok(GeneratedField::Metadata),
                            "eventId" | "event_id" => Ok(GeneratedField::EventId),
                            "kind" => Ok(GeneratedField::Kind),
                            "aggregateId" | "aggregate_id" => Ok(GeneratedField::AggregateId),
                            "occurredAt" | "occurred_at" => Ok(GeneratedField::OccurredAt),
                            "dataSnapshot" | "data_snapshot" => Ok(GeneratedField::DataSnapshot),
                            "researchArtifact" | "research_artifact" => Ok(GeneratedField::ResearchArtifact),
                            "signal" => Ok(GeneratedField::Signal),
                            "tradeProposal" | "trade_proposal" => Ok(GeneratedField::TradeProposal),
                            "riskDecision" | "risk_decision" => Ok(GeneratedField::RiskDecision),
                            "tradeCommand" | "trade_command" => Ok(GeneratedField::TradeCommand),
                            "order" => Ok(GeneratedField::Order),
                            "fill" => Ok(GeneratedField::Fill),
                            "position" => Ok(GeneratedField::Position),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = EventEnvelope;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.events.v1.EventEnvelope")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<EventEnvelope, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut event_id__ = None;
                let mut kind__ = None;
                let mut aggregate_id__ = None;
                let mut occurred_at__ = None;
                let mut payload__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::EventId => {
                            if event_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("eventId"));
                            }
                            event_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Kind => {
                            if kind__.is_some() {
                                return Err(serde::de::Error::duplicate_field("kind"));
                            }
                            kind__ = Some(map_.next_value::<crate::protojson::OpenEnum<EventKind>>()?.value);
                        }
                        GeneratedField::AggregateId => {
                            if aggregate_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("aggregateId"));
                            }
                            aggregate_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::OccurredAt => {
                            if occurred_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("occurredAt"));
                            }
                            occurred_at__ = map_.next_value()?;
                        }
                        GeneratedField::DataSnapshot => {
                            if payload__.is_some() {
                                return Err(serde::de::Error::duplicate_field("dataSnapshot"));
                            }
                            payload__ = map_.next_value::<::std::option::Option<_>>()?.map(event_envelope::Payload::DataSnapshot)
;
                        }
                        GeneratedField::ResearchArtifact => {
                            if payload__.is_some() {
                                return Err(serde::de::Error::duplicate_field("researchArtifact"));
                            }
                            payload__ = map_.next_value::<::std::option::Option<_>>()?.map(event_envelope::Payload::ResearchArtifact)
;
                        }
                        GeneratedField::Signal => {
                            if payload__.is_some() {
                                return Err(serde::de::Error::duplicate_field("signal"));
                            }
                            payload__ = map_.next_value::<::std::option::Option<_>>()?.map(event_envelope::Payload::Signal)
;
                        }
                        GeneratedField::TradeProposal => {
                            if payload__.is_some() {
                                return Err(serde::de::Error::duplicate_field("tradeProposal"));
                            }
                            payload__ = map_.next_value::<::std::option::Option<_>>()?.map(event_envelope::Payload::TradeProposal)
;
                        }
                        GeneratedField::RiskDecision => {
                            if payload__.is_some() {
                                return Err(serde::de::Error::duplicate_field("riskDecision"));
                            }
                            payload__ = map_.next_value::<::std::option::Option<_>>()?.map(event_envelope::Payload::RiskDecision)
;
                        }
                        GeneratedField::TradeCommand => {
                            if payload__.is_some() {
                                return Err(serde::de::Error::duplicate_field("tradeCommand"));
                            }
                            payload__ = map_.next_value::<::std::option::Option<_>>()?.map(event_envelope::Payload::TradeCommand)
;
                        }
                        GeneratedField::Order => {
                            if payload__.is_some() {
                                return Err(serde::de::Error::duplicate_field("order"));
                            }
                            payload__ = map_.next_value::<::std::option::Option<_>>()?.map(event_envelope::Payload::Order)
;
                        }
                        GeneratedField::Fill => {
                            if payload__.is_some() {
                                return Err(serde::de::Error::duplicate_field("fill"));
                            }
                            payload__ = map_.next_value::<::std::option::Option<_>>()?.map(event_envelope::Payload::Fill)
;
                        }
                        GeneratedField::Position => {
                            if payload__.is_some() {
                                return Err(serde::de::Error::duplicate_field("position"));
                            }
                            payload__ = map_.next_value::<::std::option::Option<_>>()?.map(event_envelope::Payload::Position)
;
                        }
                    }
                }
                Ok(EventEnvelope {
                    metadata: metadata__,
                    event_id: event_id__.unwrap_or_default(),
                    kind: kind__.unwrap_or_default(),
                    aggregate_id: aggregate_id__.unwrap_or_default(),
                    occurred_at: occurred_at__,
                    payload: payload__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.events.v1.EventEnvelope", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for EventKind {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "EVENT_KIND_UNSPECIFIED",
            Self::DataSnapshot => "EVENT_KIND_DATA_SNAPSHOT",
            Self::ResearchArtifact => "EVENT_KIND_RESEARCH_ARTIFACT",
            Self::Signal => "EVENT_KIND_SIGNAL",
            Self::TradeProposal => "EVENT_KIND_TRADE_PROPOSAL",
            Self::RiskDecision => "EVENT_KIND_RISK_DECISION",
            Self::TradeCommand => "EVENT_KIND_TRADE_COMMAND",
            Self::Order => "EVENT_KIND_ORDER",
            Self::Fill => "EVENT_KIND_FILL",
            Self::Position => "EVENT_KIND_POSITION",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for EventKind {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "EVENT_KIND_UNSPECIFIED",
            "EVENT_KIND_DATA_SNAPSHOT",
            "EVENT_KIND_RESEARCH_ARTIFACT",
            "EVENT_KIND_SIGNAL",
            "EVENT_KIND_TRADE_PROPOSAL",
            "EVENT_KIND_RISK_DECISION",
            "EVENT_KIND_TRADE_COMMAND",
            "EVENT_KIND_ORDER",
            "EVENT_KIND_FILL",
            "EVENT_KIND_POSITION",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = EventKind;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(formatter, "expected one of: {:?}", &FIELDS)
            }

            fn visit_i64<E>(self, v: i64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Signed(v), &self)
                    })
            }

            fn visit_u64<E>(self, v: u64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                i32::try_from(v)
                    .ok()
                    .and_then(|x| x.try_into().ok())
                    .ok_or_else(|| {
                        serde::de::Error::invalid_value(serde::de::Unexpected::Unsigned(v), &self)
                    })
            }

            fn visit_str<E>(self, value: &str) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                match value {
                    "EVENT_KIND_UNSPECIFIED" => Ok(EventKind::Unspecified),
                    "EVENT_KIND_DATA_SNAPSHOT" => Ok(EventKind::DataSnapshot),
                    "EVENT_KIND_RESEARCH_ARTIFACT" => Ok(EventKind::ResearchArtifact),
                    "EVENT_KIND_SIGNAL" => Ok(EventKind::Signal),
                    "EVENT_KIND_TRADE_PROPOSAL" => Ok(EventKind::TradeProposal),
                    "EVENT_KIND_RISK_DECISION" => Ok(EventKind::RiskDecision),
                    "EVENT_KIND_TRADE_COMMAND" => Ok(EventKind::TradeCommand),
                    "EVENT_KIND_ORDER" => Ok(EventKind::Order),
                    "EVENT_KIND_FILL" => Ok(EventKind::Fill),
                    "EVENT_KIND_POSITION" => Ok(EventKind::Position),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for GetEventRequest {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.metadata.is_some() {
            len += 1;
        }
        if !self.event_id.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.events.v1.GetEventRequest", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.event_id.is_empty() {
            struct_ser.serialize_field("eventId", &self.event_id)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for GetEventRequest {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "event_id",
            "eventId",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            EventId,
        }
        impl<'de> serde::Deserialize<'de> for GeneratedField {
            fn deserialize<D>(deserializer: D) -> std::result::Result<GeneratedField, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct GeneratedVisitor;

                impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
                    type Value = GeneratedField;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                        write!(formatter, "expected one of: {:?}", &FIELDS)
                    }

                    #[allow(unused_variables)]
                    fn visit_str<E>(self, value: &str) -> std::result::Result<GeneratedField, E>
                    where
                        E: serde::de::Error,
                    {
                        match value {
                            "metadata" => Ok(GeneratedField::Metadata),
                            "eventId" | "event_id" => Ok(GeneratedField::EventId),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = GetEventRequest;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.events.v1.GetEventRequest")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<GetEventRequest, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut event_id__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::EventId => {
                            if event_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("eventId"));
                            }
                            event_id__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(GetEventRequest {
                    metadata: metadata__,
                    event_id: event_id__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.events.v1.GetEventRequest", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for GetEventResponse {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.event.is_some() {
            len += 1;
        }
        if self.metadata.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.events.v1.GetEventResponse", len)?;
        if let Some(v) = self.event.as_ref() {
            struct_ser.serialize_field("event", v)?;
        }
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for GetEventResponse {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "event",
            "metadata",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Event,
            Metadata,
        }
        impl<'de> serde::Deserialize<'de> for GeneratedField {
            fn deserialize<D>(deserializer: D) -> std::result::Result<GeneratedField, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct GeneratedVisitor;

                impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
                    type Value = GeneratedField;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                        write!(formatter, "expected one of: {:?}", &FIELDS)
                    }

                    #[allow(unused_variables)]
                    fn visit_str<E>(self, value: &str) -> std::result::Result<GeneratedField, E>
                    where
                        E: serde::de::Error,
                    {
                        match value {
                            "event" => Ok(GeneratedField::Event),
                            "metadata" => Ok(GeneratedField::Metadata),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = GetEventResponse;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.events.v1.GetEventResponse")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<GetEventResponse, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut event__ = None;
                let mut metadata__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Event => {
                            if event__.is_some() {
                                return Err(serde::de::Error::duplicate_field("event"));
                            }
                            event__ = map_.next_value()?;
                        }
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                    }
                }
                Ok(GetEventResponse {
                    event: event__,
                    metadata: metadata__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.events.v1.GetEventResponse", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for ListEventsRequest {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.metadata.is_some() {
            len += 1;
        }
        if !self.aggregate_id.is_empty() {
            len += 1;
        }
        if !self.correlation_id.is_empty() {
            len += 1;
        }
        if self.kind != 0 {
            len += 1;
        }
        if self.start_at.is_some() {
            len += 1;
        }
        if self.end_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.events.v1.ListEventsRequest", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.aggregate_id.is_empty() {
            struct_ser.serialize_field("aggregateId", &self.aggregate_id)?;
        }
        if !self.correlation_id.is_empty() {
            struct_ser.serialize_field("correlationId", &self.correlation_id)?;
        }
        if self.kind != 0 {
            let v = crate::protojson::enum_value::<EventKind>(self.kind).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("kind", &v)?;
        }
        if let Some(v) = self.start_at.as_ref() {
            struct_ser.serialize_field("startAt", v)?;
        }
        if let Some(v) = self.end_at.as_ref() {
            struct_ser.serialize_field("endAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for ListEventsRequest {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "aggregate_id",
            "aggregateId",
            "correlation_id",
            "correlationId",
            "kind",
            "start_at",
            "startAt",
            "end_at",
            "endAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            AggregateId,
            CorrelationId,
            Kind,
            StartAt,
            EndAt,
        }
        impl<'de> serde::Deserialize<'de> for GeneratedField {
            fn deserialize<D>(deserializer: D) -> std::result::Result<GeneratedField, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct GeneratedVisitor;

                impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
                    type Value = GeneratedField;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                        write!(formatter, "expected one of: {:?}", &FIELDS)
                    }

                    #[allow(unused_variables)]
                    fn visit_str<E>(self, value: &str) -> std::result::Result<GeneratedField, E>
                    where
                        E: serde::de::Error,
                    {
                        match value {
                            "metadata" => Ok(GeneratedField::Metadata),
                            "aggregateId" | "aggregate_id" => Ok(GeneratedField::AggregateId),
                            "correlationId" | "correlation_id" => Ok(GeneratedField::CorrelationId),
                            "kind" => Ok(GeneratedField::Kind),
                            "startAt" | "start_at" => Ok(GeneratedField::StartAt),
                            "endAt" | "end_at" => Ok(GeneratedField::EndAt),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = ListEventsRequest;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.events.v1.ListEventsRequest")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<ListEventsRequest, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut aggregate_id__ = None;
                let mut correlation_id__ = None;
                let mut kind__ = None;
                let mut start_at__ = None;
                let mut end_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::AggregateId => {
                            if aggregate_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("aggregateId"));
                            }
                            aggregate_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::CorrelationId => {
                            if correlation_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("correlationId"));
                            }
                            correlation_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Kind => {
                            if kind__.is_some() {
                                return Err(serde::de::Error::duplicate_field("kind"));
                            }
                            kind__ = Some(map_.next_value::<crate::protojson::OpenEnum<EventKind>>()?.value);
                        }
                        GeneratedField::StartAt => {
                            if start_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("startAt"));
                            }
                            start_at__ = map_.next_value()?;
                        }
                        GeneratedField::EndAt => {
                            if end_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("endAt"));
                            }
                            end_at__ = map_.next_value()?;
                        }
                    }
                }
                Ok(ListEventsRequest {
                    metadata: metadata__,
                    aggregate_id: aggregate_id__.unwrap_or_default(),
                    correlation_id: correlation_id__.unwrap_or_default(),
                    kind: kind__.unwrap_or_default(),
                    start_at: start_at__,
                    end_at: end_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.events.v1.ListEventsRequest", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for ListEventsResponse {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.events.is_empty() {
            len += 1;
        }
        if self.metadata.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.events.v1.ListEventsResponse", len)?;
        if !self.events.is_empty() {
            struct_ser.serialize_field("events", &self.events)?;
        }
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for ListEventsResponse {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "events",
            "metadata",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Events,
            Metadata,
        }
        impl<'de> serde::Deserialize<'de> for GeneratedField {
            fn deserialize<D>(deserializer: D) -> std::result::Result<GeneratedField, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                struct GeneratedVisitor;

                impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
                    type Value = GeneratedField;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                        write!(formatter, "expected one of: {:?}", &FIELDS)
                    }

                    #[allow(unused_variables)]
                    fn visit_str<E>(self, value: &str) -> std::result::Result<GeneratedField, E>
                    where
                        E: serde::de::Error,
                    {
                        match value {
                            "events" => Ok(GeneratedField::Events),
                            "metadata" => Ok(GeneratedField::Metadata),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = ListEventsResponse;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.events.v1.ListEventsResponse")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<ListEventsResponse, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut events__ = None;
                let mut metadata__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Events => {
                            if events__.is_some() {
                                return Err(serde::de::Error::duplicate_field("events"));
                            }
                            events__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                    }
                }
                Ok(ListEventsResponse {
                    events: events__.unwrap_or_default(),
                    metadata: metadata__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.events.v1.ListEventsResponse", FIELDS, GeneratedVisitor)
    }
}
