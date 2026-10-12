import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedScope,validateScope} from './scope.mjs';
import {staticEnvironment} from '../../../../scripts/provider-a1-receipts.mjs';
test('proposed sixteen-node closure is valid but cannot grant admission',()=>{const r=validateScope(expectedScope());assert.equal(r.necessaryNodes,16);assert.equal(r.stageGate,'NOT_ASSESSED');});
test('fixture paths require two real calls to both RPCs',()=>{const r=expectedScope();assert.deepEqual(r.fixture.rpcs,['Execute','StreamExecute']);assert.equal(r.fixture.callsPerRpc,2);assert.equal(r.fixture.count,20);});
test('local commands exclude target checks and remote governance',()=>{const r=expectedScope();assert.equal(r.existingLocalChecks.length,53);assert(!r.existingLocalChecks.some(c=>['tp01-baseline','r01-target','r02-target'].includes(c.id)));assert(r.existingLocalChecks.find(c=>c.id==='tp01-local-baseline').command.includes('--skip-remote-governance'));});
test('credential and target opt-ins are stripped before Make can load configuration',()=>{assert.deepEqual(staticEnvironment({DATABASE_URL:'dummy',SUPABASE_URL:'dummy',GH_TOKEN:'dummy',QUANTOS_RUN_R02_POSTGRES_TESTS:'1'}),{QUANTOS_SKIP_ENV:'1'});});
for(const [name,mutate] of [
 ['missing R01',r=>r.necessaryClosure=r.necessaryClosure.filter(id=>id!=='CORE:R01')],
 ['missing R02',r=>r.necessaryClosure=r.necessaryClosure.filter(id=>id!=='CORE:R02')],
 ['duplicate node',r=>r.necessaryClosure[0]=r.necessaryClosure[1]],
 ['expanded roots',r=>r.roots.push('CORE:R04')],
 ['wrong consumer',r=>r.owner='CORE:TP01-C'],
 ['waived local negative test',r=>r.requiredNewChecks=[]],
 ['spliced prior candidate',r=>r.admissionRequirements.priorConsumerReceiptsCannotBeSpliced=false],
 ['missing function group',r=>r.existingLocalChecks.pop()],
 ['unsafe target command',r=>r.existingLocalChecks[0].command=['make','r02-live-check']],
 ['waived remote obligation',r=>r.release.checks=r.release.checks.filter(c=>c.id!=='tp01-baseline')],
 ['target PASS',r=>r.release.status='PASS'],
 ['real historical facts',r=>r.researchInput.retiredHistoricalFactsConsumed=32],
 ['live source license',r=>r.researchInput.realSourceLicenseGranted=true],
 ['narrowed fixture matrix',r=>r.fixture.count=19],
 ['streaming omitted',r=>r.fixture.rpcs=['Execute']],
 ['side effects before rejection',r=>r.fixture.rejectBeforeSideEffects=false],
 ['adapter removal waived',r=>r.fixture.adapterRemovedRuntimeRequired=false],
 ['R1 leaked READY',r=>r.gate.r1Service='READY'],
 ['database accepted',r=>r.gate.databaseExecution=true],
 ['formal accepted',r=>r.gate.formalAccepted=true],
 ['production authorized',r=>r.gate.production=true],
])test('scope rejects '+name,()=>{const r=expectedScope();mutate(r);assert.throws(()=>validateScope(r));});
