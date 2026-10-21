//! Exercise SET LOCAL on a configured database session without running a local DB.
use super::*;

#[test]
fn transaction_pool_deadlines_are_local_and_failed_statements_roll_back() {
    let Ok(url) = std::env::var("DATABASE_URL") else {
        assert_ne!(
            std::env::var("QUANTOS_RUN_F05_POSTGRES_TESTS").as_deref(),
            Ok("1")
        );
        return;
    };
    let mut store = PgEventStore::connect(&url).unwrap();
    // A session represents the backend supplied by a transaction pool. The flag
    // selects the real production transaction path, including commit and rollback.
    store.transaction_pool = true;
    let before: String = store
        .client
        .query_one("show statement_timeout", &[])
        .unwrap()
        .get(0);
    store.configure_market_deadline().unwrap();
    assert_eq!(
        store
            .client
            .query_one("show statement_timeout", &[])
            .unwrap()
            .get::<_, String>(0),
        before
    );
    let row = store
        .market_query("select current_setting('statement_timeout')", &[])
        .unwrap();
    assert_eq!(row.get::<_, String>(0), "4s");
    assert!(store.last_market_write().is_some());
    assert_eq!(
        store
            .client
            .query_one("show statement_timeout", &[])
            .unwrap()
            .get::<_, String>(0),
        before
    );
    assert!(store.market_query("select 1/0", &[]).is_err());
    assert!(store.last_market_write().is_none());
    assert_eq!(
        store
            .market_query("select 42::bigint", &[])
            .unwrap()
            .get::<_, i64>(0),
        42
    );
}
