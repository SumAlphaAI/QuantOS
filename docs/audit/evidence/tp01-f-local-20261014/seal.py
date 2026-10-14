"""Seal scoped local evidence after the frozen F assessment has completed."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
B=Path('docs/audit/evidence/tp01-f-local-20261014')
A=Path('docs/audit/evidence/provider-a1-remediation-20261004/tp01-f-local-20261014')
E=Path('docs/audit/evidence/tp01-e-readmission-20261014')
REPORT=Path('docs/audit/TP01-F-local-admission-2026-10-14.md')
SEAL=B/'seal.json'
sha=lambda p:'sha256:'+hashlib.sha256(Path(p).read_bytes()).hexdigest()
def links(creating=False):
    refs=[ref for ref in re.findall(r'\]\(([^)]+)\)',REPORT.read_text()) if '://' not in ref and not ref.startswith('#')]
    for ref in refs:
        target=REPORT.parent/ref.split('#')[0]
        assert target.is_file() or (creating and target.resolve()==SEAL.resolve()),ref
    return len(refs)
def verify():
    sealed=json.loads(SEAL.read_text());v=json.loads((B/'verification.json').read_text())
    assert sealed['schema']=='quantos-tp01-f-local-seal/v1'
    assert v['status']=='PASS' and v['sourceCommit']==sealed['sourceCommit']
    assert v['necessaryNodes']==29 and v['executedChecks']==92 and v['eReboundNodes']==28
    assert v['stageCounts']=={'READY':2,'NOT_ASSESSED':157,'BLOCKED':0}
    for entry in sealed['files']:
        assert sha(entry['path'])==entry['sha256'],entry['path']
        assert Path(entry['path']).stat().st_size==entry['bytes'],entry['path']
    assert links()==sealed['reportLinks']
    checks=json.loads((B/'post-checks.json').read_text())
    assert checks and all(c['exitCode']==c['expectedExitCode'] and not c['timedOut'] and c['signal'] is None for c in checks)
    for c in checks:assert sha(c['log'])==c['logSha256']
    assert v['formalAccepted'] is False and v['databaseExecution'] is False and v['targetCanaryAccepted'] is False
    print(json.dumps({'status':'PASS','sealedFiles':len(sealed['files']),'sourceCommit':v['sourceCommit'],'necessaryNodes':29,'executedChecks':92,'eReboundNodes':28,'postChecks':len(checks),'reportLinks':sealed['reportLinks'],'formalAccepted':False}))
if sys.argv[1:]==['--create']:
    assert not SEAL.exists(),'preserve earlier seal'
    paths=set(subprocess.check_output(['git','diff','--name-only','ee34aed0'],text=True).splitlines())
    paths.update(str(p) for root in (B,A,E) for p in root.rglob('*') if p.is_file())
    paths.update([str(REPORT),str(B/'changed-files.txt'),str(SEAL)])
    (B/'changed-files.txt').write_text('\n'.join(sorted(paths))+'\n')
    files=[{'path':p,'sha256':sha(p),'bytes':Path(p).stat().st_size} for p in sorted(paths-{str(SEAL)})]
    SEAL.write_text(json.dumps({'schema':'quantos-tp01-f-local-seal/v1','sourceCommit':json.loads((B/'verification.json').read_text())['sourceCommit'],'baselineCommit':'ee34aed0','files':files,'reportLinks':links(creating=True),'formalAccepted':False},indent=2)+'\n')
    verify()
elif sys.argv[1:]==['--verify']:verify()
else:raise SystemExit('usage: --create | --verify')
