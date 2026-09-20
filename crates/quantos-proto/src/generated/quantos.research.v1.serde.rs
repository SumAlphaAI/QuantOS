impl serde::Serialize for DataSnapshot {
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
        if !self.snapshot_id.is_empty() {
            len += 1;
        }
        if !self.schema_version.is_empty() {
            len += 1;
        }
        if self.window.is_some() {
            len += 1;
        }
        if !self.sources.is_empty() {
            len += 1;
        }
        if self.quality != 0 {
            len += 1;
        }
        if !self.content_hash.is_empty() {
            len += 1;
        }
        if !self.license_label.is_empty() {
            len += 1;
        }
        if self.captured_at.is_some() {
            len += 1;
        }
        if self.max_age.is_some() {
            len += 1;
        }
        if !self.symbols.is_empty() {
            len += 1;
        }
        if !self.artifact_refs.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.research.v1.DataSnapshot", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.snapshot_id.is_empty() {
            struct_ser.serialize_field("snapshotId", &self.snapshot_id)?;
        }
        if !self.schema_version.is_empty() {
            struct_ser.serialize_field("schemaVersion", &self.schema_version)?;
        }
        if let Some(v) = self.window.as_ref() {
            struct_ser.serialize_field("window", v)?;
        }
        if !self.sources.is_empty() {
            struct_ser.serialize_field("sources", &self.sources)?;
        }
        if self.quality != 0 {
            let v = crate::protojson::enum_value::<super::super::common::v1::DataQuality>(self.quality).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("quality", &v)?;
        }
        if !self.content_hash.is_empty() {
            struct_ser.serialize_field("contentHash", &self.content_hash)?;
        }
        if !self.license_label.is_empty() {
            struct_ser.serialize_field("licenseLabel", &self.license_label)?;
        }
        if let Some(v) = self.captured_at.as_ref() {
            struct_ser.serialize_field("capturedAt", v)?;
        }
        if let Some(v) = self.max_age.as_ref() {
            struct_ser.serialize_field("maxAge", v)?;
        }
        if !self.symbols.is_empty() {
            struct_ser.serialize_field("symbols", &self.symbols)?;
        }
        if !self.artifact_refs.is_empty() {
            struct_ser.serialize_field("artifactRefs", &self.artifact_refs)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for DataSnapshot {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "snapshot_id",
            "snapshotId",
            "schema_version",
            "schemaVersion",
            "window",
            "sources",
            "quality",
            "content_hash",
            "contentHash",
            "license_label",
            "licenseLabel",
            "captured_at",
            "capturedAt",
            "max_age",
            "maxAge",
            "symbols",
            "artifact_refs",
            "artifactRefs",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            SnapshotId,
            SchemaVersion,
            Window,
            Sources,
            Quality,
            ContentHash,
            LicenseLabel,
            CapturedAt,
            MaxAge,
            Symbols,
            ArtifactRefs,
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
                            "snapshotId" | "snapshot_id" => Ok(GeneratedField::SnapshotId),
                            "schemaVersion" | "schema_version" => Ok(GeneratedField::SchemaVersion),
                            "window" => Ok(GeneratedField::Window),
                            "sources" => Ok(GeneratedField::Sources),
                            "quality" => Ok(GeneratedField::Quality),
                            "contentHash" | "content_hash" => Ok(GeneratedField::ContentHash),
                            "licenseLabel" | "license_label" => Ok(GeneratedField::LicenseLabel),
                            "capturedAt" | "captured_at" => Ok(GeneratedField::CapturedAt),
                            "maxAge" | "max_age" => Ok(GeneratedField::MaxAge),
                            "symbols" => Ok(GeneratedField::Symbols),
                            "artifactRefs" | "artifact_refs" => Ok(GeneratedField::ArtifactRefs),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = DataSnapshot;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.research.v1.DataSnapshot")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<DataSnapshot, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut snapshot_id__ = None;
                let mut schema_version__ = None;
                let mut window__ = None;
                let mut sources__ = None;
                let mut quality__ = None;
                let mut content_hash__ = None;
                let mut license_label__ = None;
                let mut captured_at__ = None;
                let mut max_age__ = None;
                let mut symbols__ = None;
                let mut artifact_refs__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::SnapshotId => {
                            if snapshot_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("snapshotId"));
                            }
                            snapshot_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::SchemaVersion => {
                            if schema_version__.is_some() {
                                return Err(serde::de::Error::duplicate_field("schemaVersion"));
                            }
                            schema_version__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Window => {
                            if window__.is_some() {
                                return Err(serde::de::Error::duplicate_field("window"));
                            }
                            window__ = map_.next_value()?;
                        }
                        GeneratedField::Sources => {
                            if sources__.is_some() {
                                return Err(serde::de::Error::duplicate_field("sources"));
                            }
                            sources__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Quality => {
                            if quality__.is_some() {
                                return Err(serde::de::Error::duplicate_field("quality"));
                            }
                            quality__ = Some(map_.next_value::<crate::protojson::OpenEnum<super::super::common::v1::DataQuality>>()?.value);
                        }
                        GeneratedField::ContentHash => {
                            if content_hash__.is_some() {
                                return Err(serde::de::Error::duplicate_field("contentHash"));
                            }
                            content_hash__ = Some(map_.next_value()?);
                        }
                        GeneratedField::LicenseLabel => {
                            if license_label__.is_some() {
                                return Err(serde::de::Error::duplicate_field("licenseLabel"));
                            }
                            license_label__ = Some(map_.next_value()?);
                        }
                        GeneratedField::CapturedAt => {
                            if captured_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("capturedAt"));
                            }
                            captured_at__ = map_.next_value()?;
                        }
                        GeneratedField::MaxAge => {
                            if max_age__.is_some() {
                                return Err(serde::de::Error::duplicate_field("maxAge"));
                            }
                            max_age__ = map_.next_value()?;
                        }
                        GeneratedField::Symbols => {
                            if symbols__.is_some() {
                                return Err(serde::de::Error::duplicate_field("symbols"));
                            }
                            symbols__ = Some(map_.next_value()?);
                        }
                        GeneratedField::ArtifactRefs => {
                            if artifact_refs__.is_some() {
                                return Err(serde::de::Error::duplicate_field("artifactRefs"));
                            }
                            artifact_refs__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(DataSnapshot {
                    metadata: metadata__,
                    snapshot_id: snapshot_id__.unwrap_or_default(),
                    schema_version: schema_version__.unwrap_or_default(),
                    window: window__,
                    sources: sources__.unwrap_or_default(),
                    quality: quality__.unwrap_or_default(),
                    content_hash: content_hash__.unwrap_or_default(),
                    license_label: license_label__.unwrap_or_default(),
                    captured_at: captured_at__,
                    max_age: max_age__,
                    symbols: symbols__.unwrap_or_default(),
                    artifact_refs: artifact_refs__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.research.v1.DataSnapshot", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for ResearchArtifact {
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
        if !self.artifact_id.is_empty() {
            len += 1;
        }
        if !self.title.is_empty() {
            len += 1;
        }
        if !self.hypothesis.is_empty() {
            len += 1;
        }
        if !self.summary.is_empty() {
            len += 1;
        }
        if !self.content_hash.is_empty() {
            len += 1;
        }
        if !self.engine_version.is_empty() {
            len += 1;
        }
        if !self.prompt_version.is_empty() {
            len += 1;
        }
        if !self.code_version.is_empty() {
            len += 1;
        }
        if !self.environment_hash.is_empty() {
            len += 1;
        }
        if !self.data_snapshot_id.is_empty() {
            len += 1;
        }
        if !self.evidence_refs.is_empty() {
            len += 1;
        }
        if !self.attachments.is_empty() {
            len += 1;
        }
        if self.created_at.is_some() {
            len += 1;
        }
        if self.expires_at.is_some() {
            len += 1;
        }
        if self.audit_tags.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.research.v1.ResearchArtifact", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.artifact_id.is_empty() {
            struct_ser.serialize_field("artifactId", &self.artifact_id)?;
        }
        if !self.title.is_empty() {
            struct_ser.serialize_field("title", &self.title)?;
        }
        if !self.hypothesis.is_empty() {
            struct_ser.serialize_field("hypothesis", &self.hypothesis)?;
        }
        if !self.summary.is_empty() {
            struct_ser.serialize_field("summary", &self.summary)?;
        }
        if !self.content_hash.is_empty() {
            struct_ser.serialize_field("contentHash", &self.content_hash)?;
        }
        if !self.engine_version.is_empty() {
            struct_ser.serialize_field("engineVersion", &self.engine_version)?;
        }
        if !self.prompt_version.is_empty() {
            struct_ser.serialize_field("promptVersion", &self.prompt_version)?;
        }
        if !self.code_version.is_empty() {
            struct_ser.serialize_field("codeVersion", &self.code_version)?;
        }
        if !self.environment_hash.is_empty() {
            struct_ser.serialize_field("environmentHash", &self.environment_hash)?;
        }
        if !self.data_snapshot_id.is_empty() {
            struct_ser.serialize_field("dataSnapshotId", &self.data_snapshot_id)?;
        }
        if !self.evidence_refs.is_empty() {
            struct_ser.serialize_field("evidenceRefs", &self.evidence_refs)?;
        }
        if !self.attachments.is_empty() {
            struct_ser.serialize_field("attachments", &self.attachments)?;
        }
        if let Some(v) = self.created_at.as_ref() {
            struct_ser.serialize_field("createdAt", v)?;
        }
        if let Some(v) = self.expires_at.as_ref() {
            struct_ser.serialize_field("expiresAt", v)?;
        }
        if let Some(v) = self.audit_tags.as_ref() {
            struct_ser.serialize_field("auditTags", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for ResearchArtifact {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "artifact_id",
            "artifactId",
            "title",
            "hypothesis",
            "summary",
            "content_hash",
            "contentHash",
            "engine_version",
            "engineVersion",
            "prompt_version",
            "promptVersion",
            "code_version",
            "codeVersion",
            "environment_hash",
            "environmentHash",
            "data_snapshot_id",
            "dataSnapshotId",
            "evidence_refs",
            "evidenceRefs",
            "attachments",
            "created_at",
            "createdAt",
            "expires_at",
            "expiresAt",
            "audit_tags",
            "auditTags",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            ArtifactId,
            Title,
            Hypothesis,
            Summary,
            ContentHash,
            EngineVersion,
            PromptVersion,
            CodeVersion,
            EnvironmentHash,
            DataSnapshotId,
            EvidenceRefs,
            Attachments,
            CreatedAt,
            ExpiresAt,
            AuditTags,
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
                            "artifactId" | "artifact_id" => Ok(GeneratedField::ArtifactId),
                            "title" => Ok(GeneratedField::Title),
                            "hypothesis" => Ok(GeneratedField::Hypothesis),
                            "summary" => Ok(GeneratedField::Summary),
                            "contentHash" | "content_hash" => Ok(GeneratedField::ContentHash),
                            "engineVersion" | "engine_version" => Ok(GeneratedField::EngineVersion),
                            "promptVersion" | "prompt_version" => Ok(GeneratedField::PromptVersion),
                            "codeVersion" | "code_version" => Ok(GeneratedField::CodeVersion),
                            "environmentHash" | "environment_hash" => Ok(GeneratedField::EnvironmentHash),
                            "dataSnapshotId" | "data_snapshot_id" => Ok(GeneratedField::DataSnapshotId),
                            "evidenceRefs" | "evidence_refs" => Ok(GeneratedField::EvidenceRefs),
                            "attachments" => Ok(GeneratedField::Attachments),
                            "createdAt" | "created_at" => Ok(GeneratedField::CreatedAt),
                            "expiresAt" | "expires_at" => Ok(GeneratedField::ExpiresAt),
                            "auditTags" | "audit_tags" => Ok(GeneratedField::AuditTags),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = ResearchArtifact;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.research.v1.ResearchArtifact")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<ResearchArtifact, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut artifact_id__ = None;
                let mut title__ = None;
                let mut hypothesis__ = None;
                let mut summary__ = None;
                let mut content_hash__ = None;
                let mut engine_version__ = None;
                let mut prompt_version__ = None;
                let mut code_version__ = None;
                let mut environment_hash__ = None;
                let mut data_snapshot_id__ = None;
                let mut evidence_refs__ = None;
                let mut attachments__ = None;
                let mut created_at__ = None;
                let mut expires_at__ = None;
                let mut audit_tags__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::ArtifactId => {
                            if artifact_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("artifactId"));
                            }
                            artifact_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Title => {
                            if title__.is_some() {
                                return Err(serde::de::Error::duplicate_field("title"));
                            }
                            title__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Hypothesis => {
                            if hypothesis__.is_some() {
                                return Err(serde::de::Error::duplicate_field("hypothesis"));
                            }
                            hypothesis__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Summary => {
                            if summary__.is_some() {
                                return Err(serde::de::Error::duplicate_field("summary"));
                            }
                            summary__ = Some(map_.next_value()?);
                        }
                        GeneratedField::ContentHash => {
                            if content_hash__.is_some() {
                                return Err(serde::de::Error::duplicate_field("contentHash"));
                            }
                            content_hash__ = Some(map_.next_value()?);
                        }
                        GeneratedField::EngineVersion => {
                            if engine_version__.is_some() {
                                return Err(serde::de::Error::duplicate_field("engineVersion"));
                            }
                            engine_version__ = Some(map_.next_value()?);
                        }
                        GeneratedField::PromptVersion => {
                            if prompt_version__.is_some() {
                                return Err(serde::de::Error::duplicate_field("promptVersion"));
                            }
                            prompt_version__ = Some(map_.next_value()?);
                        }
                        GeneratedField::CodeVersion => {
                            if code_version__.is_some() {
                                return Err(serde::de::Error::duplicate_field("codeVersion"));
                            }
                            code_version__ = Some(map_.next_value()?);
                        }
                        GeneratedField::EnvironmentHash => {
                            if environment_hash__.is_some() {
                                return Err(serde::de::Error::duplicate_field("environmentHash"));
                            }
                            environment_hash__ = Some(map_.next_value()?);
                        }
                        GeneratedField::DataSnapshotId => {
                            if data_snapshot_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("dataSnapshotId"));
                            }
                            data_snapshot_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::EvidenceRefs => {
                            if evidence_refs__.is_some() {
                                return Err(serde::de::Error::duplicate_field("evidenceRefs"));
                            }
                            evidence_refs__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Attachments => {
                            if attachments__.is_some() {
                                return Err(serde::de::Error::duplicate_field("attachments"));
                            }
                            attachments__ = Some(map_.next_value()?);
                        }
                        GeneratedField::CreatedAt => {
                            if created_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("createdAt"));
                            }
                            created_at__ = map_.next_value()?;
                        }
                        GeneratedField::ExpiresAt => {
                            if expires_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("expiresAt"));
                            }
                            expires_at__ = map_.next_value()?;
                        }
                        GeneratedField::AuditTags => {
                            if audit_tags__.is_some() {
                                return Err(serde::de::Error::duplicate_field("auditTags"));
                            }
                            audit_tags__ = map_.next_value()?;
                        }
                    }
                }
                Ok(ResearchArtifact {
                    metadata: metadata__,
                    artifact_id: artifact_id__.unwrap_or_default(),
                    title: title__.unwrap_or_default(),
                    hypothesis: hypothesis__.unwrap_or_default(),
                    summary: summary__.unwrap_or_default(),
                    content_hash: content_hash__.unwrap_or_default(),
                    engine_version: engine_version__.unwrap_or_default(),
                    prompt_version: prompt_version__.unwrap_or_default(),
                    code_version: code_version__.unwrap_or_default(),
                    environment_hash: environment_hash__.unwrap_or_default(),
                    data_snapshot_id: data_snapshot_id__.unwrap_or_default(),
                    evidence_refs: evidence_refs__.unwrap_or_default(),
                    attachments: attachments__.unwrap_or_default(),
                    created_at: created_at__,
                    expires_at: expires_at__,
                    audit_tags: audit_tags__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.research.v1.ResearchArtifact", FIELDS, GeneratedVisitor)
    }
}
