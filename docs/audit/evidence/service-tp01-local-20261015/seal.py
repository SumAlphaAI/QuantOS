"""Seal local SERVICE evidence; source receipts remain bound to the frozen candidate."""
import hashlib,json,re,sys
from pathlib import Path
B=Path('docs/audit/evidence/service-tp01-local-20261015')
A=Path('docs/audit/evidence/provider-a1-remediation-20261004/service-tp01-local-20261015')
REPORT=Path('docs/audit/SERVICE-TP01-local-admission-2026-10-15.md')
SEAL=B/'seal.json'
sha=lambda p:'sha256:'+hashlib.sha256(Path(p).read_bytes()).hexdigest()
def links(creating=False):
    refs=[ref for ref in re.findall(r'\]\(([^)]+)\)',REPORT.read_text()) if '://' not in ref and not ref.startswith('#')]
    for ref in refs:
        target=REPORT.parent/ref.split('#')[0]
        assert target.is_file() or (creating and target.resolve()==SEAL.resolve()),ref
    return len(refs)
def expected_files():
    files={p for directory in [B,A] for p in directory.rglob("*") if p.is_file() and p!=SEAL}
    files.update([REPORT,Path("docs/SumAlpha-QuantOS-Development-Plan.md"),Path("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md")])
    return files
def verify():
    sealed=json.loads(SEAL.read_text());v=json.loads((B/'verification.json').read_text())
    assert sealed['schema']=='quantos-service-tp01-local-seal/v1'
    assert v['status']=='PASS' and v['sourceCommit']==sealed['sourceCommit']
    assert v['necessaryNodes']==31 and v['executedChecks']==99
    assert v['stageCounts']=={'READY':1,'NOT_ASSESSED':158,'BLOCKED':0}
    recorded=[entry['path'] for entry in sealed['files']]
    assert len(recorded)==len(set(recorded)), 'duplicate sealed path'
    assert set(recorded)=={str(p) for p in expected_files()}, 'incomplete seal inventory'
    for entry in sealed['files']:assert sha(entry['path'])==entry['sha256'],entry['path']
    assert links()==sealed['reportLinks']
    checks=json.loads((B/'post-checks.json').read_text());assert len(checks)==13
    for c in checks:
        assert c['exitCode']==c['expectedExitCode'] and c['signal'] is None and not c['timedOut']
        assert sha(c['log'])==c['logSha256']
    print(json.dumps({'status':'PASS','sourceCommit':v['sourceCommit'],'files':len(sealed['files']),'postChecks':len(checks),'formalAccepted':False,'externalPublished':False}))
if '--record' in sys.argv:
    assert not SEAL.exists(),'preserve immutable seal'
    files=expected_files()
    result={'schema':'quantos-service-tp01-local-seal/v1','sourceCommit':json.loads((B/'verification.json').read_text())['sourceCommit'],'formalAccepted':False,'externalPublished':False,'reportLinks':links(True),'files':[{'path':str(p),'sha256':sha(p)} for p in sorted(files)]}
    SEAL.write_text(json.dumps(result,indent=2)+'\n')
verify()
