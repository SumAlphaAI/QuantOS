from pathlib import Path
import hashlib,json,subprocess
root=Path.cwd();baseline='4911fa76255494334bea5066e5a7b40c076aae8d';rows=[]
for path in ['Cargo.toml','Cargo.lock','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','engines/pyproject.toml','engines/uv.lock','.gitmodules']:
 before=subprocess.check_output(['git','show',baseline+':'+path],cwd=root);after=(root/path).read_bytes();assert before==after,path
 rows.append({'path':path,'baselineSha256':hashlib.sha256(before).hexdigest(),'currentSha256':hashlib.sha256(after).hexdigest(),'unchanged':True})
r={'schema':'quantos-tp11-lock-digests/v1','status':'PASS','baselineCommit':baseline,'runtimeAdmission':'DENIED','formalAccepted':False,'files':rows}
(root/'docs/audit/evidence/tp11-20261011/lock-digests.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'status':'PASS','unchangedManifestsAndLocks':len(rows)}))
