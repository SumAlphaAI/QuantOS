from pathlib import Path
import hashlib,json,subprocess
root=Path.cwd();baseline='be5bc89da66c4d168d73f077b275d2bb374e8153';rows=[]
for path in ['Cargo.toml','Cargo.lock','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','engines/pyproject.toml','engines/uv.lock','.gitmodules']:
 before=subprocess.check_output(['git','show',baseline+':'+path],cwd=root);after=(root/path).read_bytes();assert before==after,path
 rows.append({'path':path,'baselineSha256':hashlib.sha256(before).hexdigest(),'currentSha256':hashlib.sha256(after).hexdigest(),'unchanged':True})
r={'schema':'quantos-tp09-lock-digests/v1','status':'PASS','baselineCommit':baseline,'runtimeAdmission':'DENIED','formalAccepted':False,'files':rows}
(root/'docs/audit/evidence/tp09-20261011/lock-digests.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'status':'PASS','unchangedManifestsAndLocks':len(rows)}))
