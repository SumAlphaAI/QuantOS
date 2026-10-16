# quantos-portfolio

Rebuildable Portfolio display model and account-bound risk inputs for QuantOS X01.

- Long/short positions, average entry, fees, valuation, realized/unrealized P&L and gross/net exposure; one account quote unit and f64 valuation compatibility.
- Strict sequence/deduplication/numeric/symbol/time validation; a rejected event leaves state and its event ID available for a correct retry.
- Deterministic 10,000-fill + 3-mark golden replay and cold rebuild. Golden comparisons retain the existing relative 1e-9 tolerance.
- Explicit active/suspended/closed account state and source-time mark provenance in saved snapshots; legacy unknown states remain optional and cannot produce risk inputs.
- `risk_snapshot` and `RiskInputSnapshot::validate_for` bind expected tenant/account, current clock, allowed age, account state and every open-position price/time. The input digest covers the complete payload; it is not an authorization signature.
- F05 `apply_recorded` and R01 `apply_market_recorded` adapters require an explicit merged tape sequence, distinct from each source ledger's sequence, and validate source tenant/schema/hash/quality.
- Controlled `quantos` schema persistence uses a complete coherent account payload, parent row locks, transactional writes and monotonic/conflict checks. Apply forward migration `20261016140000_x01_coherent_portfolio_snapshots.sql` to an authorized configured Supabase target before using the new store. Legacy NULL payloads require rebuild.

`PortfolioSnapshot`'s compatible valuation hash is not an identity/provenance authority. Risk consumers must validate the new `RiskInputSnapshot` and apply their own business permissions and limits. Lifetime realized P&L is not daily loss; equity, daily windows, kill switch and order decisions belong to X02.

Local preflight: `make x01-check`. Complete frozen-candidate admission: `make x01-assess-local` under the documented credential-stripping/offline wrapper; the complete 40-node/131-group closure must pass. `make x01-local-check` verifies the published local receipt; `make x01-release-check` rejects without independent release evidence.

Database tests are separate: the new `postgres_x01` target cases are ignored by default and only run with explicit opt-in, the configured authorized Supabase DATABASE_URL and the applied migration. No local PostgreSQL/Supabase environment is supported. Migration static checks, ignored/conditional tests and local replay do not establish target DB, query P95 <300ms, release or formal acceptance.

See [local admission](../../docs/operations/x01-local-admission.md) and [decision](../../docs/adr/20261016-x01-risk-snapshot.md).
