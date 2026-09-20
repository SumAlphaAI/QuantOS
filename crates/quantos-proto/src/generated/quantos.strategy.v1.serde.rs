impl serde::Serialize for DeploymentTarget {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "DEPLOYMENT_TARGET_UNSPECIFIED",
            Self::Research => "DEPLOYMENT_TARGET_RESEARCH",
            Self::Paper => "DEPLOYMENT_TARGET_PAPER",
            Self::Shadow => "DEPLOYMENT_TARGET_SHADOW",
            Self::AssistedLive => "DEPLOYMENT_TARGET_ASSISTED_LIVE",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for DeploymentTarget {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "DEPLOYMENT_TARGET_UNSPECIFIED",
            "DEPLOYMENT_TARGET_RESEARCH",
            "DEPLOYMENT_TARGET_PAPER",
            "DEPLOYMENT_TARGET_SHADOW",
            "DEPLOYMENT_TARGET_ASSISTED_LIVE",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = DeploymentTarget;

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
                    "DEPLOYMENT_TARGET_UNSPECIFIED" => Ok(DeploymentTarget::Unspecified),
                    "DEPLOYMENT_TARGET_RESEARCH" => Ok(DeploymentTarget::Research),
                    "DEPLOYMENT_TARGET_PAPER" => Ok(DeploymentTarget::Paper),
                    "DEPLOYMENT_TARGET_SHADOW" => Ok(DeploymentTarget::Shadow),
                    "DEPLOYMENT_TARGET_ASSISTED_LIVE" => Ok(DeploymentTarget::AssistedLive),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for Signal {
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
        if !self.signal_id.is_empty() {
            len += 1;
        }
        if !self.strategy_release_id.is_empty() {
            len += 1;
        }
        if !self.symbol.is_empty() {
            len += 1;
        }
        if self.direction != 0 {
            len += 1;
        }
        if self.strength.is_some() {
            len += 1;
        }
        if self.confidence.is_some() {
            len += 1;
        }
        if self.diagnostics.is_some() {
            len += 1;
        }
        if self.generated_at.is_some() {
            len += 1;
        }
        if self.valid_until.is_some() {
            len += 1;
        }
        if !self.evidence_refs.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.strategy.v1.Signal", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.signal_id.is_empty() {
            struct_ser.serialize_field("signalId", &self.signal_id)?;
        }
        if !self.strategy_release_id.is_empty() {
            struct_ser.serialize_field("strategyReleaseId", &self.strategy_release_id)?;
        }
        if !self.symbol.is_empty() {
            struct_ser.serialize_field("symbol", &self.symbol)?;
        }
        if self.direction != 0 {
            let v = crate::protojson::enum_value::<SignalDirection>(self.direction).map_err(serde::ser::Error::custom)?;
            struct_ser.serialize_field("direction", &v)?;
        }
        if let Some(v) = self.strength.as_ref() {
            struct_ser.serialize_field("strength", v)?;
        }
        if let Some(v) = self.confidence.as_ref() {
            struct_ser.serialize_field("confidence", v)?;
        }
        if let Some(v) = self.diagnostics.as_ref() {
            struct_ser.serialize_field("diagnostics", v)?;
        }
        if let Some(v) = self.generated_at.as_ref() {
            struct_ser.serialize_field("generatedAt", v)?;
        }
        if let Some(v) = self.valid_until.as_ref() {
            struct_ser.serialize_field("validUntil", v)?;
        }
        if !self.evidence_refs.is_empty() {
            struct_ser.serialize_field("evidenceRefs", &self.evidence_refs)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for Signal {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "signal_id",
            "signalId",
            "strategy_release_id",
            "strategyReleaseId",
            "symbol",
            "direction",
            "strength",
            "confidence",
            "diagnostics",
            "generated_at",
            "generatedAt",
            "valid_until",
            "validUntil",
            "evidence_refs",
            "evidenceRefs",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            SignalId,
            StrategyReleaseId,
            Symbol,
            Direction,
            Strength,
            Confidence,
            Diagnostics,
            GeneratedAt,
            ValidUntil,
            EvidenceRefs,
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
                            "signalId" | "signal_id" => Ok(GeneratedField::SignalId),
                            "strategyReleaseId" | "strategy_release_id" => Ok(GeneratedField::StrategyReleaseId),
                            "symbol" => Ok(GeneratedField::Symbol),
                            "direction" => Ok(GeneratedField::Direction),
                            "strength" => Ok(GeneratedField::Strength),
                            "confidence" => Ok(GeneratedField::Confidence),
                            "diagnostics" => Ok(GeneratedField::Diagnostics),
                            "generatedAt" | "generated_at" => Ok(GeneratedField::GeneratedAt),
                            "validUntil" | "valid_until" => Ok(GeneratedField::ValidUntil),
                            "evidenceRefs" | "evidence_refs" => Ok(GeneratedField::EvidenceRefs),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = Signal;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.strategy.v1.Signal")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<Signal, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut signal_id__ = None;
                let mut strategy_release_id__ = None;
                let mut symbol__ = None;
                let mut direction__ = None;
                let mut strength__ = None;
                let mut confidence__ = None;
                let mut diagnostics__ = None;
                let mut generated_at__ = None;
                let mut valid_until__ = None;
                let mut evidence_refs__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::SignalId => {
                            if signal_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("signalId"));
                            }
                            signal_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::StrategyReleaseId => {
                            if strategy_release_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("strategyReleaseId"));
                            }
                            strategy_release_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Symbol => {
                            if symbol__.is_some() {
                                return Err(serde::de::Error::duplicate_field("symbol"));
                            }
                            symbol__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Direction => {
                            if direction__.is_some() {
                                return Err(serde::de::Error::duplicate_field("direction"));
                            }
                            direction__ = Some(map_.next_value::<crate::protojson::OpenEnum<SignalDirection>>()?.value);
                        }
                        GeneratedField::Strength => {
                            if strength__.is_some() {
                                return Err(serde::de::Error::duplicate_field("strength"));
                            }
                            strength__ = map_.next_value()?;
                        }
                        GeneratedField::Confidence => {
                            if confidence__.is_some() {
                                return Err(serde::de::Error::duplicate_field("confidence"));
                            }
                            confidence__ = map_.next_value()?;
                        }
                        GeneratedField::Diagnostics => {
                            if diagnostics__.is_some() {
                                return Err(serde::de::Error::duplicate_field("diagnostics"));
                            }
                            diagnostics__ = map_.next_value()?;
                        }
                        GeneratedField::GeneratedAt => {
                            if generated_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("generatedAt"));
                            }
                            generated_at__ = map_.next_value()?;
                        }
                        GeneratedField::ValidUntil => {
                            if valid_until__.is_some() {
                                return Err(serde::de::Error::duplicate_field("validUntil"));
                            }
                            valid_until__ = map_.next_value()?;
                        }
                        GeneratedField::EvidenceRefs => {
                            if evidence_refs__.is_some() {
                                return Err(serde::de::Error::duplicate_field("evidenceRefs"));
                            }
                            evidence_refs__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(Signal {
                    metadata: metadata__,
                    signal_id: signal_id__.unwrap_or_default(),
                    strategy_release_id: strategy_release_id__.unwrap_or_default(),
                    symbol: symbol__.unwrap_or_default(),
                    direction: direction__.unwrap_or_default(),
                    strength: strength__,
                    confidence: confidence__,
                    diagnostics: diagnostics__,
                    generated_at: generated_at__,
                    valid_until: valid_until__,
                    evidence_refs: evidence_refs__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.strategy.v1.Signal", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for SignalDirection {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let variant = match self {
            Self::Unspecified => "SIGNAL_DIRECTION_UNSPECIFIED",
            Self::Long => "SIGNAL_DIRECTION_LONG",
            Self::Short => "SIGNAL_DIRECTION_SHORT",
            Self::Flat => "SIGNAL_DIRECTION_FLAT",
        };
        serializer.serialize_str(variant)
    }
}
impl<'de> serde::Deserialize<'de> for SignalDirection {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "SIGNAL_DIRECTION_UNSPECIFIED",
            "SIGNAL_DIRECTION_LONG",
            "SIGNAL_DIRECTION_SHORT",
            "SIGNAL_DIRECTION_FLAT",
        ];

        struct GeneratedVisitor;

        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = SignalDirection;

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
                    "SIGNAL_DIRECTION_UNSPECIFIED" => Ok(SignalDirection::Unspecified),
                    "SIGNAL_DIRECTION_LONG" => Ok(SignalDirection::Long),
                    "SIGNAL_DIRECTION_SHORT" => Ok(SignalDirection::Short),
                    "SIGNAL_DIRECTION_FLAT" => Ok(SignalDirection::Flat),
                    _ => Err(serde::de::Error::unknown_variant(value, FIELDS)),
                }
            }
        }
        deserializer.deserialize_any(GeneratedVisitor)
    }
}
impl serde::Serialize for StrategyRelease {
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
        if !self.release_id.is_empty() {
            len += 1;
        }
        if !self.strategy_id.is_empty() {
            len += 1;
        }
        if !self.name.is_empty() {
            len += 1;
        }
        if !self.source_digest.is_empty() {
            len += 1;
        }
        if !self.image_digest.is_empty() {
            len += 1;
        }
        if !self.parameter_hash.is_empty() {
            len += 1;
        }
        if !self.backtest_report_artifact_id.is_empty() {
            len += 1;
        }
        if !self.data_snapshot_id.is_empty() {
            len += 1;
        }
        if !self.evidence_refs.is_empty() {
            len += 1;
        }
        if !self.allowed_targets.is_empty() {
            len += 1;
        }
        if self.approved_at.is_some() {
            len += 1;
        }
        if self.created_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.strategy.v1.StrategyRelease", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.release_id.is_empty() {
            struct_ser.serialize_field("releaseId", &self.release_id)?;
        }
        if !self.strategy_id.is_empty() {
            struct_ser.serialize_field("strategyId", &self.strategy_id)?;
        }
        if !self.name.is_empty() {
            struct_ser.serialize_field("name", &self.name)?;
        }
        if !self.source_digest.is_empty() {
            struct_ser.serialize_field("sourceDigest", &self.source_digest)?;
        }
        if !self.image_digest.is_empty() {
            struct_ser.serialize_field("imageDigest", &self.image_digest)?;
        }
        if !self.parameter_hash.is_empty() {
            struct_ser.serialize_field("parameterHash", &self.parameter_hash)?;
        }
        if !self.backtest_report_artifact_id.is_empty() {
            struct_ser.serialize_field("backtestReportArtifactId", &self.backtest_report_artifact_id)?;
        }
        if !self.data_snapshot_id.is_empty() {
            struct_ser.serialize_field("dataSnapshotId", &self.data_snapshot_id)?;
        }
        if !self.evidence_refs.is_empty() {
            struct_ser.serialize_field("evidenceRefs", &self.evidence_refs)?;
        }
        if !self.allowed_targets.is_empty() {
            let v = self.allowed_targets.iter().cloned().map(|v| {
                crate::protojson::enum_value::<DeploymentTarget>(v).map_err(serde::ser::Error::custom)
                }).collect::<std::result::Result<Vec<_>, _>>()?;
            struct_ser.serialize_field("allowedTargets", &v)?;
        }
        if let Some(v) = self.approved_at.as_ref() {
            struct_ser.serialize_field("approvedAt", v)?;
        }
        if let Some(v) = self.created_at.as_ref() {
            struct_ser.serialize_field("createdAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for StrategyRelease {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "release_id",
            "releaseId",
            "strategy_id",
            "strategyId",
            "name",
            "source_digest",
            "sourceDigest",
            "image_digest",
            "imageDigest",
            "parameter_hash",
            "parameterHash",
            "backtest_report_artifact_id",
            "backtestReportArtifactId",
            "data_snapshot_id",
            "dataSnapshotId",
            "evidence_refs",
            "evidenceRefs",
            "allowed_targets",
            "allowedTargets",
            "approved_at",
            "approvedAt",
            "created_at",
            "createdAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            ReleaseId,
            StrategyId,
            Name,
            SourceDigest,
            ImageDigest,
            ParameterHash,
            BacktestReportArtifactId,
            DataSnapshotId,
            EvidenceRefs,
            AllowedTargets,
            ApprovedAt,
            CreatedAt,
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
                            "releaseId" | "release_id" => Ok(GeneratedField::ReleaseId),
                            "strategyId" | "strategy_id" => Ok(GeneratedField::StrategyId),
                            "name" => Ok(GeneratedField::Name),
                            "sourceDigest" | "source_digest" => Ok(GeneratedField::SourceDigest),
                            "imageDigest" | "image_digest" => Ok(GeneratedField::ImageDigest),
                            "parameterHash" | "parameter_hash" => Ok(GeneratedField::ParameterHash),
                            "backtestReportArtifactId" | "backtest_report_artifact_id" => Ok(GeneratedField::BacktestReportArtifactId),
                            "dataSnapshotId" | "data_snapshot_id" => Ok(GeneratedField::DataSnapshotId),
                            "evidenceRefs" | "evidence_refs" => Ok(GeneratedField::EvidenceRefs),
                            "allowedTargets" | "allowed_targets" => Ok(GeneratedField::AllowedTargets),
                            "approvedAt" | "approved_at" => Ok(GeneratedField::ApprovedAt),
                            "createdAt" | "created_at" => Ok(GeneratedField::CreatedAt),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = StrategyRelease;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.strategy.v1.StrategyRelease")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<StrategyRelease, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut release_id__ = None;
                let mut strategy_id__ = None;
                let mut name__ = None;
                let mut source_digest__ = None;
                let mut image_digest__ = None;
                let mut parameter_hash__ = None;
                let mut backtest_report_artifact_id__ = None;
                let mut data_snapshot_id__ = None;
                let mut evidence_refs__ = None;
                let mut allowed_targets__ = None;
                let mut approved_at__ = None;
                let mut created_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::ReleaseId => {
                            if release_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("releaseId"));
                            }
                            release_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::StrategyId => {
                            if strategy_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("strategyId"));
                            }
                            strategy_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Name => {
                            if name__.is_some() {
                                return Err(serde::de::Error::duplicate_field("name"));
                            }
                            name__ = Some(map_.next_value()?);
                        }
                        GeneratedField::SourceDigest => {
                            if source_digest__.is_some() {
                                return Err(serde::de::Error::duplicate_field("sourceDigest"));
                            }
                            source_digest__ = Some(map_.next_value()?);
                        }
                        GeneratedField::ImageDigest => {
                            if image_digest__.is_some() {
                                return Err(serde::de::Error::duplicate_field("imageDigest"));
                            }
                            image_digest__ = Some(map_.next_value()?);
                        }
                        GeneratedField::ParameterHash => {
                            if parameter_hash__.is_some() {
                                return Err(serde::de::Error::duplicate_field("parameterHash"));
                            }
                            parameter_hash__ = Some(map_.next_value()?);
                        }
                        GeneratedField::BacktestReportArtifactId => {
                            if backtest_report_artifact_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("backtestReportArtifactId"));
                            }
                            backtest_report_artifact_id__ = Some(map_.next_value()?);
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
                        GeneratedField::AllowedTargets => {
                            if allowed_targets__.is_some() {
                                return Err(serde::de::Error::duplicate_field("allowedTargets"));
                            }
                            allowed_targets__ = Some(map_.next_value::<Vec<crate::protojson::OpenEnum<DeploymentTarget>>>()?.into_iter().map(|x| x.value).collect());
                        }
                        GeneratedField::ApprovedAt => {
                            if approved_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("approvedAt"));
                            }
                            approved_at__ = map_.next_value()?;
                        }
                        GeneratedField::CreatedAt => {
                            if created_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("createdAt"));
                            }
                            created_at__ = map_.next_value()?;
                        }
                    }
                }
                Ok(StrategyRelease {
                    metadata: metadata__,
                    release_id: release_id__.unwrap_or_default(),
                    strategy_id: strategy_id__.unwrap_or_default(),
                    name: name__.unwrap_or_default(),
                    source_digest: source_digest__.unwrap_or_default(),
                    image_digest: image_digest__.unwrap_or_default(),
                    parameter_hash: parameter_hash__.unwrap_or_default(),
                    backtest_report_artifact_id: backtest_report_artifact_id__.unwrap_or_default(),
                    data_snapshot_id: data_snapshot_id__.unwrap_or_default(),
                    evidence_refs: evidence_refs__.unwrap_or_default(),
                    allowed_targets: allowed_targets__.unwrap_or_default(),
                    approved_at: approved_at__,
                    created_at: created_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.strategy.v1.StrategyRelease", FIELDS, GeneratedVisitor)
    }
}
