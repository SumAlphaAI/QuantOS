import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
const {digest}=await import(process.cwd()+'/scripts/provider-a1-receipts.mjs');
const base='docs/audit/evidence/r1-service-preflight-20261012',report='docs/audit/R1-SERVICE-TP01-C-local-preflight-2026-10-12.md',manifest=base+'/manifest.json';
const walk=p=>statSync(p).isDirectory()?readdirSync(p).sort().flatMap(n=>walk(resolve(p,n))):[relative(process.cwd(),p)];
function files(){return [...walk(resolve(base)).filter(p=>p!==manifest),report].sort();}
if(process.argv[2]==='--record'){
 assert(!existsSync(manifest),'do not overwrite a seal');
 writeFileSync(base+'/changed-files.txt',[...new Set([...files(),base+'/changed-files.txt',manifest])].sort().join('\n')+'\n');
 const rows=files().map(path=>({path,sha256:digest(readFileSync(path))}));
 writeFileSync(manifest,JSON.stringify({schema:'quantos-local-preflight-file-seal/v1',sourceCommit:JSON.parse(readFileSync(base+'/attempt-01/receipt.json')).sourceCommit,
   status:'PASS',formalAccepted:false,files:rows},null,2)+'\n');
}else assert.equal(process.argv[2],'--verify');
const seal=JSON.parse(readFileSync(manifest));assert.equal(seal.status,'PASS');assert.equal(seal.formalAccepted,false);
assert.deepEqual(seal.files.map(f=>f.path),files(),'missing or unlisted evidence');
for(const file of seal.files)assert.equal(digest(readFileSync(file.path)),file.sha256,'evidence changed: '+file.path);
console.log(JSON.stringify({status:'PASS',sealedFiles:seal.files.length,sourceCommit:seal.sourceCommit,formalAccepted:false}));
