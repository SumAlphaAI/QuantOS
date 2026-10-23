//! Owner-only R03 completion -> C05 catalog handoff. No JSON import endpoint.
use super::*;
use quantos_core::WorkflowRunId;
use quantos_runtime::{
    InMemoryRuntimeKernel,
    research::{InMemoryResearchArtifactRepository, completed_record},
};
use quantos_storage::{
    InMemoryArtifactCatalog, InMemoryDataSnapshotCatalog, SnapshotQualityGate,
    SnapshotQualityRuleset, SnapshotUsage,
};
use quantos_strategy::{
    DraftArtifactRef, backtest::BacktestRequest, generated::GeneratedStrategyAdapter,
};

impl StrategyHost {
    pub(crate) fn research_trace(
        &self,
        auth: &AuthContext,
        path: &str,
        body: &Value,
    ) -> Option<Uuid> {
        let parts: Vec<_> = path.trim_matches('/').split('/').collect();
        let id = parts.get(2).and_then(|v| Uuid::parse_str(v).ok());
        let strategy = match parts.get(1).copied()? {
            "strategies" => id,
            "backtests" => id
                .and_then(|i| self.runs.get(&i))
                .and_then(|v| uid(v, "strategyId").ok())
                .or_else(|| uid(body, "strategyId").ok()),
            "releases" => id
                .and_then(|i| self.releases.get(&i))
                .and_then(|v| uid(v, "strategyId").ok())
                .or_else(|| uid(body, "strategyId").ok()),
            "approvals" => id
                .and_then(|i| self.approvals.get(&i))
                .and_then(|v| uid(v, "objectRef").ok())
                .and_then(|i| self.releases.get(&i))
                .and_then(|v| uid(v, "strategyId").ok()),
            _ => None,
        }?;
        self.draft(auth, strategy).ok()?;
        self.lineages.get(&strategy).copied()
    }
}

impl crate::BffProvider {
    /// Installs a fresh, process-local catalog from actual completed worker runs.
    /// All inputs are checked before publication; existing catalogs cannot be replaced.
    /// Persistent/target deployment and browser identity remain separate obligations.
    pub async fn install_completed_research_strategies(
        &self,
        auth: &AuthContext,
        runtime: &InMemoryRuntimeKernel,
        repository: &InMemoryResearchArtifactRepository,
        snapshots: InMemoryDataSnapshotCatalog,
        rules: SnapshotQualityRuleset,
        runs: Vec<(WorkflowRunId, BacktestRequest)>,
    ) -> std::result::Result<Vec<Value>, &'static str> {
        if !can(auth, Capability::STRATEGY_WRITE)
            || !matches!(auth.mode, RunMode::Paper | RunMode::Shadow)
            || runs.is_empty()
            || runs.len() > 1000
        {
            return Err("research registration forbidden");
        }
        let mut data = self.data.lock().await;
        if data.strategy.is_some() {
            return Err("catalog already installed");
        }
        let now = data.now();
        let mut seen = BTreeSet::new();
        let mut roots = BTreeSet::new();
        let mut artifacts = InMemoryArtifactCatalog::new();
        let mut inputs = Vec::new();
        let mut completions = Vec::new();
        for (id, request) in runs {
            if !seen.insert(id) {
                return Err("duplicate worker run");
            }
            let run = runtime.run(id).ok_or("worker run missing")?;
            if !roots.insert(run.correlation_id) {
                return Err("duplicate research trace");
            }
            let record = completed_record(runtime, repository, id)
                .map_err(|_| "worker provenance invalid")?;
            let parent_id = record
                .artifact_manifest
                .metadata
                .get("source_research_run")
                .and_then(|v| WorkflowRunId::parse_str(v).ok())
                .ok_or("parent missing")?;
            let parent = runtime.run(parent_id).ok_or("parent missing")?;
            let research = completed_record(runtime, repository, parent_id)
                .map_err(|_| "parent provenance invalid")?;
            if run.tenant_id != auth.tenant_id
                || run.workspace_id != auth.workspace_id
                || run.actor_id != auth.actor_id
                || run.account_id != auth.account_id
                || parent.runtime_session_id != run.runtime_session_id
                || parent.correlation_id != run.correlation_id
                || parent.tenant_id != run.tenant_id
                || parent.workspace_id != run.workspace_id
                || parent.actor_id != run.actor_id
                || research.output["artifact_type"] != "ResearchArtifact"
                || record.capability != "strategy.generate.v1"
                || research.data_snapshot_id != record.data_snapshot_id
                || record.data_snapshot_id != request.snapshot.snapshot_id
                || snapshots.get(auth.tenant_id, record.data_snapshot_id) != Some(&request.snapshot)
                || record.output["data_snapshot_ref"] != record.data_snapshot_id.to_string()
                || record.output["policy_context_ref"] != research.output["policy_context_ref"]
            {
                return Err("worker scope or snapshot binding invalid");
            }
            let decision = SnapshotQualityGate::evaluate(
                &request.snapshot,
                SnapshotUsage::Strategy,
                now,
                &rules,
            );
            if !decision.allowed {
                return Err("snapshot gate refused");
            }
            GeneratedStrategyAdapter::from_draft_payload(&record.output)
                .map_err(|_| "generated strategy rejected")?;
            let mut refs = [research, record]
                .map(|r| {
                    artifacts.upsert(r.artifact_manifest.clone());
                    DraftArtifactRef {
                        artifact_id: r.artifact_manifest.artifact_id,
                        content_hash: r.artifact_manifest.content_hash.clone(),
                    }
                })
                .to_vec();
            for support in &record.supporting_artifacts {
                artifacts.upsert(support.artifact_manifest.clone());
                refs.push(DraftArtifactRef {
                    artifact_id: support.artifact_manifest.artifact_id,
                    content_hash: support.artifact_manifest.content_hash.clone(),
                });
            }
            inputs.push(StrategyInput {
                tenant_id: auth.tenant_id,
                workspace_id: auth.workspace_id,
                input_id: Uuid::new_v4(),
                request,
                payload: record.output.clone(),
                artifact_refs: refs,
            });
            completions.push((
                run.clone(),
                parent.clone(),
                research.clone(),
                record.clone(),
            ));
        }
        let drafts = DraftService::new(snapshots.clone(), artifacts, rules);
        let ids: Vec<_> = inputs.iter().map(|v| v.input_id).collect();
        let mut host = StrategyHost::new(drafts, inputs)?;
        let mut registrations = Vec::new();
        for (input, (run, parent, research, record)) in ids.into_iter().zip(completions) {
            let strategy = host.register_strategy(
                auth,
                &format!(
                    "{} / {}",
                    record.output["strategy"]["name"]
                        .as_str()
                        .unwrap_or("Research strategy"),
                    run.workflow_run_id
                ),
                input,
                now,
            )?;
            let correlation = *run.correlation_id.as_uuid();
            host.lineages.insert(strategy, correlation);
            let mut canonical_artifacts=[&research,&record].map(|r|json!({"artifactId":r.artifact_manifest.artifact_id,"sha256":r.artifact_manifest.content_hash,"canonicalUtf8":String::from_utf8(quantos_core::canonical_json_bytes(&r.output).expect("verified JSON")).unwrap()})).to_vec();
            for r in &record.supporting_artifacts {
                canonical_artifacts.push(json!({"artifactId":r.artifact_manifest.artifact_id,"sha256":r.artifact_manifest.content_hash,"canonicalUtf8":String::from_utf8(quantos_core::canonical_json_bytes(&r.output).unwrap()).unwrap()}));
            }
            registrations.push(json!({"canonicalArtifacts":canonical_artifacts,"strategyId":strategy,"correlationId":correlation,"researchRun":parent,"strategyRun":run,"researchArtifact":research,"strategyArtifact":record}));
        }
        // No fallible operations after this point: publication is atomic under the provider lock.
        for item in &registrations {
            let correlation = item["correlationId"].as_str().unwrap();
            let mut cause = None;
            for (kind, object, commitment, route) in [
                (
                    "research.worker.completed",
                    item["researchRun"]["workflow_run_id"].clone(),
                    item["researchArtifact"].clone(),
                    format!(
                        "/research/{}",
                        item["researchRun"]["workflow_run_id"].as_str().unwrap()
                    ),
                ),
                (
                    "strategy.worker.completed",
                    item["strategyRun"]["workflow_run_id"].clone(),
                    item["strategyArtifact"].clone(),
                    format!(
                        "/artifacts/{}",
                        item["strategyArtifact"]["artifact_manifest"]["artifact_id"]
                            .as_str()
                            .unwrap()
                    ),
                ),
                (
                    "strategy.registered",
                    item["strategyId"].clone(),
                    item.clone(),
                    format!("/strategies/{}/lab", item["strategyId"].as_str().unwrap()),
                ),
            ] {
                let event = crate::record_audit_action(
                    &mut data,
                    kind,
                    correlation,
                    object.as_str().unwrap(),
                    json!({"outcome":"succeeded","scopeHash":crate::audit_core::payload_hash(&commitment)}),
                );
                let e = data.audits.last_mut().unwrap();
                e.as_object_mut().unwrap().remove("causationId");
                if let Some(c) = cause {
                    e["causationId"] = json!(c);
                }
                e["route"] = json!(route);
                e["actor"] = json!(auth.actor_id);
                cause = Some(event);
            }
            let research_id = Uuid::parse_str(
                item["researchArtifact"]["artifact_manifest"]["artifact_id"]
                    .as_str()
                    .unwrap(),
            )
            .unwrap();
            let run = &item["researchRun"];
            let run_id = Uuid::parse_str(run["workflow_run_id"].as_str().unwrap()).unwrap();
            let audit_ref = data.audits[data.audits.len() - 3]["auditRef"].clone();
            data.research.runs.insert(run_id,json!({"runId":run_id,"capability":run["capability"],"dataSnapshotId":item["researchArtifact"]["data_snapshot_id"],"budget":run["cost_budget_units"].as_u64().unwrap().to_string(),"deadlineAt":run["deadline_at"],"status":run["status"],"inputHash":run["input_hash"],"engineVersion":"r03-worker-owned-uds","artifactRefs":[research_id],"evidenceRefs":[],"correlationId":correlation,"auditRef":audit_ref,"createdAt":run["created_at"]}));
            data.research.events.insert(run_id,vec![json!({"streamId":run_id,"sequence":1,"eventId":Uuid::now_v7(),"occurredAt":run["completed_at"],"correlationId":correlation,"payloadVersion":"v1","payload":{"type":"research.succeeded","runId":run_id,"status":"succeeded"}})]);
            for key in ["researchArtifact", "strategyArtifact"] {
                let record: quantos_runtime::research::ResearchArtifactRecord =
                    serde_json::from_value(item[key].clone()).expect("serialized verified record");
                for support in &record.supporting_artifacts {
                    let mut projected = record.clone();
                    projected.artifact_manifest = support.artifact_manifest.clone();
                    projected.engine_artifact_id = support.engine_artifact_id.clone();
                    projected.output = support.output.clone();
                    projected.supporting_artifacts.clear();
                    data.research.worker_records.insert(
                        *projected.artifact_manifest.artifact_id.as_uuid(),
                        projected,
                    );
                }
                data.research
                    .worker_records
                    .insert(*record.artifact_manifest.artifact_id.as_uuid(), record);
            }
            let input =
                host.drafts[&Uuid::parse_str(item["strategyId"].as_str().unwrap()).unwrap()].input;
            let snapshot = &host.inputs[&input].request.snapshot;
            data.research.snapshots.insert(*snapshot.snapshot_id.as_uuid(),json!({"snapshotId":snapshot.snapshot_id,"schemaVersion":"v1","window":{"start":snapshot.window.start_at,"end":snapshot.window.end_at},"sources":snapshot.sources.iter().map(|s|s.source_id.clone()).collect::<Vec<_>>(),"quality":"verified","qualityBlocked":false,"contentHash":snapshot.content_hash,"licenseLabel":snapshot.license_label,"capturedAt":snapshot.captured_at,"maxAgeSeconds":snapshot.max_age_secs}));
        }
        data.strategy = Some(host);
        Ok(registrations)
    }
}
