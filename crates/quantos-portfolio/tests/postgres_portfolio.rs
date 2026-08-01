use std::{env, time::Instant};

use quantos_core::{AccountId, TenantId, WorkspaceId};
use quantos_portfolio::{
    InMemoryPortfolioProjection, generate_fill_replay, pg::PgPortfolioStore, replay_start,
    snapshots_approx_eq,
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

fn seed_context(database_url: &str, tenant_id: TenantId) -> (TenantCleanup, AccountId) {
    let connector =
        postgres_native_tls::MakeTlsConnector::new(native_tls::TlsConnector::new().expect("tls"));
    let mut client = postgres::Client::connect(database_url, connector).expect("connects");
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

#[test]
fn postgres_portfolio_store_persists_and_reads_projection() {
    let Some(database_url) = env::var("DATABASE_URL").ok() else {
        eprintln!("skipping live PostgreSQL test: DATABASE_URL is not set");
        return;
    };

    let tenant_id = TenantId::new();
    let (_cleanup, account_id) = seed_context(&database_url, tenant_id);
    let events = generate_fill_replay(account_id, 2_000, replay_start());
    let projection = InMemoryPortfolioProjection::rebuild(tenant_id, replay_start(), &events)
        .expect("rebuild succeeds");
    let snapshot = projection.snapshot(account_id).expect("snapshot builds");

    let mut store = PgPortfolioStore::connect(&database_url).expect("connects to PostgreSQL");
    store.save_snapshot(&snapshot).expect("snapshot persists");

    let positions = store
        .positions_for_account(tenant_id, account_id)
        .expect("positions query works");
    assert_eq!(positions.len(), snapshot.positions.len());
    for (stored, expected) in positions.iter().zip(snapshot.positions.iter()) {
        assert_eq!(stored.symbol, expected.symbol);
        assert!((stored.quantity - expected.quantity).abs() < 1e-9);
    }

    let mark = store
        .mark_for_symbol(tenant_id, "BTCUSDT")
        .expect("mark query works")
        .expect("mark exists");
    assert!((mark - 110.0).abs() < 1e-9);

    let state = store
        .account_state(tenant_id, account_id)
        .expect("account state query works")
        .expect("account state exists");
    assert!((state.realized_pnl - snapshot.realized_pnl).abs() < 1e-6);
    assert_eq!(state.last_event_sequence, snapshot.last_event_sequence);

    let mut durations = Vec::new();
    for _ in 0..50 {
        let started = Instant::now();
        let _ = store
            .positions_for_account(tenant_id, account_id)
            .expect("positions query works");
        durations.push(started.elapsed());
    }
    durations.sort();
    let p95 = durations[(durations.len() * 95 / 100).min(durations.len() - 1)];
    assert!(
        p95 < std::time::Duration::from_millis(300),
        "portfolio query p95 {p95:?} exceeded 300ms"
    );

    let rebuilt = InMemoryPortfolioProjection::rebuild(tenant_id, replay_start(), &events)
        .expect("rebuild is repeatable")
        .snapshot(account_id)
        .expect("snapshot builds");
    assert!(snapshots_approx_eq(&rebuilt, &snapshot));
}
