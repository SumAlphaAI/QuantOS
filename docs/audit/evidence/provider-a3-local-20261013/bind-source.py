from pathlib import Path
import json,subprocess,hashlib
root=Path('docs/audit/evidence/provider-a1-remediation-20261004/provider-a3-local-20261013/attempt-01')
index=json.loads((root/'local-prerequisites.json').read_text());source=index['observedSourceCommit'];inputs={}
subprocess.run(['node','--input-type=module','-e', '''
import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {nodesFromPlans,planInput} from './scripts/provider-a1-receipts.mjs';
const index=JSON.parse(readFileSync(process.argv[1])),paths=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'];const nodes=nodesFromPlans(paths.map(p=>execFileSync('git',['show',index.observedSourceCommit+':'+p],{encoding:'utf8'})));for(const n of index.nodes)assert.deepEqual(JSON.parse(readFileSync(n.manifest)).planInput,planInput(nodes.get(n.nodeId)));
''',str(root/'local-prerequisites.json')],check=True)

for node in index['nodes']:
 for item in json.loads(Path(node['manifest']).read_text())['inputs']:
  assert item['path'] not in inputs or inputs[item['path']]==item
  inputs[item['path']]=item
# Batch immutable Git blob reads; gitlinks have their own pinned commit semantics.
blobs=[i for i in inputs.values() if 'gitCommit' not in i]
proc=subprocess.Popen(['git','cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
assert proc.stdin and proc.stdout
# Stream request/read one by one to avoid pipe backpressure with large source inputs.
for item in blobs:
 proc.stdin.write((source+':'+item['path']+'\n').encode());proc.stdin.flush()
 head=proc.stdout.readline().decode().strip().split();assert len(head)==3 and head[1]=='blob',head
 data=proc.stdout.read(int(head[2]));assert proc.stdout.read(1)==b'\n'
 digest='sha256:'+hashlib.sha256(data).hexdigest();assert digest==item['sha256'],item['path']
 assert data==Path(item['path']).read_bytes(),item['path']
proc.stdin.close();assert proc.wait()==0
for item in inputs.values():
 if 'gitCommit' in item:
  row=subprocess.check_output(['git','ls-tree',source,item['path']],text=True);assert 'commit '+item['gitCommit'] in row
report={'status':'PASS','sourceCommit':source,'manifestNodes':len(index['nodes']),'uniqueBoundInputs':len(inputs),'gitBlobs':len(blobs),'currentBytesMatchCandidate':True,'normativeScopesMatchCandidate':True,'formalAccepted':False,'databaseExecution':False}
Path('docs/audit/evidence/provider-a3-local-20261013/source-binding.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
