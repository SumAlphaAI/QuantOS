#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");

const repoRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const migrationsTable = "quantos.schema_migrations";

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for remote PostgreSQL operations.");
  }
}

function buildClientConfig() {
  requireDatabaseUrl();

  const url = new URL(process.env.DATABASE_URL);
  const sslmode = url.searchParams.get("sslmode");

  // Match common libpq semantics for hosted providers like Supabase poolers.
  let ssl;
  if (sslmode === "disable") {
    ssl = undefined;
  } else if (sslmode === "verify-full" || sslmode === "verify-ca") {
    ssl = { rejectUnauthorized: true };
  } else if (sslmode === "require" || sslmode === "prefer") {
    ssl = { rejectUnauthorized: false };
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || "postgres",
    ssl,
  };
}

function listMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No migration files found in ${migrationsDir}`);
  }

  return files;
}

async function withClient(fn) {
  const client = new Client(buildClientConfig());
  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function ensureMigrationLedger(client) {
  await client.query(`
    create schema if not exists quantos;
    create table if not exists ${migrationsTable} (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function migrationLedgerExists(client) {
  const result = await client.query("select to_regclass($1) as regclass;", [
    migrationsTable,
  ]);

  return result.rows[0]?.regclass === migrationsTable;
}

async function applyMigrations() {
  const migrationFiles = listMigrationFiles();

  await withClient(async (client) => {
    await ensureMigrationLedger(client);

    for (const filename of migrationFiles) {
      const applied = await client.query(
        `select 1 from ${migrationsTable} where filename = $1 limit 1;`,
        [filename],
      );

      if (applied.rowCount > 0) {
        console.log(`Skipping already applied migration: ${filename}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
      console.log(`Applying migration: ${filename}`);
      await client.query(sql);
      await client.query(
        `insert into ${migrationsTable} (filename) values ($1);`,
        [filename],
      );
    }
  });
}

async function resetDatabase() {
  if (process.env.QUANTOS_DB_RESET_CONFIRM !== "reset_remote_schema") {
    throw new Error(
      "Set QUANTOS_DB_RESET_CONFIRM=reset_remote_schema to allow remote schema reset.",
    );
  }

  await withClient(async (client) => {
    console.log("Resetting remote quantos schema on DATABASE_URL target.");
    await client.query(`
      drop schema if exists quantos cascade;
      create schema quantos;
    `);
  });

  await applyMigrations();
}

async function schemaDiff() {
  const migrationFiles = listMigrationFiles();

  await withClient(async (client) => {
    if (!(await migrationLedgerExists(client))) {
      throw new Error(`Remote migration ledger ${migrationsTable} does not exist.`);
    }

    const remote = await client.query(
      `select filename from ${migrationsTable} order by filename;`,
    );
    const local = migrationFiles;
    const remoteFiles = remote.rows.map((row) => row.filename);

    if (JSON.stringify(remoteFiles) !== JSON.stringify(local)) {
      throw new Error(
        `Remote migration ledger does not match repository migrations.\nRemote: ${remoteFiles.join(", ")}\nLocal: ${local.join(", ")}`,
      );
    }

    console.log("Remote migration ledger matches repository migrations.");
  });
}

async function replayMigrationsInIsolatedSchema() {
  const migrationFiles = listMigrationFiles();
  const replaySchema = `quantos_replay_${crypto.randomUUID().replaceAll("-", "")}`;

  await withClient(async (client) => {
    await client.query("begin");
    try {
      for (const filename of migrationFiles) {
        const source = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
        const isolatedSql = source
          .replace(/^\s*(begin|commit)\s*;\s*$/gim, "")
          .replace(/\bquantos\b/g, replaySchema);
        await client.query(isolatedSql);
      }

      const objectSummary = await client.query(
        `select count(*)::int as table_count
         from information_schema.tables
         where table_schema = $1 and table_type = 'BASE TABLE'`,
        [replaySchema],
      );
      const tableCount = objectSummary.rows[0]?.table_count ?? 0;
      if (tableCount === 0) {
        throw new Error("Isolated migration replay created no base tables.");
      }

      console.log(
        `All ${migrationFiles.length} migrations replayed in isolated schema (${tableCount} base tables); rolling back.`,
      );
    } finally {
      await client.query("rollback");
    }
  });
}

async function liveRlsCheck() {
  await withClient(async (client) => {
    const missingRls = await client.query(`
      select n.nspname || '.' || c.relname as table_name
      from pg_class as c
      join pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'quantos'
        and c.relkind = 'r'
        and c.relname <> 'schema_migrations'
        and c.relrowsecurity is false
      order by 1;
    `);

    if (missingRls.rowCount > 0) {
      throw new Error(
        `RLS is disabled for one or more quantos tables: ${missingRls.rows.map((row) => row.table_name).join(", ")}`,
      );
    }

    const missingForceRls = await client.query(`
      select n.nspname || '.' || c.relname as table_name
      from pg_class as c
      join pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'quantos'
        and c.relkind = 'r'
        and c.relname <> 'schema_migrations'
        and c.relforcerowsecurity is false
      order by 1;
    `);

    if (missingForceRls.rowCount > 0) {
      throw new Error(
        `FORCE RLS is disabled for one or more quantos tables: ${missingForceRls.rows.map((row) => row.table_name).join(", ")}`,
      );
    }

    const missingPolicies = await client.query(`
      select n.nspname || '.' || c.relname as table_name
      from pg_class as c
      join pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'quantos'
        and c.relkind = 'r'
        and c.relname <> 'schema_migrations'
        and not exists (
          select 1
          from pg_policies as p
          where p.schemaname = n.nspname
            and p.tablename = c.relname
        )
      order by 1;
    `);

    if (missingPolicies.rowCount > 0) {
      throw new Error(
        `RLS policies are missing for one or more quantos tables: ${missingPolicies.rows.map((row) => row.table_name).join(", ")}`,
      );
    }

    const uuidPrimaryKeysWithoutDefaults = await client.query(`
      select cols.table_name, cols.column_name
      from information_schema.table_constraints as constraints
      join information_schema.key_column_usage as keys
        on keys.constraint_schema = constraints.constraint_schema
       and keys.constraint_name = constraints.constraint_name
      join information_schema.columns as cols
        on cols.table_schema = keys.table_schema
       and cols.table_name = keys.table_name
       and cols.column_name = keys.column_name
      where constraints.table_schema = 'quantos'
        and constraints.constraint_type = 'PRIMARY KEY'
        and cols.data_type = 'uuid'
        and cols.column_default is null
        and not exists (
          select 1
          from information_schema.table_constraints as foreign_constraints
          join information_schema.key_column_usage as foreign_keys
            on foreign_keys.constraint_schema = foreign_constraints.constraint_schema
           and foreign_keys.constraint_name = foreign_constraints.constraint_name
          where foreign_constraints.table_schema = cols.table_schema
            and foreign_constraints.table_name = cols.table_name
            and foreign_constraints.constraint_type = 'FOREIGN KEY'
            and foreign_keys.column_name = cols.column_name
        )
      order by cols.table_name, cols.column_name;
    `);

    if (uuidPrimaryKeysWithoutDefaults.rowCount > 0) {
      throw new Error(
        `UUID primary-key columns must define database defaults: ${uuidPrimaryKeysWithoutDefaults.rows.map((row) => `${row.table_name}.${row.column_name}`).join(", ")}`,
      );
    }

    const timestampsWithoutTimezone = await client.query(`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'quantos'
        and data_type = 'timestamp without time zone'
      order by table_name, column_name;
    `);

    if (timestampsWithoutTimezone.rowCount > 0) {
      throw new Error(
        `Timestamp columns must use timestamptz: ${timestampsWithoutTimezone.rows.map((row) => `${row.table_name}.${row.column_name}`).join(", ")}`,
      );
    }

    const unsafeWritePolicies = await client.query(`
      select schemaname || '.' || tablename as table_name, policyname, cmd
      from pg_policies
      where schemaname = 'quantos'
        and tablename <> 'schema_migrations'
        and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        and roles && array['authenticated'::name, 'anon'::name]
      order by 1, 2;
    `);

    if (unsafeWritePolicies.rowCount > 0) {
      throw new Error(
        `Authenticated write policies must remain disabled for tenant tables: ${unsafeWritePolicies.rows.map((row) => `${row.table_name}:${row.policyname}:${row.cmd}`).join(", ")}`,
      );
    }

    const legacySecretFunctionName =
      "quantos.resolve_execution_secret_reference(text, text, text)";
    const restrictedSecretFunctionName =
      "quantos.resolve_execution_secret_ref(text)";
    const secretFunctionPrivileges = await client.query(
      `
        select
          has_function_privilege('authenticated', $1, 'EXECUTE') as authenticated_legacy,
          has_function_privilege('anon', $1, 'EXECUTE') as anon_legacy,
          has_function_privilege('service_role', $1, 'EXECUTE') as service_role_legacy,
          has_function_privilege('quantos_execution_gateway', $1, 'EXECUTE') as gateway_legacy,
          has_function_privilege('authenticated', $2, 'EXECUTE') as authenticated_restricted,
          has_function_privilege('anon', $2, 'EXECUTE') as anon_restricted,
          has_function_privilege('service_role', $2, 'EXECUTE') as service_role_restricted,
          has_function_privilege('quantos_execution_gateway', $2, 'EXECUTE') as gateway_restricted,
          has_table_privilege('service_role', 'quantos.execution_secret_refs', 'SELECT') as service_role_table_select
      `,
      [legacySecretFunctionName, restrictedSecretFunctionName],
    );

    const privilegeRow = secretFunctionPrivileges.rows[0];
    if (
      privilegeRow.authenticated_legacy ||
      privilegeRow.anon_legacy ||
      privilegeRow.service_role_legacy ||
      privilegeRow.authenticated_restricted ||
      privilegeRow.anon_restricted ||
      privilegeRow.service_role_restricted ||
      privilegeRow.service_role_table_select
    ) {
      throw new Error(
        "Vault reference paths must be unreachable from authenticated, anon, and generic service roles.",
      );
    }

    if (!privilegeRow.gateway_legacy || !privilegeRow.gateway_restricted) {
      throw new Error(
        "Both execution secret allowlist functions must remain executable by quantos_execution_gateway.",
      );
    }

    console.log("Remote RLS checks passed for quantos schema.");
  });
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "apply":
      await applyMigrations();
      break;
    case "reset":
      await resetDatabase();
      break;
    case "schema-diff":
      await schemaDiff();
      break;
    case "replay-check":
      await replayMigrationsInIsolatedSchema();
      break;
    case "live-rls":
      await liveRlsCheck();
      break;
    default:
      throw new Error(
        "Usage: node ./scripts/db-cli.cjs <apply|reset|schema-diff|replay-check|live-rls>",
      );
  }
}

function connectionHint(error) {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  let hostname = "";
  try {
    hostname = new URL(process.env.DATABASE_URL).hostname;
  } catch {
    return null;
  }

  if (error && error.code === "ENOTFOUND") {
    if (hostname.startsWith("db.") && hostname.endsWith(".supabase.co")) {
      return `Cannot resolve ${hostname}. This environment can reach the Supabase project integration, but the direct PostgreSQL host in DATABASE_URL is not resolving. For Supabase hosted access, prefer the pooler connection string from the dashboard, usually with host like aws-0-<region>.pooler.supabase.com and user postgres.<project-ref>.`;
    }

    return `Cannot resolve database host ${hostname}. Check the DATABASE_URL host and DNS/network access from the current environment.`;
  }

  return null;
}

main().catch((error) => {
  const hint = connectionHint(error);
  console.error(error.message);
  if (hint) {
    console.error(hint);
  }
  process.exit(1);
});
