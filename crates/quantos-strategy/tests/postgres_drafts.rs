use std::env;

use chrono::Utc;
use quantos_core::{ActorId, SnapshotId, StrategyDraftId, TenantId, WorkspaceId};
use quantos_strategy::{
    DraftSaveKind, DraftVersionInput, StrategyDraft, StrategyDraftError, pg::PgStrategyStore,
    strategy_fixture_parameters,
};

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

fn seed_context(database_url: &str, tenant_id: TenantId) -> (TenantCleanup, WorkspaceId, ActorId) {
    let connector =
        postgres_native_tls::MakeTlsConnector::new(native_tls::TlsConnector::new().expect("tls"));
    let mut client = postgres::Client::connect(database_url, connector).expect("connects");
    let workspace_id = WorkspaceId::new();
    let actor_id = ActorId::new();
    client
        .execute(
            "insert into quantos.tenants (id, slug, name) values ($1, $2, $3)",
            &[
                &tenant_id.as_uuid(),
                &format!("strategy-test-{tenant_id}"),
                &"Strategy Test".to_owned(),
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
                &"Strategy Writer".to_owned(),
                &format!("strategy-writer-{tenant_id}"),
            ],
        )
        .expect("actor seeds");
    (
        TenantCleanup {
            database_url: database_url.to_owned(),
            tenant_id,
        },
        workspace_id,
        actor_id,
    )
}

#[test]
fn postgres_strategy_store_persists_versions_and_rejects_conflicts() {
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        eprintln!("skipping live PostgreSQL test: DATABASE_URL is not set");
        return;
    };

    let tenant_id = TenantId::new();
    let (_cleanup, workspace_id, actor_id) = seed_context(&database_url, tenant_id);
    let mut store = PgStrategyStore::connect(&database_url).expect("connects to PostgreSQL");

    let now = Utc::now();
    let draft = StrategyDraft {
        draft_id: StrategyDraftId::new(),
        tenant_id,
        workspace_id,
        owner_actor_id: actor_id,
        name: "trend.alpha".to_owned(),
        head_version: 0,
        created_at: now,
        updated_at: now,
    };
    let created = store.create_draft(&draft, None).expect("draft persists");
    assert_eq!(created.draft_id, draft.draft_id);
    assert_eq!(created.head_version, 0);

    let first = store
        .save_version(
            tenant_id,
            actor_id,
            None,
            DraftVersionInput {
                draft_id: draft.draft_id,
                parameters: strategy_fixture_parameters(1),
                data_snapshot_id: None::<SnapshotId>,
                artifact_refs: vec![],
                base_version: 0,
                save_kind: DraftSaveKind::Manual,
                saved_at: now,
            },
        )
        .expect("first version persists");
    assert_eq!(first.version, 1);

    let conflict = store
        .save_version(
            tenant_id,
            actor_id,
            None,
            DraftVersionInput {
                draft_id: draft.draft_id,
                parameters: strategy_fixture_parameters(2),
                data_snapshot_id: None,
                artifact_refs: vec![],
                base_version: 0,
                save_kind: DraftSaveKind::Autosave,
                saved_at: now,
            },
        )
        .expect_err("stale base version must conflict");
    assert!(matches!(
        conflict,
        quantos_strategy::pg::PgStrategyError::Strategy(StrategyDraftError::VersionConflict {
            base_version: 0,
            head_version: 1,
            ..
        })
    ));

    let second = store
        .save_version(
            tenant_id,
            actor_id,
            None,
            DraftVersionInput {
                draft_id: draft.draft_id,
                parameters: strategy_fixture_parameters(2),
                data_snapshot_id: None,
                artifact_refs: vec![],
                base_version: 1,
                save_kind: DraftSaveKind::Autosave,
                saved_at: now,
            },
        )
        .expect("retry with fresh base succeeds");
    assert_eq!(second.version, 2);
    assert_eq!(second.save_kind, DraftSaveKind::Autosave);

    let fetched = store
        .get_draft(tenant_id, draft.draft_id)
        .expect("draft query works")
        .expect("draft exists");
    assert_eq!(fetched.head_version, 2);

    let versions = store
        .list_versions(tenant_id, draft.draft_id)
        .expect("versions list works");
    assert_eq!(versions.len(), 2);
    assert_eq!(versions[0].version, 1);
    assert_eq!(versions[1].version, 2);
    assert_ne!(versions[0].content_hash, versions[1].content_hash);
}
