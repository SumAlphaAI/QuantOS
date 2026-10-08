const fs=require('node:fs');const {spawnSync}=require('node:child_process');
const root='/Users/anray/Documents/project/SumAlpha/QuantOS';process.chdir(root);process.loadEnvFile('.env.local');
const u=new URL(process.env.DATABASE_URL);u.searchParams.set('sslmode','verify-full');u.searchParams.set('sslrootcert',process.env.QUANTOS_BFF_SSLROOTCERT);
const env={...process.env,DATABASE_URL:u.toString(),QUANTOS_F07_DB_REQUIRED:'1',QUANTOS_F07_FIXTURE_RETIRE:'1'};
const output='docs/audit/evidence/provider-a1-remediation-20261004/r02-admission-20261008/fix-preflight-audit';fs.mkdirSync(output,{recursive:true});
const r=spawnSync('cargo',['test','--locked','-p','quantos-runtime','--test','postgres_runtime','postgres_runtime_records_cancel_and_timeout_audits','--','--exact','--nocapture'],{env,encoding:'utf8',timeout:600000,maxBuffer:8*1024*1024});fs.writeFileSync(output+'/actual-pg.log',(r.stdout??'')+(r.stderr??''));console.log('actual PG cancel audit',r.status);
const cleanup=spawnSync(process.execPath,['scripts/f07-fixture-check.cjs','--retire'],{env,encoding:'utf8',timeout:60000});fs.writeFileSync(output+'/retirement.log',(cleanup.stdout??'')+(cleanup.stderr??''));
fs.writeFileSync(output+'/results.json',JSON.stringify({schema:'quantos-r02-audit-order-fix-preflight/v1',status:r.status===0&&cleanup.status===0?'PASS':'FAIL',actualConfiguredSupabase:true,dirtySource:true,admission:false,testExitCode:r.status,retirementExitCode:cleanup.status,recordedAt:new Date().toISOString()},null,2)+'\n');if(r.status!==0||cleanup.status!==0)process.exitCode=1;
