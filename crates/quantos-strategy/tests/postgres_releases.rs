//! Separate target test: explicit opt-in and authorized non-production Supabase only.
use chrono::{Duration, Utc};
use quantos_core::TenantId;
use quantos_strategy::{
    pg::PgReleaseStore,
    release::{DeploymentTarget, StrategyReleaseError},
};
#[path = "support/release_fixture.rs"]
mod fixture;
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
                "delete from quantos.strategy_releases where tenant_id=$1",
                &[self.tenant_id.as_uuid()],
            )?;
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
    auth: &quantos_auth::AuthContext,
    proof: &quantos_strategy::release::ValidatedBacktest,
) -> TenantCleanup {
    let connector =
        postgres_native_tls::MakeTlsConnector::new(native_tls::TlsConnector::new().expect("tls"));
    let mut client = postgres::Client::connect(database_url, connector).expect("connects");
    let tenant_id = auth.tenant_id;
    let workspace_id = auth.workspace_id;
    let actor_id = auth.actor_id;
    let draft_id = proof.report().draft.as_ref().unwrap().draft_id;
    let snapshot_id = proof.report().snapshot_id;
    let now = proof.report().generated_at;
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
                head_version, created_by_actor, created_at, updated_at,created_by_user
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            &[
                &draft_id.as_uuid(),
                &tenant_id.as_uuid(),
                &workspace_id.as_uuid(),
                &actor_id.as_uuid(),
                &"trend.alpha".to_owned(),
                &0_i64,
                &actor_id.as_uuid(),
                &now,
                &now,
                &auth.user_id,
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
                &86_400_i64,
                &proof.valid_until(),
                &"passed".to_owned(),
                &"internal-approved".to_owned(),
                &proof.snapshot_hash().as_str(),
            ],
        )
        .expect("snapshot seeds");
    for reference in proof.evidence_refs() {
        client.execute("insert into quantos.object_artifacts (tenant_id,artifact_id,content_hash,storage_bucket,object_key,media_type,size_bytes)
            values ($1,$2,$3,'owned-s03-target-fixture',$4,'application/json',0)",
            &[&tenant_id.as_uuid(),&reference.artifact_id.as_uuid(),&reference.content_hash.as_str(),&format!("s03/{}/{}",tenant_id,reference.artifact_id)]).unwrap();
    }
    let mut tx = client.transaction().unwrap();
    tx.execute("insert into quantos.strategy_draft_versions (version_id,tenant_id,draft_id,version,parameters,data_snapshot_id,artifact_refs,content_hash,save_kind,created_by_actor,created_by_user,created_at)
        values ($1,$2,$3,1,$4,$5,$6,$7,'manual',$8,$9,$10)",
        &[&uuid::Uuid::now_v7(),&tenant_id.as_uuid(),&draft_id.as_uuid(),&postgres::types::Json(&fixture::payload()["strategy"]),
            &snapshot_id.as_uuid(),&postgres::types::Json(&proof.evidence_refs()),&proof.report().draft.as_ref().unwrap().version_hash.as_str(),&actor_id.as_uuid(),&auth.user_id,&now]).unwrap();
    tx.execute(
        "update quantos.strategy_drafts set head_version=1,updated_at=$2 where draft_id=$1",
        &[&draft_id.as_uuid(), &now],
    )
    .unwrap();
    tx.commit().unwrap();
    TenantCleanup {
        database_url: database_url.to_owned(),
        tenant_id,
    }
}

#[test]
#[ignore = "requires separately authorized Supabase migration and dedicated target scope"]
fn postgres_release_store_enforces_dedupe_conflict_and_deployment_gate() {
    assert_eq!(
        std::env::var("QUANTOS_RUN_S03_POSTGRES_TESTS").as_deref(),
        Ok("1")
    );
    let url = std::env::var("DATABASE_URL").expect("authorized target configuration required");
    let (mut auth, proof) = fixture::fixture(&fixture::payload());
    // No auth.users identity is seeded by a database test. Existing API requires a real
    // authorized user for audit; target operators must provide that dedicated test user.
    auth.user_id = std::env::var("QUANTOS_S03_TEST_USER_ID")
        .expect("dedicated authorized test user")
        .parse()
        .unwrap();
    let _cleanup = seed_context(&url, &auth, &proof);
    let mut store = PgReleaseStore::connect(&url).unwrap();
    let at = Utc::now();
    let r = store
        .publish(
            &auth,
            proof.clone(),
            vec![DeploymentTarget::Paper, DeploymentTarget::Shadow],
            at,
        )
        .unwrap();
    assert!(r.is_verified());
    assert_eq!(
        store
            .publish(
                &auth,
                proof.clone(),
                vec![DeploymentTarget::Shadow, DeploymentTarget::Paper],
                at
            )
            .unwrap()
            .content_hash,
        r.content_hash
    );
    assert!(matches!(
        store.publish(&auth, proof, vec![DeploymentTarget::Paper], at),
        Err(quantos_strategy::pg::PgStrategyError::Release(
            StrategyReleaseError::ContentConflict { .. }
        ))
    ));
    assert!(
        store
            .request_deployment(&auth, r.release_id, DeploymentTarget::Paper, at)
            .is_err()
    );
    let mut approver = auth.clone();
    approver.actor_id = quantos_core::ActorId::new();
    approver.role = quantos_policy::Role::Approver;
    assert!(
        store
            .approve(
                &auth,
                r.release_id,
                &r.content_hash,
                at,
                at + Duration::minutes(10)
            )
            .is_err()
    );
    let approved = store
        .approve(
            &approver,
            r.release_id,
            &r.content_hash,
            at,
            at + Duration::minutes(10),
        )
        .unwrap();
    assert!(approved.is_approved());
    assert!(
        store
            .approve(
                &approver,
                r.release_id,
                &r.content_hash,
                at,
                at + Duration::minutes(10)
            )
            .is_err()
    );
    store
        .request_deployment(
            &auth,
            r.release_id,
            DeploymentTarget::Shadow,
            at + Duration::seconds(1),
        )
        .unwrap();
    assert!(
        store
            .request_deployment(&auth, r.release_id, DeploymentTarget::Shadow, at)
            .is_err()
    );
    let t = store
        .request_deployment(&auth, r.release_id, DeploymentTarget::Paper, at)
        .unwrap();
    assert_eq!(
        t,
        store
            .request_deployment(&auth, r.release_id, DeploymentTarget::Paper, at)
            .unwrap()
    );
    assert!(
        store
            .request_deployment(
                &auth,
                r.release_id,
                DeploymentTarget::Paper,
                at + Duration::minutes(10)
            )
            .is_err()
    );
    let mut foreign = auth;
    foreign.workspace_id = quantos_core::WorkspaceId::new();
    assert!(
        store
            .request_deployment(&foreign, r.release_id, DeploymentTarget::Paper, at)
            .is_err()
    );
}
