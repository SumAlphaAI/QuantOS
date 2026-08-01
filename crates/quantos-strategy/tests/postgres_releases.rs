use std::env;

use chrono::Utc;
use quantos_core::{ActorId, ProposalId, SnapshotId, StrategyDraftId, TenantId, WorkspaceId};
use quantos_strategy::{
    pg::PgReleaseStore,
    release::{DeploymentTarget, StrategyRelease, StrategyReleaseError},
};
use uuid::Uuid;

struct TenantCleanup {
    database_url: String,
    tenant_id: TenantId,
}

impl Drop for TenantCleanup {
    fn drop(&mut self) {
        let cleanup = || -> anyhow::Result<()> {
            let connector =
                postgres_native_tls::MakeTlsConnector::new(native_tls::TlsConnector::new()?);
            let mut client = postgres::Client::connect(&self.database_url, connector)?;
            client.execute(
                "delete from quantos.tenants where id = $1",
                &[self.tenant_id.as_uuid()],
            )?;
            Ok(())
        };
        let _ = cleanup();
    }
}

fn seed_context(
    database_url: &str,
    tenant_id: TenantId,
) -> (TenantCleanup, StrategyDraftId, ActorId, SnapshotId) {
    let connector =
        postgres_native_tls::MakeTlsConnector::new(native_tls::TlsConnector::new().expect("tls"));
    let mut client = postgres::Client::connect(database_url, connector).expect("connects");
    let workspace_id = WorkspaceId::new();
    let actor_id = ActorId::new();
    let draft_id = StrategyDraftId::new();
    let snapshot_id = SnapshotId::new();
    let now = Utc::now();
    client
        .execute(
            "insert into quantos.tenants (id, slug, name) values ($1, $2, $3)",
            &[
                &tenant_id.as_uuid(),
                &format!("release-test-{tenant_id}"),
                &"Release Test".to_owned(),
            ],
        )
        .expect("tenant seeds");
    client
        .execute(
            "insert into quantos.workspaces (id, tenant_id, slug, name, is_primary)
             values ($1, $2, $3, $4, true)",
            &[
                &workspace_id.as_uuid(),
                &tenant_id.as_uuid(),
                &"primary".to_owned(),
                &"Primary".to_owned(),
            ],
        )
        .expect("workspace seeds");
    client
        .execute(
            "insert into quantos.actors (id, tenant_id, actor_kind, display_name, service_name)
             values ($1, $2, 'service', $3, $4)",
            &[
                &actor_id.as_uuid(),
                &tenant_id.as_uuid(),
                &"Release Publisher".to_owned(),
                &format!("release-publisher-{tenant_id}"),
            ],
        )
        .expect("actor seeds");
    client
        .execute(
            "insert into quantos.strategy_drafts (
                draft_id, tenant_id, workspace_id, owner_actor_id, name,
                head_version, created_by_actor, created_at, updated_at
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            &[
                &draft_id.as_uuid(),
                &tenant_id.as_uuid(),
                &workspace_id.as_uuid(),
                &actor_id.as_uuid(),
                &"trend.alpha".to_owned(),
                &1_i64,
                &actor_id.as_uuid(),
                &now,
                &now,
            ],
        )
        .expect("draft seeds");
    client
        .execute(
            "insert into quantos.data_snapshots (
                id, tenant_id, schema_name, schema_version,
                window_start_at, window_end_at, captured_at, max_age_secs, expires_at,
                quality, license_label, content_hash
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
            &[
                &snapshot_id.as_uuid(),
                &tenant_id.as_uuid(),
                &"DataSnapshot".to_owned(),
                &"v1".to_owned(),
                &now,
                &now,
                &now,
                &3_600_i64,
                &now,
                &"passed".to_owned(),
                &"internal-approved".to_owned(),
                &format!("sha256:{}", "a".repeat(64)),
            ],
        )
        .expect("snapshot seeds");
    (
        TenantCleanup {
            database_url: database_url.to_owned(),
            tenant_id,
        },
        draft_id,
        actor_id,
        snapshot_id,
    )
}

fn release_fixture(
    tenant_id: TenantId,
    draft_id: StrategyDraftId,
    actor_id: ActorId,
    snapshot_id: SnapshotId,
    verified: bool,
) -> StrategyRelease {
    StrategyRelease {
        release_id: ProposalId::new(),
        tenant_id,
        draft_id,
        draft_version: 1,
        name: "trend.alpha".to_owned(),
        source_digest: "sha256:source".to_owned(),
        image_digest: "sha256:image".to_owned(),
        parameter_hash: quantos_core::ContentHash::sha256_bytes(br#"{"params":"v1"}"#),
        backtest_report_hash: verified
            .then(|| quantos_core::ContentHash::sha256_bytes(br#"{"backtest":"report"}"#)),
        data_snapshot_id: snapshot_id,
        evidence_refs: vec![],
        allowed_targets: vec![DeploymentTarget::Paper, DeploymentTarget::Shadow],
        approved_at: None,
        approved_by: None,
        content_hash: quantos_core::ContentHash::sha256_bytes(
            format!("release-content-{}", Uuid::now_v7()).as_bytes(),
        ),
        created_by: actor_id,
        created_at: Utc::now(),
    }
}

#[test]
fn postgres_release_store_enforces_dedupe_conflict_and_deployment_gate() {
    let Some(database_url) = env::var("DATABASE_URL").ok() else {
        eprintln!("skipping live PostgreSQL test: DATABASE_URL is not set");
        return;
    };

    let tenant_id = TenantId::new();
    let (_cleanup, draft_id, actor_id, snapshot_id) = seed_context(&database_url, tenant_id);
    let mut store = PgReleaseStore::connect(&database_url).expect("connects to PostgreSQL");

    let release = release_fixture(tenant_id, draft_id, actor_id, snapshot_id, true);
    let published = store.publish(&release, None).expect("release publishes");
    assert_eq!(published.release_id, release.release_id);

    let republished = store
        .publish(&release, None)
        .expect("identical publish dedupes");
    assert_eq!(republished.release_id, release.release_id);
    assert_eq!(republished.content_hash, release.content_hash);

    let mut conflicting = release_fixture(tenant_id, draft_id, actor_id, snapshot_id, true);
    conflicting.source_digest = "sha256:source-v2".to_owned();
    let conflict = store
        .publish(&conflicting, None)
        .expect_err("modified content must conflict");
    assert!(matches!(
        conflict,
        quantos_strategy::pg::PgStrategyError::Release(
            StrategyReleaseError::ContentConflict { .. }
        )
    ));

    let rejected = store
        .request_deployment(
            tenant_id,
            release.release_id,
            DeploymentTarget::Paper,
            actor_id,
            None,
            Utc::now(),
        )
        .expect_err("unapproved release must not deploy");
    assert!(matches!(
        rejected,
        quantos_strategy::pg::PgStrategyError::Release(
            StrategyReleaseError::DeploymentRejected { .. }
        )
    ));

    let approved = store
        .approve(tenant_id, release.release_id, actor_id, Utc::now())
        .expect("approval persists");
    assert!(approved.is_approved());

    let second_approval = store
        .approve(tenant_id, release.release_id, actor_id, Utc::now())
        .expect_err("double approval rejected");
    assert!(matches!(
        second_approval,
        quantos_strategy::pg::PgStrategyError::Release(
            StrategyReleaseError::AlreadyApproved { .. }
        )
    ));

    let ticket = store
        .request_deployment(
            tenant_id,
            release.release_id,
            DeploymentTarget::Paper,
            actor_id,
            None,
            Utc::now(),
        )
        .expect("approved and verified release deploys");
    assert_eq!(ticket.target, DeploymentTarget::Paper);
}
