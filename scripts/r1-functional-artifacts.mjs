// Development admission binds actual target outcomes, cleanup and all nested evidence.
import assert from 'node:assert/strict';
import {readFileSync,realpathSync,readdirSync,statSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {validateCoverage as r01Coverage} from './check-r01-coverage.mjs';
import {validateCoverage as r02Coverage} from './check-r02-coverage.mjs';
const {retainedSourcePolicy}=createRequire(import.meta.url)('./r02-retained-source-policy.cjs');
const root=resolve(import.meta.dirname,'..');
export const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
function safe(base,name){assert(typeof name==='string'&&!name.includes('\\')&&!name.includes(':')&&!name.startsWith('/')&&!name.split('/').includes('..'),'unsafe R1 evidence path');const p=realpathSync(resolve(base,name));assert(p.startsWith(realpathSync(base)+sep)&&statSync(p).isFile(),'R1 evidence escapes directory');return p;}
export function evidenceInventory(base){const walk=p=>statSync(p).isDirectory()?readdirSync(p).sort().flatMap(n=>walk(resolve(p,n))):[p];return walk(resolve(base,'target')).map(p=>({path:relative(base,p).split(sep).join('/'),sha256:hash(readFileSync(safe(base,relative(base,p))))})).sort((a,b)=>a.path.localeCompare(b.path));}
export function r1SupportingPaths(r){assert(Array.isArray(r.evidence)&&r.evidence.length>0,'R1 supporting evidence missing');return r.evidence.map(e=>e.path);}
function sources(files){assert(files?.length>0,'target source inventory missing');assert.equal(new Set(files.map(f=>f.path)).size,files.length,'duplicate target source');for(const f of files)assert.equal(hash(readFileSync(safe(root,f.path))),f.sha256.startsWith('sha256:')?f.sha256:'sha256:'+f.sha256,'target source changed');}
export function validateR1Artifact(kind,path,source,{sourcePolicy=retainedSourcePolicy}={}){
 const base=dirname(path),r=JSON.parse(readFileSync(path));
 assert.equal(r.schema,'quantos-r1-development-target/v1');assert.equal(r.nodeId,kind==='r01-target'?'CORE:R01':'CORE:R02');assert.equal(r.status,'PASS');assert.equal(r.sourceCommit,source);assert.equal(r.target,'configured-supabase');assert.equal(r.formalAccepted,false);assert.equal(r.ingestionStarted,false);assert.equal(r.release,'NOT_RUN_RELEASE_STAGE');assert.equal(r.exitCode,0);assert.deepEqual(r.evidence,evidenceInventory(base),'target evidence missing, substituted or changed');
 const json=n=>JSON.parse(readFileSync(safe(base,'target/'+n)));
 const log=n=>readFileSync(safe(base,'target/'+n),'utf8');
 if(kind==='r01-target'){
  const t=json('target-receipt.json'),c=json('actor-cleanup.json');
  assert.equal(t.schema,'quantos-r01-target/v1');assert.equal(t.sourceCommit,source);assert.equal(t.status,'PASS');assert.equal(t.target,'configured Supabase PostgreSQL');assert.equal(t.provider,'FIXTURE_ONLY_NO_REAL_PROVIDER_RECEIPT');assert.equal(t.rls,'PASS');assert.equal(t.receiptImmutability,'PASS');
  assert.deepEqual(t.sourceHashes,json('source-before.json'));sources(Object.entries(t.sourceHashes).map(([path,sha256])=>({path,sha256})));
  for(const [key,file] of [['migrationHash','20261002090000_r01_atomic_source_receipt.sql'],['binanceMigrationHash','20261003120000_r01_binance_cursor.sql']])assert.equal('sha256:'+t[key],hash(readFileSync(resolve(root,'supabase/migrations',file))));
  assert(t.counts.receipts>0&&t.counts.events>0&&t.counts.outbox===t.counts.events,'target facts absent or outbox incomplete');
  assert.equal(json('owned-fixtures.json').length,4);assert.equal(c.status,'PASS');assert.equal(c.actors.length,4,'actor cleanup must not be vacuous');assert(c.actors.every(a=>a.is_active===false));assert.match(log('target-tests.log'),/test result: ok/);assert(!log('target-tests.log').includes('test result: FAILED'));
  r01Coverage(json('coverage.json'));
 }else{
  assert.equal(kind,'r02-target');const combined=json('receipt.json'),c=json('chain/receipt.json'),b=json('boundaries/receipt.json'),chain=json('chain/chain-result.json');
  assert.equal(combined.result,'PASS_SCOPED_TARGET');assert.equal(combined.steps.length,3);assert(combined.steps.every(s=>s.exitCode===0));assert(combined.steps[2].args.includes('scripts/r02-live-check.cjs'));
  assert.equal(c.schema,'quantos-r02-persisted-chain/v1');assert.equal(c.result,'PASS_SCOPED_TARGET');assert.equal(c.ingestionStarted,false);assert.equal(c.deployment,'NOT_RUN_RELEASE_STAGE');assert.equal(c.formalAcceptance,'NOT_ACCEPTED');assert.equal(c.test.code,0);assert.equal(c.test.timedOut,false);assert.equal(c.cleanup.result,'PASS');assert.equal(c.cleanup.actor.id,c.actor);assert.equal(c.cleanup.actor.is_active,false);assert.equal(c.cleanup.providerProcessesStarted,0);assert.equal(c.cleanup.immutableFacts,'RETAINED');sources(c.sourceFiles);
  assert.deepEqual(json('chain/source-policy.json'),sourcePolicy(),'current approved retained-purpose policy changed or expired');assert.deepEqual(c.approval,sourcePolicy().evidence);
  assert.equal(chain.result,'PASS');assert.equal(chain.actualMarketEvents,32);assert.equal(chain.quality,'degraded');assert(chain.sourceAgeSecs>0);assert.equal(chain.strategyTrading,'REJECTED');assert.equal(chain.crossTenant,'REJECTED');assert.equal(chain.persistentSignalConsumer,'REJECTED_BEFORE_ENGINE');assert.equal(chain.engineStopped,true);assert.equal(chain.research.length,2);assert.equal(chain.sourceApprovalNegatives,4);assert.equal(chain.readerAuthorizationNegatives,2);assert.equal(chain.wireTamperingNegatives,4);assert.match(log('chain/target-chain.log'),/1 passed; 0 failed/);
  assert.equal(b.schema,'quantos-r02-live/v2');assert.equal(b.result,'PASS_SCOPED_TARGET');assert.equal(b.target,'configured Supabase only');assert.equal(b.releasePerformance,'NOT_RUN_RELEASE_STAGE');assert.equal(b.formalAcceptance,'NOT_ACCEPTED');assert.equal(b.cleanup.result,'PASS');assert(b.cleanup.actors.length>0&&b.cleanup.actors.every(a=>a.is_active===false));assert.equal(b.cleanup.temporaryFaultTriggers.length,0);assert.equal(b.cleanup.metadata,'RETAINED');assert(b.tests.length>0&&b.tests.every(t=>t.code===0&&!t.timedOut&&t.result==='PASS'));sources(b.sourceFiles);
  const coverage=r02Coverage(json('boundaries/coverage.json'));assert.deepEqual(b.coverage,coverage);assert.deepEqual(json('boundaries/coverage-summary.json'),coverage);assert.match(log('boundaries/target-coverage.log'),/R02_RELEASE_PERFORMANCE_NOT_RUN/);
 }
 return {status:'PASS',nodeId:r.nodeId,formalAccepted:false};
}
