const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { storageBucketsSql } = require('./lib/supabase-storage-fixture.cjs');

const directory = path.join(__dirname, '../supabase/migrations');
const migrations = fs.readdirSync(directory).filter(name => name.endsWith('.sql')).sort();
const inserts = migrations.flatMap(name => {
  const sql = fs.readFileSync(path.join(directory, name), 'utf8');
  return [...sql.matchAll(/insert\s+into\s+storage\.buckets\s*\(([^)]+)\)[\s\S]*?;/gi)]
    .map(match => ({ name, columns: match[1].split(',').map(column => column.trim()), sql: match[0] }));
});

test('all bucket migration INSERT columns exist in the shared CI fixture', () => {
  assert(inserts.length > 0, 'no bucket migrations found');
  const columns = new Set(storageBucketsSql.match(/\(([\s\S]*)\);/)[1]
    .split(',').map(column => column.trim().split(/\s+/)[0]));
  for (const insert of inserts) {
    for (const column of insert.columns) assert(columns.has(column), `${insert.name}: fixture lacks ${column}`);
  }
});

const target = process.env.F02_PG_ADMIN_URL || process.env.DATABASE_URL;
const live = Boolean(process.env.F02_PG_ADMIN_URL) || process.env.QUANTOS_RUN_STORAGE_FIXTURE_TESTS === '1';
test('PostgreSQL compiles bucket migrations and preserves private export limits', { skip: !live }, async t => {
  assert(target, 'configured database connection required');
  // Local development explicitly opts into the configured Supabase. CI already
  // supplies its disposable runner URL; this test never starts a database.
  const url = new URL(target);
  if (!process.env.F02_PG_ADMIN_URL) assert(url.hostname.endsWith('.supabase.com'));
  const caPath = url.searchParams.get('sslrootcert') || process.env.QUANTOS_BFF_SSLROOTCERT;
  const client = new Client({
    host: url.hostname, port: Number(url.port || 5432),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: process.env.F02_PG_ADMIN_URL ? undefined : {
      rejectUnauthorized: true,
      ...(caPath ? { ca: fs.readFileSync(caPath, 'utf8') } : {}),
    },
  });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(storageBucketsSql.replace('create table storage.buckets', 'create temporary table buckets').replace(/;$/, ' on commit drop;'));
    const execute = async () => {
      for (const insert of inserts) await client.query(insert.sql.replace(/storage\.buckets/gi, 'pg_temp.buckets'));
    };
    await t.test('the pre-fix missing column rejects the actual export migration', async () => {
      const exportInsert = inserts.find(insert => insert.columns.includes('file_size_limit'));
      assert(exportInsert, 'export limit migration missing');
      await client.query('savepoint missing_limit');
      await client.query('alter table pg_temp.buckets drop column file_size_limit');
      await assert.rejects(client.query(exportInsert.sql.replace(/storage\.buckets/gi, 'pg_temp.buckets')), error => error.code === '42703');
      await client.query('rollback to savepoint missing_limit');
    });
    await t.test('all current bucket migrations compile against the shared fixture', execute);
    await t.test('upsert restores privacy and 16 MiB limit and remains idempotent', async () => {
      await client.query("update pg_temp.buckets set public=true,file_size_limit=1 where id='quantos-bff-exports'");
      await execute();
      await execute();
      const rows = (await client.query("select public,file_size_limit from pg_temp.buckets where id='quantos-bff-exports'")).rows;
      assert.deepEqual(rows, [{ public: false, file_size_limit: '16777216' }]);
    });
  } finally {
    try { await client.query('rollback'); } finally { await client.end(); }
  }
});
