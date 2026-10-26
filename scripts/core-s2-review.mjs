// CORE-GATE:S2 current strategy-loop assessment. No stage promotion.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {inputs as s04Inputs} from './core-s04-review.mjs';
import {webEnvironment} from './p0-functional-scope.mjs';
import {hash,verifyInputs} from './g1-download-review.mjs';
import {browserReport} from './core-r1-review.mjs';
import {validateChain,validateRegistration} from './g3-integration-01-review.mjs';
import {validateNetwork} from './ui303-review.mjs';
export const directory='docs/audit/evidence/core-s2-local-20261026';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
export const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(p+'/'+e.name):[p+'/'+e.name]).sort();
export const boundary=()=>({nodeId:'CORE-GATE:S2',engineeringGate:'PASS_OWNED_LOCAL_S2_STRATEGY_LOOP',developmentAssessment:'COMPLETED',businessIntegration:'PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS',stageGate:'NOT_ASSESSED',gate:'NOT_READY_GAPS_OPEN',formalAccepted:false,runtimeAdmission:'DENIED',research:'ACTUAL_R03_RD_AGENT_AND_STRATEGY_LAB_UDS',consumption:'SAME_WEB_RELEASE_TO_NATIVE_PAPER_SHADOW_CONFIGURATION',identity:'REFERENCE_COOKIE_BRIDGE',approval:'INDEPENDENT_REFERENCE_ACTOR_MFA_CONTROL',catalog:'FRESH_PROCESS_OWNER_INSTALL_NOT_PERSISTENT_INCREMENTAL',nativeConsumptionPort:'CFG_TEST_NODE_LOOPBACK_ONLY',nativeAudit:'CORE_SERVICE_AUDIT_SEPARATE_FROM_C10_INDEX',upstreamAdoption:'NO_NEW_RUNTIME_DEPENDENCY_OFFLINE_REFERENCE_VERIFICATION',legacySelfApprovals:'FAIL_CLOSED_NO_AUTOMATIC_REPAIR',database:'NOT_RUN_PG_CODE_COMPILE_ONLY',persistentRecovery:'NOT_RUN',productionQueueAndIncrementalRegistration:'NOT_RUN',realIdpMfa:'NOT_RUN',fullBrowserAndManualAccessibility:'NOT_RUN',wholeWorkspace:'NOT_RUN',remoteCiAndRelease:'NOT_RUN',productionCredentialsUsed:false,externalPublished:false,pushed:false,nextTask:'CORE:X06'});
export function validateBoundary(value){assert.deepEqual(value,boundary());}
export const checks=[
 ['development',['node','scripts/development-execution.mjs','--development','CORE-GATE:S2']],
 ['bff-binary',['cargo','build','--locked','--offline','-p','bff-gateway','--bin','bff-gateway']],
 ['strategy-domain',['cargo','test','--locked','--offline','-p','quantos-strategy','--lib','--','--nocapture']],
 ['s04-tcp',['cargo','test','--locked','--offline','-p','quantos-strategy','--test','service_s04','--','--nocapture']],
 ['risk-consumer',['cargo','test','--locked','--offline','-p','quantos-risk','--lib','--test','x02_guard']],
 ['execution-consumer',['cargo','test','--locked','--offline','-p','quantos-execution','--test','x03_authority','--test','tp07_dispatch','--test','tp12_boundary']],
 ['pg-compile-only',['cargo','test','--locked','--offline','-p','quantos-strategy','--test','postgres_releases','--no-run']],
 ['worker-handoff',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','g3_research_tests::worker','--','--nocapture']],
 ['c05-c08',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','strategy::tests::']],
 ['consumer',['pnpm','exec','vitest','run','apps/terminal/tests/ui303.test.ts','apps/terminal/tests/strategy-recovery.test.ts','apps/terminal/tests/strategy-provider-consumer.test.ts','apps/terminal/tests/fep3-closure.test.ts','apps/terminal/tests/ui504-provider-consumer.test.ts','--reporter=verbose','--reporter=json','--outputFile={attempt}/consumer.json']],
 ['tp07-reference',['engines/.venv/bin/python','scripts/tp07-evaluation.py']],
 ['tp12-reference',['engines/.venv/bin/python','scripts/tp12-evaluation.py']],
 ['tp08-reference',['node','scripts/tp08-evaluation.mjs','--workspace']],
 ['tp09-reference',['node','scripts/tp09-evaluation.mjs','--workspace']],
 ['tp10-reference',['node','scripts/tp10-evaluation.mjs','--workspace']],
 ['tp11-reference',['node','scripts/tp11-evaluation.mjs','--workspace']],
 ['tp07-runtime-refusal',['engines/.venv/bin/python','scripts/tp07-evaluation.py','--runtime'],1],
 ['tp12-runtime-refusal',['engines/.venv/bin/python','scripts/tp12-evaluation.py','--runtime'],1],
 ['governance',['node','scripts/core-s2-review.mjs','--inventory']],
 ['governance-python',['engines/.venv/bin/python','-m','pytest','scripts/tests/test_tp07_evaluation.py','scripts/tests/test_tp12_evaluation.py','-v','--junitxml={attempt}/governance-python.xml']],
 ['gate-tests',['node','--test','scripts/core-s2-review.test.mjs','scripts/development-execution.test.mjs','scripts/tp08-evaluation.test.mjs','scripts/tp09-evaluation.test.mjs','scripts/tp10-evaluation.test.mjs','scripts/tp11-evaluation.test.mjs']],
 ['lint',['pnpm','exec','eslint','tests/e2e/fixtures/frontend-g3-reference.ts','tests/e2e/s2-integration.spec.ts','playwright.s2.config.ts','playwright.config.ts','scripts/core-s2-review.mjs','scripts/core-s2-review.test.mjs']],
 ['format',['cargo','fmt','--check','-p','quantos-strategy','-p','bff-gateway']],
 ['host-build',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','--no-run','--message-format=json']],
 ['s2-browser',['pnpm','exec','playwright','test','--config','playwright.s2.config.ts','--project','chromium','--output','{attempt}/s2-browser','--reporter=list,json']],
 ['browser-regression',['pnpm','exec','playwright','test','--config','playwright.frontend-g3.config.ts','--project','chromium','--grep','actual immutable Release|stale saved head|readonly approver|offline clears Release|empty catalog','--output','{attempt}/browser-regression','--reporter=list,json']],
 ['plans',['node','scripts/check-development-plans.mjs']],
 ['integration-refusal',['node','scripts/development-execution.mjs','--integration','CORE-GATE:S2'],1],
 ['next-development',['node','scripts/development-execution.mjs','--development','CORE:X06']]
];
export function inputs(){const paths=new Set([...s04Inputs().map(f=>f.path),...execFileSync('git',['ls-files','--','third_party/nautilus-trader','third_party/nautilus-agents','third_party/qlib','third_party/trendradar','third_party/valuecell','third_party/openstock','docs/adr','docs/operations','docs/audit/TP*.md','docs/audit/EVALUATION-TP*.md','docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md','tests/e2e/s2-integration.spec.ts'],{encoding:'utf8'}).trim().split('\n')]);return [...paths].sort().map(path=>({path,sha256:hash(read(path))}));}
export function governance(){const paths=['docs/adr/20261015-tp06-native-strategy-generator.md','docs/adr/20261016-tp07-evaluation-boundary.md','docs/adr/20260731-tp08-qlib-evaluation.md','docs/adr/20260731-tp09-trendradar-evaluation.md','docs/adr/20260731-tp10-valuecell-evaluation.md','docs/adr/20260731-tp11-openstock-evaluation.md','docs/adr/20261016-tp12-evaluation-boundary.md'];return paths.map((path,i)=>{const bytes=read(path),body=bytes.toString();assert(body.length>500);assert(/reference.only|原生|EVALUATION_ONLY/.test(body),path);return{task:'TP'+String(i+6).padStart(2,'0'),path,sha256:hash(bytes),disposition:i===0?'OWNED_NATIVE_IMPLEMENTATION_NO_UPSTREAM_IMPORT':'REFERENCE_OR_EVALUATION_ONLY',upstreamRuntimeAdopted:false,formalAccepted:false,latestLegalAndCveReview:'NOT_RUN'};});}
export function webReuse(){const sourceCommit='1f3c8725bbd3f512938add4dab52363c380825d8';assert.equal(execFileSync('git',['diff',sourceCommit,'--name-only','--','apps/terminal','packages','pnpm-lock.yaml'],{encoding:'utf8'}).trim(),'');const old=JSON.parse(execFileSync('git',['show',sourceCommit+':package.json'],{encoding:'utf8'})),current=json('package.json');delete old.scripts;delete current.scripts;assert.deepEqual(current,old);const receipt=json('apps/terminal/out/pre03-build.json');assert.equal(receipt.buildId,'terminal-'+sourceCommit);return{sourceCommit,productInputsUnchanged:true,buildReexecuted:false,receipt,exportedFiles:files('apps/terminal/out').map(path=>({path,sha256:hash(read(path))}))};}
export function validateNativeRows(rows){assert.equal(rows.length,20);assert.equal(new Set(rows.map(r=>r.releaseId)).size,20);assert.equal(new Set(rows.map(r=>r.index)).size,20);for(const row of rows){assert(Number.isInteger(row.index)&&row.index>=1&&row.index<=20);assert.equal(row.refused.status,409);assert.equal(row.consumed.length,2);assert.deepEqual(row.consumed.map(c=>c.target),['paper','shadow']);for(const c of row.consumed){assert.equal(c.scope,'LOCAL_CONFIGURATION_ONLY_NO_EXTERNAL_DEPLOYMENT');assert.equal(c.configuration.release_hash,c.ticket.release_hash);assert.equal(c.configuration.target,c.target);assert(c.configuration.report_hash);assert(c.nativeAudit.items.some(e=>e.operation==='deployment.consume'&&e.status===200));}}}
export function validateInformationRequest(r){assert.equal(r.approvalState,'rejected');assert(r.approvalRef);const event=r.approvalTimeline.at(-1);assert.equal(event.action,'request_info');assert.equal(typeof event.reason,'string');assert(event.reason.length>0);assert(r.evidenceRefs.length>0);}
export function validateRecovery(r){assert.equal(r.calls.length,2);assert(r.calls.every(c=>c.status===202));assert.equal(r.calls[0].source,'REFERENCE_COMMITTED_RESPONSE_DROPPED');for(const key of ['keyHash','bodyHash','version']){assert(r.calls[0][key]);assert.equal(r.calls[0][key],r.calls[1][key]);}assert.equal(r.release.approvalState,'pending');assert.equal(r.release.approvalTimeline.filter(e=>e.action==='submitted').length,1);}
export function verify(r){
 validateBoundary(r.boundary);verifyInputs(r.sourceCommit,r.inputs);assert.deepEqual(inputs(),r.inputs);assert.equal(r.executions.length,checks.length);
 for(const[i,e]of r.executions.entries()){const[id,args,exit=0]=checks[i];assert.equal(e.id,id);assert.deepEqual(e.command,args.map(s=>s.replaceAll('{attempt}',r.attempt)));assert.equal(e.exitCode,exit,id);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(hash(read(e.log)),e.logSha256);assert(Date.parse(e.finishedAt)>=Date.parse(e.startedAt));}
 assert.deepEqual(r.artifacts.map(f=>f.path),files(r.attempt));for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256,f.path);
 browserReport(json(r.attempt+'/s2-browser.json'),26);browserReport(json(r.attempt+'/browser-regression.json'),5);
 const host=json(r.attempt+'/host.json'),binary=json(r.attempt+'/binary.json');assert.equal(host.sourceCommit,r.sourceCommit);assert.equal(binary.sourceCommit,r.sourceCommit);assert.equal(hash(read(host.executable)),host.sha256);assert.equal(hash(read(binary.executable)),binary.sha256);
 assert.deepEqual(r.webReuse,webReuse());assert.deepEqual(json(r.attempt+'/governance.log'),governance());
 const consumer=json(r.attempt+'/consumer.json');assert.equal(consumer.success,true);assert(consumer.numTotalTests>40);assert.equal(consumer.numPassedTests,consumer.numTotalTests);assert.equal(consumer.numPendingTests,0);assert.equal(consumer.numFailedTests,0);
 const rows=r.artifacts.filter(f=>f.path.endsWith('/g3-fixture.json')).map(f=>json(f.path));assert.equal(rows.length,20);assert.equal(new Set(rows.map(v=>v.index)).size,20);assert.equal(new Set(rows.map(v=>v.approved.releaseId)).size,20);
 for(const v of rows){assert.equal(v.sourceCommit,r.sourceCommit);assert.equal(v.approved.approvalState,'approved');assert.equal(v.approved.sourceDigest,r.sourceCommit);assert.equal(v.approved.imageDigest,host.sha256);assert.equal(v.approved.contentHash,v.release?.contentHash??v.pending.contentHash);assert.deepEqual(v.approved.evidenceRefs,v.draft.artifactRefs);}
 const chains=r.artifacts.filter(f=>f.path.endsWith('/r03-causal-chain.json')).map(f=>json(f.path));assert.equal(chains.length,20);for(const row of chains){validateRegistration(row.registration);validateChain(row.chain);}
 const networks=r.artifacts.filter(f=>f.path.endsWith('/ui301.json'));assert.equal(networks.length,31);for(const f of networks){const n=json(f.path);validateNetwork(n,r.sourceCommit,f.path.includes('/s2-browser/')?host.sha256:binary.sha256);assert(!n.rows.some(row=>/commands|deployment|orders/.test(row.path)));}
 const one=suffix=>{const found=r.artifacts.filter(f=>f.path.endsWith('/'+suffix));assert.equal(found.length,1);return json(found[0].path);};
 validateInformationRequest(one('s04-request-info.json'));validateRecovery(one('s04-submission-recovery.json'));assert.equal(one('g3-rejected.json').approvalState,'rejected');assert.equal(one('g3-expired.json').approvalState,'expired');const race=one('g3-concurrency.json');assert.equal(race.statuses.filter(s=>s===200).length,1);assert.equal(race.statuses.filter(s=>[403,409].includes(s)).length,19);
 let axeScans=0,incomplete=0;for(const f of r.artifacts.filter(f=>/axe\.json$/.test(f.path))){const a=json(f.path);for(const scan of a.scans??[a]){assert.equal(scan.violations.length,0);axeScans++;incomplete+=scan.incomplete.length;}}assert(axeScans>=3);
 assert.match(read(r.attempt+'/s04-tcp.log').toString(),/test result: ok\. 7 passed; 0 failed; 0 ignored/);assert.match(read(r.attempt+'/worker-handoff.log').toString(),/test result: ok\. 2 passed; 0 failed; 0 ignored/);
 assert.equal(json(r.attempt+'/integration-refusal.log').reason,'STAGE_NOT_READY');const native=r.artifacts.filter(f=>f.path.endsWith('/s2-native-consumers.json')).map(f=>json(f.path));validateNativeRows(native);for(const n of native){const approved=rows.find(r=>r.index===n.index).approved;assert.equal(n.releaseId,approved.releaseId);for(const c of n.consumed){assert.equal(c.configuration.release_hash,approved.contentHash);assert.equal(c.configuration.report_hash,approved.backtestReportHash);assert.deepEqual(c.configuration.parameters,approved.parameters);}}assert.equal(json(r.attempt+'/next-development.log').allowed,true);
 return{sourceCommit:r.sourceCommit,...r.boundary,checks:checks.length,consumerCases:consumer.numTotalTests,chromiumCases:31,uiFixtureJourneys:20,axeScans,axeIncomplete:incomplete};
}
export function run(attempt){
 assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));assert(!existsSync(attempt),'never overwrite evidence');assert(!readdirSync('apps/terminal').some(p=>/^\.env(?:\.|$)/.test(p)&&!p.endsWith('.example')),'private app dotenv is outside this scope');
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceInputs=inputs();verifyInputs(sourceCommit,sourceInputs);mkdirSync(attempt,{recursive:true});writeFileSync(attempt+'/inputs.json',JSON.stringify({sourceCommit,inputs:sourceInputs},null,2)+'\n');
 const env={...webEnvironment(),NEXT_PUBLIC_QUANTOS_ENV:'local-integrated',NEXT_PUBLIC_QUANTOS_MOCK_ENABLED:'false',NEXT_PUBLIC_QUANTOS_BFF_ORIGIN:'https://127.0.0.1:4010',NEXT_PUBLIC_QUANTOS_OIDC_ISSUER:'https://127.0.0.1:4010',GITHUB_SHA:sourceCommit,CARGO_NET_OFFLINE:'true',CARGO_TERM_COLOR:'never',CI:'1',QUANTOS_SKIP_ENV:'1',QUANTOS_G3_HOST_RECEIPT:resolve(attempt+'/host.json')},executions=[];
 for(const[id,args,exit=0]of checks){const command=args.map(s=>s.replaceAll('{attempt}',attempt)),startedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env:{...env,QUANTOS_G3_R03:id==='s2-browser'?'1':'0',QUANTOS_S2_CHAIN:id==='s2-browser'?'1':'0',PLAYWRIGHT_JSON_OUTPUT_NAME:resolve(attempt+'/'+id+'.json')},encoding:'utf8',maxBuffer:96e6,timeout:600000}),log=attempt+'/'+id+'.log';writeFileSync(log,(r.stdout??'')+(r.stderr??''));executions.push({id,command,exitCode:r.status,signal:r.signal,errorCode:r.error?.code??null,startedAt,finishedAt:new Date().toISOString(),log,logSha256:hash(read(log))});writeFileSync(attempt+'/executions.json',JSON.stringify(executions,null,2)+'\n');console.log(id,r.status);
 if(r.status!==exit){writeFileSync(attempt+'/failure.json',JSON.stringify({failed:executions.at(-1),notRun:checks.slice(executions.length).map(c=>c[0])},null,2)+'\n');throw Error('see '+log);}
 if(id==='bff-binary'){const executable=resolve('target/debug/bff-gateway');writeFileSync(attempt+'/binary.json',JSON.stringify({sourceCommit,executable,sha256:hash(read(executable))})+'\n');}
 if(id==='host-build'){const a=r.stdout.trim().split('\n').map(s=>JSON.parse(s)).find(a=>a.executable&&a.target.name==='bff_gateway');assert(a);writeFileSync(attempt+'/host.json',JSON.stringify({sourceCommit,executable:a.executable,sha256:hash(read(a.executable))})+'\n');}
}
 const receipt={schema:'quantos-core-s2-current/v1',sourceCommit,boundary:boundary(),inputs:sourceInputs,attempt,executions,webReuse:webReuse(),artifacts:files(attempt).map(path=>({path,sha256:hash(read(path))}))};const result=verify(receipt);writeFileSync(directory+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--inventory')console.log(JSON.stringify(governance()));else if(process.argv[2]==='--run')run(process.argv[3]);else{assert.equal(process.argv[2],'--verify');console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));}}catch(e){console.error(e.stack);process.exitCode=1;}}
