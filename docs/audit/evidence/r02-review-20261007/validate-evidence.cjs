// Read-only artifact checks; configured environment values are compared, never printed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const dir='docs/audit/evidence/r02-review-20261007',report='docs/audit/R02-comprehensive-review-2026-10-07.md',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const index=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),index.sourceCommit);
assert.equal(sha(fs.readFileSync(report)),index.report.sha256);
for(const file of index.sourceFiles)assert.equal(sha(fs.readFileSync(file.path)),file.sha256,'Source checksum differs: '+file.path);
for(const file of index.evidenceFiles)if(file.path!=='validation.json')assert.equal(sha(fs.readFileSync(path.join(dir,file.path))),file.sha256,'Evidence checksum differs: '+file.path);
const content=fs.readFileSync(report,'utf8'),readme=fs.readFileSync(path.join(dir,'README.md'),'utf8');let linkCount=0;
for(const [filename,text] of [[report,content],[path.join(dir,'README.md'),readme]])for(const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
 const href=match[1];if(/^[a-z]+:\/\//.test(href))continue;const [rel,anchor]=href.split('#');const target=path.resolve(path.dirname(filename),rel);assert(fs.existsSync(target),'Missing link: '+target);
 if(anchor)assert(fs.readFileSync(target,'utf8').includes('id="'+anchor+'"'),'Missing explicit anchor: '+anchor);linkCount++;
}
const control=JSON.parse(fs.readFileSync(path.join(dir,'controls.json'),'utf8')),findings=JSON.parse(fs.readFileSync(path.join(dir,'findings.json'),'utf8'));
assert.equal(control.controls.length,28);assert.equal(findings.findings.length,13);assert(findings.findings.every(f=>f.status==='OPEN'));
for(const f of findings.findings)for(const p of f.evidence)assert(fs.existsSync(path.join(dir,p)));
const cleanup=JSON.parse(fs.readFileSync(path.join(dir,'native-cleanup-final.json'),'utf8'));
assert.equal(cleanup.tenants.length,4);assert.equal(cleanup.actorsAfter.length,3);assert(cleanup.actorsAfter.every(a=>!a.is_active));assert.equal(cleanup.objects.length,2);assert(cleanup.objects.every(o=>o.errorCode==='404'&&o.errorMessage==='Object not found'));
for(const tmp of ['crates/quantos-storage/tests/r02_audit_target.rs','crates/quantos-storage/tests/r02_audit_probes.rs'])assert(!fs.existsSync(tmp));
const processes=JSON.parse(fs.readFileSync(path.join(dir,'process-readback.json'),'utf8'));assert.equal(processes.processReadback,'PASS');assert.equal(processes.ownedAuditProcesses,0);
const secrets=[];
for(const [key,value] of Object.entries(process.env))if(/(KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL)$/.test(key)&&value.length>=12){secrets.push({key,value});secrets.push({key:key+':uri',value:encodeURIComponent(value)});if(key==='DATABASE_URL'){const password=decodeURIComponent(new URL(value).password);if(password.length>=8){secrets.push({key:'database-password',value:password});secrets.push({key:'database-password:uri',value:encodeURIComponent(password)});}}}
assert(secrets.some(s=>s.key==='DATABASE_URL'),'Configured environment was not loaded for credential-value scan');
const scanFiles=[report,...fs.readdirSync(dir).map(n=>path.join(dir,n))];
for(const filename of scanFiles){const text=fs.readFileSync(filename,'utf8');for(const secret of secrets)assert(!text.includes(secret.value),'Configured secret found in '+filename+' ('+secret.key+')');}
assert.equal(cp.execFileSync('git',['diff','--check'],{encoding:'utf8'}),'');
const result={schema:'quantos-r02-evidence-validation/v1',result:'PASS',sourceCommit:index.sourceCommit,sourceFilesUnchanged:index.sourceFiles.length,controlCounts:control.totals,findings:findings.findings.length,severity:findings.severityCounts,relativeLinksChecked:linkCount,evidenceChecksums:'PASS',configuredSecretValueScan:'PASS',secretScanScope:'report and complete new evidence directory; raw and URI-encoded configured secret values/password',temporaryRustConnections:'REMOVED',ownedAuditProcesses:0,actorsInactive:3,ownedObjectsAbsent:2,sqlFixturesRolledBack:true,sourceOrPlanMutation:false,commitCreated:false};
fs.writeFileSync(path.join(dir,'validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
