import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'yaml';
import crypto from 'node:crypto';
import {allowed,licenseAllowed} from './license-policy.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname);
fs.mkdirSync(path.join(root,'artifacts/f02'),{recursive:true});
fs.writeFileSync(path.join(root,'artifacts/f02/node-licenses.json'),JSON.stringify({status:'RUNNING'}));
const projects=JSON.parse(execFileSync('pnpm',['list','-r','--depth','Infinity','--json'],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024}));
const installed=new Map();
function visit(node){
 if(node.path && fs.existsSync(path.join(node.path,'package.json'))){const p=JSON.parse(fs.readFileSync(path.join(node.path,'package.json')));installed.set(`${p.name}@${p.version}`,p);}
 for(const key of ['dependencies','devDependencies','optionalDependencies'])for(const child of Object.values(node[key]??{}))visit(child);
}
for(const p of projects)visit(p);
const lock=parse(fs.readFileSync(path.join(root,'pnpm-lock.yaml'),'utf8'));
const policy=JSON.parse(fs.readFileSync(path.join(root,'security/node-license-allowlist.json')));
const evidence=JSON.parse(fs.readFileSync(path.join(root,'security/license-evidence.json')));
const packages=[],failures=[];
const entries=Object.entries(lock.packages);
async function worker(){
 while(entries.length){
  const [key,value]=entries.shift(), split=key.lastIndexOf('@');
  const name=key.slice(0,split),version=key.slice(split+1);
  let manifest=installed.get(key),source='installed';
  if(!manifest){
   const response=await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,{signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw Error(`License metadata unavailable: ${key} ${response.status}`);
   manifest=await response.json();source='registry metadata for uninstalled/platform-specific package';
   if(manifest.dist?.integrity!==value.resolution?.integrity)throw Error(`License metadata integrity mismatch: ${key}`);
  }
  let license=typeof manifest.license==='string'?manifest.license:manifest.license?.type;
  if(!license && evidence[key]) {
   const node=projects.flatMap(function flatten(p){return [p,...['dependencies','devDependencies','optionalDependencies'].flatMap(k=>Object.values(p[k]??{}).flatMap(flatten))]}).find(p=>p.path&&fs.existsSync(path.join(p.path,'package.json'))&&JSON.parse(fs.readFileSync(path.join(p.path,'package.json'))).name===name);
   if(!node)throw Error(`License evidence package missing: ${key}`);
   const bytes=fs.readFileSync(path.join(node.path,evidence[key].file));
   if(crypto.createHash('sha256').update(bytes).digest('hex')!==evidence[key].sha256)throw Error(`License evidence changed: ${key}`);
   license=evidence[key].license;source='hash-verified published LICENSE';
  }
  const approval=(policy.buildOnlyApprovals??[]).find(a=>a.package===name&&a.version===version&&a.license===license&&a.scope==='static-web-build-only');
  if(!licenseAllowed(license,allowed)&&!approval)failures.push(`${key}: ${license}`);
  packages.push({name,version,license:license??null,source,scope:approval?.scope??"approved"});
 }
}
await Promise.all(Array.from({length:6},worker));
if(packages.length!==Object.keys(lock.packages).length)throw Error('License inventory incomplete');
if(!fs.existsSync(path.join(root,'THIRD_PARTY_NOTICES.md')))throw Error('NOTICE required');
fs.mkdirSync(path.join(root,'artifacts/f02'),{recursive:true});
fs.writeFileSync(path.join(root,'artifacts/f02/node-licenses.json'),JSON.stringify({lockSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'pnpm-lock.yaml'))).digest('hex'),status:failures.length?'FAIL':'PASS',scope:'every pnpm lock package including dev/build and other-platform optional packages',packages:packages.sort((a,b)=>(a.name+a.version).localeCompare(b.name+b.version)),failures},null,2)+'\n');
if(failures.length)throw Error(`LICENSE_DENIED: ${failures.join('; ')}`);
console.log(`Licensed all ${packages.length} locked packages across ${projects.length} workspaces`);
