from pathlib import Path
import json,subprocess,hashlib
baseline='3967d49206f9ec6a7c7663262694e08975418fa3'
base=Path('docs/audit/evidence/provider-a3-local-20261013')
attempt=Path('docs/audit/evidence/provider-a1-remediation-20261004/provider-a3-local-20261013/attempt-01')
source=json.loads((attempt/'local-prerequisites.json').read_text())['observedSourceCommit']
def git(*args):return subprocess.check_output(['git',*args],text=True).splitlines()
historical=set(git('ls-tree','-r','--name-only',baseline,'docs/audit/evidence'))
changed=set(git('diff','--name-only',baseline,'--','docs/audit/evidence'))
mutated=sorted(historical&changed);assert not mutated,mutated
(base/'historical-evidence-integrity.json').write_text(json.dumps({'status':'PASS','baselineSource':baseline,'preExistingEvidenceFiles':len(historical),'changedHistoricalEvidence':mutated,'formalAccepted':False},indent=2)+'\n')
newfiles={str(base/x) for x in ['evidence-index.json','final-verification.json','changed-files.txt','changed-source-files.txt']}
files=sorted(set(git('diff','--name-only',baseline))|set(git('ls-files','--others','--exclude-standard'))|newfiles)
(base/'changed-files.txt').write_text('\n'.join(files)+'\n')
sourcefiles=[x for x in files if not x.startswith('docs/audit/evidence/')]
(base/'changed-source-files.txt').write_text('\n'.join(sourcefiles)+'\n')
markdown=[x for x in sourcefiles if x.startswith('docs/') and x.endswith('.md')]
exclude={str(base/'evidence-index.json'),str(base/'final-verification.json')}
index={'schema':'quantos-provider-a3-local-delivery-index/v1','sourceCommit':source,'baselineCommit':baseline,'executionResults':str(attempt/'execution-results.json'),'markdownChecks':markdown,'files':[]}
for filename in files:
 if filename in exclude:continue
 p=Path(filename);assert p.is_file(),filename
 index['files'].append({'path':filename,'sha256':'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest()})
(base/'evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
print(json.dumps({'indexedFiles':len(index['files']),'changedSourceFiles':len(sourcefiles),'historicalUnchanged':len(historical),'markdownChecks':markdown},indent=2))
