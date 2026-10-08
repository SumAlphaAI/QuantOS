const assert=require('node:assert/strict');
const {test}=require('node:test');
const {randomBytes}=require('node:crypto');
const {Client}=require('pg');
const {buildClientConfig}=require('./db-cli.cjs');
const {snapshotRoleSql}=require('./db-migration-sql.cjs');

test('configured PostgreSQL: repeated shared role bootstrap, unsafe-role rejection and fixture rollback',{
  skip:process.env.QUANTOS_RUN_MIGRATION_ROLE_TESTS!=='1',
  timeout:60000,
},async()=>{
  const client=new Client({...buildClientConfig(),connectionTimeoutMillis:10000});
  const fixture='quantos_ci_role_'+randomBytes(8).toString('hex');
  const fixtureSql=snapshotRoleSql.replaceAll('quantos_snapshot_writer',fixture);
  await client.connect();
  try {
    const ledgerSql="select sha256 from quantos.schema_migrations where filename='20261007180000_r02_snapshot_boundaries.sql'";
    const before=(await client.query(ledgerSql)).rows;
    assert.equal(before[0]?.sha256,'b58d2bef2dd9c9d313adc0f0a913a3ffffe3d75bef64c24bab8a99b797527406');
    await client.query('begin');
    try {
      // Existing production role: no replacement, revocation or grants.
      await client.query(snapshotRoleSql);
      await client.query(snapshotRoleSql);
      // New identity exists only inside this transaction, never a new database.
      await client.query(fixtureSql);
      await client.query(fixtureSql);
      const row=(await client.query('select rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls from pg_roles where rolname=$1',[fixture])).rows[0];
      assert(row);assert(Object.values(row).every(value=>value===false));
      await client.query('savepoint unsafe_role');
      await client.query(`alter role ${fixture} login`);
      await assert.rejects(client.query(fixtureSql),error=>error.code==='42501'&&error.message.includes('MIGRATION_CLUSTER_ROLE'));
      await client.query('rollback to savepoint unsafe_role');
      await client.query(fixtureSql);
    } finally {await client.query('rollback');}
    assert.equal((await client.query('select 1 from pg_roles where rolname=$1',[fixture])).rowCount,0,'fixture role must not survive rollback');
    assert.deepEqual((await client.query(ledgerSql)).rows,before,'immutable migration checksum must be unchanged');
    console.log(JSON.stringify({target:'configured-postgresql',sharedExistingRole:'PASS',newRoleAndRepeat:'PASS',unsafeLoginRole:'REJECTED',fixtureRole:fixture,cleanup:'ROLLED_BACK_AND_ABSENT',migrationChecksum:'UNCHANGED',databaseRebuild:'NOT_RUN'}));
  } finally {await client.end();}
});
