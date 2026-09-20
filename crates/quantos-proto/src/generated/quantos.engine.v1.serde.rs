impl serde::Serialize for CancelRequest {
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
        if !self.execution_id.is_empty() {
            len += 1;
        }
        if !self.reason.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.engine.v1.CancelRequest", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.execution_id.is_empty() {
            struct_ser.serialize_field("executionId", &self.execution_id)?;
        }
        if !self.reason.is_empty() {
            struct_ser.serialize_field("reason", &self.reason)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for CancelRequest {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "execution_id",
            "executionId",
            "reason",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            ExecutionId,
            Reason,
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
                            "executionId" | "execution_id" => Ok(GeneratedField::ExecutionId),
                            "reason" => Ok(GeneratedField::Reason),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = CancelRequest;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.engine.v1.CancelRequest")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<CancelRequest, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut execution_id__ = None;
                let mut reason__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::ExecutionId => {
                            if execution_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("executionId"));
                            }
                            execution_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Reason => {
                            if reason__.is_some() {
                                return Err(serde::de::Error::duplicate_field("reason"));
                            }
                            reason__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(CancelRequest {
                    metadata: metadata__,
                    execution_id: execution_id__.unwrap_or_default(),
                    reason: reason__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.engine.v1.CancelRequest", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for CancelResponse {
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
        if !self.execution_id.is_empty() {
            len += 1;
        }
        if self.cancelled {
            len += 1;
        }
        if self.cancelled_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.engine.v1.CancelResponse", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.execution_id.is_empty() {
            struct_ser.serialize_field("executionId", &self.execution_id)?;
        }
        if self.cancelled {
            struct_ser.serialize_field("cancelled", &self.cancelled)?;
        }
        if let Some(v) = self.cancelled_at.as_ref() {
            struct_ser.serialize_field("cancelledAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for CancelResponse {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "execution_id",
            "executionId",
            "cancelled",
            "cancelled_at",
            "cancelledAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            ExecutionId,
            Cancelled,
            CancelledAt,
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
                            "executionId" | "execution_id" => Ok(GeneratedField::ExecutionId),
                            "cancelled" => Ok(GeneratedField::Cancelled),
                            "cancelledAt" | "cancelled_at" => Ok(GeneratedField::CancelledAt),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = CancelResponse;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.engine.v1.CancelResponse")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<CancelResponse, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut execution_id__ = None;
                let mut cancelled__ = None;
                let mut cancelled_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::ExecutionId => {
                            if execution_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("executionId"));
                            }
                            execution_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Cancelled => {
                            if cancelled__.is_some() {
                                return Err(serde::de::Error::duplicate_field("cancelled"));
                            }
                            cancelled__ = Some(map_.next_value()?);
                        }
                        GeneratedField::CancelledAt => {
                            if cancelled_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("cancelledAt"));
                            }
                            cancelled_at__ = map_.next_value()?;
                        }
                    }
                }
                Ok(CancelResponse {
                    metadata: metadata__,
                    execution_id: execution_id__.unwrap_or_default(),
                    cancelled: cancelled__.unwrap_or_default(),
                    cancelled_at: cancelled_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.engine.v1.CancelResponse", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for Capability {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if !self.name.is_empty() {
            len += 1;
        }
        if !self.version.is_empty() {
            len += 1;
        }
        if !self.description.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.engine.v1.Capability", len)?;
        if !self.name.is_empty() {
            struct_ser.serialize_field("name", &self.name)?;
        }
        if !self.version.is_empty() {
            struct_ser.serialize_field("version", &self.version)?;
        }
        if !self.description.is_empty() {
            struct_ser.serialize_field("description", &self.description)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for Capability {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "name",
            "version",
            "description",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Name,
            Version,
            Description,
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
                            "name" => Ok(GeneratedField::Name),
                            "version" => Ok(GeneratedField::Version),
                            "description" => Ok(GeneratedField::Description),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = Capability;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.engine.v1.Capability")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<Capability, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut name__ = None;
                let mut version__ = None;
                let mut description__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Name => {
                            if name__.is_some() {
                                return Err(serde::de::Error::duplicate_field("name"));
                            }
                            name__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Version => {
                            if version__.is_some() {
                                return Err(serde::de::Error::duplicate_field("version"));
                            }
                            version__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Description => {
                            if description__.is_some() {
                                return Err(serde::de::Error::duplicate_field("description"));
                            }
                            description__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(Capability {
                    name: name__.unwrap_or_default(),
                    version: version__.unwrap_or_default(),
                    description: description__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.engine.v1.Capability", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for ExecuteRequest {
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
        if !self.workflow_run_id.is_empty() {
            len += 1;
        }
        if !self.idempotency_key.is_empty() {
            len += 1;
        }
        if !self.capability.is_empty() {
            len += 1;
        }
        if !self.input_schema_version.is_empty() {
            len += 1;
        }
        if !self.data_snapshot_ref.is_empty() {
            len += 1;
        }
        if !self.policy_context_ref.is_empty() {
            len += 1;
        }
        if self.input.is_some() {
            len += 1;
        }
        if self.deadline.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.engine.v1.ExecuteRequest", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.workflow_run_id.is_empty() {
            struct_ser.serialize_field("workflowRunId", &self.workflow_run_id)?;
        }
        if !self.idempotency_key.is_empty() {
            struct_ser.serialize_field("idempotencyKey", &self.idempotency_key)?;
        }
        if !self.capability.is_empty() {
            struct_ser.serialize_field("capability", &self.capability)?;
        }
        if !self.input_schema_version.is_empty() {
            struct_ser.serialize_field("inputSchemaVersion", &self.input_schema_version)?;
        }
        if !self.data_snapshot_ref.is_empty() {
            struct_ser.serialize_field("dataSnapshotRef", &self.data_snapshot_ref)?;
        }
        if !self.policy_context_ref.is_empty() {
            struct_ser.serialize_field("policyContextRef", &self.policy_context_ref)?;
        }
        if let Some(v) = self.input.as_ref() {
            struct_ser.serialize_field("input", v)?;
        }
        if let Some(v) = self.deadline.as_ref() {
            struct_ser.serialize_field("deadline", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for ExecuteRequest {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "workflow_run_id",
            "workflowRunId",
            "idempotency_key",
            "idempotencyKey",
            "capability",
            "input_schema_version",
            "inputSchemaVersion",
            "data_snapshot_ref",
            "dataSnapshotRef",
            "policy_context_ref",
            "policyContextRef",
            "input",
            "deadline",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            WorkflowRunId,
            IdempotencyKey,
            Capability,
            InputSchemaVersion,
            DataSnapshotRef,
            PolicyContextRef,
            Input,
            Deadline,
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
                            "workflowRunId" | "workflow_run_id" => Ok(GeneratedField::WorkflowRunId),
                            "idempotencyKey" | "idempotency_key" => Ok(GeneratedField::IdempotencyKey),
                            "capability" => Ok(GeneratedField::Capability),
                            "inputSchemaVersion" | "input_schema_version" => Ok(GeneratedField::InputSchemaVersion),
                            "dataSnapshotRef" | "data_snapshot_ref" => Ok(GeneratedField::DataSnapshotRef),
                            "policyContextRef" | "policy_context_ref" => Ok(GeneratedField::PolicyContextRef),
                            "input" => Ok(GeneratedField::Input),
                            "deadline" => Ok(GeneratedField::Deadline),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = ExecuteRequest;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.engine.v1.ExecuteRequest")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<ExecuteRequest, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut workflow_run_id__ = None;
                let mut idempotency_key__ = None;
                let mut capability__ = None;
                let mut input_schema_version__ = None;
                let mut data_snapshot_ref__ = None;
                let mut policy_context_ref__ = None;
                let mut input__ = None;
                let mut deadline__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::WorkflowRunId => {
                            if workflow_run_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("workflowRunId"));
                            }
                            workflow_run_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::IdempotencyKey => {
                            if idempotency_key__.is_some() {
                                return Err(serde::de::Error::duplicate_field("idempotencyKey"));
                            }
                            idempotency_key__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Capability => {
                            if capability__.is_some() {
                                return Err(serde::de::Error::duplicate_field("capability"));
                            }
                            capability__ = Some(map_.next_value()?);
                        }
                        GeneratedField::InputSchemaVersion => {
                            if input_schema_version__.is_some() {
                                return Err(serde::de::Error::duplicate_field("inputSchemaVersion"));
                            }
                            input_schema_version__ = Some(map_.next_value()?);
                        }
                        GeneratedField::DataSnapshotRef => {
                            if data_snapshot_ref__.is_some() {
                                return Err(serde::de::Error::duplicate_field("dataSnapshotRef"));
                            }
                            data_snapshot_ref__ = Some(map_.next_value()?);
                        }
                        GeneratedField::PolicyContextRef => {
                            if policy_context_ref__.is_some() {
                                return Err(serde::de::Error::duplicate_field("policyContextRef"));
                            }
                            policy_context_ref__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Input => {
                            if input__.is_some() {
                                return Err(serde::de::Error::duplicate_field("input"));
                            }
                            input__ = map_.next_value()?;
                        }
                        GeneratedField::Deadline => {
                            if deadline__.is_some() {
                                return Err(serde::de::Error::duplicate_field("deadline"));
                            }
                            deadline__ = map_.next_value()?;
                        }
                    }
                }
                Ok(ExecuteRequest {
                    metadata: metadata__,
                    workflow_run_id: workflow_run_id__.unwrap_or_default(),
                    idempotency_key: idempotency_key__.unwrap_or_default(),
                    capability: capability__.unwrap_or_default(),
                    input_schema_version: input_schema_version__.unwrap_or_default(),
                    data_snapshot_ref: data_snapshot_ref__.unwrap_or_default(),
                    policy_context_ref: policy_context_ref__.unwrap_or_default(),
                    input: input__,
                    deadline: deadline__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.engine.v1.ExecuteRequest", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for ExecuteResponse {
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
        if !self.execution_id.is_empty() {
            len += 1;
        }
        if !self.engine_version.is_empty() {
            len += 1;
        }
        if !self.input_hash.is_empty() {
            len += 1;
        }
        if !self.artifact_refs.is_empty() {
            len += 1;
        }
        if !self.evidence_refs.is_empty() {
            len += 1;
        }
        if self.output.is_some() {
            len += 1;
        }
        if self.completed_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.engine.v1.ExecuteResponse", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.execution_id.is_empty() {
            struct_ser.serialize_field("executionId", &self.execution_id)?;
        }
        if !self.engine_version.is_empty() {
            struct_ser.serialize_field("engineVersion", &self.engine_version)?;
        }
        if !self.input_hash.is_empty() {
            struct_ser.serialize_field("inputHash", &self.input_hash)?;
        }
        if !self.artifact_refs.is_empty() {
            struct_ser.serialize_field("artifactRefs", &self.artifact_refs)?;
        }
        if !self.evidence_refs.is_empty() {
            struct_ser.serialize_field("evidenceRefs", &self.evidence_refs)?;
        }
        if let Some(v) = self.output.as_ref() {
            struct_ser.serialize_field("output", v)?;
        }
        if let Some(v) = self.completed_at.as_ref() {
            struct_ser.serialize_field("completedAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for ExecuteResponse {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "execution_id",
            "executionId",
            "engine_version",
            "engineVersion",
            "input_hash",
            "inputHash",
            "artifact_refs",
            "artifactRefs",
            "evidence_refs",
            "evidenceRefs",
            "output",
            "completed_at",
            "completedAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            ExecutionId,
            EngineVersion,
            InputHash,
            ArtifactRefs,
            EvidenceRefs,
            Output,
            CompletedAt,
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
                            "executionId" | "execution_id" => Ok(GeneratedField::ExecutionId),
                            "engineVersion" | "engine_version" => Ok(GeneratedField::EngineVersion),
                            "inputHash" | "input_hash" => Ok(GeneratedField::InputHash),
                            "artifactRefs" | "artifact_refs" => Ok(GeneratedField::ArtifactRefs),
                            "evidenceRefs" | "evidence_refs" => Ok(GeneratedField::EvidenceRefs),
                            "output" => Ok(GeneratedField::Output),
                            "completedAt" | "completed_at" => Ok(GeneratedField::CompletedAt),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = ExecuteResponse;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.engine.v1.ExecuteResponse")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<ExecuteResponse, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut execution_id__ = None;
                let mut engine_version__ = None;
                let mut input_hash__ = None;
                let mut artifact_refs__ = None;
                let mut evidence_refs__ = None;
                let mut output__ = None;
                let mut completed_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::ExecutionId => {
                            if execution_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("executionId"));
                            }
                            execution_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::EngineVersion => {
                            if engine_version__.is_some() {
                                return Err(serde::de::Error::duplicate_field("engineVersion"));
                            }
                            engine_version__ = Some(map_.next_value()?);
                        }
                        GeneratedField::InputHash => {
                            if input_hash__.is_some() {
                                return Err(serde::de::Error::duplicate_field("inputHash"));
                            }
                            input_hash__ = Some(map_.next_value()?);
                        }
                        GeneratedField::ArtifactRefs => {
                            if artifact_refs__.is_some() {
                                return Err(serde::de::Error::duplicate_field("artifactRefs"));
                            }
                            artifact_refs__ = Some(map_.next_value()?);
                        }
                        GeneratedField::EvidenceRefs => {
                            if evidence_refs__.is_some() {
                                return Err(serde::de::Error::duplicate_field("evidenceRefs"));
                            }
                            evidence_refs__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Output => {
                            if output__.is_some() {
                                return Err(serde::de::Error::duplicate_field("output"));
                            }
                            output__ = map_.next_value()?;
                        }
                        GeneratedField::CompletedAt => {
                            if completed_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("completedAt"));
                            }
                            completed_at__ = map_.next_value()?;
                        }
                    }
                }
                Ok(ExecuteResponse {
                    metadata: metadata__,
                    execution_id: execution_id__.unwrap_or_default(),
                    engine_version: engine_version__.unwrap_or_default(),
                    input_hash: input_hash__.unwrap_or_default(),
                    artifact_refs: artifact_refs__.unwrap_or_default(),
                    evidence_refs: evidence_refs__.unwrap_or_default(),
                    output: output__,
                    completed_at: completed_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.engine.v1.ExecuteResponse", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for GetMetadataRequest {
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
        let mut struct_ser = serializer.serialize_struct("quantos.engine.v1.GetMetadataRequest", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for GetMetadataRequest {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
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
            type Value = GetMetadataRequest;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.engine.v1.GetMetadataRequest")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<GetMetadataRequest, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                    }
                }
                Ok(GetMetadataRequest {
                    metadata: metadata__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.engine.v1.GetMetadataRequest", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for GetMetadataResponse {
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
        if !self.engine_name.is_empty() {
            len += 1;
        }
        if !self.engine_version.is_empty() {
            len += 1;
        }
        if !self.capabilities.is_empty() {
            len += 1;
        }
        if !self.supported_schema_versions.is_empty() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.engine.v1.GetMetadataResponse", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.engine_name.is_empty() {
            struct_ser.serialize_field("engineName", &self.engine_name)?;
        }
        if !self.engine_version.is_empty() {
            struct_ser.serialize_field("engineVersion", &self.engine_version)?;
        }
        if !self.capabilities.is_empty() {
            struct_ser.serialize_field("capabilities", &self.capabilities)?;
        }
        if !self.supported_schema_versions.is_empty() {
            struct_ser.serialize_field("supportedSchemaVersions", &self.supported_schema_versions)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for GetMetadataResponse {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "engine_name",
            "engineName",
            "engine_version",
            "engineVersion",
            "capabilities",
            "supported_schema_versions",
            "supportedSchemaVersions",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            EngineName,
            EngineVersion,
            Capabilities,
            SupportedSchemaVersions,
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
                            "engineName" | "engine_name" => Ok(GeneratedField::EngineName),
                            "engineVersion" | "engine_version" => Ok(GeneratedField::EngineVersion),
                            "capabilities" => Ok(GeneratedField::Capabilities),
                            "supportedSchemaVersions" | "supported_schema_versions" => Ok(GeneratedField::SupportedSchemaVersions),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = GetMetadataResponse;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.engine.v1.GetMetadataResponse")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<GetMetadataResponse, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut engine_name__ = None;
                let mut engine_version__ = None;
                let mut capabilities__ = None;
                let mut supported_schema_versions__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::EngineName => {
                            if engine_name__.is_some() {
                                return Err(serde::de::Error::duplicate_field("engineName"));
                            }
                            engine_name__ = Some(map_.next_value()?);
                        }
                        GeneratedField::EngineVersion => {
                            if engine_version__.is_some() {
                                return Err(serde::de::Error::duplicate_field("engineVersion"));
                            }
                            engine_version__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Capabilities => {
                            if capabilities__.is_some() {
                                return Err(serde::de::Error::duplicate_field("capabilities"));
                            }
                            capabilities__ = Some(map_.next_value()?);
                        }
                        GeneratedField::SupportedSchemaVersions => {
                            if supported_schema_versions__.is_some() {
                                return Err(serde::de::Error::duplicate_field("supportedSchemaVersions"));
                            }
                            supported_schema_versions__ = Some(map_.next_value()?);
                        }
                    }
                }
                Ok(GetMetadataResponse {
                    metadata: metadata__,
                    engine_name: engine_name__.unwrap_or_default(),
                    engine_version: engine_version__.unwrap_or_default(),
                    capabilities: capabilities__.unwrap_or_default(),
                    supported_schema_versions: supported_schema_versions__.unwrap_or_default(),
                })
            }
        }
        deserializer.deserialize_struct("quantos.engine.v1.GetMetadataResponse", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for HealthRequest {
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
        let mut struct_ser = serializer.serialize_struct("quantos.engine.v1.HealthRequest", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for HealthRequest {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
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
            type Value = HealthRequest;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.engine.v1.HealthRequest")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<HealthRequest, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                    }
                }
                Ok(HealthRequest {
                    metadata: metadata__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.engine.v1.HealthRequest", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for HealthResponse {
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
        if self.ready {
            len += 1;
        }
        if !self.status.is_empty() {
            len += 1;
        }
        if self.observed_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.engine.v1.HealthResponse", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if self.ready {
            struct_ser.serialize_field("ready", &self.ready)?;
        }
        if !self.status.is_empty() {
            struct_ser.serialize_field("status", &self.status)?;
        }
        if let Some(v) = self.observed_at.as_ref() {
            struct_ser.serialize_field("observedAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for HealthResponse {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "ready",
            "status",
            "observed_at",
            "observedAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            Ready,
            Status,
            ObservedAt,
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
                            "ready" => Ok(GeneratedField::Ready),
                            "status" => Ok(GeneratedField::Status),
                            "observedAt" | "observed_at" => Ok(GeneratedField::ObservedAt),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = HealthResponse;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.engine.v1.HealthResponse")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<HealthResponse, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut ready__ = None;
                let mut status__ = None;
                let mut observed_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::Ready => {
                            if ready__.is_some() {
                                return Err(serde::de::Error::duplicate_field("ready"));
                            }
                            ready__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Status => {
                            if status__.is_some() {
                                return Err(serde::de::Error::duplicate_field("status"));
                            }
                            status__ = Some(map_.next_value()?);
                        }
                        GeneratedField::ObservedAt => {
                            if observed_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("observedAt"));
                            }
                            observed_at__ = map_.next_value()?;
                        }
                    }
                }
                Ok(HealthResponse {
                    metadata: metadata__,
                    ready: ready__.unwrap_or_default(),
                    status: status__.unwrap_or_default(),
                    observed_at: observed_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.engine.v1.HealthResponse", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for StreamExecuteRequest {
    #[allow(deprecated)]
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut len = 0;
        if self.request.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.engine.v1.StreamExecuteRequest", len)?;
        if let Some(v) = self.request.as_ref() {
            struct_ser.serialize_field("request", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for StreamExecuteRequest {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "request",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Request,
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
                            "request" => Ok(GeneratedField::Request),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = StreamExecuteRequest;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.engine.v1.StreamExecuteRequest")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<StreamExecuteRequest, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut request__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Request => {
                            if request__.is_some() {
                                return Err(serde::de::Error::duplicate_field("request"));
                            }
                            request__ = map_.next_value()?;
                        }
                    }
                }
                Ok(StreamExecuteRequest {
                    request: request__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.engine.v1.StreamExecuteRequest", FIELDS, GeneratedVisitor)
    }
}
impl serde::Serialize for StreamExecuteResponse {
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
        if !self.execution_id.is_empty() {
            len += 1;
        }
        if !self.sequence_id.is_empty() {
            len += 1;
        }
        if self.delta.is_some() {
            len += 1;
        }
        if !self.artifact_refs.is_empty() {
            len += 1;
        }
        if self.done {
            len += 1;
        }
        if self.emitted_at.is_some() {
            len += 1;
        }
        let mut struct_ser = serializer.serialize_struct("quantos.engine.v1.StreamExecuteResponse", len)?;
        if let Some(v) = self.metadata.as_ref() {
            struct_ser.serialize_field("metadata", v)?;
        }
        if !self.execution_id.is_empty() {
            struct_ser.serialize_field("executionId", &self.execution_id)?;
        }
        if !self.sequence_id.is_empty() {
            struct_ser.serialize_field("sequenceId", &self.sequence_id)?;
        }
        if let Some(v) = self.delta.as_ref() {
            struct_ser.serialize_field("delta", v)?;
        }
        if !self.artifact_refs.is_empty() {
            struct_ser.serialize_field("artifactRefs", &self.artifact_refs)?;
        }
        if self.done {
            struct_ser.serialize_field("done", &self.done)?;
        }
        if let Some(v) = self.emitted_at.as_ref() {
            struct_ser.serialize_field("emittedAt", v)?;
        }
        struct_ser.end()
    }
}
impl<'de> serde::Deserialize<'de> for StreamExecuteResponse {
    #[allow(deprecated)]
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        const FIELDS: &[&str] = &[
            "metadata",
            "execution_id",
            "executionId",
            "sequence_id",
            "sequenceId",
            "delta",
            "artifact_refs",
            "artifactRefs",
            "done",
            "emitted_at",
            "emittedAt",
        ];

        #[allow(clippy::enum_variant_names)]
        enum GeneratedField {
            Metadata,
            ExecutionId,
            SequenceId,
            Delta,
            ArtifactRefs,
            Done,
            EmittedAt,
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
                            "executionId" | "execution_id" => Ok(GeneratedField::ExecutionId),
                            "sequenceId" | "sequence_id" => Ok(GeneratedField::SequenceId),
                            "delta" => Ok(GeneratedField::Delta),
                            "artifactRefs" | "artifact_refs" => Ok(GeneratedField::ArtifactRefs),
                            "done" => Ok(GeneratedField::Done),
                            "emittedAt" | "emitted_at" => Ok(GeneratedField::EmittedAt),
                            _ => Err(serde::de::Error::unknown_field(value, FIELDS)),
                        }
                    }
                }
                deserializer.deserialize_identifier(GeneratedVisitor)
            }
        }
        struct GeneratedVisitor;
        impl<'de> serde::de::Visitor<'de> for GeneratedVisitor {
            type Value = StreamExecuteResponse;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("struct quantos.engine.v1.StreamExecuteResponse")
            }

            fn visit_map<V>(self, mut map_: V) -> std::result::Result<StreamExecuteResponse, V::Error>
                where
                    V: serde::de::MapAccess<'de>,
            {
                let mut metadata__ = None;
                let mut execution_id__ = None;
                let mut sequence_id__ = None;
                let mut delta__ = None;
                let mut artifact_refs__ = None;
                let mut done__ = None;
                let mut emitted_at__ = None;
                while let Some(k) = map_.next_key()? {
                    match k {
                        GeneratedField::Metadata => {
                            if metadata__.is_some() {
                                return Err(serde::de::Error::duplicate_field("metadata"));
                            }
                            metadata__ = map_.next_value()?;
                        }
                        GeneratedField::ExecutionId => {
                            if execution_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("executionId"));
                            }
                            execution_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::SequenceId => {
                            if sequence_id__.is_some() {
                                return Err(serde::de::Error::duplicate_field("sequenceId"));
                            }
                            sequence_id__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Delta => {
                            if delta__.is_some() {
                                return Err(serde::de::Error::duplicate_field("delta"));
                            }
                            delta__ = map_.next_value()?;
                        }
                        GeneratedField::ArtifactRefs => {
                            if artifact_refs__.is_some() {
                                return Err(serde::de::Error::duplicate_field("artifactRefs"));
                            }
                            artifact_refs__ = Some(map_.next_value()?);
                        }
                        GeneratedField::Done => {
                            if done__.is_some() {
                                return Err(serde::de::Error::duplicate_field("done"));
                            }
                            done__ = Some(map_.next_value()?);
                        }
                        GeneratedField::EmittedAt => {
                            if emitted_at__.is_some() {
                                return Err(serde::de::Error::duplicate_field("emittedAt"));
                            }
                            emitted_at__ = map_.next_value()?;
                        }
                    }
                }
                Ok(StreamExecuteResponse {
                    metadata: metadata__,
                    execution_id: execution_id__.unwrap_or_default(),
                    sequence_id: sequence_id__.unwrap_or_default(),
                    delta: delta__,
                    artifact_refs: artifact_refs__.unwrap_or_default(),
                    done: done__.unwrap_or_default(),
                    emitted_at: emitted_at__,
                })
            }
        }
        deserializer.deserialize_struct("quantos.engine.v1.StreamExecuteResponse", FIELDS, GeneratedVisitor)
    }
}
