// Offline validation; environment values are checked without printing them.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const dir='docs/audit/evidence/r02-remediation-20261007',hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p));
const index=read(dir+'/index.json'),sources=read(dir+'/source-files.json');
for(const f of sources.files)assert.equal(hash(fs.readFileSync(f.path)),f.sha256,'Source changed: '+f.path);
for(const f of index.files)assert.equal(hash(fs.readFileSync(dir+'/'+f.path)),f.sha256,'Evidence changed: '+f.path);
for(const f of index.historicalFiles)assert.equal(hash(fs.readFileSync(f.path)),f.sha256,'Historical evidence changed: '+f.path);
const baselineDir='docs/audit/evidence/r02-review-20261007',baseline=read(baselineDir+'/index.json');
assert.equal(hash(fs.readFileSync(baseline.report.path)),baseline.report.sha256);
for(const f of baseline.sourceFiles)assert.equal(hash(cp.execFileSync('git',['show',baseline.sourceCommit+':'+f.path],{maxBuffer:16*1024*1024})),f.sha256,'Baseline tree changed: '+f.path);
for(const f of baseline.evidenceFiles)if(f.path!=='validation.json')assert.equal(hash(fs.readFileSync(baselineDir+'/'+f.path)),f.sha256,'Baseline evidence changed: '+f.path);
const final=read(dir+'/target-attempt08/receipt.json'),coverage=read(dir+'/target-attempt06/coverage-summary.json'),covReceipt=read(dir+'/target-attempt06/receipt.json');
assert.equal(final.result,'PASS_SCOPED_TARGET');assert.equal(final.formalAcceptance,'NOT_ACCEPTED');assert.equal(final.releasePerformance,'BASELINE_ONLY');
for(const f of final.sourceFiles)assert.equal(hash(fs.readFileSync(f.path)),f.sha256,'Final target source changed: '+f.path);
assert.equal(coverage.result,'PASS');assert(coverage.testSourcesExcluded);assert.equal(coverage.files.length,5);
for(const f of coverage.files){assert(f.lines.covered/f.lines.count>=.9);assert(f.regions.covered/f.regions.count>=.85);assert.equal(covReceipt.sourceFiles.find(s=>s.path===f.file).sha256,hash(fs.readFileSync(f.file)));}
const results=[];for(const folder of fs.readdirSync(dir).filter(n=>/^target-attempt\d+$/.test(n))){const r=read(`${dir}/${folder}/receipt.json`);assert.equal(r.cleanup.result,'PASS');assert(r.cleanup.actors.every(a=>!a.is_active));assert(r.cleanup.objects.every(o=>o.absent));assert.equal(r.cleanup.temporaryFaultTriggers.length,0);results.push({attempt:folder,result:r.result,cleanup:r.cleanup.result});}
for(const n of ['01','02','03','05'])assert.equal(results.find(r=>r.attempt==='target-attempt'+n).result,'FAIL');
const state=read(dir+'/target-state.json');assert.equal(state.result,'PASS');assert.equal(state.migrations.length,7);assert(state.migrations.every(m=>m.matches));assert(state.writerMembership.effectiveSet&&!state.writerMembership.inheritEnabled);assert(state.cleanup.every(c=>c.active===0));
const closure=read(dir+'/closure.json');assert.equal(closure.findings.length,13);assert(closure.findings.every(f=>f.status==='CLOSED_ENGINEERING'));assert.equal(closure.controls.filter(c=>c.status==='PASS').length,23);assert.equal(closure.controls.filter(c=>c.status==='PARTIAL').length,5);
let links=0;for(const f of [dir+'/README.md',...sources.files.map(f=>f.path).filter(p=>p.endsWith('.md'))])for(const m of fs.readFileSync(f,'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){const raw=m[1].replace(/^<|>$/g,'');if(/^[a-z]+:\/\//.test(raw))continue;const rel=raw.split('#')[0].replace(/:\d+$/,'');if(!rel)continue;assert(fs.existsSync(path.resolve(path.dirname(f),rel)),'Missing link: '+f+' '+rel);links++;}
const secrets=[];for(const [k,v]of Object.entries(process.env))if(/(KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL)$/.test(k)&&v.length>=10){secrets.push(v,encodeURIComponent(v));if(k==='DATABASE_URL'){const p=decodeURIComponent(new URL(v).password);if(p.length>=8)secrets.push(p,encodeURIComponent(p));}}
assert(process.env.DATABASE_URL,'Load configured environment for secret-value scan');
const scan=[...sources.files.map(f=>f.path),...index.files.map(f=>dir+'/'+f.path),...index.historicalFiles.map(f=>f.path)];for(const f of scan){const text=fs.readFileSync(f,'utf8');for(const s of secrets)assert(!text.includes(s),'Configured secret found in '+f);assert(!/postgres(?:ql)?:\/\/[^\s/:]+:[^\s@]+@/.test(text),'Credential URL found in '+f);}
const processes=read(dir+'/process-readback.json');assert.equal(processes.ownedR02Processes,0);assert.equal(processes.result,'PASS');assert.equal(cp.execFileSync('git',['diff','--check'],{encoding:'utf8'}),'');
const result={schema:'quantos-r02-remediation-validation/v1',result:'PASS',sourceFiles:sources.files.length,evidenceFiles:index.files.length,originalAudit:'UNCHANGED_GIT_TREE_AND_EVIDENCE',engineeringClosed:13,controls:{PASS:23,PARTIAL:5,FAIL:0},targets:results,configuredSecretValueAndUriScan:'PASS',relativeLinks:links,ownedR02Processes:0,formalAcceptance:'NOT_ACCEPTED',hostedSameShaCI:'NOT_RUN'};
fs.writeFileSync(dir+'/validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
