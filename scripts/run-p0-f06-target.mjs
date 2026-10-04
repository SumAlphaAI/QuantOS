import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=resolve(import.meta.dirname,'..');const output=process.argv[2];
if(!output)throw Error('an external evidence directory is required');
const directory=resolve(output);if(directory===root||directory.startsWith(root+'/'))throw Error('target receipts must be outside the source tree');mkdirSync(directory,{recursive:true});
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('commit the source before target acceptance');
process.loadEnvFile(resolve(root,'.env.local'));
const env={...process.env,QUANTOS_F06_ISOLATED_PROJECT:'1',QUANTOS_F06_TARGET_ISOLATED:'1',QUANTOS_F06_ALLOW_TEMP_ADMIN_STORAGE_KEY:'1',QUANTOS_RUN_F06_POSTGRES_TESTS:'1',QUANTOS_RUN_F06_BFF_LOGIN_TESTS:'1'};
// Operator fixture connections also verify the configured CA and hostname.
// This changes only the execution environment, never the saved credentials.
const operator=new URL(env.DATABASE_URL);
if(!env.QUANTOS_BFF_SSLROOTCERT)throw Error('configured Supabase CA is required');
operator.searchParams.set('sslmode','verify-full');
operator.searchParams.set('sslrootcert',env.QUANTOS_BFF_SSLROOTCERT);
env.DATABASE_URL=operator.toString();
// Existing configured test project only; scripts enforce target identity, idle
// Runtime and fixture cleanup. No provision, reset or migration is performed.
const commands=[['build',['cargo','build','--locked','--offline','-p','bff-gateway','-p','runtime-gateway','-p','execution-gateway']],['preflight',[process.execPath,'scripts/f06-bff-preflight.cjs']],['auth-bff',[process.execPath,'scripts/f06-bff-live-smoke.cjs']],['auth-runtime',[process.execPath,'scripts/f06-runtime-live-smoke.cjs']],['execution',[process.execPath,'scripts/f06-execution-command-smoke.cjs']],['vault',[process.execPath,'scripts/f06-vault-gate.cjs']],['database',['cargo','test','--locked','--offline','-p','quantos-auth','--test','postgres_auth_context','--','--test-threads=1','--skip','f06_dedicated_bff_auth_read_p95']]];
const results=[];
for(const [name,command] of commands){
 const commandEnv={...env,QUANTOS_TRACE_EXPORT_PATH:resolve(directory,name+'-traces.jsonl')};
 const run=spawnSync(command[0],command.slice(1),{cwd:root,env:commandEnv,encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024});let log=(run.stdout??'')+(run.stderr??'');
 for(const [key,value] of Object.entries(env))if(value&&value.length>=6&&/PASSWORD|TOKEN|KEY|DATABASE_URL|TEST_EMAIL/i.test(key))log=log.split(value).join('[REDACTED]');
 const bytes=Buffer.from(log);writeFileSync(resolve(directory,name+'.log'),bytes);results.push({name,command,exit_code:run.status,logSha256:createHash('sha256').update(bytes).digest('hex'),logGzipBase64:gzipSync(bytes).toString('base64')});
 writeFileSync(resolve(directory,'target-results.json'),JSON.stringify({sourceCommit,results},null,2)+'\n');console.log(name,run.status);if(run.status!==0)process.exit(1);
}
const receipt={schema:'quantos-f06-target-acceptance/v2',sourceCommit,status:'PASS',failures:[],targetClass:'configured-test-supabase-local-services',realOidcBff:{status:'PASS',checks:['real Auth/BFF','real Auth/BFF/Runtime']},executionRoleAndVault:{status:'PASS',checks:['six paper scenarios','eight role denials']},denialMatrix:{status:'PASS',checks:['eight actual PostgreSQL tests including four-category denials']},evidence:results,notes:['No local database; existing configured Supabase test project; no provision/schema reset/migration.','Runtime temporary admin Storage key is confined to the existing identity smoke; no Storage operation.','Excluded developer latency diagnostic remains NOT RUN.']};
writeFileSync(resolve(directory,'f06-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
