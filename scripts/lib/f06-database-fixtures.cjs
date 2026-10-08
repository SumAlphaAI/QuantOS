const assert=require('node:assert/strict');
const {openConnection}=require('./r02-chain-connection.cjs');
const {validateBootstrap}=require('./postgres-bootstrap.cjs');
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
async function retireDatabaseFixtures(fixtures,run,{databaseUrl,createClient,pause}={}){
 assert(uuid.test(run),'fixture run UUID required');
 assert(Array.isArray(fixtures)&&fixtures.length>0,'database fixture inventory required');
 const seen=new Set();for(const f of fixtures){assert.equal(f.run,run);assert(uuid.test(f.tenantId)&&uuid.test(f.userId));assert.equal(f.slug,'f06-'+f.tenantId);assert(!seen.has(f.tenantId),'duplicate fixture');seen.add(f.tenantId);}
 const receipt={schema:'quantos-f06-database-cleanup/v1',run,status:'RUNNING',immutableFacts:'RETAINED',fixtures:[],bootstrapConnection:{}};
 const phase={value:'INITIAL_CONNECTION'};let db;
 try{
  db=await openConnection(databaseUrl,'quantos-f06-database-owned-cleanup',{record:receipt.bootstrapConnection,phase,save(){},createClient,pause});
  for(const f of fixtures){
   phase.value='VERIFY_FIXTURE_OWNERSHIP';
   const t=(await db.query('select id,slug from quantos.tenants where id=$1',[f.tenantId])).rows[0];
   const u=(await db.query('select id,email from auth.users where id=$1',[f.userId])).rows[0];
   assert(!t||t.slug===f.slug,'fixture tenant ownership mismatch');
   assert(!u||u.email==='f06-'+f.userId+'@example.com','fixture user ownership mismatch');
   phase.value='RETIRE_OWNED_FIXTURE';
   if(t){
    await db.query('update quantos.actors set is_active=false where tenant_id=$1',[f.tenantId]);
    await db.query('update quantos.accounts set is_active=false where tenant_id=$1',[f.tenantId]);
    await db.query('update quantos.execution_service_sessions set revoked_at=coalesce(revoked_at,now()) where tenant_id=$1',[f.tenantId]);
   }
   if(u)await db.query('update quantos.bff_sessions set expires_at=least(expires_at,now()) where user_id=$1',[f.userId]);
   phase.value='VERIFY_RETIREMENT';
   const counts=(await db.query("select (select count(*)::int from quantos.actors where tenant_id=$1 and is_active) as active_actors,(select count(*)::int from quantos.accounts where tenant_id=$1 and is_active) as active_accounts,(select count(*)::int from quantos.execution_service_sessions where tenant_id=$1 and revoked_at is null and expires_at>now()) as active_execution_sessions,(select count(*)::int from quantos.bff_sessions where user_id=$2 and expires_at>now()) as active_bff_sessions",[f.tenantId,f.userId])).rows[0];
   assert.deepEqual(Object.values(counts),[0,0,0,0],'fixture retirement incomplete');
   receipt.fixtures.push({tenantId:f.tenantId,userId:f.userId,tenantPresent:!!t,userPresent:!!u,...counts});
  }
 }catch(e){receipt.status='FAIL';receipt.failure={phase:e.chainPhase||phase.value,code:e.code||'FIXTURE_CLEANUP_FAILED'};}
 finally{try{await db?.end();}catch(e){receipt.status='FAIL';receipt.failure||={phase:e.chainPhase||phase.value,code:e.code||'CONNECTION_CLOSE_FAILED'};}}
 if(receipt.status!=='FAIL')receipt.status='PASS';return receipt;
}
function validateDatabaseCleanup(r){
 assert.equal(r?.schema,'quantos-f06-database-cleanup/v1');assert.equal(r.status,'PASS');assert.equal(r.immutableFacts,'RETAINED');assert(uuid.test(r.run));
 validateBootstrap(r.bootstrapConnection);assert.equal(r.bootstrapConnection.connectionClosed,true);assert((r.bootstrapConnection.transportErrors??[]).every(e=>e.afterStatements===false));
 assert.equal(r.fixtures?.length,8,'eight seeded database fixtures must be retired');const ids=new Set();
 for(const f of r.fixtures){assert(uuid.test(f.tenantId)&&uuid.test(f.userId));assert(!ids.has(f.tenantId));ids.add(f.tenantId);assert.equal(f.tenantPresent,true);assert.equal(f.userPresent,true);for(const key of ['active_actors','active_accounts','active_execution_sessions','active_bff_sessions'])assert.equal(f[key],0);}
}
module.exports={retireDatabaseFixtures,validateDatabaseCleanup};
