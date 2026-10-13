from pathlib import Path
import json,hashlib,re,subprocess
base=Path('docs/audit/evidence/candidate-workflow-20261013')
sha=lambda b:'sha256:'+hashlib.sha256(b).hexdigest()
r=json.loads((base/'results.json').read_text());assert r['status']=='PASS' and len(r['checks'])==14 and all(c['expectationMet'] for c in r['checks'])
for check in r['checks']:assert sha(Path(check['log']).read_bytes())==check['sha256'],check['id']
inputs=json.loads((base/'inputs.json').read_text())
for f in inputs['files']:assert sha(Path(f['path']).read_bytes())==f['sha256'],f['path']
index=json.loads((base/'file-index.json').read_text())
for f in index['files']:assert sha(Path(f['path']).read_bytes())==f['sha256'],f['path']
missing=[]
for f in inputs['files']:
 p=Path(f['path'])
 if p.suffix!='.md':continue
 for link in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  link=link.strip('<>')
  if '://' not in link and not link.startswith(('#','mailto:')) and not (p.parent/link.split('#')[0]).exists():missing.append([str(p),link])
assert not missing,missing
plans=json.loads((base/'plans.log').read_text());assert plans['stage_status_counts']=={'NOT_ASSESSED':159,'READY':0,'BLOCKED':0}
assert json.loads((base/'history-integrity.json').read_text())['changedHistoricalEvidence']==[]
assert json.loads((base/'secrets.json').read_text())['status']=='PASS'
print(json.dumps({'status':'PASS','checks':14,'inputFiles':len(inputs['files']),'evidenceFiles':len(index['files']),'missingLinks':missing,'businessGateReassessment':'NOT_RUN','hostedCI':'NOT_RUN','databaseExecution':False,'deploymentPerformed':False,'formalAccepted':False},indent=2))
