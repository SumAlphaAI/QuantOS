impl serde::Serialize for ActorKind {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "ACTOR_KIND_UNSPECIFIED",
            Self::User => "ACTOR_KIND_USER",
            Self::Service => "ACTOR_KIND_SERVICE",
            Self::Automation => "ACTOR_KIND_AUTOMATION",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for ActorKind {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "ACTOR_KIND_UNSPECIFIED",
            "ACTOR_KIND_USER",
            "ACTOR_KIND_SERVICE",
            "ACTOR_KIND_AUTOMATION",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = ActorKind;

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
                    "ACTOR_KIND_UNSPECIFIED" => Ok(ActorKind::Unspecified),
                    "ACTOR_KIND_USER" => Ok(ActorKind::User),
                    "ACTOR_KIND_SERVICE" => Ok(ActorKind::Service),
                    "ACTOR_KIND_AUTOMATION" => Ok(ActorKind::Automation),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for ActorRef {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.actor_id.is_empty() {
            len += 1;
        }
        if self.actor_kind != 0 {
            len += 1;
        }
        if !self.display_name.is_empty() {
            len += 1;
        }
        if !self.capabilities.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.ActorRef", len)?;
        if !self.actor_id.is_empty() {
            struct_ser.serialize_field("actorId", &self.actor_id)?;
        }
        if self.actor_kind != 0 {
            let v = crate::protojson::enum_value::<ActorKind>(self.actor_kind).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("actorKind", &v)?;
        }
        if !self.display_name.is_empty() {
            struct_ser.serialize_field("displayName", &self.display_name)?;
        }
        if !self.capabilities.is_empty() {
            struct_ser.serialize_field("capabilities", &self.capabilities)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for ActorRef {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "actor_id",
            "actorId",
            "actor_kind",
            "actorKind",
            "display_name",
            "displayName",
            "capabilities",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            ActorId,
            ActorKind,
            DisplayName,
            Capabilities,
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
                            "actorId" | "actor_id" => Ok(GeneratedField::ActorId),
                            "actorKind" | "actor_kind" => Ok(GeneratedField::ActorKind),
                            "displayName" | "display_name" => Ok(GeneratedField::DisplayName),
                            "capabilities" => Ok(GeneratedField::Capabilities),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = ActorRef;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.ActorRef")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<ActorRef, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut actor_id__ = None;
                let mut actor_kind__ = None;
                let mut display_name__ = None;
                let mut capabilities__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::ActorId => {
                            if actor_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("actorId"));
                            }
                            actor_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::ActorKind => {
                            if actor_kind__.is_some() {
                                return Err(serde::de::Error::duplicate_field("actorKind"));
                            }
                            actor_kind__ = Some(map_.next_value::<crate::protojson::OpenEnum<ActorKind>>()?.value);
                        }
                        GeneratedField::DisplayName => {
                            if display_name__.is_some() {
                                return Err(serde::de::Error::duplicate_field("displayName"));
                            }
                            display_name__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Capabilities => {
                            if capabilities__.is_some() {
                                return Err(serde::de::Error::duplicate_field("capabilities"));
                            }
                            capabilities__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(ActorRef {
                    actor_id: actor_id__.unwrap_or_default(),
                    actor_kind: actor_kind__.unwrap_or_default(),
                    display_name: display_name__.unwrap_or_default(),
                    capabilities: capabilities__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.ActorRef", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for ArtifactRef {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.artifact_id.is_empty() {
            len += 1;
        }
        if !self.uri.is_empty() {
            len += 1;
        }
        if !self.media_type.is_empty() {
            len += 1;
        }
        if !self.sha256.is_empty() {
            len += 1;
        }
        if self.classification != 0 {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.ArtifactRef", len)?;
        if !self.artifact_id.is_empty() {
            struct_ser.serialize_field("artifactId", &self.artifact_id)?;
        }
        if !self.uri.is_empty() {
            struct_ser.serialize_field("uri", &self.uri)?;
        }
        if !self.media_type.is_empty() {
            struct_ser.serialize_field("mediaType", &self.media_type)?;
        }
        if !self.sha256.is_empty() {
            struct_ser.serialize_field("sha256", &self.sha256)?;
        }
        if self.classification != 0 {
            let v = crate::protojson::enum_value::<DataClassification>(self.classification).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("classification", &v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for ArtifactRef {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "artifact_id",
            "artifactId",
            "uri",
            "media_type",
            "mediaType",
            "sha256",
            "classification",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            ArtifactId,
            Uri,
            MediaType,
            Sha256,
            Classification,
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
                            "artifactId" | "artifact_id" => Ok(GeneratedField::ArtifactId),
                            "uri" => Ok(GeneratedField::Uri),
                            "mediaType" | "media_type" => Ok(GeneratedField::MediaType),
                            "sha256" => Ok(GeneratedField::Sha256),
                            "classification" => Ok(GeneratedField::Classification),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = ArtifactRef;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.ArtifactRef")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<ArtifactRef, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut artifact_id__ = None;
                let mut uri__ = None;
                let mut media_type__ = None;
                let mut sha256__ = None;
                let mut classification__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::ArtifactId => {
                            if artifact_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("artifactId"));
                            }
                            artifact_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Uri => {
                            if uri__.is_some() {
                                return Err(serde::de::Error::duplicate_field("uri"));
                            }
                            uri__ = Some(map_.next_value()?);
                        }
                        GeneratedField::MediaType => {
                            if media_type__.is_some() {
                                return Err(serde::de::Error::duplicate_field("mediaType"));
                            }
                            media_type__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Sha256 => {
                            if sha256__.is_some() {
                                return Err(serde::de::Error::duplicate_field("sha256"));
                            }
                            sha256__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Classification => {
                            if classification__.is_some() {
                                return Err(serde::de::Error::duplicate_field("classification"));
                            }
                            classification__ = Some(map_.next_value::<crate::protojson::OpenEnum<DataClassification>>()?.value);
                        }
                    }
                }
                Ok(ArtifactRef {
                    artifact_id: artifact_id__.unwrap_or_default(),
                    uri: uri__.unwrap_or_default(),
                    media_type: media_type__.unwrap_or_default(),
                    sha256: sha256__.unwrap_or_default(),
                    classification: classification__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.ArtifactRef", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for AuditTags {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.values.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.AuditTags", len)?;
        if !self.values.is_empty() {
            struct_ser.serialize_field("values", &self.values)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for AuditTags {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "values",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Values,
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
                            "values" => Ok(GeneratedField::Values),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = AuditTags;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.AuditTags")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<AuditTags, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut values__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Values => {
                            if values__.is_some() {
                                return Err(serde::de::Error::duplicate_field("values"));
                            }
                            values__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(AuditTags {
                    values: values__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.AuditTags", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for CommandMetadata {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.request_id.is_empty() {
            len += 1;
        }
        if !self.tenant_id.is_empty() {
            len += 1;
        }
        if !self.workspace_id.is_empty() {
            len += 1;
        }
        if self.actor.is_some() {
            len += 1;
        }
        if !self.correlation_id.is_empty() {
            len += 1;
        }
        if !self.causation_id.is_empty() {
            len += 1;
        }
        if self.mode != 0 {
            len += 1;
        }
        if self.environment != 0 {
            len += 1;
        }
        if self.issued_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.CommandMetadata", len)?;
        if !self.request_id.is_empty() {
            struct_ser.serialize_field("requestId", &self.request_id)?;
        }
        if !self.tenant_id.is_empty() {
            struct_ser.serialize_field("tenantId", &self.tenant_id)?;
        }
        if !self.workspace_id.is_empty() {
            struct_ser.serialize_field("workspaceId", &self.workspace_id)?;
        }
        if let Some(v) = self.actor.as_ref() {
            struct_ser.serialize_field("actor", v)?;
        }
        if !self.correlation_id.is_empty() {
            struct_ser.serialize_field("correlationId", &self.correlation_id)?;
        }
        if !self.causation_id.is_empty() {
            struct_ser.serialize_field("causationId", &self.causation_id)?;
        }
        if self.mode != 0 {
            let v = crate::protojson::enum_value::<RuntimeMode>(self.mode).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("mode", &v)?;
        }
        if self.environment != 0 {
            let v = crate::protojson::enum_value::<Environment>(self.environment).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("environment", &v)?;
        }
        if let Some(v) = self.issued_at.as_ref() {
            struct_ser.serialize_field("issuedAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for CommandMetadata {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "request_id",
            "requestId",
            "tenant_id",
            "tenantId",
            "workspace_id",
            "workspaceId",
            "actor",
            "correlation_id",
            "correlationId",
            "causation_id",
            "causationId",
            "mode",
            "environment",
            "issued_at",
            "issuedAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            RequestId,
            TenantId,
            WorkspaceId,
            Actor,
            CorrelationId,
            CausationId,
            Mode,
            Environment,
            IssuedAt,
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
                            "requestId" | "request_id" => Ok(GeneratedField::RequestId),
                            "tenantId" | "tenant_id" => Ok(GeneratedField::TenantId),
                            "workspaceId" | "workspace_id" => Ok(GeneratedField::WorkspaceId),
                            "actor" => Ok(GeneratedField::Actor),
                            "correlationId" | "correlation_id" => Ok(GeneratedField::CorrelationId),
                            "causationId" | "causation_id" => Ok(GeneratedField::CausationId),
                            "mode" => Ok(GeneratedField::Mode),
                            "environment" => Ok(GeneratedField::Environment),
                            "issuedAt" | "issued_at" => Ok(GeneratedField::IssuedAt),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = CommandMetadata;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.CommandMetadata")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<CommandMetadata, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut request_id__ = None;
                let mut tenant_id__ = None;
                let mut workspace_id__ = None;
                let mut actor__ = None;
                let mut correlation_id__ = None;
                let mut causation_id__ = None;
                let mut mode__ = None;
                let mut environment__ = None;
                let mut issued_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::RequestId => {
                            if request_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("requestId"));
                            }
                            request_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::TenantId => {
                            if tenant_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("tenantId"));
                            }
                            tenant_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::WorkspaceId => {
                            if workspace_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("workspaceId"));
                            }
                            workspace_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Actor => {
                            if actor__.is_some() {
                                return Err(serde::de::Error::duplicate_field("actor"));
                            }
                            actor__ = map_.next_value()?;
                        }
                        GeneratedField::CorrelationId => {
                            if correlation_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("correlationId"));
                            }
                            correlation_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::CausationId => {
                            if causation_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("causationId"));
                            }
                            causation_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Mode => {
                            if mode__.is_some() {
                                return Err(serde::de::Error::duplicate_field("mode"));
                            }
                            mode__ = Some(map_.next_value::<crate::protojson::OpenEnum<RuntimeMode>>()?.value);
                        }
                        GeneratedField::Environment => {
                            if environment__.is_some() {
                                return Err(serde::de::Error::duplicate_field("environment"));
                            }
                            environment__ = Some(map_.next_value::<crate::protojson::OpenEnum<Environment>>()?.value);
                        }
                        GeneratedField::IssuedAt => {
                            if issued_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("issuedAt"));
                            }
                            issued_at__ = map_.next_value()?;
                        }
                    }
                }
                Ok(CommandMetadata {
                    request_id: request_id__.unwrap_or_default(),
                    tenant_id: tenant_id__.unwrap_or_default(),
                    workspace_id: workspace_id__.unwrap_or_default(),
                    actor: actor__,
                    correlation_id: correlation_id__.unwrap_or_default(),
                    causation_id: causation_id__.unwrap_or_default(),
                    mode: mode__.unwrap_or_default(),
                    environment: environment__.unwrap_or_default(),
                    issued_at: issued_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.CommandMetadata", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for DataClassification {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "DATA_CLASSIFICATION_UNSPECIFIED",
            Self::Public => "DATA_CLASSIFICATION_PUBLIC",
            Self::Internal => "DATA_CLASSIFICATION_INTERNAL",
            Self::Confidential => "DATA_CLASSIFICATION_CONFIDENTIAL",
            Self::Restricted => "DATA_CLASSIFICATION_RESTRICTED",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for DataClassification {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "DATA_CLASSIFICATION_UNSPECIFIED",
            "DATA_CLASSIFICATION_PUBLIC",
            "DATA_CLASSIFICATION_INTERNAL",
            "DATA_CLASSIFICATION_CONFIDENTIAL",
            "DATA_CLASSIFICATION_RESTRICTED",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = DataClassification;

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
                    "DATA_CLASSIFICATION_UNSPECIFIED" => Ok(DataClassification::Unspecified),
                    "DATA_CLASSIFICATION_PUBLIC" => Ok(DataClassification::Public),
                    "DATA_CLASSIFICATION_INTERNAL" => Ok(DataClassification::Internal),
                    "DATA_CLASSIFICATION_CONFIDENTIAL" => Ok(DataClassification::Confidential),
                    "DATA_CLASSIFICATION_RESTRICTED" => Ok(DataClassification::Restricted),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for DataQuality {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "DATA_QUALITY_UNSPECIFIED",
            Self::Pending => "DATA_QUALITY_PENDING",
            Self::Passed => "DATA_QUALITY_PASSED",
            Self::Degraded => "DATA_QUALITY_DEGRADED",
            Self::Failed => "DATA_QUALITY_FAILED",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for DataQuality {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "DATA_QUALITY_UNSPECIFIED",
            "DATA_QUALITY_PENDING",
            "DATA_QUALITY_PASSED",
            "DATA_QUALITY_DEGRADED",
            "DATA_QUALITY_FAILED",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = DataQuality;

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
                    "DATA_QUALITY_UNSPECIFIED" => Ok(DataQuality::Unspecified),
                    "DATA_QUALITY_PENDING" => Ok(DataQuality::Pending),
                    "DATA_QUALITY_PASSED" => Ok(DataQuality::Passed),
                    "DATA_QUALITY_DEGRADED" => Ok(DataQuality::Degraded),
                    "DATA_QUALITY_FAILED" => Ok(DataQuality::Failed),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for DataSourceRef {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.source_id.is_empty() {
            len += 1;
        }
        if !self.provider.is_empty() {
            len += 1;
        }
        if !self.dataset.is_empty() {
            len += 1;
        }
        if !self.license_label.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.DataSourceRef", len)?;
        if !self.source_id.is_empty() {
            struct_ser.serialize_field("sourceId", &self.source_id)?;
        }
        if !self.provider.is_empty() {
            struct_ser.serialize_field("provider", &self.provider)?;
        }
        if !self.dataset.is_empty() {
            struct_ser.serialize_field("dataset", &self.dataset)?;
        }
        if !self.license_label.is_empty() {
            struct_ser.serialize_field("licenseLabel", &self.license_label)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for DataSourceRef {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "source_id",
            "sourceId",
            "provider",
            "dataset",
            "license_label",
            "licenseLabel",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            SourceId,
            Provider,
            Dataset,
            LicenseLabel,
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
                            "sourceId" | "source_id" => Ok(GeneratedField::SourceId),
                            "provider" => Ok(GeneratedField::Provider),
                            "dataset" => Ok(GeneratedField::Dataset),
                            "licenseLabel" | "license_label" => Ok(GeneratedField::LicenseLabel),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = DataSourceRef;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.DataSourceRef")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<DataSourceRef, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut source_id__ = None;
                let mut provider__ = None;
                let mut dataset__ = None;
                let mut license_label__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::SourceId => {
                            if source_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("sourceId"));
                            }
                            source_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Provider => {
                            if provider__.is_some() {
                                return Err(serde::de::Error::duplicate_field("provider"));
                            }
                            provider__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Dataset => {
                            if dataset__.is_some() {
                                return Err(serde::de::Error::duplicate_field("dataset"));
                            }
                            dataset__ = Some(map_.next_value()?);
                        }
                        GeneratedField::LicenseLabel => {
                            if license_label__.is_some() {
                                return Err(serde::de::Error::duplicate_field("licenseLabel"));
                            }
                            license_label__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(DataSourceRef {
                    source_id: source_id__.unwrap_or_default(),
                    provider: provider__.unwrap_or_default(),
                    dataset: dataset__.unwrap_or_default(),
                    license_label: license_label__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.DataSourceRef", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for DecimalValue {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.value.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.DecimalValue", len)?;
        if !self.value.is_empty() {
            struct_ser.serialize_field("value", &self.value)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for DecimalValue {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "value",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Value,
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
                            "value" => Ok(GeneratedField::Value),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = DecimalValue;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.DecimalValue")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<DecimalValue, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut value__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Value => {
                            if value__.is_some() {
                                return Err(serde::de::Error::duplicate_field("value"));
                            }
                            value__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(DecimalValue {
                    value: value__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.DecimalValue", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for Environment {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "ENVIRONMENT_UNSPECIFIED",
            Self::Local => "ENVIRONMENT_LOCAL",
            Self::Test => "ENVIRONMENT_TEST",
            Self::Staging => "ENVIRONMENT_STAGING",
            Self::Production => "ENVIRONMENT_PRODUCTION",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for Environment {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "ENVIRONMENT_UNSPECIFIED",
            "ENVIRONMENT_LOCAL",
            "ENVIRONMENT_TEST",
            "ENVIRONMENT_STAGING",
            "ENVIRONMENT_PRODUCTION",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = Environment;

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
                    "ENVIRONMENT_UNSPECIFIED" => Ok(Environment::Unspecified),
                    "ENVIRONMENT_LOCAL" => Ok(Environment::Local),
                    "ENVIRONMENT_TEST" => Ok(Environment::Test),
                    "ENVIRONMENT_STAGING" => Ok(Environment::Staging),
                    "ENVIRONMENT_PRODUCTION" => Ok(Environment::Production),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for EvidenceRef {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.evidence_id.is_empty() {
            len += 1;
        }
        if !self.artifact_id.is_empty() {
            len += 1;
        }
        if !self.summary.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.EvidenceRef", len)?;
        if !self.evidence_id.is_empty() {
            struct_ser.serialize_field("evidenceId", &self.evidence_id)?;
        }
        if !self.artifact_id.is_empty() {
            struct_ser.serialize_field("artifactId", &self.artifact_id)?;
        }
        if !self.summary.is_empty() {
            struct_ser.serialize_field("summary", &self.summary)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for EvidenceRef {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "evidence_id",
            "evidenceId",
            "artifact_id",
            "artifactId",
            "summary",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            EvidenceId,
            ArtifactId,
            Summary,
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
                            "evidenceId" | "evidence_id" => Ok(GeneratedField::EvidenceId),
                            "artifactId" | "artifact_id" => Ok(GeneratedField::ArtifactId),
                            "summary" => Ok(GeneratedField::Summary),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = EvidenceRef;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.EvidenceRef")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<EvidenceRef, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut evidence_id__ = None;
                let mut artifact_id__ = None;
                let mut summary__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::EvidenceId => {
                            if evidence_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("evidenceId"));
                            }
                            evidence_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::ArtifactId => {
                            if artifact_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("artifactId"));
                            }
                            artifact_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Summary => {
                            if summary__.is_some() {
                                return Err(serde::de::Error::duplicate_field("summary"));
                            }
                            summary__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(EvidenceRef {
                    evidence_id: evidence_id__.unwrap_or_default(),
                    artifact_id: artifact_id__.unwrap_or_default(),
                    summary: summary__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.EvidenceRef", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for FeatureWindow {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.symbol.is_empty() {
            len += 1;
        }
        if self.window.is_some() {
            len += 1;
        }
        if self.freshness_sla.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.FeatureWindow", len)?;
        if !self.symbol.is_empty() {
            struct_ser.serialize_field("symbol", &self.symbol)?;
        }
        if let Some(v) = self.window.as_ref() {
            struct_ser.serialize_field("window", v)?;
        }
        if let Some(v) = self.freshness_sla.as_ref() {
            struct_ser.serialize_field("freshnessSla", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for FeatureWindow {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "symbol",
            "window",
            "freshness_sla",
            "freshnessSla",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Symbol,
            Window,
            FreshnessSla,
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
                            "symbol" => Ok(GeneratedField::Symbol),
                            "window" => Ok(GeneratedField::Window),
                            "freshnessSla" | "freshness_sla" => Ok(GeneratedField::FreshnessSla),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = FeatureWindow;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.FeatureWindow")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<FeatureWindow, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut symbol__ = None;
                let mut window__ = None;
                let mut freshness_sla__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Symbol => {
                            if symbol__.is_some() {
                                return Err(serde::de::Error::duplicate_field("symbol"));
                            }
                            symbol__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Window => {
                            if window__.is_some() {
                                return Err(serde::de::Error::duplicate_field("window"));
                            }
                            window__ = map_.next_value()?;
                        }
                        GeneratedField::FreshnessSla => {
                            if freshness_sla__.is_some() {
                                return Err(serde::de::Error::duplicate_field("freshnessSla"));
                            }
                            freshness_sla__ = map_.next_value()?;
                        }
                    }
                }
                Ok(FeatureWindow {
                    symbol: symbol__.unwrap_or_default(),
                    window: window__,
                    freshness_sla: freshness_sla__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.FeatureWindow", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for JsonDocument {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.value.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.JsonDocument", len)?;
        if let Some(v) = self.value.as_ref() {
            struct_ser.serialize_field("value", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for JsonDocument {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "value",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Value,
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
                            "value" => Ok(GeneratedField::Value),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = JsonDocument;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.JsonDocument")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<JsonDocument, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut value__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Value => {
                            if value__.is_some() {
                                return Err(serde::de::Error::duplicate_field("value"));
                            }
                            value__ = map_.next_value()?;
                        }
                    }
                }
                Ok(JsonDocument {
                    value: value__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.JsonDocument", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for MoneyValue {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.currency_code.is_empty() {
            len += 1;
        }
        if self.units != 0 {
            len += 1;
        }
        if self.nanos != 0 {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.MoneyValue", len)?;
        if !self.currency_code.is_empty() {
            struct_ser.serialize_field("currencyCode", &self.currency_code)?;
        }
        if self.units != 0 {
            #[allow(clippy::needless_borrow)]
            #[allow(clippy::needless_borrows_for_generic_args)]
            struct_ser.serialize_field("units", ToString::to_string(&self.units).as_str())?;
        }
        if self.nanos != 0 {
            struct_ser.serialize_field("nanos", &self.nanos)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for MoneyValue {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "currency_code",
            "currencyCode",
            "units",
            "nanos",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            CurrencyCode,
            Units,
            Nanos,
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
                            "currencyCode" | "currency_code" => Ok(GeneratedField::CurrencyCode),
                            "units" => Ok(GeneratedField::Units),
                            "nanos" => Ok(GeneratedField::Nanos),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = MoneyValue;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.MoneyValue")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<MoneyValue, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut currency_code__ = None;
                let mut units__ = None;
                let mut nanos__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::CurrencyCode => {
                            if currency_code__.is_some() {
                                return Err(serde::de::Error::duplicate_field("currencyCode"));
                            }
                            currency_code__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Units => {
                            if units__.is_some() {
                                return Err(serde::de::Error::duplicate_field("units"));
                            }
                            units__ =
                                Some(map_.next_value::<::pbjson::private::NumberDeserialize<_>>()?.0)
                            ;
                        }
                        GeneratedField::Nanos => {
                            if nanos__.is_some() {
                                return Err(serde::de::Error::duplicate_field("nanos"));
                            }
                            nanos__ =
                                Some(map_.next_value::<::pbjson::private::NumberDeserialize<_>>()?.0)
                            ;
                        }
                    }
                }
                Ok(MoneyValue {
                    currency_code: currency_code__.unwrap_or_default(),
                    units: units__.unwrap_or_default(),
                    nanos: nanos__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.MoneyValue", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for RuntimeMode {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "RUNTIME_MODE_UNSPECIFIED",
            Self::Research => "RUNTIME_MODE_RESEARCH",
            Self::Paper => "RUNTIME_MODE_PAPER",
            Self::Shadow => "RUNTIME_MODE_SHADOW",
            Self::AssistedLive => "RUNTIME_MODE_ASSISTED_LIVE",
            Self::GuardedLive => "RUNTIME_MODE_GUARDED_LIVE",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for RuntimeMode {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "RUNTIME_MODE_UNSPECIFIED",
            "RUNTIME_MODE_RESEARCH",
            "RUNTIME_MODE_PAPER",
            "RUNTIME_MODE_SHADOW",
            "RUNTIME_MODE_ASSISTED_LIVE",
            "RUNTIME_MODE_GUARDED_LIVE",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = RuntimeMode;

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
                    "RUNTIME_MODE_UNSPECIFIED" => Ok(RuntimeMode::Unspecified),
                    "RUNTIME_MODE_RESEARCH" => Ok(RuntimeMode::Research),
                    "RUNTIME_MODE_PAPER" => Ok(RuntimeMode::Paper),
                    "RUNTIME_MODE_SHADOW" => Ok(RuntimeMode::Shadow),
                    "RUNTIME_MODE_ASSISTED_LIVE" => Ok(RuntimeMode::AssistedLive),
                    "RUNTIME_MODE_GUARDED_LIVE" => Ok(RuntimeMode::GuardedLive),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for TimeWindow {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.start_at.is_some() {
            len += 1;
        }
        if self.end_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.TimeWindow", len)?;
        if let Some(v) = self.start_at.as_ref() {
            struct_ser.serialize_field("startAt", v)?;
        }
        if let Some(v) = self.end_at.as_ref() {
            struct_ser.serialize_field("endAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for TimeWindow {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "start_at",
            "startAt",
            "end_at",
            "endAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
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
            type Value = TimeWindow;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.TimeWindow")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<TimeWindow, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut start_at__ = None;
                let mut end_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
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
                Ok(TimeWindow {
                    start_at: start_at__,
                    end_at: end_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.TimeWindow", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for VersionRef {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.version.is_empty() {
            len += 1;
        }
        if !self.digest.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.common.v1.VersionRef", len)?;
        if !self.version.is_empty() {
            struct_ser.serialize_field("version", &self.version)?;
        }
        if !self.digest.is_empty() {
            struct_ser.serialize_field("digest", &self.digest)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for VersionRef {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "version",
            "digest",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Version,
            Digest,
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
                            "version" => Ok(GeneratedField::Version),
                            "digest" => Ok(GeneratedField::Digest),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = VersionRef;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.common.v1.VersionRef")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<VersionRef, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut version__ = None;
                let mut digest__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Version => {
                            if version__.is_some() {
                                return Err(serde::de::Error::duplicate_field("version"));
                            }
                            version__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Digest => {
                            if digest__.is_some() {
                                return Err(serde::de::Error::duplicate_field("digest"));
                            }
                            digest__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(VersionRef {
                    version: version__.unwrap_or_default(),
                    digest: digest__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.common.v1.VersionRef", FIELDS, GeneratedVisitor)
    }
}
