// TP01-D admits design references only; never applies fork patches or imports upstream code.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const root = resolve(import.meta.dirname, '..');
const origin='43331c3221be37c5cc1ed8dddc4c7988bcddc5cd';
const entries=[
 {id:'0001',title:'research workflow shape',family:'workflow_decomposition',module:'workflow.py',source:'agent/src/session/models.py',document:'0001-research-workflow-shape.md'},
 {id:'0002',title:'streaming phase projection',family:'streaming_phase_projection',module:'streaming.py',source:'agent/src/session/events.py',document:'0002-streaming-phase-projection.md'},
];
const replacements={session:'QuantOS workflow_run_id',auth:'QuantOS Engine metadata and research allowlist',audit:'QuantOS audit envelope',storage:'QuantOS Artifact API facade',stream:'QuantOS Engine StreamExecute'};
const sha = p=>'sha256:'+createHash('sha256').update(readFileSync(p)).digest('hex');
export function expectedQueue(base=root){
 const baseline=JSON.parse(readFileSync(resolve(base,'third_party/vibe-trading/baseline.lock.json')));
 return {schemaVersion:2,upstream:{repository:baseline.upstream.repositoryUrl,commit:baseline.upstream.commit,tag:baseline.upstream.tag},originCommit:origin,
  queue:entries.map(e=>({id:e.id,title:e.title,severity:'S3',adapterModule:'engines/vibe-adapter/src/vibe_adapter/'+e.module,status:'absorbed',mode:'adapter-side-equivalent-rewrite',designFamily:e.family,document:e.document,
   referenceSources:[{path:e.source,sha256:sha(resolve(base,'third_party/vibe-trading/upstream-src',e.source))}],boundaryReplacements:replacements}))};
}
export function validateQueue(queue,{base=root}={}){
 assert.deepEqual(queue,expectedQueue(base),'patch queue must match the locked baseline, approved design families, references and replacements');
 for(const e of queue.queue){const p=realpathSync(resolve(base,e.adapterModule));assert(p.startsWith(realpathSync(resolve(base,'engines/vibe-adapter/src/vibe_adapter'))+'/'),'adapter module escapes controlled source');}
 return {status:'PASS',entries:2,upstream:queue.upstream.commit,mode:'adapter-side-equivalent-rewrite'};
}
export function checkQueue(base=root){
 const directory=resolve(base,'forks/vibe-trading/patch-queue');
 assert.deepEqual(readdirSync(directory).sort(),['0001-research-workflow-shape.md','0002-streaming-phase-projection.md','README.md','queue.json'],'unreviewed patch queue files');
 const queue=JSON.parse(readFileSync(resolve(directory,'queue.json')));const result=validateQueue(queue,{base});
 for(const e of queue.queue){const text=readFileSync(resolve(directory,e.document),'utf8');assert(text.includes(queue.upstream.commit)&&text.includes(e.adapterModule),'queue document baseline or target differs');}
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.equal(process.argv.length,2);console.log(JSON.stringify(checkQueue()));}catch(error){console.error(error.message.split('\n')[0]);process.exitCode=1;}}
