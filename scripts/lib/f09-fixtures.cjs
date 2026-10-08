const assert=require('node:assert/strict');
const {openConnection}=require('./r02-chain-connection.cjs');
const {validateBootstrap}=require('./postgres-bootstrap.cjs');
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
async function retireF09Fixtures(fixtures,run,{databaseUrl,createClient,pause}={}){
 assert(uuid.test(run));assert(Array.isArray(fixtures));const ids=new Set();
 for(const f of fixtures){assert.equal(f.run,run);assert(uuid.test(f.tenantId)&&uuid.test(f.actorId));assert(['fault','db-disconnect','live'].some(kind=>f.scope==='f09-'+kind+'-'+run+'-'+f.tenantId),'fixture scope ownership mismatch');assert(!ids.has(f.actorId));ids.add(f.actorId);}
 const receipt={schema:'quantos-f09-fixture-cleanup/v1',run,fixtureClass:'capacity-monitor-component-tests',status:'RUNNING',immutableFacts:'RETAINED',fixtures:[],bootstrapConnection:{}};
 if(!fixtures.length){receipt.status='NOT_NEEDED_NO_REGISTERED_FIXTURE';return receipt;}
 const phase={value:'INITIAL_CONNECTION'};let db;
 try{db=await openConnection(databaseUrl,'quantos-f09-owned-fixture-retirement',{record:receipt.bootstrapConnection,phase,save(){},createClient,pause});
 for(const f of fixtures){phase.value='VERIFY_OWNED_FIXTURE';const t=(await db.query('select id,slug from quantos.tenants where id=$1',[f.tenantId])).rows[0];const a=(await db.query('select id,tenant_id,service_name from quantos.actors where id=$1',[f.actorId])).rows[0];
 assert(!t||t.slug===f.scope);assert(!a||(a.tenant_id===f.tenantId&&a.service_name==='f09-test-'+f.actorId),'actor ownership mismatch');
 const before=(await db.query('select count(*)::int as n from quantos.event_log where tenant_id=$1',[f.tenantId])).rows[0].n;
 phase.value='RETIRE_OWNED_ACTOR';if(a)await db.query('update quantos.actors set is_active=false where id=$1 and tenant_id=$2 and service_name=$3',[f.actorId,f.tenantId,'f09-test-'+f.actorId]);
 const after=(await db.query('select (select count(*)::int from quantos.actors where id=$1 and tenant_id=$2 and is_active) as active_actors,(select count(*)::int from quantos.event_log where tenant_id=$2) as events',[f.actorId,f.tenantId])).rows[0];assert.equal(after.active_actors,0);assert.equal(after.events,before);
 receipt.fixtures.push({...f,tenantPresent:!!t,actorPresent:!!a,activeActors:0,eventsBefore:before,eventsAfter:after.events});}
 }catch(e){receipt.status='FAIL';receipt.failure={phase:e.chainPhase||phase.value,code:e.code||'F09_FIXTURE_CLEANUP_FAILED'};}
 finally{try{await db?.end();}catch(e){receipt.status='FAIL';receipt.failure||={phase:e.chainPhase||phase.value,code:e.code||'CONNECTION_CLOSE_FAILED'};}}
 if(receipt.status!=='FAIL')receipt.status='PASS';return receipt;
}
function validateF09Cleanup(r){assert.equal(r?.schema,'quantos-f09-fixture-cleanup/v1');assert.equal(r.status,'PASS');assert.equal(r.fixtureClass,'capacity-monitor-component-tests');assert.equal(r.immutableFacts,'RETAINED');assert(uuid.test(r.run));validateBootstrap(r.bootstrapConnection);assert.equal(r.bootstrapConnection.connectionClosed,true);assert((r.bootstrapConnection.transportErrors??[]).every(e=>e.afterStatements===false));assert.equal(r.fixtures.length,3);const kinds=new Set();for(const f of r.fixtures){assert.equal(f.run,r.run);assert(uuid.test(f.actorId)&&uuid.test(f.tenantId));const k=['fault','db-disconnect','live'].find(k=>f.scope==='f09-'+k+'-'+r.run+'-'+f.tenantId);assert(k&&!kinds.has(k));kinds.add(k);assert.equal(f.tenantPresent,true);assert.equal(f.actorPresent,true);assert.equal(f.activeActors,0);assert(Number.isInteger(f.eventsBefore)&&f.eventsBefore>=1);assert.equal(f.eventsAfter,f.eventsBefore);}}
module.exports={retireF09Fixtures,validateF09Cleanup};
