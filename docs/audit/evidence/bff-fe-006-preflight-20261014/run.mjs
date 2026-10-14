import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {base,inspect} from './scope.mjs';
import {staticEnvironment,digest,executionOutcome,inventory,policy} from '../../../../scripts/provider-a1-receipts.mjs';
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','freeze harness before execution');
const out=base+'/'+(process.argv[2]??'attempt-01');assert(/^attempt-[0-9]{2}$/.test(out.split('/').at(-1))&&!existsSync(out),'fresh attempt required');mkdirSync(out,{recursive:true});
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),initial=inspect();writeFileSync(out+'/inventory.json',JSON.stringify(initial,null,2)+'\n');
const selectors=[...policy().commonInputs,...['scope.mjs','preflight.test.mjs','route-probe.mjs','run.mjs','fixtures.json','proposed-scope.md'].map(p=>base+'/'+p), 'bff/', 'tests/contract/', 'packages/', 'apps/terminal/tests/x06-scenarios.test.ts', 'crates/', 'services/', 'proto/', 'third_party/nautilus-agents/', 'docs/adr/20260731-tp07-nautilus-license-compliance.md', 'docs/operations/tp07_nautilus_execution_gateway.md'];
const inputs=inventory(selectors).filter(i=>!i.path.includes('/attempt-'));writeFileSync(out+'/inputs.json',JSON.stringify({sourceCommit:source,inputs},null,2)+'\n');
const env=staticEnvironment(process.env);for(const k of Object.keys(env))if(k.startsWith('QUANTOS_'))delete env[k];Object.assign(env,{PATH:'/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+env.PATH,QUANTOS_SKIP_ENV:'1',QUANTOS_RELEASE_PERFORMANCE:'0',CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true'});
const rows=[];
for(const[id,command,expected]of[
 ['current-six-gates',['node','docs/audit/evidence/provider-a3-readmission-20261014/verify-evidence.mjs'],0],
 ['local-admission-refusal',['node',base+'/scope.mjs','--admission'],2],
 ['openapi',['node','scripts/check-bff-openapi.mjs'],0],
 ['generated',['node','scripts/check-bff-generated.mjs'],0],
 ['catalog',['node','scripts/check-bff-contract-coverage.mjs'],0],
 ['fixtures-negatives',['node','--test',base+'/preflight.test.mjs'],0],
 ['domain-fixtures',['cargo','test','--locked','--offline','-p','quantos-portfolio','-p','quantos-risk','-p','quantos-execution','-p','quantos-reconcile','--lib','--','--skip','issuance_stays_under_two_hundred_millis_p95_and_is_short_lived'],0],
 ['execution-service',['cargo','test','--locked','--offline','-p','execution-gateway'],0],
 ['bff-build',['cargo','build','--locked','--offline','-p','bff-gateway'],0],
 ['actual-routes',['node',base+'/route-probe.mjs',out+'/http','--require-implemented'],2],
 ['api-client',['pnpm','--filter','@sumalpha/api-client','test'],0],
 ['execution-ui-fixtures',['pnpm','exec','vitest','run','packages/domain-ui/tests/domain-ui.test.ts','apps/terminal/tests/x06-scenarios.test.ts'],0],
 ['plans',['pnpm','check:development-plans'],0],
 ['plans-negative',['pnpm','test:development-plans'],0],
 ['handoff',['make','development-handoff-check'],0],
 ['frontend-handoff',['node','scripts/check-frontend-gate-handoff.mjs'],0],
]){const executedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024}),bytes=(r.stdout??'')+(r.stderr??''),log=out+'/'+id+'.log';writeFileSync(log,bytes);const outcome=executionOutcome(r,900000);rows.push({id,command,executedAt,...outcome,expectedExitCode:expected,status:r.status===expected&&!r.error&&!r.signal?'PASS':'FAIL',...(expected?{boundary:expected===2?'EXPECTED_LOCAL_GAP_NOT_ADMISSION':'EXPECTED_REFUSAL'}:{}),log,logSha256:digest(bytes)});writeFileSync(out+'/results.json',JSON.stringify(rows,null,2)+'\n');console.log(id,rows.at(-1).status,r.status);}
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source);assert.deepEqual(inventory(selectors).filter(i=>!i.path.includes('/attempt-')),inputs,'input drift during preflight');assert.deepEqual(inspect().stageCounts,initial.stageCounts);
const routes=JSON.parse(readFileSync(out+'/http/receipt.json'));assert.equal(routes.observedOperations,17);assert.equal(routes.missingHandlers,17);assert.equal(routes.processTerminated,true);assert.equal(routes.status,'LOCAL_PROVIDER_GAPS');
const receipt={schema:'quantos-bff006-preflight-results/v1',status:rows.every(r=>r.status==='PASS')?'PASS_WITH_LOCAL_GAPS':'FAIL',sourceCommit:source,checks:rows.length,localAdmission:'PROPOSED_NOT_REGISTERED',bff006Gate:'NOT_ASSESSED',a4Gate:'NOT_ASSESSED',closureNodes:64,a4ClosureNodes:66,missingPolicyNodes:22,missingProviderHandlers:17,plannedOperations:3,formalAccepted:false,target:{supabase:'NOT_RUN',external:'NOT_RUN',performance:'NOT_RUN'},stageCounts:initial.stageCounts};writeFileSync(out+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));if(rows.some(r=>r.status==='FAIL'))process.exitCode=1;
