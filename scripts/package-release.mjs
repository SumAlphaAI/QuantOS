import fs from 'node:fs';
import path from 'node:path';
import {inventory,validateOutputs,cleanSource,sha} from './f01-lib.mjs';
const root=process.cwd();
cleanSource(root);
for(const [receipt,lock] of [['node-licenses.json','pnpm-lock.yaml'],['python-licenses.json','engines/uv.lock']]) {
 const evidence=JSON.parse(fs.readFileSync(path.join(root,'artifacts/f02',receipt)));
 if(evidence.status!=='PASS'||evidence.lockSha256!==sha(fs.readFileSync(path.join(root,lock))))throw Error(`Stale or failed license evidence: ${receipt}`);
}
const data=inventory(root);validateOutputs(root,data);
const dest=path.join(root,'artifacts/release');fs.rmSync(dest,{recursive:true,force:true});fs.mkdirSync(dest,{recursive:true});
function copy(source,target){fs.mkdirSync(path.dirname(path.join(dest,target)),{recursive:true});fs.cpSync(path.join(root,source),path.join(dest,target),{recursive:true});}
for(const n of data.rustBinaries)copy(`target/release/${n}`,`rust/${n}`);
for(const p of data.python)copy(`artifacts/python/${p.name.replaceAll('-','_')}-${p.version}-py3-none-any.whl`,`python/${p.name.replaceAll('-','_')}-${p.version}-py3-none-any.whl`);
for(const p of data.js)copy(p.output,`web/${p.directory}`);
copy('artifacts/sbom/quantos.spdx.json','sbom/quantos.spdx.json');
for(const file of ['Cargo.lock','pnpm-lock.yaml','engines/uv.lock','buf.lock'])copy(file,`locks/${file}`);
console.log('Packaged all Rust, Python and phase-one Web outputs');

copy('THIRD_PARTY_NOTICES.md','notices/THIRD_PARTY_NOTICES.md');
copy('docs/adr/20260917-f02-license-intake.md','notices/license-intake.md');
copy('artifacts/f02/node-licenses.json','notices/node-licenses.json');

copy('artifacts/f02/python-licenses.json','notices/python-licenses.json');
