from pathlib import Path
import json
root=Path.cwd()
base=root/'docs/audit/evidence/provider-a1-remediation-20261004/tp09-admission-20261011/attempt-01'
f05=json.loads((base/'f05-volume.json').read_text())
f07=json.loads((base/'supporting/f07-recovery/recovery-diagnostic.json').read_text())
assert f07['sourceCommit']==json.loads((base/'core-f07.json').read_text())['observedSourceCommit']
for k in ['eventCount','uniqueSideEffects','dispatched','appliedReceipts']:assert f05[k]==10000
assert f05['checkpointNextSequence']==10001
for k in ['recoveredRuns','scheduledRuns','uniqueArtifactBindings']:assert f07['measurements'][k]==100
assert f07['measurements']['recoveryCompleted'] is True
record={'schema':'quantos-tp09-performance/v1','formalAccepted':False,'correctness':'PASS','representativePerformanceGate':'NOT_ASSESSED','f05':f05,'f07':f07['measurements'],'limits':'F05 event-ID client retrieval only; F07 scheduling is diagnostic. No representative latency, full payload retrieval, soak or release acceptance.'}
(root/'docs/audit/evidence/tp09-20261011/performance-summary.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
