from pathlib import Path
import json,hashlib,subprocess
D=Path('docs/audit/evidence/g0-legacy-local-20261020')
base=json.loads((D/'preflight/baseline.json').read_text())['sourceCommit']
entries=subprocess.check_output(['git','ls-tree','-r','-z',base,'--','docs/audit','docs/gate-records']).split(b'\0')
allowed={'docs/gate-records/G0-current-disposition.json','docs/gate-records/G0-current-disposition.md','docs/gate-records/G0-current-scope-confirmations.json'}
count=0;changed=[]
for entry in filter(None,entries):
 meta,rawpath=entry.split(b'\t',1);mode,kind,oid=meta.split();assert kind==b'blob';p=Path(rawpath.decode());b=p.read_bytes();current=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
 count+=1
 if current!=oid.decode():
  assert str(p) in allowed,str(p)
  copy=D/'preflight'/p;old=copy.read_bytes();assert hashlib.sha1(b'blob '+str(len(old)).encode()+b'\0'+old).hexdigest()==oid.decode()
  changed.append({'path':str(p),'originalGitBlob':oid.decode(),'currentSha256':'sha256:'+hashlib.sha256(b).hexdigest(),'originalCopy':str(copy)})
assert {i['path'] for i in changed}==allowed
proof={'schema':'quantos-legacy-history-preservation/v1','status':'PASS','baselineCommit':base,'originalFiles':count,'unchangedOriginalBytes':count-len(changed),'mutableCurrentRecords':changed,'originalG0AndAllDrafts':'UNCHANGED_BYTES','originalEngineeringReceiptsAndLogs':'UNCHANGED_BYTES','originalG0ConfirmationClosure':'PRESERVED_AT_ORIGINAL_SOURCE','historicalWholeItemClosure':False}
(D/'history-preservation.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(proof,ensure_ascii=False,indent=2))
