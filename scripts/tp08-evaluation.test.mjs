import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifySourceEvidence,verifyExperiments,assertQlibProductionExcluded} from './tp08-evaluation.mjs';
const root=resolve(import.meta.dirname,'..');
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
function fixture(source,fn){const dir=mkdtempSync(resolve(tmpdir(),'tp08-probe-'));try{cpSync(resolve(root,source),dir,{recursive:true});fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}}
function edit(dir,file,fn){const p=resolve(dir,file),v=JSON.parse(readFileSync(p));fn(v);writeFileSync(p,JSON.stringify(v));}
test('pinned source and descriptor-only disposition validate',()=>assert.equal(verifySourceEvidence().runtimeAdmission,'DENIED'));
test('three generated experiments and actual byte evidence validate',()=>assert.equal(verifyExperiments(resolve(root,'third_party/qlib/mappings')).mappings,3));
test('production inventory with no Qlib passes exclusion only',()=>assert.equal(assertQlibProductionExcluded(['quantos-runtime','quantos-llmquant']).scope,'TP08 runtime exclusion only'));
for(const path of ['pyqlib.whl','engines/qlib-adapter','third_party/qlib','QLIB.so'])test('production rejects '+path,()=>assert.throws(()=>assertQlibProductionExcluded([path]),/TP08_REFERENCE_RUNTIME_DENIED/));
for(const inventory of [null,{},[''],[5]])test('invalid inventory '+JSON.stringify(inventory),()=>assert.throws(()=>assertQlibProductionExcluded(inventory)));
for(const [name,file,mutation]of [
 ['pin','baseline.lock.json',v=>v.upstream.commit='0'.repeat(40)],
 ['runtime approval','baseline.lock.json',v=>v.productionApproved=true],
 ['adapter decision','baseline.lock.json',v=>v.policy.decision='isolated_adapter'],
 ['source byte digest','upstream-evidence/provenance.json',v=>v.files[0].sha256='0'.repeat(64)],
 ['source omission','upstream-evidence/provenance.json',v=>v.files.pop()],
 ['source traversal','upstream-evidence/provenance.json',v=>v.files[0].path='../LICENSE'],
 ['fake SHA256 commit','sbom.spdx.json',v=>v.packages[0].checksums=[{algorithm:'SHA256',checksumValue:'a'.repeat(40)}]],
 ['fake clean CVE','cve-audit.json',v=>v.noVulnerabilitiesClaimed=true],
 ['dependency omission disguised by count','direct-dependencies.json',v=>v.requirements[0]='forged-package'],
 ['fake resolved graph','direct-dependencies.json',v=>v.resolved=true],
])test('source evidence rejects '+name,()=>fixture('third_party/qlib',dir=>{edit(dir,file,mutation);assert.throws(()=>verifySourceEvidence(dir));}));
for(const [name,mutation]of [
 ['source pin',v=>v.source_commit='0'.repeat(40)],
 ['scope mismatch',v=>v.scope.tenant_id='foreign'],
 ['trading claim',v=>v.trading_approved=true],
 ['upstream claim',v=>v.upstream_runtime_loaded=true],
 ['missing contract field',v=>delete v.quantos_data_snapshot.metadata],
 ['old flat metadata',v=>{v.quantos_data_snapshot.metadata.actor_id='actor';delete v.quantos_data_snapshot.metadata.actor;}],
 ['placeholder content hash',v=>v.quantos_data_snapshot.artifact_refs[0].sha256='sha256:placeholder'],
])test('actual mapping rejects '+name+' even after rehash',()=>fixture('third_party/qlib/mappings',dir=>{
 const file='01-alpha158-to-datasnapshot.json';const doc=JSON.parse(readFileSync(resolve(dir,file)));mutation(doc);delete doc.content_hash;
 const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
 doc.content_hash=hash(JSON.stringify(canonical(doc)));const raw=JSON.stringify(doc);writeFileSync(resolve(dir,file),raw);edit(dir,'receipt.json',r=>r.files.find(f=>f.file===file).sha256=hash(raw));assert.throws(()=>verifyExperiments(dir));
}));
test('missing actual Artifact bytes cannot pass',()=>fixture('third_party/qlib/mappings',dir=>{const r=JSON.parse(readFileSync(resolve(dir,'receipt.json')));rmSync(resolve(dir,r.files[3].file));assert.throws(()=>verifyExperiments(dir));}));
test('forged replay outcome cannot pass',()=>fixture('third_party/qlib/mappings',dir=>{edit(dir,'receipt.json',v=>v.replayIdentical=false);assert.throws(()=>verifyExperiments(dir));}));
