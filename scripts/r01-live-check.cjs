// No local database. Seed only owned fixtures on the configured Supabase target.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const {spawnSync}=require('node:child_process');
const output=path.resolve(process.env.QUANTOS_R01_EVIDENCE_DIR||'artifacts/r01');fs.mkdirSync(output,{recursive:true});if(fs.readdirSync(output).length)throw Error('R01_EVIDENCE_NOT_EMPTY');
const {targetUrl,client:databaseClient,connectionMode}=require('./lib/r01-db.cjs');
const owned=[];let client;
const sourceFiles=['package.json','pnpm-lock.yaml','crates/quantos-market/src/lib.rs','crates/quantos-market/src/durable.rs','services/market-ingestor/src/main.rs','services/market-ingestor/src/cli.rs','crates/quantos-event/src/pg.rs','crates/quantos-market/src/tests.rs','crates/quantos-market/tests/postgres_ingestion.rs','services/market-ingestor/tests/cli.rs','services/market-ingestor/src/binance.rs','services/market-ingestor/tests/binance.rs','services/market-ingestor/src/binance/tests.rs','scripts/lib/r01-db.cjs','scripts/binance-supervisor.cjs','scripts/r01-supervision-check.cjs','scripts/tests/binance-supervisor.test.cjs','supabase/migrations/20261003120000_r01_binance_cursor.sql'];
const sourceHashesNow=()=>Object.fromEntries(sourceFiles.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
function run(args,extra={}){const result=spawnSync('cargo',args,{env:{...process.env,...extra},encoding:'utf8',timeout:600000,maxBuffer:16*1024*1024});fs.appendFileSync(path.join(output,'target-tests.log'),(result.stdout||'')+(result.stderr||''));if(result.status!==0)throw Error('R01_TARGET_TEST_FAILED');}
async function main(){
 process.env.DATABASE_URL=targetUrl();
 if(process.env.QUANTOS_R01_VERIFY_FULL==='1'){
  const u=new URL(process.env.DATABASE_URL),ca=u.searchParams.get('sslrootcert')||process.env.QUANTOS_BFF_SSLROOTCERT;
  if(!ca||!path.isAbsolute(ca)||!fs.existsSync(ca))throw Error('R01_VERIFIED_CA_REQUIRED');
  u.searchParams.set('sslmode','verify-full');u.searchParams.set('sslrootcert',ca);process.env.DATABASE_URL=u.toString();
 }
 run(['test','-p','quantos-market','-p','market-ingestor','--locked','--no-run']);
 client=databaseClient(process.env.DATABASE_URL);await client.connect();
 const migration=await client.query("select sha256 from quantos.schema_migrations where filename='20261002090000_r01_atomic_source_receipt.sql'");
 const expected=crypto.createHash('sha256').update(fs.readFileSync('supabase/migrations/20261002090000_r01_atomic_source_receipt.sql')).digest('hex');if(migration.rows[0]?.sha256!==expected)throw Error('R01_MIGRATION_NOT_APPLIED');
 const binanceHash=crypto.createHash('sha256').update(fs.readFileSync('supabase/migrations/20261003120000_r01_binance_cursor.sql')).digest('hex');
 const binanceMigration=await client.query("select sha256 from quantos.schema_migrations where filename='20261003120000_r01_binance_cursor.sql'");if(binanceMigration.rows[0]?.sha256!==binanceHash)throw Error('R01_BINANCE_MIGRATION_NOT_APPLIED');
 async function seed(){const tenant=crypto.randomUUID(),actor=crypto.randomUUID();await client.query("insert into quantos.tenants(id,slug,name) values($1,$2,'R01 owned validation fixture')",[tenant,`r01-check-${tenant}`]);owned.push(tenant);fs.writeFileSync(path.join(output,"owned-fixtures.json"),JSON.stringify(owned,null,2)+"\n");await client.query("insert into quantos.actors(id,tenant_id,actor_kind,display_name,service_name) values($1,$2,'service','R01 validation',$3)",[actor,tenant,`r01-${actor}`]);return{tenant,actor};}
 const primary=await seed(),foreign=await seed(),cli=await seed(),binance=await seed();
 const env={QUANTOS_RUN_R01_POSTGRES_TESTS:'1',QUANTOS_R01_TEST_TENANT:primary.tenant,QUANTOS_R01_TEST_ACTOR:primary.actor,QUANTOS_R01_TEST_FOREIGN_TENANT:foreign.tenant,QUANTOS_R01_TEST_FOREIGN_ACTOR:foreign.actor,QUANTOS_R01_CLI_TENANT:cli.tenant,QUANTOS_R01_CLI_ACTOR:cli.actor,QUANTOS_R01_BINANCE_TENANT:binance.tenant,QUANTOS_R01_BINANCE_ACTOR:binance.actor};
 fs.writeFileSync(path.join(output,'target-tests.log'),'');
 const sourceBefore=sourceHashesNow();fs.writeFileSync(path.join(output,'source-before.json'),JSON.stringify(sourceBefore,null,2)+'\n');
 // The fixture controller must not reserve a session while eight independent writers run.
 await client.end();client=undefined;
 if(process.env.QUANTOS_R01_COVERAGE==='1'){
  run(['llvm-cov','clean','--workspace']);
  run(['llvm-cov','--no-report',...(process.env.QUANTOS_R01_BRANCH==='1'?['--branch']:[]),'-p','quantos-market','-p','market-ingestor','--locked','--lib','--bin','market-ingestor','--test','postgres_ingestion','--test','cli','--test','binance','--','--test-threads=1','--nocapture'],env);
  run(['llvm-cov','report','--json','--output-path',path.join(output,'coverage.json')],env);
 }else{run(['test','-p','quantos-market','--locked','--test','postgres_ingestion','--','--test-threads=1','--nocapture'],env);run(['test','-p','market-ingestor','--locked','--test','cli','--test','binance','--','--test-threads=1','--nocapture'],env);}
 client=databaseClient(process.env.DATABASE_URL);await client.connect();
 const counts=await client.query("select (select count(*)::int from quantos.market_source_receipt where tenant_id=any($1::uuid[])) as receipts,(select count(*)::int from quantos.event_log where tenant_id=any($1::uuid[])) as events,(select count(*)::int from quantos.outbox_event where tenant_id=any($1::uuid[])) as outbox",[owned]);
 // RLS: unprivileged roles have no access, even with a forged tenant claim.
 let rls=true;await client.query('begin');try{await client.query('set local role authenticated');try{await client.query('select * from quantos.market_source_receipt limit 1');rls=false;}catch(e){if(e.code!=='42501')throw e;}}finally{await client.query('rollback');}if(!rls)throw Error('R01_RLS_FAILED');
 const rlsFlags=await client.query("select relrowsecurity,relforcerowsecurity from pg_class where oid='quantos.market_source_receipt'::regclass");if(!rlsFlags.rows[0]?.relrowsecurity||!rlsFlags.rows[0]?.relforcerowsecurity)throw Error('R01_RLS_FLAGS');
 await client.query('begin');try{try{await client.query("update quantos.market_source_receipt set source_hash=source_hash where tenant_id=$1",[primary.tenant]);throw Error('R01_IMMUTABILITY_FAILED');}catch(e){if(e.code!=='55000')throw e;}}finally{await client.query('rollback');}
 const sourceHashes=sourceHashesNow();if(JSON.stringify(sourceHashes)!==JSON.stringify(sourceBefore))throw Error('R01_SOURCE_CHANGED_DURING_TEST');
 const report={sourceHashes,receiptImmutability:'PASS',schema:'quantos-r01-target/v1',connectionMode:connectionMode(process.env.DATABASE_URL),sourceCommit:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),workingTreeModified:spawnSync('git',['status','--porcelain'],{encoding:'utf8'}).stdout.trim().length>0,status:'PASS',target:'configured Supabase PostgreSQL',migrationHash:expected,binanceMigrationHash:binanceHash,counts:counts.rows[0],rls:'PASS',provider:'FIXTURE_ONLY_NO_REAL_PROVIDER_RECEIPT',evidence:'target-tests.log'};fs.writeFileSync(path.join(output,'target-receipt.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
(async()=>{
 try{await main();}catch(e){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({status:'FAIL',reason:/^R01_/.test(e.message)?e.message:'R01_TARGET_ENVIRONMENT_FAILURE',ownedTenants:owned},null,2)+'\n');console.error(e.message.startsWith('R01_')||e.message.endsWith('_REQUIRED')?e.message:'R01_TARGET_ENVIRONMENT_FAILURE');process.exitCode=1;}
 finally{
  let cleanup={status:'FAIL',actors:[]};
  try{
   if(!client&&owned.length){client=databaseClient(process.env.DATABASE_URL);await client.connect();}
   if(client){for(const tenant of owned)await client.query('update quantos.actors set is_active=false where tenant_id=$1 and service_name like $2',[tenant,'r01-%']);cleanup.actors=(await client.query('select id,is_active from quantos.actors where tenant_id=any($1::uuid[]) and service_name like $2',[owned,'r01-%'])).rows;}
   cleanup.status=owned.length===4&&cleanup.actors.length===4&&cleanup.actors.every(a=>a.is_active===false)?'PASS':'FAIL';
  }catch{cleanup.reason='R01_ACTOR_CLEANUP_FAILED';}
  finally{fs.writeFileSync(path.join(output,'actor-cleanup.json'),JSON.stringify(cleanup,null,2)+'\n');if(cleanup.status!=='PASS')process.exitCode=1;if(client)await client.end();}
 }
})();
