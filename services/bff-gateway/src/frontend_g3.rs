//! Test-only composition of actual Python artifacts, C04/C05/C08/C10 and S01–S04.
//! Not compiled into the normal BFF executable. Clock control is a separate Node-only port.
use super::*;
use axum::{Json, extract::State};
use quantos_core::{ContentHash, canonical_json_bytes};
use quantos_storage::{
    ArtifactManifest, InMemoryArtifactCatalog, InMemoryDataSnapshotCatalog, SnapshotQualityRuleset,
    default_quality_rules,
};

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "only scripts/frontend-g3-review.mjs may launch this explicit owned browser host"]
async fn browser_host() {
    assert_eq!(std::env::var("QUANTOS_G3_BROWSER_HOST").as_deref(), Ok("1"));
    for name in [
        "DATABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "QUANTOS_BFF_DATABASE_URL",
    ] {
        assert!(
            std::env::var(name).is_err(),
            "no database/production environment"
        );
    }
    let r03 = std::env::var("QUANTOS_G3_R03").as_deref() == Ok("1");
    let bytes = if r03 {
        b"[]".to_vec()
    } else {
        std::fs::read(std::env::var("QUANTOS_G3_ARTIFACTS").unwrap()).unwrap()
    };
    let documents: Vec<Value> = serde_json::from_slice(&bytes).unwrap();
    if !r03 {
        assert_eq!(documents.len(), 20);
    }
    let provider = crate::BffProvider::default()
        .with_download_origin("https://127.0.0.1:4010")
        .unwrap();
    let registrations = if r03 {
        let worker = crate::g3_research_tests::pipeline(20).await;
        worker.install(&provider).await.unwrap()
    } else {
        vec![]
    };
    if !r03 {
        let mut data = provider.data.lock().await;
        let now = data.now();
        let mut artifacts = InMemoryArtifactCatalog::new();
        let mut snapshots = InMemoryDataSnapshotCatalog::new();
        let mut inputs = Vec::new();
        for (index, payload) in documents.into_iter().enumerate() {
            quantos_strategy::generated::GeneratedStrategyAdapter::from_draft_payload(&payload)
                .unwrap();
            let (auth, _, request, _) = crate::execution::reference_release::material(&payload);
            let content = canonical_json_bytes(&payload).unwrap();
            let artifact = ArtifactManifest::new(
                auth.tenant_id,
                "application/json",
                ContentHash::sha256_bytes(&content),
                "g3-owned-python-ipc",
                content.len() as u64,
                now,
            );
            let refs = vec![quantos_strategy::DraftArtifactRef {
                artifact_id: artifact.artifact_id,
                content_hash: artifact.content_hash.clone(),
            }];
            data.research.artifacts.insert(*artifact.artifact_id.as_uuid(),json!({"artifactId":artifact.artifact_id,"hypothesis":format!("G3 owned IPC strategy fixture {:02}",index+1),"summary":"Actual local Strategy Lab IPC output; owned synthetic input, no R03 worker or live model claim","engineVersion":"strategy-lab-owned-ipc","promptVersion":"owned-contract-fixture","codeVersion":request.candidate.source_commit,"environmentHash":request.candidate.runtime_digest,"dataSnapshotId":request.snapshot.snapshot_id,"createdAt":now,"payloadHash":artifact.content_hash}));
            data.research.snapshots.insert(*request.snapshot.snapshot_id.as_uuid(),json!({"snapshotId":request.snapshot.snapshot_id,"schemaVersion":"v1","window":{"start":request.snapshot.window.start_at,"end":request.snapshot.window.end_at},"sources":["g3-owned-synthetic"],"quality":"verified","qualityBlocked":false,"contentHash":request.snapshot.content_hash,"licenseLabel":"fixture-only","capturedAt":request.snapshot.captured_at,"maxAgeSeconds":86400}));
            artifacts.upsert(artifact);
            snapshots.upsert(request.snapshot.clone()).unwrap();
            inputs.push(StrategyInput {
                tenant_id: auth.tenant_id,
                workspace_id: auth.workspace_id,
                input_id: Uuid::new_v4(),
                request,
                payload,
                artifact_refs: refs,
            });
        }
        let auth = reference_auth("session-current");
        let drafts = DraftService::new(
            snapshots,
            artifacts,
            SnapshotQualityRuleset::from_rules(default_quality_rules(auth.tenant_id, now)).unwrap(),
        );
        let ids: Vec<_> = inputs.iter().map(|i| i.input_id).collect();
        let mut host = StrategyHost::new(drafts, inputs).unwrap();
        for (i, id) in ids.into_iter().enumerate() {
            host.register_strategy(&auth, &format!("G3 strategy {:02}", i + 1), id, now)
                .unwrap();
        }
        data.strategy = Some(host);
    }
    let address: std::net::SocketAddr = std::env::var("QUANTOS_BFF_BIND").unwrap().parse().unwrap();
    assert!(address.ip().is_loopback());
    let listener = tokio::net::TcpListener::bind(address).await.unwrap();
    let control = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let control_address = control.local_addr().unwrap();
    async fn advance(
        State(p): State<crate::BffProvider>,
        h: HeaderMap,
        Json(body): Json<Value>,
    ) -> StatusCode {
        if h.get("x-g3-owned-control").and_then(|v| v.to_str().ok()) != Some("1") {
            return StatusCode::FORBIDDEN;
        }
        let Some(seconds) = body["seconds"].as_i64().filter(|s| (0..=86401).contains(s)) else {
            return StatusCode::UNPROCESSABLE_ENTITY;
        };
        p.advance_reference_time(Duration::seconds(seconds)).await;
        p.renew_reference_session().await;
        StatusCode::NO_CONTENT
    }
    let controls = Router::new()
        .route("/advance", post(advance))
        .with_state(provider.clone());
    tokio::spawn(async move {
        axum::serve(control, controls).await.unwrap();
    });
    println!(
        "{}",
        json!({"ready":true,"control":format!("http://{control_address}"),"fixtures":20,"artifactDocumentSha256":ContentHash::sha256_bytes(&bytes),"sourceCommit":std::env::var("GITHUB_SHA").unwrap(),"identity":"EXPLICIT_REFERENCE_COOKIE_BRIDGE","registrations":registrations,"r03WorkerExecuted":r03})
    );
    axum::serve(
        listener,
        provider
            .router()
            .into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await
    .unwrap();
}
