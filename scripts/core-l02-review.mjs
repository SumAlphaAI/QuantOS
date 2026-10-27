// L02 local host/TLS evidence; no recursive admission or target operations.
import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,statSync,mkdtempSync,copyFileSync,rmSync}from'node:fs';
import{execFileSync,spawnSync}from'node:child_process';import{resolve,join,dirname}from'node:path';import{tmpdir}from'node:os';import{pathToFileURL}from'node:url';import process from'node:process';import console from'node:console';
import{webEnvironment}from'./p0-functional-scope.mjs';import{hash,verifyInputs}from'./g1-download-review.mjs';
export const directory='docs/audit/evidence/core-l02-local-20261027',base='4e20dc2fd6fca4e3bfc20cf63a8057cb5a49408a';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));export const files=dir=>readdirSync(dir).sort().flatMap(name=>{const p=dir+'/'+name;return statSync(p).isDirectory()?files(p):[p];});
export const boundary=()=>({nodeId:'CORE:L02',engineeringGate:'PASS_OWNED_LOCAL_L02_RESTRICTED_ZONE',gate:'NOT_READY_GAPS_OPEN',stageGate:'NOT_ASSESSED',formalAccepted:false,runtimeAdmission:'DENIED',developmentStatus:'IMPLEMENTED_PENDING_ACCEPTANCE',tls:'ACTUAL_EPHEMERAL_MUTUAL_TLS_OWNED_PROCESS',signedChain:'ACTUAL_X03_MTLS_L01_X04_ONE_OWNED_CASE',vault:'DATABASE_ADAPTER_COMPILED_SYNTHETIC_SIGNER_EXECUTED',sql:'STATIC_CONTRACT_ONLY_NOT_TARGET_EXECUTION',network:'APPLICATION_ALLOWLIST_EXECUTED_SYSTEMD_TEMPLATE_NOT_INSTALLED',rotation:'CONTROLLED_CLOCK_REAL_CERTIFICATES_SYNTHETIC_KEYS',actualVaultDecryption:'NOT_RUN',targetRolesRlsMigration:'NOT_RUN',targetNetworkEnforcement:'NOT_RUN',actualRotationRecoverySla:'NOT_RUN',restrictedCancelRecoveryBusinessLoop:'NOT_RUN',crossProcessDurableDedupe:'NOT_RUN',realVenueHttpTestnet:'NOT_RUN',wholeWorkspaceIntegration:'NOT_RUN',remoteCiPerformanceSoakRelease:'NOT_RUN',productionCredentialsUsed:false,externalPublished:false,pushed:false,nextTask:'SERVICE:L03'});
export function validateBoundary(b){assert.deepEqual(b,boundary());}
export const checks=[
 ['development',['node','scripts/development-execution.mjs','--development','CORE:L02']],
 ['host-build',['cargo','build','--locked','--offline','-p','execution-gateway','--bin','execution-gateway']],
 ['host-unit',['cargo','test','--locked','--offline','-p','execution-gateway','--lib']],
 ['zone-boundary',['cargo','test','--locked','--offline','-p','quantos-execution','--test','l02_zone']],
 ['zone-legacy',['cargo','test','--locked','--offline','-p','quantos-execution','--lib','zone::tests::']],
 ['mtls-process',['cargo','test','--locked','--offline','-p','execution-gateway','--test','l02_mtls']],
 ['auth-impact',['cargo','test','--locked','--offline','-p','quantos-auth','--lib']],
 ['l01-impact',['cargo','test','--locked','--offline','-p','quantos-execution','--test','l01_protocol']],
 ['dispatch-impact',['cargo','test','--locked','--offline','-p','quantos-execution','--test','tp07_dispatch']],
 ['sql-network-static',['node','scripts/core-l02-contract.mjs']],
 ['gate-tests',['node','--test','--test-reporter=tap','scripts/core-l02-review.test.mjs','scripts/core-l02-contract.test.mjs','scripts/development-execution.test.mjs']],
 ['script-lint',['pnpm','exec','eslint','scripts/core-l02-review.mjs','scripts/core-l02-review.test.mjs','scripts/core-l02-contract.mjs','scripts/core-l02-contract.test.mjs']],
 ['rust-lint',['cargo','clippy','--locked','--offline','-p','execution-gateway','-p','quantos-execution','-p','quantos-auth','--tests','--examples','--no-deps','--','-D','warnings']],
 ['rust-format',['cargo','fmt','--check','-p','execution-gateway','-p','quantos-execution','-p','quantos-auth']],
 ['plans',['node','scripts/check-development-plans.mjs']],
 ['integration-refusal',['node','scripts/development-execution.mjs','--integration','CORE:L02'],1],
 ['next-development',['node','scripts/development-execution.mjs','--development','SERVICE:L03']],
 ['secret-scan',['node','scripts/core-l02-review.mjs','--scan','{attempt}']]
];
export function inputs(){const selectors=['AGENTS.md','Cargo.toml','Cargo.lock','rust-toolchain.toml','crates/','services/execution-gateway/','supabase/','deploy/','scripts/','package.json','pnpm-lock.yaml','.nvmrc','eslint.config.mjs','.gitleaks.toml','.gitleaksignore','env/local-mock.env.example','docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','docs/execution/development-followups.json','docs/operations/core-l02-current-function.md','docs/adr/20261027-l02-restricted-zone.md'];return execFileSync('git',['ls-files','--',...selectors],{encoding:'utf8',maxBuffer:16e6}).trim().split('\n').filter(Boolean).sort().map(path=>({path,sha256:hash(read(path))}));}
export function validateProcess(t,r,s,e){
 assert.equal(t.schema,'quantos-l02-mtls-process/v1');assert.equal(t.scope,'ACTUAL_EPHEMERAL_MTLS_OWNED_CHILD_NOT_TARGET_DEPLOYMENT');assert.equal(t.cases.length,13);assert.equal(new Set(t.cases.map(c=>c.id)).size,13);assert.equal(t.cases.filter(c=>c.outcome==='PASS').length,2);assert.equal(t.cases.filter(c=>c.outcome==='DENIED').length,11);for(const id of ['valid-mutual-tls-fill','same-command-no-reissue','expired-client-certificate','untrusted-client-ca','missing-client-certificate','server-hostname-verification','server-pin-verification','untrusted-server-root','expired-command','cross-account','wrong-session'])assert(t.cases.some(c=>c.id===id));assert.equal(t.protocolWrites,1);assert.equal(t.actualVault,false);assert.equal(t.actualTestnet,false);assert.equal(t.productionCredentialsUsed,false);assert.equal(t.childEnvironmentCleared,true);assert.equal(t.childEnvironment,'CLEARED_PLUS_TMPDIR_ONLY');assert.equal(t.privateKeysExported,false);
 assert.equal(r.schema,'quantos-l02-rotation/v1');assert.equal(r.scope,'CONTROLLED_CLOCK_REAL_CERTIFICATES_SYNTHETIC_PROCESS_LOCAL_KEYS');assert.equal(r.newVersionAtSeconds,10);assert.equal(r.oldAcceptedAtSecondsAfterRotation,299);assert.equal(r.oldDeniedAtSecondsAfterRotation,300);assert.equal(r.revokedActiveDenied,true);assert.equal(r.protocolWrites,4);assert.equal(r.realVaultRotationSla,'NOT_RUN');assert.equal(r.productionCredentialsUsed,false);
 assert.equal(s.schema,'quantos-l02-signed-process/v1');assert.equal(s.scope,'ACTUAL_X03_TO_OWNED_MTLS_ZONE_L01_X04');assert.equal(s.orderStatus,'filled');assert.equal(s.fills,1);assert.equal(s.protocolWrites,1);assert.equal(s.replayedWithoutRemoteIo,true);assert.equal(s.vaultResolver,'OWNED_SYNTHETIC_HMAC_NOT_SUPABASE');assert.equal(s.actualTestnet,false);assert.equal(s.productionCredentialsUsed,false);
 assert.equal(e.schema,'quantos-l02-session-expiry/v1');assert.equal(e.scope,'ACTUAL_MTLS_WITH_CONTROLLED_SESSION_CLOCK');assert.equal(e.atSessionExpiry,'DENIED');assert.equal(e.protocolWrites,0);assert.equal(e.productionCredentialsUsed,false);
}
export function scanConfig(baseline,current,projectConfig){
 const line='idempotency_'+'key: '+JSON.stringify('f06-isolated-probe')+'.to_owned(),';
 assert.equal(baseline.split(line).length,2);assert.equal(current.split(line).length,2);assert(baseline.includes('fn run_f06_paper_probe()'));assert(current.includes('fn run_f06_paper_probe()'));
 return projectConfig+`
[[rules]]
id = "generic-api-key"
[[rules.allowlists]]
description = "L02 reviewed unchanged F06 synthetic idempotency value; not credential material"
condition = "AND"
regexTarget = "secret"
paths = ['services/execution-gateway/src/main\\.rs$']
regexes = ['^f06-isolated-probe$']
`;
}
export function scan(attempt){
 assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));const paths=[...new Set([...execFileSync('git',['diff','--name-only',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean),...files(attempt)])].sort();
 const container=mkdtempSync(join(tmpdir(),'quantos-l02-scan-')),temp=join(container,'positive'),tool='artifacts/tools/gitleaks',report=resolve(attempt+'/secret-scan-report.json');
 try{const configPath=resolve(attempt+'/secret-scan-config.toml'),config=scanConfig(execFileSync('git',['show',base+':services/execution-gateway/src/main.rs'],{encoding:'utf8'}),read('services/execution-gateway/src/main.rs').toString(),read('.gitleaks.toml').toString());writeFileSync(configPath,config);writeFileSync(attempt+'/secret-exception.json',JSON.stringify({classification:'NON_SECRET_OWNED_IDEMPOTENCY_VALUE',ruleId:'generic-api-key',path:'services/execution-gateway/src/main.rs',base,publicValueSha256:hash('f06-isolated-probe'),baselineIdentical:true,scope:'EXACT_RULE_AND_PATH_AND_VALUE_ONLY'})+'\n');for(const path of paths){assert(!path.includes('..')&&!path.startsWith('/')&&!/(?:^|\/)\.env(?:\.|$)/.test(path));const to=join(temp,path);mkdirSync(dirname(to),{recursive:true});copyFileSync(path,to);}
 const env=webEnvironment(),version=execFileSync(tool,['version'],{env,encoding:'utf8'}).trim();assert.equal(version,'8.28.0');const out=spawnSync(tool,['dir',temp,'--config',configPath,'--redact','--no-banner','--report-format','json','--report-path',report],{env,encoding:'utf8',timeout:60000});writeFileSync(attempt+'/gitleaks.log',(out.stdout??'')+(out.stderr??''));assert.equal(out.status,0,'see redacted gitleaks report');assert.equal(out.signal,null);assert.deepEqual(json(report),[]);const negative=join(container,'negative');for(const[path,value]of [['services/execution-gateway/src/main.rs','zQ8m4T7n2L6x9P3v5R1c8A0s4D7f2G9h6K3j5B'],['other/probe.rs','f06-isolated-probe']]){const target=join(negative,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,'idempotency_key: '+JSON.stringify(value)+',\n');}const negativeReport=resolve(attempt+'/secret-negative-report.json'),refusal=spawnSync(tool,['dir',negative,'--config',configPath,'--redact','--no-banner','--report-format','json','--report-path',negativeReport],{env,encoding:'utf8',timeout:60000});writeFileSync(attempt+'/gitleaks-negative.log',(refusal.stdout??'')+(refusal.stderr??''));assert.equal(refusal.status,1);assert.equal(json(negativeReport).length,2);return{reviewedNonSecretExceptions:1,actualNegativeRefusals:2,scope:'TASK_DIFF_AND_CURRENT_ATTEMPT_ONLY',files:paths.length,tool:'gitleaks',version,binarySha256:hash(read(tool)),findings:0,wholeRepositoryAudit:'NOT_RUN',ephemeralPrivateKeysIncluded:false};
 }finally{rmSync(container,{recursive:true,force:true});}
}
export function verify(r){
 assert.equal(r.schema,'quantos-core-l02-current/v1');validateBoundary(r.boundary);assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(r.attempt));verifyInputs(r.sourceCommit,r.inputs);assert.deepEqual(inputs(),r.inputs);assert.equal(r.executions.length,checks.length);
 for(const[i,e]of r.executions.entries()){const[id,args,exit=0]=checks[i];assert.equal(e.id,id);assert.deepEqual(e.command,args.map(s=>s.replaceAll('{attempt}',r.attempt)));assert.equal(e.exitCode,exit,id);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(e.log,r.attempt+'/'+id+'.log');assert.equal(hash(read(e.log)),e.logSha256);assert(Date.parse(e.finishedAt)>=Date.parse(e.startedAt));}
 assert.deepEqual(r.artifacts.map(f=>f.path),files(r.attempt));for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256,f.path);
 const binary=json(r.attempt+'/binary.json');assert.equal(binary.sourceCommit,r.sourceCommit);assert.equal(binary.executable,resolve('target/debug/execution-gateway'));assert.equal(hash(read(binary.executable)),binary.sha256);
 validateProcess(...['tls','rotation','signed','session'].map(name=>json(r.attempt+'/'+name+'.json')));
 let rustCases=0;for(const[id,count]of [['host-unit',12],['zone-boundary',3],['zone-legacy',6],['mtls-process',4],['auth-impact',6],['l01-impact',15],['dispatch-impact',8]]){const rows=[...read(r.attempt+'/'+id+'.log').toString().matchAll(/test result: ok\. (\d+) passed; 0 failed; (\d+) ignored/g)];assert.equal(rows.length,1,id);assert.equal(Number(rows[0][1]),count,id);assert.equal(rows[0][2],'0');rustCases+=count;}
 const node=read(r.attempt+'/gate-tests.log').toString();assert.match(node,/# fail 0/);assert.match(node,/# skipped 0/);const nodeCases=Number(node.match(/# pass (\d+)/)[1]);assert(nodeCases>=70);
 const sql=json(r.attempt+'/sql-network-static.log');assert.equal(sql.targetDatabase,'NOT_RUN');assert.equal(sql.positiveDecryption,'NOT_RUN');assert.equal(sql.packetLevelEgress,'NOT_RUN');
 assert.equal(json(r.attempt+'/integration-refusal.log').reason,'STAGE_NOT_READY');assert.equal(json(r.attempt+'/next-development.log').allowed,true);
 const scan=json(r.attempt+'/secret-scan.log');assert.equal(scan.findings,0);assert.equal(scan.reviewedNonSecretExceptions,1);assert.equal(scan.actualNegativeRefusals,2);assert.equal(json(r.attempt+'/secret-negative-report.json').length,2);assert.equal(json(r.attempt+'/secret-exception.json').baselineIdentical,true);assert.equal(scan.wholeRepositoryAudit,'NOT_RUN');assert.equal(scan.ephemeralPrivateKeysIncluded,false);assert.equal(scan.binarySha256,hash(read('artifacts/tools/gitleaks')));assert.deepEqual(json(r.attempt+'/secret-scan-report.json'),[]);
 return{sourceCommit:r.sourceCommit,...r.boundary,checks:checks.length,rustCases,nodeCases,tlsScenarioRows:13};
}
export function run(attempt){
 assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));assert(!existsSync(attempt),'never overwrite an attempt');const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceInputs=inputs();verifyInputs(sourceCommit,sourceInputs);mkdirSync(attempt,{recursive:true});writeFileSync(attempt+'/inputs.json',JSON.stringify({sourceCommit,inputs:sourceInputs},null,2)+'\n');
 const env={...webEnvironment(),CARGO_NET_OFFLINE:'true',CARGO_TERM_COLOR:'never',QUANTOS_L02_FIXTURE_EXECUTABLE:resolve('target/debug/execution-gateway'),QUANTOS_L02_TLS_EVIDENCE:resolve(attempt+'/tls.json'),QUANTOS_L02_ROTATION_EVIDENCE:resolve(attempt+'/rotation.json'),QUANTOS_L02_SIGNED_EVIDENCE:resolve(attempt+'/signed.json'),QUANTOS_L02_SESSION_EVIDENCE:resolve(attempt+'/session.json')},executions=[];
 for(const[id,args,exit=0]of checks){const command=args.map(s=>s.replaceAll('{attempt}',attempt)),startedAt=new Date().toISOString(),out=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',maxBuffer:32e6,timeout:300000}),log=attempt+'/'+id+'.log';writeFileSync(log,(out.stdout??'')+(out.stderr??''));executions.push({id,command,exitCode:out.status,signal:out.signal,errorCode:out.error?.code??null,startedAt,finishedAt:new Date().toISOString(),log,logSha256:hash(read(log))});writeFileSync(attempt+'/executions.json',JSON.stringify(executions,null,2)+'\n');console.log(id,out.status);
 if(out.status!==exit){writeFileSync(attempt+'/failure.json',JSON.stringify({sourceCommit,failed:executions.at(-1),notRun:checks.slice(executions.length).map(c=>c[0])},null,2)+'\n');throw Error('see '+log);}
 if(id==='host-build'){const executable=env.QUANTOS_L02_FIXTURE_EXECUTABLE;writeFileSync(attempt+'/binary.json',JSON.stringify({sourceCommit,executable,sha256:hash(read(executable)),fixtureMode:'--l02-owned-zone-fixture'},null,2)+'\n');}
 }
 const r={schema:'quantos-core-l02-current/v1',sourceCommit,boundary:boundary(),inputs:sourceInputs,attempt,executions,artifacts:files(attempt).map(path=>({path,sha256:hash(read(path))}))},result=verify(r);writeFileSync(directory+'/receipt.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--run')run(process.argv[3]);else if(process.argv[2]==='--scan')console.log(JSON.stringify(scan(process.argv[3])));else{assert.equal(process.argv[2],'--verify');console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));}}catch(e){console.error(e.stack);process.exitCode=1;}}
