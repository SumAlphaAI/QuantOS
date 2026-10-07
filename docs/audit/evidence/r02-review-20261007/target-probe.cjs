// Audit-only Supabase probes. All database fixture writes roll back; no schema reset.
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict'),path=require('path');
const {targetUrl,client}=require(path.resolve('scripts/lib/r01-db.cjs'));
const out=path.resolve('docs/audit/evidence/r02-review-20261007');
const sha=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const owned={tenant:crypto.randomUUID(),foreignTenant:crypto.randomUUID(),user:crypto.randomUUID(),actor:crypto.randomUUID(),schema:crypto.randomUUID(),snapshot:crypto.randomUUID()};
const report={schema:'quantos-r02-audit-target/v1',target:'configured Supabase PostgreSQL',connectionMode:'same-project transaction pool explicitly selected',owned,checks:[],defects:[],status:'RUNNING',rlsMethod:'SET LOCAL ROLE authenticated + transaction-local auth.uid claims; not real Auth JWT HTTP'};
const add=(name,result,detail={})=>report.checks.push({name,result,...detail});
async function main(){const db=client(targetUrl(),'quantos-r02-audit',15000);try{
 await db.connect();await db.query('begin');await db.query("set local statement_timeout='10000ms'");
 const filenames=['20260731100000_data_snapshots_and_quality_gate.sql','20260916140000_r02_snapshot_immutability.sql'];
 const versions=(await db.query('select filename,sha256 from quantos.schema_migrations where filename=any($1)',[filenames])).rows;
 report.migrationHashes=versions.map(r=>({...r,localSha256:sha(fs.readFileSync('supabase/migrations/'+r.filename)).slice(7)}));
 add('migration hashes',report.migrationHashes.length===2&&report.migrationHashes.every(r=>r.sha256===r.localSha256)?'PASS':'FAIL');
 for(const t of [owned.tenant,owned.foreignTenant]) await db.query("insert into quantos.tenants(id,slug,name) values($1,$2,'R02 rollback-only audit')",[t,'r02-audit-'+t]);
 await db.query("insert into quantos.actors(id,tenant_id,actor_kind,display_name,service_name) values($1,$2,'service','R02 rollback-only audit','r02-audit')",[owned.actor,owned.tenant]);
 await db.query('insert into auth.users(id) values($1)',[owned.user]);
 await db.query("insert into quantos.tenant_memberships(tenant_id,user_id,role) values($1,$2,'viewer')",[owned.tenant,owned.user]);
 await db.query("insert into quantos.schema_registry(id,tenant_id,domain,schema_name,schema_version,content_hash,schema_document) values($1,$2,'audit','UnrelatedContract','v9',$3,'{}')",[owned.schema,owned.foreignTenant,sha('audit-schema')]);
 const hash=sha('audit deliberately unrelated to row payload'),now=new Date();
 await db.query(`insert into quantos.data_snapshots(id,tenant_id,schema_entry_id,schema_name,schema_version,window_start_at,window_end_at,captured_at,max_age_secs,expires_at,quality,license_label,content_hash,symbols,sources,artifact_refs,lineage)
 values($1,$2,$3,'DataSnapshot','v1',$4,$4,$4,120,$5,'passed','fixture-only',$6,'["BTC/USDT"]','[{"source_id":"fixture","provider":"fixture","dataset":"fixture","license_label":"fixture-only"}]','[]','[{"lineage_kind":"fixture","reference":"fixture","details":{}}]')`,[owned.snapshot,owned.tenant,owned.schema,now,new Date(now.getTime()+86400000),hash]);
 add('backend persistence/query', 'PASS');
 report.defects.push({id:'CROSS_TENANT_SCHEMA_REF',observed:'tenant A snapshot accepts tenant B unrelated schema registry row without checking schema name/version'});
 report.defects.push({id:'NO_HASH_EXPIRY_PAYLOAD_INVARIANT',observed:'valid sha256 format with unrelated payload and expires_at != captured_at + max_age persisted'});
 const dupe=await db.query("insert into quantos.data_snapshots select * from quantos.data_snapshots where id=$1 on conflict(tenant_id,content_hash) do nothing returning id",[owned.snapshot]);assert.equal(dupe.rowCount,0);add('same tenant hash conflict preserves row','PASS');
 await db.query('savepoint immutable');let updateCode;try{await db.query("update quantos.data_snapshots set quality='failed' where id=$1",[owned.snapshot]);}catch(e){updateCode=e.code;}await db.query('rollback to immutable');assert.equal(updateCode,'55000');add('snapshot UPDATE rejected','PASS',{sqlstate:updateCode});
 await db.query("insert into quantos.data_snapshot_quality_rules(tenant_id,usage_scope,allow_failed,require_license,require_freshness) values($1,'trading',true,false,false)",[owned.tenant]);
 report.defects.push({id:'PERMISSIVE_TRADING_RULE',observed:'database accepts allow_failed=true require_license=false require_freshness=false for trading'});
 const flags=(await db.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where oid in ('quantos.data_snapshots'::regclass,'quantos.data_snapshot_quality_rules'::regclass)")).rows;assert(flags.every(r=>r.relrowsecurity&&r.relforcerowsecurity));add('RLS enabled/forced','PASS',{flags});
 // A second snapshot in the other tenant gives a real positive/negative RLS row comparison.
 await db.query("insert into quantos.data_snapshots select gen_random_uuid(),$1,schema_entry_id,schema_name,schema_version,window_start_at,window_end_at,captured_at,max_age_secs,expires_at,quality,license_label,content_hash,symbols,sources,artifact_refs,lineage,quality_findings,created_at from quantos.data_snapshots where id=$2",[owned.foreignTenant,owned.snapshot]);
 await db.query('savepoint member');await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[owned.user,JSON.stringify({sub:owned.user,role:'authenticated'})]);
 try {const own=(await db.query('select id from quantos.data_snapshots where tenant_id=$1',[owned.tenant])).rows;const foreign=(await db.query('select id from quantos.data_snapshots where tenant_id=$1',[owned.foreignTenant])).rows;const rules=(await db.query('select usage_scope from quantos.data_snapshot_quality_rules where tenant_id=$1',[owned.tenant])).rows;assert.equal(own.length,1);assert.equal(foreign.length,0);assert.equal(rules.length,1);add('member own rows / foreign denied','PASS',{own:own.length,foreign:foreign.length,rules:rules.length});}
 catch(e){add('member own rows / foreign denied','FAIL',{sqlstate:e.code||null,assertion:e.code?'member read failed':'row counts unexpected'});}
 await db.query('rollback to member');
 const q='select id,tenant_id,schema_name,schema_version,window_start_at,window_end_at,captured_at,max_age_secs,expires_at,quality,license_label,content_hash,symbols,sources,artifact_refs,lineage,quality_findings,created_at from quantos.data_snapshots where tenant_id=$1 and id=$2';
 const samples=[];for(let i=0;i<25;i++){const t=process.hrtime.bigint();const r=await db.query(q,[owned.tenant,owned.snapshot]);assert.equal(r.rowCount,1);samples.push(Number(process.hrtime.bigint()-t)/1e6);}
 const sorted=[...samples].sort((a,b)=>a-b);report.queryBaseline={path:'actual SQL round trip, no Rust cache',rowsInFixture:2,samplesMs:samples,p95Ms:sorted[Math.ceil(samples.length*.95)-1],releaseTargetMs:300,formalPerformanceAcceptance:'NOT_ASSESSED; single small fixture / current developer-to-target path'};
 await db.query('rollback');
 const remaining=(await db.query('select count(*)::int n from quantos.tenants where id=any($1::uuid[])',[[owned.tenant,owned.foreignTenant]])).rows[0].n;assert.equal(remaining,0);report.fixtureRollback='PASS';
 report.status=report.checks.every(c=>c.result==='PASS')?'PASS_SCOPED_TARGET_CHECKS_WITH_DEFECTS':'FAIL_SCOPED_TARGET_CHECKS';
}finally{try{await db.query('rollback');}catch{}await db.end();}}
main().catch(e=>{report.status='FAIL';report.error={sqlstate:e.code||null,name:e.name};process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'target-probe.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks,defects:report.defects,fixtureRollback:report.fixtureRollback,p95Ms:report.queryBaseline?.p95Ms}));});
