const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ensureContext } = require('./f06-test-identity-context.cjs');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { Client } = require('pg');

test('mismatched identity, partial context and unapproved repair fail before any write', async () => {
  for (const [state, restore] of [[{auth:false,tenant:false,account:false},true],
    [{auth:true,tenant:true,account:false},true], [{auth:true,tenant:false,account:false},false]]) {
    const statements = [];
    const client = {query: async sql => { statements.push(sql); return {rows:[state]}; }};
    await assert.rejects(ensureContext(client, {}, restore));
    assert.equal(statements.at(-1), 'rollback');
    assert.equal(statements.some(sql => /insert|update|delete|commit/i.test(sql)), false);
  }
});

test('actual Supabase restoration uses verified existing Auth and rolls back test fixture',
  {skip:process.env.QUANTOS_RUN_F06_CONTEXT_TEST !== '1'}, async () => {
    const url = new URL(process.env.DATABASE_URL);
    const client = new Client({host:url.hostname,port:Number(url.port||5432),user:decodeURIComponent(url.username),
      password:decodeURIComponent(url.password),database:url.pathname.slice(1),connectionTimeoutMillis:10000,
      ssl:{ca:fs.readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT,'utf8'),rejectUnauthorized:true}});
    const config={userId:process.env.QUANTOS_F06_TEST_USER_ID,email:process.env.QUANTOS_F06_TEST_EMAIL,
      tenantId:crypto.randomUUID(),accountId:crypto.randomUUID()};
    try {
      await client.connect();
      // Execute the exact restoration SQL, but roll the whole temporary fixture
      // back instead of committing. The configured user's context is untouched.
      const rollbackClient={query:(sql,params)=>client.query(sql==='commit'?'rollback':sql,params)};
      const result=await ensureContext(rollbackClient,config,true);
      assert.equal(result.context,'restored');
      assert.equal((await client.query('select count(*)::int as n from quantos.tenants where id=$1',[config.tenantId])).rows[0].n,0);
      await assert.rejects(ensureContext(client,config,false), /missing after schema reset/);
    } finally { await client.end(); }
  });
