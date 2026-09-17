import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync,execFileSync} from 'node:child_process';
const root=process.cwd(),source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'f02-artifact-copy-'));
const key='F02-PUBLIC-LOCAL-TEST-KEY-NOT-A-PRODUCTION-SECRET';
const receipt={status:'RUNNING',source,dirty:false,signatureScope:'LOCAL_TEST_KEY',downloadedRemote:false,checks:[]};
function run(cmd,args,cwd=root,extra={}){return spawnSync(cmd,args,{cwd,env:{...process.env,QUANTOS_SIGNING_KEY:key,QUANTOS_REQUIRE_FORMAL_SIGNATURE:'1',...extra},encoding:'utf8'});}
function pass(p){if(p.status!==0)throw Error(p.stdout+p.stderr);}
function reject(p,pattern){if(p.status===0||!pattern.test(p.stdout+p.stderr))throw Error('Expected causal rejection: '+p.stdout+p.stderr);}
try{
 pass(run('bash',['scripts/sign-artifacts.sh','artifacts/release/manifest.json']));pass(run('bash',['scripts/verify-artifact-signatures.sh','artifacts/release/manifest.json']));pass(run('node',['scripts/verify-release.mjs','artifacts/release',source]));receipt.checks.push('local test-key signature and full payload verification');
 fs.mkdirSync(path.join(scratch,'scripts'));for(const name of ['verify-artifact-signatures.sh','verify-release.mjs','f01-lib.mjs'])fs.copyFileSync(path.join(root,'scripts',name),path.join(scratch,'scripts',name));
 for(const dir of ['release','signatures'])fs.cpSync(path.join(root,'artifacts',dir),path.join(scratch,'artifacts',dir),{recursive:true});
 const verify=()=>run('node',['scripts/verify-release.mjs','artifacts/release',source],scratch),signed=()=>run('bash',['scripts/verify-artifact-signatures.sh','artifacts/release/manifest.json'],scratch);
 pass(signed());pass(verify());receipt.checks.push('independent local copy verifies');
 const manifest=JSON.parse(fs.readFileSync(path.join(scratch,'artifacts/release/manifest.json'))),item=manifest.files.find(x=>x.path.startsWith('web/')&&x.path.endsWith('.html'));
 const file=path.join(scratch,'artifacts/release',item.path),bytes=fs.readFileSync(file);fs.appendFileSync(file,'tamper');reject(verify(),/RELEASE_DIGEST/);fs.writeFileSync(file,bytes);pass(verify());receipt.checks.push('payload tampering rejected and recovery passes');
 const mf=path.join(scratch,'artifacts/release/manifest.json'),original=fs.readFileSync(mf);fs.appendFileSync(mf,' ');reject(signed(),/Formal signature verification failed/);fs.writeFileSync(mf,original);pass(signed());receipt.checks.push('manifest tampering rejected and recovery passes');
 reject(run('bash',['scripts/verify-artifact-signatures.sh','artifacts/release/manifest.json'],scratch,{QUANTOS_SIGNING_KEY:'wrong-local-test-key'}),/Formal signature verification failed/);receipt.checks.push('wrong signing key rejected');
 receipt.files=manifest.files.length;receipt.bytes=manifest.files.reduce((n,f)=>n+f.sizeBytes,0);receipt.status='PASS';
} catch(e){receipt.status='FAIL';receipt.error=e.message;process.exitCode=1;}
finally{receipt.completedAt=new Date().toISOString();fs.writeFileSync('artifacts/f02/local-artifact-verification.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));fs.rmSync(scratch,{recursive:true,force:true});}
