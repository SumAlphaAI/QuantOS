# bff-gateway

HTTP boundary serving QuantOS-owned page contracts from `bff/openapi/`.
The router accepts typed requests and returns authorized page data or stable
errors. Session/capability context must be verified before selecting tenant data.

The service may compose domain providers; it must not let browsers read venue
credentials, bypass command approval or invoke Python packages directly.
Current local/provider tests do not establish production identity or database
composition. Consult the BFF-FE acceptance records before deployment.

`QUANTOS_BFF_MODE=live` enables the F06 identity surface: Supabase Auth token
verification, server-side opaque sessions, `/v1/session`, `/v1/context`,
`POST /v1/auth/session`, and `POST /v1/auth/logout`. It requires a dedicated
`QUANTOS_BFF_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and an
exact HTTPS `QUANTOS_TERMINAL_ORIGIN`; it also requires
`QUANTOS_BFF_ENVIRONMENT=dev|staging|prod`. The database URL must use
`sslmode=verify-full` and a narrowly scoped BFF login. The live session
response includes the server-side account context, token-derived MFA state,
actual session expiry, and a correlation ID. The live router does not yet serve all
page operations from the reference provider and is not an accepted production
BFF. The reference provider can bind only to loopback and must never receive
production credentials. See `docs/audit/F06-remediation-2026-09-24.md`.

Run `cargo test -p bff-gateway` and `make bff-contract-check`. The executable
entrypoint is `cargo run -p bff-gateway`; bind/configuration details live in
`src/main.rs`. Never supply production credentials for local verification.
