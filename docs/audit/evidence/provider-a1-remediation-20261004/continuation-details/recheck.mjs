import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {policy,root,directory,digest,developmentEnvironment,staticEnvironment,captureInputs,nodesFromPlans,closure,assertInputSnapshot} from '../../scripts/provider-a1-receipts.mjs';
const baseline='4eee7f755c03654be83dfbf4f53994951a04f4ae';
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==baseline)throw Error('source commit differs from original complete execution');
const p=policy();const nodes=nodesFromPlans();const before=captureInputs(nodes,closure(nodes));
const original=JSON.parse(fs.readFileSync(path.join(root,directory,'execution-results.json')));
for(const r of original){if(digest(fs.readFileSync(path.join(root,r.log)))!==r.logSha256)throw Error('original log content changed '+r.id);}
const selected=original.filter(r=>r.status!=='PASS').map(r=>r.id);
const output=path.join(root,'artifacts/provider-a1-resume');const records=[];
for(const id of selected){const spec=p.checks[id];const env=developmentEnvironment(fs.readFileSync(path.join(root,p.developmentProfile.file),'utf8'),p.developmentProfile.overrides);
 if(spec.database){process.loadEnvFile('.env.local');Object.assign(env,Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('NEXT_PUBLIC_'))));env.QUANTOS_RUN_F05_POSTGRES_TESTS='1';if(!new URL(env.DATABASE_URL).hostname.endsWith('.supabase.com'))throw Error('unexpected DB target');}
 if(spec.staticOnly){const s=staticEnvironment(env);for(const k of Object.keys(env))delete env[k];Object.assign(env,s);}
 Object.assign(env,spec.env??{});
 if(spec.measurement){env.QUANTOS_F05_MEASUREMENTS_PATH=path.join(output,'f05-volume.json');fs.rmSync(env.QUANTOS_F05_MEASUREMENTS_PATH,{force:true});}
 const command=spec.command.map(v=>v==='node'?process.execPath:v);const executedAt=new Date().toISOString();console.log('START',id,executedAt);
 const run=spawnSync(command[0],command.slice(1),{cwd:root,env,encoding:'utf8',timeout:spec.timeoutMs??900000,maxBuffer:32*1024*1024});let log=(run.stdout??'')+(run.stderr??'');
 for(const [k,v]of Object.entries(env))if(v&&v.length>=6&&/PASSWORD|TOKEN|KEY|DATABASE_URL|TEST_EMAIL/i.test(k))log=log.split(v).join('[REDACTED]');
 fs.writeFileSync(path.join(output,id+'.log'),log);const result={id,command:spec.command,exitCode:run.status,status:run.status===0?'PASS':'FAIL',executedAt,observedSourceCommit:baseline,log:'artifacts/provider-a1-resume/'+id+'.log',logSha256:digest(log),error:run.error?.code??null,signal:run.signal};if(spec.database)result.target='configured-supabase';if(spec.env)result.environmentOverrides=spec.env;
 if(spec.transientDatabase)result.attempts=[{attempt:1,exitCode:run.status,transient:false}];
 records.push(result);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(records,null,2)+'\n');console.log('END',id,run.status);
}
assertInputSnapshot(before,captureInputs(nodes,closure(nodes)));
if(records.some(r=>r.status!=='PASS'))process.exitCode=1;
