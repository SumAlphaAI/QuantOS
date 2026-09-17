import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {adjudicate,readWaivers} from './sca-policy.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const output=path.join(root,'artifacts/f02');fs.mkdirSync(output,{recursive:true});
const selected=process.argv[2]?[process.argv[2]]:['npm','pypi','cargo'];
let waivers;
const receipt={status:'RUNNING',passed:false,scope:'all runtime, dev, build and security dependencies',source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),lockDigests:Object.fromEntries(['Cargo.lock','pnpm-lock.yaml','engines/uv.lock'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')])),startedAt:new Date().toISOString(),scanners:{}};
const resultFile=path.join(output,`sca-${selected.join('-')}.json`);
function save(){fs.writeFileSync(resultFile,JSON.stringify(receipt,null,2)+'\n');}
function run(binary,args){return spawnSync(binary,args,{cwd:root,encoding:'utf8',env:process.env,maxBuffer:64*1024*1024,timeout:600000});}
save();
try{
 waivers=readWaivers(root);
 for(const ecosystem of selected){
  let raw,findings=[];
  if(ecosystem==='npm'){
   const p=run('pnpm',['audit','--json']);raw=p.stdout;
   const data=JSON.parse(raw);if(data.error||!data.metadata?.vulnerabilities||!data.advisories||![0,1].includes(p.status))throw Error(`npm audit unavailable: ${data.error?.message??p.stderr}`);
   for(const a of Object.values(data.advisories))if(['high','critical'].includes(a.severity))for(const f of a.findings) findings.push({ecosystem,id:a.github_advisory_id??String(a.id),package:a.module_name,version:f.version,severity:a.severity});
  }else if(ecosystem==='pypi'){
   const exported=run('uv',['export','--locked','--project','engines','--all-packages','--all-groups','--no-emit-workspace','--no-hashes','--format','requirements-txt']);
   if(exported.status!==0)throw Error(exported.stderr);
   const file=path.join(output,'python-requirements.txt');fs.writeFileSync(file,exported.stdout);
   const p=run('uv',['run','--locked','--project','engines','--all-packages','--all-groups','pip-audit','--no-deps','--disable-pip','--requirement',file,'--format','json']);raw=p.stdout;
   const data=JSON.parse(raw);if(!Array.isArray(data.dependencies)||![0,1].includes(p.status))throw Error(`Python audit unavailable: ${p.stderr}`);
   for(const d of data.dependencies){if(d.skip_reason)throw Error(`Unaudited Python dependency: ${d.name}`);for(const v of d.vulns??[])findings.push({ecosystem,id:v.id,aliases:v.aliases??[],package:d.name,version:d.version,severity:'vulnerability'});}
  }else if(ecosystem==='cargo'){
   if(!/^cargo-deny 0\.20\.2\b/.test(run('cargo',['deny','--version']).stdout))throw Error('cargo-deny 0.20.2 required');
   const p=run('cargo',['deny','--locked','--format','json','check','advisories']);raw=p.stderr+'\n'+p.stdout;
   const messages=raw.split('\n').filter(x=>x.trim()).map(line=>JSON.parse(line));
   for(const message of messages){
    const d=message.fields??message;
    if(d.severity==='error'||message.level==='ERROR'){
     const a=d.advisory, packages=d.graphs?.map(g=>g.Krate)??[];
     if(!a?.id||!packages.length||packages.some(p=>!p?.name||!p?.version))throw Error(`Non-waivable cargo scanner failure: ${JSON.stringify(message)}`);
     for(const pkg of packages)findings.push({ecosystem,id:a.id,aliases:a.aliases??[],package:pkg.name,version:pkg.version,severity:'vulnerability'});
    }
   }
   if(p.status!==0&&!findings.length)throw Error('Rust scanner failed without a recognized advisory; no waiver can bypass this');
  }else throw Error(`Unknown ecosystem ${ecosystem}`);
  fs.writeFileSync(path.join(output,`${ecosystem}-audit.raw`),raw);
  const decisions=adjudicate(findings,waivers);
  receipt.scanners[ecosystem]={status:decisions.some(x=>!x.waived)?'FAIL':'PASS',findings:decisions};
 }
 if(Object.values(receipt.scanners).some(x=>x.status!=='PASS'))throw Error('Unwaived dependency vulnerabilities');
 receipt.status='PASS';receipt.passed=true;
}catch(error){receipt.status='FAIL';receipt.error=error.message;process.exitCode=1;console.error(error.message);}
finally{receipt.completedAt=new Date().toISOString();save();console.log(JSON.stringify(receipt,null,2));}
