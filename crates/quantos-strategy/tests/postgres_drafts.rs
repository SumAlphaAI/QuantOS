use quantos_auth::AuthContext;
use quantos_policy::{Capability, Role, RunMode};
use std::{collections::BTreeSet, env};

use chrono::Utc;
use quantos_core::{ActorId, SnapshotId, TenantId, WorkspaceId};
use quantos_strategy::{
    DraftSaveKind, DraftVersionInput, StrategyDraftError, pg::PgStrategyStore,
    strategy_fixture_parameters,
};

struct TenantCleanup {
    database_url: String,
    tenant_id: TenantId,
    user_id: uuid::Uuid,
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
            client.execute("delete from auth.users where id=$1", &[&self.user_id])?;
            Ok(())
        };
        let _ = cleanup();
    }
}

fn seed_context(
    database_url: &str,
    tenant_id: TenantId,
) -> (TenantCleanup, WorkspaceId, ActorId, uuid::Uuid) {
    let connector =
        postgres_native_tls::MakeTlsConnector::new(native_tls::TlsConnector::new().expect("tls"));
    let mut client = postgres::Client::connect(database_url, connector).expect("connects");
    let user_id = uuid::Uuid::now_v7();
    client
        .execute("insert into auth.users(id) values($1)", &[&user_id])
        .expect("audit user seeds");
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
            user_id,
        },
        workspace_id,
        actor_id,
        user_id,
    )
}

#[test]
#[ignore = "requires explicitly authorized non-production Supabase target and migrations"]
fn postgres_strategy_store_persists_versions_and_rejects_conflicts() {
    assert_eq!(
        env::var("QUANTOS_RUN_S01_TARGET_TESTS").as_deref(),
        Ok("1"),
        "explicit target opt-in required"
    );
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
        panic!("DATABASE_URL required for explicit target execution");
    };

    let tenant_id = TenantId::new();
    let (_cleanup, workspace_id, actor_id, user_id) = seed_context(&database_url, tenant_id);
    let mut store = PgStrategyStore::connect(&database_url).expect("connects to PostgreSQL");

    let now = Utc::now();
    let auth = AuthContext {
        tenant_id,
        actor_id,
        user_id,
        workspace_id,
        workspace_slug: "primary".into(),
        workspace_name: "Primary".into(),
        role: Role::Operator,
        mode: RunMode::Paper,
        account_id: None,
        capabilities: BTreeSet::from([Capability::parse(Capability::STRATEGY_WRITE).unwrap()]),
    };
    let draft = store
        .create_draft(&auth, "trend.alpha", now)
        .expect("draft persists");
    let created = draft.clone();
    assert_eq!(created.draft_id, draft.draft_id);
    assert_eq!(created.head_version, 0);

    let first = store
        .save_version(
            &auth,
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
            &auth,
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
            &auth,
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
        .get_draft(&auth, draft.draft_id)
        .expect("draft query works")
        .expect("draft exists");
    assert_eq!(fetched.head_version, 2);

    let versions = store
        .list_versions(&auth, draft.draft_id)
        .expect("versions list works");
    assert_eq!(versions.len(), 2);
    assert_eq!(versions[0].version, 1);
    assert_eq!(versions[1].version, 2);
    assert_ne!(versions[0].content_hash, versions[1].content_hash);
    // Target-only negative assertions; never executed by the local DEVELOPMENT profile.
    let mut foreign_workspace = auth.clone();
    foreign_workspace.workspace_id = WorkspaceId::new();
    assert!(
        store
            .get_draft(&foreign_workspace, draft.draft_id)
            .unwrap()
            .is_none()
    );
    assert!(
        store
            .list_versions(&foreign_workspace, draft.draft_id)
            .is_err()
    );
    assert!(
        store
            .save_version(
                &auth,
                DraftVersionInput {
                    draft_id: draft.draft_id,
                    base_version: 2,
                    parameters: strategy_fixture_parameters(3),
                    data_snapshot_id: None,
                    artifact_refs: vec![quantos_strategy::DraftArtifactRef {
                        artifact_id: quantos_core::ArtifactId::new(),
                        content_hash: quantos_core::ContentHash::sha256_bytes(b"unknown artifact"),
                    }],
                    save_kind: DraftSaveKind::Autosave,
                    saved_at: now,
                }
            )
            .is_err()
    );
    assert_eq!(
        store
            .get_draft(&auth, draft.draft_id)
            .unwrap()
            .unwrap()
            .head_version,
        2
    );
    let connector =
        postgres_native_tls::MakeTlsConnector::new(native_tls::TlsConnector::new().unwrap());
    let mut client = postgres::Client::connect(&database_url, connector).unwrap();
    assert!(client.execute("update quantos.strategy_draft_versions set created_by_user = null where draft_id = $1", &[draft.draft_id.as_uuid()]).is_err());
    client
        .execute("delete from auth.users where id = $1", &[&user_id])
        .expect("historical FK deletion semantics remain supported");
    let row = client.query_one("select count(*) from quantos.strategy_draft_versions where draft_id = $1 and created_by_user is null", &[draft.draft_id.as_uuid()]).unwrap();
    assert_eq!(row.get::<_, i64>(0), 2);
    let row = client
        .query_one(
            "select created_by_user is null from quantos.strategy_drafts where draft_id = $1",
            &[draft.draft_id.as_uuid()],
        )
        .unwrap();
    assert!(row.get::<_, bool>(0));
}
