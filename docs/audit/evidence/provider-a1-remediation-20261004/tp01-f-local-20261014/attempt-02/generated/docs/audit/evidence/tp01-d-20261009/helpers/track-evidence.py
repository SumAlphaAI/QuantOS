from pathlib import Path
import json,hashlib,subprocess,sys
root=Path('/Users/anray/Documents/project/SumAlpha/QuantOS')
base=root/'docs/audit/evidence/provider-a1-remediation-20261004'
ledgers=[base/'tp01-d-prerequisites-20261009/attempt-01/execution-results.json',base/'tp01-d-prerequisites-20261009/validated-composite-01/execution-results.json',base/'tp01-d-admission-20261009/attempt-01/execution-results.json']
composite=base/'tp01-d-admission-20261009/validated-composite-01/execution-results.json'
if composite.exists():ledgers.append(composite)
refs={}
for ledger in ledgers:
 for c in json.loads(ledger.read_text()):
  for key,sha in [('log','logSha256'),('artifact','artifactSha256'),('targetEvidence','targetEvidenceSha256')]:
   if c.get(key):refs[c[key]]=c[sha]
  for a in c.get('supportingArtifacts',[]):refs[a['path']]=a['sha256']
for path,expected in refs.items():
 actual=(root/path).resolve();assert actual.is_relative_to(base.resolve()),path
 assert 'sha256:'+hashlib.sha256(actual.read_bytes()).hexdigest()==expected,path
paths=sorted(refs)
ignored=subprocess.run(['git','check-ignore','-z','--stdin'],cwd=root,input=b'\0'.join(p.encode() for p in paths)+b'\0',stdout=subprocess.PIPE).stdout.split(b'\0')
ignored=[p.decode() for p in ignored if p]
if '--check-commit' in sys.argv:
 for path,expected in refs.items():
  raw=subprocess.check_output(['git','show','HEAD:'+path],cwd=root)
  assert 'sha256:'+hashlib.sha256(raw).hexdigest()==expected,'committed evidence differs: '+path
 print(json.dumps({'status':'PASS','requiredFiles':len(refs),'committedBytesVerified':True,'untrackedIgnoredReferences':ignored}));assert not ignored
else:
 if ignored:subprocess.run(['git','add','-f','--',*ignored],cwd=root,check=True)
 tracked=set(subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0'))
 missing=[p for p in paths if p not in tracked];assert not missing,'stage normal evidence before checking: '+str(missing[:3])
 record={'schema':'quantos-tp01-d-git-evidence-tracking/v1','status':'PASS','formalAccepted':False,'checkedLedgers':[str(p.relative_to(root)) for p in ledgers],'requiredFiles':len(refs),'forcedIgnoredFiles':ignored,'ruleUnchanged':'root .gitignore target/ rule','allRequiredPathsTracked':True,'digestVerifiedAgainstActualExecution':True}
 (root/'docs/audit/evidence/tp01-d-20261009/git-evidence-tracking.json').write_text(json.dumps(record,indent=2)+'\n')
 print(json.dumps({'status':'PASS','requiredFiles':len(refs),'forcedIgnoredFiles':len(ignored)}))
