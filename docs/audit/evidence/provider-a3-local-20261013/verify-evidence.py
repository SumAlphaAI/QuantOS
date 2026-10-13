"""Read-only delivery validation. No target execution or formal approval."""
from pathlib import Path
import hashlib,json,re
base=Path('docs/audit/evidence/provider-a3-local-20261013')
index=json.loads((base/'evidence-index.json').read_text())
def digest(p):return 'sha256:'+hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert re.fullmatch('[a-f0-9]{40}',index['sourceCommit'])
assert len({i['path'] for i in index['files']})==len(index['files'])
for item in index['files']:assert digest(item['path'])==item['sha256'],item['path']
r=json.loads(Path(index['executionResults']).read_text())
assert len(r)==140 and len({x['id'] for x in r})==140
assert all(x['status']=='PASS' and x['exitCode']==0 for x in r)
for result in r:
 assert digest(result['log'])==result['logSha256'],result['id']
 if 'artifact' in result:assert digest(result['artifact'])==result['artifactSha256'],result['id']
 for artifact in result.get('supportingArtifacts',[]):assert digest(artifact['path'])==artifact['sha256'],artifact['path']
for profile,count in [('a2-local',17),('r1-local',27),('bff003-local',40),('bff005-local',40),('a3-local',42)]:
 receipt=json.loads((base/(profile+'.json')).read_text())
 assert receipt['status']=='READY' and receipt['observedSourceCommit']==index['sourceCommit']
 assert all(receipt[k] is False for k in ['databaseExecution','externalExecution','performanceAccepted','production','formalAccepted'])
 assert receipt['release']['status']=='NOT_RUN'
 assert digest(receipt['localPrerequisites']['manifest'])==receipt['localPrerequisites']['inputDigest']
 assert len(json.loads(Path(receipt['localPrerequisites']['manifest']).read_text())['nodes'])==count
 if profile=='a3-local':
  assert [c['nodeId'] for c in receipt['consumerReceipts']]==['FE:BFF-FE-003','FE:BFF-FE-005','PROVIDER:A2']
  for c in receipt['consumerReceipts']:
   assert digest(c['manifest'])==c['sha256'];assert json.loads(Path(c['manifest']).read_text())['observedSourceCommit']==index['sourceCommit']
plans=json.loads((base/'plans.log').read_text())
assert plans['stage_status_counts']=={'NOT_ASSESSED':154,'READY':5,'BLOCKED':0}
assert plans['frontend_handoffs']['tasks']==64 and plans['frontend_handoffs']['checkpoints']==16
assert plans['frontend_handoffs']['externalEarlyGates']==plans['frontend_handoffs']['performanceEarlyGates']==0
post=json.loads((base/'postchecks.json').read_text())
assert post['status']=='PASS' and all(x['expectationMet'] for x in post['results'])
assert next(x for x in post['results'] if x['id']=='strict-target-denial')['exitCode']==1
for c in post['results']:assert digest(c['log'])==c['sha256']
probe=json.loads((base/'tamper-probes.json').read_text())
assert probe['status']=='PASS' and probe['restored'] and len(probe['probes'])==6
assert all(x['status']=='REJECTED' for x in probe['probes'])
binding=json.loads((base/'source-binding.json').read_text())
assert binding['sourceCommit']==index['sourceCommit'] and binding['manifestNodes']==42 and binding['currentBytesMatchCandidate'] and binding['normativeScopesMatchCandidate']
history=json.loads((base/'historical-evidence-integrity.json').read_text());assert history['changedHistoricalEvidence']==[]
scan=json.loads((base/'gitleaks-scan.json').read_text());assert scan['status']=='PASS' and scan['exitCode']==0
assert digest(base/'gitleaks.log')==scan['logSha256']
assert json.loads((base/'gitleaks-report.json').read_text())==[]
for item in scan['inputs']:assert digest(item['path'])==item['sha256'],item['path']
missing=[]
for filename in index['markdownChecks']:
 p=Path(filename)
 for link in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  link=link.strip('<>')
  if '://' not in link and not link.startswith(('#','mailto:')):
   target=link.split('#')[0];target=re.sub(r':\d+$','',target)
   if not (p.parent/target).exists():missing.append([filename,link])
assert not missing,missing
print(json.dumps({'status':'PASS','files':len(index['files']),'groups':140,'gate':'5 consumer-local READY including PROVIDER:A3','formalAccepted':False,'targetAcceptance':'NOT_RUN','performanceAcceptance':'NOT_RUN','missingLinks':[]},indent=2))
