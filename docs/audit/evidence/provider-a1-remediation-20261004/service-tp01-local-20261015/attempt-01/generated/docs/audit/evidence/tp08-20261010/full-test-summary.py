from pathlib import Path
import re,json,subprocess
root=Path.cwd()
p=root/'docs/audit/evidence/provider-a1-remediation-20261004/tp08-admission-20261010/attempt-02/logs/f01-test.log'
s=p.read_text()
rust=sum(int(x) for x in re.findall(r'test result: ok\. (\d+) passed;',s))
ignored=sum(int(x) for x in re.findall(r'test result: ok\. \d+ passed; \d+ failed; (\d+) ignored;',s))
python=int(re.search(r'(\d+) passed in [\d.]+s',s)[1])
web=sum(int(x) for x in re.findall(r'Tests\s+(\d+) passed',s))
assert (rust,python,web)==(333,1287,229),(rust,python,web)
r={'schema':'quantos-tp08-full-test-summary/v1','status':'PASS','formalAccepted':False,'observedSourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'command':['make','test'],'sourceLog':str(p.relative_to(root)),'passed':{'rust':rust,'python':python,'web':web},'ignoredRust':ignored,'excludedFromTargetAcceptance':'Rust two default ignored cases and missing-DB early returns are not DB acceptance; Web three default skipped UDS bridges are not deployed UI E2E. This reference-only task has no UI service. Target dependencies are verified separately.'}
(root/'docs/audit/evidence/tp08-20261010/full-test-summary.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r))
