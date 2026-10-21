# Supabase support request draft — not sent

To: Supabase official support, https://supabase.com/dashboard/support/new

Subject: QuantOS Test cannot start: SQLSTATE 53100, no space left for pg_wal

Project: QuantOS Test (`qevsaxihufhklrayckud`), SumAlphaAI organization, Canada Central (`ca-central-1`), Free plan / Nano compute.

The test project's database became read-only, then stopped accepting SQL connections. A user-authorized restart on 22 October 2026 did not restore SQL access. The dashboard continues to show Unhealthy and previously reported 96% disk use. Scaling controls are disabled on the Free plan.

Postgres logs at 2026-10-22 07:54:06 Asia/Shanghai (2026-10-21 23:54:06 UTC) show:

```text
53100 could not write to file "pg_wal/xlogtemp.2566": No space left on device
00000 startup process (PID 2566) exited with exit code 1
00000 shutting down due to startup process failure
00000 database system is shut down
```

SQL clients return `57P03: the database system is not accepting connections`; one restart-period attempt returned `08006: Failed to connect to database: {:error, :timeout}`. Before the outage, a read-only SQL query reported database size 1,636,134,035 bytes. Much of the space appears to be accumulated test fixtures; we have prepared a selective export and cleanup procedure, but cannot run it while Postgres cannot start.

Please help recover enough disk/startup space to bring Postgres up, so we can back up and remove our disposable test fixtures and reclaim space. Please preserve the project, schema, migrations, Auth and existing data. We have not authorized project deletion, data loss, a database reset, or a paid subscription/upgrade. If a paid upgrade is required, please explain the required change and cost for the project owner to decide.

No database credentials, API keys, JWTs or passwords are included in this request.

Status: DRAFT_ONLY_NOT_SENT. Sending requires the user's explicit authorization.

User follow-up: “我自行联系支持”. This document is provided for the user to send; Codex has not submitted the request.
