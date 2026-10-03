// Applies only explicitly named, checksum-verified additive migrations to the configured Supabase.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

async function main() {
  process.loadEnvFile(path.resolve(".env.local"));
  const files = process.argv.slice(2);
  if (!files.length || files.some((name) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(name))) {
    throw Error("Explicit repository migration filenames are required");
  }
  const url = new URL(process.env.DATABASE_URL);
  if (!url.hostname.endsWith(".supabase.com") && !url.hostname.endsWith(".supabase.co")) {
    throw Error("Configured hosted Supabase PostgreSQL is required");
  }
  const ca = url.searchParams.get("sslrootcert") || process.env.QUANTOS_BFF_SSLROOTCERT;
  const client = new Client({ host: url.hostname, port: Number(url.port || 5432),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: url.pathname.slice(1), ssl: { rejectUnauthorized: true, ...(ca ? { ca: fs.readFileSync(ca, "utf8") } : {}) } });
  await client.connect();
  try {
    const role = (await client.query("select current_user as role")).rows[0].role;
    if (!role.startsWith("postgres")) throw Error("Explicit configured migration-owner connection required");
    for (const filename of files.sort()) {
      const bytes = fs.readFileSync(path.resolve("supabase/migrations", filename));
      const digest = crypto.createHash("sha256").update(bytes).digest("hex");
      const prior = await client.query("select sha256 from quantos.schema_migrations where filename=$1", [filename]);
      if (prior.rowCount) {
        if (prior.rows[0].sha256 !== digest) throw Error(`MIGRATION_CHECKSUM: ${filename}`);
        console.log(JSON.stringify({ filename, status: "ALREADY_APPLIED" }));
        continue;
      }
      const sql = bytes.toString("utf8");
      if (!/^\s*begin;/i.test(sql) || !/commit;\s*$/i.test(sql)) throw Error("Explicit transactional migrations required");
      const body = sql.replace(/^\s*begin;/i, "").replace(/commit;\s*$/i, "");
      await client.query("begin");
      try {
        await client.query(body);
        await client.query("insert into quantos.schema_migrations(filename,sha256) values($1,$2)", [filename,digest]);
        await client.query("commit");
      } catch (error) { await client.query("rollback"); throw error; }
      console.log(JSON.stringify({ filename, status: "APPLIED", checksumVerified: true }));
    }
  } finally { await client.end(); }
}
main().catch((error) => {
  // Never print database connection details or driver diagnostics containing credentials.
  console.error(JSON.stringify({ status: "FAIL", code: error.code || "MIGRATION_FAILED", message: /^MIGRATION_CHECKSUM:|^Explicit|^Configured/.test(error.message) ? error.message : "Reviewed migration failed; inspect the target through a trusted administrator." }));
  process.exitCode = 1;
});
