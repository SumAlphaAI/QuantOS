// Capture the just-executed local F08 outputs; never replace an existing attempt's bytes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {resolve,relative,dirname} from 'node:path';
const {digest}=await import(process.cwd()+'/scripts/provider-a1-receipts.mjs');
const out=process.argv[2];assert(/^docs\/audit\/evidence\/r1-service-preflight-20261012\/attempt-\d{2}$/.test(out??''));
const receipt=JSON.parse(readFileSync(out+'/receipt.json')),service=JSON.parse(readFileSync('artifacts/f08-target/receipt.json'));
assert.equal(service.sourceCommit,receipt.sourceCommit);assert.equal(service.status,'PASS');
const save=(path,bytes)=>{if(existsSync(path))assert.equal(digest(readFileSync(path)),digest(bytes),'refuse to overwrite different evidence');else{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);}};
const json=(path,value)=>save(path,JSON.stringify(value,null,2)+'\n');
const walk=p=>statSync(p).isDirectory()?readdirSync(p).sort().flatMap(n=>walk(resolve(p,n))):[p];
for(const file of walk(resolve('artifacts/f08-target')))save(out+'/supporting/f08-service/'+relative(resolve('artifacts/f08-target'),file),readFileSync(file));
for(const name of ['python','rust','rust-nightly'])save(out+'/supporting/f08-'+name+'-coverage.json.gz',gzipSync(readFileSync('target/f08-'+name+'-coverage.json')));
json(out+'/supporting-manifest.json',walk(resolve(out,'supporting')).map(path=>({path:relative(resolve(out),path),sha256:digest(readFileSync(path))})).sort((a,b)=>a.path.localeCompare(b.path)));
const f0=JSON.parse(readFileSync('docs/audit/evidence/f0-target-diagnostics-20261012/summary.json'));
for(const file of f0.files)assert.equal(digest(readFileSync(file.path)),file.sha256);
json(out+'/retained-f0-failures.json',{status:'PASS',files:f0.files,failed:f0.failed,target:'NOT_RUN_THIS_PREFLIGHT'});
console.log('supporting artifacts and retained failure evidence PASS');
