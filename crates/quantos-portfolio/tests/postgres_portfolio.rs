use std::{env, time::Instant};

use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use postgres_openssl::MakeTlsConnector;
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

#[test]
fn f09_portfolio_and_risk_queries_persist_actual_latency_samples() {
    if env::var("QUANTOS_RUN_F09_POSTGRES_TESTS").as_deref() != Ok("1") {
        return;
    }
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL required");
    let tenant_id = TenantId::new();
    let (_cleanup, account_id) = seed_context(&database_url, tenant_id);
    let mut store = PgPortfolioStore::connect(&database_url).expect("portfolio store connects");
    assert!(
        store
            .positions_for_account(tenant_id, account_id)
            .unwrap()
            .is_empty()
    );
    assert!(
        store
            .account_state(tenant_id, account_id)
            .unwrap()
            .is_none()
    );
    drop(store);
    let mut verifier = connect_client(&database_url).expect("metric verifier connects");
    let rows = verifier.query(
        "select metric_name, metric_value from quantos.operational_metric_samples
         where tenant_id = $1 and metric_name in ('portfolio_query_latency_ms','risk_query_latency_ms')",
        &[tenant_id.as_uuid()],
    ).expect("query samples persist");
    assert_eq!(rows.len(), 2);
    for row in rows {
        assert!(row.get::<_, f64>(1) >= 0.0);
    }
}

#[test]
fn postgres_portfolio_store_persists_and_reads_projection() {
    let Some(database_url) = env::var("DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
    else {
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
    eprintln!("portfolio remote query p95 diagnostic: {p95:?}");
    drop(store); // flush the bounded metric queue before checking persistence
    let mut verifier = connect_client(&database_url).expect("metric verifier connects");
    let counts = verifier.query(
        "select metric_name, count(*)::bigint from quantos.operational_metric_samples
         where tenant_id = $1 and metric_name in ('portfolio_query_latency_ms','risk_query_latency_ms')
         group by metric_name",
        &[tenant_id.as_uuid()],
    ).expect("query samples persist");
    assert_eq!(counts.len(), 2);
    for row in counts {
        let name: String = row.get(0);
        let count: i64 = row.get(1);
        assert!(
            count
                >= if name == "portfolio_query_latency_ms" {
                    51
                } else {
                    1
                }
        );
    }

    let rebuilt = InMemoryPortfolioProjection::rebuild(tenant_id, replay_start(), &events)
        .expect("rebuild is repeatable")
        .snapshot(account_id)
        .expect("snapshot builds");
    assert!(snapshots_approx_eq(&rebuilt, &snapshot));
}
