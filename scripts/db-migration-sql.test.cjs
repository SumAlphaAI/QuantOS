const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {migrationSql,replayMigrationSql,snapshotRoleSql}=require('./db-migration-sql.cjs');
const filename='20261007180000_r02_snapshot_boundaries.sql';
const original=fs.readFileSync('supabase/migrations/'+filename,'utf8');
const schema='quantos_replay_'+'a'.repeat(32);

test('only the exact historical role declaration is adapted; all R02 SQL and raw checksum stay intact',()=>{
  const prepared=migrationSql(filename,original);
  assert.equal(prepared.replace(snapshotRoleSql,'create role quantos_snapshot_writer nologin;'),original);
  assert.equal(createHash('sha256').update(original).digest('hex'),'b58d2bef2dd9c9d313adc0f0a913a3ffffe3d75bef64c24bab8a99b797527406');
});
test('modified historical SQL is rejected instead of silently normalized',()=>{
  for(const sql of [original+'\n-- modified',original.replace('nologin','login'),original.replace('grant usage','-- grant usage')])
    assert.throws(()=>migrationSql(filename,sql),/MIGRATION_CHECKSUM/);
});
test('unregistered migrations are not rewritten',()=>{
  assert.equal(migrationSql('future.sql',original),original);
  for(const file of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&f!==filename)){
    const sql=fs.readFileSync('supabase/migrations/'+file,'utf8');
    assert.equal(migrationSql(file,sql),sql,file);
  }
});
test('rollback replay remaps both data and API schemas but preserves shared role identities',()=>{
  const sql=replayMigrationSql(filename,original,schema);
  assert(sql.includes('create schema '+schema+'_snapshot_api;'));
  assert(sql.includes('grant usage on schema '+schema+' to quantos_snapshot_writer;'));
  assert(sql.includes(snapshotRoleSql));
  assert(!/\bquantos_snapshot_api\b|\bquantos\b|^\s*(begin|commit)\s*;\s*$/gim.test(sql));
});
test('every migration replays without embedded transaction boundaries',()=>{
  for(const file of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql'))){
    const sql=replayMigrationSql(file,fs.readFileSync('supabase/migrations/'+file,'utf8'),schema);
    assert(!/^\s*(begin|commit)\s*;\s*$/gim.test(sql),file);
  }
});
test('replay schema injection, truncation and non-replay names are rejected',()=>{
  for(const name of ['quantos',schema+';drop schema quantos cascade',schema.slice(1),schema.toUpperCase(),schema+'b'])
    assert.throws(()=>replayMigrationSql(filename,original,name),/Invalid migration replay schema/);
});
