import assert from 'node:assert/strict';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const root=resolve(import.meta.dirname,'..');
export const pin='d5379c520f66a39953bad76234a7019a72796fd0';
const read=p=>JSON.parse(readFileSync(p));
const digest=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
const hash=v=>digest(JSON.stringify(canonical(v)));
const confined=(dir,path)=>{assert(typeof path==='string'&&!path.includes('..')&&!path.startsWith('/')&&!path.includes('\\'));const actual=realpathSync(resolve(dir,path));assert(actual.startsWith(realpathSync(dir)+sep));return actual;};
export function verifySourceEvidence(base=resolve(root,'third_party/qlib')){
 const lock=read(resolve(base,'baseline.lock.json')),proof=read(resolve(base,'upstream-evidence/provenance.json')),sbom=read(resolve(base,'sbom.spdx.json')),cve=read(resolve(base,'cve-audit.json')),deps=read(resolve(base,'direct-dependencies.json'));
 assert.equal(lock.upstream.commit,pin);assert.equal(lock.license.spdx,'MIT');assert.equal(lock.policy.decision,'reference_only');assert.equal(lock.productionApproved,false);assert.equal(lock.policy.runtimeAdmission,'DENIED');assert.equal(lock.sourceDisposition,'reference_only_no_upstream_runtime_admitted');
 assert.equal(proof.commit,pin);assert.equal(proof.mode,'static_read_only_no_execution');assert.deepEqual(proof.files.map(f=>f.path),['LICENSE','pyproject.toml','setup.py','qlib/contrib/data/handler.py','examples/benchmarks/LightGBM/workflow_config_lightgbm_Alpha158.yaml','qlib/workflow/recorder.py']);
 assert.equal(sbom.spdxVersion,'SPDX-2.3');assert.equal(sbom.packages.length,1);assert(!sbom.packages[0].checksums,'Git commit is not archive SHA256');assert.equal(sbom.files.length,6);
 for(const [i,f]of proof.files.entries()){
  const raw=readFileSync(confined(resolve(base,'upstream-evidence'),f.path));assert.equal(raw.length,f.sizeBytes);assert.equal(digest(raw),'sha256:'+f.sha256);assert.equal(f.url,'https://raw.githubusercontent.com/microsoft/qlib/'+pin+'/'+f.path);
  assert.equal(sbom.files[i].fileName,f.path);assert.deepEqual(sbom.files[i].checksums,[{algorithm:'SHA256',checksumValue:f.sha256}]);
 }
 assert.equal(proof.files[0].sha256,lock.license.licenseFile.sha256);assert.equal(proof.files[1].sha256,lock.dependencyDigests.projectDescriptor.sha256);assert.equal(proof.files[2].sha256,lock.dependencyDigests.setupScript.sha256);
 assert.equal(deps.sourceCommit,pin);assert.equal(deps.descriptorSha256,proof.files[1].sha256);assert.equal(deps.resolved,false);assert.equal(deps.installed,false);assert.equal(deps.transitiveGraph,null);assert.equal(deps.requirements.length,23);const descriptor=readFileSync(resolve(base,'upstream-evidence/pyproject.toml'),'utf8');const declared=descriptor.match(/^dependencies = \[([\s\S]*?)^\]/m);assert(declared);assert.deepEqual(deps.requirements,[...declared[1].matchAll(/^\s*"([^"]+)"/gm)].map(m=>m[1]));
 assert.equal(cve.sourceCommit,pin);assert.equal(cve.status,'NOT_ASSESSED_RESOLVED_GRAPH');assert.equal(cve.currentAdvisoryScanExecuted,false);assert.equal(cve.noVulnerabilitiesClaimed,false);assert.equal(cve.resolvedLock,null);assert.equal(cve.runtimeAdmission,'DENIED');assert.equal(cve.productionApproved,false);
 return {status:'PASS',pin,sourceFiles:6,resolvedCve:'NOT_ASSESSED',runtimeAdmission:'DENIED'};
}
export function assertQlibProductionExcluded(paths){
 assert(Array.isArray(paths)&&paths.every(p=>typeof p==='string'&&p.length>0),'TP08_INVENTORY_REQUIRED');verifySourceEvidence();
 for(const path of paths)assert(!/qlib/i.test(path),'TP08_REFERENCE_RUNTIME_DENIED');
 for(const file of ['Cargo.lock','pnpm-lock.yaml','engines/uv.lock'])assert(!/github\.com\/microsoft\/qlib|name\s*=\s*["'](?:pyqlib|qlib|mlflow)["']/i.test(readFileSync(resolve(root,file),'utf8')),'TP08_RUNTIME_LOCK_DENIED');
 return {status:'PASS',scope:'TP08 runtime exclusion only',formalAccepted:false};
}
export function verifyExperiments(base){
 const r=read(resolve(base,'receipt.json'));assert.equal(r.schema,'quantos-tp08-experiments/v1');assert.equal(r.status,'PASS');assert.equal(r.formalAccepted,false);assert.equal(r.disposition,'reference_only');assert.equal(r.source_commit,pin);
 for(const [k,v]of Object.entries({mappingCount:3,featureRows:24,metricSamples:21,replayIdentical:true,physicalObjects:3,upstreamRuntime:false,databaseExecuted:false}))assert.equal(r[k],v);
 assert.equal(r.files.length,6);assert.equal(new Set(r.files.map(f=>f.file)).size,6);
 const blobs=new Map();for(const f of r.files){const raw=readFileSync(confined(base,f.file));assert.equal(digest(raw),f.sha256);blobs.set(f.file,JSON.parse(raw));}
 const names=['01-alpha158-to-datasnapshot.json','02-lightgbm-experiment-to-research-artifact.json','03-workflow-replay-to-runtime-run.json'];
 const docs=names.map(n=>{assert(blobs.has(n));return blobs.get(n);});
 for(const d of docs){const{content_hash,...body}=d;assert.equal(hash(body),content_hash);assert.equal(d.source_commit,pin);assert.equal(d.disposition,'reference_only');assert.equal(d.trading_approved,false);assert.equal(d.upstream_runtime_loaded,false);assert.equal(d.data_license,'synthetic-test-only');assert.deepEqual(d.scope,docs[0].scope);assert.equal(d.input_hash,docs[0].input_hash);}
 const snapshot=docs[0].quantos_data_snapshot,research=docs[1].quantos_research_artifact,replay=docs[2].offline_replay;
 const ajv=new Ajv2020({strict:false,allErrors:true});addFormats(ajv);
 for(const [name,value]of [['DataSnapshot',snapshot],['ResearchArtifact',research]]){const validate=ajv.compile(read(resolve(root,'proto/jsonschema/v1'+name+'.schema.json')));assert(validate(value),JSON.stringify(validate.errors));assert.equal(value.metadata.mode,'RUNTIME_MODE_RESEARCH');assert.equal(value.metadata.environment,'ENVIRONMENT_TEST');assert.equal(value.metadata.tenant_id,docs[0].scope.tenant_id);assert.equal(value.metadata.workspace_id,docs[0].scope.workspace_id);assert.equal(value.metadata.actor.actor_id,docs[0].scope.actor_id);}
 assert.equal(snapshot.license_label,'synthetic-test-only');assert.equal(snapshot.sources[0].provider,'quantos-offline-fixture');assert.equal(research.data_snapshot_id,snapshot.snapshot_id);assert.equal(research.code_version,digest(readFileSync(resolve(root,'third_party/qlib/experiments.py'))));assert.equal(replay.runtime_executed,false);assert.equal(replay.storage_uploaded,false);assert.equal(replay.physical_object_count,3);
 const refs=[...snapshot.artifact_refs,...research.attachments];assert.equal(refs.length,3);assert.deepEqual(replay.artifact_refs,refs);assert.equal(new Set(refs.map(x=>x.uri)).size,3);
 for(const ref of refs){assert(/^sha256:[0-9a-f]{64}$/.test(ref.sha256));assert.equal(ref.uri,'mock-artifact://tp08/'+ref.artifact_id.split(':')[1]+'/'+ref.sha256.slice(7)+'.json');const entry=r.files.find(f=>f.file==='objects/'+ref.artifact_id.replaceAll(':','-')+'.json');assert(entry);assert.equal(ref.sha256,entry.sha256);const payload=blobs.get(entry.file);assert.equal(payload.trading_approved,false);assert.equal(payload.upstream_runtime_loaded,false);assert.deepEqual(payload.scope,docs[0].scope);assert.equal(payload.input_hash,docs[0].input_hash);}
 assert.equal(snapshot.content_hash,refs[0].sha256);assert.equal(research.content_hash,hash(research.attachments));assert.deepEqual(research.evidence_refs.map(x=>x.artifact_id),research.attachments.map(x=>x.artifact_id));
 assert.equal(blobs.get(r.files.find(f=>f.file.startsWith('objects/tp08-features-')).file).records.length,24);
 const metrics=blobs.get(r.files.find(f=>f.file.startsWith('objects/tp08-metrics-')).file);assert.equal(metrics.samples,21);assert.equal(metrics.mean_absolute_error,'0.02485689');
 const config=blobs.get(r.files.find(f=>f.file.startsWith('objects/tp08-config-')).file);for(const name of ['full_alpha158_executed','lightgbm_executed','mlflow_executed','training_executed'])assert.equal(config[name],false);
 return {status:'PASS',mappings:3,physicalObjects:3,formalAccepted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{if(process.argv[2]==='--workspace')console.log(JSON.stringify(assertQlibProductionExcluded([])));else{assert.equal(process.argv.length,3);verifySourceEvidence();console.log('TP08_OFFLINE_SCHEMA_PASS',JSON.stringify(verifyExperiments(resolve(process.argv[2]))));}}catch(e){console.error(e.message);process.exitCode=1;}
}
