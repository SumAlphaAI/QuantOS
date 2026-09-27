# F09 Capacity Monitor Runbook

Run `capacity-monitor --watch` under a supervisor with `DATABASE_URL`,
`QUANTOS_TRACE_EXPORT_PATH`, and a durable `QUANTOS_F09_EVIDENCE_PATH`.
Window state and alerts live in Supabase PostgreSQL, so a restarted job
continues the original 15-minute and three-check windows.

## Metric producer contract

Producers call `quantos.record_operational_metric` with a numeric value, the
registered metric name as the source label, an optional correlation ID, and
non-sensitive attributes. The SQL intake rejects out-of-range values and
observations more than 24 hours old or 90 seconds in the future:

- Event projection consumer: end-to-end applied delay. Realtime quota usage
  still needs an actual provider source.
- Portfolio position and risk-input account queries: one latency sample per
  completed query, queued for bounded asynchronous batch persistence.
- Risk MV and operations refresh jobs: age in seconds after every refresh
  check once those jobs exist.
- Runtime Storage upload/download: `0` for success and `1` for failure; the
  monitor computes the window error rate. Other Storage paths need the same hook.
- Execution Gateway Vault read: `0`/`1` for controlled read outcome. Rotation
  failure needs a rotation workflow. RLS restricts the role to secret metrics.

Never place a credential, request payload, secret reference, session, or token
in metric attributes. SQL intake rejects sensitive keys and the Rust recorder
also recursively redacts them.

## Scheduled evaluation

```sh
cargo run -p capacity-monitor -- --watch --lookback-seconds 900
make f09-adr-input
```

The monitor reconnects every minute and fails closed if any of the nine externally produced metric
families lacks a sample in the last 90 seconds. It directly derives outbox age and
DLQ ratio from PostgreSQL truth tables, restores alert state, persists alerts,
and atomically publishes JSON evidence. The second command renders the complete
snapshot, alert IDs, correlations, metric sources, and remediation actions into
the capacity ADR template.

After a failure, first restore the missing producer or database connection. Do
not substitute zeros: an absent metric is unknown, not healthy.

Implemented producers are the event consumer's applied projection delay,
portfolio and risk-input query latency, Runtime Storage outcomes, and the
restricted Execution Gateway secret-read outcome. Realtime quota, risk MV,
operations aggregate freshness, and secret rotation have no implemented
business data source. The monitor must report their absence until those
sources are deployed. The F09 workflow requires `F09_DATABASE_URL`,
`F09_SUPABASE_URL`, and `F09_CA_PEM` secrets for its direct Supabase target job.
The database URL is the target test login for migration checks and fixture
setup. The F09 target Gate does not require or compare Runtime and Execution
database logins. Their restricted-role validation remains outside this Gate.
The workflow writes the configured CA to a temporary file. It starts no local
PostgreSQL instance. `F09_SUPABASE_URL` is the HTTPS project API origin, such as
`https://<project-ref>.supabase.co`, and is not a PostgreSQL connection string.
Use the project's direct or session-pooler port 5432 URL; this Gate excludes
transaction-pooler port 6543 because its probes require session state.

Download the database CA certificate from the Supabase Dashboard's project
**Database Settings → SSL Configuration → Download Certificate**. Put the
complete PEM certificate text into the GitHub Actions secret `F09_CA_PEM`.
The workflow writes it to a temporary PEM file, updates the PostgreSQL URL to
refer to that runner-local path, and verifies the server certificate and host.
Do not copy a local `sslrootcert` filesystem path into the GitHub secret as the
runner cannot access it. Supabase documents the certificate and `verify-full`
setup in its [Postgres connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

The F09 target Gate no longer imposes a same-region runner or a hard query P95
benchmark. Query latency samples and the 300 ms / 15 minute alert rule remain
part of F09 observability acceptance.
