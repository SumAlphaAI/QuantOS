//! Real loopback TCP HTTP composition. No database, production credential or external deployment.
use chrono::{DateTime, Duration, Utc};
use quantos_auth::AuthContext;
use quantos_core::{
    ActorId, ContentHash, ProposalId, StrategyDraftId, TenantId, WorkspaceId, canonical_json_bytes,
};
use quantos_policy::{Capability, Role};
use quantos_storage::{
    ArtifactManifest, InMemoryArtifactCatalog, InMemoryDataSnapshotCatalog, SnapshotQualityRuleset,
    default_quality_rules,
};
use quantos_strategy::{
    DraftArtifactRef,
    backtest::{BacktestRequest, BacktestValidationReport, run_backtest},
    drafts::DraftService,
    generated::GeneratedStrategyAdapter,
    http::{SessionError, SessionResolver, router},
    release::{DeploymentTarget, ReleasePublishInput},
    service::{Clock, StrategyInput, StrategyService},
};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
    process::Command,
    sync::{
        Arc,
        atomic::{AtomicI64, Ordering},
    },
};
use uuid::Uuid;
#[allow(dead_code)]
#[path = "support/release_fixture.rs"]
mod fixture;
struct FixedClock(AtomicI64);
impl Clock for FixedClock {
    fn now(&self) -> DateTime<Utc> {
        DateTime::from_timestamp(self.0.load(Ordering::SeqCst), 0).unwrap()
    }
}
struct Sessions(BTreeMap<String, (AuthContext, DateTime<Utc>)>);
impl SessionResolver for Sessions {
    fn resolve(&self, token: &str, now: DateTime<Utc>) -> Result<AuthContext, SessionError> {
        self.0
            .get(token)
            .filter(|(_, until)| now < *until)
            .map(|(a, _)| a.clone())
            .ok_or(SessionError::Unauthenticated)
    }
}
struct Harness {
    clock: Arc<FixedClock>,
    request: BacktestRequest,
    payload: Value,
    input: Uuid,
    bad_input: Uuid,
    legacy: ProposalId,
    url: String,
    client: reqwest::Client,
    task: tokio::task::JoinHandle<()>,
}
impl Drop for Harness {
    fn drop(&mut self) {
        self.task.abort();
    }
}
impl Harness {
    async fn new(payload: Value) -> Self {
        let (mut owner, _) = fixture::fixture(&payload);
        let mut request = fixture::honest_request();
        owner.tenant_id = request.snapshot.tenant_id;
        owner.role = Role::Owner;
        owner.capabilities =
            BTreeSet::from([Capability::parse(Capability::STRATEGY_WRITE).unwrap()]);
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        request.candidate.source_commit = quantos_core::fixture_source::fixture_source_commit(
            &root,
            std::env::var("GITHUB_SHA").ok().as_deref(),
        )
        .expect("owned fixture requires a checkout HEAD or frozen archive SHA");
        request.candidate.image_digest =
            ContentHash::sha256_bytes(&std::fs::read(std::env::current_exe().unwrap()).unwrap());
        request.candidate.runtime_digest =
            ContentHash::sha256_bytes(&std::fs::read(root.join("Cargo.lock")).unwrap());
        // Normalize the owned server clock; all request clocks are supplied by the host.
        let base = request.candidate.clock.timestamp();
        let clock = Arc::new(FixedClock(AtomicI64::new(base + 1)));
        request.candidate.clock = clock.now();
        let mut bad = payload.clone();
        bad["release_eligible"] = json!(false);
        bad["static_check"] = json!({"passed":false,"findings":["owned fixture static failure"]});
        let mut artifacts = InMemoryArtifactCatalog::new();
        let mut inputs = Vec::new();
        for value in [&payload, &bad] {
            let bytes = canonical_json_bytes(value).unwrap();
            let artifact = ArtifactManifest::new(
                owner.tenant_id,
                "application/json",
                ContentHash::sha256_bytes(&bytes),
                "owned-service-s04-fixture",
                bytes.len() as u64,
                clock.now(),
            );
            let refs = vec![DraftArtifactRef {
                artifact_id: artifact.artifact_id,
                content_hash: artifact.content_hash.clone(),
            }];
            artifacts.upsert(artifact);
            inputs.push(StrategyInput {
                tenant_id: owner.tenant_id,
                workspace_id: owner.workspace_id,
                input_id: Uuid::now_v7(),
                request: request.clone(),
                payload: value.clone(),
                artifact_refs: refs,
            });
        }
        let input = inputs[0].input_id;
        let bad_input = inputs[1].input_id;
        let mut snapshots = InMemoryDataSnapshotCatalog::new();
        snapshots.upsert(request.snapshot.clone()).unwrap();
        let drafts = DraftService::new(
            snapshots,
            artifacts,
            SnapshotQualityRuleset::from_rules(default_quality_rules(owner.tenant_id, clock.now()))
                .unwrap(),
        );
        let service = Arc::new(StrategyService::new(drafts, inputs, clock.clone()).unwrap());
        let legacy = service
            .import_legacy(
                &owner,
                ReleasePublishInput {
                    draft_id: StrategyDraftId::new(),
                    draft_version: 1,
                    name: "legacy hash-only candidate".into(),
                    source_digest: request.candidate.source_commit.clone(),
                    image_digest: request.candidate.image_digest.to_string(),
                    parameter_hash: ContentHash::sha256_bytes(b"legacy params"),
                    backtest_report_hash: Some(ContentHash::sha256_bytes(
                        b"caller hash is not verification",
                    )),
                    data_snapshot_id: request.snapshot.snapshot_id,
                    evidence_refs: vec![],
                    allowed_targets: vec![DeploymentTarget::Paper, DeploymentTarget::Shadow],
                    published_at: clock.now(),
                },
            )
            .unwrap()
            .release_id;
        let mut approver = owner.clone();
        approver.actor_id = ActorId::new();
        approver.user_id = Uuid::now_v7();
        approver.role = Role::Approver;
        approver.capabilities =
            BTreeSet::from([Capability::parse(Capability::STRATEGY_APPROVE).unwrap()]);
        let mut dual = owner.clone();
        dual.capabilities
            .insert(Capability::parse(Capability::STRATEGY_APPROVE).unwrap());
        let mut viewer = owner.clone();
        viewer.role = Role::Viewer;
        viewer.capabilities.clear();
        let mut workspace = owner.clone();
        workspace.workspace_id = WorkspaceId::new();
        let mut tenant = owner.clone();
        tenant.tenant_id = TenantId::new();
        let until = clock.now() + Duration::days(2);
        let sessions = Sessions(BTreeMap::from([
            ("owned-owner".into(), (owner.clone(), until)),
            ("owned-approver".into(), (approver, until)),
            ("owned-dual".into(), (dual, until)),
            ("owned-viewer".into(), (viewer, until)),
            ("owned-workspace".into(), (workspace, until)),
            ("owned-tenant".into(), (tenant, until)),
            (
                "owned-expired".into(),
                (owner, clock.now() - Duration::seconds(1)),
            ),
        ]));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/strategy/v1", listener.local_addr().unwrap());
        let app = router(service.clone(), Arc::new(sessions));
        let task = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap();
        Self {
            clock,
            request,
            payload,
            input,
            bad_input,
            legacy,
            url,
            client,
            task,
        }
    }
    async fn call(
        &self,
        token: &str,
        method: &str,
        path: &str,
        body: Option<Value>,
    ) -> (u16, Value) {
        let mut request = self
            .client
            .request(method.parse().unwrap(), format!("{}{}", self.url, path));
        if !token.is_empty() {
            request = request.bearer_auth(token);
        }
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request.send().await.unwrap();
        let status = response.status().as_u16();
        assert_eq!(response.headers()["cache-control"], "no-store");
        let correlation = response.headers()["x-correlation-id"]
            .to_str()
            .unwrap()
            .to_owned();
        assert!(Uuid::parse_str(&correlation).is_ok());
        let value: Value = response.json().await.unwrap();
        if status >= 400 {
            assert_eq!(value["correlation_id"], correlation);
        }
        (status, value)
    }
    async fn ok(&self, token: &str, method: &str, path: &str, body: Option<Value>) -> Value {
        let (status, value) = self.call(token, method, path, body).await;
        assert_eq!(status, 200, "{path}: {value}");
        value
    }
    async fn draft(&self, input: Uuid) -> String {
        let draft = self
            .ok(
                "owned-owner",
                "POST",
                "/drafts",
                Some(json!({"name":"owned S04 strategy"})),
            )
            .await;
        let id = draft["draft_id"].as_str().unwrap().to_owned();
        self.ok(
            "owned-owner",
            "PUT",
            &format!("/drafts/{id}"),
            Some(json!({"base_version":0,"parameters":self.payload["strategy"],"input_id":input})),
        )
        .await;
        id
    }
    async fn release(&self) -> (String, Value, Value) {
        let id = self.draft(self.input).await;
        self.ok(
            "owned-owner",
            "POST",
            &format!("/drafts/{id}/static-check"),
            Some(json!({"input_id":self.input})),
        )
        .await;
        let report = self
            .ok(
                "owned-owner",
                "POST",
                "/backtests",
                Some(json!({"draft_id":id,"input_id":self.input})),
            )
            .await;
        let release=self.ok("owned-owner","POST","/releases",Some(json!({"backtest_id":report["backtest_id"],"allowed_targets":["paper","shadow"]}))).await;
        (
            release["release"]["release_id"].as_str().unwrap().into(),
            release,
            report,
        )
    }
    async fn approve(&self, id: &str, hash: &Value, ttl: i64) -> Value {
        self.ok(
            "owned-approver",
            "POST",
            &format!("/releases/{id}/approval"),
            Some(json!({"content_hash":hash,"decision":"approve","ttl_seconds":ttl})),
        )
        .await
    }
    async fn audit(&self) -> Value {
        let value = self
            .ok("owned-approver", "GET", "/audit?limit=200", None)
            .await;
        verify_audit(value["items"].as_array().unwrap());
        value
    }
}
fn verify_audit(rows: &[Value]) {
    let mut previous = ContentHash::sha256_bytes(b"strategy-audit/v1").to_string();
    for (i, row) in rows.iter().enumerate() {
        assert_eq!(row["sequence"], (i + 1) as u64);
        assert_eq!(row["previous_hash"], previous);
        let mut payload = row.clone();
        payload.as_object_mut().unwrap().remove("content_hash");
        assert_eq!(
            row["content_hash"],
            ContentHash::sha256_bytes(&canonical_json_bytes(&payload).unwrap()).to_string()
        );
        previous = row["content_hash"].as_str().unwrap().into();
    }
}
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn service_s04_owned_tcp_generator_to_release_and_two_consumers() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let output = Command::new(root.join("engines/.venv/bin/python"))
        .arg(root.join("scripts/tp06-produce.py"))
        .current_dir(&root)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let values: Vec<Value> = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(values.len(), 102);
    let h = Harness::new(values[0].clone()).await;
    h.ok(
        "owned-owner",
        "POST",
        "/lab/preview",
        Some(json!({"input_id":h.input})),
    )
    .await;
    let (id, pending, report) = h.release().await;
    assert_eq!(pending["approval_state"], "pending");
    assert_eq!(pending["deployable_targets"], json!([]));
    assert_eq!(
        h.call(
            "owned-owner",
            "POST",
            &format!("/releases/{id}/deployments"),
            Some(json!({"target":"paper"}))
        )
        .await
        .0,
        409
    );
    let approved = h
        .approve(&id, &pending["release"]["content_hash"], 60)
        .await;
    assert_eq!(approved["approval_state"], "approved");
    assert_eq!(
        approved["release"]["content_hash"],
        pending["release"]["content_hash"]
    );
    let writer_view = h
        .ok("owned-owner", "GET", &format!("/releases/{id}"), None)
        .await;
    assert_eq!(
        writer_view["deployable_targets"],
        json!(["paper", "shadow"])
    );
    assert_eq!(approved["deployable_targets"], json!([]));
    let mut hashes = Vec::new();
    for target in ["paper", "shadow"] {
        let ticket = h
            .ok(
                "owned-owner",
                "POST",
                &format!("/releases/{id}/deployments"),
                Some(json!({"target":target})),
            )
            .await;
        let again = h
            .ok(
                "owned-owner",
                "POST",
                &format!("/releases/{id}/deployments"),
                Some(json!({"target":target})),
            )
            .await;
        assert_eq!(ticket, again);
        let config = h
            .ok(
                "owned-owner",
                "POST",
                &format!(
                    "/deployments/{}/consume",
                    ticket["deployment_id"].as_str().unwrap()
                ),
                Some(json!({})),
            )
            .await;
        assert_eq!(config["release_hash"], approved["release"]["content_hash"]);
        let mut payload = h.payload.clone();
        payload["strategy"] = config["parameters"].clone();
        let mut adapter = GeneratedStrategyAdapter::from_draft_payload(&payload).unwrap();
        let mut request = h.request.clone();
        request.draft = serde_json::from_value(report["report"]["draft"].clone()).unwrap();
        let replay = run_backtest(&request, &mut adapter).unwrap();
        assert_eq!(
            replay.report_hash.as_str(),
            report["report"]["report_hash"].as_str().unwrap()
        );
        hashes.push(replay.report_hash);
    }
    let decoded: BacktestValidationReport =
        serde_json::from_value(report["report"].clone()).unwrap();
    decoded.verify_integrity().unwrap();
    let audit = h.audit().await;
    println!("SERVICE_S04_EVIDENCE={}",serde_json::to_string(&json!({"source_commit":h.request.candidate.source_commit,"release":approved,"backtest":report,"consumer_report_hashes":hashes,"audit":audit,"transport":"owned-loopback-tcp","generator_artifacts":values.len(),"databaseExecution":false,"externalPublished":false})).unwrap());
}
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn service_s04_hundred_unverified_unapproved_denials_are_audited() {
    let h = Harness::new(fixture::payload()).await;
    let (pending, _, _) = h.release().await;
    for n in 0..50 {
        for (id, code) in [
            (h.legacy.to_string(), "RELEASE_UNVERIFIED"),
            (pending.clone(), "RELEASE_UNAPPROVED"),
        ] {
            let (status, v) = h
                .call(
                    "owned-owner",
                    "POST",
                    &format!("/releases/{id}/deployments"),
                    Some(json!({"target":if n%2==0{"paper"}else{"shadow"}})),
                )
                .await;
            assert_eq!(status, 409);
            assert_eq!(v["code"], code);
        }
    }
    let audit = h.audit().await;
    assert_eq!(
        audit["items"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|e| e["operation"] == "deployment.create" && e["status"] == 409)
            .count(),
        100
    );
}
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn service_s04_capability_scope_session_and_identity_forgery_are_rejected() {
    let h = Harness::new(fixture::payload()).await;
    let (id, release, backtest) = h.release().await;
    let draft = backtest["report"]["draft"]["draft_id"].as_str().unwrap();
    for token in ["", "unknown-owned-token", "owned-expired"] {
        assert_eq!(h.call(token, "GET", "/catalog", None).await.0, 401);
    }
    assert_eq!(h.call("owned-viewer", "GET", "/catalog", None).await.0, 403);
    for token in ["owned-workspace", "owned-tenant"] {
        assert_eq!(
            h.ok(token, "GET", "/catalog", None).await["items"],
            json!([])
        );
        for path in [
            format!("/drafts/{draft}"),
            format!("/releases/{id}"),
            format!("/backtests/{}", backtest["backtest_id"].as_str().unwrap()),
        ] {
            assert_eq!(h.call(token, "GET", &path, None).await.0, 404);
        }
    }
    let response = h
        .client
        .post(format!("{}/drafts", h.url))
        .bearer_auth("owned-viewer")
        .header("x-role", "owner")
        .header("x-capabilities", "strategy.write")
        .json(&json!({"name":"forged"}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status().as_u16(), 403);
    assert_eq!(
        h.call("owned-owner", "GET", "/catalog?workspace_id=forged", None)
            .await
            .0,
        422
    );
    assert_eq!(h.call("owned-owner","POST",&format!("/releases/{id}/approval"),Some(json!({"content_hash":release["release"]["content_hash"],"decision":"approve","ttl_seconds":60}))).await.0,403);
    let self_approval=h.call("owned-dual","POST",&format!("/releases/{id}/approval"),Some(json!({"content_hash":release["release"]["content_hash"],"decision":"approve","ttl_seconds":60}))).await;
    assert_eq!(self_approval.1["code"], "SELF_APPROVAL_FORBIDDEN");
    assert_eq!(
        h.ok("owned-dual", "GET", &format!("/releases/{id}"), None)
            .await["can_approve"],
        false
    );
    assert_eq!(
        h.ok("owned-approver", "GET", &format!("/releases/{id}"), None)
            .await["can_approve"],
        true
    );
    for path in [
        "/catalog?after_sequence=1",
        "/audit?after=00000000-0000-4000-8000-000000000000",
        "/releases/bad?limit=1",
    ] {
        assert_eq!(h.call("owned-owner", "GET", path, None).await.0, 422);
    }
    let unsupported = h
        .client
        .post(format!("{}/drafts", h.url))
        .bearer_auth("owned-owner")
        .header("content-type", "text/plain")
        .body("{\"name\":\"ignored\"}")
        .send()
        .await
        .unwrap();
    assert_eq!(unsupported.status().as_u16(), 415);

    assert_eq!(
        h.call(
            "owned-approver",
            "POST",
            "/drafts",
            Some(json!({"name":"not a writer"}))
        )
        .await
        .0,
        403
    );
    let catalog = h.ok("owned-approver", "GET", "/catalog", None).await;
    assert_eq!(catalog["items"][0]["allowed_targets"], json!([]));
    h.audit().await;
}
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn service_s04_static_failures_bad_inputs_and_stale_versions_recover() {
    let h = Harness::new(fixture::payload()).await;
    let draft = h.draft(h.bad_input).await;
    assert_eq!(
        h.call(
            "owned-owner",
            "POST",
            "/lab/preview",
            Some(json!({"input_id":h.bad_input}))
        )
        .await
        .0,
        422
    );
    assert_eq!(
        h.call(
            "owned-owner",
            "POST",
            &format!("/drafts/{draft}/static-check"),
            Some(json!({"input_id":h.bad_input}))
        )
        .await
        .0,
        422
    );
    assert_eq!(
        h.call(
            "owned-owner",
            "POST",
            "/backtests",
            Some(json!({"draft_id":draft,"input_id":h.bad_input}))
        )
        .await
        .0,
        422
    );
    assert_eq!(
        h.call(
            "owned-owner",
            "PUT",
            &format!("/drafts/{draft}"),
            Some(json!({"base_version":0,"parameters":h.payload["strategy"],"input_id":h.input}))
        )
        .await
        .0,
        409
    );
    h.ok(
        "owned-owner",
        "PUT",
        &format!("/drafts/{draft}"),
        Some(json!({"base_version":1,"parameters":h.payload["strategy"],"input_id":h.input})),
    )
    .await;
    h.ok(
        "owned-owner",
        "POST",
        &format!("/drafts/{draft}/static-check"),
        Some(json!({"input_id":h.input})),
    )
    .await;
    let r = h
        .ok(
            "owned-owner",
            "POST",
            "/backtests",
            Some(json!({"draft_id":draft,"input_id":h.input})),
        )
        .await;
    assert_eq!(r["report"]["draft"]["version"], 2);
    h.audit().await;
}
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn service_s04_approval_rejection_expiry_hash_and_twenty_way_cas_are_audited() {
    let h = Harness::new(fixture::payload()).await;
    let (id, r, _) = h.release().await;
    let path = format!("/releases/{id}/approval");
    assert_eq!(h.call("owned-approver","POST",&path,Some(json!({"content_hash":ContentHash::sha256_bytes(b"wrong"),"decision":"approve","ttl_seconds":30}))).await.0,412);
    assert_eq!(h.call("owned-approver","POST",&path,Some(json!({"content_hash":r["release"]["content_hash"],"decision":"approve","ttl_seconds":0}))).await.0,422);
    let requests = (0..20)
        .map(|_| {
            let client = h.client.clone();
            let url = format!("{}{}", h.url, path);
            let hash = r["release"]["content_hash"].clone();
            tokio::spawn(async move {
                let response = client
                    .post(url)
                    .bearer_auth("owned-approver")
                    .json(&json!({"content_hash":hash,"decision":"approve","ttl_seconds":30}))
                    .send()
                    .await
                    .unwrap();
                (
                    response.status().as_u16(),
                    response.json::<Value>().await.unwrap(),
                )
            })
        })
        .collect::<Vec<_>>();
    let mut passed = 0;
    let mut conflicts = 0;
    for request in requests {
        let (status, v) = request.await.unwrap();
        if status == 200 {
            passed += 1;
        } else {
            assert_eq!(status, 409);
            assert_eq!(v["code"], "APPROVAL_CONFLICT");
            conflicts += 1;
        }
    }
    assert_eq!((passed, conflicts), (1, 19));
    let ticket = h
        .ok(
            "owned-owner",
            "POST",
            &format!("/releases/{id}/deployments"),
            Some(json!({"target":"paper"})),
        )
        .await;
    h.clock.0.fetch_add(31, Ordering::SeqCst);
    assert_eq!(
        h.ok("owned-owner", "GET", &format!("/releases/{id}"), None)
            .await["approval_state"],
        "expired"
    );
    assert_eq!(
        h.call(
            "owned-owner",
            "POST",
            &format!("/releases/{id}/deployments"),
            Some(json!({"target":"paper"}))
        )
        .await
        .0,
        410
    );
    assert_eq!(
        h.call(
            "owned-owner",
            "POST",
            &format!(
                "/deployments/{}/consume",
                ticket["deployment_id"].as_str().unwrap()
            ),
            None
        )
        .await
        .0,
        410
    );
    let (rejected, r, _) = h.release().await;
    let v = h
        .ok(
            "owned-approver",
            "POST",
            &format!("/releases/{rejected}/approval"),
            Some(json!({"content_hash":r["release"]["content_hash"],"decision":"reject"})),
        )
        .await;
    assert_eq!(v["approval_state"], "rejected");
    assert_eq!(
        h.call(
            "owned-owner",
            "POST",
            &format!("/releases/{rejected}/deployments"),
            Some(json!({"target":"shadow"}))
        )
        .await
        .1["code"],
        "RELEASE_REJECTED"
    );
    let (recovered, r, _) = h.release().await;
    h.approve(&recovered, &r["release"]["content_hash"], 30)
        .await;
    h.ok(
        "owned-owner",
        "POST",
        &format!("/releases/{recovered}/deployments"),
        Some(json!({"target":"shadow"})),
    )
    .await;
    let audit = h.audit().await;
    assert_eq!(
        audit["items"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|v| v["code"] == "APPROVAL_CONFLICT")
            .count(),
        19
    );
    assert!(
        audit["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v["code"] == "RELEASE_EXPIRED")
    );
}
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn service_s04_hundred_provenance_forgery_requests_and_limits_are_rejected() {
    let h = Harness::new(fixture::payload()).await;
    let draft = h.draft(h.input).await;
    let fields = [
        "tenant_id",
        "workspace_id",
        "actor_id",
        "role",
        "capabilities",
        "source_commit",
        "image_digest",
        "runtime_digest",
        "clock",
        "report_hash",
        "validation",
        "approval",
        "approved_by",
        "approved_at",
        "source_digest",
        "environment_hash",
        "secret",
        "order",
        "venue",
        "session",
    ];
    for shape in [
        Value::Null,
        json!("owned-sensitive-marker"),
        json!(true),
        json!({"injected":"owned-sensitive-marker"}),
        json!(["owned-sensitive-marker"]),
    ] {
        for field in fields {
            let mut body = json!({"draft_id":draft,"input_id":h.input});
            body[field] = shape.clone();
            assert_eq!(
                h.call("owned-owner", "POST", "/backtests", Some(body))
                    .await
                    .0,
                422
            );
        }
    }
    assert_eq!(
        h.call("owned-owner", "GET", "/catalog?limit=201", None)
            .await
            .0,
        422
    );
    let body = json!({"name":"x".repeat(70_000)});
    assert_eq!(
        h.call("owned-owner", "POST", "/drafts", Some(body)).await.0,
        413
    );
    let (id, r, _) = h.release().await;
    h.approve(&id, &r["release"]["content_hash"], 30).await;
    assert_eq!(
        h.call(
            "owned-owner",
            "POST",
            &format!("/releases/{id}/deployments"),
            Some(json!({"target":"assisted_live"}))
        )
        .await
        .0,
        422
    );
    let audit = h.audit().await;
    let text = serde_json::to_string(&audit).unwrap();
    assert!(!text.contains("owned-sensitive-marker"));
    assert!(!text.contains("owned-owner"));
    assert_eq!(
        audit["items"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|v| v["operation"] == "backtest.create" && v["code"] == "INVALID_REQUEST")
            .count(),
        100
    );
}
