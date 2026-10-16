use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use postgres_openssl::MakeTlsConnector;
use quantos_core::{AccountId, TenantId, WorkspaceId};
use quantos_portfolio::{
    InMemoryPortfolioProjection, PortfolioSnapshot, generate_fill_replay, pg::PgPortfolioStore,
    replay_start,
};
use std::env;
fn target_url() -> String {
    assert_eq!(
        env::var("QUANTOS_RUN_X01_POSTGRES_TESTS").as_deref(),
        Ok("1"),
        "explicit X01 target opt-in required"
    );
    let value = env::var("DATABASE_URL").expect("configured Supabase DATABASE_URL required");
    let url = url::Url::parse(&value).expect("valid configured URL");
    assert!(
        url.host_str()
            .is_some_and(|host| host.ends_with(".supabase.com") || host.ends_with(".supabase.co")),
        "only configured Supabase; no local databases"
    );
    value
}
struct TenantCleanup {
    database_url: String,
    tenant_id: TenantId,
}

impl Drop for TenantCleanup {
    fn drop(&mut self) {
        let cleanup = || -> anyhow::Result<()> {
            let mut client = connect_client(&self.database_url)?;
            client.execute(
                "delete from quantos.tenants where id = $1",
                &[self.tenant_id.as_uuid()],
            )?;
            Ok(())
        };
        let _ = cleanup();
    }
}

fn seed_context(database_url: &str, tenant_id: TenantId) -> (TenantCleanup, AccountId) {
    let mut client = connect_client(database_url).expect("connects");
    let workspace_id = WorkspaceId::new();
    let account_id = AccountId::new();
    client
        .execute(
            "insert into quantos.tenants (id, slug, name) values ($1, $2, $3)",
            &[
                &tenant_id.as_uuid(),
                &format!("portfolio-test-{tenant_id}"),
                &"Portfolio Test".to_owned(),
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
            "insert into quantos.accounts (
                id, tenant_id, workspace_id, venue, external_account_ref, name, mode
            ) values ($1,$2,$3,$4,$5,$6,'paper')",
            &[
                &account_id.as_uuid(),
                &tenant_id.as_uuid(),
                &workspace_id.as_uuid(),
                &"paper".to_owned(),
                &format!("portfolio-{tenant_id}"),
                &"Portfolio Paper".to_owned(),
            ],
        )
        .expect("account seeds");
    (
        TenantCleanup {
            database_url: database_url.to_owned(),
            tenant_id,
        },
        account_id,
    )
}

fn connect_client(database_url: &str) -> anyhow::Result<postgres::Client> {
    let mut builder = SslConnector::builder(SslMethod::tls())?;
    builder.set_verify(SslVerifyMode::PEER);
    if let Ok(root) = env::var("QUANTOS_BFF_SSLROOTCERT") {
        builder.set_ca_file(root)?;
    } else {
        builder.set_default_verify_paths()?;
    }
    Ok(postgres::Client::connect(
        database_url,
        MakeTlsConnector::new(builder.build()),
    )?)
}

fn snapshot(tenant: TenantId, account: AccountId, count: u64) -> PortfolioSnapshot {
    InMemoryPortfolioProjection::rebuild(
        tenant,
        replay_start(),
        &generate_fill_replay(account, count, replay_start()),
    )
    .unwrap()
    .snapshot(account)
    .unwrap()
}
#[test]
#[ignore = "actual configured Supabase; explicit X01 opt-in and applied migration required"]
fn x01_target_coherent_snapshot_rebuild_and_conflict() {
    let url = target_url();
    let tenant = TenantId::new();
    let (_cleanup, account) = seed_context(&url, tenant);
    let mut store = PgPortfolioStore::connect(&url).unwrap();
    let golden = snapshot(tenant, account, 10000);
    store.save_snapshot(&golden).unwrap();
    drop(store);
    let mut cold = PgPortfolioStore::connect(&url).unwrap();
    assert_eq!(
        cold.snapshot_for_account(tenant, account).unwrap().unwrap(),
        golden
    );
    assert!(
        cold.save_snapshot(&snapshot(tenant, account, 1000))
            .is_err()
    );
    let mut events = generate_fill_replay(account, 10000, replay_start());
    if let quantos_portfolio::PortfolioEventKind::Fill(fill) = &mut events[0].kind {
        fill.quantity += 1.0;
    }
    let conflict = InMemoryPortfolioProjection::rebuild(tenant, replay_start(), &events)
        .unwrap()
        .snapshot(account)
        .unwrap();
    assert!(cold.save_snapshot(&conflict).is_err());
    let mut other = golden.clone();
    other.tenant_id = TenantId::new();
    assert!(cold.save_snapshot(&other).is_err());
    assert!(
        cold.snapshot_for_account(other.tenant_id, account)
            .unwrap()
            .is_none()
    );
    // A newer market head must not alter a previously persisted account valuation.
    let mut client = connect_client(&url).unwrap();
    client.execute("update quantos.portfolio_marks set price = price + 99, as_of = as_of + interval '1 second' where tenant_id = $1",&[tenant.as_uuid()]).unwrap();
    assert_eq!(
        cold.positions_for_account(tenant, account).unwrap(),
        golden.positions
    );
    let mut risk_events = generate_fill_replay(account, 10000, replay_start());
    let last = risk_events.last().unwrap();
    risk_events.push(quantos_portfolio::PortfolioEvent {
        event_id: "account-status".into(),
        sequence: last.sequence + 1,
        occurred_at: last.occurred_at,
        kind: quantos_portfolio::PortfolioEventKind::AccountStatus(
            quantos_portfolio::AccountStatusEvent {
                account_id: account,
                status: quantos_portfolio::AccountStatus::Active,
            },
        ),
    });
    let projection =
        InMemoryPortfolioProjection::rebuild(tenant, replay_start(), &risk_events).unwrap();
    let now = replay_start() + chrono::Duration::seconds(11);
    let input = projection.risk_snapshot(account, now, 30).unwrap();
    cold.save_risk_snapshot(&input).unwrap();
    drop(cold);
    let mut cold = PgPortfolioStore::connect(&url).unwrap();
    assert_eq!(
        cold.risk_snapshot_for_account(tenant, account, now, 30)
            .unwrap()
            .unwrap(),
        input
    );
    assert!(
        cold.risk_snapshot_for_account(tenant, account, now + chrono::Duration::seconds(60), 30)
            .is_err()
    );
    cold.save_snapshot(&input.portfolio).unwrap();
    assert!(
        cold.risk_snapshot_for_account(tenant, account, now, 30)
            .unwrap()
            .is_none()
    );

    let mut projection = projection;
    projection
        .apply(&quantos_portfolio::PortfolioEvent {
            event_id: "account-closed".into(),
            sequence: input.portfolio.last_event_sequence + 1,
            occurred_at: now,
            kind: quantos_portfolio::PortfolioEventKind::AccountStatus(
                quantos_portfolio::AccountStatusEvent {
                    account_id: account,
                    status: quantos_portfolio::AccountStatus::Closed,
                },
            ),
        })
        .unwrap();
    cold.save_snapshot(&projection.snapshot(account).unwrap())
        .unwrap();
    assert_eq!(
        cold.account_state(tenant, account)
            .unwrap()
            .unwrap()
            .account_status,
        Some(quantos_portfolio::AccountStatus::Closed)
    );
    // Two new writers race at one sequence: exactly one content may win.
    let other_tenant = TenantId::new();
    let (_other_cleanup, other_account) = seed_context(&url, other_tenant);
    let a = snapshot(other_tenant, other_account, 10000);
    let mut events = generate_fill_replay(other_account, 10000, replay_start());
    if let quantos_portfolio::PortfolioEventKind::Fill(fill) = &mut events[0].kind {
        fill.quantity += 2.0;
    }
    let b = InMemoryPortfolioProjection::rebuild(other_tenant, replay_start(), &events)
        .unwrap()
        .snapshot(other_account)
        .unwrap();
    let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
    let results = std::thread::scope(|scope| {
        let mut handles = Vec::new();
        for value in [a, b] {
            let url = &url;
            let barrier = barrier.clone();
            handles.push(scope.spawn(move || {
                let mut s = PgPortfolioStore::connect(url).unwrap();
                barrier.wait();
                s.save_snapshot(&value).is_ok()
            }));
        }
        handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .filter(|ok| *ok)
            .count()
    });
    assert_eq!(results, 1);
}
#[test]
#[ignore = "actual configured Supabase; explicit X01 opt-in and applied migration required"]
fn x01_target_forced_rls_and_composite_account_fk() {
    let url = target_url();
    let tenant = TenantId::new();
    let (_cleanup, account) = seed_context(&url, tenant);
    let foreign = TenantId::new();
    let (_foreign_cleanup, _) = seed_context(&url, foreign);
    let mut store = PgPortfolioStore::connect(&url).unwrap();
    let value = snapshot(tenant, account, 10000);
    store.save_snapshot(&value).unwrap();
    let mut client = connect_client(&url).unwrap();
    // The foreign tenant exists, so rejection specifically requires the composite account edge.
    assert!(client.execute("insert into quantos.portfolio_positions (tenant_id,account_id,symbol,quantity,average_entry_price,realized_pnl,last_event_sequence,as_of) values ($1,$2,'BTC/USDT',1,100,0,1,now())",&[foreign.as_uuid(),account.as_uuid()]).is_err());
    let mut tx = client.transaction().unwrap();
    tx.batch_execute("set local role authenticated").unwrap();
    assert_eq!(
        tx.query_one(
            "select count(*)::bigint from quantos.portfolio_accounts where tenant_id=$1",
            &[tenant.as_uuid()]
        )
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert!(
        tx.execute(
            "update quantos.portfolio_accounts set exposure_gross=0 where tenant_id=$1",
            &[tenant.as_uuid()]
        )
        .is_err()
    );
    tx.rollback().unwrap();
    let row=client.query_one("select relrowsecurity,relforcerowsecurity from pg_class where oid='quantos.portfolio_accounts'::regclass",&[]).unwrap();
    assert!(row.get::<_, bool>(0) && row.get::<_, bool>(1));
}
